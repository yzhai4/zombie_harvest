"""Three actual calendar days through public game controls only.

Run with --fresh for a new isolated game, or --resume with the same persistent
profile/checkpoint. Never inject a save or call game functions. Calendar time
is advanced by the ordinary barracks action (+30 minutes), not by closing a
night report. Repeated training also raises SAN/morale and lowers guard stress;
this is a regression route, not a balance or natural-play evaluation.

The parent process should poll this confirmed process every 30 seconds. The
runner prints an independent 15-second heartbeat and has a 600-second budget.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


SAVE_KEY = "zombie-harvest-progress-v12"


def is_known_favicon_404(url: str, status: int, game_url: str) -> bool:
    """Only the browser's exact same-origin default favicon is diagnostic-only."""
    candidate, game = urlsplit(url), urlsplit(game_url)
    return status == 404 and (candidate.scheme, candidate.netloc) == (game.scheme, game.netloc) and candidate.path == "/favicon.ico"


def is_known_favicon_console(message, game_url: str) -> bool:
    # Old text-only errors have no attributable URL and are never whitelisted.
    if not isinstance(message, dict) or not re.search(r"\b404\b", str(message.get("text", ""))):
        return False
    location = message.get("location")
    return isinstance(location, dict) and is_known_favicon_404(str(location.get("url", "")), 404, game_url)


MODE = "public-action-calendar-progression"
ACTION_SECONDS = 30
ENCOUNTER_SECONDS = 60
GLOBAL_SECONDS = 600
HEARTBEAT_SECONDS = 15
MAX_NAVIGATION_ATTACKS = 4
QA_ROOT = Path(os.environ.get("ZFARM_QA_DIR", str(Path.home() / ".cache" / "zfarm-qa")))

# Read-only evaluation: primary save plus independently recomputed browser
# checksum, date and visible DOM. No localStorage writes or hidden game state.
READ_SAVE = """key => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const envelope = JSON.parse(raw), payload = envelope.payload;
  if (!payload) return {error:'missing-primary-envelope'};
  let hash = 2166136261; const text = JSON.stringify(payload);
  for (let i=0; i<text.length; i++) {hash ^= text.charCodeAt(i); hash = Math.imul(hash,16777619);}
  return {envelope, computedChecksum:(hash>>>0).toString(16),
    domDay:document.querySelector('#dayLabel')?.textContent || '',
    domTime:document.querySelector('#timeLabel')?.textContent || ''};
}"""


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def clock_minutes(payload: dict) -> int:
    return (int(payload["day"]) - 1) * 1440 + int(payload["hour"]) * 60 + int(payload["minute"])


def dom_minutes(day: str, clock: str) -> int:
    day_match = re.search(r"第\s*(\d+)\s*天", day)
    time_match = re.search(r"(\d{1,2}):(\d{2})", clock)
    if not day_match or not time_match:
        raise RuntimeError(f"unreadable DOM calendar: {day!r} {clock!r}")
    return (int(day_match[1]) - 1) * 1440 + int(time_match[1]) * 60 + int(time_match[2])


def matching_events(payload: dict, event_type: str, after_seq: int = -1, **fields: object) -> list[dict]:
    return [event for event in payload.get("worldMeta", {}).get("events", [])
            if event.get("type") == event_type and int(event.get("seq", -1)) > after_seq
            and all(event.get("payload", {}).get(key) == value for key, value in fields.items())]


def supply_choice_saved(payload: dict, after_seq: int) -> bool:
    event = payload.get("event") or {}
    receipts = matching_events(payload, "event.resolved", after_seq, eventId="supply", choice="a")
    command_ids = {item.get("commandId") for item in receipts}
    commands = payload.get("worldMeta", {}).get("replay", {}).get("commands", [])
    return event.get("id") == "supply" and event.get("handled") is True and bool(receipts) and any(
        command.get("commandId") in command_ids and command.get("type") == "event.resolve"
        and (command.get("payload") or {}).get("choice") == "a" for command in commands)


def closed_threat_events(payload: dict, threat_id: str, after_seq: int) -> list[dict]:
    commands = {command.get("commandId"): command for command in payload.get("worldMeta", {}).get("replay", {}).get("commands", [])}
    matched = []
    for event in matching_events(payload, "threat.closed", after_seq):
        detail = event.get("payload") or {}
        command = commands.get(event.get("commandId"), {})
        specific = detail.get("threatId") == threat_id
        legacy = not detail and command.get("type") == "threat.close" and (command.get("payload") or {}).get("threatId") == threat_id
        if specific or legacy:
            matched.append(event)
    return matched


def started_threat_events(payload: dict, day: int, after_seq: int, resolved_seq: int, threat_id: str) -> list[dict]:
    commands = {command.get("commandId"): command for command in payload.get("worldMeta", {}).get("replay", {}).get("commands", [])}
    matched = []
    for event in matching_events(payload, "threat.started", after_seq, day=day):
        tick = int(event["tick"]["world"])
        # The shipped encounter ID is built immediately before the started
        # receipt. This ties old started records (without payload.threatId) to
        # this exact encounter; same calendar minute alone is insufficient.
        generated_id = f"threat-{day}-{(tick % 1440) // 60}-{tick % 60}-{event['seq']}"
        if event["seq"] < resolved_seq and generated_id == threat_id and commands.get(event.get("commandId"), {}).get("type") == "threat.start":
            matched.append(event)
    return matched


def saved_crop_change(before: dict, payload: dict, harvest: bool) -> bool:
    plot = next((b for b in payload["buildings"] if b["type"] == "garden" and b["x"] == 7 and b["y"] == 14), None)
    if not matching_events(payload, "crop.changed", before["worldMeta"]["eventSeq"]) or not plot:
        return False
    if harvest:
        return not plot.get("planted") and not plot.get("ready") and payload["food"] >= before["food"] + 3
    return bool(plot.get("planted")) and payload["seeds"] == before["seeds"] - 1


def navigation_attack_evidence(pending: dict, payload: dict) -> dict | None:
    """Verify one committed public attack, including its specific command."""
    required = ("beforeSeq", "beforeMinute", "beforeHp", "beforeEnergy", "nearbyEnemyHp")
    if any(key not in pending for key in required):
        return None
    receipts = matching_events(payload, "threat.attacked", pending["beforeSeq"])
    if len(receipts) != 1:
        return None
    receipt = receipts[0]
    command_id = receipt.get("commandId")
    commands = [command for command in payload.get("worldMeta", {}).get("replay", {}).get("commands", [])
                if command_id and command.get("commandId") == command_id and command.get("type") == "threat.attack"]
    if len(commands) != 1 or clock_minutes(payload) < pending["beforeMinute"] + 10:
        return None
    if int((receipt.get("tick") or {}).get("world", -1)) < pending["beforeMinute"] + 10:
        return None
    hp = {enemy["id"]: float(enemy["hp"]) for enemy in payload.get("worldZombies", [])}
    # Killed enemies disappear through the ordinary simulation; absence
    # projects zero HP only alongside the linked attack and action costs.
    changes = [{"enemyId": enemy_id, "beforeHp": old_hp, "afterHp": hp.get(enemy_id, 0)}
               for enemy_id, old_hp in pending["nearbyEnemyHp"].items() if hp.get(enemy_id, 0) < old_hp]
    if not changes or payload["energy"] > pending["beforeEnergy"] - 5:
        return None
    return {"receipt": receipt, "commandId": command_id, "enemyHpChanges": changes,
            "energyBefore": pending["beforeEnergy"], "energyAfter": payload["energy"],
            "hpBefore": pending["beforeHp"], "hpAfter": payload["hp"]}


def complete_event_window(previous: dict, current: dict) -> list[dict] | None:
    """Every sequence after the original snapshot must still be available."""
    since, until = int(previous["worldMeta"]["eventSeq"]), int(current["worldMeta"]["eventSeq"])
    if until <= since:
        return None
    events = [event for event in current["worldMeta"].get("events", []) if since < event["seq"] <= until]
    return events if [event["seq"] for event in events] == list(range(since + 1, until + 1)) else None


def linked_world_advance(event: dict, payload: dict) -> bool:
    try:
        if type(event["payload"]["minutes"]) not in (int, float):
            return False
        commands = [command for command in payload["worldMeta"]["replay"]["commands"]
                    if event.get("commandId") and command.get("commandId") == event["commandId"]]
        return len(commands) == 1 and commands[0].get("type") == "world.advance" and commands[0].get("actorId") == "player-1" \
            and (commands[0].get("payload") or {}).get("minutes") == event["payload"]["minutes"] \
            and clock_minutes(event["payload"]) == event["tick"]["world"]
    except (KeyError, TypeError, ValueError):
        return False


def natural_window_evidence(before: dict, payload: dict) -> dict | None:
    """Prove a retained interval contains only natural clock advances."""
    try:
        if payload["worldMeta"]["eventSeq"] == before["worldMeta"]["eventSeq"]:
            return {"minutes": 0, "eventIds": []} if clock_minutes(payload) == clock_minutes(before) else None
        events = complete_event_window(before, payload)
        if events is None or any(event["type"] == "camp.area.interacted" for event in events):
            return None
        ticks = [event for event in events if event["type"] == "time.advanced"]
        if any(not linked_world_advance(event, payload) or event.get("causationId") is not None
               or not 1 <= event["payload"]["minutes"] <= 5 for event in ticks):
            return None
        cursor = clock_minutes(before)
        for event in ticks:
            cursor += event["payload"]["minutes"]
            if event["tick"]["world"] != cursor:
                return None
        minutes = sum(event["payload"]["minutes"] for event in ticks)
        return {"minutes": minutes, "eventIds": [event["eventId"] for event in ticks]} \
            if clock_minutes(payload) - clock_minutes(before) == minutes else None
    except (KeyError, TypeError, ValueError):
        return None


def area_action_evidence(before: dict, payload: dict, zone: str, expected_minutes: int = 30) -> dict | None:
    """Bind one area action to its real command and complete clock trajectory."""
    try:
        events = complete_event_window(before, payload)
        if events is None:
            return None
        receipts = [event for event in events if event["type"] == "camp.area.interacted"]
        if len(receipts) != 1:
            return None
        receipt = receipts[0]
        detail = receipt["payload"]
        begin, end = detail["before"]["time"], detail["after"]["time"]
        if any(type(detail.get(key)) not in (int, float) or not math.isfinite(detail[key]) for key in ("x", "y")):
            return None
        commands = [command for command in payload["worldMeta"]["replay"]["commands"]
                    if receipt.get("commandId") and command.get("commandId") == receipt["commandId"]]
        if len(commands) != 1 or commands[0].get("type") != "camp.area.interact" or commands[0].get("actorId") != "player-1":
            return None
        command_payload = commands[0].get("payload") or {}
        if detail.get("zone") != zone or command_payload.get("zone") != zone or detail.get("minutes") != expected_minutes \
                or end - begin != expected_minutes or receipt["tick"]["world"] != end \
                or any(command_payload.get(key) != detail.get(key) for key in ("x", "y")):
            return None
        advances = [event for event in events if event["type"] == "time.advanced"]
        if any(not linked_world_advance(event, payload) for event in advances):
            return None
        cursor = clock_minutes(before)
        for event in advances:
            cursor += event["payload"]["minutes"]
            if event["tick"]["world"] != cursor:
                return None
        action_ticks = [event for event in advances if event.get("causationId") == receipt["commandId"]]
        if len(action_ticks) != 1:
            return None
        action_tick = action_ticks[0]
        if action_tick["payload"]["minutes"] != expected_minutes or action_tick["tick"]["world"] != end or action_tick["seq"] >= receipt["seq"]:
            return None
        natural = [event for event in advances if event is not action_tick]
        if any(event.get("causationId") is not None or not 1 <= event["payload"]["minutes"] <= 5 for event in natural):
            return None
        pre = [event for event in natural if event["seq"] < action_tick["seq"] and event["tick"]["world"] <= begin]
        post = [event for event in natural if event["seq"] > receipt["seq"] and event["tick"]["world"] > end]
        if len(pre) + len(post) != len(natural):
            return None
        pre_minutes, post_minutes = (sum(event["payload"]["minutes"] for event in group) for group in (pre, post))
        if clock_minutes(before) + pre_minutes != begin or end + post_minutes != clock_minutes(payload):
            return None
        return {"receipt": receipt, "actionTick": action_tick, "naturalMinutesBefore": pre_minutes, "naturalMinutesAfter": post_minutes,
                "naturalEventIdsBefore": [event["eventId"] for event in pre], "naturalEventIdsAfter": [event["eventId"] for event in post]}
    except (KeyError, TypeError, ValueError):
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--fresh", action="store_true")
    mode.add_argument("--resume", action="store_true")
    parser.add_argument("--url", default=os.environ.get("ZFARM_TEST_URL", "http://127.0.0.1/"))
    parser.add_argument("--profile", type=Path, default=Path(os.environ.get("ZFARM_THREE_DAY_PROFILE", str(QA_ROOT / "three-day-profile"))))
    parser.add_argument("--out", type=Path, default=Path(os.environ.get("ZFARM_THREE_DAY_OUT", str(QA_ROOT / "three-days-result.json"))))
    parser.add_argument("--checkpoint", type=Path, default=Path(os.environ.get("ZFARM_THREE_DAY_CHECKPOINT", str(QA_ROOT / "three-days-checkpoint.json"))))
    parser.add_argument("--chrome", default=os.environ.get("CHROME_BIN", "/usr/bin/google-chrome"))
    parser.add_argument("--headed", action="store_true", help="show the isolated browser window")
    parser.add_argument("--timeout", type=int, default=GLOBAL_SECONDS, help="total run budget in seconds (default: 600)")
    parser.add_argument("--finish-hour", type=int, choices=range(0, 24), default=6)
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    args.resume = not args.fresh
    return args


class Runner:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.started = time.monotonic()
        self.deadline = self.started + args.timeout
        self.stage = "initializing"
        self.last_dom = None
        self.stop_heartbeat = threading.Event()
        self.page = None
        self.last_save = None
        self.artifacts = QA_ROOT / "artifacts" / args.out.stem
        self.artifacts.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.result = {
            "runner": "server-three-days", "mode": MODE, "url": args.url,
            "profile": str(args.profile.resolve()), "startedAtUnix": time.time(),
            "limits": {"actionSeconds": ACTION_SECONDS, "encounterSeconds": ENCOUNTER_SECONDS, "globalSeconds": args.timeout,
                       "heartbeatSeconds": HEARTBEAT_SECONDS, "parentPollingSeconds": 30},
            "policy": {"newGameViaPublicReset": True, "saveInjection": False, "hiddenStateMutation": False,
                       "internalFunctionCalls": False, "primarySaveReadOnly": True},
            "routeSideEffects": ["Each barracks interaction advances 30 minutes, raises player SAN by 2 and morale by 2.",
                                 "Training raises active guards' SAN/morale and lowers stress; this route is not a balance evaluation.",
                                 "Residence dinner consumes one food while lowering all active NPC hunger; ordinary crop and resource rewards are retained."],
            "checks": [], "errors": [], "consoleErrors": [], "httpErrors": [], "actions": [],
            "nightDays": [], "calendarTransitions": [], "snapshots": [], "completedStages": [], "navigationSegments": {},
        }
        if args.resume:
            saved = json.loads(args.checkpoint.read_text(encoding="utf-8"))
            if saved.get("mode") != MODE or saved.get("url") != args.url or saved.get("profile") != str(args.profile.resolve()):
                raise RuntimeError("runner checkpoint does not match this origin/profile/mode")
            self.result = saved["result"]
            previous_errors = list(self.result.get("errors", []))
            self.result["errors"] = []
            self.result.setdefault("resumeSessions", []).append({"atUnix": time.time(), "previousErrors": previous_errors,
                "previousFailedChecks": [item for item in self.result["checks"] if not item["ok"]], "previousHtmlSha256": self.result.get("htmlSha256"),
                "previousStage": saved.get("stage"), "previousLastVerifiedSave": saved.get("lastVerifiedSave")})
            self.result["checks"] = [item for item in self.result["checks"] if item["ok"]]
            self.expected_checkpoint = saved.get("lastVerifiedSave")
        else:
            self.expected_checkpoint = None
        self.result.setdefault("policy", {})["maxAcceptedDomSaveLagMinutes"] = 1

    def heartbeat(self) -> None:
        while not self.stop_heartbeat.wait(HEARTBEAT_SECONDS):
            print(json.dumps({"heartbeat": MODE, "stage": self.stage, "elapsedSeconds": round(time.monotonic() - self.started, 1),
                              "pid": os.getpid(),
                              "domMinute": self.last_dom, "nightDays": self.result["nightDays"],
                              "actionCount": len(self.result["actions"])}, ensure_ascii=False), flush=True)

    def guard(self) -> None:
        if time.monotonic() >= self.deadline:
            raise TimeoutError(f"{self.args.timeout}-second global browser run budget exhausted")

    def timeout(self, seconds: int = ACTION_SECONDS) -> int:
        self.guard()
        return max(1, int(min(seconds, self.deadline - time.monotonic()) * 1000))

    def check(self, name: str, condition: bool, detail: object = None) -> None:
        self.result["checks"].append({"name": name, "ok": bool(condition), "detail": detail})
        if not condition:
            raise AssertionError(f"{name}: {detail}")

    def survival(self, payload: dict, stage: str, establish: bool = False) -> None:
        ids = sorted(npc["id"] for npc in payload["npcs"])
        self.check(stage + " exactly ten unique roster IDs", len(ids) == 10 and len(set(ids)) == 10, ids)
        if "rosterIds" not in self.result:
            if not establish:
                raise AssertionError("initial roster baseline is unavailable")
            self.result["rosterIds"] = ids
        self.check(stage + " initial roster IDs preserved", ids == self.result["rosterIds"], ids)
        active = sum(npc.get("lifeState") != "dead" for npc in payload["npcs"])
        collapse = payload["contentState"]["meters"]["campCollapse"]
        self.check(stage + " camp existence invariants", active >= 3 and payload["hp"] > 0 and collapse < 90,
                   {"activeNpcCount": active, "campHp": payload["hp"], "campCollapse": collapse})

    def record_build(self, response, stage: str) -> None:
        self.check(stage + " actual served HTML request succeeds", response is not None and response.status == 200,
                   response.status if response is not None else None)
        html_sha = hashlib.sha256(response.body()).hexdigest()
        if self.args.resume:
            session = self.result["resumeSessions"][-1]
            session.setdefault("htmlSha256", html_sha)
            session["lastHtmlSha256"] = html_sha
        self.result["htmlSha256"] = html_sha
        self.result.setdefault("buildSessions", []).append({"atUnix": time.time(), "htmlSha256": html_sha,
            "stage": stage, "mode": "fresh" if self.args.fresh else "resume"})

    def calendar(self) -> int:
        self.guard()
        value = dom_minutes(self.page.locator("#dayLabel").text_content() or "", self.page.locator("#timeLabel").text_content() or "")
        self.last_dom = value
        return value

    def read_save(self) -> dict | None:
        observed = self.page.evaluate(READ_SAVE, SAVE_KEY)
        if observed is None:
            return None
        if "error" in observed:
            raise AssertionError(observed["error"])
        envelope = observed["envelope"]
        payload = envelope["payload"]
        if envelope.get("checksum") != observed["computedChecksum"]:
            raise AssertionError("primary game save checksum is invalid")
        minute = clock_minutes(payload)
        if envelope.get("savedAt") != minute:
            raise AssertionError("primary game save date and savedAt disagree")
        if payload.get("version") != 21 or payload.get("contentState", {}).get("contentVersion") != 3:
            raise AssertionError("unexpected save/content schema")
        observed["minute"] = minute
        observed["domMinute"] = dom_minutes(observed["domDay"], observed["domTime"])
        observed["domLagMinutes"] = observed["domMinute"] - minute
        return observed

    def settle_save(self, minimum_minute: int | None = None, minimum_seq: int | None = None, predicate=None) -> dict:
        # Let the game's 650ms checkpoint debounce finish. Older builds only
        # checkpointed training on the world timer; neither route permits an
        # old save to count as current progress.
        end = min(self.deadline, time.monotonic() + ACTION_SECONDS)
        while time.monotonic() < end:
            self.guard()
            observed = self.read_save()
            if observed:
                payload = observed["envelope"]["payload"]
                seq = int(payload.get("worldMeta", {}).get("eventSeq", 0))
                # The natural 1.2s clock and a 650ms debounced checkpoint can
                # miss the same-minute window under heavy DOM work. Accept at
                # most one minute of explicitly recorded DOM lag, retaining
                # the action's minimum clock/seq and exact receipt predicate.
                if 0 <= observed["domLagMinutes"] <= 1 and (minimum_minute is None or observed["minute"] >= minimum_minute) and (minimum_seq is None or seq >= minimum_seq) and (predicate is None or predicate(payload)):
                    self.last_save = observed
                    return observed
            self.page.wait_for_timeout(100)
        raise TimeoutError("primary save did not catch up to the DOM after checkpoint debounce")

    def persist(self, stage: str, snapshot: dict | None = None, complete: bool = False) -> None:
        self.stage = stage
        if snapshot is not None:
            self.last_save = snapshot
            envelope = snapshot["envelope"]
            payload = envelope["payload"]
            safe_name = re.sub(r"[^a-zA-Z0-9_-]", "-", stage)
            artifact = self.artifacts / f"{len(self.result['snapshots']):02d}-{safe_name}-save.json"
            write_json(artifact, envelope)
            self.result["snapshots"].append({"stage": stage, "path": str(artifact), "checksum": envelope["checksum"],
                                             "day": payload["day"], "hour": payload["hour"], "minute": payload["minute"],
                                             "eventSeq": payload["worldMeta"]["eventSeq"], "htmlSha256": self.result.get("htmlSha256"),
                                             "domMinute": snapshot["domMinute"], "domLagMinutes": snapshot["domLagMinutes"]})
            if self.page is not None and not self.page.is_closed() and any(token in stage for token in ("summary", "calendar-day-", "final-", "complete", "navigation-obstruction")):
                screenshot = self.artifacts / f"{len(self.result['snapshots']) - 1:02d}-{safe_name}.png"
                self.page.screenshot(path=str(screenshot), timeout=self.timeout(10))
                self.result["snapshots"][-1]["screenshot"] = str(screenshot)
        if complete and stage not in self.result["completedStages"]:
            self.result["completedStages"].append(stage)
        verified = None
        if self.last_save:
            verified = {"checksum": self.last_save["envelope"]["checksum"], "minute": self.last_save["minute"],
                        "eventSeq": self.last_save["envelope"]["payload"]["worldMeta"]["eventSeq"],
                        "domMinute": self.last_save["domMinute"], "domLagMinutes": self.last_save["domLagMinutes"]}
        write_json(self.args.checkpoint, {"version": 1, "mode": MODE, "url": self.args.url, "profile": str(self.args.profile.resolve()),
                                         "stage": stage, "lastVerifiedSave": verified, "result": self.result})
        write_json(self.args.out, self.result)

    def close_panels(self) -> None:
        if self.page.locator("#infoModal").get_attribute("aria-hidden") == "false":
            self.page.locator("#infoModalClose").click(timeout=self.timeout())
        self.page.keyboard.press("Escape")

    def position(self) -> tuple[float, float]:
        # This is the public location label, updated immediately by movement.
        label = self.page.locator("#mapRegionLabel").text_content() or ""
        match = re.search(r"([\d.]+)/\d+列\s*·\s*([\d.]+)/\d+行", label)
        if match:
            return float(match[1]) - 1, float(match[2]) - 1
        value = self.page.evaluate("""() => {
          const world=document.querySelector('#world'), marker=world?.querySelector('.player-marker');
          const tiles=[...world.querySelectorAll('.tile')];
          return {x:Math.min(...tiles.map(t=>+t.dataset.x))+parseFloat(marker.style.left)/parseFloat(marker.style.width),
                  y:Math.min(...tiles.map(t=>+t.dataset.y))+parseFloat(marker.style.top)/parseFloat(marker.style.height)};
        }""")
        return value["x"], value["y"]

    def navigate(self, x: float, y: float, tolerance: float = 0.3) -> None:
        self.close_panels()
        segment = self.navigation_segment(x, y)
        self.persist("navigation-segment-start")
        end = min(self.deadline, time.monotonic() + ACTION_SECONDS)
        previous = self.position()
        stalled = 0
        while time.monotonic() < end:
            self.guard()
            px, py = self.position()
            if abs(px - x) <= tolerance and abs(py - y) <= tolerance:
                segment["active"] = False
                segment["completedPosition"] = [px, py]
                self.persist("navigation-segment-complete")
                return
            dx, dy = x - px, y - py
            key = ("d" if dx > 0 else "a") if abs(dx) > tolerance else ("s" if dy > 0 else "w")
            remaining = abs(dx) if key in ("d", "a") else abs(dy)
            duration = max(60, min(300, int(remaining / 2 * 1000)))
            self.page.keyboard.down(key)
            self.page.wait_for_timeout(duration)
            self.page.keyboard.up(key)
            self.page.wait_for_timeout(60)
            current = self.position()
            stalled = stalled + 1 if math.dist(current, previous) < 0.05 else 0
            if stalled >= 3:
                if segment["attackAttempts"] >= MAX_NAVIGATION_ATTACKS:
                    raise AssertionError(f"navigation still obstructed after {MAX_NAVIGATION_ATTACKS} public attack attempts toward {(x,y)}")
                self.clear_navigation_threat(x, y, segment)
                # Each attack has its own bounded checkpoint wait. Restore
                # the movement budget after it finishes, while the overall
                # deadline and per-waypoint attack limit still apply.
                end = min(self.deadline, time.monotonic() + ACTION_SECONDS)
                stalled = 0
                previous = self.position()
                continue
            previous = current
        raise TimeoutError(f"public navigation timeout toward {(x,y)}")

    def navigation_segment(self, x: float, y: float) -> dict:
        """Keep the attack budget until this waypoint is actually reached."""
        key = f"{x:.3f},{y:.3f}"
        segments = self.result.setdefault("navigationSegments", {})
        prior = segments.get(key)
        if prior and prior.get("active"):
            return prior
        generation = int(prior.get("generation", 0)) + 1 if prior else 1
        # Old runners recorded attacks but no waypoint completion watermark.
        # Conservatively retain those costs for the first migrated segment.
        legacy = [action for action in self.result["actions"] if not prior and action.get("type") == "navigation-threat-attack"
                  and action.get("waypoint") == [x, y] and not action.get("segmentId")]
        segment = {"segmentId": f"navigation-{key}-{generation}", "waypoint": [x, y], "generation": generation,
                   "active": True, "attackAttempts": len(legacy), "verifiedEventIds": [action["eventId"] for action in legacy]}
        segments[key] = segment
        return segment

    def record_navigation_attack(self, pending: dict, observed: dict, recovered: bool = False) -> None:
        after = observed["envelope"]["payload"]
        evidence = navigation_attack_evidence(pending, after)
        self.check("navigation public attack has actual health/time/command effect", evidence is not None, evidence)
        segment = self.navigation_segment(*pending["waypoint"])
        self.check("navigation pending attack belongs to its unfinished segment", pending["segmentId"] == segment["segmentId"])
        event_id = evidence["receipt"]["eventId"]
        if not any(action.get("eventId") == event_id for action in self.result["actions"]):
            self.result["actions"].append({"type": "navigation-threat-attack", "waypoint": pending["waypoint"],
                "segmentId": segment["segmentId"], "attempt": pending["attempt"], "before": pending["beforeMinute"],
                "after": clock_minutes(after), "energyBefore": evidence["energyBefore"], "energyAfter": evidence["energyAfter"],
                "hpBefore": evidence["hpBefore"], "hpAfter": evidence["hpAfter"], "enemyHpChanges": evidence["enemyHpChanges"],
                "eventId": event_id, "commandId": evidence["commandId"], "recoveredFromPrimarySave": recovered})
        if event_id not in segment["verifiedEventIds"]:
            segment["verifiedEventIds"].append(event_id)
        side_effect = "Obstructing daytime threats use at most four public attack attempts per unfinished waypoint segment; committed attacks cost 5 energy and advance 10 minutes, and surviving enemies may bite, lowering HP/SAN. A pre-click interruption conservatively retains its reserved attempt."
        if side_effect not in self.result["routeSideEffects"]:
            self.result["routeSideEffects"].append(side_effect)
        self.result.pop("pendingNavigationAttack", None)
        self.survival(after, "navigation after public attack")
        self.persist("navigation-obstruction-resumed-after-attack" if recovered else "navigation-obstruction-after-attack", observed, complete=True)

    def clear_navigation_threat(self, waypoint_x: float, waypoint_y: float, segment: dict) -> None:
        """A bounded public attack, backed by a real enemy-health receipt."""
        self.stage = "navigation-obstruction"
        attack = self.page.locator("#attackBtn")
        self.check("navigation obstruction has public attack affordance", attack.is_visible() and attack.is_enabled())
        px, py = self.position()
        before_observed = self.settle_save(self.calendar(), predicate=lambda value:
            math.hypot(value["player"]["x"] - px, value["player"]["y"] - py) <= 0.2)
        before = before_observed["envelope"]["payload"]
        self.check("navigation attack uses available action energy", before["energy"] >= 5, before["energy"])
        nearby = {enemy["id"]: float(enemy["hp"]) for enemy in before.get("worldZombies", [])
                  if enemy.get("hp", 0) > 0 and math.hypot(enemy["x"] - px, enemy["y"] - py) <= 1.15}
        self.check("navigation obstruction is a real adjacent world threat", bool(nearby), nearby)
        before_seq = before["worldMeta"]["eventSeq"]
        self.check("navigation unfinished segment retains bounded attack budget", segment["attackAttempts"] < MAX_NAVIGATION_ATTACKS, segment)
        # Reserve before clicking. A crash between click and checkpoint must
        # neither repeat a committed attack nor reset its waypoint budget.
        segment["attackAttempts"] += 1
        self.result["pendingNavigationAttack"] = {"beforeSeq": before_seq, "beforeMinute": clock_minutes(before),
            "beforeHp": before["hp"], "beforeEnergy": before["energy"], "nearbyEnemyHp": nearby,
            "waypoint": [waypoint_x, waypoint_y], "segmentId": segment["segmentId"], "attempt": segment["attackAttempts"]}
        self.persist("navigation-obstruction-before-attack", before_observed)
        attack.click(timeout=self.timeout())
        pending = self.result["pendingNavigationAttack"]
        after_observed = self.settle_save(clock_minutes(before) + 10, before_seq + 1,
                                         predicate=lambda value: navigation_attack_evidence(pending, value) is not None)
        self.record_navigation_attack(pending, after_observed)

    def area_action(self, label: str, expected_minutes: int = 30) -> None:
        self.close_panels()
        button = self.page.locator('#contextActions [data-context-action="area"]').filter(has_text=label)
        zone = "barracks" if label == "兵营" else "residence"
        button.wait_for(state="visible", timeout=self.timeout())
        self.check(f"public {label} affordance", button.count() == 1, self.position())
        before_observed = self.settle_save(self.calendar())
        before_save = before_observed["envelope"]["payload"]
        before, before_seq = clock_minutes(before_save), before_save["worldMeta"]["eventSeq"]
        if zone == "barracks":
            self.check("new public training has no unresolved earlier attempt", not self.result.get("pendingTrainingAction"))
            self.result["pendingTrainingAction"] = {"zone": zone, "expectedMinutes": expected_minutes,
                "beforeSnapshotIndex": len(self.result["snapshots"]), "beforeMinute": before, "beforeEventSeq": before_seq,
                "source": "public-training-before-click"}
            self.persist(f"day-{before_save['day']}-training-before-action", before_observed)
        button.click(timeout=self.timeout())
        self.page.wait_for_function("""target => {
          const d=+(document.querySelector('#dayLabel').textContent.match(/第\\s*(\\d+)/)||[])[1];
          const t=document.querySelector('#timeLabel').textContent.match(/(\\d+):(\\d+)/);
          return (d-1)*1440+(+t[1])*60+(+t[2]) >= target;
        }""", arg=before + expected_minutes, timeout=self.timeout())
        # Do not lock the save to an instantaneous post-click DOM clock.
        # The exact receipt plus its full causal clock trace establishes cost.
        saved = self.settle_save(before + expected_minutes, before_seq + 1,
                                predicate=lambda payload: area_action_evidence(before_save, payload, zone, expected_minutes) is not None)
        evidence = area_action_evidence(before_save, saved["envelope"]["payload"], zone, expected_minutes)
        self.check(f"public {label} action persisted its exact causal receipt", evidence is not None, evidence)
        if zone == "barracks":
            self.record_training_action(self.result["pendingTrainingAction"], before_observed, saved, evidence)
        else:
            receipt = evidence["receipt"]
            self.result["actions"].append({"type": "residence-dinner", "before": receipt["payload"]["before"]["time"],
                "after": receipt["payload"]["after"]["time"], "observedAfterMinute": saved["minute"],
                "publicExpectedMinutes": expected_minutes, "eventId": receipt["eventId"], "commandId": receipt["commandId"],
                "naturalMinutesBefore": evidence["naturalMinutesBefore"], "naturalMinutesAfter": evidence["naturalMinutesAfter"]})

    def record_training_action(self, pending: dict, before: dict, observed: dict, evidence: dict, recovered: bool = False) -> None:
        receipt = evidence["receipt"]
        index = pending["beforeSnapshotIndex"]
        metadata = self.result["snapshots"][index]
        self.check("training evidence retains original before snapshot watermark", metadata["eventSeq"] == pending["beforeEventSeq"]
                   and before["minute"] == pending["beforeMinute"] and before["envelope"]["checksum"] == metadata["checksum"])
        existing = [action for action in self.result["actions"] if action.get("eventId") == receipt["eventId"]
                    or action.get("commandId") == receipt["commandId"]]
        self.check("training receipt is recorded at most once", len(existing) <= 1
                   and (not existing or existing[0]["type"] == "barracks-training"
                        and existing[0].get("eventId") == receipt["eventId"]
                        and existing[0].get("commandId") == receipt["commandId"]), receipt["eventId"])
        if not existing:
            self.result["actions"].append({"type": "barracks-training", "before": receipt["payload"]["before"]["time"],
                "after": receipt["payload"]["after"]["time"], "observedAfterMinute": observed["minute"],
                "publicExpectedMinutes": pending["expectedMinutes"], "eventId": receipt["eventId"], "commandId": receipt["commandId"],
                "beforeSnapshotIndex": index, "beforeSnapshotSource": "verified-runner-snapshot", "beforeEventSeq": pending["beforeEventSeq"],
                "beforePrimaryMinute": before["minute"], "beforeSnapshotProvenance": {key: metadata.get(key) for key in ("stage", "path", "checksum", "htmlSha256")},
                "naturalMinutesBefore": evidence["naturalMinutesBefore"], "naturalMinutesAfter": evidence["naturalMinutesAfter"],
                "naturalEventIdsBefore": evidence["naturalEventIdsBefore"], "naturalEventIdsAfter": evidence["naturalEventIdsAfter"],
                "actionAdvanceEventId": evidence["actionTick"]["eventId"], "recoveredFromPrimarySave": recovered})
        self.result.pop("pendingTrainingAction", None)
        self.survival(observed["envelope"]["payload"], "after verified public training")
        self.persist(f"training-{'resumed' if recovered else 'verified'}-{receipt['eventId']}", observed)

    def training_before(self, pending: dict) -> dict:
        index = pending["beforeSnapshotIndex"]
        before = self.transition_snapshot(index)
        payload = before["envelope"]["payload"]
        metadata = self.result["snapshots"][index]
        source_hash = metadata.get("htmlSha256")
        self.check("training original artifact keeps its schema/time/seq/source binding", payload["version"] == 21
                   and payload["contentState"]["contentVersion"] == 3 and payload["worldMeta"]["eventSeq"] == pending["beforeEventSeq"]
                   and before["minute"] == pending["beforeMinute"] and isinstance(source_hash, str)
                   and re.fullmatch(r"[a-f0-9]{64}", source_hash) is not None and source_hash == self.result.get("htmlSha256"), index)
        return before

    def reconcile_training(self, observed: dict) -> None:
        """Consume saved training once; infer legacy attempts only from files."""
        payload = observed["envelope"]["payload"]
        pending = self.result.get("pendingTrainingAction")
        if not pending and self.args.resume and self.result.get("resumeSessions"):
            session = self.result["resumeSessions"][-1]
            failed_stage = re.fullmatch(r"failed-day-(\d+)-public-training", session.get("previousStage") or "")
            watermark = session.get("previousLastVerifiedSave")
            timed_out = any("primary save did not catch up" in error for error in session.get("previousErrors", []))
            if failed_stage and watermark and timed_out and not session.get("legacyTrainingReconciled"):
                failed_day = int(failed_stage[1])
                candidates = [(index, item) for index, item in enumerate(self.result["snapshots"])
                              if item["day"] == failed_day and item["eventSeq"] <= watermark["eventSeq"]
                              and (item["day"] - 1) * 1440 + item["hour"] * 60 + item["minute"] <= watermark["minute"]]
                self.check("legacy failed training has an original full before artifact", bool(candidates),
                           {"failedStage": session["previousStage"], "watermarkOnly": watermark})
                index, metadata = candidates[-1]
                pending = {"zone": "barracks", "expectedMinutes": 30, "beforeSnapshotIndex": index,
                    "beforeMinute": (metadata["day"] - 1) * 1440 + metadata["hour"] * 60 + metadata["minute"],
                    "beforeEventSeq": metadata["eventSeq"], "source": "legacy-failed-public-training",
                    "failedCheckpointWatermark": watermark, "failedStage": session["previousStage"],
                    "legacyResumeSessionIndex": len(self.result["resumeSessions"]) - 1}
                # The watermark describes the old runner's last observation;
                # it never supplies or reconstructs a GameState payload.
                self.result["pendingTrainingAction"] = pending
                self.persist("legacy-training-original-artifact-pending")
        if not pending:
            return
        self.check("pending training retains its public barracks contract", pending.get("zone") == "barracks" and pending.get("expectedMinutes") == 30)
        before = self.training_before(pending)
        previous = before["envelope"]["payload"]
        receipts = matching_events(payload, "camp.area.interacted", previous["worldMeta"]["eventSeq"])
        if receipts:
            evidence = area_action_evidence(previous, payload, "barracks", 30)
            self.check("resumed training retains exact area/nested-advance/natural-clock evidence", evidence is not None,
                       {"beforeSnapshotIndex": pending["beforeSnapshotIndex"], "receipts": receipts})
            self.result.setdefault("trainingRecoveryHistory", []).append({"beforeSnapshotIndex": pending["beforeSnapshotIndex"],
                "source": pending["source"], "eventId": evidence["receipt"]["eventId"], "commandId": evidence["receipt"]["commandId"],
                "naturalMinutesBefore": evidence["naturalMinutesBefore"], "naturalMinutesAfter": evidence["naturalMinutesAfter"],
                "failedCheckpointWatermark": pending.get("failedCheckpointWatermark"), "status": "committed-receipt-consumed"})
            if "legacyResumeSessionIndex" in pending:
                self.result["resumeSessions"][pending["legacyResumeSessionIndex"]]["legacyTrainingReconciled"] = True
            self.record_training_action(pending, before, observed, evidence, recovered=True)
        else:
            natural = natural_window_evidence(previous, payload)
            self.check("uncommitted training has complete saved natural-clock evidence", natural is not None)
            self.result.setdefault("trainingRecoveryHistory", []).append({"beforeSnapshotIndex": pending["beforeSnapshotIndex"],
                "source": pending["source"], "status": "no-committed-area-receipt", "naturalMinutes": natural["minutes"],
                "naturalEventIds": natural["eventIds"]})
            if "legacyResumeSessionIndex" in pending:
                self.result["resumeSessions"][pending["legacyResumeSessionIndex"]]["legacyTrainingReconciled"] = True
            self.result.pop("pendingTrainingAction", None)
            self.persist("training-resumed-uncommitted", observed)

    def barracks(self) -> None:
        # Return to the unobstructed row before moving left; a direct diagonal
        # from the night lane would collide with shelter (10,10).
        self.navigate(self.position()[0], 11.6)
        self.navigate(9.2, 11.8, tolerance=0.2)

    def garden(self, harvest: bool = False) -> dict:
        self.navigate(8.2, 13.4)
        self.navigate(7.2, 13.4)
        self.navigate(7.2, 14.2, tolerance=0.2)
        before = self.settle_save(self.calendar())["envelope"]["payload"]
        crop = self.page.locator('#contextActions [data-context-action="crop"]')
        crop.wait_for(state="visible", timeout=self.timeout())
        self.check("public crop context action enabled", crop.is_enabled(), crop.text_content())
        self.result["pendingCropAction"] = {"action": "harvest" if harvest else "plant", "beforePayload": before}
        self.persist("harvest-pending" if harvest else "plant-pending", self.last_save)
        crop.click(timeout=self.timeout())
        after = self.settle_save(clock_minutes(before) + 20, before["worldMeta"]["eventSeq"] + 1,
                                predicate=lambda value: saved_crop_change(before, value, harvest))["envelope"]["payload"]
        garden = next((b for b in after["buildings"] if b["type"] == "garden" and b["x"] == 7 and b["y"] == 14), None)
        self.check("existing garden harvest" if harvest else "existing garden planting", bool(garden) and (not garden.get("planted") if harvest else garden.get("planted")), garden)
        if harvest:
            self.check("harvest actual food reward", after["food"] >= before["food"] + 3, {"before": before["food"], "after": after["food"]})
        else:
            self.check("planting consumes real seed", after["seeds"] == before["seeds"] - 1)
        self.result["actions"].append({"type": "harvest" if harvest else "plant", "day": after["day"]})
        self.result.pop("pendingCropAction", None)
        return self.last_save

    def gather_at(self, x: float, y: float, repeat: int = 1) -> dict:
        self.navigate(x, y)
        for _ in range(repeat):
            before = self.settle_save(self.calendar())["envelope"]["payload"]
            seq = before["worldMeta"]["eventSeq"]
            gather = self.page.locator('#contextActions [data-context-action="gather"]')
            gather.wait_for(state="visible", timeout=self.timeout())
            self.check("public gather context action enabled", gather.is_enabled(), gather.text_content())
            self.result["pendingGatherAction"] = {"x": x, "y": y, "beforeSeq": seq}
            self.persist("gather-pending", self.last_save)
            gather.click(timeout=self.timeout())
            after = self.settle_save(clock_minutes(before) + 30, seq + 1, predicate=lambda payload: any(
                any(float(value) > 0 for value in event.get("payload", {}).get("delta", {}).values())
                for event in matching_events(payload, "resource.collected", seq)))["envelope"]["payload"]
            positive = [event for event in after["worldMeta"]["events"] if event["seq"] > seq and event["type"] == "resource.collected"
                        and any(float(value) > 0 for value in event.get("payload", {}).get("delta", {}).values())]
            self.check("gather has positive actual resource.collected ledger", bool(positive), positive)
            self.result["actions"].append({"type": "gather", "x": x, "y": y, "events": positive})
            self.result.pop("pendingGatherAction", None)
        return self.last_save

    def setup(self) -> None:
        if "setup" in self.result["completedStages"]:
            return
        self.stage = "fresh-public-supplies"
        before = self.settle_save(self.calendar())["envelope"]["payload"]
        self.check("new game starts on calendar day one", before["day"] == 1)
        self.survival(before, "new game or resumed setup", establish=True)
        if "supplied" not in self.result["completedStages"]:
            pending = self.result.get("pendingSetupAction")
            # Recover the first attempt's verified before-save artifact, which
            # predates pendingSetupAction support. It is evidence only: this
            # envelope is never injected back into the game profile.
            if not pending and (before.get("event") or {}).get("handled"):
                for snapshot in self.result["snapshots"]:
                    artifact = Path(snapshot["path"])
                    if not artifact.exists():
                        continue
                    previous = json.loads(artifact.read_text(encoding="utf-8"))["payload"]
                    previous_event = previous.get("event") or {}
                    if previous_event.get("id") == "supply" and not previous_event.get("handled"):
                        pending = {"action": "supply-A", "beforeFood": previous["food"], "beforeSeq": previous["worldMeta"]["eventSeq"],
                                   "beforeMinute": clock_minutes(previous), "recoveredBaselineArtifact": str(artifact)}
                        break
                if not pending:
                    raise AssertionError("handled supply choice has no verified before-food checkpoint for recovery")
            if not pending:
                pending = {"action": "supply-A", "beforeFood": before["food"], "beforeSeq": before["worldMeta"]["eventSeq"],
                           "beforeMinute": clock_minutes(before)}
            self.result["pendingSetupAction"] = pending
            self.persist("supply-A-pending", self.last_save)
            already_saved = supply_choice_saved(before, pending["beforeSeq"])
            if not already_saved:
                self.page.locator("#eventToggle").click(timeout=self.timeout())
                if self.page.locator("#eventSourceSelect").is_visible():
                    self.page.locator("#eventSourceSelect").select_option("daily", timeout=self.timeout())
                self.check("initial public supply event", "废弃补给箱" in (self.page.locator("#eventTitle").text_content() or ""))
                self.page.locator("#eventChoiceA").click(timeout=self.timeout())
                self.close_panels()
            supplied = self.settle_save(pending["beforeMinute"], pending["beforeSeq"] + 1,
                                       predicate=lambda payload: supply_choice_saved(payload, pending["beforeSeq"]))["envelope"]["payload"]
            self.check("supply A gives three actual food", supplied["food"] == pending["beforeFood"] + 3,
                       {"before": pending["beforeFood"], "actual": supplied["food"], "eventSeq": supplied["worldMeta"]["eventSeq"], "resumedAlreadyHandled": already_saved})
            self.result["actions"].append({"type": "supply-A", "foodGain": 3, "recoveredFromPrimarySave": already_saved})
            self.result.pop("pendingSetupAction", None)
            self.persist("supplied", self.last_save, complete=True)
        if "first-real-resource" not in self.result["completedStages"]:
            self.navigate(8.2, 11.5)
            self.gather_at(8.2, 8.2)
            self.persist("first-real-resource", self.last_save, complete=True)
        if "garden-planted" not in self.result["completedStages"]:
            payload = self.settle_save(self.calendar())["envelope"]["payload"]
            existing = next(b for b in payload["buildings"] if b["type"] == "garden" and b["x"] == 7 and b["y"] == 14)
            if not existing.get("planted"):
                self.garden()
            self.persist("garden-planted", self.last_save, complete=True)
        if "berries-collected" not in self.result["completedStages"]:
            self.navigate(8.2, 13.4)
            payload = self.settle_save(self.calendar())["envelope"]["payload"]
            berry = next((item for item in payload["resources"] if item["type"] == "berry" and item["x"] == 8 and item["y"] == 19), None)
            remaining = max(0, min(2, int(berry.get("amount", 0)))) if berry else 0
            if remaining:
                self.gather_at(8.2, 18.3, repeat=remaining)
            self.persist("berries-collected", self.last_save, complete=True)
        self.barracks()
        self.persist("setup", self.settle_save(self.calendar()), complete=True)

    def encounter(self, day: int) -> None:
        self.stage = f"day-{day}-encounter"
        self.navigate(11.8, 11.6)
        self.navigate(11.8, 9.5)
        before = self.settle_save(self.calendar())
        self.result["pendingEncounter"] = {"day": day, "beforeMinute": before["minute"], "beforeSeq": before["envelope"]["payload"]["worldMeta"]["eventSeq"]}
        self.persist(f"day-{day}-before-encounter", before)
        self.check(f"encounter {day} starts on its actual calendar day", before["envelope"]["payload"]["day"] == day)
        self.page.locator("#endDayBtn").click(timeout=self.timeout())
        end = min(self.deadline, time.monotonic() + ENCOUNTER_SECONDS)
        started = False
        while time.monotonic() < end:
            self.guard()
            classes = self.page.locator("#nightOverlay").get_attribute("class") or ""
            if "summary-mode" in classes:
                break
            if "threat-map-active" in (self.page.locator("body").get_attribute("class") or ""):
                started = True
                attack = self.page.locator("#nightLiveAttackBtn")
                if attack.is_visible() and attack.is_enabled():
                    attack.click(timeout=self.timeout())
                else:
                    # Read visible projected enemy tiles and use a short public
                    # movement pulse toward the closest one; no battle state.
                    enemies = self.page.locator("#world .night-zombie-tile").evaluate_all("els=>els.map(e=>({x:+e.dataset.x,y:+e.dataset.y}))")
                    if enemies:
                        px, py = self.position()
                        target = min(enemies, key=lambda enemy: math.hypot(enemy["x"] - px, enemy["y"] - py))
                        dx, dy = target["x"] - px, target["y"] - py
                        direction = ("right" if dx > 0 else "left") if abs(dx) > abs(dy) else ("down" if dy > 0 else "up")
                        movement = self.page.locator(f'[data-night-dir="{direction}"]')
                        if movement.is_visible() and movement.is_enabled():
                            movement.click(timeout=self.timeout())
            self.page.wait_for_timeout(200)
        self.check(f"day {day} real night started", started)
        self.check(f"day {day} night resolved within 60 seconds", "summary-mode" in (self.page.locator("#nightOverlay").get_attribute("class") or ""))
        before_seq = before["envelope"]["payload"]["worldMeta"]["eventSeq"]
        summary = self.settle_save(self.calendar(), before_seq + 1, predicate=lambda value: bool((value.get("nightBattle") or {}).get("resolved"))
                                  and bool(matching_events(value, "threat.resolved", before_seq,
                                                           threatId=(value.get("nightBattle") or {}).get("instanceId"))))
        payload = summary["envelope"]["payload"]
        self.result["pendingEncounter"]["threatId"] = payload["nightBattle"]["instanceId"]
        self.survival(payload, f"day {day} summary")
        self.check(f"day {day} resolved threat save", bool(payload.get("nightBattle", {}).get("resolved")))
        self.check(f"day {day} camp survives before closing report", payload["hp"] > 0, payload["hp"])
        summary_clock = self.calendar()
        summary_events = [event for event in payload["worldMeta"]["events"] if event["type"] == "threat.resolved"]
        self.check(f"day {day} actual threat.resolved ledger", bool(summary_events), summary_events[-1:] if summary_events else [])
        self.persist(f"day-{day}-summary", summary)
        self.page.locator("#continueBtn").click(timeout=self.timeout())
        self.page.wait_for_timeout(100)
        self.check(f"closing day {day} report does not advance the calendar", self.calendar() == summary_clock,
                   {"summary": summary_clock, "afterClose": self.calendar()})
        self.check(f"day {day} returns to daytime", "threat-map-active" not in (self.page.locator("body").get_attribute("class") or ""))
        summary_seq = payload["worldMeta"]["eventSeq"]
        threat_id = payload["nightBattle"]["instanceId"]
        closed = self.settle_save(summary_clock, summary_seq + 1, predicate=lambda value: value.get("night") is False
                                 and value.get("nightBattle") is None and bool(closed_threat_events(value, threat_id, summary_seq)))
        self.check(f"day {day} one causally linked threat.closed ledger", len(closed_threat_events(closed["envelope"]["payload"], threat_id, summary_seq)) == 1)
        if day not in self.result["nightDays"]:
            self.result["nightDays"].append(day)
        self.result.pop("pendingEncounter", None)
        self.persist(f"day-{day}-night-complete", closed, complete=True)
        self.barracks()

    def dinner(self, day: int) -> None:
        stage = f"day-{day}-dinner"
        if stage in self.result["completedStages"]:
            return
        self.stage = stage
        self.navigate(11.8, 11.6)
        self.navigate(12.6, 12)
        before = self.settle_save(self.calendar())["envelope"]["payload"]
        self.check(f"day {day} has food for a public dinner", before["food"] > 0)
        self.result["pendingDinnerAction"] = {"day": day, "beforePayload": before}
        self.persist(stage + "-pending", self.last_save)
        self.area_action("居住区")
        before_seq = before["worldMeta"]["eventSeq"]
        after = self.settle_save(clock_minutes(before) + 30, before_seq + 1, predicate=lambda value:
                                bool(matching_events(value, "camp.area.interacted", before_seq, zone="residence")))
        people = after["envelope"]["payload"]["npcs"]
        self.check(f"day {day} dinner reduces real NPC hunger", sum(npc.get("needs", {}).get("hunger", 0) for npc in people)
                   < sum(npc.get("needs", {}).get("hunger", 0) for npc in before["npcs"]))
        self.result.pop("pendingDinnerAction", None)
        self.persist(stage, after, complete=True)
        self.barracks()

    def transition_snapshot(self, index: int) -> dict:
        """Read an original verified artifact without adding it as new progress."""
        self.check("calendar before snapshot index exists", isinstance(index, int) and 0 <= index < len(self.result["snapshots"]), index)
        snapshot = self.result["snapshots"][index]
        envelope = json.loads(Path(snapshot["path"]).read_text(encoding="utf-8"))
        payload = envelope["payload"]
        minute = clock_minutes(payload)
        checksum = self.page.evaluate("""payload => {
          let hash=2166136261; const text=JSON.stringify(payload);
          for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
          return (hash>>>0).toString(16);
        }""", payload)
        self.check("calendar before original artifact checksum/date/seq verified", envelope["checksum"] == checksum == snapshot["checksum"]
                   and envelope["savedAt"] == minute and (payload["day"], payload["hour"], payload["minute"], payload["worldMeta"]["eventSeq"])
                   == (snapshot["day"], snapshot["hour"], snapshot["minute"], snapshot["eventSeq"]), index)
        return {"envelope": envelope, "minute": minute, "snapshotIndex": index}

    def transition_before(self, pending: dict, after: dict, reason: str) -> tuple[dict, int]:
        """Use an explicit reference, or repair a legacy invalid boundary."""
        next_day = pending["nextDay"]
        if "beforeSnapshotIndex" in pending:
            index = pending["beforeSnapshotIndex"]
            return self.transition_snapshot(index), index
        old_before = (pending.get("before") or {}).get("envelope", {})
        old_payload = old_before.get("payload") or {}
        matching = [index for index, snapshot in enumerate(self.result["snapshots"])
                    if snapshot.get("checksum") == old_before.get("checksum")
                    and snapshot.get("eventSeq") == old_payload.get("worldMeta", {}).get("eventSeq")
                    and snapshot.get("day") == next_day - 1]
        candidates = list(reversed(matching)) if matching else [index for index in range(len(self.result["snapshots"]) - 1, -1, -1)
                                                               if self.result["snapshots"][index].get("day") == next_day - 1]
        current = after["envelope"]["payload"]
        for index in candidates:
            before = self.transition_snapshot(index)
            previous = before["envelope"]["payload"]
            plan = previous.get("contentState", {}).get("planMeeting") or {}
            if plan.get("status") not in ("candidate", "committed") or plan.get("meetingDay") != next_day - 1 or not plan.get("selectedId"):
                continue
            if complete_event_window(previous, current) is None:
                continue
            self.result.setdefault("transitionRecoveryHistory", []).append({"reason": reason, "nextDay": next_day,
                "originalPendingTransition": json.loads(json.dumps(pending)), "selectedBeforeSnapshotIndex": index})
            return before, index
        raise AssertionError("no original previous-day plan snapshot has the complete calendar event window")

    def arm_transition(self, before: dict, next_day: int) -> None:
        self.check("calendar boundary armed on previous actual day", before["envelope"]["payload"]["day"] == next_day - 1)
        # Only a currently observed primary save is appended here. Historical
        # baselines are read by transition_snapshot and never persisted anew.
        self.persist(f"calendar-day-{next_day}-armed", before)
        index = len(self.result["snapshots"]) - 1
        snapshot = self.result["snapshots"][index]
        self.result["pendingTransition"] = {"nextDay": next_day, "before": before, "beforeSnapshotIndex": index,
            "beforeSnapshotSource": "verified-runner-snapshot", "beforeEventSeq": snapshot["eventSeq"],
            "beforeSnapshotProvenance": {key: snapshot.get(key) for key in ("stage", "path", "checksum", "htmlSha256")}
                | {"selectionReason": "pre-midnight-public-route-arming"}}
        self.persist(f"calendar-day-{next_day}-armed-reference")

    def finish_transition(self, pending: dict, after: dict, stage: str, reason: str) -> None:
        before, index = self.transition_before(pending, after, reason)
        self.check_transition(before, after, pending["nextDay"], index, reason)
        self.result.pop("pendingTransition", None)
        self.persist(stage, after, complete=True)
        self.refresh_check(stage + "-reload")

    def check_transition(self, before: dict, after: dict, next_day: int, before_index: int, reason: str) -> None:
        previous = before["envelope"]["payload"]
        current = after["envelope"]["payload"]
        snapshot = self.result["snapshots"][before_index]
        self.check(f"day {next_day} explicit before reference matches original snapshot", snapshot["checksum"] == before["envelope"]["checksum"]
                   and snapshot["eventSeq"] == previous["worldMeta"]["eventSeq"] and snapshot["day"] == previous["day"]
                   and (snapshot["hour"], snapshot["minute"]) == (previous["hour"], previous["minute"]))
        self.check(f"day {next_day} baseline is the original previous day", previous["day"] == next_day - 1
                   and previous["world"]["lastRationDay"] == previous["world"]["lastDailyUpkeepDay"] == next_day - 1)
        self.survival(current, f"calendar day {next_day}")
        since = int(previous["worldMeta"]["eventSeq"])
        events = complete_event_window(previous, current)
        self.check(f"day {next_day} complete continuous calendar event ledger", events is not None,
                   {"beforeSeq": since, "afterSeq": current["worldMeta"]["eventSeq"]})
        self.check(f"calendar reaches actual day {next_day}", current["day"] == next_day)
        self.check(f"day {next_day} ration charged exactly at new calendar day", current["world"]["lastRationDay"] == next_day)
        self.check(f"day {next_day} daily upkeep marker", current["world"]["lastDailyUpkeepDay"] == next_day)
        plan_events = [event for event in events if event["type"] == "plan.meeting.resolved" and event["payload"].get("resolvedDay") == next_day]
        self.check(f"day {next_day} previous night plan executes once", len(plan_events) == 1, plan_events)
        previous_plan = previous["contentState"]["planMeeting"]
        detail = plan_events[0]["payload"]
        lineage = (previous_plan.get("instanceId"), previous_plan.get("meetingDay"), previous_plan.get("selectedId"))
        self.check(f"day {next_day} exact prior plan instance/meeting/selection executes", previous_plan.get("status") in ("candidate", "committed")
                   and lineage[0] == f"camp-plan-meeting-001:d{next_day - 1}" and lineage[1] == next_day - 1 and bool(lineage[2])
                   and lineage == (detail.get("instanceId"), detail.get("meetingDay"), detail.get("selectedId")), detail)
        plan = current["contentState"]["planMeeting"]
        self.check(f"day {next_day} plan resolution is authoritative in save", plan["status"] == "resolved" and plan["resolvedDay"] == next_day
                   and lineage == (plan.get("instanceId"), plan.get("meetingDay"), plan.get("selectedId")), plan)
        content = current["contentState"]
        trust = content["meters"]["campTrust"]
        cap = 4 if trust >= 80 else 3 if trust >= 60 else 2 if trust >= 20 else 0
        cap = max(0, cap - (1 if content["meters"]["campCollapse"] >= 70 else 0))
        self.check(f"day {next_day} command points refreshed", content["commandPointsGrantedDay"] == next_day and content["commandPoints"] == content["commandPointsMax"] == cap,
                   {key: content[key] for key in ("commandPointsGrantedDay", "commandPoints", "commandPointsMax")})
        # chargeDailyRation has no dedicated event. Verify its actual food
        # delta after accounting for the source's recorded NPC consumption and
        # plan effect. Training itself never spends food.
        population = sum(npc.get("lifeState") != "dead" for npc in previous["npcs"])
        ration = max(2, math.ceil(max(1, population) * 0.28))
        unsupported = [event for event in events if event["type"] in ("crop.changed", "event.resolved", "player.ate", "npc.event.resolved")
                       or event["type"] == "resource.collected" and event.get("payload", {}).get("delta", {}).get("food", 0)
                       or event["type"] == "camp.area.interacted" and event.get("payload", {}).get("zone") == "residence"
                       or event["type"] == "outpost.upkeep" and int(event.get("payload", {}).get("paid", 0)) > 0]
        self.check(f"day {next_day} boundary food window contains only route-accounted actions", not unsupported, unsupported)
        meals = [event for event in events if event["type"] == "npc.need.fulfilled" and event["payload"].get("need") == "hunger"]
        eaten_before = sum(int(event["payload"].get("food", 0)) for event in meals if event["seq"] < plan_events[0]["seq"])
        eaten_after = sum(int(event["payload"].get("food", 0)) for event in meals if event["seq"] > plan_events[0]["seq"])
        before_ration = previous["food"] - eaten_before
        plan_food = sum(int(event["payload"]["after"]["food"]) - int(event["payload"]["before"]["food"]) for event in plan_events)
        self.check(f"day {next_day} plan begins after exactly one real ration", detail["before"]["food"] == max(0, before_ration - ration),
                   {"baselineFood": previous["food"], "npcFoodBeforeRation": eaten_before, "ration": ration, "planBeforeFood": detail["before"]["food"]})
        expected_food = max(0, before_ration - ration) + plan_food - eaten_after
        self.check(f"day {next_day} real food reflects one ration", current["food"] == expected_food,
                   {"before": previous["food"], "ration": ration, "npcFoodBeforeRation": eaten_before, "npcFoodAfterPlan": eaten_after,
                    "planDelta": plan_food, "expected": expected_food, "actual": current["food"]})
        self.check(f"day {next_day} fixed roster preserved", sorted(npc["id"] for npc in current["npcs"]) == self.result["rosterIds"])
        self.check(f"day {next_day} calendar boundary recorded once", not any(item["toDay"] == next_day for item in self.result["calendarTransitions"]))
        self.result["calendarTransitions"].append({"fromDay": previous["day"], "toDay": next_day, "beforeMinute": before["minute"], "afterMinute": after["minute"],
                                                    "ration": ration, "foodBefore": previous["food"], "foodAfter": current["food"], "planEventIds": [e["eventId"] for e in plan_events],
                                                    "upkeepDay": current["world"]["lastDailyUpkeepDay"], "commandPointsGrantedDay": content["commandPointsGrantedDay"],
                                                    "beforeSnapshotIndex": before_index, "beforeSnapshotSource": "verified-runner-snapshot", "beforeEventSeq": since,
                                                    "beforeSnapshotProvenance": {key: snapshot.get(key) for key in ("stage", "path", "checksum", "htmlSha256")}
                                                        | {"selectionReason": reason}, "npcFoodBeforeRation": eaten_before, "npcFoodAfterPlan": eaten_after,
                                                    "foodBeforeRation": before_ration, "planFoodDelta": plan_food})

    def refresh_check(self, stage: str) -> None:
        before = self.settle_save(self.calendar())
        payload = before["envelope"]["payload"]
        self.persist(stage + "-before-refresh", before)
        self.record_build(self.page.reload(wait_until="domcontentloaded", timeout=self.timeout()), stage + " reload")
        self.page.locator("#continueSaveBtn").click(timeout=self.timeout())
        self.page.wait_for_timeout(100)
        boot_minute = self.calendar()
        boot_delta = boot_minute - before["minute"]
        # The public continue button restarts the 1200ms natural timer. One
        # normal tick may run before the DOM is inspected. This is a strict
        # saved-calendar bound, not permission to accept arbitrary elapsed time.
        self.check(stage + " boot calendar stays on same day within one minute", 0 <= boot_delta <= 1
                   and boot_minute // 1440 + 1 == payload["day"],
                   {"beforePrimaryMinute": before["minute"], "beforeDomMinute": before["domMinute"],
                    "beforeDomLagMinutes": before["domLagMinutes"], "afterBootDomMinute": boot_minute,
                    "bootDeltaMinutes": boot_delta, "maxAllowedBootDeltaMinutes": 1})
        # Read the live, public plan tab: rereading an unchanged localStorage
        # envelope alone cannot establish that boot preserved spent CP.
        self.page.locator("#eventToggle").click(timeout=self.timeout())
        self.page.locator('[data-info-tab="plan"]').click(timeout=self.timeout())
        live_cp = self.page.locator("#infoPlanMount .status-overview-card").filter(has_text="指挥点").locator("b").inner_text()
        expected_cp = f"{payload['contentState']['commandPoints']}/{payload['contentState']['commandPointsMax']}"
        self.check(stage + " live public plan CP preserved after boot", live_cp.strip() == expected_cp, {"live": live_cp, "saved": expected_cp})
        self.close_panels()
        before_seq = payload["worldMeta"]["eventSeq"]
        after = self.settle_save(before["minute"] + 1, before_seq + 1, predicate=lambda value:
                                bool(matching_events(value, "time.advanced", before_seq)))
        resumed = after["envelope"]["payload"]
        events = complete_event_window(payload, resumed)
        self.check(stage + " postboot checkpoint retains complete event window", events is not None,
                   {"beforeSeq": before_seq, "afterSeq": resumed["worldMeta"]["eventSeq"]})
        advanced = [event for event in events if event["type"] == "time.advanced"]
        commands = {command.get("commandId"): command for command in resumed["worldMeta"].get("replay", {}).get("commands", [])}
        natural_minutes = sum(event["payload"].get("minutes", 0) for event in advanced)
        linked_ticks = all(1 <= event["payload"].get("minutes", 0) <= 5 and event["payload"].get("day") == payload["day"]
                           and commands.get(event.get("commandId"), {}).get("type") == "world.advance"
                           and (commands[event["commandId"]].get("payload") or {}).get("minutes") == event["payload"]["minutes"]
                           for event in advanced)
        self.check(stage + " postboot saved calendar has exact same-day natural tick trace", resumed["day"] == payload["day"]
                   and bool(advanced) and linked_ticks and after["minute"] - before["minute"] == natural_minutes,
                   {"beforeMinute": before["minute"], "afterMinute": after["minute"], "naturalMinutes": natural_minutes,
                    "timeEventIds": [event["eventId"] for event in advanced]})
        self.survival(resumed, stage + " after refresh")
        cp_keys = ("commandPoints", "commandPointsMax", "commandPointsGrantedDay")
        self.check(stage + " saved command points remain unchanged after boot ticks",
                   all(resumed["contentState"][key] == payload["contentState"][key] for key in cp_keys),
                   {"before": {key: payload["contentState"][key] for key in cp_keys},
                    "after": {key: resumed["contentState"][key] for key in cp_keys}})
        self.check(stage + " no new plan settlement during same-day boot ticks",
                   not any(event["type"] in ("plan.meeting.resolved", "plan.meeting.fallback") for event in events))
        consumed = sum(int(event["payload"].get("food", 0)) for event in matching_events(resumed, "npc.need.fulfilled", before_seq, need="hunger"))
        self.check(stage + " no repeated daily ration/upkeep after refresh", resumed["world"]["lastRationDay"] == payload["world"]["lastRationDay"]
                   and resumed["world"]["lastDailyUpkeepDay"] == payload["world"]["lastDailyUpkeepDay"] and resumed["food"] == payload["food"] - consumed,
                   {"foodBefore": payload["food"], "foodAfter": resumed["food"], "legitimateNpcConsumption": consumed, "newCheckpointSeq": resumed["worldMeta"]["eventSeq"]})
        for event in [event for event in payload["worldMeta"]["events"] if event["type"] == "plan.meeting.resolved"]:
            instance = event["payload"].get("instanceId")
            self.check(stage + f" no duplicate plan {instance}", len([e for e in resumed["worldMeta"]["events"]
                       if e["type"] == "plan.meeting.resolved" and e["payload"].get("instanceId") == instance]) == 1)
        self.persist(stage, after, complete=True)

    def calendar_progress(self) -> None:
        while True:
            self.guard()
            day = self.calendar() // 1440 + 1
            pending = self.result.get("pendingTransition")
            if pending and day >= pending["nextDay"]:
                self.check("armed calendar boundary reaches only its next day", day == pending["nextDay"])
                after = self.settle_save(self.calendar())
                self.finish_transition(pending, after, f"calendar-day-{pending['nextDay']}", "armed-public-route-or-natural-clock")
                self.barracks()
                continue
            if self.calendar() >= 3 * 1440 + self.args.finish_hour * 60:
                break
            if day <= 3 and day not in self.result["nightDays"]:
                self.encounter(day)
            if day == 3 and "harvest" not in self.result["completedStages"]:
                payload = self.settle_save(self.calendar())["envelope"]["payload"]
                if any(b["type"] == "garden" and b.get("ready") for b in payload["buildings"]):
                    self.persist("harvest", self.garden(harvest=True), complete=True)
                    self.barracks()
            self.stage = f"day-{day}-public-training"
            local_minute = self.calendar() % 1440
            if day <= 3 and local_minute >= 18 * 60 and f"day-{day}-dinner" not in self.result["completedStages"]:
                self.dinner(day)
                continue
            if local_minute >= 22 * 60 and day <= 3:
                before = self.settle_save(self.calendar())
                saved_day = before["envelope"]["payload"]["day"]
                if saved_day == day:
                    self.arm_transition(before, day + 1)
                    # A real timer crossing between the saved observation and
                    # the next UI action is consumed at the top of the loop.
                    if self.calendar() // 1440 + 1 != day:
                        continue
                else:
                    self.check("calendar crosses at most one day during boundary save wait", saved_day == day + 1)
                    pending = self.result.get("pendingTransition") or {"nextDay": day + 1}
                    self.result["pendingTransition"] = pending
                    self.finish_transition(pending, before, f"calendar-day-{day + 1}", "natural-clock-crossed-during-arming")
                    self.barracks()
                    continue
            self.area_action("兵营")
            if len(self.result["actions"]) % 8 == 0:
                self.persist(f"day-{day}-training-checkpoint", self.settle_save(self.calendar()))

    def reconcile_pending(self, observed: dict) -> None:
        """Recover only from the actual profile save, never reapply saved data."""
        payload = observed["envelope"]["payload"]
        self.reconcile_training(observed)
        pending_attack = self.result.get("pendingNavigationAttack")
        if pending_attack:
            # Upgrade old pending receipts only from their exact verified
            # before-attack artifact, never from the current post-action HP.
            if "beforeHp" not in pending_attack or "beforeEnergy" not in pending_attack:
                for snapshot in reversed(self.result["snapshots"]):
                    if snapshot["stage"] != "navigation-obstruction-before-attack" or snapshot["eventSeq"] != pending_attack["beforeSeq"]:
                        continue
                    artifact = Path(snapshot["path"])
                    if artifact.exists():
                        envelope = json.loads(artifact.read_text(encoding="utf-8"))
                        before = envelope["payload"]
                        if envelope["checksum"] == snapshot["checksum"] and before["worldMeta"]["eventSeq"] == pending_attack["beforeSeq"] and clock_minutes(before) == pending_attack["beforeMinute"]:
                            pending_attack.setdefault("beforeHp", before["hp"])
                            pending_attack.setdefault("beforeEnergy", before["energy"])
                            break
            self.check("resumed navigation attack retains its original HP/energy baseline",
                       "beforeHp" in pending_attack and "beforeEnergy" in pending_attack)
            segment = self.navigation_segment(*pending_attack["waypoint"])
            receipts = matching_events(payload, "threat.attacked", pending_attack["beforeSeq"])
            if "segmentId" not in pending_attack:
                already_logged = len(receipts) == 1 and any(action.get("eventId") == receipts[0]["eventId"] for action in self.result["actions"])
                if not already_logged:
                    self.check("legacy pending navigation attempt fits persistent budget", segment["attackAttempts"] < MAX_NAVIGATION_ATTACKS, segment)
                    segment["attackAttempts"] += 1
                pending_attack["segmentId"] = segment["segmentId"]
                pending_attack["attempt"] = max(1, segment["attackAttempts"])
            self.check("resumed pending navigation attempt belongs to bounded unfinished segment",
                       pending_attack["segmentId"] == segment["segmentId"] and 1 <= pending_attack["attempt"] <= segment["attackAttempts"] <= MAX_NAVIGATION_ATTACKS,
                       {"pending": pending_attack, "segment": segment})
            if receipts:
                # This consumes the receipt and costs without any UI click.
                # An ambiguous/no-op receipt fails instead of attacking again.
                self.record_navigation_attack(pending_attack, observed, recovered=True)
            else:
                ledger = payload["worldMeta"].get("events", [])
                self.check("uncommitted navigation attempt has retained ledger coverage",
                           payload["worldMeta"]["eventSeq"] >= pending_attack["beforeSeq"] and clock_minutes(payload) >= pending_attack["beforeMinute"]
                           and (payload["worldMeta"]["eventSeq"] == pending_attack["beforeSeq"] or bool(ledger) and min(event["seq"] for event in ledger) <= pending_attack["beforeSeq"] + 1))
                # No saved attack occurred. Keep the reserved attempt anyway;
                # the next public navigation may retry within the same limit.
                self.result.setdefault("navigationUncommittedAttempts", []).append({"segmentId": segment["segmentId"],
                    "attempt": pending_attack["attempt"], "beforeSeq": pending_attack["beforeSeq"], "resumedSeq": payload["worldMeta"]["eventSeq"]})
                self.result.pop("pendingNavigationAttack", None)
                self.persist("navigation-obstruction-resumed-uncommitted", observed)
        pending_crop = self.result.get("pendingCropAction")
        if pending_crop and matching_events(payload, "crop.changed", pending_crop["beforePayload"]["worldMeta"]["eventSeq"]):
            harvest = pending_crop["action"] == "harvest"
            self.check("resumed crop action retains exact reward/state evidence", saved_crop_change(pending_crop["beforePayload"], payload, harvest))
            stage = "harvest" if harvest else "garden-planted"
            self.result["actions"].append({"type": "harvest" if harvest else "plant", "day": payload["day"], "recoveredFromPrimarySave": True})
            self.result.pop("pendingCropAction", None)
            self.persist(stage, observed, complete=True)
        pending_gather = self.result.get("pendingGatherAction")
        if pending_gather:
            positive = [event for event in matching_events(payload, "resource.collected", pending_gather["beforeSeq"])
                        if any(float(value) > 0 for value in event.get("payload", {}).get("delta", {}).values())]
            if positive:
                self.check("resumed gather has positive exact receipt", len(positive) == 1, positive)
                self.result["actions"].append({"type": "gather", "x": pending_gather["x"], "y": pending_gather["y"], "events": positive, "recoveredFromPrimarySave": True})
                self.result.pop("pendingGatherAction", None)
                first_resource = pending_gather["x"] == pending_gather["y"] == 8.2
                self.persist("first-real-resource" if first_resource else "gather-resumed", observed, complete=first_resource)
        pending_dinner = self.result.get("pendingDinnerAction")
        if pending_dinner:
            before = pending_dinner["beforePayload"]
            receipts = matching_events(payload, "camp.area.interacted", before["worldMeta"]["eventSeq"], zone="residence")
            if receipts:
                detail = receipts[0]["payload"]
                self.check("resumed dinner has exact time/food receipt", len(receipts) == 1 and detail.get("minutes") == 30
                           and detail["after"]["food"] <= detail["before"]["food"] - 1, receipts)
                self.result["actions"].append({"type": "residence-dinner", "eventId": receipts[0]["eventId"], "recoveredFromPrimarySave": True})
                self.result.pop("pendingDinnerAction", None)
                self.persist(f"day-{pending_dinner['day']}-dinner", observed, complete=True)
        pending_transition = self.result.get("pendingTransition")
        if pending_transition:
            next_day = pending_transition["nextDay"]
            if payload["day"] == next_day:
                self.finish_transition(pending_transition, observed, f"calendar-day-{next_day}-resumed", "resume-original-previous-day-snapshot")
            elif payload["day"] != next_day - 1:
                raise AssertionError("resume missed a pending calendar boundary; cannot reconstruct its exact food accounting")
        pending_night = self.result.get("pendingEncounter")
        if pending_night:
            day = pending_night["day"]
            # Old attempts predate beforeSeq/threatId. Recover the precise
            # watermarks from their verified before/summary artifacts.
            for snapshot in self.result["snapshots"]:
                if snapshot["stage"] == f"day-{day}-before-encounter" and "beforeSeq" not in pending_night:
                    pending_night["beforeSeq"] = snapshot["eventSeq"]
                if snapshot["stage"] == f"day-{day}-summary" and "threatId" not in pending_night:
                    artifact = Path(snapshot["path"])
                    if artifact.exists():
                        saved_battle = (json.loads(artifact.read_text(encoding="utf-8"))["payload"].get("nightBattle") or {})
                        if saved_battle.get("resolved"):
                            pending_night["threatId"] = saved_battle["instanceId"]
            if "beforeSeq" not in pending_night:
                raise AssertionError("pending night lacks a verified before-event watermark; same-minute recovery is forbidden")
            before_seq = pending_night["beforeSeq"]
            if not pending_night.get("threatId") and (payload.get("nightBattle") or {}).get("resolved"):
                pending_night["threatId"] = payload["nightBattle"]["instanceId"]
            threat_id = pending_night.get("threatId")
            resolved = matching_events(payload, "threat.resolved", before_seq, threatId=threat_id) if threat_id else []
            started = started_threat_events(payload, day, before_seq, resolved[0]["seq"], threat_id) if len(resolved) == 1 else []
            closed = closed_threat_events(payload, threat_id, resolved[0]["seq"]) if len(resolved) == 1 else []
            if len(started) == len(resolved) == len(closed) == 1:
                self.survival(payload, f"day {day} resumed closed encounter")
                self.check("resumed night has exact started/resolved/closed trace", True,
                           {"threatId": threat_id, "startedSeq": started[0]["seq"], "resolvedSeq": resolved[0]["seq"], "closedSeq": closed[0]["seq"],
                            "legacyEmptyClosePayload": not bool(closed[0].get("payload"))})
                if day not in self.result["nightDays"]:
                    self.result["nightDays"].append(day)
                self.result.pop("pendingEncounter", None)
                self.persist(f"day-{day}-night-resumed-complete", observed, complete=True)
            elif (payload.get("nightBattle") or {}).get("resolved"):
                self.check("resumed summary has exact started/resolved trace", len(started) == len(resolved) == 1,
                           {"threatId": threat_id, "beforeSeq": before_seq})
                if "summary-mode" not in (self.page.locator("#nightOverlay").get_attribute("class") or ""):
                    raise AssertionError("resolved night is saved but its public report continuation is unavailable after resume")
                before_clock = self.calendar()
                self.page.locator("#continueBtn").click(timeout=self.timeout())
                self.check("resumed report does not advance calendar", self.calendar() == before_clock)
                before_seq = payload["worldMeta"]["eventSeq"]
                threat_id = payload["nightBattle"]["instanceId"]
                closed_save = self.settle_save(before_clock, before_seq + 1, predicate=lambda value: value.get("night") is False
                                              and value.get("nightBattle") is None and bool(closed_threat_events(value, threat_id, before_seq)))
                if day not in self.result["nightDays"]:
                    self.result["nightDays"].append(day)
                self.result.pop("pendingEncounter", None)
                self.persist(f"day-{day}-night-resumed-complete", closed_save, complete=True)
            # An unresolved encounter cannot checkpoint. If the primary save
            # still precedes it, the aborted attempt was not committed and the
            # normal public encounter path will be retried on this same day.

    def resume_boundary_refresh(self) -> None:
        """Retry this day's verified boundary reload before further actions."""
        if not self.args.resume:
            return
        observed = self.settle_save(self.calendar())
        payload = observed["envelope"]["payload"]
        day = payload["day"]
        pending = self.result.get("pendingRefresh")
        self.check("resume boundary reload uses current actual calendar day", self.calendar() // 1440 + 1 == day
                   and day >= max((item["toDay"] for item in self.result["calendarTransitions"]), default=1)
                   and (not pending or pending.get("day") == day), {"day": day, "pending": pending})
        if day == 1:
            self.check("day-one resume has no unresolved boundary reload", not pending)
            return
        transitions = [(index, item) for index, item in enumerate(self.result["calendarTransitions"]) if item["toDay"] == day]
        self.check("resume current calendar boundary was verified once", len(transitions) == 1
                   and transitions[0][1]["fromDay"] == day - 1, transitions)
        transition_index, transition = transitions[0]
        completed = self.result["completedStages"]

        def boundary_sources(target: int, entry: dict) -> list[str]:
            names = (f"calendar-day-{target}", f"calendar-day-{target}-resumed")
            return list(dict.fromkeys(snapshot["stage"] for snapshot in self.result["snapshots"]
                if snapshot["stage"] in names and snapshot["stage"] in completed and snapshot["day"] == target
                and (target - 1) * 1440 + snapshot["hour"] * 60 + snapshot["minute"] == entry["afterMinute"]
                and snapshot["eventSeq"] <= payload["worldMeta"]["eventSeq"]))

        sources = boundary_sources(day, transition)
        self.check("resume boundary completion has its original actual-day snapshot", bool(sources)
                   and observed["minute"] >= transition["afterMinute"]
                   and payload["world"]["lastRationDay"] == payload["world"]["lastDailyUpkeepDay"] == payload["contentState"]["commandPointsGrantedDay"] == day,
                   {"day": day, "sources": sources})
        # A past missed phase remains a coverage gap. A later day's reload
        # cannot establish that the earlier live UI/CP check happened.
        gaps = self.result.setdefault("historicalBoundaryRefreshGaps", [])
        for entry in self.result["calendarTransitions"]:
            if entry["toDay"] < day:
                old_sources = boundary_sources(entry["toDay"], entry)
                if old_sources and not any(source + "-reload" in completed for source in old_sources):
                    missing = old_sources[-1] + "-reload"
                    if missing not in gaps:
                        gaps.append(missing)
        stage = next((source + "-reload" for source in reversed(sources) if source + "-reload" in completed), sources[-1] + "-reload")
        self.check("pending reload retains its original boundary stage", not pending
                   or pending.get("stage") == stage and pending.get("transitionIndex") == transition_index, pending)
        if stage in completed:
            if pending:
                self.result.pop("pendingRefresh", None)
                self.persist(stage + "-resume-already-complete")
            return
        if not pending:
            pending = {"day": day, "stage": stage, "transitionIndex": transition_index,
                       "boundaryStage": sources[-1], "source": "incomplete-current-day-boundary-reload", "attempts": 0}
            self.result["pendingRefresh"] = pending
        pending["attempts"] += 1
        session_index = len(self.result.get("resumeSessions", [])) - 1
        session = self.result.get("resumeSessions", [])[session_index] if session_index >= 0 else {}
        recovery = {"day": day, "stage": stage, "attempt": pending["attempts"], "status": "pending",
                    "resumeSessionIndex": session_index, "previousErrorCount": len(session.get("previousErrors", [])),
                    "previousFailedCheckCount": len(session.get("previousFailedChecks", [])),
                    "failurePolicy": "original-failures-retained-in-resumeSessions-current-checks-retried"}
        self.result.setdefault("refreshRecoveryAttempts", []).append(recovery)
        self.persist(stage + "-resume-pending")
        try:
            self.refresh_check(stage)
            self.check("resumed boundary reload completed its exact original phase", stage in completed)
        except Exception as error:
            recovery.update(status="failed", error=f"{type(error).__name__}:{error}", lastFailureStage=self.stage)
            pending["lastFailureStage"] = self.stage
            raise
        recovery["status"] = "complete"
        self.result.pop("pendingRefresh", None)
        self.persist(stage + "-resume-reconciled")

    def run(self) -> None:
        if urlsplit(self.args.url).query:
            raise ValueError("run the normal public game URL without playtest/debug query modes")
        thread = threading.Thread(target=self.heartbeat, daemon=True)
        thread.start()
        print(json.dumps({"runner": "server-three-days", "mode": MODE, "pid": os.getpid(), "session": "fresh" if self.args.fresh else "resume",
                          "profile": str(self.args.profile.resolve()), "checkpoint": str(self.args.checkpoint), "result": str(self.args.out)}, ensure_ascii=False), flush=True)
        try:
            with sync_playwright() as playwright:
                context = playwright.chromium.launch_persistent_context(str(self.args.profile.resolve()), executable_path=self.args.chrome,
                    headless=not self.args.headed, viewport={"width": 1440, "height": 900}, args=["--no-sandbox", "--disable-dev-shm-usage"])
                self.page = context.pages[0] if context.pages else context.new_page()
                self.page.set_default_timeout(ACTION_SECONDS * 1000)
                self.page.on("pageerror", lambda error: self.result["errors"].append(f"pageerror:{error}"))
                self.page.on("console", lambda msg: self.result["consoleErrors"].append({"text": msg.text, "location": msg.location}) if msg.type == "error" else None)
                self.page.on("requestfailed", lambda request: self.result.setdefault("requestErrors", []).append({"url": request.url, "resourceType": request.resource_type, "failure": request.failure}))
                self.page.on("response", lambda response: self.result["httpErrors"].append(f"{response.status}:{response.url}") if response.status >= 400 else None)
                try:
                    self.record_build(self.page.goto(self.args.url, wait_until="domcontentloaded", timeout=self.timeout()), "initial document")
                    if self.args.fresh:
                        self.page.locator("#resetSaveBtn").click(timeout=self.timeout())
                        self.page.wait_for_load_state("domcontentloaded", timeout=self.timeout())
                    self.page.locator("#continueSaveBtn").click(timeout=self.timeout())
                    self.page.wait_for_timeout(100)
                    initial = self.settle_save(self.calendar())
                    if self.expected_checkpoint:
                        self.check("resume main save is not older than runner checkpoint", initial["minute"] >= self.expected_checkpoint["minute"]
                                   and initial["envelope"]["payload"]["worldMeta"]["eventSeq"] >= self.expected_checkpoint["eventSeq"])
                    self.persist("started-or-resumed", initial)
                    self.reconcile_pending(initial)
                    self.resume_boundary_refresh()
                    self.setup()
                    self.barracks()
                    self.calendar_progress()
                    final = self.settle_save(self.calendar())
                    self.survival(final["envelope"]["payload"], "final day four")
                    self.check("three different calendar nights completed", sorted(self.result["nightDays"]) == [1, 2, 3])
                    self.check("three actual calendar transitions to day four", [x["toDay"] for x in self.result["calendarTransitions"]] == [2, 3, 4])
                    self.check("real harvest is a mandatory completed stage", "harvest" in self.result["completedStages"]
                               and any(action["type"] == "harvest" for action in self.result["actions"]))
                    self.check("calendar day four reached", final["envelope"]["payload"]["day"] == 4)
                    self.refresh_check("final-day-four-reload")
                    self.result["state"] = {"day": self.last_save["envelope"]["payload"]["day"], "hour": self.last_save["envelope"]["payload"]["hour"],
                                            "minute": self.last_save["envelope"]["payload"]["minute"], "food": self.last_save["envelope"]["payload"]["food"],
                                            "npcCount": len(self.last_save["envelope"]["payload"]["npcs"]), "checksum": self.last_save["envelope"]["checksum"]}
                    self.result["trainingActions"] = sum(action["type"] == "barracks-training" for action in self.result["actions"])
                    bad_http = [entry for entry in self.result["httpErrors"] if not (match := re.fullmatch(r"(\d{3}):(https?://.+)", entry)) or not is_known_favicon_404(match.group(2), int(match.group(1)), self.args.url)]
                    if bad_http:
                        self.result["errors"].append("game-resource-http-errors:" + " | ".join(bad_http))
                    bad_console = [message for message in self.result["consoleErrors"] if not is_known_favicon_console(message, self.args.url)]
                    if bad_console:
                        self.result["errors"].append("game-console-errors:" + json.dumps(bad_console, ensure_ascii=False))
                    if self.result.get("requestErrors"):
                        self.result["errors"].append("game-resource-request-failures:" + json.dumps(self.result["requestErrors"], ensure_ascii=False))
                    known_favicon = len(self.result["consoleErrors"]) - len(bad_console)
                    if known_favicon:
                        self.result.setdefault("warnings", []).append(f"{known_favicon} exact same-origin favicon 404 messages retained with their locations")
                    self.result["ok"] = not self.result["errors"] and all(item["ok"] for item in self.result["checks"])
                    self.persist("complete", self.last_save, complete=True)
                finally:
                    context.close()
        except Exception as error:
            self.result["errors"].append(f"{type(error).__name__}:{error}")
            self.result["ok"] = False
            self.persist("failed-" + self.stage)
        finally:
            self.stop_heartbeat.set()
            self.result["elapsedSeconds"] = round(time.monotonic() - self.started, 3)
            self.result["finishedAtUnix"] = time.time()
            write_json(self.args.out, self.result)
            print(json.dumps({"runner": "server-three-days", "mode": MODE, "ok": self.result.get("ok", False),
                              "stage": self.stage, "checks": len(self.result["checks"]), "trainingActions": self.result.get("trainingActions"),
                              "elapsedSeconds": self.result["elapsedSeconds"], "errors": self.result["errors"], "result": str(self.args.out)}, ensure_ascii=False), flush=True)
        raise SystemExit(0 if self.result.get("ok") else 1)


if __name__ == "__main__":
    arguments = parse_args()
    try:
        Runner(arguments).run()
    except Exception as failure:
        # Initialization failures (missing/mismatched resume checkpoints) also
        # produce a machine-readable report and a failing exit status.
        report = {"runner": "server-three-days", "mode": MODE, "url": arguments.url, "ok": False,
                  "checks": [], "errors": [f"{type(failure).__name__}:{failure}"]}
        write_json(arguments.out, report)
        print(json.dumps(report, ensure_ascii=False), flush=True)
        raise SystemExit(1)

"""Real-browser report recovery contracts; explicit fixture mode.

Acquire full DAY/resolved envelopes using public new-game/encounter controls.
Each boot case uses a NEW ephemeral context and one before-loader fixture seed.
No persistent profile, hidden game function, post-boot save injection, or server
deployment is used. Offline loss fixtures are declared mutations; the full
B15 race separately records a real public loss from its explicit low-HP DAY.
Expected defects remain failed actualChecks and a failing exit status.

python3 scripts/server-report-recovery.py --url http://127.0.0.1/ \
    --chrome /usr/bin/google-chrome --out ~/.cache/zfarm-qa/report-recovery
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import math
import os
import re
import tempfile
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

SAVE_KEY = "zombie-harvest-progress-v12"
LEGACY_SAVE_KEYS = [f"zombie-harvest-progress-v{version}" for version in range(11, 6, -1)]
SAVE_KEYS = [SAVE_KEY, SAVE_KEY + ".bak", SAVE_KEY + ".corrupt", *LEGACY_SAVE_KEYS,
             *[key + ".corrupt" for key in LEGACY_SAVE_KEYS]]
KNOWN_BASELINE_SHA = "8a4abf285651e5ee78905da2b819648aa1ef862e580e8b4710e8c71079604ba0"
PLANNED_CASES = ["DAY-control", "B1-complete-resolved", "B1-contradictory-night-false", "B8-loss-new-field", "B9-loss-legacy", "B15-public-reset-pagehide"]
READ_PUBLIC = """({key, keys}) => {
  const raw=localStorage.getItem(key); let envelope=null, computedChecksum=null, parseError=null;
  if(raw) { try { envelope=JSON.parse(raw); let h=2166136261; const text=JSON.stringify(envelope.payload);
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);} computedChecksum=(h>>>0).toString(16);
    } catch(error) { parseError=String(error); } }
  const text=id=>document.querySelector('#'+id)?.textContent || '';
  const visible=id=>{const e=document.getElementById(id);if(!e)return false;
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);return !!(r.width&&r.height)&&s.display!=='none'&&s.visibility!=='hidden';};
  const buttons=Object.fromEntries(['continueSaveBtn','continueBtn','restartSessionBtn','restoreBackupBtn','resetSaveBtn','eatBtn','buildBtn','gatherBtn','endDayBtn'].map(id=>{
    const e=document.getElementById(id);return [id,{visible:visible(id),enabled:!!e&&!e.disabled,text:e?.textContent||''}];}));
  const storage=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
  return {envelope,computedChecksum,parseError,invalidPrimaryRaw:parseError?raw:null,
    rawStorage:storage,
    keysPresent:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)!==null])),
    dom:{day:text('dayLabel'),time:text('timeLabel'),bodyClass:document.body.className,
      overlayClass:document.querySelector('#nightOverlay')?.className || '',title:text('nightTitle'),cta:text('continueBtn'),
      kills:text('summaryKills'),breaches:text('summaryBreaches'),damage:text('summaryDamage'),morale:text('summaryMorale'),
      walls:text('summaryWalls'),npcDeaths:text('summaryNpcDeaths'),feed:text('summaryFeed'),buttons,
      reportVisible:visible('nightOverlay'),startVisible:visible('startOverlay'),recoveryStatus:text('recoveryStatus'),
      recoveryNotice:text('recoveryNotice'),recoveryNoticeVisible:visible('recoveryNotice')}};
}"""
MAKE_ENVELOPE = """({payload,reason}) => {
  let h=2166136261; const text=JSON.stringify(payload);
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return {...payload,version:21,payload,checksum:(h>>>0).toString(16),
    savedAt:(payload.day-1)*1440+payload.hour*60+payload.minute,reason};
}"""


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def explicit_favicon(record) -> bool:
    """A past unlocated string/404 is unknown, never silently ignored."""
    if not isinstance(record, dict):
        return False
    location = record.get("location")
    url = record.get("url") or (location.get("url") if isinstance(location, dict) else None)
    return isinstance(url, str) and urlsplit(url).path == "/favicon.ico"


def minute(payload: dict) -> int:
    return (int(payload["day"]) - 1) * 1440 + int(payload["hour"]) * 60 + int(payload["minute"])


def dom_minute(dom: dict) -> int:
    day = re.search(r"第\s*(\d+)\s*天", dom["day"])
    clock = re.search(r"(\d{1,2}):(\d{2})", dom["time"])
    if not day or not clock:
        raise ValueError("public DOM calendar unavailable")
    return (int(day[1]) - 1) * 1440 + int(clock[1]) * 60 + int(clock[2])


def economic_projection(payload: dict) -> dict:
    keys = ("hp", "wood", "stone", "food", "seeds", "parts", "medicine", "morale", "sanity", "contentState")
    npc_keys = ("id", "hp", "lifeState", "needs", "sanity", "hero", "relations", "bond", "garrisonedOutpostId")
    return {**{key: payload.get(key) for key in keys},
            "npcs": [{key: npc.get(key) for key in npc_keys} for npc in payload["npcs"]],
            "lastRationDay": payload["world"].get("lastRationDay"),
            "lastDailyUpkeepDay": payload["world"].get("lastDailyUpkeepDay")}


def loss_payload(resolved: dict, include_game_over: bool) -> tuple[dict, list[str]]:
    """Explicit stored-outcome mutation, not simulation of an actual loss."""
    payload = copy.deepcopy(resolved)
    battle = payload["nightBattle"]
    payload["hp"] = 0
    payload["night"] = True
    battle["finalDamage"] = battle["hpBefore"]
    battle["campDamage"] = battle["hpBefore"]
    mutations = ["payload.hp=0", "payload.night=true", "nightBattle.finalDamage/campDamage=stored hpBefore"]
    if include_game_over:
        payload["gameOver"] = "lose"
        mutations.append("payload.gameOver='lose' (proposed optional SAVE21 field)")
    else:
        payload.pop("gameOver", None)
        mutations.append("payload.gameOver omitted (legacy writer contract)")
    return payload, mutations


class Runner:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.known_save_keys = tuple(SAVE_KEYS)
        self.started = time.monotonic()
        self.deadline = self.started + args.timeout
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.directory = args.out.resolve() / f"run-{stamp}-{uuid.uuid4().hex[:8]}"
        self.directory.mkdir(parents=True, mode=0o700)
        self.report = self.directory / "report.json"
        self.result = {"runner": "server-report-recovery", "mode": "explicit-boot-save-reproduction",
                       "url": args.url, "ok": False, "status": "running", "startedAtUnix": time.time(),
                       "policy": {"persistentProfileUsed": False, "baselineViaPublicControls": True,
                                  "fixturesBeforeLoaderOnly": True, "hiddenFunctionCalls": False,
                                  "postBootStateInjection": False, "expectedDefectCountsAsPass": False},
                       "actualChecks": [], "errors": [], "pageErrors": [], "httpErrors": [], "consoleErrors": [], "requestFailures": [], "diagnosticResources": [],
                       "cases": {}, "artifacts": [], "plannedCases": PLANNED_CASES,
                       "notYetImplemented": ["B3", "B4", "B5", "B6", "B7", "B10", "B11", "B12", "B13", "B14", "B16"]}
        self.result["suite"] = getattr(args,"suite","initial")
        if self.result["suite"]=="full":
            self.result.update(mode="explicit-B1-B16-boot-contracts",plannedCases=[],notYetImplemented=[],fullMatrixPrepared=False)
        self.source_sha = None
        self.artifact_number = 0
        self.stage = "initializing"
        self.stop_heartbeat = threading.Event()
        self.persist()

    def persist(self) -> None:
        write_json(self.report, self.result)

    def heartbeat(self) -> None:
        while not self.stop_heartbeat.wait(15):
            print(json.dumps({"heartbeat": "report-recovery", "stage": self.stage,
                              "elapsedSeconds": round(time.monotonic() - self.started, 1),
                              "actualCheckCount": len(self.result["actualChecks"])}, ensure_ascii=False), flush=True)

    def timeout(self, seconds: float = 25) -> int:
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("report-recovery global browser budget exhausted")
        return max(1, int(min(seconds, remaining) * 1000))

    def check(self, scope: str, name: str, condition: bool, detail=None, fatal: bool = False) -> None:
        self.stage = scope + ":" + name
        item = {"scope": scope, "name": name, "ok": bool(condition)}
        if detail is not None:
            item["detail"] = detail
        self.result["actualChecks"].append(item)
        if not condition:
            self.result["errors"].append(f"check:{scope}:{name}")
        self.persist()
        if fatal and not condition:
            raise AssertionError(f"{scope}:{name}")

    def page(self, context, scope: str):
        page = context.new_page()
        page.set_default_timeout(5000)
        page.on("pageerror", lambda error: self.result["pageErrors"].append({"scope": scope, "error": str(error)}))
        page.on("console", lambda msg: self.result["consoleErrors"].append({"scope": scope, "text": msg.text, "error": msg.text, "location": msg.location}) if msg.type == "error" else None)
        def response_error(response):
            if response.status < 400: return
            item = {"scope": scope, "status": response.status, "url": response.url, "resourceType": response.request.resource_type}
            self.result["diagnosticResources" if explicit_favicon(item) else "httpErrors"].append(item)
        page.on("response", response_error)
        def request_failed(request):
            item = {"scope": scope, "url": request.url, "resourceType": request.resource_type, "failure": request.failure}
            self.result["diagnosticResources" if explicit_favicon(item) else "requestFailures"].append(item)
        page.on("requestfailed", request_failed)
        return page

    def source(self, response, scope: str) -> None:
        self.check(scope, "served document HTTP200", response is not None and response.status == 200, fatal=True)
        observed = hashlib.sha256(response.body()).hexdigest()
        if self.source_sha is None:
            self.source_sha = observed
            self.result["htmlSha256"] = observed
        expected = getattr(self.args, "expect_html_sha256", None)
        if expected:
            self.check(scope, "explicit frozen HTML matches", observed == expected, {"sha256": observed}, fatal=True)
        self.check(scope, "same frozen served HTML", observed == self.source_sha, {"sha256": observed}, fatal=True)

    def read(self, page) -> dict:
        observed = page.evaluate(READ_PUBLIC, {"key": SAVE_KEY, "keys": SAVE_KEYS})
        if observed["parseError"]:
            raise AssertionError("actual primary save JSON/payload parse invalid")
        envelope = observed["envelope"]
        if envelope is not None:
            if not isinstance(envelope, dict):
                raise AssertionError("actual primary save envelope must be an object")
            payload = envelope.get("payload")
            if not isinstance(payload, dict) or not payload:
                raise AssertionError("actual primary save payload must be a nonempty object")
            if envelope.get("checksum") != observed["computedChecksum"]:
                raise AssertionError("actual primary save checksum invalid")
            if not isinstance(payload.get("contentState"), dict) or not isinstance(payload.get("world"), dict):
                raise AssertionError("actual primary content/world must be objects")
            if envelope.get("version") != 21 or payload.get("version") != 21 or payload["contentState"].get("contentVersion") != 3:
                raise AssertionError("unexpected actual save/content schema")
            if envelope.get("savedAt") != minute(payload) or payload["world"].get("totalMinutes") != minute(payload):
                raise AssertionError("actual primary world/save calendar mismatch")
        return observed

    def settle(self, page, predicate, seconds: float = 25) -> dict:
        end = time.monotonic() + self.timeout(seconds) / 1000
        while time.monotonic() < end:
            observed = self.read(page)
            if observed["envelope"] and predicate(observed):
                return observed
            page.wait_for_timeout(100)
        raise TimeoutError("actual primary save did not satisfy this public action")

    def capture(self, page, scope: str, stage: str, allow_invalid: bool = False) -> dict:
        self.stage = scope + ":" + stage
        read_error = None
        try:
            observed = self.read(page)
        except Exception as error:
            # Preserve actual storage/DOM and screenshot even if the output is
            # invalid; this diagnostic artifact is never an accepted save.
            read_error = error
            observed = page.evaluate(READ_PUBLIC, {"key": SAVE_KEY, "keys": SAVE_KEYS})
            observed["validationError"] = {"type": type(error).__name__, "message": str(error)}
        stem = f"{self.artifact_number:02d}-{scope}-{stage}"
        self.artifact_number += 1
        write_json(self.directory / (stem + ".json"), observed)
        screenshot = stem + ".png"
        captured_envelope = observed.get("envelope")
        artifact = {"scope": scope, "stage": stage, "file": stem + ".json", "screenshot": None,
                    "htmlSha256": self.source_sha, "checksum": captured_envelope.get("checksum") if isinstance(captured_envelope, dict) else None,
                    "actualPrimaryMayStillEqualInput": True}
        self.result["artifacts"].append(artifact)
        self.persist()
        try:
            page.screenshot(path=str(self.directory / screenshot), timeout=self.timeout(10))
            artifact["screenshot"] = screenshot
        except Exception as error:
            artifact["screenshotError"] = {"type": type(error).__name__, "message": str(error)}
            self.persist()
            raise
        self.persist()
        if read_error is not None and not allow_invalid:
            raise read_error
        return observed

    def reload(self, page, scope: str) -> None:
        self.source(page.reload(wait_until="domcontentloaded", timeout=self.timeout()), scope)

    def position(self, page) -> tuple[float, float]:
        value = page.evaluate(r"""() => {
          const label=document.querySelector('#mapRegionLabel')?.textContent || '';
          const m=label.match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/);
          if(m)return {x:+m[1]-1,y:+m[2]-1};
          const world=document.querySelector('#world'), marker=world?.querySelector('.player-marker');
          if(!marker?.isConnected)return null;const tiles=[...world.querySelectorAll('.tile[data-x][data-y]')];
          if(!tiles.length)return null;
          return {x:Math.min(...tiles.map(t=>+t.dataset.x))+parseFloat(marker.style.left)/parseFloat(marker.style.width),
                  y:Math.min(...tiles.map(t=>+t.dataset.y))+parseFloat(marker.style.top)/parseFloat(marker.style.height)};
        }""")
        if not value or not all(math.isfinite(value[key]) for key in ("x", "y")):
            raise AssertionError("public position unavailable")
        return value["x"], value["y"]

    def navigate(self, page, x: float, y: float) -> None:
        end = time.monotonic() + self.timeout(20) / 1000
        while time.monotonic() < end:
            px, py = self.position(page)
            if abs(x - px) < .25 and abs(y - py) < .25:
                return
            dx, dy = x - px, y - py
            key = ("d" if dx > 0 else "a") if abs(dx) > .25 else ("s" if dy > 0 else "w")
            page.keyboard.down(key)
            try:
                page.wait_for_timeout(max(60, min(200, int((abs(dx) if key in ("a", "d") else abs(dy)) * 300))))
            finally:
                page.keyboard.up(key)
        raise TimeoutError("public baseline navigation did not reach encounter lane")

    def baseline(self, browser) -> tuple[dict, dict]:
        scope = "public-baseline"
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = self.page(context, scope)
        try:
            self.source(page.goto(self.args.url, wait_until="domcontentloaded", timeout=self.timeout()), scope)
            with page.expect_navigation(wait_until="domcontentloaded", timeout=self.timeout()) as reset_navigation:
                page.locator("#resetSaveBtn").click()
            self.source(reset_navigation.value, scope)
            self.check(scope, "public reset leaves no existing primary", self.read(page)["envelope"] is None, fatal=True)
            page.locator("#continueSaveBtn").click()
            day = self.settle(page, lambda observed: 0 <= dom_minute(observed["dom"]) - minute(observed["envelope"]["payload"]) <= 1)
            day_payload = day["envelope"]["payload"]
            self.check(scope, "full DAY baseline made by controls", day_payload["night"] is False and day_payload["nightBattle"] is None
                       and len({n["id"] for n in day_payload["npcs"]}) == 10, fatal=True)
            write_json(self.directory / "public-day-source-envelope.json", day["envelope"])
            self.capture(page, scope, "real-day")
            self.navigate(page, 11.8, 11.6)
            self.navigate(page, 11.8, 9.5)
            before = self.settle(page, lambda observed: 0 <= dom_minute(observed["dom"]) - minute(observed["envelope"]["payload"]) <= 1)
            before_seq = before["envelope"]["payload"]["worldMeta"]["eventSeq"]
            self.capture(page, scope, "before-real-encounter")
            page.locator("#endDayBtn").click()
            end = time.monotonic() + self.timeout(80) / 1000
            started = False
            while time.monotonic() < end:
                if "summary-mode" in (page.locator("#nightOverlay").get_attribute("class") or ""):
                    break
                if "threat-map-active" in (page.locator("body").get_attribute("class") or ""):
                    started = True
                    attack = page.locator("#nightLiveAttackBtn")
                    if attack.is_visible() and attack.is_enabled():
                        attack.click()
                    else:
                        enemies = page.locator("#world .night-zombie-tile").evaluate_all("els=>els.map(e=>({x:+e.dataset.x,y:+e.dataset.y}))")
                        if enemies:
                            px, py = self.position(page)
                            target = min(enemies, key=lambda enemy: math.hypot(enemy["x"] - px, enemy["y"] - py))
                            dx, dy = target["x"] - px, target["y"] - py
                            direction = ("right" if dx > 0 else "left") if abs(dx) > abs(dy) else ("down" if dy > 0 else "up")
                            button = page.locator(f'[data-night-dir="{direction}"]')
                            if button.is_visible() and button.is_enabled():
                                button.click()
                page.wait_for_timeout(200)
            self.check(scope, "real encounter visibly started", started, fatal=True)
            self.check(scope, "real encounter visibly resolved", "summary-mode" in (page.locator("#nightOverlay").get_attribute("class") or ""), fatal=True)
            resolved = self.settle(page, lambda observed: (observed["envelope"]["payload"].get("nightBattle") or {}).get("resolved") is True
                                   and bool((observed["envelope"]["payload"]["nightBattle"]).get("instanceId")))
            payload = resolved["envelope"]["payload"]
            receipts = [event for event in payload["worldMeta"]["events"] if event["seq"] > before_seq and event["type"] == "threat.resolved"
                        and event["payload"].get("threatId") == payload["nightBattle"]["instanceId"]]
            self.check(scope, "real resolved envelope has specific new receipt", len(receipts) == 1, fatal=True)
            self.check(scope, "real baseline camp survived", payload["hp"] > 0, fatal=True)
            write_json(self.directory / "public-resolved-source-envelope.json", resolved["envelope"])
            self.result["baselineEnvelopes"] = {"day": {"file": "public-day-source-envelope.json", "checksum": day["envelope"]["checksum"]},
                                                "resolved": {"file": "public-resolved-source-envelope.json", "checksum": resolved["envelope"]["checksum"]}}
            self.capture(page, scope, "real-resolved")
            return copy.deepcopy(day["envelope"]), copy.deepcopy(resolved["envelope"])
        except Exception as error:
            self.result["baselineException"] = {"type": type(error).__name__, "message": str(error)}
            try:
                self.capture(page, scope, "failure")
            except Exception as capture_error:
                self.result["baselineFailureCaptureError"] = type(capture_error).__name__
            self.persist()
            raise
        finally:
            context.close()

    def boot_fixture(self, browser, key: str, envelope: dict, mutations: list[str], goal: str, design_case: str) -> None:
        case = {"designCardCase": design_case, "goal": goal, "status": "running", "fixtureMode": True,
                "fixture": {"origin": "derived-real-public-save" if mutations else "real-public-save", "mutations": mutations,
                            "inputChecksum": envelope["checksum"], "htmlSha256": self.source_sha,
                            "envelopeConstruction": "original public payload, explicitly listed mutations, JS checksum and fixture reason",
                            "isNaturalBattleLoss": False},
                "reproduction": {"expectedDefect": self.source_sha == KNOWN_BASELINE_SHA and goal != "day", "observedActualCheckFailure": False}}
        self.result["cases"][key] = case
        write_json(self.directory / f"{key}-input-envelope.json", envelope)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = self.page(context, key)
        marker = "zfarm-report-fixture-" + uuid.uuid4().hex
        origin = f"{urlsplit(self.args.url).scheme}://{urlsplit(self.args.url).netloc}"
        extra_keys = SAVE_KEYS[1:] if goal == "reset" else []
        bootstrap = {"origin": origin, "marker": marker, "key": SAVE_KEY, "envelope": envelope, "extraKeys": extra_keys}
        # window.name survives same-origin reload/reset, independently of game
        # storage clearing. It prevents this initial fixture from being re-seeded.
        page.add_init_script("""(() => { const f=""" + json.dumps(bootstrap, ensure_ascii=True) + """;
          if(window!==top || location.origin!==f.origin || window.name===f.marker)return;
          localStorage.setItem(f.key,JSON.stringify(f.envelope));
          for(const key of f.extraKeys)localStorage.setItem(key,JSON.stringify(f.envelope));
          window.name=f.marker;
        })();""")
        if extra_keys:
            case["fixture"]["storageMutation"] = "obsolete backup/corrupt/legacy copies seeded before loader solely for reset cleanup"
            case["coverage"] = {"publicResetPagehide": "pending actual click", "pendingCheckpointRace": "not verified in this case"}
        start_checks = len(self.result["actualChecks"])
        try:
            self.source(page.goto(self.args.url, wait_until="domcontentloaded", timeout=self.timeout()), key)
            self.check(key, "fixture installed before loader in isolated context", page.evaluate("marker=>window.name===marker", marker), fatal=True)
            original = envelope["payload"]
            boot = self.capture(page, key, "boot-before-start")
            self.check(key, "boot public calendar matches input fixture", dom_minute(boot["dom"]) == minute(original))
            page.locator("#continueSaveBtn").click()
            page.wait_for_timeout(300)
            first = self.capture(page, key, "started")
            clock = dom_minute(first["dom"])
            summary = page.locator("#nightOverlay").is_visible() and "summary-mode" in first["dom"]["overlayClass"]
            restart_accessible = False
            if goal == "day":
                self.check(key, "normal DAY has no report", not summary)
                self.check(key, "started DAY calendar follows input fixture", 0 <= clock - minute(original) <= 1)
            else:
                self.check(key, "resolved report is publicly visible", summary)
                b = original["nightBattle"]
                self.check(key, "saved kills and damage restored in UI", first["dom"]["kills"].strip() == str(b["kills"])
                           and first["dom"]["damage"].strip() == (f"-{b['finalDamage']}" if b["finalDamage"] else "0"))
                expected_cta = "重新开始" if goal in ("loss", "reset") else "关闭报告"
                self.check(key, "CTA matches intended action", expected_cta in first["dom"]["cta"])
                if goal in ("loss", "reset"):
                    self.check(key, "loss title restored", "失守" in first["dom"]["title"])
                    self.check(key, "ordinary supply control disabled for loss", page.locator("#eatBtn").is_disabled())
                    button = page.locator("#continueBtn")
                    restart_accessible = summary and button.is_visible() and button.is_enabled() and "重新开始" in button.inner_text()
                    self.check(key, "public loss restart is accessible", restart_accessible)
                    if not restart_accessible:
                        case["blockedAction"] = "missing public loss restart; no hidden reset click substituted"
            page.wait_for_timeout(2600)
            waiting = self.capture(page, key, "after-two-tick-intervals")
            self.check(key, "public clock advances" if goal == "day" else "report clock remains frozen",
                       dom_minute(waiting["dom"]) > clock if goal == "day" else dom_minute(waiting["dom"]) == minute(original))
            if goal == "report":
                button = page.locator("#continueBtn")
                accessible = summary and button.is_visible() and button.is_enabled() and "关闭报告" in button.inner_text()
                self.check(key, "public report close is accessible", accessible)
                if accessible:
                    button.click()
                    closed = self.settle(page, lambda observed: observed["envelope"]["payload"].get("nightBattle") is None
                                         and any(e["type"] == "threat.closed" and e.get("payload", {}).get("threatId") == b["instanceId"]
                                                 and e["seq"] > original["worldMeta"]["eventSeq"] for e in observed["envelope"]["payload"]["worldMeta"]["events"]))
                    events = [e for e in closed["envelope"]["payload"]["worldMeta"]["events"] if e["type"] == "threat.closed" and e.get("payload", {}).get("threatId") == b["instanceId"]]
                    commands = closed["envelope"]["payload"]["worldMeta"]["replay"]["commands"]
                    self.check(key, "one specific close/replay receipt at original calendar", len(events) == 1 and events[0]["tick"]["world"] == minute(original)
                               and any(c["commandId"] == events[0]["commandId"] and c["type"] == "threat.close" and c.get("payload", {}).get("threatId") == b["instanceId"] for c in commands))
                    self.capture(page, key, "after-public-close")
                    case["publicCloseExecuted"] = True
                else:
                    case["blockedAction"] = "missing public report close; no hidden click substituted"
            if goal == "reset":
                button = page.locator("#continueBtn")
                if restart_accessible:
                    with page.expect_navigation(wait_until="domcontentloaded", timeout=self.timeout(8)) as reset_navigation:
                        button.click()
                    self.source(reset_navigation.value, key)
                    self.capture(page, key, "after-public-reset-pagehide")
                    page.wait_for_timeout(2600)
                    self.check(key, "old keys remain absent after reset/pagehide", not any(self.read(page)["keysPresent"].values()))
                    for repeat in range(2):
                        self.reload(page, key)
                        self.check(key, f"old keys absent on fresh reload {repeat+1}", not any(self.read(page)["keysPresent"].values()))
                        self.capture(page, key, f"fresh-reset-reload-{repeat+1}")
                    page.locator("#continueSaveBtn").click()
                    fresh = self.settle(page, lambda observed: observed["envelope"]["payload"]["day"] == 1 and observed["envelope"]["payload"]["hp"] == 100)
                    self.check(key, "new public game contains no old encounter", fresh["envelope"]["payload"]["nightBattle"] is None
                               and not any(e.get("payload", {}).get("threatId") == original["nightBattle"]["instanceId"] for e in fresh["envelope"]["payload"]["worldMeta"]["events"]))
                    self.capture(page, key, "fresh-new-game")
                    case["publicResetExecuted"] = True
                    case["coverage"]["publicResetPagehide"] = "actual public restart and two reloads executed"
                else:
                    case["coverage"]["publicResetPagehide"] = "blocked by missing public restart"
            if not case.get("publicResetExecuted"):
                for repeat in range(2):
                    self.reload(page, key)  # public registered lifecycle checkpoint; no reseed
                    actual = self.capture(page, key, f"real-pagehide-save-{repeat+1}")
                    written_reason = (actual["envelope"] or {}).get("reason")
                    self.check(key, f"actual envelope persisted by registered reload lifecycle {repeat+1}",
                               actual["envelope"] is not None and written_reason in ("pagehide", "visibility-hidden")
                               and written_reason != envelope.get("reason"),
                               {"actualReason": written_reason, "inputReason": envelope.get("reason"),
                                "checksum": (actual["envelope"] or {}).get("checksum")})
                    if goal == "day":
                        self.check(key, f"DAY written calendar follows fixture at reload {repeat+1}",
                                   minute(actual["envelope"]["payload"]) > minute(original)
                                   and dom_minute(actual["dom"]) == minute(actual["envelope"]["payload"]))
                    if goal != "day" and not case.get("publicCloseExecuted"):
                        self.check(key, f"report effects unchanged at actual reload {repeat+1}", economic_projection(actual["envelope"]["payload"]) == economic_projection(original))
                        if goal in ("loss", "reset"):
                            self.check(key, f"loss remains authoritative in written save {repeat+1}", actual["envelope"]["payload"].get("gameOver") == "lose" and actual["envelope"]["payload"]["hp"] == 0)
                    page.locator("#continueSaveBtn").click()
                    page.wait_for_timeout(300)
                    observation = self.capture(page, key, f"actual-reload-started-{repeat+1}")
                    if goal != "day" and not case.get("publicCloseExecuted"):
                        self.check(key, f"same report UI recovers on reload {repeat+1}", page.locator("#nightOverlay").is_visible()
                                   and "summary-mode" in observation["dom"]["overlayClass"])
                    else:
                        self.check(key, f"ordinary daytime on reload {repeat+1}", not page.locator("#nightOverlay").is_visible())
                    if case.get("publicCloseExecuted"):
                        matching = [e for e in observation["envelope"]["payload"]["worldMeta"]["events"] if e["type"] == "threat.closed" and e.get("payload", {}).get("threatId") == b["instanceId"]]
                        self.check(key, f"close not repeated after reload {repeat+1}", len(matching) == 1)
        except Exception as error:
            case["exception"] = {"type": type(error).__name__, "message": str(error)}
            self.result["errors"].append(f"exception:{key}:{type(error).__name__}:{error}")
            try:
                self.capture(page, key, "failure")
            except Exception as capture_error:
                case["failureCaptureError"] = type(capture_error).__name__
        finally:
            case_checks = self.result["actualChecks"][start_checks:]
            case["actualCheckCount"] = len(case_checks)
            case["status"] = "passed" if case_checks and all(item["ok"] for item in case_checks) and "exception" not in case else "failed"
            case["reproduction"]["observedActualCheckFailure"] = case["status"] == "failed"
            context.close()
            self.persist()

    def run(self) -> None:
        completed = False
        threading.Thread(target=self.heartbeat, daemon=True).start()
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, executable_path=self.args.chrome,
                    args=["--no-sandbox", "--disable-dev-shm-usage"])
                try:
                    builder_context = browser.new_context()
                    builder = builder_context.new_page()  # about:blank, no game runtime
                    try:
                        if self.args.suite == "full":
                            from report_recovery_full import FullSuite
                            FullSuite(self, browser, builder).run()
                        else:
                            day, resolved = self.baseline(browser)
                            self.initial_suite(browser, builder, day, resolved)
                    finally:
                        builder_context.close()
                    completed = True
                finally:
                    browser.close()
        except Exception as error:
            self.result["errors"].append(f"run:{type(error).__name__}:{error}")
        finally:
            self.stop_heartbeat.set()
            bad_console = [item for item in self.result["consoleErrors"] if not explicit_favicon(item)]
            self.result["diagnosticConsole"] = [item for item in self.result["consoleErrors"] if explicit_favicon(item)]
            self.result["ok"] = completed and bool(self.result["actualChecks"]) and not self.result["errors"] and not self.result["pageErrors"] and not self.result["httpErrors"] and not self.result["requestFailures"] and not bad_console
            self.result["status"] = "complete" if self.result["ok"] else "failed"
            self.result["finishedAtUnix"] = time.time()
            self.result["elapsedSeconds"] = round(time.monotonic() - self.started, 3)
            self.result["notRunCases"] = [key for key in self.result["plannedCases"] if key not in self.result["cases"]]
            self.persist()
            print(json.dumps({"runner": self.result["runner"], "mode": self.result["mode"], "ok": self.result["ok"],
                "htmlSha256": self.source_sha, "actualChecks": len(self.result["actualChecks"]),
                "passedChecks": sum(item["ok"] for item in self.result["actualChecks"]),
                "caseStatus": {key: value["status"] for key, value in self.result["cases"].items()},
                "runDirectory": self.directory.name, "report": "report.json", "errorCount": len(self.result["errors"])}, ensure_ascii=False), flush=True)
        raise SystemExit(0 if self.result["ok"] else 1)

    def initial_suite(self, browser, builder, day, resolved) -> None:
        cases = [("DAY-control", day["payload"], [], "day", "DAY"),
                                 ("B1-complete-resolved", resolved["payload"], [], "report", "B1")]
        contradiction = copy.deepcopy(resolved["payload"])
        contradiction["night"] = False
        cases.append(("B1-contradictory-night-false", contradiction, ["payload.night=false with full resolved instance and no close"], "report", "B2"))
        for key, include, goal in [("B8-loss-new-field", True, "loss"), ("B9-loss-legacy", False, "loss"), ("B15-public-reset-pagehide", True, "reset")]:
            payload, mutations = loss_payload(resolved["payload"], include)
            cases.append((key, payload, mutations, goal, key.split('-')[0]))
        self.result["plannedCases"] = [case[0] for case in cases]
        self.persist()
        for key, payload, mutations, goal, design_case in cases:
            envelope = builder.evaluate(MAKE_ENVELOPE, {"payload": payload, "reason": "qa-explicit-report-fixture"})
            self.boot_fixture(browser, key, envelope, mutations, goal, design_case)


def developer_negative_controls() -> None:
    """Exercise the real diagnostic methods; these are never browser results."""
    controls = []

    class DiagnosticPage:
        def __init__(self, envelope, screenshot_failure: bool = False):
            self.observed = {"envelope": envelope, "computedChecksum": None, "parseError": None,
                             "keysPresent": {}, "dom": {}}
            self.screenshot_failure = screenshot_failure
            self.screenshot_calls = 0

        def evaluate(self, *unused):
            return copy.deepcopy(self.observed)

        def screenshot(self, **unused):
            self.screenshot_calls += 1
            if self.screenshot_failure:
                raise TimeoutError("developer-only screenshot negative control")
            # A mock call records no pixels. No control artifact is retained
            # or represented as a real screenshot/gameplay observation.

    with tempfile.TemporaryDirectory(prefix="zfarm-report-diagnostic-controls-") as directory:
        runner = Runner(argparse.Namespace(out=Path(directory), timeout=10, url="http://127.0.0.1/", chrome="unused"))
        variants = [("string-envelope", "invalid"), ("integer-envelope", 42),
                    ("array-envelope", [1]), ("boolean-envelope", False),
                    ("array-payload", {"payload": [1]}),
                    ("bad-checksum", {"payload": {"version": 21}, "checksum": "invalid"}),
                    ("null-content", {"version":21,"payload":{"version":21,"contentState":None,"world":{}},"checksum":None}),
                    ("array-world", {"version":21,"payload":{"version":21,"contentState":{"contentVersion":3},"world":[]},"checksum":None})]
        for label, envelope in variants:
            page = DiagnosticPage(envelope)
            try:
                runner.capture(page, "developer-only", label)
            except AssertionError:
                pass
            else:
                raise AssertionError("invalid diagnostic output accepted: " + label)
            artifact = runner.result["artifacts"][-1]
            saved = json.loads((runner.directory / artifact["file"]).read_text(encoding="utf-8"))
            assert saved["envelope"] == envelope and "validationError" in saved
            assert page.screenshot_calls == 1 and artifact["screenshot"] is not None
            if not isinstance(envelope, dict):
                assert artifact["checksum"] is None
            controls.append({"name": label, "rejectedWithRegisteredDiagnostic": True})
        page = DiagnosticPage(None, screenshot_failure=True)
        try:
            runner.capture(page, "developer-only", "screenshot-failure")
        except TimeoutError:
            pass
        else:
            raise AssertionError("screenshot failure accepted")
        artifact = runner.result["artifacts"][-1]
        assert (runner.directory / artifact["file"]).is_file()
        assert artifact["screenshot"] is None and artifact["screenshotError"]["type"] == "TimeoutError"
        persisted = json.loads(runner.report.read_text(encoding="utf-8"))
        assert len(persisted["artifacts"]) == len(variants) + 1 and not persisted["actualChecks"]
        controls.append({"name": "screenshot-failure", "rejectedWithRegisteredDiagnostic": True})
    assert explicit_favicon({"location":{"url":"http://127.0.0.1/favicon.ico"}})
    assert explicit_favicon({"url":"http://127.0.0.1/favicon.ico","status":404})
    assert not explicit_favicon("404 resource error")
    assert not explicit_favicon({"text":"404","location":{}})
    assert not explicit_favicon({"text":"404","location":{"url":"http://127.0.0.1/assets/game.svg"}})
    controls.append({"name":"located-resource-policy","rejectedWithRegisteredDiagnostic":True})
    print(json.dumps({"mode": "developer-negative-controls", "gameplayExecuted": False,
                      "realScreenshotsCaptured": False, "temporaryArtifactsRemoved": True,
                      "controls": controls, "ok": True}), flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("ZFARM_TEST_URL", "http://127.0.0.1/"))
    parser.add_argument("--chrome", default=os.environ.get("CHROME_BIN", "/usr/bin/google-chrome"))
    parser.add_argument("--out", type=Path, default=Path.home() / ".cache" / "zfarm-qa" / "report-recovery", help="private QA directory; each run creates a unique child directory")
    parser.add_argument("--timeout", type=int, help="seconds; initial default300, full default900")
    parser.add_argument("--suite", choices=("initial", "full"), default="initial", help="initial historical six-case suite or full B1-B16 contracts")
    parser.add_argument("--fixture-source", type=Path, help="private archived source directory, with public-day/resolved/closed-source-envelope.json")
    parser.add_argument("--day-source", type=Path, help="explicit archived full DAY envelope/observation")
    parser.add_argument("--resolved-source", type=Path, help="explicit archived full real resolved envelope/observation")
    parser.add_argument("--closed-source", type=Path, help="explicit archived matching real closed envelope/observation")
    parser.add_argument("--legacy-day-source", type=Path, help="actual production SAVE18 DAY original")
    parser.add_argument("--legacy-resolved-source", type=Path, help="actual production SAVE18 resolved original")
    parser.add_argument("--legacy-closed-source", type=Path, help="actual production SAVE18 closed original")
    parser.add_argument("--legacy-initial-source", type=Path, help="actual production SAVE18 first-start/reload sentinel original")
    parser.add_argument("--legacy-initial-report", type=Path, help="actual production18 immediate first-start/reload capture provenance")
    parser.add_argument("--legacy-html-sha256", help="full source SHA of the genuine production18 writer; separate from new rendered HTML")
    parser.add_argument("--legacy-writer-report", type=Path, help="actual production18 public-writer capture report; pins original SHA/version/source")
    parser.add_argument("--require-production18", action="store_true", help="release gate: require all four authentic production18 inputs and their writer provenance")
    parser.add_argument("--expect-html-sha256", help="required frozen source for full contracts; fail on any document mismatch")
    parser.add_argument("--check-fixtures", action="store_true", help="archive/fixture/source development checks only; Node, no browser")
    parser.add_argument("--developer-negative-controls", action="store_true", help="diagnostic-method controls only; no browser, no retained artifacts, not gameplay evidence")
    args = parser.parse_args()
    if args.timeout is None:args.timeout=900 if args.suite=="full" else 300
    target = urlsplit(args.url)
    if target.scheme not in ("http", "https") or target.query or target.fragment or args.timeout <= 0:
        parser.error("use a normal HTTP(S) public URL without debug query/fragment and a positive timeout")
    if args.expect_html_sha256 and not re.fullmatch(r"[0-9a-fA-F]{64}", args.expect_html_sha256):
        parser.error("--expect-html-sha256 must be 64 hex characters")
    if args.expect_html_sha256:
        args.expect_html_sha256 = args.expect_html_sha256.lower()
    legacy_fields=[args.legacy_day_source,args.legacy_resolved_source,args.legacy_closed_source,args.legacy_html_sha256]
    if (any(legacy_fields) or args.require_production18) and not all(legacy_fields):
        parser.error("production18 compatibility requires all three real source files and --legacy-html-sha256")
    if args.require_production18 and not args.legacy_writer_report:
        parser.error("--require-production18 needs the actual --legacy-writer-report provenance")
    if args.require_production18 and (not args.legacy_initial_source or not args.legacy_initial_report):
        parser.error("--require-production18 needs the fourth real --legacy-initial-source and --legacy-initial-report")
    if bool(args.legacy_initial_source)!=bool(args.legacy_initial_report):
        parser.error("provide both initial18 original and provenance report")
    if args.legacy_initial_source and not all(legacy_fields):
        parser.error("initial18 compatibility also requires the three genuine production18 sources and writer SHA")
    if args.legacy_html_sha256:
        if not re.fullmatch(r"[0-9a-fA-F]{64}",args.legacy_html_sha256):parser.error("--legacy-html-sha256 must be64 hex characters")
        args.legacy_html_sha256=args.legacy_html_sha256.lower()
    if args.suite == "full" and not args.developer_negative_controls and not args.check_fixtures and not args.expect_html_sha256:
        parser.error("full suite requires the root-frozen --expect-html-sha256")
    return args


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.developer_negative_controls:
        developer_negative_controls()
    elif arguments.check_fixtures:
        from report_recovery_full import fixture_source_checks
        fixture_source_checks(arguments)
    else:
        Runner(arguments).run()

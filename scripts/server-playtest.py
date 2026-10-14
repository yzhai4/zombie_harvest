"""Real-browser smoke using public controls and an isolated browser context.

The default real target is http://127.0.0.1/, the server's port-80 test build;
this does not establish access to the separate public Sites HTTPS deployment.
ZFARM_TEST_URL selects another actual target, recorded as url/finalUrl in the
report. Saves are read only: fresh games use the public reset button, movement
uses WASD with visible player-marker feedback, and no save/state is injected.
"""

from __future__ import annotations

import json
import math
import os
import time
from pathlib import Path

BASE_URL = os.environ.get("ZFARM_TEST_URL", "http://127.0.0.1/")
OUT = Path(os.environ.get("ZFARM_TEST_OUT", str(Path.home() / ".cache" / "zfarm-qa" / "server-playtest-result.json")))
NIGHT_TIMEOUT_MS = int(os.environ.get("ZFARM_NIGHT_TIMEOUT_MS", "35000"))
SAVE_KEY = "zombie-harvest-progress-v12"

# One read-only snapshot of the primary envelope; do not pick an arbitrary
# prefix match, backup or corrupt file. Recompute FNV using JS UTF-16 iteration.
READ_SAVE = """key => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const envelope = JSON.parse(raw), payload = envelope.payload;
  if (!payload) return {error:'missing-primary-envelope'};
  let hash = 2166136261; const text = JSON.stringify(payload);
  for (let i=0; i<text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return {payload, checksum:envelope.checksum, computedChecksum:(hash>>>0).toString(16)};
}"""


def write_result(result: dict[str, object]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix(OUT.suffix + ".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(OUT)


def playthrough(result: dict[str, object], errors: list[str], console_errors: list[str], http_errors: list[str]) -> None:
    # Import/launch failures must also reach the outer failure-report handler.
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get("CHROME_BIN", "/usr/bin/google-chrome"),
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror:{exc}"))
        page.on("response", lambda response: http_errors.append(f"{response.status}:{response.url}") if response.status >= 400 else None)

        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
        result["finalUrl"] = page.url
        with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
            page.locator("#resetSaveBtn").click()
        page.locator("#continueSaveBtn").click()
        page.wait_for_timeout(500)

        def check(name: str, condition: bool) -> None:
            result["checks"].append({"name": name, "ok": bool(condition)})
            if not condition:
                errors.append(f"check:{name}")

        def read_save() -> dict | None:
            observed = page.evaluate(READ_SAVE, SAVE_KEY)
            if observed is None:
                return None
            if "error" in observed or observed["checksum"] != observed["computedChecksum"]:
                raise AssertionError("primary game save envelope/checksum is invalid")
            return observed["payload"]

        def settle_save(predicate, timeout_seconds: float = 15) -> dict:
            deadline = time.monotonic() + timeout_seconds
            while time.monotonic() < deadline:
                payload = read_save()
                if payload is not None and predicate(payload):
                    return payload
                page.wait_for_timeout(100)
            raise TimeoutError("primary save did not persist the expected public action")

        def position() -> tuple[float, float]:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                # renderWorld replaces the marker frequently. Read fresh DOM
                # nodes in one synchronous snapshot, never a retained locator
                # element that may detach between wait_for and evaluate.
                value = page.evaluate(r"""() => {
                    const visible=node=>!!node?.isConnected && node.getClientRects().length>0
                        && getComputedStyle(node).visibility!=='hidden' && getComputedStyle(node).display!=='none';
                    const label=document.querySelector('#mapRegionLabel');
                    const match=visible(label) && label.textContent.match(/([\d.]+)\/\d+列\s*·\s*([\d.]+)\/\d+行/);
                    if (match) {
                        const x=Number(match[1])-1, y=Number(match[2])-1;
                        if (Number.isFinite(x) && Number.isFinite(y)) return {x,y,source:'location-label'};
                    }
                    const world=document.querySelector('#world'), marker=world?.querySelector('.player-marker');
                    if (!visible(world) || !visible(marker)) return null;
                    const tiles=[...world.querySelectorAll('.tile[data-x][data-y]')];
                    if (!tiles.length) return null;
                    const xs=tiles.map(tile=>Number(tile.dataset.x)), ys=tiles.map(tile=>Number(tile.dataset.y));
                    if (!xs.every(Number.isFinite) || !ys.every(Number.isFinite)) return null;
                    const x=Math.min(...xs)+parseFloat(marker.style.left)/parseFloat(marker.style.width),
                          y=Math.min(...ys)+parseFloat(marker.style.top)/parseFloat(marker.style.height);
                    return Number.isFinite(x) && Number.isFinite(y) ? {x,y,source:'player-marker'} : null;
                }""")
                if value is not None:
                    coordinates = float(value["x"]), float(value["y"])
                    if all(math.isfinite(coordinate) for coordinate in coordinates):
                        return coordinates
                page.wait_for_timeout(50)
            raise TimeoutError("visible location label/player-marker coordinates unavailable")

        def navigate(x: float, y: float, tolerance: float = 0.3) -> None:
            if page.locator("#infoModal").get_attribute("aria-hidden") == "false":
                page.locator("#infoModalClose").click()
            page.keyboard.press("Escape")
            deadline = time.monotonic() + 30
            previous = position()
            initial_position = previous
            stalled = 0
            while time.monotonic() < deadline:
                px, py = position()
                if abs(px - x) <= tolerance and abs(py - y) <= tolerance:
                    result.setdefault("navigation", []).append({"waypoint": [x, y], "before": initial_position, "after": [px, py]})
                    return
                dx, dy = x - px, y - py
                key = ("d" if dx > 0 else "a") if abs(dx) > tolerance else ("s" if dy > 0 else "w")
                remaining = abs(dx) if key in ("d", "a") else abs(dy)
                duration = max(60, min(300, int(remaining / 2 * 1000)))
                page.keyboard.down(key)
                try:
                    page.wait_for_timeout(duration)
                finally:
                    page.keyboard.up(key)
                page.wait_for_timeout(60)
                current = position()
                stalled = stalled + 1 if math.dist(current, previous) < 0.05 else 0
                if stalled >= 3:
                    raise AssertionError(f"public WASD navigation blocked at {current} toward {(x, y)}")
                previous = current
            raise TimeoutError(f"public WASD navigation did not reach {(x, y)}")

        check("title", "我是大救星" in (page.title() or ""))
        check("started", page.locator("#startOverlay").get_attribute("aria-hidden") == "true")
        check("day label", page.locator("#dayLabel").inner_text().startswith("第"))

        # v82 NPC slice: read the same role cards a player sees.  This is a
        # runtime check against a fresh game state, so it does not seed a save
        # or mutate hidden state to manufacture promotion eligibility.
        page.locator("#survivorToggle").click()
        page.wait_for_timeout(100)
        npc_cards = page.locator("#survivorList .survivor-card")
        npc_text = npc_cards.all_inner_texts()
        check("npc roster cards", npc_cards.count() == 10)
        check("npc attribute summaries", len(npc_text) == 10 and all("· 战斗" in text for text in npc_text))
        check("starting heroes shown", sum("英雄 ·" in text for text in npc_text) >= 3)
        check("ordinary promotion progress shown", sum("普通 · 晋升 0%" in text for text in npc_text) >= 1)
        # At day one no ordinary survivor is eligible; the promotion affordance
        # must therefore remain absent from the live context action list.
        check("promotion gate before eligibility", page.locator('[data-context-action="promoteHero"]').count() == 0)
        page.locator("#infoModalClose").click()
        page.wait_for_timeout(100)

        if not page.locator("#eventChoiceA").is_visible():
            page.locator("#eventToggle").click()
            page.wait_for_timeout(100)
        page.locator("#eventChoiceA").click()
        page.wait_for_timeout(150)
        if page.locator("#infoModal").get_attribute("aria-hidden") == "false":
            page.locator("#infoModalClose").click()
            page.wait_for_timeout(100)
        # Align with the unobstructed row before moving left past shelter,
        # then follow the explicit public tree-collection route.
        navigate(position()[0], 11.5)
        navigate(8.2, 11.5)
        navigate(8.2, 8.2)
        check("public tree waypoint reached", math.dist(position(), (8.2, 8.2)) < 0.45)
        before_save = settle_save(lambda payload: bool(payload.get("worldMeta", {}).get("events")))
        before = before_save["wood"]
        before_seq = int(before_save["worldMeta"]["eventSeq"])
        gather = page.locator('#contextActions [data-context-action="gather"]')
        gather.wait_for(state="visible", timeout=5000)
        check("public gather affordance enabled", gather.is_enabled())
        gather.click()

        def positive_wood_receipts(payload: dict) -> list[dict]:
            return [event for event in payload.get("worldMeta", {}).get("events", [])
                    if event.get("type") == "resource.collected" and int(event.get("seq", -1)) > before_seq
                    and float(event.get("payload", {}).get("delta", {}).get("wood", 0)) > 0]

        after_save = settle_save(lambda payload: payload.get("wood", 0) > before and bool(positive_wood_receipts(payload)))
        receipts = positive_wood_receipts(after_save)
        receipt_commands = {event.get("commandId") for event in receipts}
        commands = after_save["worldMeta"].get("replay", {}).get("commands", [])
        check("gather increases actual wood", after_save["wood"] > before)
        check("gather has new positive resource.collected receipt", len(receipts) == 1)
        check("gather receipt matches public collect command", any(command.get("type") == "resource.collect" and command.get("commandId") in receipt_commands for command in commands))
        check("gather primary save checksum verified", True)
        result["gather"] = {"woodBefore": before, "woodAfter": after_save["wood"], "receipts": receipts}

        page.locator("#buildBtn").click()
        page.wait_for_timeout(100)
        check("build drawer", page.locator("#buildDrawer").is_visible())
        page.locator('[data-build="wall"]').click()
        page.wait_for_timeout(100)
        check("build selection", page.locator("#buildDrawer").is_visible())

        page.locator("#endDayBtn").click()
        page.wait_for_timeout(900)
        night_started = False
        check(
            "night or summary",
            page.locator("#nightOverlay").is_visible()
            or page.locator("#nightWorld").is_visible()
            or "threat-map-active" in (page.locator("body").get_attribute("class") or ""),
        )
        check("night movement controls", page.locator('[data-night-dir="right"]').count() > 0)

        # Drive the actual night encounter through the public controls.  The
        # player starts close to the camp wall while the horde advances from
        # the east, so small left/up pulses keep the avatar in the battle lane
        # as enemies enter range.  Attack only when the UI enables it; this
        # avoids mutating state from page.evaluate and exercises the same route
        # a player uses with WASD/F.
        night_deadline = time.monotonic() + NIGHT_TIMEOUT_MS / 1000
        while time.monotonic() < night_deadline:
            body_classes = page.locator("body").get_attribute("class") or ""
            summary = page.locator("#nightOverlay").get_attribute("class") or ""
            if "summary-mode" in summary:
                break
            if "threat-map-active" in body_classes:
                night_started = True
                attack = page.locator("#nightAttackBtn")
                live_attack = page.locator("#nightLiveAttackBtn")
                if attack.is_visible() and attack.is_enabled():
                    attack.click()
                elif live_attack.count() and live_attack.is_visible() and live_attack.is_enabled():
                    live_attack.click()
                else:
                    # One short movement pulse per polling interval is enough
                    # to follow the projected lane without racing the battle
                    # timer.  If a wall blocks the pulse, the next direction
                    # still leaves the encounter running.
                    for direction in ("left", "up"):
                        button = page.locator(f'[data-night-dir="{direction}"]')
                        if button.count() and button.is_visible() and not button.is_disabled():
                            button.click()
                            break
            page.wait_for_timeout(300)

        summary_class = page.locator("#nightOverlay").get_attribute("class") or ""
        night_resolved = "summary-mode" in summary_class
        summary_kills = ""
        summary_breaches = ""
        summary_damage = ""
        check("night started", night_started)
        check("night summary", night_resolved)
        if night_resolved:
            check("daily summary", page.locator("#dailySummary").is_visible())
            check("summary damage", page.locator("#summaryDamage").inner_text() != "")
            check("summary continuation enabled", page.locator("#continueBtn").is_enabled())
            summary_kills = page.locator("#summaryKills").inner_text() if page.locator("#summaryKills").count() else ""
            summary_breaches = page.locator("#summaryBreaches").inner_text() if page.locator("#summaryBreaches").count() else ""
            summary_damage = page.locator("#summaryDamage").inner_text() if page.locator("#summaryDamage").count() else ""
            page.locator("#continueBtn").click()
            try:
                page.wait_for_function(
                    "() => !document.body.classList.contains('threat-map-active') && !document.querySelector('#nightOverlay')?.classList.contains('show')",
                    timeout=5000,
                )
            except Exception as exc:  # pragma: no cover - browser timing is environment-specific
                errors.append(f"daytime-transition-timeout:{exc}")
        morning_classes = page.locator("body").get_attribute("class") or ""
        check("returned to daytime", "threat-map-active" not in morning_classes and not page.locator("#nightOverlay").is_visible())

        # Verify the public continuation path with the same save created by
        # the actions above.  Reloading the document must expose the continue
        # affordance and restore the same morning snapshot; this catches a
        # regression where the UI reports a checkpoint but boot migration
        # silently falls back to a fresh game.
        morning_day = page.locator("#dayLabel").inner_text()
        morning_time = page.locator("#timeLabel").inner_text()
        page.reload(wait_until="domcontentloaded", timeout=30000)
        page.locator("#continueSaveBtn").wait_for(state="visible", timeout=5000)
        check("save continuation available after reload", page.locator("#continueSaveBtn").is_enabled())
        page.locator("#continueSaveBtn").click()
        page.wait_for_timeout(350)
        check("saved state resumes after reload", page.locator("#dayLabel").inner_text() == morning_day)
        check("saved time resumes after reload", page.locator("#timeLabel").inner_text() == morning_time)

        result["state"] = {
            "day": page.locator("#dayLabel").inner_text(),
            "time": page.locator("#timeLabel").inner_text(),
            "beforeWood": before,
            "bodyClasses": page.locator("body").get_attribute("class") or "",
            "nightStarted": night_started,
            "nightResolved": night_resolved,
            "nightKills": summary_kills,
            "nightBreaches": summary_breaches,
            "nightDamage": summary_damage,
            "resumedDay": page.locator("#dayLabel").inner_text(),
            "resumedTime": page.locator("#timeLabel").inner_text(),
        }
        browser.close()

def main() -> None:
    started = time.monotonic()
    errors: list[str] = []
    console_errors: list[str] = []
    http_errors: list[str] = []
    result: dict[str, object] = {"runner": "server-playtest", "url": BASE_URL, "ok": False,
                                "status": "running", "startedAtUnix": time.time(), "checks": [], "errors": errors,
                                "consoleErrors": console_errors, "httpErrors": http_errors,
                                "policy": {"publicReset": True, "saveInjection": False, "hiddenStateMutation": False, "primarySaveReadOnly": True}}
    # Invalidate a previous pass before launching the browser. Even an
    # interrupted run then leaves this invocation's non-passing report.
    write_result(result)
    completed = False
    try:
        playthrough(result, errors, console_errors, http_errors)
        completed = True
    except Exception as exc:
        errors.append(f"{type(exc).__name__}:{exc}")
        result["exception"] = {"type": type(exc).__name__, "message": str(exc)}
    finally:
        if not completed and not errors:
            errors.append("playthrough-interrupted-before-completion")
        result["ok"] = completed and not errors and not [item for item in console_errors if "404" not in item]
        result["status"] = "complete" if result["ok"] else "failed"
        result["elapsedSeconds"] = round(time.monotonic() - started, 3)
        result["finishedAtUnix"] = time.time()
        write_result(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()

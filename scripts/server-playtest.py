"""Real-browser smoke for the static game build.

Run this on a host with Chromium/Chrome and Playwright installed. The server
copy is tested through loopback so the same file served on port 80 is used.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("ZFARM_TEST_URL", "http://127.0.0.1/")
OUT = Path(os.environ.get("ZFARM_TEST_OUT", "/home/ubuntu/zfarm-v82-a4ec/server-playtest-result.json"))
NIGHT_TIMEOUT_MS = int(os.environ.get("ZFARM_NIGHT_TIMEOUT_MS", "35000"))


def main() -> None:
    errors: list[str] = []
    console_errors: list[str] = []
    http_errors: list[str] = []
    result: dict[str, object] = {"url": BASE_URL, "checks": [], "consoleErrors": console_errors, "httpErrors": http_errors}

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
        page.evaluate("localStorage.clear(); sessionStorage.clear();")
        page.reload(wait_until="domcontentloaded")
        page.locator("#continueSaveBtn").click()
        page.wait_for_timeout(500)

        def check(name: str, condition: bool) -> None:
            result["checks"].append({"name": name, "ok": bool(condition)})
            if not condition:
                errors.append(f"check:{name}")

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
        before = page.locator("#woodValue").inner_text() if page.locator("#woodValue").count() else ""
        page.locator("#gatherBtn").click()
        page.wait_for_timeout(250)
        check("gather action", page.locator("#timeLabel").inner_text() != "")

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

    result["errors"] = errors
    result["ok"] = not errors and not [item for item in console_errors if "404" not in item]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()


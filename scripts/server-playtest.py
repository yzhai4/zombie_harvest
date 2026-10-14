"""Real-browser smoke for the static game build.

Run this on a host with Chromium/Chrome and Playwright installed. The server
copy is tested through loopback so the same file served on port 80 is used.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("ZFARM_TEST_URL", "http://127.0.0.1/")
OUT = Path(os.environ.get("ZFARM_TEST_OUT", "/home/ubuntu/zfarm-v82-a4ec/server-playtest-result.json"))


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
        check(
            "night or summary",
            page.locator("#nightOverlay").is_visible()
            or page.locator("#nightWorld").is_visible()
            or "threat-map-active" in (page.locator("body").get_attribute("class") or ""),
        )
        check("night movement controls", page.locator('[data-night-dir="right"]').count() > 0)
        if page.locator('[data-night-dir="right"]').is_visible():
            page.locator('[data-night-dir="right"]').click()
            page.wait_for_timeout(150)
        if page.locator("#nightAttackBtn").is_enabled():
            page.locator("#nightAttackBtn").click()
            page.wait_for_timeout(150)

        result["state"] = {
            "day": page.locator("#dayLabel").inner_text(),
            "time": page.locator("#timeLabel").inner_text(),
            "beforeWood": before,
            "bodyClasses": page.locator("body").get_attribute("class"),
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


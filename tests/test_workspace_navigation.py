"""Workspace navigation regression checks. No physical-model changes permitted."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOT_DIR = ROOT / "tests" / "ui_screenshots"

def main():
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    for width, height in [(390, 844), (768, 1024), (1280, 800)]:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": width, "height": height})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.set_content((ROOT / "index.html").read_text(encoding="utf-8"), timeout=60000)
            page.wait_for_selector('#sim[data-workspace="overview"]')
            assert page.locator("#stage").is_visible(), (width, "stage absent on Overview")
            page.screenshot(path=str(SHOT_DIR / f"{width}x{height}-overview.png"))
            before = page.evaluate("""() => JSON.stringify({
                t: SIM.S.t, soc: SIM.S.soc, cfg: SIM.S.cfg, loads: SIM.S.loads,
                requested: SIM.S.live && SIM.S.live.requested
            })""")
            for tab, ident in [
                ("build", "#ptype"),
                ("loads", "#loadRows"),
                ("missions", "#missionList"),
                ("score", "#score"),
                ("shop", "#costList"),
                ("reference", ".sources"),
            ]:
                page.locator('.tabs button[data-tab="' + tab + '"]').click()
                assert page.locator("#sim").get_attribute("data-workspace") == tab
                assert page.locator(ident).is_visible(), (width, tab, ident)
                if tab in ("build", "loads", "missions", "score", "shop", "reference"):
                    page.screenshot(path=str(SHOT_DIR / f"{width}x{height}-{tab}.png"))
                assert not page.locator("#stage").is_visible(), (width, tab, "stage blocks task")
                if tab == "build":
                    for sub, target in [("battery", "#bpar"), ("site", "#tilt"),
                                        ("wiring", "#pvMat"), ("projects", "#saveB"),
                                        ("checks", "#checks"), ("solar", "#ptype")]:
                        page.locator('.ss-builder-nav button[data-ss-builder="' + sub + '"]').click()
                        assert page.locator(target).is_visible(), (width, sub, target)
            # WAI-ARIA tab behavior must be usable without a pointing device.
            page.locator('.tabs button[data-tab="overview"]').focus()
            page.keyboard.press("ArrowRight")
            assert page.locator("#sim").get_attribute("data-workspace") == "build"
            assert page.locator('.tabs button[data-tab="build"]').get_attribute("aria-selected") == "true"
            page.locator('.ss-builder-nav button[data-ss-builder="solar"]').focus()
            page.keyboard.press("ArrowRight")
            assert page.locator("#bpar").is_visible(), (width, "builder keyboard nav")
            page.keyboard.press("Home")
            assert page.locator("#ptype").is_visible(), (width, "builder Home shortcut")
            page.locator('.tabs button[data-tab="shop"]').click()
            shop_text = page.locator("#pane-shop").inner_text().lower()
            assert "not live stock" in shop_text, (width, "missing historical offer disclaimer")
            assert page.locator("#partsList li").count() > 0, (width, "missing product source listing")
            assert page.locator("#srcParts li").count() > 0, (width, "missing manufacturer sources")
            after = page.evaluate("""() => JSON.stringify({
                t: SIM.S.t, soc: SIM.S.soc, cfg: SIM.S.cfg, loads: SIM.S.loads,
                requested: SIM.S.live && SIM.S.live.requested
            })""")
            assert before == after, (width, "navigation changed simulation state")
            page.locator('.tabs button[data-tab="overview"]').click()
            assert page.locator("#stage").is_visible()
            page.locator("#qLoads").click()
            assert page.locator("#sim").get_attribute("data-workspace") == "loads"
            page.locator('.tabs button[data-tab="overview"]').click()
            page.locator("#qCost").click()
            assert page.locator("#sim").get_attribute("data-workspace") == "shop"
            assert page.locator("#costTotal").is_visible()
            overflow = page.evaluate("""() => ({
                width: document.documentElement.clientWidth,
                scroll: document.documentElement.scrollWidth
            })""")
            assert overflow["scroll"] <= overflow["width"] + 2, (width, overflow)
            duplicates = page.evaluate("""() => {
                const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
                return ids.filter((id, index) => ids.indexOf(id) !== index);
            }""")
            assert not duplicates, (width, "duplicate IDs after DOM moves", duplicates)
            assert not errors, (width, errors)
            browser.close()
        print(f"PASS: Solar Sandbox task navigation {width}x{height}")

if __name__ == "__main__":
    main()

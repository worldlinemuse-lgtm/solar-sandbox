"""Workspace navigation regression checks. No physical-model changes permitted."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

def main():
    for width, height in [(390, 844), (768, 1024), (1280, 800)]:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": width, "height": height})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.set_content((ROOT / "index.html").read_text(encoding="utf-8"), timeout=60000)
            page.wait_for_selector('#sim[data-workspace="overview"]')
            assert page.locator("#stage").is_visible(), (width, "stage absent on Overview")
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
                assert not page.locator("#stage").is_visible(), (width, tab, "stage blocks task")
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
            assert not errors, (width, errors)
            browser.close()
        print(f"PASS: Solar Sandbox task navigation {width}x{height}")

if __name__ == "__main__":
    main()

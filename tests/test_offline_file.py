"""Checks that the standalone page works as one file with no network: opens it from disk with the browser offline and
every web request blocked, then checks the simulator runs, the voice guide audio loads, and no service worker or
manifest is set up (those are only for the web-hosted copy). Usage: python tests/test_offline_file.py [page.html]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, '..', 'index.html')

async def main():
    res = {}; blocked = []
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}); errs = []
        await ctx.route('http*://**/*', lambda r: (blocked.append(r.request.url), r.abort()))
        await ctx.set_offline(True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + PATH); await pg.wait_for_function('typeof SIM!=="undefined"', timeout=30000)
        res['sim_runs'] = await pg.evaluate('(()=>{const t=SIM.S.t;for(let i=0;i<200;i++)SIM.step();return SIM.S.t!==t;})()')
        res['audio_loaded'] = await pg.evaluate('''()=>new Promise(ok=>{const a=document.querySelector('audio');if(!a)return ok(false);
            if(a.readyState>=1&&isFinite(a.duration))return ok(a.duration);a.addEventListener('loadedmetadata',()=>ok(a.duration),{once:true});a.load();setTimeout(()=>ok(false),10000);})''')
        res['no_manifest'] = await pg.evaluate("!document.querySelector('link[rel=manifest]')")
        res['no_service_worker'] = await pg.evaluate("!('serviceWorker' in navigator) || !navigator.serviceWorker.controller")
        res['blocked_requests'] = blocked; res['page_errors'] = errs
        await b.close()
    ok = res['sim_runs'] and res['audio_loaded'] and res['no_manifest'] and res['no_service_worker'] and not blocked and not errs
    print(json.dumps(res)); print('single-file offline check', 'passed' if ok else 'FAILED')
    sys.exit(0 if ok else 1)

asyncio.run(main())

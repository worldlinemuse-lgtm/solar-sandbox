"""Checks the installable offline version: serves this folder over http, loads the page, waits for the service worker,
checks the manifest and icons, then goes offline and reloads. Usage: python tests/test_pwa.py   (from the site folder)"""
import asyncio, functools, http.server, json, os, socketserver, sys, threading
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    h.log_message = lambda *a: None
    srv = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = serve(); url = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url); await pg.wait_for_function('typeof SIM!=="undefined"')
        res['sw_active'] = await pg.evaluate('navigator.serviceWorker.ready.then(r=>!!r.active)')
        res['manifest_link'] = await pg.evaluate("document.querySelector('link[rel=manifest]')?.getAttribute('href')")
        m = await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
        res['manifest_ok'] = m.get('display') == 'standalone' and m.get('start_url') and any(i['sizes'] == '512x512' for i in m['icons']) and any(i['sizes'] == '192x192' for i in m['icons'])
        res['icons_ok'] = await pg.evaluate("Promise.all(['icon-192.png','icon-512.png','icon-512-maskable.png'].map(f=>fetch(f).then(r=>r.ok&&r.headers.get('content-type').includes('png')))).then(a=>a.every(Boolean))")
        await pg.reload(); await pg.wait_for_function('typeof SIM!=="undefined"')  # page now controlled by the worker
        res['controlled'] = await pg.evaluate('!!navigator.serviceWorker.controller')
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_function('typeof SIM!=="undefined"', timeout=15000)
        res['offline_reload_ok'] = await pg.evaluate("typeof SIM.step==='function' && document.querySelectorAll('.hor').length===8")
        res['offline_sim_runs'] = await pg.evaluate('(()=>{const t=SIM.S.t;for(let i=0;i<60;i++)SIM.step();return SIM.S.t!==t;})()')
        res['page_errors'] = errs
        await b.close()
    srv.shutdown()
    passed = all(res[k] for k in ('sw_active', 'manifest_ok', 'icons_ok', 'controlled', 'offline_reload_ok', 'offline_sim_runs')) and res['manifest_link'] == 'manifest.webmanifest' and not errs
    print(json.dumps(res)); print('PWA checks', 'passed' if passed else 'FAILED')
    sys.exit(0 if passed else 1)

asyncio.run(main())

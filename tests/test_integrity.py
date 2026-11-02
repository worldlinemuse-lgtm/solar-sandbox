"""Physical integrity regression checks. Run with python tests/test_integrity.py."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

def main():
    root = Path(__file__).resolve().parent.parent
    with sync_playwright() as pw:
        options = {'headless': True}
        if os.getenv('CHROMIUM_BIN'):
            options['executable_path'] = os.getenv('CHROMIUM_BIN')
        browser = pw.chromium.launch(**options)
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.set_content((root/'index.html').read_text(encoding='utf-8'), wait_until='domcontentloaded')
        missing = page.evaluate("""()=>{
            const S=SIM.S,c=S.cfg;
            S.loads=[{id:'well',name:'Well',short:'Well',w:1000,qty:1,surge:1,volt:240,leg:1,mode:'on',wins:[[0,0]],off:0}];
            c.inv='m24-3000';SIM.cfgChanged(true,true);S.t=180;S.soc=1;
            S.stats={...S.stats,requested:0,unserved:0,served:0,unfitWh:0,unfitMin:0,blackMin:0};
            SIM.step();const p=SIM.dayProfile();return {req:S.live.requested,served:S.live.served,unserved:S.live.unserved,black:S.stats.blackMin,unfit:S.stats.unfitMin,day:p.incompatibleWh,correct:Math.abs(S.live.requested-S.live.served-S.live.unserved)<1e-7};}""")
        assert missing['req']==1000 and missing['served']==0 and missing['unserved']==1000 and missing['black']==1 and missing['unfit']==1 and missing['correct'] and abs(missing['day']-24000)<0.01, missing
        bms = page.evaluate("""()=>{
            const S=SIM.S,c=S.cfg;S.loads=[];c.genOn=true;c.genMode='attended';c.genFuel=0.95;S.genFuelLeft=0.95;
            S.t=840;S.soc=0.2;S.bmsTrip=true;S.genRun=true;S.invTrip=false;S.invLow=false;S.mpptDead=false;
            const start=S.soc;for(let i=0;i<60;i++)SIM.step();return {start,end:S.soc,dc:S.live.genDC};}""")
        assert bms['dc']==0 and bms['end']<=bms['start'], bms
        manual = page.evaluate("""()=>{
            const S=SIM.S,c=S.cfg;S.loads=[];S.bmsTrip=false;S.invTrip=false;S.invLow=false;S.invOn=true;S.soc=0.15;
            c.genOn=true;c.genMode='manual';c.genFuel=0.95;S.genFuelLeft=0.95;S.genRun=false;S.t=120;
            for(let i=0;i<60;i++)SIM.step();return {running:S.genRun,spent:0.95-S.genFuelLeft};}""")
        assert manual=={'running':False,'spent':0},manual
        page.locator('#genOn').select_option('1')
        page.locator('#genMode').select_option('manual')
        page.locator('#genFuel').fill('0.1')
        page.locator('#genFuel').dispatch_event('change')
        page.locator('#genManual').click()
        stock=page.evaluate("""()=>{
            const S=SIM.S;const old=S.genFuelLeft;for(let i=0;i<240;i++)SIM.step();
            return {spent:old-S.genFuelLeft,left:S.genFuelLeft,running:S.genRun};}""")
        assert 0<stock['spent']<=0.1000001 and not stock['running'] and stock['left']>=0,stock
        assert not errors,errors
        browser.close()
        print('PASS: unmet 240V service, BMS isolation, manual recoil, finite fuel, energy accounting')

if __name__=='__main__':
    main()

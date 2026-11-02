"""Full automated test pass for the v7 sandbox (v6 sections plus v7 sections). Usage: python3 test_v7.py [html path]. Writes test_v7_results.json."""
import asyncio, json, itertools, math, sys, os
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
import tempfile
TMP = tempfile.gettempdir()
PATH = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, '..', 'index.html')
URL = 'file://' + PATH
OUT = os.path.join(HERE, 'test_v7_results.json')

DEFAULT = """()=>{SIM.setPlaying(false);SIM.S.mission=null;SIM.setWeather('tmy');Object.assign(SIM.S.cfg,{soh:100,heatSpeed:'mid',ambF:null,ccc:null,insC:null,termC:null,hor:[0,0,0,0,0,0,0,0],snowRec:true,reserve:0,genOn:false,genStart:20,genStop:80});SIM.S.genRun=false;SIM.S.randomSnow=false;SIM.setBattType('bb100');const c=SIM.S.cfg;c.sysV=24;c.bpar=2;c.bloc='in';c.inv='m24-3000';c.other=0;c.shade=0;
 SIM.setPanelType('r200');c.ser=3;c.par=2;c.nMppt=1;c.mppt='150/35';c.tilt=40;c.az=180;c.mount='auto';c.bifOn=false;
 c.pvMat='cu';c.pvG='10';c.pvFt=50;c.cbMat='cu';c.cbG='6';c.cbFt=5;c.biMat='cu';c.biG='2/0';c.biFt=5;
 SIM.restoreLoads&&SIM.restoreLoads();SIM.cfgChanged(true,true);}"""

# Rebuild the battery's state of charge each minute from the power flows the step reports, and
# check that the AC energy served plus inverter loss equals the inverter's DC input.
BAL = '''(o)=>{const S=SIM.S;S.t=o.day*1440;S.soc=o.soc;S.battT=o.bt;S.lastI=0;S.bmsTrip=false;S.invLow=false;S.invTrip=false;S.heatOn=false;S.coldLock=false;S.ovl=0;
 const B=SIM.BATT;const b0=S.stats.blackMin;let maxErr=0,clampMin=0,acErr=0,chainErr=0,neg=0;const e={pv:0,cbw:0,inv:0,biw:0,heat:0,served:0,invLoss:0,inB:0,outB:0};
 for(let i=0;i<o.days*1440;i++){const s0=S.soc,cap=SIM.capWh();SIM.step();const L=S.live;const P=L.mOut-L.wire.cb-L.invDC-L.wire.bi-L.heatW;
  const sf=s0+(P>0?P*B.eta:P*L.dm/B.eta)/60/cap;if((P<0&&sf<B.floor-1e-9&&s0>=B.floor)||sf>1+1e-9)clampMin++;let s=sf-B.selfM/(30*1440);s=Math.max(0,Math.min(1,s));
  maxErr=Math.max(maxErr,Math.abs(s-S.soc));
  if(L.invDC>0)acErr=Math.max(acErr,Math.abs(L.invDC-L.invLossW-L.served));
  if(L.mOut>L.maxOut+1e-6||L.harvestable>L.pvAvail+1e-6||L.mOut>L.harvestable+1e-6)chainErr++;
  for(const k of ['mOut','invDC','heatW','served','pvAvail'])if(L[k]<-1e-9)neg++;
  e.pv+=L.mOut/60;e.cbw+=L.wire.cb/60;e.inv+=L.invDC/60;e.biw+=L.wire.bi/60;e.heat+=L.heatW/60;e.served+=L.served/60;e.invLoss+=(L.invDC>0?L.invLossW:0)/60;if(P>0)e.inB+=P/60;else e.outB-=P/60;}
 const closure=e.pv-e.cbw-e.inv-e.biw-e.heat-(e.inB-e.outB);
 return {maxSocErr:maxErr,clampMin,acErrW:acErr,chainErr,neg,closureWh:+closure.toFixed(6),pvKWh:+(e.pv/1000).toFixed(2),servedKWh:+(e.served/1000).toFixed(2),invLossKWh:+(e.invLoss/1000).toFixed(2),wireKWh:+((e.cbw+e.biw)/1000).toFixed(3),heatKWh:+(e.heat/1000).toFixed(3),blackMin:S.stats.blackMin-b0,soc:+S.soc.toFixed(3)};}'''

# Run a fixed steady load for N minutes from a given state and report what happened.
RUN = '''(o)=>{const S=SIM.S;const c=SIM.S.cfg;Object.assign(c,o.cfg||{});if(o.batt)SIM.setBattType(o.batt);Object.assign(c,o.cfg||{});
 S.loads=(o.loads||[]).map((l,i)=>Object.assign({id:'t'+i,name:'Test '+i,short:'T'+i,qty:1,surge:1,mode:'on',wins:[[0,0]],cyc:null,thermo:null,chg:null,off:0,basis:''},l));
 SIM.cfgChanged(true,true);S.t=o.t;S.soc=o.soc;S.battT=o.bt;S.lastI=0;S.bmsTrip=false;S.invLow=false;S.invTrip=false;S.heatOn=false;S.coldDis=false;S.coldLock=o.bt<(SIM.BATT.chgMinC??-99);S.ovl=0;S.mission=null;
 const s0=JSON.parse(JSON.stringify(S.stats));const tr=[];let firstTrip=-1,heatMin=0,coldBlockMin=0,coldRiskMin=0,chgMin=0,disMin=0,maxBattT=-99;
 for(let i=0;i<o.min;i++){SIM.step();const L=S.live;if(firstTrip<0&&(L.unserved>0))firstTrip=i;if(L.heatW>0)heatMin++;if(L.coldBlock)coldBlockMin++;if(L.coldRisk)coldRiskMin++;
  const P=L.mOut-L.wire.cb-L.invDC-L.wire.bi-L.heatW;if(P>1)chgMin++;if(P<-1)disMin++;maxBattT=Math.max(maxBattT,S.battT);}
 const d={};for(const k in S.stats)if(typeof S.stats[k]==='number'&&k!=='startT')d[k]=+(S.stats[k]-(s0[k]||0)).toFixed(3);
 return {keys:Object.keys(S).filter(k=>typeof S[k]!=='object'),firstUnservedMin:firstTrip,heatMin,coldBlockMin,coldRiskMin,chargeMin:chgMin,dischargeMin:disMin,battT:+S.battT.toFixed(2),maxBattT:+maxBattT.toFixed(2),soc:+S.soc.toFixed(4),stats:d,inv:SIM.S.cfg.inv,log:S.log.slice(0,4).map(x=>x.msg)};}'''


def find_hour(tmy, cond):
    for h, v in enumerate(tmy):
        if cond(h, v):
            return h
    return None


async def main():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        await pg.evaluate(DEFAULT)

        # ---------- 1. regression: pack-cost optimiser vs brute force ----------
        bad = []
        cat = await pg.evaluate('({P:SIM.PANELS.map(p=>[p.id,p.tiers]),B:SIM.BATTS.map(b=>[b.id,b.tiers])})')
        n_cases = 0
        for kind in ('P', 'B'):
            for pid, tiers in cat[kind]:
                for n in range(1, 33):
                    n_cases += 1
                    got = await pg.evaluate('([n,t])=>SIM.buyCost(n,t)', [n, tiers])
                    best = None
                    for combo in itertools.product(*[range(0, n // k + 2) for k, _ in tiers]):
                        q = sum(c * k for c, (k, _) in zip(combo, tiers))
                        if q < n: continue
                        cst = sum(cnt * pr for cnt, (k, pr) in zip(combo, tiers))
                        if best is None or cst < best - 1e-6: best = cst
                    if abs(best - got['cost']) > 0.005 or got['bought'] < n: bad.append((pid, n))
        res['buyCost'] = {'cases': n_cases, 'mismatches': bad[:5]}
        res['default_cost'] = await pg.evaluate('()=>({total:+SIM.totalCost().toFixed(2),shown:document.getElementById("qCost").textContent})')

        # ---------- 2. inverter loss curve: peak efficiency and zero-load draw match each datasheet ----------
        res['inverter_curves'] = await pg.evaluate('''()=>SIM.INVS.map(I=>{let best=0,at=0;for(let P=1;P<=I.c25;P+=1){const e=P/(P+SIM.PHYS.invLoss(I,P));if(e>best){best=e;at=P;}}
          return {id:I.id,datasheetEff:I.eff,modelPeakEff:+best.toFixed(4),peakAtW:at,idle:I.idle,model0:SIM.PHYS.invLoss(I,0),effAtFull:+(I.c25/(I.c25+SIM.PHYS.invLoss(I,I.c25))).toFixed(4),effAt10pct:+(0.1*I.c25/(0.1*I.c25+SIM.PHYS.invLoss(I,0.1*I.c25))).toFixed(4)}})''')

        # ---------- 3. wire resistance table: NEC values vs resistivity physics ----------
        wire = await pg.evaluate('SIM.PHYS.WIRE')
        mm2 = await pg.evaluate('SIM.PHYS.MM2')
        res['wire_table'] = {'gauges': {k: len(v) for k, v in wire.items()}, 'mm2_known': bool(mm2)}
        # independent: R(75C) per kft = rho75 / area. Cu rho20=1.7241e-8 (IACS), alpha 0.00393; Al (1350) rho20=2.8264e-8, alpha 0.00403.
        # Stranded conductors add about 2% (lay length), NEC Table 8 values reflect that.
        circ = {'14': 4110, '12': 6530, '10': 10380, '8': 16510, '6': 26240, '4': 41740, '3': 52620, '2': 66360, '1': 83690,
                '1/0': 105600, '2/0': 133100, '3/0': 167800, '4/0': 211600}
        dev = []
        for mat, rho20, al in (('cu', 1.7241e-8, 0.00393), ('al', 2.8264e-8, 0.00403)):
            for g, (r, amp) in wire[mat].items():
                if g not in circ: continue
                area = circ[g] * 5.067e-10  # cmil -> m^2
                rk = rho20 * (1 + al * 55) / area * 304.8 * 1.02
                dev.append((mat, g, r, round(rk, 4), round((r / rk - 1) * 100, 2)))
        res['wire_table']['max_dev_pct_vs_physics'] = max(abs(d[4]) for d in dev)
        res['wire_table']['rows'] = dev

        # ---------- 4. wiring report vs independent voltage-drop math ----------
        await pg.evaluate(DEFAULT)
        wr = await pg.evaluate('()=>({w:SIM.wiringReport(),c:SIM.S.cfg,isc:SIM.PANEL.isc,amps:SIM.MPPTS.find(m=>m.id===SIM.S.cfg.mppt).amps})')
        c = wr['c']; w = wr['w']
        r_pv = wire[c['pvMat']][c['pvG']][0] * 2 * c['pvFt'] / 1000
        res['wiring_report'] = {'report': w, 'cfg': {k: c[k] for k in ('pvMat', 'pvG', 'pvFt', 'cbG', 'cbFt', 'biG', 'biFt')}, 'pv_loop_ohm_at_75C': round(r_pv, 4)}

        # ---------- 5. energy balance across every battery, both locations, January and July weeks ----------
        bal = []
        for bid, _ in cat['B']:
            for loc in ('in', 'shed'):
                for day, bt in ((10, -8), (190, 25)):
                    await pg.evaluate(DEFAULT)
                    await pg.evaluate('([id,loc])=>{SIM.setBattType(id);SIM.S.cfg.bloc=loc;SIM.cfgChanged(true,true);}', [bid, loc])
                    r = await pg.evaluate(BAL, {'day': day, 'days': 7, 'soc': 0.8, 'bt': bt if loc == 'shed' else 18})
                    r.update({'id': bid, 'loc': loc, 'day': day, 'sysV': await pg.evaluate('SIM.S.cfg.sysV'), 'inv': await pg.evaluate('SIM.S.cfg.inv')})
                    bal.append(r)
        # bifacial on, glued mount, aluminium wire, long runs, 2 controllers
        await pg.evaluate(DEFAULT)
        await pg.evaluate("()=>{SIM.setPanelType('r400');const c=SIM.S.cfg;c.bifOn=true;c.mount='glued';c.pvMat='al';c.pvG='6';c.pvFt=150;c.cbMat='al';c.cbG='4';c.cbFt=12;SIM.cfgChanged(true,true);}")
        r = await pg.evaluate(BAL, {'day': 40, 'days': 7, 'soc': 0.5, 'bt': 18}); r.update({'id': 'r400 bifacial, Al wire'}); bal.append(r)
        res['balance'] = bal
        # full year, default build
        await pg.evaluate(DEFAULT)
        res['balance_year'] = await pg.evaluate(BAL, {'day': 0, 'days': 365, 'soc': 1, 'bt': 18})

        # ---------- 6. battery temperature and BMS edge cases ----------
        tmy = await pg.evaluate('SIM.WX.ta?Array.from(SIM.WX.ta):null')
        res['wx_len'] = len(tmy) if tmy else None
        # a cold sunny January midday and a very cold night
        cold_noon = find_hour(tmy, lambda h, v: (h // 24) < 60 and h % 24 == 9 and v < -8)
        edge = {}
        sun = [{'w': 60}]
        base = {'sysV': 12, 'bpar': 2, 'bloc': 'shed', 'inv': 'p12-1200', 'ser': 1, 'par': 4, 'nMppt': 1, 'mppt': '150/35'}
        await pg.evaluate(DEFAULT)
        await pg.evaluate("SIM.setPanelType('r200')")
        for bid, bt in (('lt100', -10), ('bb100', -3.3), ('bb100', -4.5), ('agm100', -10), ('lt230', -10), ('lth100', -10)):
            edge[f'{bid}@{bt}C'] = await pg.evaluate(RUN, {'batt': bid, 'cfg': base, 't': cold_noon * 60, 'soc': 0.5, 'bt': bt, 'min': 180, 'loads': sun})
        # discharge cutoff at -4F for the 230 Ah, a night with a load
        night = find_hour(tmy, lambda h, v: h % 24 == 2 and v < -12)
        for bt in (-21, -19):
            edge[f'lt230 discharge@{bt}C'] = await pg.evaluate(RUN, {'batt': 'lt230', 'cfg': base, 't': night * 60, 'soc': 0.8, 'bt': bt, 'min': 20, 'loads': [{'w': 100}]})
        edge['lt100 discharge@-21C'] = await pg.evaluate(RUN, {'batt': 'lt100', 'cfg': base, 't': night * 60, 'soc': 0.8, 'bt': -21, 'min': 20, 'loads': [{'w': 100}]})
        res['edge_battery'] = {'cold_noon_hour': cold_noon, 'night_hour': night, 'cases': edge}

        # ---------- 7. inverter limits: Phoenix 12/800 continuous, time-limited, peak, surge ----------
        inv = {}
        night_mild = find_hour(tmy, lambda h, v: h % 24 == 1 and 15 < v < 20)
        ib = {'sysV': 12, 'bpar': 4, 'bloc': 'in', 'inv': 'p12-800'}
        for name, loads in (('780 W steady', [{'w': 780}]), ('850 W steady', [{'w': 850}]), ('900 W steady', [{'w': 900}]),
                            ('950 W steady', [{'w': 950}]), ('600 W, 2x start surge (1200 W)', [{'w': 600, 'surge': 2, 'mode': 'auto', 'wins': [[62, 150]]}]), ('650 W, 2x start surge (1300 W)', [{'w': 650, 'surge': 2, 'mode': 'auto', 'wins': [[62, 150]]}])):
            inv[name] = await pg.evaluate(RUN, {'batt': 'bb100', 'cfg': ib, 't': night_mild * 60, 'soc': 1.0, 'bt': 18, 'min': 90, 'loads': loads})
        # hot shed: 104F+ derating
        hot = find_hour(tmy, lambda h, v: v >= 31)
        inv['720 W steady, shed at hottest hour'] = await pg.evaluate(RUN, {'batt': 'bb100', 'cfg': dict(ib, bloc='shed'), 't': hot * 60, 'soc': 1.0, 'bt': 30, 'min': 5, 'loads': [{'w': 720}]})
        inv['hot_hour'] = hot; inv['hot_temp_C'] = tmy[hot] if hot is not None else None
        res['edge_inverter'] = inv

        # ---------- 8. tilt / azimuth response (sun on the panels) ----------
        await pg.evaluate(DEFAULT)
        res['tilt_az'] = await pg.evaluate('''()=>{const out=[];const c=SIM.S.cfg;for(const [t,a] of [[0,180],[20,180],[40,180],[60,180],[90,180],[40,90],[40,270],[40,135]]){c.tilt=t;c.az=a;SIM.cfgChanged(false);
           const h=SIM.pvHourly();let yr=0,jan=0,jul=0;for(let i=0;i<8760;i++){const e=h.eff?h.eff[i]:h[i];yr+=e;if(i<744)jan+=e;if(i>=4344&&i<5088)jul+=e;}out.push({tilt:t,az:a,yearKWhm2:+(yr/1000).toFixed(1),janKWhm2:+(jan/1000).toFixed(1),julKWhm2:+(jul/1000).toFixed(1)});}
           c.tilt=40;c.az=180;SIM.cfgChanged(false);return out;}''')

        # ---------- 9. missions with the default build ----------
        await pg.evaluate(DEFAULT)
        ms = []
        for i in range(await pg.evaluate('SIM.MISSIONS.length')):
            await pg.evaluate(DEFAULT)
            ms.append(await pg.evaluate('''(i)=>{const S=SIM.S;const m=SIM.MISSIONS[i];SIM.startMission(m);let n=0;const remap=!!SIM.REMAP;while(S.mission&&n<40*1440){SIM.step();n++;}
              return {name:m.name,minutes:n,remap,blackMin:S.stats.blackMin,minSoc:+S.stats.minSoc.toFixed(3),faults:S.stats.faults,pvKWh:+(S.stats.pvIn/1000).toFixed(1),servedKWh:+(S.stats.served/1000).toFixed(1),invLossKWh:+(S.stats.invLoss/1000).toFixed(1),remapAfter:!!SIM.REMAP,banner:(document.getElementById('banner')||{}).textContent||''}}''', i))
        res['missions'] = ms
        # worst-week remap content: daily sun in the remapped stretch vs the typical-year days
        res['worst_week'] = await pg.evaluate('''()=>{const m=SIM.MISSIONS.find(x=>/worst|grey|gray|cloud/i.test(x.name+(x.desc||'')));if(!m)return null;SIM.startMission(m);const S=SIM.S;const t0=S.t;const days=[];
           for(let d=0;d<7;d++){let wh=0;for(let k=0;k<1440;k++){SIM.step();wh+=S.live.ghi/60;}days.push(+(wh/1000).toFixed(2));}
           return {name:m.name,startDay:Math.floor(t0/1440),dailyGhiKWhm2:days};}''')
        await pg.evaluate("()=>{SIM.S.mission=null;}")

        # ---------- 10. persistence: save, change, load; reload; export/import; bad files ----------
        await pg.evaluate(DEFAULT)
        await pg.evaluate("()=>{const c=SIM.S.cfg;SIM.setPanelType('r400');c.tilt=55;c.az=200;c.mount='roof';c.bifOn=true;c.pvG='8';c.pvFt=80;c.other=321;SIM.S.loads[0].w=77;SIM.S.loads[0].qty=3;SIM.cfgChanged(true,true);}")
        snap = await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})')
        await pg.click('.tabs button[data-tab="build"]')
        await pg.click('#saveB'); note1 = await pg.text_content('#saveNote')
        await pg.evaluate(DEFAULT)
        changed = await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})') != snap
        await pg.click('#loadB'); note2 = await pg.text_content('#saveNote')
        after_load = await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})')
        # Compare as data, not as strings: the loader rebuilds each appliance with its keys in a fixed
        # order, so the JSON text can differ in key order while every value is identical.
        same_after_load = json.loads(after_load) == json.loads(snap)
        _i = next((k for k in range(min(len(snap), len(after_load))) if snap[k] != after_load[k]), None if len(snap) == len(after_load) else min(len(snap), len(after_load)))
        first_str_diff = None if _i is None else {'at': _i, 'before': snap[max(0, _i-160):_i+120], 'after': after_load[max(0, _i-160):_i+120]}
        same_after_load_parsed = json.loads(after_load) == json.loads(snap)
        A, Bq = json.loads(snap), json.loads(after_load)
        load_diff = [('cfg', k, A['c'].get(k), Bq['c'].get(k)) for k in set(A['c']) | set(Bq['c']) if A['c'].get(k) != Bq['c'].get(k)]
        load_diff += [('load', x.get('id'), k, x.get(k), y.get(k)) for x, y in zip(A['l'], Bq['l']) for k in set(x) | set(y) if x.get(k) != y.get(k)]
        if len(A['l']) != len(Bq['l']): load_diff.append(('nloads', len(A['l']), len(Bq['l'])))
        ui_after = await pg.evaluate("()=>({tilt:document.getElementById('tilt').value,ptype:document.getElementById('ptype').value,bif:getComputedStyle(document.getElementById('bifRow')).display,pvG:document.getElementById('pvG').value})")
        # reload page, load from storage
        await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate('SIM.setPlaying(false)')
        await pg.click('.tabs button[data-tab="build"]')
        await pg.click('#loadB')
        same_after_reload = json.loads(await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})')) == json.loads(snap)
        # export through the real button
        async with pg.expect_download() as dl:
            await pg.click('#exportB')
        d = await dl.value; ep = os.path.join(TMP, 'solar-build-export.json'); await d.save_as(ep)
        exp = json.load(open(ep))
        await pg.evaluate(DEFAULT)
        await pg.set_input_files('#importF', ep); await pg.wait_for_timeout(400)
        same_after_import = json.loads(await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})')) == json.loads(snap)
        note3 = await pg.text_content('#saveNote')
        # bad files leave the build untouched
        bads = {}
        before = await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})')
        broken = dict(exp); broken_cfg = dict(exp['cfg']); broken_cfg['panel'] = 'nope'; broken['cfg'] = broken_cfg
        evil = json.loads(json.dumps(exp)); evil['loads'][0]['name'] = '<img src=x onerror=alert(1)>'; evil['cfg']['tilt'] = 9999; evil['cfg']['ser'] = -5
        badload = json.loads(json.dumps(exp)); badload['loads'][0]['wins'] = 'x'
        for name, content in (('not json', 'hello'), ('other app', json.dumps({'app': 'x'})), ('unknown part', json.dumps(broken)), ('bad appliance', json.dumps(badload))):
            fp = os.path.join(TMP, f'bad_{name.replace(" ", "_")}.json'); open(fp, 'w').write(content)
            await pg.set_input_files('#importF', fp); await pg.wait_for_timeout(300)
            bads[name] = {'note': await pg.text_content('#saveNote'), 'unchanged': await pg.evaluate('JSON.stringify({c:SIM.S.cfg,l:SIM.S.loads})') == before}
        fp = os.path.join(TMP, 'evil.json'); open(fp, 'w').write(json.dumps(evil))
        await pg.set_input_files('#importF', fp); await pg.wait_for_timeout(300)
        ev = await pg.evaluate("()=>({tilt:SIM.S.cfg.tilt,ser:SIM.S.cfg.ser,name:SIM.S.loads[0].name,imgs:document.querySelectorAll('.load img').length})")
        res['persistence'] = {'save_note': note1, 'changed_before_load': changed, 'load_note': note2, 'same_after_load': same_after_load, 'same_after_load_text_identical': after_load == snap, 'first_str_diff': first_str_diff, 'load_diff': load_diff[:8], 'ui_after_load': ui_after,
                              'same_after_reload': same_after_reload, 'export_keys': sorted(exp.keys()), 'export_version': exp.get('version'), 'same_after_import': same_after_import,
                              'import_note': note3, 'bad_files': bads, 'clamped_and_escaped': ev}

        # ---------- 11. UI controls through real inputs ----------
        await pg.evaluate(DEFAULT)
        await pg.click('.tabs button[data-tab="build"]')
        e0 = await pg.evaluate('SIM.pvHourly().eff.reduce((a,b)=>a+b,0)')
        await pg.fill('#tilt', '70'); await pg.dispatch_event('#tilt', 'change'); await pg.wait_for_timeout(100)
        await pg.fill('#az', '250'); await pg.dispatch_event('#az', 'change'); await pg.wait_for_timeout(100)
        e1 = await pg.evaluate('SIM.pvHourly().eff.reduce((a,b)=>a+b,0)')
        ui1 = await pg.evaluate("()=>({tilt:SIM.S.cfg.tilt,az:SIM.S.cfg.az,label:document.getElementById('azV').textContent})")
        await pg.select_option('#mount', 'glued'); m1 = await pg.evaluate('SIM.mountUsed()')
        bif_r200 = await pg.evaluate("getComputedStyle(document.getElementById('bifRow')).display")
        await pg.select_option('#ptype', 'r400'); await pg.wait_for_timeout(150)
        bif_r400 = await pg.evaluate("getComputedStyle(document.getElementById('bifRow')).display")
        f0 = await pg.evaluate('SIM.pvHourly().eff.reduce((a,b)=>a+b,0)')
        await pg.select_option('#bifOn', '1'); await pg.wait_for_timeout(100)
        f1 = await pg.evaluate('SIM.pvHourly().eff.reduce((a,b)=>a+b,0)')
        await pg.select_option('#pvMat', 'al'); await pg.wait_for_timeout(100)
        al = await pg.evaluate("()=>({mat:SIM.S.cfg.pvMat,g:SIM.S.cfg.pvG,opts:[...document.getElementById('pvG').options].map(o=>o.value)})")
        await pg.select_option('#pvG', '4'); await pg.fill('#pvFt', '120'); await pg.dispatch_event('#pvFt', 'change'); await pg.wait_for_timeout(100)
        wn = await pg.evaluate("()=>({g:SIM.S.cfg.pvG,ft:SIM.S.cfg.pvFt,note:document.getElementById('pvWireNote').textContent,checks:[...document.querySelectorAll('#checks li, #checkList li')].map(l=>l.textContent).filter(t=>/Panel cable/.test(t))})")
        src = await pg.evaluate("()=>{const u=document.getElementById('srcParts');return u?{items:u.children.length,links:u.querySelectorAll('a').length,first:u.children[0]&&u.children[0].textContent.slice(0,140)}:null}")
        res['ui_controls'] = {'tilt_az': ui1, 'pv_change_pct': round((e1 / e0 - 1) * 100, 1), 'mount_used': m1, 'bif_row_r200': bif_r200, 'bif_row_r400': bif_r400,
                              'bifacial_gain_pct': round((f1 / f0 - 1) * 100, 1), 'aluminum': al, 'wire_after': wn, 'sources_list': src}

        await run_new_sections(pg, res, DEFAULT, RUN, BAL, find_hour)
        await run_v7_sections(pg, res, DEFAULT)
        await run_v8_sections(pg, res, DEFAULT)
        if os.environ.get('SKIP_WINTERS') != '1':
            res['longi_25_winters'] = await run_longi_winters(pg, DEFAULT)
            res['longi_25_winters_v8'] = await run_v8_winters(pg, DEFAULT)
            ag = res['aging_longi'] = await run_aging(pg, DEFAULT)
            rows = (ag.get('o') or {}).get('rows') or []
            run_rows = [r for r in rows if not r['past']]
            res['asserts']['aging_run'] = dict(passed=not ag['why'] and ag['restored'] and abs(ag['sohAfter'] - 0.9) < 1e-9 and len(rows) == 3
                and ag['o']['days'] == 365 and all(rows[i]['soh'] > rows[i + 1]['soh'] for i in range(2))
                and all(r['n'] == 25 for r in run_rows) and all(run_rows[i]['medH'] <= run_rows[i + 1]['medH'] + 1e-9 for i in range(len(run_rows) - 1)),
                why=ag['why'], restored=ag['restored'])
            au = res['aging_ui_agm'] = await run_aging_ui(pg, DEFAULT)
            res['asserts']['aging_ui'] = dict(passed=au['prog'] == 'Done.' and au['batt'] == 'agm100' and au['rows'] and len(au['rows']) == 3
                and ('Renogy' in au['text']) and (au['buttons'] == 0 or (au['slider'] == au['pick'] == au['cfg'] and au['label'] == f"{au['pick']}%"))
                and all(r['past'] == (r['soh'] < 0.6) for r in au['rows']), prog=au['prog'], buttons=au['buttons'])

        # ---------- 12. layout on a phone: overflow and overlaps, light and dark ----------
        await pg.evaluate(DEFAULT)
        for scheme in ('light', 'dark'):
            await pg.emulate_media(color_scheme=scheme)
            for tab in ('build', 'loads', 'missions', 'score'):
                sel = f'.tabs button[data-tab="{tab}"]'
                if await pg.query_selector(sel): await pg.click(sel)
                await pg.wait_for_timeout(150)
                ov = await pg.evaluate('''()=>{const W=document.documentElement.clientWidth;const bad=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width>0&&r.right>W+1&&getComputedStyle(e).position!=='fixed')bad.push((e.id||e.tagName)+':'+Math.round(r.right));});
                   const rows=[...document.querySelectorAll('.row')].filter(r=>r.offsetParent);let ol=0;rows.forEach(r=>{const kids=[...r.children];for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){const a=kids[i].getBoundingClientRect(),b=kids[j].getBoundingClientRect();if(a.width&&b.width&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)ol++;}});
                   return {W,sw:document.documentElement.scrollWidth,bad:bad.slice(0,6),overlaps:ol}}''')
                res[f'layout_{scheme}_{tab}'] = ov
                await pg.screenshot(path=os.path.join(TMP, f'layout_{scheme}_{tab}.png'), full_page=True)
        gd = await pg.evaluate('''()=>new Promise(ok=>{const a=document.getElementById('gAudio');const r=()=>ok({dur:a.duration,label:document.getElementById('gTime').textContent,
            note:!!document.getElementById('gNote'),outdated:/doesn.t cover|outdated/i.test(document.getElementById('guide').parentElement.innerText.slice(0,2000))});
            if(a.readyState>=1&&isFinite(a.duration))return r();a.addEventListener('loadedmetadata',r,{once:true});a.load();setTimeout(r,10000);})''')
        res.setdefault('asserts', {})['voice_guide_current'] = dict(gd, passed=abs((gd['dur'] or 0) - 143.28) < 0.5 and not gd['note'] and not gd['outdated'] and gd['label'] in ('2:23', '0:00 / 2:23'))
        lay = {k: v for k, v in res.items() if k.startswith('layout_')}
        res.setdefault('asserts', {})['phone_layout_light_dark'] = dict(
            views=len(lay), passed=len(lay) == 8 and all(v['sw'] <= v['W'] and not v['bad'] and v['overlaps'] == 0 for v in lay.values()))
        res['errors'] = errs
        await b.close()
    json.dump(res, open(OUT, 'w'), indent=1)
    A = res.get('asserts', {})
    bad = [k for k, v in A.items() if not v.get('passed')]
    print('written', OUT)
    print(f"{len(A) - len(bad)} of {len(A)} checks passed; page errors: {len(res.get('errors', []))}")
    for k in bad: print('FAILED', k, json.dumps(A[k])[:600])
    if bad or res.get('errors'): sys.exit(1)

from test_v6_sections import run_new_sections
from test_v7_sections import run_v7_sections, run_longi_winters
from test_v8_sections import run_v8_sections, run_v8_winters, run_aging, run_aging_ui
if __name__ == "__main__":
    asyncio.run(main())

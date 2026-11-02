"""v8 test sections: horizon shading, recorded snow on the panels (checked against pvlib's NREL snow model), the battery
reserve, and the Honda EU2200i generator with fuel per winter. Each check adds a pass/fail entry to res['asserts']."""
import math

GEN = dict(w=1800, max=2200, tank=0.95, rated_h=3.2, quarter_h=8.1)  # Honda EU2200i product page, read Oct 31, 2026

RUNG = '''(o)=>{const S=SIM.S,c=S.cfg;Object.assign(c,o.cfg||{});
 S.loads=(o.loads||[]).map((l,i)=>Object.assign({id:'g'+i,name:'Test '+i,short:'T'+i,qty:1,surge:1,mode:'on',wins:[[0,0]],cyc:null,thermo:null,chg:null,off:0,basis:'',volt:120,leg:1},l));
 SIM.cfgChanged(true,true);S.t=o.t;S.soc=o.soc;S.battT=20;S.lastI=0;S.bmsTrip=false;S.invLow=false;S.invTrip=false;S.heatOn=false;S.coldDis=false;S.coldLock=false;S.ovl=0;S.overMin=0;S.mission=null;S.prevOn={};S.invOn=true;S.genRun=false;S.snow=0;
 const s0=JSON.parse(JSON.stringify(S.stats));const tr=[];let maxErr=0,acErr=0,genMin=0,genAC=0,genDC=0,dark=0,served=0;const B=SIM.BATT;
 for(let i=0;i<o.min;i++){const sA=S.soc,cap=SIM.capWh();SIM.step();const L=S.live;
  const P=L.mOut-L.wire.cb-L.invDC-L.wire.bi-L.heatW+L.genDC;const sf=sA+(P>0?P*B.eta:P*L.dm/B.eta)/60/cap;let s=sf-B.selfM/(30*1440);s=Math.max(0,Math.min(1,s));maxErr=Math.max(maxErr,Math.abs(s-S.soc));
  if(L.invDC>0)acErr=Math.max(acErr,Math.abs(L.invDC-L.invLossW-(L.served-L.genAC)));
  if(L.genRun){genMin++;genAC+=L.genAC/60;genDC+=L.genDC/60;}if(L.unserved>0)dark++;served+=L.served/60;if(i%o.every===0)tr.push([+S.soc.toFixed(4),L.genRun?1:0]);}
 const d=k=>+((S.stats[k]||0)-(s0[k]||0)).toFixed(4);
 return {tr,maxErr,acErr,genMin,genAC,genDC,dark,served,gal:d('genGal'),statMin:d('genMin'),starts:d('genStarts'),statAC:d('genACWh'),statDC:d('genDCWh'),soc:S.soc,log:S.log.slice(0,4).map(x=>x.msg)};}'''


async def run_v8_sections(pg, res, DEFAULT):
    A = res.setdefault('asserts', {})

    def ok(name, cond, **info):
        A[name] = dict(info, passed=bool(cond))

    ev = pg.evaluate

    # ---------- 15a. horizon: physics ----------
    await ev(DEFAULT)
    h = await ev('''()=>{const W=SIM.WX_TMY,m=SIM.mountUsed(),base={tilt:40,az:180,mount:m,bif:0,rearLoss:0};
      const a=SIM.PHYS.hourly(W,base),z=SIM.PHYS.hourly(W,Object.assign({},base,{hor:[0,0,0,0,0,0,0,0]}));let d0=0;for(let i=0;i<a.poa.length;i++)d0=Math.max(d0,Math.abs(a.poa[i]-z.poa[i]));
      const zero=k=>Array.from(W[k],()=>0);
      const Wd=Object.assign({},W,{dn:zero('dn'),alb:zero('alb')});const d1=SIM.PHYS.hourly(Wd,base),d2=SIM.PHYS.hourly(Wd,Object.assign({},base,{hor:[60,60,60,60,60,60,60,60]}));let s1=0,s2=0;for(let i=0;i<d1.poa.length;i++){s1+=d1.poa[i];s2+=d2.poa[i];}
      const Wb=Object.assign({},W,{df:zero('df'),alb:zero('alb')});const b1=SIM.PHYS.hourly(Wb,base),b2=SIM.PHYS.hourly(Wb,Object.assign({},base,{hor:[30,30,30,30,30,30,30,30]}));
      const day=(arr,doy)=>{let s=0;for(let i=(doy-1)*24;i<doy*24;i++)s+=arr[i];return s;};
      return {d0,ratio:s2/s1,dec_open:day(b1.poa,355),dec_hill:day(b2.poa,355),jun_open:day(b1.poa,172),jun_hill:day(b2.poa,172)};}''')
    ok('horizon_physics', h['d0'] == 0 and abs(h['ratio'] - 0.25) < 1e-4 and h['dec_open'] > 1000 and h['dec_hill'] < 0.02 * h['dec_open'] and h['jun_hill'] < h['jun_open'] and h['jun_hill'] > 0.6 * h['jun_open'],
       zero_horizon_max_diff=h['d0'], diffuse_only_ratio_all_60deg=round(h['ratio'], 5), expected_ratio=round(1 - math.sin(math.radians(60)) ** 2, 5),
       dec21_beam_open_Wh=round(h['dec_open']), dec21_beam_30deg_all_round_Wh=round(h['dec_hill'], 1), jun21_beam_open_Wh=round(h['jun_open']), jun21_beam_hill_Wh=round(h['jun_hill']))

    # ---------- 15b. horizon: through the sim, the worst-stretch finder, and save/load ----------
    await ev(DEFAULT)
    hs = await ev('''()=>{const S=SIM.S,c=S.cfg;const jan=()=>{const h=SIM.pvHourly();let s=0;for(let i=0;i<31*24;i++)s+=h.eff[i];return s;};
      const a=jan();c.hor=[0,0,0,10,20,10,0,0];SIM.cfgChanged(true);const b=jan();
      const p=SIM.buildPayload();const back=SIM.cleanState?null:null;const ui=[...document.querySelectorAll('.hor')].map(e=>+e.value);
      c.hor=[0,0,0,0,0,0,0,0];SIM.cfgChanged(true);const r=SIM.applyPayload(p);const after=S.cfg.hor.slice();const ui2=[...document.querySelectorAll('.hor')].map(e=>+e.value);
      return {janOpen:a,janHill:b,ui,after,ui2,err:typeof r==='string'?r:null};}''')
    ok('horizon_in_sim', hs['janHill'] < hs['janOpen'] * 0.98 and hs['ui'] == [0, 0, 0, 10, 20, 10, 0, 0] and hs['after'] == [0, 0, 0, 10, 20, 10, 0, 0] and hs['ui2'] == hs['after'],
       jan_open_Wh_per_m2=round(hs['janOpen']), jan_with_hills_Wh_per_m2=round(hs['janHill']), drop_pct=round(100 * (1 - hs['janHill'] / hs['janOpen']), 1), saved_and_loaded=hs['after'])

    # ---------- 15c. snow: the sim's coverage against pvlib.snow.coverage_nrel on the same inputs ----------
    await ev(DEFAULT)
    sn = await ev('''()=>{const S=SIM.S,c=S.cfg;SIM.setWeather('w2010');c.snowRec=true;SIM.cfgChanged(true);S.loads=[];SIM.cfgChanged(true);
      S.t=304*1440;S.soc=1;S.snow=0;S.mission=null;S.blastLeft=0;const s0=S.stats.snowDays||0;const cov=[],poa=[],ta=[],trig=[];let pvWhileCovered=0,maxPv=0;
      for(let i=0;i<120*1440;i++){const d0=S.stats.snowDays||0;SIM.step();const L=S.live;cov.push(S.snow);poa.push(L.poa);ta.push(L.ta);trig.push((S.stats.snowDays||0)>d0?1:0);if(S.snow>=0.999&&L.pvAvail>pvWhileCovered)pvWhileCovered=L.pvAvail;}
      const days=(S.stats.snowDays||0)-s0;SIM.setWeather('tmy');return {cov,poa,ta,trig,days,pvWhileCovered,tilt:c.tilt,sf:SNOWHIST.w['2010'].sf};}''')
    import numpy as np, pandas as pd
    try:
        import pvlib
        idx = pd.date_range('2010-11-01', periods=len(sn['cov']), freq='1min')
        snowfall = pd.Series(np.array(sn['trig'], float), index=idx)  # 1 cm in the trigger minute (rate 60 cm/h, above pvlib's 1 cm/h threshold)
        ref = pvlib.snow.coverage_nrel(snowfall, pd.Series(sn['poa'], index=idx), pd.Series(sn['ta'], index=idx), sn['tilt'], initial_coverage=0, threshold_snowfall=1.0, can_slide_coefficient=-80., slide_amount_coefficient=0.197)
        diff = float(np.max(np.abs(ref.values - np.array(sn['cov']))))
        covered_h_sim = float(np.sum(sn['cov']) / 60); covered_h_ref = float(ref.sum() / 60)
        pv_ok = True
    except Exception as e:  # pvlib missing
        diff, covered_h_sim, covered_h_ref, pv_ok = None, float(np.sum(sn['cov']) / 60), None, False
    expect_days = sum(1 for x in sn['sf'] if x is not None and x >= 1)
    one_min_slide = 0.197 * math.sin(math.radians(sn['tilt'])) / 60
    ok('snow_vs_pvlib', pv_ok and diff is not None and diff <= one_min_slide + 1e-6 and sn['days'] == expect_days and sn['pvWhileCovered'] == 0,
       winter='2010-11', snow_days=sn['days'], expected_days_from_nasa_file=expect_days, max_coverage_diff=diff, allowed=round(one_min_slide, 5),
       panel_equiv_covered_hours_sim=round(covered_h_sim, 1), pvlib=round(covered_h_ref, 1) if covered_h_ref else None, pv_while_fully_covered=sn['pvWhileCovered'])

    # snow off: no cover in the same winter; typical year never uses it
    await ev(DEFAULT)
    so = await ev('''()=>{const S=SIM.S,c=S.cfg;SIM.setWeather('w2010');c.snowRec=false;SIM.cfgChanged(true);S.t=304*1440;S.snow=0;S.mission=null;let mx=0;for(let i=0;i<30*1440;i++){SIM.step();mx=Math.max(mx,S.snow);}
      SIM.setWeather('tmy');c.snowRec=true;SIM.cfgChanged(true);S.t=0;S.snow=0;let my=0;for(let i=0;i<60*1440;i++){SIM.step();my=Math.max(my,S.snow);}return {offMax:mx,tmyMax:my};}''')
    ok('snow_off_and_typical_year', so['offMax'] == 0 and so['tmyMax'] == 0, **so)

    # ---------- 15d. battery reserve ----------
    await ev(DEFAULT)
    rv = await ev(RUNG, {'cfg': {'reserve': 40}, 't': 2 * 60, 'soc': 0.5, 'min': 600, 'every': 60, 'loads': [{'w': 600}]})
    first_dark_soc = None
    ok_rv = 0.395 <= rv['soc'] <= 0.41 and rv['dark'] > 0 and any('reserve' in m for m in rv['log'])
    await ev(DEFAULT)
    rv0 = await ev(RUNG, {'cfg': {'reserve': 0}, 't': 2 * 60, 'soc': 0.5, 'min': 120, 'every': 60, 'loads': [{'w': 600}]})
    ok('battery_reserve', ok_rv and rv0['dark'] == 0 and rv['maxErr'] < 1e-9, end_soc_with_40pct_reserve=round(rv['soc'], 4), dark_minutes=rv['dark'], log=rv['log'][:2], no_reserve_dark_minutes_first_2h=rv0['dark'])

    # ---------- 15e. generator: Honda's specs, fuel curve, start/stop, energy balance ----------
    gd = await ev('()=>({ds:SIM.GEN_DS,g25:SIM.genGph(450),g100:SIM.genGph(1800),g10:SIM.genGph(100),g60:SIM.genGph(1080)})')
    q, r_ = GEN['tank'] / GEN['quarter_h'], GEN['tank'] / GEN['rated_h']
    mid = q + (r_ - q) * (1080 - 450) / (1800 - 450)
    ok('generator_specs_fuel', gd['ds']['w'] == 1800 and gd['ds']['max'] == 2200 and gd['ds']['tank'] == 0.95 and gd['ds']['rtRated'] == 3.2 and gd['ds']['rtQuarter'] == 8.1
       and abs(gd['g25'] - q) < 1e-9 and abs(gd['g100'] - r_) < 1e-9 and abs(gd['g10'] - q) < 1e-9 and abs(gd['g60'] - mid) < 1e-9,
       gal_per_h_quarter=round(gd['g25'], 4), gal_per_h_rated=round(gd['g100'], 4), gal_per_h_60pct=round(gd['g60'], 4))

    await ev(DEFAULT)
    g = await ev(RUNG, {'cfg': {'genOn': True, 'genStart': 30, 'genStop': 70}, 't': 2 * 60, 'soc': 0.35, 'min': 24 * 60, 'every': 30, 'loads': [{'w': 400}]})
    starts_soc = [g['tr'][i][0] for i in range(1, len(g['tr'])) if g['tr'][i][1] and not g['tr'][i - 1][1]]
    # fuel recomputed from the logged generator energy: AC to the house plus charger input
    ok('generator_run', g['starts'] >= 1 and g['genMin'] == g['statMin'] and g['dark'] == 0 and g['maxErr'] < 1e-9 and g['acErr'] < 1e-6 and g['gal'] > 0
       and abs(g['statDC'] - g['genDC']) < 0.01 and abs(g['statAC'] - g['genAC']) < 0.01 and g['gal'] <= g['genMin'] / 60 * r_ + 1e-3 and g['gal'] >= g['genMin'] / 60 * q - 1e-3,
       starts=g['starts'], dark=g['dark'], statMin=g['statMin'], statAC=g['statAC'], statDC=g['statDC'], run_minutes=g['genMin'], fuel_gal=g['gal'], house_Wh_from_gen=round(g['genAC']), charge_Wh_from_gen=round(g['genDC']), soc_balance_max_err=g['maxErr'], ac_balance_max_err=g['acErr'], log=g['log'][:3])

    # no charger (Phoenix inverter): the generator never runs
    await ev(DEFAULT)
    gp = await ev(RUNG, {'cfg': {'genOn': True, 'inv': 'p12-800', 'sysV': 12}, 't': 2 * 60, 'soc': 0.25, 'min': 120, 'every': 60, 'loads': [{'w': 100}]})
    ok('generator_needs_charger', gp['genMin'] == 0 and gp['gal'] == 0, run_minutes=gp['genMin'])

    # generator line in the bill of materials only when added, as an estimate
    await ev(DEFAULT)
    bl = await ev("()=>{const a=SIM.costLines().some(l=>l.k==='gen');SIM.S.cfg.genOn=true;SIM.cfgChanged(true);const L=SIM.costLines().find(l=>l.k==='gen');SIM.S.cfg.genOn=false;SIM.cfgChanged(true);return {before:a,status:L&&L.status,cost:L&&L.cost}}")
    ok('generator_bom_line', bl['before'] is False and bl['status'] == 'estimated' and bl['cost'] == 1199, **bl)


async def run_v8_winters(pg, DEFAULT):
    """The LONGi preset through the 25 recorded winters with snow on (default), then with the generator added."""
    out = {}
    for label, gen in (('snow_on', False), ('snow_on_generator', True)):
        await pg.evaluate(DEFAULT)
        await pg.evaluate("()=>document.getElementById('resetLoads').click()")
        r = await pg.evaluate('''(o)=>new Promise(res=>{SIM.useMyLongi();const c=SIM.S.cfg;c.bifOn=false;c.snowRec=true;c.genOn=o.gen;c.genStart=20;c.genStop=80;SIM.cfgChanged(true,true);const t0=performance.now();
          SIM.runFailureRates(o.pats,()=>{},(out,why)=>res({why,ms:performance.now()-t0,sums:out.map(x=>({p:x.p,fails:x.fails,n:x.n,ci:x.ci,medH:x.medH,minH:x.minH,maxH:x.maxH,worst:[x.worst.y,x.worst.black],snowDaysMed:x.snowDaysMed,snowDaysMin:x.snowDaysMin,snowDaysMax:x.snowDaysMax,genGalMed:x.genGalMed,genGalMin:x.genGalMin,genGalMax:x.genGalMax,genHMed:x.genHMed}))}));})''', {'gen': gen, 'pats': ['food', 'furnace']})
        out[label] = r
    return out


async def run_aging(pg, DEFAULT):
    """The aging estimate for the LONGi preset (food list, snow on), and that the user's own state comes back unchanged."""
    await pg.evaluate(DEFAULT)
    await pg.evaluate("()=>document.getElementById('resetLoads').click()")
    return await pg.evaluate('''()=>new Promise(res=>{SIM.useMyLongi();const c=SIM.S.cfg;c.bifOn=false;c.snowRec=true;c.genOn=false;c.soh=90;SIM.cfgChanged(true,true);
      const before={cfg:JSON.stringify(SIM.S.cfg),t:SIM.S.t,soc:SIM.S.soc,loads:SIM.S.loads.length};const t0=performance.now();
      SIM.runAging('food',()=>{},(o,why)=>{const after={cfg:JSON.stringify(SIM.S.cfg),t:SIM.S.t,soc:SIM.S.soc,loads:SIM.S.loads.length};
        res({why,ms:performance.now()-t0,restored:JSON.stringify(before)===JSON.stringify(after),sohAfter:SIM.sohF(),
          o:o&&{batt:o.batt,efcYr:o.efcYr,dod:o.dod,life:o.life,days:o.days,rows:o.rows.map(r=>({y:r.y,soh:r.soh,past:!!r.past,fails:r.sum&&r.sum.fails,n:r.sum&&r.sum.n,medH:r.sum&&r.sum.medH,minH:r.sum&&r.sum.minH,maxH:r.sum&&r.sum.maxH}))}});});})''')


async def run_aging_ui(pg, DEFAULT):
    """The aging card through the page's own controls, with the Renogy AGM bank: run, read the results, then press a
    'Set battery health' button and check the slider and the design took it."""
    await pg.evaluate(DEFAULT)
    await pg.evaluate("()=>{document.getElementById('resetLoads').click();SIM.setBattType('agm100');SIM.cfgChanged(true,true);}")
    await pg.evaluate("()=>{const t=document.querySelector('[data-tab=missions]');if(t)t.click();}")
    await pg.click('#ageGo')
    await pg.wait_for_function("()=>/^(Done\\.|Stopped|Your design|No published)/.test(document.getElementById('ageProg').textContent)", timeout=600000)
    r = await pg.evaluate('''()=>{const o=document.getElementById('ageOut');const btn=o.querySelector('.ageUse');const out={prog:document.getElementById('ageProg').textContent,
      text:o.innerText.slice(0,1500),buttons:o.querySelectorAll('.ageUse').length,rows:SIM.AGE_LAST&&SIM.AGE_LAST.rows.map(r=>({y:r.y,soh:r.soh,past:!!r.past,fails:r.sum&&r.sum.fails,medH:r.sum&&r.sum.medH})),
      efcYr:SIM.AGE_LAST&&SIM.AGE_LAST.efcYr,dod:SIM.AGE_LAST&&SIM.AGE_LAST.dod,batt:SIM.BATT.id};
      if(btn){out.pick=+btn.dataset.soh;btn.click();out.slider=+document.getElementById('soh').value;out.cfg=SIM.S.cfg.soh;out.label=document.getElementById('sohV').textContent;}return out;}''')
    return r

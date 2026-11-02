"""New v6 test sections: regression edge cases, battery model, NEC tables, weather switch, observed missions,
worst-stretch finder, failure-rate runs and simulation-state save/load. Each check adds a pass/fail entry to res['asserts']."""
import json

NEC_310_16 = {  # (material, gauge): (60C, 75C, 90C) amps, NEC Table 310.16. None = not in elec.js's table (shown as Not verified)
    ('cu', '14'): (15, 20, 25), ('cu', '10'): (30, 35, 40), ('cu', '6'): (55, 65, 75), ('cu', '2/0'): (None, 175, 195),
    ('al', '6'): (None, 50, 55), ('al', '2/0'): (None, 135, 150),
}
TCORR_90 = {30: 1.0, 40: 0.91, 50: 0.82}  # NEC 310.15(B)(1), 90C column, ambient in C (bands 26-30, 36-40, 46-50)


async def run_new_sections(pg, res, DEFAULT, RUN, BAL, find_hour):
    A = res.setdefault('asserts', {})

    def ok(name, cond, **info):
        A[name] = dict(info, passed=bool(cond))

    ev = pg.evaluate
    # ---------- 13a. zero sun: a whole day with the solar array producing nothing ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S;const h=SIM.pvHourly();const keep={};for(const k in h)if(h[k]&&h[k].length===8760){keep[k]=h[k];h[k]=new Float64Array(8760);}
      S.t=150*1440;S.soc=0.9;S.battT=18;S.mission=null;let mx=0,pv=0;const s0=S.soc;const b0=S.stats.blackMin;
      for(let i=0;i<1440;i++){SIM.step();mx=Math.max(mx,S.live.mOut,S.live.pvAvail);}
      for(const k in keep)h[k]=keep[k];return {maxPvW:mx,socStart:s0,socEnd:S.soc,blackMin:S.stats.blackMin-b0,servedDay:S.live.served};}''')
    ok('zero_sun_no_pv', r['maxPvW'] == 0 and r['socEnd'] < r['socStart'], **r)

    # ---------- 13b. depleted battery: at the floor, at night, with a load ----------
    await ev(DEFAULT)
    night = await ev('()=>{for(let h=0;h<8760;h++)if(h%24===2)return h;}')
    r = await ev(RUN, {'batt': 'bb100', 'cfg': {}, 't': night * 60, 'soc': 0.0, 'bt': 18, 'min': 30, 'loads': [{'w': 200}]})
    ok('depleted_battery_blackout', r['firstUnservedMin'] == 0 and r['stats'].get('blackMin', 0) >= 29 and r['soc'] >= 0, first=r['firstUnservedMin'], blackMin=r['stats'].get('blackMin'), soc=r['soc'])

    # ---------- 13c. inverter overload (Phoenix 12/800) ----------
    io = res.get('edge_inverter', {})
    try:
        c850 = io['850 W steady']['firstUnservedMin']; c900 = io['900 W steady']['firstUnservedMin']; c950 = io['950 W steady']['firstUnservedMin']
        s1200 = io['600 W, 2x start surge (1200 W)']['stats'].get('faults', 0); s1300 = io['650 W, 2x start surge (1300 W)']['stats'].get('faults', 0)
        ok('inverter_overload_rules', c850 == -1 and 55 <= c900 <= 61 and c950 == 0 and s1200 == 0 and s1300 >= 1, first_850=c850, first_900=c900, first_950=c950, faults_1200=s1200, faults_1300=s1300)
    except Exception as e:
        ok('inverter_overload_rules', False, error=str(e))

    # ---------- 13d. controller clipping: 1,200 W of panels on a 150/35 at 12 V ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S;const c=S.cfg;SIM.setBattType('bb100');c.sysV=12;c.bpar=4;c.inv='p12-1200';c.mppt='150/35';c.nMppt=1;SIM.setPanelType('r200');c.ser=2;c.par=3;SIM.cfgChanged(true,true);
      S.t=120*1440;S.soc=0.2;S.battT=18;S.mission=null;S.loads=[];let clip=0,over=0,mx=0;
      for(let i=0;i<1440;i++){SIM.step();const L=S.live;if(L.harvestable>L.maxOut+1)clip++;if(L.mOut>L.maxOut+1e-6)over++;mx=Math.max(mx,L.mOut);}
      const M=SIM.MPPTS.find(m=>m.id===c.mppt);return {clipMin:clip,overMin:over,maxOutW:mx,amps:M.amps,nMppt:c.nMppt,vb:S.live.vb};}''')
    ok('controller_clipping', r['clipMin'] > 0 and r['overMin'] == 0 and r['maxOutW'] <= r['amps'] * r['nMppt'] * 14.6, **r)

    # ---------- 13e. high cable resistance: 14 AWG, 100 ft battery-to-inverter ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S,c=S.cfg;const run=(g,ft)=>{c.biG=g;c.biFt=ft;SIM.cfgChanged(true,true);S.t=2*60;S.soc=0.5;S.battT=18;S.invLow=false;S.invTrip=false;S.mission=null;
       S.loads=[{id:'t0',name:'Test',short:'T',qty:1,surge:1,mode:'on',wins:[[0,0]],cyc:null,thermo:null,chg:null,off:0,basis:'',w:1500}];const b0=S.stats.blackMin;let minV=99;for(let i=0;i<30;i++){SIM.step();minV=Math.min(minV,S.live.vInv);}
       const W=SIM.wiringReport();return {biVd:+W.biVd.toFixed(1),minVinv:+minV.toFixed(2),black:S.stats.blackMin-b0,fails:SIM.checks().filter(x=>x[0]==='fail'&&/Battery-to-inverter/.test(x[1])).length};};
       const a=run('2/0',5),b=run('14',100);c.biG='2/0';c.biFt=5;SIM.cfgChanged(true,true);return {good:a,bad:b};}''')
    ok('high_cable_resistance', r['bad']['biVd'] > 5 and r['bad']['minVinv'] < r['good']['minVinv'] - 1 and r['bad']['fails'] >= 1 and r['good']['fails'] == 0, **r)

    # ---------- 13f. battery temperature extremes ----------
    eb = res.get('edge_battery', {}).get('cases', {})
    try:
        ok('battery_temp_extremes',
           eb['lt100@-10C']['chargeMin'] > 0 and eb['lt100@-10C']['coldRiskMin'] > 0 and
           eb['bb100@-4.5C']['coldBlockMin'] > 0 and eb['bb100@-3.3C']['chargeMin'] > 0 and
           eb['lt230 discharge@-21C']['dischargeMin'] == 0 and eb['lt230 discharge@-19C']['dischargeMin'] > 0 and
           eb['agm100@-10C']['chargeMin'] > 0 and eb['lth100@-10C']['heatMin'] > 0,
           lt100=eb['lt100@-10C']['coldRiskMin'], bb_block=eb['bb100@-4.5C']['coldBlockMin'], lt230_dis21=eb['lt230 discharge@-21C']['dischargeMin'], lt230_dis19=eb['lt230 discharge@-19C']['dischargeMin'], lth_heat=eb['lth100@-10C']['heatMin'])
    except Exception as e:
        ok('battery_temp_extremes', False, error=str(e))
    # hot: 60 C battery still runs (no published high-temp cutoff modeled), state stays finite
    r = await ev(RUN, {'batt': 'bb100', 'cfg': {'bloc': 'in'}, 't': night * 60, 'soc': 0.5, 'bt': 60, 'min': 10, 'loads': [{'w': 100}]})
    ok('battery_hot_finite', r['soc'] == r['soc'] and r['battT'] < 61, soc=r['soc'], battT=r['battT'])

    # ---------- 13g. incompatible equipment flagged ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S,c=S.cfg;const out={};c.ser=6;c.par=1;c.mppt='100/30';SIM.cfgChanged(true,true);out.voc=SIM.checks().filter(x=>x[0]==='fail').map(x=>x[1].slice(0,200));
       c.ser=3;c.par=2;c.mppt='150/35';c.cbG='4/0';SIM.cfgChanged(true,true);out.term=SIM.checks().filter(x=>x[0]==='fail').map(x=>x[1].slice(0,200));c.cbG='6';SIM.cfgChanged(true,true);return out;}''')
    ok('incompatible_equipment', any('Cold-morning' in x or 'voltage' in x.lower() for x in r['voc']) and any('terminals' in x for x in r['term']), **r)

    # ---------- 13h. no 'OK' approval labels, no fuse called suitable ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const tags=[...document.querySelectorAll('#checks .tag')].map(t=>t.textContent);const txt=document.body.innerText;return {tags:[...new Set(tags)],okTag:tags.includes('OK'),suitable:/\\bsuitable\\b/i.test(txt.replace(/not\\s+suitable|no fuse is called suitable|never called suitable/gi,'')),nv:tags.filter(t=>t==='Not verified').length};}''')
    ok('labels_no_approval', not r['okTag'] and not r['suitable'] and r['nv'] >= 3, **r)

    # ---------- 13i. NEC tables in elec.js against NEC 310.16 / 310.15 values ----------
    r = await ev('''()=>{const E=SIM.ELEC;const o={};for(const [m,g] of [['cu','14'],['cu','10'],['cu','6'],['cu','2/0'],['al','6'],['al','2/0']]){o[m+g]=[60,75,90].map(t=>E.ampacityCheck({mat:m,gauge:g,ambC:30,ccc:1,ins:t,term:t},{imax:1,cont125:false}).base);}
       o.t40=E.ampacityCheck({mat:'cu',gauge:'10',ambC:40,ccc:1,ins:90,term:75},{imax:1,cont125:false}).tf;o.t50=E.ampacityCheck({mat:'cu',gauge:'10',ambC:50,ccc:1,ins:90,term:75},{imax:1,cont125:false}).tf;
       o.b5=E.ampacityCheck({mat:'cu',gauge:'10',ambC:30,ccc:5,ins:90,term:75},{imax:1,cont125:false}).bf;o.b8=E.ampacityCheck({mat:'cu',gauge:'10',ambC:30,ccc:8,ins:90,term:75},{imax:1,cont125:false}).bf;
       o.null60=E.ampacityCheck({mat:'cu',gauge:'2/0',ambC:30,ccc:1,ins:60,term:60},{imax:100,cont125:true}).status;o.miss=E.ampacityCheck({mat:'cu',gauge:'10',ambC:null,ccc:1,ins:90,term:75},{imax:20,cont125:true}).status;return o;}''')
    exp = {k[0] + k[1]: list(v) for k, v in NEC_310_16.items()}
    tab_ok = all(r[k] == exp[k] for k in exp)
    ok('nec_tables', tab_ok and abs(r['t40'] - TCORR_90[40]) < 1e-9 and abs(r['t50'] - TCORR_90[50]) < 1e-9 and r['b5'] == 0.8 and r['b8'] == 0.7 and r['miss'] == 'nv' and r['null60'] == 'nv', got=r, expected=exp)

    # fault estimate vs hand math: 4 Battle Born at 24 V (2 series x 2 parallel), 7 milliohms each
    await ev(DEFAULT)
    r = await ev('()=>{const W=SIM.wiringReport();return {amps:W.faultE.amps,v:W.faultV,isFloor:W.faultE.isFloor,fuse:W.fuseCmp.map(x=>[x.f.model,x.status])};}')
    hand = r['v'] / (2 * 0.007 / 2)
    ok('fault_estimate', abs(r['amps'] - hand) / hand < 1e-6 and all(s in ('nv', 'fail') for _, s in r['fuse']), hand=hand, **r)

    # ---------- 13j. battery model: AGM drain, absorption timer, health, heater speeds ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S,c=S.cfg;SIM.setBattType('agm100');c.sysV=12;c.bpar=4;c.inv='p12-1200';c.bloc='in';SIM.cfgChanged(true,true);S.t=2*60;S.soc=1;S.battT=20;S.mission=null;
      S.loads=[{id:'t0',name:'Test',short:'T',qty:1,surge:1,mode:'on',wins:[[0,0]],cyc:null,thermo:null,chg:null,off:0,basis:'',w:600}];let dm=0,n=0,e=0;const s0=S.soc,cap=SIM.capWh();
      for(let i=0;i<60;i++){SIM.step();dm+=S.live.dm;n++;}return {avgDm:dm/n,socDrop:s0-S.soc,cap,expectNoDm:0};}''')
    r2 = await ev('()=>({m54:SIM.BATTMODEL.drainMult("agm",54,25).m,m5:SIM.BATTMODEL.drainMult("agm",5,25).m,m5c:SIM.BATTMODEL.drainMult("agm",5,0).m,lfp:SIM.BATTMODEL.drainMult("lfp",100,-10).m})')
    ok('agm_drain', r['avgDm'] > 1.0 and abs(r2['m54'] - 100 / 54) < 0.02 and abs(r2['m5c'] - 1 / 0.85) < 0.01 and r2['lfp'] == 1, run=r, mults=r2)
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S;S.mission=null;S.loads=[];let best=-1;for(let d=100;d<200;d++){const h=SIM.pvHourly();let s=0;for(let i=0;i<24;i++)s+=h.eff[d*24+i];if(best<0||s>best.s)best={d,s};}
      S.t=best.d*1440+7*60;S.soc=0.9;S.battT=18;S.absMin=0;S.absDay=-1;let abs=0,flo=0,maxAbs=0,lim=0;for(let i=0;i<9*60;i++){SIM.step();const L=S.live;lim=L.absLimit;if(L.absPhase==='absorption'&&L.mOut>1)abs++;if(L.absPhase==='float')flo++;maxAbs=Math.max(maxAbs,L.absMin);}
      return {absMinutesCharging:abs,floatMin:flo,maxAbsMin:maxAbs,limit:lim,socEnd:S.soc};}''')
    ok('absorption_timer', r['limit'] == 60 and r['maxAbsMin'] <= 61 and r['floatMin'] > 0, **r)
    r = await ev('()=>{const c=SIM.S.cfg;c.soh=100;SIM.cfgChanged(true,true);const a=SIM.capWh();c.soh=80;SIM.cfgChanged(true,true);const b=SIM.capWh();c.soh=100;SIM.cfgChanged(true,true);return {a,b};}')
    ok('battery_health', abs(r['b'] / r['a'] - 0.8) < 1e-9, **r)
    r = await ev('()=>{const B=SIM.BATTMODEL;const o={};for(const k of ["fast","mid","slow"])o[k]=[B.heatMinutes(B.HEAT[k].rate,-10,5),B.heatMinutes(B.HEAT[k].rate,-20,5)];return o;}')
    ok('heater_speeds_in_range', all(70 <= v[0] <= 90 and 100 <= v[1] <= 150 for v in r.values()) and r['fast'][0] < r['mid'][0] < r['slow'][0], **r)
    await ev(DEFAULT)
    base = {'sysV': 12, 'bpar': 2, 'bloc': 'shed', 'inv': 'p12-1200', 'ser': 1, 'par': 4, 'nMppt': 1, 'mppt': '150/35'}
    tmy = await ev('Array.from(SIM.WX_TMY.ta)')
    cold_noon = find_hour(tmy, lambda h, v: (h // 24) < 60 and h % 24 == 9 and v < -8)
    hs = {}
    for sp in ('fast', 'mid', 'slow'):
        rr = await ev(RUN, {'batt': 'lth100', 'cfg': dict(base, heatSpeed=sp), 't': cold_noon * 60, 'soc': 0.5, 'bt': -10, 'min': 200, 'loads': [{'w': 30}]})
        hs[sp] = rr['heatMin']
    ok('heater_speed_in_sim', hs['fast'] <= hs['mid'] <= hs['slow'] and hs['fast'] > 0, heatMin=hs)

    # energy balance with AGM in a cold shed under heavy load (drain multiplier active)
    await ev(DEFAULT)
    await ev("()=>{SIM.setBattType('agm100');const c=SIM.S.cfg;c.sysV=12;c.bpar=4;c.inv='p12-1200';c.bloc='shed';SIM.cfgChanged(true,true);}")
    rb = await ev(BAL, {'day': 15, 'days': 7, 'soc': 0.9, 'bt': -10})
    ok('balance_agm_cold', rb['maxSocErr'] < 1e-9 and abs(rb['closureWh']) < 1e-6 and rb['chainErr'] == 0 and rb['neg'] == 0, **{k: rb[k] for k in ('maxSocErr', 'closureWh', 'chainErr', 'neg')})
    bal_all = res.get('balance', []) + [res.get('balance_year', {})]
    ok('balance_all_cases', all(b.get('maxSocErr', 1) < 1e-9 and abs(b.get('closureWh', 1)) < 1e-4 and b.get('chainErr', 1) == 0 and b.get('neg', 1) == 0 for b in bal_all), cases=len(bal_all), worstSocErr=max(b.get('maxSocErr', 1) for b in bal_all), worstClosure=max(abs(b.get('closureWh', 1)) for b in bal_all))

    # ---------- 13k. weather switch ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S;const sum=()=>{const h=SIM.pvHourly();let a=0;for(let i=0;i<8760;i++)a+=h.eff[i];return a;};const a=sum();
      const ok=SIM.setWeather('w2013');const W=SIM.WXNOW,T=SIM.WX_TMY;let diffIn=0,diffOut=0;for(let h=0;h<8760;h++){const d=Math.floor(h/24);const inW=d>=304||d<59;const df=Math.abs(W.ta[h]-T.ta[h])+Math.abs(W.dn[h]-T.dn[h]);if(inW&&df>0)diffIn++;if(!inW&&df>0)diffOut++;}
      const b=sum();const id=SIM.wxId();SIM.setWeather('tmy');const c=sum();return {ok,id,diffInHours:diffIn,diffOutHours:diffOut,pvTmy:a,pvHist:b,pvBack:c,bad:SIM.setWeather('w1999')};}''')
    ok('weather_switch', r['ok'] and r['diffOutHours'] == 0 and r['diffInHours'] > 2000 and r['pvBack'] == r['pvTmy'] and r['pvHist'] != r['pvTmy'] and r['bad'] is False, **r)

    # wind: NASA POWER wind vs the typical-year file's light wind, same sun and air temperature
    r = await ev('''()=>{const P=SIM.PHYS,c=SIM.S.cfg;const opt={tilt:+c.tilt,az:+c.az,mount:SIM.mountUsed(),bif:0,rearLoss:0};const out=[];let sa=0,sb=0,wsA=0,n=0;
      for(const y of SIM.HIST_YEARS){const W=SIM.buildHistWX(y);const W2=Object.assign({},W,{ws:new Float64Array(8760).fill(0.2)});const a=P.hourly(W,opt),b=P.hourly(W2,opt);let ea=0,eb=0;const g=SIM.PANELNOW.g/100;
        for(let d=0;d<365;d++){if(!(d>=304||d<59))continue;for(let i=0;i<24;i++){const h=d*24+i;ea+=a.eff[h]*(1+g*(a.tcell[h]-25));eb+=b.eff[h]*(1+g*(b.tcell[h]-25));wsA+=W.ws[h];n++;}}sa+=ea;sb+=eb;out.push(+((ea/eb-1)*100).toFixed(2));}
      const T=SIM.WX_TMY;let tw=0;for(let h=0;h<8760;h++)tw+=T.ws[h];
      return {pctGainNasaWindVs02:+((sa/sb-1)*100).toFixed(2),perWinterMin:Math.min(...out),perWinterMax:Math.max(...out),nasaWinterWindMean:+(wsA/n).toFixed(2),tmyWindMean:+(tw/8760).toFixed(2)};}''')
    res['wind_effect'] = r
    ok('wind_effect_measured', r['pctGainNasaWindVs02'] > 0, **r)

    # ---------- 13l. observed-winter mission, determinism and clean exit ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S;const before=JSON.stringify(S.loads);const m=SIM.makeMission({type:'hist',y:2013,soc:1,own:false});SIM.startMission(m);const wxIn=SIM.wxId();let n=0;while(S.mission&&n<130*1440){SIM.step();n++;}
      return {minutes:n,wxDuring:wxIn,wxAfter:SIM.wxId(),loadsBack:JSON.stringify(S.loads)===before,black:S.stats.blackMin,minSoc:S.stats.minSoc,faults:S.stats.faults};}''')
    res['observed_2013'] = r
    ok('observed_winter_mission', r['minutes'] == 120 * 1440 and r['wxDuring'] == 'w2013' and r['wxAfter'] == 'tmy' and r['loadsBack'], **r)

    # ---------- 13m. worst-stretch finder: the answer is the minimum over every window ----------
    await ev(DEFAULT)
    r = await ev('''()=>new Promise(res=>SIM.findWorstStretch(7,()=>{},best=>{let mn=1e99,cnt=0;for(const y of SIM.HIST_YEARS){const d=SIM.poaDaily(SIM.buildHistWX(y));for(let k=0;k+7<=120;k++){let a=0;for(let j=0;j<7;j++)a+=d[k+j];if(a<mn)mn=a;cnt++;}}res({best,bruteMin:mn,windows:cnt});}))''')
    res['worst_stretch_7'] = r
    ok('worst_stretch_finder', abs(r['best']['kwh'] - r['bruteMin']) < 1e-9 and r['windows'] == 25 * 114, best=r['best'], windows=r['windows'])

    # ---------- 13n. failure-rate run: matches single observed-winter runs, leaves the user's state alone ----------
    await ev(DEFAULT)
    r = await ev('''()=>new Promise(res=>{const S=SIM.S;S.t=12345;S.soc=0.61;const snap=JSON.stringify({t:S.t,soc:S.soc,loads:S.loads,wx:SIM.wxId(),log:S.log.length});const t0=performance.now();
      SIM.runFailureRates(['food'],()=>{},(out,why)=>{const after=JSON.stringify({t:S.t,soc:S.soc,loads:S.loads,wx:SIM.wxId(),log:S.log.length});res({why,ms:performance.now()-t0,sum:out[0]?{fails:out[0].fails,n:out[0].n,ci:out[0].ci,medH:out[0].medH,minH:out[0].minH,maxH:out[0].maxH,worst:out[0].worst,runs:out[0].runs.map(x=>[x.y,x.black])}:null,untouched:snap===after});});})''')
    res['failure_rate_food'] = r
    singles = {}
    for y in (2002, 2013, 2025):
        await ev(DEFAULT)
        singles[y] = await ev('''(y)=>{const S=SIM.S;SIM.startMission(SIM.makeMission({type:'hist',y,soc:1,own:false}));S.randomSnow=false;let n=0;while(S.mission&&n<130*1440){SIM.step();n++;}return S.stats.blackMin;}''', y)
    runs = dict((y, b) for y, b in (r['sum']['runs'] if r.get('sum') else []))
    ok('failure_rate_consistent', r.get('untouched') and r.get('sum') and r['sum']['n'] == 25 and all(runs.get(y) == singles[y] for y in singles), singles=singles, from_batch={y: runs.get(y) for y in singles}, ms=r.get('ms'))

    # ---------- 13o. simulation state: save mid-mission, reload, continue identically; bad files refused ----------
    await ev(DEFAULT)
    r = await ev('''()=>{const S=SIM.S;SIM.startMission(SIM.makeMission({type:'stretch',y:2013,k:30,n:7,soc:1,own:false}));SIM.setPlaying(false);S.randomSnow=false;for(let i=0;i<2000;i++)SIM.step();
      const saved=JSON.stringify(SIM.buildStatePayload());for(let i=0;i<3000;i++)SIM.step();const A=JSON.stringify(S.stats)+S.soc+S.battT;
      S.t=5;S.soc=0.1;SIM.setWeather('tmy');S.mission=null;const err=SIM.applyState(JSON.parse(saved));SIM.setPlaying(false);const midOk=!!S.mission&&SIM.wxId()==='w2013';for(let i=0;i<3000;i++)SIM.step();const B=JSON.stringify(S.stats)+S.soc+S.battT;
      const good=JSON.parse(saved);const before=JSON.stringify(SIM.buildStatePayload().state);const bads={};
      const tryBad=(n,f)=>{const p=JSON.parse(saved);f(p);const e=SIM.applyState(p);bads[n]={refused:!!e,msg:e,unchanged:JSON.stringify(SIM.buildStatePayload().state)===before};};
      tryBad('soc_out_of_range',p=>p.state.soc=2);tryBad('unknown_mission',p=>p.state.mission={type:'builtin',id:'nope'});tryBad('unknown_winter',p=>p.state.wx='w1990');
      tryBad('design_file',p=>{Object.assign(p,p.design);});tryBad('missing_stats',p=>delete p.state.stats.blackMin);tryBad('huge_history',p=>p.state.hist=Array(400).fill([0,0,0,0]));
      tryBad('bad_part_in_design',p=>p.design.cfg.panel='nope');tryBad('wrong_app',p=>p.app='other');tryBad('string_number',p=>p.state.t='100');
      const p=JSON.parse(saved);p.state.log=[{t:1,msg:'<img src=x onerror=window.__x=1>',bad:false}];const e2=SIM.applyState(p);const esc=!window.__x&&document.getElementById('log').innerHTML.indexOf('<img')<0;
      return {err,midOk,sameContinuation:A===B,bads,htmlEscaped:esc,e2};}''')
    res['state_save'] = r
    ok('state_save_resume', r['err'] is None and r['midOk'] and r['sameContinuation'] and r['htmlEscaped'], err=r['err'], midOk=r['midOk'], same=r['sameContinuation'])
    ok('state_bad_files_refused', all(v['refused'] and v['unchanged'] for v in r['bads'].values()), bads=r['bads'])

    # ---------- 13p. state save/load through the real buttons and file input ----------
    await ev(DEFAULT)
    await pg.click('.tabs button[data-tab="build"]')
    await ev('()=>{const S=SIM.S;for(let i=0;i<500;i++)SIM.step();}')
    ST = "(()=>{const s=SIM.buildStatePayload().state;delete s.log;return JSON.stringify(s);})()"
    snap = await ev(ST)
    await pg.click('#saveSB')
    await ev('()=>{const S=SIM.S;for(let i=0;i<500;i++)SIM.step();}')
    await pg.click('#loadSB')
    back = await ev(ST)
    async with pg.expect_download() as dl:
        await pg.click('#exportSB')
    d = await dl.value
    path = await d.path(); exp = json.load(open(path))
    await ev('()=>{for(let i=0;i<500;i++)SIM.step();}')
    await pg.set_input_files('#importSF', path); await pg.wait_for_timeout(400)
    back2 = await ev(ST)
    note = await ev("document.getElementById('saveNote').textContent")
    ok('state_buttons', back == snap and back2 == snap and exp.get('kind') == 'state', note=note)
    # a design file through the state importer and a state file through the design importer are refused
    async with pg.expect_download() as dl2:
        await pg.click('#exportB')
    dpath = await (await dl2.value).path()
    await pg.set_input_files('#importSF', dpath); await pg.wait_for_timeout(300)
    n1 = await ev("document.getElementById('saveNote').textContent")
    await pg.set_input_files('#importF', path); await pg.wait_for_timeout(300)
    n2 = await ev("document.getElementById('saveNote').textContent")
    ok('cross_import_refused', 'design file' in n1 and 'state file' in n2, n1=n1, n2=n2)

    # ---------- 13q. mission replay: each built-in mission twice gives the same result ----------
    reps = []
    for i in range(await ev('SIM.MISSIONS.length')):
        out = []
        for _ in range(2):
            await ev(DEFAULT)
            out.append(await ev('''(i)=>{const S=SIM.S;SIM.startMission(SIM.MISSIONS[i]);SIM.setPlaying(false);let n=0;while(S.mission&&n<40*1440){SIM.step();n++;}return [S.stats.blackMin,+S.stats.minSoc.toFixed(6),S.stats.faults,+S.stats.unserved.toFixed(3)];}''', i))
        reps.append(out)
    ok('mission_replay_deterministic', all(a == b for a, b in reps), results=reps)

    # ---------- 13r. UI: new controls work through real inputs ----------
    await ev(DEFAULT)
    await pg.click('.tabs button[data-tab="build"]')
    await pg.fill('#ambF', '104'); await pg.dispatch_event('#ambF', 'change')
    await pg.fill('#ccc', '4'); await pg.dispatch_event('#ccc', 'change')
    await pg.select_option('#insC', '90'); await pg.select_option('#termC', '75')
    await pg.fill('#soh', '80'); await pg.dispatch_event('#soh', 'change')
    await pg.wait_for_timeout(150)
    r = await ev("()=>({cfg:{ambF:SIM.S.cfg.ambF,ccc:SIM.S.cfg.ccc,insC:SIM.S.cfg.insC,termC:SIM.S.cfg.termC,soh:SIM.S.cfg.soh},tbl:[...document.querySelectorAll('#checks li')].filter(l=>/cable \\(/.test(l.textContent)).map(l=>l.textContent.slice(0,150))})")
    ok('ui_new_inputs', r['cfg'] == {'ambF': 104, 'ccc': 4, 'insC': 90, 'termC': 75, 'soh': 80} and not any('Not verified' in t[:14] for t in r['tbl']), **r)
    await pg.click('.tabs button[data-tab="missions"]')
    await pg.select_option('#wxSel', 'w2010'); await pg.wait_for_timeout(200)
    r = await ev("()=>({wx:SIM.wxId(),note:document.getElementById('wxNote').textContent})")
    await pg.select_option('#wxSel', 'tmy')
    ok('ui_weather_select', r['wx'] == 'w2010', **r)
    await pg.fill('#fN', '5'); await pg.click('#fGo')
    await pg.wait_for_function("!document.getElementById('fRun').hidden", timeout=60000)
    fo = await ev("document.getElementById('fOut').textContent")
    await pg.click('#fRun'); await pg.wait_for_timeout(200)
    r = await ev("()=>({mission:SIM.S.mission&&SIM.S.mission.name,wx:SIM.wxId()})")
    await ev('()=>{SIM.setPlaying(false);}')
    ok('ui_worst_stretch', r['mission'] is not None and r['wx'].startswith('w'), found=fo, **r)
    await ev(DEFAULT)

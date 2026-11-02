"""v7 test sections: the user's LONGi panels, controller compatibility, bill of materials, 120/240 V split phase,
well pump, per-string controller sharing and the day counter. Each check adds a pass/fail entry to res['asserts'].
Source cross-checks read the datasheets and seller data saved in src/ (skipped, and marked so, when src/ isn't present)."""
import json, math, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = next((p for p in (os.path.join(HERE, 'src'), os.path.join(HERE, '..', 'sources')) if os.path.isdir(p)), None)

# LONGi LR4-72HBD-435M, datasheet LR4-72HBD 425-455M version 20210508V13
LONGI = dict(w=435, voc=49.1, isc=11.36, vmp=40.8, imp=10.66)
LONGI_TC = dict(g=-0.350, b=-0.284, a=0.050, fuse=25, bifi=0.70, noct=45)

# Fresh steady-load runner: resets the start-up state so every load surges on its first minute.
RUN2 = '''(o)=>{const S=SIM.S,c=S.cfg;Object.assign(c,o.cfg||{});
 S.loads=(o.loads||[]).map((l,i)=>Object.assign({id:'v'+i,name:'Test '+i,short:'T'+i,qty:1,surge:1,mode:'on',wins:[[0,0]],cyc:null,thermo:null,chg:null,off:0,basis:'',volt:120,leg:1},l));
 SIM.cfgChanged(true,true);S.t=o.t;S.soc=0.9;S.battT=20;S.lastI=0;S.bmsTrip=false;S.invLow=false;S.invTrip=false;S.heatOn=false;S.coldDis=false;S.coldLock=false;S.ovl=0;S.overMin=0;S.mission=null;S.prevOn={};S.invOn=true;
 const s0=JSON.parse(JSON.stringify(S.stats));let first=-1,served=0;for(let i=0;i<o.min;i++){SIM.step();if(first<0&&S.live.unserved>0)first=i;served+=S.live.served/60;}
 return {firstUnservedMin:first,trips:S.stats.tripInv-(s0.tripInv||0),faults:S.stats.faults-(s0.faults||0),unfitWh:+((S.stats.unfitWh||0)-(s0.unfitWh||0)).toFixed(2),servedWh:+served.toFixed(1),log:S.log.slice(0,3).map(x=>x.msg),checks:SIM.checks().map(x=>x[0]+': '+x[1])};}'''


def pdf_text(path):
    try:
        return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return ''


async def run_v7_sections(pg, res, DEFAULT):
    A = res.setdefault('asserts', {})

    def ok(name, cond, **info):
        A[name] = dict(info, passed=bool(cond))

    ev = pg.evaluate
    night = 2 * 60  # 2 AM on Jan 1: no sun, so only the loads move the numbers

    # ---------- 14a. LONGi specs in the sim equal the datasheet ----------
    await ev(DEFAULT)
    p = await ev("()=>{const p=SIM.PANELS.find(x=>x.id==='lg435');SIM.setPanelType('lg435');const P=SIM.PANEL;return {w:p.w,voc:p.voc,isc:p.isc,vmp:p.vmp,imp:p.imp,tiers:p.tiers,priceKind:p.priceKind,g:P.g,b:P.b,a:P.a,fuse:P.fuse,bifi:P.bifi,noct:P.noct,bifacial:P.bifacial}}")
    sim_ok = all(abs(p[k] - v) < 1e-9 for k, v in LONGI.items()) and all(abs(p[k] - v) < 1e-9 for k, v in LONGI_TC.items()) and p['tiers'] == [[1, 100]] and p['priceKind'] == 'yours'
    ds = {}
    if SRC and os.path.exists(os.path.join(SRC, 'longi', 'LR4-72HBD_425-455M_V13_baywa.pdf')):
        t = pdf_text(os.path.join(SRC, 'longi', 'LR4-72HBD_425-455M_V13_baywa.pdf'))
        def col(label):  # STC value in the LR4-72HBD-435M column (5th number on the row: 425 STC, NOCT, 430 STC, NOCT, 435 STC)
            m = re.search(label + r'[^\n]*', t)
            nums = re.findall(r'\d+\.?\d*', m.group(0).split(')', 1)[-1]) if m else []
            return float(nums[4]) if len(nums) > 4 else None
        ds = dict(w=col(r'Maximum Power \(Pmax/W\)'), voc=col(r'Open Circuit Voltage'), isc=col(r'Short Circuit Current'), vmp=col(r'Voltage at Maximum Power'), imp=col(r'Current at Maximum Power'),
                  fuse='25A' in t, b='-0.284%' in t, g='-0.350%' in t, a='+0.050%' in t, bifi='70±5%' in t)
        ds_ok = all(ds[k] == v for k, v in LONGI.items()) and all(ds[k] for k in ('fuse', 'b', 'g', 'a', 'bifi'))
    else:
        ds_ok = None
    ok('longi_specs', sim_ok and ds_ok is not False, sim=p, datasheet=ds, datasheet_checked=ds_ok is not None)

    # ---------- 14b. preset: 2 in series x 2 strings on one SmartSolar 150/70, default 24 V Battle Born bank ----------
    await ev(DEFAULT)
    pr = await ev("()=>{SIM.useMyLongi();const c=SIM.S.cfg;const ck=SIM.checks();return {panel:SIM.PANEL.id,ser:c.ser,par:c.par,mppt:c.mppt,nMppt:c.nMppt,batt:SIM.BATT.id,bpar:c.bpar,sysV:c.sysV,inv:c.inv,coldF:c.coldF,arrayW:c.ser*c.par*SIM.PANEL.w,fails:ck.filter(x=>x[0]==='fail').map(x=>x[1])}}")
    ok('longi_preset', pr['panel'] == 'lg435' and pr['ser'] == 2 and pr['par'] == 2 and pr['mppt'] == '150/70' and pr['nMppt'] == 1 and pr['batt'] == 'bb100' and pr['bpar'] == 2 and pr['sysV'] == 24 and pr['arrayW'] == 1740 and not pr['fails'], **pr)

    # ---------- 14c. cold Voc: independent math vs the compatibility list ----------
    rows = await ev("()=>SIM.compatRows(4).map(r=>({ser:r.ser,par:r.par,nC:r.nC,M:r.M.id,ok:r.ok,vocC:r.vocC,isc:r.isc,why:r.why}))")
    coldC = (pr['coldF'] - 32) * 5 / 9
    voc1 = LONGI['voc'] * (1 + LONGI_TC['b'] / 100 * (coldC - 25))
    r1 = [r for r in rows if r['ser'] == 1]
    err = max(abs(r['vocC'] - r['ser'] * voc1) for r in rows)
    ok('longi_cold_voc', pr['coldF'] == -20 and abs(voc1 - 56.6) < 0.05 and err < 1e-6 and r1, one_panel_cold_voc=round(voc1, 2), max_err_v=err, design_F=pr['coldF'])

    # ---------- 14d. compatible and incompatible layouts ----------
    def row(ser, par, nC, M):
        return next((r for r in rows if r['ser'] == ser and r['par'] == par and r['nC'] == nC and r['M'] == M), None)
    # expected from Victron's limits and the panel's datasheet, computed here
    lim = {'100/30': (100, 100, 35), '150/35': (150, 145, 40), '150/70': (150, 145, 50), '250/70': (250, 245, 35)}
    def expect(ser, par, nC, M):
        ab, op, isc = lim[M]; v = ser * voc1; per = math.ceil(par / nC); vabs = 2 * 14.4
        return v <= op and per * LONGI['isc'] <= isc and ser * LONGI['vmp'] >= vabs + 5
    cases = [(2, 2, 1, '150/70'), (4, 1, 1, '150/70'), (4, 1, 1, '250/70'), (1, 4, 1, '100/30'), (1, 4, 2, '100/30'), (2, 2, 1, '100/30'), (4, 1, 1, '150/35')]
    got = {f'{s}S{p}P on {n}x{m}': (row(s, p, n, m) or {}).get('ok') for s, p, n, m in cases}
    exp = {f'{s}S{p}P on {n}x{m}': expect(s, p, n, m) for s, p, n, m in cases}
    ab = row(4, 1, 1, '150/70') or {}
    ok('compat_layouts', got == exp and got['2S2P on 1x150/70'] and not got['4S1P on 1x150/70'] and got['4S1P on 1x250/70'] and any('absolute limit' in w for w in ab.get('why', [])), got=got, expected=exp, why_4s_150_70=ab.get('why'))

    # ---------- 14e. bill of materials: every category and the totals ----------
    bom = await ev("()=>{const L=SIM.costLines();SIM.cfgChanged(true,true);return {L:L.map(l=>({k:l.k,status:l.status,cost:l.cost,asOf:l.asOf||'',url:l.url||''})),total:SIM.totalCost(),note:document.getElementById('costNote').textContent}}")
    L = {l['k']: l for l in bom['L']}
    sums = {s: round(sum(l['cost'] for l in bom['L'] if l['status'] == s), 2) for s in ('confirmed', 'yours', 'estimated', 'missing')}
    money = lambda v: '$' + format(v, ',.2f')
    bm_ok = None
    if SRC and os.path.exists(os.path.join(SRC, 'prices', 'bm_products.json')):
        d = json.load(open(os.path.join(SRC, 'prices', 'bm_products.json'))); d.update(json.load(open(os.path.join(SRC, 'prices', 'bm_1793418974.json'))))
        price = lambda h, t: next(v['price'] / 100 for v in d[h]['variants'] if v['title'] == t)
        bm = {'shunt': price('victron-smartshunt-50mv', 'Smartshunt 500A/50mV'), 'lynxT': price('victron-lynx-power-in', 'Lynx Class-T Power In (M10)'),
              'lynxD': price('victron-lynx-distributor', 'Lynx Distributor (M10)'), 'mega': 2 * price('victron-mega-fuse-32v-48v-80v', '100A up to 80V (5 pcs)'),
              'inv': price('victron-multiplus-ii', '24/3000/70-50 120V')}
        bm_ok = all(abs(L[k]['cost'] - v) < 0.005 for k, v in bm.items() if k in L)
    else:
        bm = {}
    cats_ok = (L['panels']['status'] == 'yours' and L['panels']['cost'] == 400 and all(L[k]['status'] == 'confirmed' and L[k]['url'] and L[k]['asOf'] for k in ('ctrl', 'batt', 'inv', 'shunt', 'lynxT', 'lynxD', 'mega'))
               and all(L[k]['status'] == 'estimated' and L[k]['cost'] > 0 for k in ('wpv', 'wcb', 'wbi', 'mc4', 'pvdisc', 'batlug'))
               and all(L[k]['status'] == 'missing' and L[k]['cost'] == 0 for k in ('tfuse', 'rack', 'acpanel', 'gnd')) and 'gen' not in L)
    tot_ok = abs(bom['total'] - (sums['confirmed'] + sums['yours'] + sums['estimated'])) < 0.005 and sums['missing'] == 0
    note_ok = money(sums['confirmed']) in bom['note'] and money(sums['yours']) in bom['note'] and money(sums['estimated']) in bom['note']
    ok('bom_categories_totals', cats_ok and tot_ok and note_ok and bm_ok is not False, sums=sums, total=round(bom['total'], 2), note=bom['note'][:400], seller_prices=bm, seller_checked=bm_ok is not None)
    # default (Renogy) build: the panels are a confirmed seller price, not "yours"
    await ev(DEFAULT)
    dp = await ev("()=>SIM.costLines().find(l=>l.k==='panels').status")
    ok('bom_default_panels_confirmed', dp == 'confirmed', status=dp)

    # ---------- 14f. split phase: each leg is limited to one unit ----------
    await ev(DEFAULT)
    base = {'cfg': {'inv': 'sp-m24-3000'}, 't': night, 'min': 10}
    one_leg = await ev(RUN2, dict(base, loads=[{'w': 1500, 'leg': 1}, {'w': 1500, 'leg': 1}]))
    await ev(DEFAULT)
    two_legs = await ev(RUN2, dict(base, loads=[{'w': 1500, 'leg': 1}, {'w': 1500, 'leg': 2}]))
    await ev(DEFAULT)
    single = await ev(RUN2, dict(base, cfg={'inv': 'm24-3000'}, loads=[{'w': 1500}, {'w': 1500}]))
    ok('split_phase_leg_limits', one_leg['trips'] >= 1 and 0 < one_leg['firstUnservedMin'] <= 3 and two_legs['trips'] == 0 and two_legs['firstUnservedMin'] == -1 and single['trips'] >= 1,
       one_leg_3000W=dict(trips=one_leg['trips'], first=one_leg['firstUnservedMin'], log=one_leg['log'][:1]), split_1500_each=dict(trips=two_legs['trips'], first=two_legs['firstUnservedMin']), single_unit_3000W=dict(trips=single['trips']))

    # ---------- 14g. a 240 V load on a 120 V-only inverter is blocked and flagged ----------
    await ev(DEFAULT)
    blk = await ev(RUN2, {'cfg': {'inv': 'm24-3000'}, 't': night, 'min': 30, 'loads': [{'w': 500, 'volt': 240}]})
    await ev(DEFAULT)
    runs = await ev(RUN2, {'cfg': {'inv': 'sp-m24-3000'}, 't': night, 'min': 30, 'loads': [{'w': 500, 'volt': 240}]})
    flagged = any(c.startswith('fail: Incompatible') for c in blk['checks'])
    ok('load_240v_blocked_on_120v', abs(blk['unfitWh'] - 250) < 0.5 and blk['servedWh'] < 1 and flagged and runs['unfitWh'] == 0 and abs(runs['servedWh'] - 250) < 0.5,
       on_120v=dict(unfitWh=blk['unfitWh'], servedWh=blk['servedWh'], flagged=flagged), on_split=dict(unfitWh=runs['unfitWh'], servedWh=runs['servedWh']))

    # ---------- 14h. well pump: datasheet figures and its start-up surge per leg ----------
    wp = await ev("()=>{const p=SIM.PRESETS.find(x=>/Franklin 244505/.test(x.name));return p&&{w:p.w,surge:p.surge,volt:p.volt}}")
    aim_ok = None
    if SRC and os.path.exists(os.path.join(SRC, 'pump', 'aim.txt')):
        line = next((l for l in open(os.path.join(SRC, 'pump', 'aim.txt')) if re.match(r'\s*244505\s+1/2', l)), '')
        aim_ok = ' 670 ' in line and ' 32.2 ' in line
    surge_va = 230 * 32.2
    await ev(DEFAULT)
    pump = {'w': wp['w'], 'surge': wp['surge'], 'volt': 240}
    alone = await ev(RUN2, {'cfg': {'inv': 'sp-m24-3000'}, 't': night, 'min': 5, 'loads': [pump]})
    await ev(DEFAULT)
    with_load = await ev(RUN2, {'cfg': {'inv': 'sp-m24-3000'}, 't': night, 'min': 5, 'loads': [{'w': 2000, 'leg': 1}, pump]})
    await ev(DEFAULT)
    on120 = await ev(RUN2, {'cfg': {'inv': 'm24-3000'}, 't': night, 'min': 5, 'loads': [pump]})
    # per leg: half the pump's running watts plus half its surge; one MultiPlus-II 24/3000 peaks at 5500 W (datasheet)
    leg_alone = wp['w'] * wp['surge'] / 2; leg_with = 2000 + leg_alone
    ok('well_pump_surge', wp['w'] == 670 and wp['volt'] == 240 and abs(wp['w'] * wp['surge'] - surge_va) / surge_va < 0.01 and aim_ok is not False
       and alone['trips'] == 0 and with_load['trips'] >= 1 and on120['unfitWh'] > 0 and on120['trips'] == 0,
       preset=wp, surge_w=wp['w'] * wp['surge'], locked_rotor_va=round(surge_va), aim_row_checked=aim_ok, per_leg_peak_alone=leg_alone, per_leg_peak_with_2000W=leg_with,
       trips_alone=alone['trips'], trips_with_2000W=with_load['trips'], log_with=with_load['log'][:1], blocked_on_120v_Wh=on120['unfitWh'])

    # ---------- 14i. per-string controller sharing ----------
    await ev(DEFAULT)
    sh = await ev('''()=>{const s=[[3,2],[4,3],[2,2],[5,2],[1,1]].map(x=>SIM.ctlShares(x[0],x[1]));
      const S=SIM.S,c=S.cfg;SIM.setPanelType('r200');c.ser=2;c.par=3;c.nMppt=2;c.mppt='100/30';c.sysV=12;c.bpar=4;c.inv='m12-3000';SIM.cfgChanged(true,true);
      let best=null;for(let d=150;d<200;d++){S.t=d*1440+12*60;S.soc=0.3;S.battT=20;S.lastI=0;S.mpptDead=false;S.coldLock=false;SIM.step();const L=S.live;if(!best||L.harvestable>best.H)best={H:L.harvestable,maxOut:L.maxOut,vb:S.vbat,day:d};}
      const M=SIM.MPPTS.find(m=>m.id==='100/30');return {shares:s,best,amps:M.amps,par:c.par,nC:c.nMppt};}''')
    b = sh['best']; H, vb, A_ = b['H'], b['vb'], sh['amps']
    exp_split = min(H * 2 / 3, A_ * vb) + min(H / 3, A_ * vb)
    exp_equal = 2 * min(H / 2, A_ * vb)
    ok('controller_string_sharing', sh['shares'] == [[2, 1], [2, 1, 1], [1, 1], [3, 2], [1]] and abs(b['maxOut'] - exp_split) < 1e-6 and H * 2 / 3 > A_ * vb,
       shares=sh['shares'], harvestable_W=round(H, 1), limit_per_controller_W=round(A_ * vb, 1), maxOut_W=round(b['maxOut'], 1), expected_whole_strings_W=round(exp_split, 1), equal_split_would_be_W=round(exp_equal, 1))

    # ---------- 14j. day counter past 365 days ----------
    await ev(DEFAULT)
    dc = await ev('''()=>{const S=SIM.S;const Y=365*1440;S.t=Y-10;S.stats.startT=S.t;S.stats.mins=400*1440-10;S.mission=null;for(let i=0;i<20;i++)SIM.step();
      SIM.setPlaying(true);SIM.setPlaying(false);SIM.refreshLive&&SIM.refreshLive();const el=document.getElementById('score');const txt=el?el.textContent:'';return {t:S.t,mins:S.stats.mins,txt:txt.slice(0,200)};}''')
    ok('day_counter_past_365', dc['t'] == 10 and dc['mins'] == 400 * 1440 + 10 and ('400.0' in dc['txt'] or dc['txt'] == ''), **dc)

    # ---------- 14k. multi-year aging: the cycle-life math against hand-worked values, and the controls ----------
    await ev(DEFAULT)
    am = await ev('''()=>{const D=SIM.AGE_DATA,L=SIM.ageEfcLife;return {
      lt60:L(D.lt100,60),lt80:L(D.lt100,80),lt100:L(D.lt100,100),lt70:L(D.lt100,70),lt40:L(D.lt100,40),bb:L(D.bb100,70),agm:L(D.agm100,80),lt48:L(D.lt48,50),
      soh_lt:SIM.ageSoh(D.lt100,100,100,10),soh_agm:SIM.ageSoh(D.agm100,50,50,5),
      missing:SIM.BATTS.filter(b=>!D[b.id]).map(b=>b.id),ui:!!document.getElementById('ageGo')&&!!document.getElementById('ageP'),
      sohStep:document.getElementById('soh').step};}''')
    close = lambda x, y: abs(x - y) < 1e-9
    ok('aging_math', close(am['lt60'], 9000) and close(am['lt80'], 4800) and close(am['lt100'], 4000) and close(am['lt70'], 6900)
       and close(am['lt40'], 9000) and close(am['bb'], 3000) and close(am['agm'], 250) and close(am['lt48'], 4000)
       and close(am['soh_lt'], 0.85) and close(am['soh_agm'], 1 - 5 * (0.2 * 50 / 250 + 0.04)) and not am['missing'] and am['ui'] and am['sohStep'] == '1', **am)

async def run_longi_winters(pg, DEFAULT):
    """The user's preset through all 25 recorded winters, three appliance sets, rear-side gain off; plus food set with it on."""
    out = {}
    for label, bif in (('front_only', False), ('rear_gain_on', True)):
        await pg.evaluate(DEFAULT)
        await pg.evaluate("()=>document.getElementById('resetLoads').click()")  # 'mine' = the starting appliance list
        pats = ['food', 'furnace', 'mine'] if not bif else ['food']
        r = await pg.evaluate('''(o)=>new Promise(res=>{SIM.useMyLongi();SIM.S.cfg.bifOn=o.bif;SIM.cfgChanged(true,true);const t0=performance.now();
          SIM.runFailureRates(o.pats,()=>{},(out,why)=>res({why,ms:performance.now()-t0,tilt:SIM.S.cfg.tilt,az:SIM.S.cfg.az,bif:SIM.S.cfg.bifOn,loads:SIM.S.loads.map(l=>[l.name,l.w,l.qty,l.mode]),
            sums:out.map(x=>({p:x.p,fails:x.fails,n:x.n,ci:x.ci,medH:x.medH,minH:x.minH,maxH:x.maxH,worst:[x.worst.y,x.worst.black],faultWinters:x.faultWinters,lowSoc:x.lowSoc,runs:x.runs.map(y=>[y.y,y.black])}))}));})''', {'bif': bif, 'pats': pats})
        out[label] = r
    return out

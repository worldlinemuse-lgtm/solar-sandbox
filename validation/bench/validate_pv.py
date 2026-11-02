"""Compare the sandbox's solar model against (1) PVWatts v8 hourly output for the same weather and
orientation, and (2) pvlib-python run on the same weather. Writes validation_pv.txt.
PVWatts agreement validates only the sun-to-panel part. It says nothing about batteries, wiring or
the rest of the system."""
import json, subprocess, os, glob
import numpy as np, pandas as pd, pvlib

H = os.path.dirname(os.path.abspath(__file__))
base = json.load(open(os.path.join(H, '..', 'pvw.json')))
st = base['station_info']; ob = base['outputs']
files = {'t40_a180': os.path.join(H, '..', 'pvw.json')}
for f in glob.glob(os.path.join(H, 'pvw_t*_a*.json')):
    k = os.path.basename(f)[4:-5]
    try:
        if 'outputs' in json.load(open(f)): files[k] = f
    except Exception: pass
cfgs = []
for k in files:
    if 'bif' in k or 'm1' in k: continue
    t, a = k.split('_')[:2]
    cfgs.append({'key': k, 'tilt': float(t[1:]), 'az': float(a[1:]), 'mount': 'open', 'bif': 0})
cfgs.append({'key': 't40_a180_bif', 'tilt': 40, 'az': 180, 'mount': 'open', 'bif': 0.7})
subprocess.run(['node', os.path.join(H, 'run_model.js'), json.dumps(cfgs)], check=True)
M = json.load(open(os.path.join(H, 'model_out.json')))

# pvlib on the same weather, sun at the PVWatts hour midpoints (sunup portion ignored: hour midpoint)
times = pd.date_range('2019-01-01 00:30', periods=8760, freq='h', tz='Etc/GMT+5')
loc = pvlib.location.Location(st['lat'], st['lon'], tz='Etc/GMT+5', altitude=st.get('elev') or 0)
sp = loc.get_solarposition(times)
dni = pd.Series(ob['dn'], index=times); dhi = pd.Series(ob['df'], index=times)
ghi = dni * np.cos(np.radians(sp['apparent_zenith'].clip(upper=90))) + dhi
alb = pd.Series(ob['alb'], index=times)
de = pvlib.irradiance.get_extra_radiation(times)
am = pvlib.atmosphere.get_relative_airmass(sp['apparent_zenith'])

lines = []
P = lines.append
P('Solar model validation, Honesdale weather year (NSRDB PSM V3 TMY via PVWatts v8)')
P('Annual sums in kWh/m2 (irradiance) or kWh per kW (DC). Monthly error is the largest monthly difference.')
P('')
P('Orientation   | POA kWh/m2: PVWatts  sandbox  pvlib | sandbox vs PVWatts annual, worst month | DC/kW PVWatts vs sandbox (same 14% loss, -0.37%/C, sandbox cell temp)')
mon = np.repeat(np.arange(12), [d * 24 for d in [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]])
res = {}
for c in cfgs:
    k = c['key']
    if k.endswith('bif'): continue
    pw = json.load(open(files[k]))['outputs']
    mp = np.array(M[k]['poa']); pp = np.array(pw['poa'])
    pl = pvlib.irradiance.get_total_irradiance(c['tilt'], c['az'], sp['apparent_zenith'], sp['azimuth'], dni, ghi, dhi,
                                               dni_extra=de, airmass=am, albedo=alb, model='perez')['poa_global'].fillna(0).values
    eff = np.array(M[k]['eff']); tc = np.array(M[k]['tcell'])
    dc_mod = eff / 1000 * (1 - 0.0037 * (tc - 25)) * (1 - 0.14)
    dc_pw = np.array(pw['dc']) / 1000
    dc_mod_pwT = eff / 1000 * (1 - 0.0037 * (np.array(pw['tcell']) - 25)) * (1 - 0.14)
    mm = [mp[mon == m].sum() for m in range(12)]; pm = [pp[mon == m].sum() for m in range(12)]
    worst = max(abs(a / b - 1) for a, b in zip(mm, pm) if b > 0)
    dmm = [dc_mod[mon == m].sum() for m in range(12)]; dpm = [dc_pw[mon == m].sum() for m in range(12)]
    dworst = max(abs(a / b - 1) for a, b in zip(dmm, dpm) if b > 0)
    hr_rmse = np.sqrt(np.mean((mp - pp) ** 2)); hr_mbe = np.mean(mp - pp)
    res[k] = dict(poa_pw=pp.sum() / 1000, poa_mod=mp.sum() / 1000, poa_pvlib=pl.sum() / 1000,
                  poa_err=mp.sum() / pp.sum() - 1, poa_worst_month=worst, dc_pw=dc_pw.sum(), dc_mod=dc_mod.sum(),
                  dc_err=dc_mod.sum() / dc_pw.sum() - 1, dc_worst_month=dworst, dc_err_pwT=dc_mod_pwT.sum() / dc_pw.sum() - 1,
                  tc_mean_diff=float(np.mean((tc - np.array(pw['tcell']))[pp > 50])), tc_max_mod=float(tc.max()), tc_max_pw=float(max(pw['tcell'])),
                  rmse=hr_rmse, mbe=hr_mbe)
    r = res[k]
    P(f"tilt {c['tilt']:>4.0f} az {c['az']:>3.0f} | {r['poa_pw']:7.1f} {r['poa_mod']:8.1f} {r['poa_pvlib']:7.1f} | {r['poa_err']*100:+5.1f}%  worst month {r['poa_worst_month']*100:4.1f}%  hourly RMSE {r['rmse']:.0f} W/m2 | {r['dc_pw']:6.0f} vs {r['dc_mod']:6.0f} ({r['dc_err']*100:+.1f}%; with PVWatts cell temp {r['dc_err_pwT']*100:+.1f}%; worst month {r['dc_worst_month']*100:.1f}%)")
P('')
k = 't40_a180'
P(f"Cell temperature, daylight hours (POA>50): sandbox minus PVWatts averages {res[k]['tc_mean_diff']:+.1f} C; hottest hour sandbox {res[k]['tc_max_mod']:.1f} C vs PVWatts {res[k]['tc_max_pw']:.1f} C")
b = np.array(M['t40_a180_bif']['eff']); f = np.array(M['t40_a180']['eff'])
P(f"Bifacial rear credit (bifaciality 0.70, unshaded-ground view factor): +{(b.sum()/f.sum()-1)*100:.1f}% effective irradiance at 40 deg tilt")
if 't40_a180_bif' in files:
    pb = json.load(open(files['t40_a180_bif']))['outputs']; pm1 = json.load(open(files.get('t40_a180_m1', files['t40_a180_bif'])))['outputs']
    P(f"PVWatts bifacial (premium module, bifaciality 0.7) vs same without: +{(sum(pb['dc'])/sum(pm1['dc'])-1)*100:.1f}% DC")
open(os.path.join(H, 'validation_pv.txt'), 'w').write('\n'.join(lines) + '\n')
json.dump(res, open(os.path.join(H, 'validation_pv.json'), 'w'), indent=1)
print('\n'.join(lines))

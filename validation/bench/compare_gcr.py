"""Compares the sandbox's yearly sun on the panel with PVWatts v8 run with widely spaced rows (ground coverage ratio
0.01, the lowest PVWatts accepts), so PVWatts' row-to-row shading is effectively off. Same weather, same site.
Needs model_out.json from validate_pv.py and the pvwg_t*_a180_gcr001.json PVWatts runs. Writes compare_gcr.txt."""
import json, os, glob
import numpy as np

H = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(H, 'model_out.json')))
mon = np.repeat(np.arange(12), [d * 24 for d in [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]])
L = ['PVWatts v8 with gcr 0.01 (rows widely spaced) vs the sandbox, tilt facing south, yearly sun on the panel in kWh/m2',
     'Default-spacing PVWatts (gcr 0.4) shown for comparison where saved.', '']
rows = []
for f in sorted(glob.glob(os.path.join(H, 'pvwg_t*_a180_gcr001.json')), key=lambda s: int(os.path.basename(s)[6:].split('_')[0])):
    d = json.load(open(f)); t = int(os.path.basename(f)[6:].split('_')[0]); k = f't{t}_a180'
    if 'outputs' not in d or k not in M: continue
    pp = np.array(d['outputs']['poa']); mp = np.array(M[k]['poa'])
    worst = max(abs(mp[mon == m].sum() / pp[mon == m].sum() - 1) for m in range(12) if pp[mon == m].sum() > 0)
    dflt = None
    df = os.path.join(H, f'pvw_t{t}_a180.json') if t != 40 else os.path.join(H, '..', 'pvw.json')
    if os.path.exists(df):
        dd = json.load(open(df))
        if 'outputs' in dd: dflt = sum(dd['outputs']['poa']) / 1000
    r = dict(tilt=t, pvw_gcr001=pp.sum() / 1000, sandbox=mp.sum() / 1000, diff_pct=(mp.sum() / pp.sum() - 1) * 100,
             worst_month_pct=worst * 100, pvw_default=dflt, version=d.get('version'), gcr=d['inputs'].get('gcr'))
    rows.append(r)
    L.append(f"tilt {t:>2}: PVWatts gcr 0.01 {r['pvw_gcr001']:7.1f}  sandbox {r['sandbox']:7.1f}  diff {r['diff_pct']:+.2f}%  worst month {r['worst_month_pct']:.1f}%"
             + (f"  (PVWatts default spacing {dflt:.1f})" if dflt else ''))
open(os.path.join(H, 'compare_gcr.txt'), 'w').write('\n'.join(L) + '\n')
json.dump(rows, open(os.path.join(H, 'compare_gcr.json'), 'w'), indent=1)
print('\n'.join(L))

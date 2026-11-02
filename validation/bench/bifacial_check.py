"""Rear-side (bifacial) check: the sandbox's view-factor rear irradiance against pvlib's
infinite_sheds model on the same Honesdale weather. pvlib models a row's own shadow on the ground
and the ground area the rear side can see; the sandbox formula does not, so it should read high.
Writes bifacial_check.txt."""
import json, os, subprocess
import numpy as np, pandas as pd, pvlib
from pvlib.bifacial import infinite_sheds

H = os.path.dirname(os.path.abspath(__file__))
base = json.load(open(os.path.join(H, '..', 'pvw.json')))
st = base['station_info']; ob = base['outputs']
times = pd.date_range('2019-01-01 00:30', periods=8760, freq='h', tz='Etc/GMT+5')
loc = pvlib.location.Location(st['lat'], st['lon'], tz='Etc/GMT+5', altitude=st.get('elev') or 0)
sp = loc.get_solarposition(times)
dni = pd.Series(ob['dn'], index=times); dhi = pd.Series(ob['df'], index=times)
ghi = dni * np.cos(np.radians(sp['apparent_zenith'].clip(upper=90))) + dhi
alb = pd.Series(ob['alb'], index=times)
de = pvlib.irradiance.get_extra_radiation(times)
am = pvlib.atmosphere.get_relative_airmass(sp['apparent_zenith'])

cfgs = [{'key': 'b%d' % t, 'tilt': t, 'az': 180, 'mount': 'open', 'bif': 0.7} for t in (20, 40, 60)]
cfgs += [{'key': 'f%d' % t, 'tilt': t, 'az': 180, 'mount': 'open', 'bif': 0} for t in (20, 40, 60)]
subprocess.run(['node', os.path.join(H, 'run_model.js'), json.dumps(cfgs)], check=True)
M = json.load(open(os.path.join(H, 'model_out.json')))
out = []
P = out.append
P('Bifacial rear-side check, Honesdale weather year, facing south, bifaciality 0.70')
P('Rear gain = extra effective irradiance from the back side, as a % of the front side.')
P('pvlib infinite_sheds: panel 1.72 m long (Renogy 400 W), lowest edge 0.5 m above ground.')
P('An isolated row is approximated with a very wide row spacing (ground coverage ratio 0.05).')
res = {}
for t in (20, 40, 60):
    sand = (np.array(M['b%d' % t]['eff']).sum() / np.array(M['f%d' % t]['eff']).sum() - 1) * 100
    L = 1.722
    h = 0.5 + L / 2 * np.sin(np.radians(t))  # height of row centre
    row = []
    for gcr in (0.05, 0.3):
        r = infinite_sheds.get_irradiance(surface_tilt=t, surface_azimuth=180, solar_zenith=sp['apparent_zenith'],
                                          solar_azimuth=sp['azimuth'], gcr=gcr, height=h, pitch=L / gcr, ghi=ghi, dhi=dhi,
                                          dni=dni, albedo=alb, model='isotropic', dni_extra=de, iam_front=1.0, iam_back=1.0,
                                          bifaciality=0.7, shade_factor=-0.02, transmission_factor=0)
        front = r['poa_front'].fillna(0).values.sum(); back = r['poa_back'].fillna(0).values.sum()
        row.append(0.7 * back / front * 100)
    res[t] = dict(sandbox=sand, pvlib_isolated=row[0], pvlib_gcr03=row[1])
    P(f'tilt {t:2d}: sandbox +{sand:4.1f}%   pvlib isolated row +{row[0]:4.1f}%   pvlib rows at GCR 0.3 +{row[1]:4.1f}%')
json.dump(res, open(os.path.join(H, 'bifacial_check.json'), 'w'), indent=1)
open(os.path.join(H, 'bifacial_check.txt'), 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))

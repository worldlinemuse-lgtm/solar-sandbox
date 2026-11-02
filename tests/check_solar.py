"""Reruns the solar check against pvlib and fails if the sandbox's yearly sun on the panel differs from pvlib by more than
0.5% at any tilt. Usage: python tests/check_solar.py   (from the site folder)"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, 'validation', 'bench')
out = subprocess.run([sys.executable, os.path.join(B, 'validate_pv.py')], capture_output=True, text=True, cwd=B, check=True).stdout
rows = []
for line in out.splitlines():
    m = re.match(r'\s*tilt\s+(\d+)\s+az\s+(\d+)\s*\|\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)', line)
    if m:
        tilt, az, pvw, sand, pvl = int(m[1]), int(m[2]), float(m[3]), float(m[4]), float(m[5])
        rows.append((tilt, az, sand, pvl, abs(sand - pvl) / pvl * 100))
for r in rows:
    print(f'tilt {r[0]:>2} az {r[1]}: sandbox {r[2]:.1f}  pvlib {r[3]:.1f}  diff {r[4]:.3f}%')
bad = [r for r in rows if r[4] > 0.5]
ok = len(rows) >= 5 and not bad
# Against PVWatts with widely spaced rows (ground coverage ratio 0.01), so its row-to-row shading is off.
g = subprocess.run([sys.executable, os.path.join(B, 'compare_gcr.py')], capture_output=True, text=True, cwd=B, check=True).stdout
gt = [float(m[1]) for m in re.finditer(r'diff ([+-][\d.]+)%', g)]
print(g.strip().splitlines()[-1] if gt else 'no PVWatts widely spaced rows runs found')
ok = ok and len(gt) >= 4 and all(abs(x) <= 0.5 for x in gt)
print(f'PVWatts widely spaced rows: {len(gt)} tilts, largest difference {max(map(abs, gt)) if gt else float("nan"):.2f}%')
# The physics file the checks test must be the one built into the page.
src = os.path.join(ROOT, 'source', 'physics.js')
if os.path.exists(src):
    same = open(src, 'rb').read() == open(os.path.join(ROOT, 'validation', 'physics.js'), 'rb').read()
    print('validation/physics.js is the same as source/physics.js' if same else 'validation/physics.js DIFFERS from source/physics.js')
    ok = ok and same
print('solar check', 'passed' if ok else 'FAILED', f'({len(rows)} orientations)')
sys.exit(0 if ok else 1)

"""Builds the one-file page from the source files in this folder.

    python source/build.py            writes index.html next to this folder
    python source/build.py out.html   writes it somewhere else
    python source/build.py --check    builds in memory and checks it is byte-for-byte the same as index.html

template.html holds the page layout, styles and controls, with placeholders where each part goes in:
__TMY__ tmy.js (typical-year weather), __PHYS__ physics.js (sun on the panel and panel temperature),
__BATT__ battery.js (battery models), __ELEC__ elec.js (wires, fuses, inverter), __HIST__ hist.js (25 recorded winters),
__SNOW__ snowhist.js (recorded daily snowfall), __SIMJS__ sim.js (the simulator and the page logic), and
__AUDIO_SRC__ guide.mp3 (the voice guide, put in as base64 so the page needs no other file).
Needs only Python 3, no other packages."""
import base64, hashlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = {'__TMY__': 'tmy.js', '__PHYS__': 'physics.js', '__BATT__': 'battery.js', '__ELEC__': 'elec.js',
         '__HIST__': 'hist.js', '__SNOW__': 'snowhist.js',
         '__NEXTCORE__': 'next-core-browser.js', '__SIMJS__': 'sim.js'}


def build():
    t = open(os.path.join(HERE, 'template.html'), encoding='utf-8', newline='').read()
    for k in list(PARTS) + ['__AUDIO_SRC__']:
        assert t.count(k) == 1, f'{k} should appear once in template.html, found {t.count(k)}'
    # Deterministic provenance. Do not insert wall-clock build times: identical inputs must
    # generate byte-for-byte identical offline apps and machine-verifiable source digests.
    manifest_files = sorted(set(PARTS.values()) | {'guide.mp3', 'template.html', 'build.py'} |
        {'next-core/' + f for f in os.listdir(os.path.join(HERE, 'next-core')) if f.endswith('.ts')})
    source_sha256 = {
        f: hashlib.sha256(open(os.path.join(HERE, f), 'rb').read()).hexdigest()
        for f in manifest_files
    }
    revision_sha256 = hashlib.sha256(json.dumps(source_sha256, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()
    manifest = {
        'schema': 1, 'revision_sha256': revision_sha256, 'source_sha256': source_sha256,
        'validation': 'Internal invariants and independent manufacturer/table reference fixtures; not field-calibrated',
        'weather_provenance': 'Read the bundled README for PVWatts/NSRDB typical-year and NASA POWER modeled historical inputs',
        'assumptions': ['Load schedules are estimated', 'Motor startup VA and short time-scale behavior not validated',
                        'Battery taper and aging contain estimated coefficients', 'Generator refueling downtime omitted',
                        'Site-level shade and meteorology not calibrated']
    }
    assert t.count('__PROVENANCE__') == 1
    out = t.replace('__PROVENANCE__', 'window.SIM_PROVENANCE=' + json.dumps(manifest, sort_keys=True, separators=(',', ':')) + ';')
    for k, f in PARTS.items():
        out = out.replace(k, open(os.path.join(HERE, f), encoding='utf-8', newline='').read())
    aud = 'data:audio/mpeg;base64,' + base64.b64encode(open(os.path.join(HERE, 'guide.mp3'), 'rb').read()).decode()
    out = out.replace('__AUDIO_SRC__', aud)
    assert out.lower().count('<!doctype') == 1 and out.count('</html>') == 1
    return out.encode('utf-8')


if __name__ == '__main__':
    page = build()
    target = os.path.join(HERE, '..', 'index.html')
    if len(sys.argv) > 1 and sys.argv[1] == '--check':
        same = open(target, 'rb').read() == page
        print('index.html matches the source build' if same else 'index.html DIFFERS from the source build')
        sys.exit(0 if same else 1)
    if len(sys.argv) > 1:
        target = sys.argv[1]
    open(target, 'wb').write(page)
    print(f'wrote {os.path.abspath(target)} ({len(page):,} bytes)')

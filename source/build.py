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
import base64, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = {'__TMY__': 'tmy.js', '__PHYS__': 'physics.js', '__BATT__': 'battery.js', '__ELEC__': 'elec.js',
         '__HIST__': 'hist.js', '__SNOW__': 'snowhist.js', '__SIMJS__': 'sim.js'}


def build():
    t = open(os.path.join(HERE, 'template.html'), encoding='utf-8', newline='').read()
    for k in list(PARTS) + ['__AUDIO_SRC__']:
        assert t.count(k) == 1, f'{k} should appear once in template.html, found {t.count(k)}'
    out = t
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

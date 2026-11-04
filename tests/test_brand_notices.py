"""Keep independent-brand/copyright disclosures in the source and generated site.

This is a regression check for publication of notices, not legal certification.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
template = (ROOT / "source" / "template.html").read_text(encoding="utf-8")
generated = (ROOT / "index.html").read_text(encoding="utf-8")
readme = (ROOT / "README.md").read_text(encoding="utf-8")
rights = (ROOT / "docs" / "BRAND_AND_CONTENT_RIGHTS.md").read_text(encoding="utf-8")

required_html = (
    'id="brand-rights"',
    'not affiliated with, sponsored by, endorsed by, certified by or approved by',
    'Trademarks belong to their respective owners',
    'NASA POWER',
    'PVWatts',
    'docs/BRAND_AND_CONTENT_RIGHTS.md',
)
for item in required_html:
    assert item in template, f"Missing source disclosure: {item}"
    assert item in generated, f"Missing bundled disclosure: {item}"

assert "unverified ownership/redistribution permissions" in readme
assert "source/guide.mp3" in rights
assert "source/tmy.js" in rights
assert "Disclaimers and citations cannot cure unlicensed use" in rights
print("Brand/content-rights notices and rights inventory present in published app.")

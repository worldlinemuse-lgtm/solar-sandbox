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
full_notice = (ROOT / "docs" / "LEGAL_NOTICES_AND_DISCLAIMERS.md").read_text(encoding="utf-8")
terms = (ROOT / "docs" / "TERMS_OF_USE_PREPUBLICATION_DRAFT.md").read_text(encoding="utf-8")
for phrase in (
    'id="legal-complete"',
    "Electrical danger and professional installation",
    "Brands, trademarks and independent status",
    "Copyright, audio and third-party intellectual property",
    "Weather and historical-risk limitations",
    "Warranty disclaimer, subject to mandatory rights",
    "Liability limitations and non-waivable rights",
    "This public disclosure is not a negotiated or accepted Terms of Use contract",
):
    assert phrase in template, f"Missing complete legal notice from source: {phrase}"
    assert phrase in generated, f"Missing complete legal notice from published bundle: {phrase}"
assert full_notice.count("## ") >= 16
assert "NOT OPERATIVE / NOT FOR LIVE PUBLICATION" in terms
assert "Disclaimers and citations cannot cure unlicensed use" in rights
print("Brand/content-rights notices and rights inventory present in published app.")

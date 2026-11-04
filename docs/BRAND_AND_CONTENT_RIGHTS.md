# Brand independence, third-party content and rights review

**Scope:** Solar Sandbox, the GitHub Pages app and all files in this repository.  
**Review date:** 2026-11-04.  
**Status:** Disclosure in progress; **not cleared for commercial release**. This document records observed assets and unresolved provenance rather than representing a legal opinion or warranty.

## Independent project; nominative use of trademarks

Solar Sandbox is an independent comparison and simulation project. It is **not affiliated with, sponsored by, endorsed by, certified by or approved by** any manufacturer, retailer, technical standards organization or government agency referenced in the application. In particular, references to LONGi, Victron Energy, Renogy, Battle Born Batteries, LiTime, Honda, Blue Sea Systems, HP, Starlink, PVsyst, NASA POWER, PVWatts and other third parties identify products, data or reference tools. Those names and any associated trademarks belong to their respective owners.

Names and model numbers are used for factual product identification and comparison only. The application should **not use third-party logos, trade dress, product photography, screenshots, marketing illustrations, or copied promotional prose** unless the project has documented permission or a license granting the intended use. A link or attribution alone is not permission to copy the underlying material. Do not suggest an approval relationship or use government seals/insignia as product branding.

Manufacturer specifications, costs and availability are subject to revision. A quoted number is not confirmation of endorsement or of the safety or suitability of a specific installation. Before purchases or construction, verify the exact part variant against current original manufacturer documentation.

## Data references and scientific acknowledgements

- **NASA POWER:** The embedded historical weather arrays and snowfall inputs identify NASA POWER (Prediction Of Worldwide Energy Resources) hourly and daily services as their sources; the repository metadata says retrieved October 30–31, 2026, near 41.577° N / 75.258° W. Acknowledge NASA Langley Research Center's POWER project, funded through NASA Earth Science Division. Source: https://power.larc.nasa.gov/ ; recommended referencing guidance: https://power.larc.nasa.gov/docs/referencing/ . The original complete hourly API request and exact service version/time-standard provenance have **not** been archived, so they must not be fabricated.
- **PVWatts / NSRDB:** The bundled typical meteorological year identifies PVWatts v8 output derived from NSRDB PSM v3 TMY. Source: https://pvwatts.nlr.gov/ and https://nsrdb.nrel.gov/ . Confirm the applicable dataset/API terms and archive the underlying request and provider notice before commercial redistribution; a link is not a complete license review.
- **pvlib:** Tests compare independently implemented formulas with pvlib. Documentation: https://pvlib-python.readthedocs.io/ . If any third-party source code is copied or bundled in the future, record and comply with its exact license and notices.
- **PVsyst reference points:** The repository records five numerical reference observations from a published module report in `validation/next-core/pv-pvsyst-435m.json`. These numerical values serve as facts for comparison; do not embed or reproduce the vendor's proprietary PDF, graphs, screenshots or substantial protected expression without a suitable authorization. Source and date are in that JSON file.
- **Maker manuals and other linked materials:** External links point users to documents published by their respective owners. The link does not license their images, text, tables or brand marks for redistribution. The application should use independently authored summaries and factual equipment ratings.

Names such as NASA and PVWatts do **not** imply government sponsorship or independent certification of this simulator. No NASA insignia, seal or data insignia is authorized for the project's branding.

## Asset-by-asset provenance register

| Asset(s) | Observed use | Rights evidence | Release action |
| --- | --- | --- | --- |
| `source/template.html`, `source/sim.js`, physics engine and supporting code | Publicly viewable app code | Contributor-by-contributor authorship and inherited code licenses have **not** been independently audited | Verify authorship, provenance and copied snippets; choose project license **only after** rights review |
| `source/guide.mp3` (about 1.12 MB) and inlined `index.html` audio | Voice guide distributed both as binary and embedded base64 | **UNKNOWN** creator, source recording, voice/TTS service terms, commercial rights and redistribution grant | **BLOCKER:** document owner/origin and commercial distribution rights, or replace with provably original/licensed audio and remove unauthorized public distributions; note that older git commits may still contain it |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | App icons | `tests/make_icons.py` draws a generic sun-and-battery icon in code; author/contributor ownership still should be confirmed | Keep generic branding; verify source history and any external art dependencies |
| `source/tmy.js` | Bundled PVWatts/NSRDB-based weather data | Source and request metadata recorded; redistribution terms not fully verified | **BLOCKER for commercial use:** retain source attribution and verify applicable provider/dataset terms and any required notices |
| `source/hist.js`, `source/snowhist.js` | Bundled NASA POWER arrays | Identified NASA data source, location and retrieval dates; original exact API request/version partially missing | Complete provider citation and request provenance; no government branding/endorsement claims |
| `validation/next-core/pv-pvsyst-435m.json` | Five numerical equipment-model reference points | Source URL/date recorded, no vendor PDF itself committed | Use only factual measurements or numerical points; independently review source rights before adding any vendor graphics |
| Named products and source URLs in `source/sim.js` | Product identification, short descriptions and citation links | Brand names and product ratings are not by themselves proof of permission to reuse creative assets | Use factual identifiers and independent summaries; no logos, misleading claims or wholesale marketing copy |
| External tools used in CI (TypeScript, esbuild, pvlib, Playwright, Python packages) | Build and validation tooling | Exact third-party version/license inventory not yet filed | Check notices and licenses if code/assets are redistributed; build tools used without bundling are a different case |

**No top-level LICENSE file was found in the repository at this review.** Do not infer that a public GitHub repository is public domain or that it grants a commercial software license. The repository owner must choose a license only for material they have authority to license; third-party content remains under its own terms.

## Minimum release checklist

- [ ] Establish authorship/licensing rights for every distributed file, including the voice guide and prior imported code; retain proof.
- [ ] Confirm NASA POWER, PVWatts/NSRDB and other data terms for the exact use, especially commercial distribution and offline copies.
- [ ] Ensure no unlicensed third-party images, brand logos, graphics, marketing descriptions, fonts, sound recordings, software or proprietary tables are embedded.
- [ ] Verify each third-party software dependency and reproduce required notices for all redistributed software.
- [ ] Retain prominent brand independence / no-endorsement text in the live app and source listings.
- [ ] Choose a software license intentionally after verifying ownership and contributor rights; do not automatically license data or brand marks under the same terms.
- [ ] Record license URL, version, source, date checked, commercial-redistribution scope, authorized use and supporting evidence for every third-party asset.
- [ ] Have an IP attorney review the final inventory if selling subscriptions, distributing commercially, or publishing in an app store.

**Crucial:** Disclaimers and citations cannot cure unlicensed use. Until the unresolved items are reviewed, this is a **risk-reduction and disclosure change, not a declaration of legal compliance**.

## Reference guidance

- US Copyright Office (facts versus expression): https://copyright.gov/help/faq/faq-protect.html
- US Copyright Office (fair use and its limits): https://www.copyright.gov/help/faq/faq-fairuse.html
- INTA (nominative trademark fair use): https://www.inta.org/fact-sheets/fair-use-of-trademarks-intended-for-a-non-legal-audience/
- NASA brand restrictions: https://www.nasa.gov/nasa-brand-center/
- GitHub repository licensing: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository

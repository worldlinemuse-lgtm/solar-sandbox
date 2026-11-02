# Independent reference fixtures and limits

Status: **published-specification reference tests, not field calibration**.

`validation/reference_fixtures.json` stores a small curated set of published numerical values with the issuer, precise scope, and source links. `tests/test_reference_fixtures.py` compares these inputs against the actual bundled browser application and checks model/source SHA-256 fingerprints.

| Area | Authority | What is independently checked | Not established |
| --- | --- | --- | --- |
| SmartSolar MPPT 150/70 VE.Can | Victron technical manual | 70 A charge current, 150 V absolute / 145 V operating limit, 50 A PV short-circuit current, nominal PV power and 98% **peak** efficiency | Actual conversion efficiency at each load/temperature, exact connector type, hardware suitability |
| Copper/aluminum base ampacity | Cerrowire reproduction of NEC Table 310.16 | Selected 60/75 °C table cells | Full installation compliance, terminal certification, actual conductor temperature |
| Copper DC resistance | University of Maryland Extension, NEC Ch 9 Table 8 | 10 AWG stranded conductor 1.24 Ω per 1,000 ft at 75 °C and algebraic round-trip V drop / I²R | Measured losses with splices and changing operating temperatures |
| SmartSolar 150/35 discrepancy | Victron manual (35 A), 2025 Victron brochure (40 A) | Explicitly mark 35–40 A as **not verified** | Which rating applies without specific part number/revision |

The figures above **do not** independently validate the household simulation against physical PV, battery and inverter instrumentation. The distinction matters: matching an analytical fixture confirms the implementation and source transcription, not real-world calibration.

## Reproducible model fingerprint

The self-contained page includes `window.SIM_PROVENANCE`, embedded at build time. It has a stable `revision_sha256` calculated from the SHA-256 digests of every editable engine/dataset source file, the page template, the builder, and the voice guide. Identical source bytes yield identical fingerprints. A saved design includes this complete provenance record; the CI historical-winter report also embeds it.

This is **not a digital signature**: a malicious editor could replace both code and hashes. It is a reproducibility and accidental-drift mechanism, not a claim of code security.

## Remaining P0 validation dependencies

- Measured or separately simulated full-system DC and AC transfer curves, including battery BMS, high/low temperature and inverter peak/VA response.
- Full audit of each manufacturer catalog entry, including hardware **variant and revision**, and confirmed missing limits.
- Inputs for real roof/yard shading, snow and local irradiance, with uncertainty intervals; a NASA POWER pixel is not a rooftop instrument.
- Generator fuel consumption and attended refueling modeled as bounded scenarios; current runtime approximations may be optimistic.
- Battery aging is only a scenario heuristic; no verified temperature/cycle degradation curve exists for every catalog product.

Until those are addressed, the household optimizer remains blocked. The benchmark CI gate prevents regression of published constants and circuit mathematics; it must not be represented as full-system certification.

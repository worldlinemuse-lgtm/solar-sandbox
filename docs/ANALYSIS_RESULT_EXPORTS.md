# Reproducible simulation result exports

The simulator's historical winter and battery-aging screens can export completed analysis results as JSON. The buttons are disabled until a full calculation completes. If a calculation is canceled, its inputs change, or a different load pattern is selected, previously completed outputs are invalidated and the export buttons are disabled.

## Report schema

Each JSON report includes:

- `kind: "analysis"`, `schema: 1` and explicit analysis type.
- `model_provenance`: exact SHA-256 source file digests and composite model revision for the offline app running the calculation.
- `design`: full versioned design snapshot, with system configuration and current appliances.
- `appliance_patterns`: exact modeled loads for each historical batch (food/furnace/custom) or aging study.
- `weather`: data product, full list of modeled historical winter years, Nov 1–Feb 28 simulation horizon, and how the typical meteorological year is used.
- `initial_conditions`: model start conditions, generator operating mode, generator fuel and the disabled random-snow event assumption, where relevant.
- `results`: all historical per-winter run values and summaries, or aging annual throughput plus its per-age historical-run results.
- `calibration` and `limitations`: explicit warning that this is an engineering model, not field-calibrated performance verification.

A result is **reproducible only against the same modeled source revision and original assumptions**. Different catalog revisions, imported data, or physical equipment measurements can change the outcome. The hash is an accidental-drift marker, not a cryptographic attestation of the author's identity.

## Test

Run `python tests/test_analysis_exports.py` after `python source/build.py` and a Playwright Chromium installation. The CI test covers JSON download, content, immutable snapshots, matching source hash, known year list, and invalidation after changes.

## Exit limitations

- Published reference fixtures and internal physical conservation tests already pass.
- The PV solar reference comparison is useful but does **not** verify actual site irradiance or roof snow dynamics.
- Neither manufacturer specifications nor numerical equations replace measured DC and AC transient responses, battery charge/temperature curves, or generator run/stop behavior.
- No claim is made that these recorded outcomes are future probabilities or guaranteed runtime.

**Release gate for optimizer/planner remains open:** actual or trusted independent physical performance fixtures must be incorporated with documented tolerances before sizing hardware for reliable household backup.

## Saved-file model revision compatibility

Imported **design files** retain their component and load specifications, but the app warns when the recorded model revision differs from the running simulator or is absent. Existing historical results must not be treated as comparable without rerunning. For **saved dynamic simulation states**, a known revision mismatch is rejected *before any state/configuration mutation*. Import the saved design instead. Legacy state files without revision information remain importable for backward compatibility; their reproducibility cannot be confirmed.

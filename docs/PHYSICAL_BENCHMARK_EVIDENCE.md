# Physical benchmark and site-calibration evidence

## Reference validation performed

The LONGi LR4-72HBD-435M one-diode model is compared against **five independent published PVsyst V6.80 curves** at irradiances 200, 400, 600, 800 and 1,000 W/m², 25 °C cell temperature. The manufacturer-derived PVsyst diode parameters are reproduced in `source/next-core/pv-diode.ts`; the reference data and original PDF URL are preserved in `validation/next-core/pv-pvsyst-435m.json`.

This is **R1 model-agreement validation** at controlled reference conditions, not empirical field accuracy. A 2% relative tolerance accounts for published parameter rounding and differences in PVsyst's complete irradiance model.

Time-dependent module power outside STC requires temperature and irradiance assumptions. PV module DC maximum is not equivalent to battery charge power. Actual controller conversion efficiency, wiring losses, battery BMS limits and load-driven MPPT curtailment all affect delivered energy.

## R0 measurement evidence needed to finish physical calibration

A physical calibration package must contain *measured, instrument-identifiable observations*:

| Test | Required independent observables |
| --- | --- |
| PV module and controller | Irradiance in W/m², panel/cell temperature, Voc/Isc or measured I–V sweep, MPPT DC input V/I, MPPT output V/I, device ID and timestamps |
| Battery | Cell/battery temperature, OCV versus SoC, terminal V/I, coulomb throughput, charge/discharge histories, BMS trip and recovery events |
| Inverter and AC loads | DC input V/I, AC real W and VA with measured PF, surge waveform (including duration), independent L1/L2 currents and transfer states |
| Generator | True electrical output W/VA, tank fuel consumption versus load, load rejection, manual start/stop, power transfer and refueling duration |
| Weather | Raw API request, source version, grid, time standard, site altitude, independent rooftop shading and irradiance if available |

Each measurement should preserve instrument serial number, manufacturer/model, calibration certificate/date if relevant, sample interval, uncertainty and the original raw file hash. A result compared to synthetic fixtures, simulations, or uncalibrated estimates cannot be classified `R0_measured`.

**There are currently zero independent instrumented whole-system measurement datasets in this repository.** No amount of self-consistency testing will substitute for these missing observations. Therefore the new engine is integrated as a read-only browser shadow diagnostic, and the live legacy solver remains authoritative only as an **estimated** model—not a certified physical prediction.

## Browser integration

The static site's builder embeds a deterministic, pinned esbuild bundle compiled from the TypeScript core. `window.SolarNextCore.shadowPv` computes a separate upper-generation envelope for the exact LONGi 435 / Victron 150/70 reference hardware. `SIM.nextCoreShadow()` queries the current design's previous completed timestep **without modifying simulation state**. It refuses unsupported hardware, snow-covered conditions and invalid controller voltage/current combinations. It explicitly warns that it inherits the original simulator's irradiance and cell-temperature data, so it is not an independent weather benchmark.

The new engine also exposes `runReferenceIsland` for mathematical fixture evaluation; it is **not wired as the production power dispatch engine**. The production replacement, planner and optimizer are blocked by `validation/next-core/coverage.json`.

## Test and verification sequence

1. Run the strict TypeScript and Node suite; validate the five external PVsyst points and existing independent pvlib tests.
2. Regenerate `source/next-core-browser.js` with pinned esbuild and verify it matches committed bytes.
3. Rebuild `index.html` with Python and check byte-for-byte identity plus all source fingerprints.
4. Run Chromium/Playwright to prove the bridge is present, outputs are evidence-labeled, and calling it does **not** mutate the live configuration, battery or generator state.
5. Run existing 50 modeled-winter and PWA tests; do not claim that these establish site-level empirical accuracy.
6. Permit production engine replacement only after instrumented validation covers the required device/topology domains and uncertainties.

# Next-generation typed engine — implementation and correctness contract

**Status (2026-11-03):** Independent reference/core implemented in `source/next-core/`, not the live simulator. It is deliberately a **reference-only, mathematically tested approximation** until a physical calibration suite is available. Full system planner and automatic optimizer remain blocked.

## Architectural decision

The production one-file `index.html` and legacy `source/sim.js` stay stable. TypeScript source is the sole authority for the new computational engine; the Node CI job compiles it into an ephemeral `.next-core-dist/` directory with `typescript@5.8.3`, then runs Node's native test runner against the compiled implementation. No generated JS from the new engine is yet embedded into the existing UI; this prevents a partially validated core from changing household sizing results. The Python-only production website build remains unchanged.

No runtime web requests, external server, UI globals, or random number generators occur inside the new core. Its functions accept immutable objects and return new state and ledgers.

## Implemented modules, equations, and fail-closed behavior

| File | Equations | Verification and limitations |
| --- | --- | --- |
| `numerical.ts` | Stable quadratic (I=2P/(V_{oc}+\sqrt{V_{oc}^2-4RP})), wire delivery (P=VI+I^2R), electrical balance | Reject negative discriminants/infeasible currents; independent root fixtures |
| `solar.ts` | (P_{PV}=V_{mp}I-I^2R_{pv}), (P_{MPPT,out}=\eta P_{in}), (P_{bus}=VI), cable (I^2R), output current cap | Actual operating current, not full theoretical MPP, determines losses. **Fixed-Vmp approximation**, no diode curve/MPPT tracking or proven partial-load efficiency |
| `battery.ts` | (V=V_{oc}-IR), (P=VI), (z_{next}=z-I_{eff}\Delta t/(3600Q)) | Charge/discharge ports independent; current/voltage bounds; exact boundary time; OCV/R/charge efficiency still require empirical calibration |
| `ac.ts` | (S=\sqrt{P^2+Q^2}); real, apparent, per-leg constraints; startup VA/PF/duration | No conversion of VA to W; unknown peak-VA or duration must never count as a verified motor start; inverter efficiency currently a labeled estimate |
| `generator.ts` | Finite fuel (F_{next}=F-\dot F(P)\Delta t/3600); start/cool/refuel state machine | Two Honda operating anchors; timing and intermediate fuel values R3 assumed; fuel exhaustion splits a timestep; reserve gallons are separate from tank |
| `weather.ts` | Exact integration of hourly **means**, with explicit time standards | NASA hourly time defaults to LST. Source request parameters absent from historical embedded file: original clock standard is **UNKNOWN** and must not be silently treated as U.S. Eastern time |
| `solar-thermal.ts` | Sandia (T_m=T_a+E e^{a+bv}), (T_c=T_m+E\Delta T/1000) | PVPMC/NLR parameters distinguish dual-glass open rack from glass/polymer and close mount |
| `island.ts` | AC ledger, DC bus, battery chemical/thermal, PV potential and curtailment; adaptive split at SoC and generator event boundaries | **Single-phase reference-only**. Generator-to-battery charger and unverified 120/240 transfer are explicitly indeterminate. Motor-start waveforms are not silently modeled by 60-s calculations |

## Source and assumptions

Manufacturer and NASA evidence, R0–R3 evidence classification, unverified assumptions and explicit blockers are recorded in `validation/next-core/reference_points.json` and `validation/next-core/weather-audit.json`.

- Victron MultiPlus-II 120 V official technical manual: https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html
- Victron MPPT 150/70 official manual: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html
- Honda EU2200i official specifications: https://direct.powerequipment.honda.com/generators/models/EU2200i
- NASA POWER hourly clock documentation: https://power.larc.nasa.gov/docs/services/api/temporal/hourly/
- Sandia PVPMC temperature reference: https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/module-temperature/sandia-module-temperature-model/
- Source model reference: https://github.com/pvlib/pvlib-python/blob/main/pvlib/temperature.py

## Automated acceptance

`tsc --project tsconfig.next-core.json` compiles the implementation with strict TypeScript checking. `node --test tests/next-core/*.test.cjs` requires independent analytical fixtures, thousands of deterministic randomized physical-conservation checks, battery reserve events, data provenance restrictions and generator operating transitions. Existing legacy 50-winter, PV reference, saved-file, PWA and full browser suites remain mandatory.

## Open release blockers

1. Actual equipment-dependent PV full I–V behavior and MPPT voltage/thermal limits.
2. Independent battery OCV–SOC–temperature curves, BMS port dynamics, charge taper and degradation data.
3. Device-specific inverter efficiency curve and time/temperature-dependent peak W **and** peak VA; subminute motor-start events.
4. True generator/charger/transfer topology, operator refueling delays, part-load fuel curves.
5. Archived exact historical NASA POWER API request and complete location/time-series metadata (otherwise clock-sensitive validation is blocked).
6. Complete topology matrix, physical instrument comparison, uncertainty quantification and pre-release shadow-mode comparisons with legacy model.
7. Household planner, optimizer and product UX migration are **not started**, per physical-validation gate.

The new numerical code is not permission to use the live site for certification, installer design or guaranteed backup runtime.

## November 3 integration milestone: read-only browser shadow

The project now embeds the TypeScript engine in the standalone webpage using an explicitly pinned esbuild IIFE. The Python `source/build.py` deterministic build records SHA-256 digests for **each TypeScript source and browser bundle**, as well as all existing weather and model files. Recompiling the bundle differently fails CI. Standalone operation remains offline-compatible; the browser bundle is an inline script.

`window.SolarNextCore.shadowPv()` supplies an R1-referenced PV maximum-power **envelope**. `SIM.nextCoreShadow()` supplies the selected legacy configuration/last completed timestep for read-only comparison. Neither method updates current load, battery SoC, generator state, fuel supply or existing result displays. The implementation only accepts a documented matching LONGi LR4-72HBD-435M and Victron 150/70; all other equipment is unsupported until independently benchmarked. Missing/unknown physical observations continue to produce indeterminate results, not a fabricated equipment certificate.

The Longi module now has a separate 72-equivalent-cell single-diode model based on PVsyst V6.80 published parameters (0.087 nA I₀, 0.27 Ω Rs, 1000 Ω Rsh, n=1.04), with benchmarked DC MPPs across 200–1,000 W/m² at 25 °C. The original PVsyst five-point reference, source URL and maximum 2% reconstruction deviation are versioned in `validation/next-core/pv-pvsyst-435m.json`. This **is not measured roof-level performance**. See `docs/PHYSICAL_BENCHMARK_EVIDENCE.md`.

A separate numerical defect has also been corrected: the reference generator pass-through path no longer adds inverter and generator power unless validated PowerAssist/parallel behavior exists. In conservative pass-through mode, any generator overload is unserved, not silently topped up by the inverter. MultiPlus PowerAssist capability is published, but its operational constraints depend on configuration, generator quality and BMS state; a generic automatic assumption is not permitted.

Production calculation migration is intentionally gated: `nextCoreCanReplaceLiveEngine=false`. The house planner and optimizer remain disabled. Actual device- and site-specific physical test data are required to change those conditions.

### Charge-efficiency energy balance correction

The battery solver distinguishes gross electrical/OCV conversion from energy **actually stored** after coulombic inefficiency. Under positive discharge-current convention, it enforces
`chemicalStoredPowerW = terminalPowerW + I²R + coulombicChargeLossW`,
including the signed charging case. The same identity is asserted on the integrated island ledger. This prevents a mathematical error where SoC charging efficiency reduced capacity gain without attributing the unretained energy to a loss channel.

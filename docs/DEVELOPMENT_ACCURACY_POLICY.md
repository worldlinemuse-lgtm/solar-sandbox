# Solar Sandbox — mandatory mathematical accuracy policy

**Status:** Engineering development policy; 2026-11-04. **Scope:** All subsequent changes to physics, equipment catalogs, weather inputs, simulation logic, and—eventually—the household planner/optimizer.

## Permanent direction

**We are building a mathematical engineering simulator, not conducting a hardware testing program.** Do not delay development pending user-provided hardware, laboratory measurements, or site instrumentation. Proactively use **real, current, publicly accessible information**: authoritative physics, standard numerical methods, primary research, official manufacturer documentation, and published reference datasets.

Instrumented field measurements are valuable for measuring prediction error on particular installations, but **are NOT a mandatory prerequisite to implementing or verifying an established engineering equation, or to developing the simulation product**. Do not claim a measured prediction-error percentage without suitable independent evidence. Do not confuse mathematical accuracy with certified electrical installation safety.

## Mandatory source and mathematics procedure for EVERY physical subsystem

1. **Find primary sources before writing formulas.** Prefer NREL/NLR SAM/PVWatts, Sandia PVPMC, PVsyst, NASA POWER, NIST, established codes and each manufacturer's technical manuals. Where source editions/revisions differ, preserve the variant rather than blending values.
2. **Write the governing physics first**: complete symbolic formula; parameters; units and dimensional checks; sign conventions; admissible operating domain; boundary behavior; numerical solver; applicable omissions and relevant time scale.
3. **Separate physical laws from product coefficients.** Example: `I²R(T)` is universal, while actual cable resistance and temperature are model inputs. A manufacturer's `98% peak efficiency` does not establish constant 98% efficiency at all loads.
4. **Classify source values**: `direct_published`, `derived_from_published`, `fitted_to_published_curve`, `independent_reference_implementation`, `explicit_scenario_assumption`, or `unknown`. Never silently relabel an assumption as a published manufacturer specification.
5. **Implement exact numerical tests** against analytic limits and a genuinely independent implementation (e.g., pvlib Lambert W versus our diode bisection, SciPy optimizers, independent integrated-energy calculations). Add tests for zero inputs, negatives, limits, clipping, cold/hot extremes, time boundaries, parameter variants and physical invariants.
6. **Validate using published results** with training and held-out published reference points when possible. Clearly distinguish fitting a published curve from measuring physical hardware. Never claim an invented globally accurate percentage.
7. **Don’t conceal missing coefficients.** Use sourced published curves, report credible intervals/scenarios, or return `indeterminate` outside a model’s valid range. Never automatically approve an electrical design where topology, protection, hardware variant or ratings are unknown.
8. **Keep formula math independent from UI and business logic.** First ensure equations and solvers are correct. Next reconcile complete chronological dispatch and converter/BMS state transitions; only afterward construct the household planner and optimizer.
9. **Preserve reproducibility.** Record exact source URLs, source publication/revision dates, dataset API query/time standard, source hashes, equation revisions, model constants and test fixtures. Regenerate the browser bundle and verify generated offline source is byte-identical.
10. **Treat manufacturer documentation as a source of facts, not a license to copy** protected expressive material. Reference it and independently reimplement equations/specifications; keep legal rights checks separate.

## Evidence tiers and release meaning

- **E0 — analytical/numerical:** Dimensional validity, algebraic identities, boundary tests, independent solver agreement.
- **E1 — public engineering reference:** Source-specific manufacturer data, published PVsyst curves, NREL model behavior, independently reproduced output and held-out public reference points.
- **E2 — system integration:** Correctly connected components, losses, time alignment, state transitions, and reproducible end-to-end outputs under fully documented inputs.
- **E3 — optional physical/site validation:** Instrument data from actual installations or lab rigs establishes installation-specific model prediction errors. This can improve a model but is not a gate to implementing E0–E2.

**Product development gating:** The next core may replace the existing logic after E0–E2 are adequately covered for its advertised scope, all critical numerical/product uncertainties are explicit, and component interactions are independently tested. **E3 is not mandatory for mathematical correctness.** Do not label a simulation code- or safety-certified without proper regulatory/electrical approval.

## Concrete references and implementation inventory (November 4, 2026)

| Subsystem | Source | Correct equations/data | Status |
| --- | --- | --- | --- |
| PV single diode | https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/pvsyst-module-model/ | \(I=I_L-I_0[\exp((V+IR_s)/a)-1]-(V+IR_s)/R_{sh}(G)\); source-specific \(I_L\) and exponential \(R_{sh}(G)\) | Implemented in reference; Rsh0 not published for exact LONGi PDF |
| LONGi LR4-72HBD-435M | https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf | 435 W nominal; PVsyst model curves at 200/400/600/800/1000 W/m², 25°C; \(\mu_{Isc}=6.7\) mA/°C; \(\mu_{Voc}=-144\) mV/°C | Exact published constants, fitted *model* Rsh0 against two public curves with 400/800 held out; remaining temperature model separate |
| MPPT control | https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html | \(P_{out}\le\min(P_{in}\eta_{peak},V_{charge}I_{out,max})\); 150/70 98% peak, 70 A out, 150/145 V cold/start limits, 50 A Isc | Upper-bound reference, actual efficiency curve remains unspecified |
| Battery | https://battlebornbatteries.com/wp-content/uploads/2022/10/100Ah-12V-Standard-Battery-Manual_Rev032_1.29.26.pdf ; https://thevenin.readthedocs.io/stable/user_guide/model_description.html ; https://samrepo.nlr.gov/help/battery_storage_btm.html | Exact constant-current Thevenin RC polarization `Vj=I Rj+(Vj0-I Rj)exp(-dt/(Rj Cj))`, `Vt=OCV(SOC)-IR0-sum(Vj)`, signed Coulomb SoC update; BB10012 Rev038 public anchors 100Ah, 7mΩ, 100A continuous/200A 30s | Independent reference equation and source-data anchors implemented; manufacturer OCV(SOC,T), Ri/Ci curves still require separate sources and must NOT be guessed |
| Generator | https://powerequipment.honda.com/generators/models/EU2200i/ | EU2200i 1800W rated, 2200W maximum, .95 gallon tank, 8.1 h @25%/3.2 h @rated | Source-based linear *interpolation* only 450–1800 W; no invented idle consumption |
| Weather | https://power.larc.nasa.gov/docs/services/api/temporal/hourly/ | Hourly averages integrate by area; API defaults to solar LST unless UTC explicitly requested; time standard cannot be guessed | Historical original request not preserved; requires reproducible reimport, **not field instrumentation** |
| Inverter | https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html | Real watts and VA separate; 3k 2400/2200/1700W 25/40/65°C; 5k thermal values are published VA | Independent reference gated for 5k real-W output |
| AC/harmonics | https://standards.ieee.org/ieee/1459/7578/ | Signed var, complex apparent power and unknown distortion burden | Mathematical reference exists; waveform-dependent performance still scoped |

## Remaining technical work after this source-calibration milestone

1. Reconstruct weather archives via documented UTC API requests, preserve query and hashes, verify correctly aligned solar time before 25-winter comparisons.
2. Complete transient/partial-shade module sub-string and bypass-diode physics using source-specific manufacturer characteristics, instead of treating all shade as a scalar power multiplier.
3. Implement published charge-controller/inverter efficiency curves where available; otherwise bound efficiencies and label explicit assumptions, not peak-as-constant.
4. Develop battery OCV(SOC,T), terminal voltage, charge taper, BMS and aging using established model classes and publicly published chemistry/product sources. Missing product curves should not be represented as published.
5. Replace remaining fixed-Vmp source proxies with nonlinear I–V + cable/load coupled solutions and audit energy/current conservation across all components.
6. Test full chronological state transitions—independent of UI—then consider any live engine replacement.
7. Develop household load scheduling and optimization **only after** the E0–E2 model scope is validated.

**No step above requires waiting for the user to buy or instrument equipment.** Externally measured validation remains an optional accuracy-characterization tier, not a development blocker.

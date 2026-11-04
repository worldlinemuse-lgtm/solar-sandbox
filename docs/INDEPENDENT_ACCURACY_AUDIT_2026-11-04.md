# Solar Sandbox: independent mathematical and physical-accuracy gap audit

**Audit date:** 2026-11-04. **Scope:** independently sourced equations, parameter fidelity, physical domains, numerical conditioning, and evidence thresholds. Not a certification of electrical equipment, a code inspection, or instrument-calibrated household forecasts. The active UI/dispatch engine was intentionally **not replaced** in this pass.

## Executive engineering conclusion

**Mathematical conservation is necessary but not sufficient.** A simulation can conserve every watt and still mispredict generation, runtime, short-circuit current, startup, charge taper, inverter output, or fuel consumption because its boundary conditions, source data, operating regime or measured parameters are wrong.

The reference kernel includes independently benchmarked mathematical functions; the **production household simulation remains estimated**. There are **zero independent instrumented whole-system datasets** in this repository. No defensible universal percentage for delivered-energy or backup-runtime accuracy can yet be assigned.

The work in this audit is deliberately two-tier: (1) correct mathematical relationships and expose missing physical data, (2) separately fit/validate real equipment after collecting actual measurements, **before** migrating live dispatch or building an optimizer.

## A. Findings and exact response

| Priority | Finding (why it matters) | Math/reference change | What remains unverified |
| --- | --- | --- | --- |
| Critical | Published 2020 LONGi/PVsyst model's Isc temperature slope is **+6.7 mA/°C**, not the alternate module datasheet's +0.05%/°C. Mixing different parameter revisions corrupts thermal extrapolation. | Corrected `LONGI_435_PVSYST.iscTemperatureCoeffPerC = 0.0067/11.36` and independently updated the pvlib/SciPy benchmark constants. | Whether a real installed panel is *exactly* the 2020 published variant. |
| Critical | Using a physically motivated 1.121 eV Si bandgap in the simplified PV diode model produces an STC Voc slope of approximately **−0.124 V/°C**, versus **−0.144 V/°C** reported in the published PVsyst report. Pmp slope is also too shallow. A five-point irradiance benchmark at 25°C cannot validate thermal behavior. | Added a **separate published-reference temperature-slope inverse fit** with an explicitly labeled *effective thermal activation* (NOT a measured bandgap). It fits only the published Voc slope and **independently checks** the published `−0.0034/°C` Pmp slope. Original model and original bandgap remain identifiable. | Temperature-stratified full I–V curves, Rsh(G,T), module aging, mismatch, actual Si activation, rear gain. Do **not** substitute a fitted derivative for field calibration. |
| Critical | Unknown NASA POWER clock and negative missing-value sentinels can make physically nonsensical energy/time comparisons. NASA hourly API defaults to local SOLAR time, not civil clock time. | Hour-mean integration now rejects unknown time standards, negative irradiance/wind, absolute-zero-violating temperatures, and noninteger timestamp seconds; hourly energy is still the rectangle integral, not interpolation of hourly averages. | Original NASA historical request and source version/time standard, actual gridded-cell vs roof irradiance, civil-time conversions including DST. Existing live historical data remains provenance-blocked. |
| High | AC phasor model previously inferred only **positive inductive reactive power** from unsigned PF; capacitive and inductive load vars can partially cancel on one leg. Harmonics can raise total RMS VA above the fundamental value. | Added separate `assessSignedAcPhasors` with measured **signed var**, correct per-leg P/Q sums, and fundamental apparent VA `sqrt(P²+Q²)`. Unknown harmonic distortion becomes **indeterminate**, not a validated pass. | Harmonic spectrum, crest factor, nonlinear appliance waveform, leading/lagging PF, motor starting waveforms and simultaneous startup time windows. IEEE 1459-2025 governs measurement distinctions. |
| High | Wiring loss `I²R` is only accurate for the **actual conductor resistance** at operating temperature. Air temperature is not conductor temperature. | Added `R(T)=R_ref[1+alpha_ref(T-T_ref)]`, `ΔV=IR(T)`, `P=I²R(T)` with the NIST 100% IACS copper 20°C reference `alpha=.00393/°C`. | Actual wire gauge, strand material/conductivity, copper versus aluminum, both return paths, terminal/contact resistances, thermal conditions and ampacity. |
| **Critical** | The official MultiPlus-II 120 V **3 kVA** row states continuous **W** at 25/40/65°C = **2400/2200/1700 W**, but the separate **5 kVA** row explicitly states **VA** at 25/40/65°C = **4000/3700/3000 VA**; both are not interchangeable. The 5 kVA's separately published maximum operating ambient temperature is **60°C**, despite a 65°C ratings row. The legacy simulator currently labels 5 kVA's 4000 as **watts**, which is **unsupported from this cited table**. | New independent thermal reference is **unit-aware**: 3 kVA checks a real-W envelope plus nominal VA, while 5 kVA checks the published apparent-VA envelope but returns **`indeterminate_real_power`**, never inventing a real-W approval; it also rejects a 5 kVA 65°C operating check (60°C max) as outside operating domain. Conservative next-hotter-anchored comparisons do not extrapolate below 25°C. The live legacy catalog remains unchanged pending explicit model migration. | Actual temperature/firmware variant, installation ventilation, detailed real-W/PF specification for the 5 kVA, current/crest-factor/thermal measurements, surge duration, and any published ratings-sheet discrepancy resolution. |
| High | Victron 150/70 VE.Can **150 V absolute, 145 V startup/operating, 50 A total Isc** are not the whole connection rating. **MC4 version is 30 A per connector**, and the unit needs **Vpv > Vbat+5 V to start; > Vbat+1 V to continue**. | Added separately sourced controller reference checks for start/run, cold Voc, total Isc and **each MC4 input pair**; unknown current distribution returns **indeterminate**. Output current maximum is 70 A, not the same as PV input current or constant 24 V power. | MC4 versus TR actual revision, connectors, string topology, site extreme weather, bypass/ground faults, charge algorithm and dynamic tracking. |
| High | Rejecting an *observed* nonmonotone inverter DC-draw or generator fuel curve as **physically impossible** confuses an operating-mode change or instrument variation with a thermodynamic violation. | Preserved valid measured knots, flagged monotonicity, retained energy conservation at inverter knots, and continued to prohibit extrapolation or duplicate x-coordinates. | Independent data provenance, operating modes (ECO, AES, search, charging/pass-through), uncertainty, smoothing and model selection. |
| High | A constant-Vmp PV cable power estimate is not the full loaded PV I–V optimum. | Previous milestone added nonlinear single-diode array+cable maximum; benchmarked versus **independent pvlib Lambert-W and SciPy maximization**. | Partial shading and bypass-diode local maxima, separate strings/controllers, real MPPT/efficiency/derating. |
| Medium | MPPT/charger efficiencies treated as peak constants and battery OCV/internal resistance as fixed values can materially distort multi-day outage forecasts even with conserved energy. | Existing explicit local Thevenin fit, measured-domain inverter/generator curves, battery thermal RC math, energy ledgers, and an independent calibration scoring API. | Measured controller `eta(P,V,T)`, actual battery `OCV(SOC,T)` / `R(SOC,T,pulse,age)`, BMS thresholds and CC/CV transitions. |
| Medium | Catalog product variants are not interchangeable merely because the brand and nominal V/W match. | Existing exact-part fixtures and topology/provenance checks; new calculations are explicitly device scoped. | Part numbers, MC4/Tr connector versions, actual firmware, compatible batteries, fusing, neutral transfer and wiring code constraints. |

## B. Mathematical requirements for defensible claims

1. **Units and signal semantics** — distinguish DC W, AC W, VA, var, Wh, Ah, per-second integrals, cell temperature, ambient temperature and conductor temperature. Preserve signed current convention for charging and signed reactive var.
2. **Physics invariants** — check Kirchhoff voltage/current balance, I²R loss, converter input minus output, battery chemical/electrical balance, elapsed time and SOC boundaries. Residual tolerance must scale to physically relevant magnitudes.
3. **Independent numerical solver checks** — compare the single-diode I–V curve with pvlib's Lambert-W implementation and the cable optimum with an independent numerical optimizer; compare Sandia temperatures with pvlib and time integrals with analytical hourly-rectangle answers.
4. **Published coefficient revision control** — distinguish PDF-reported `muIsc=6.7 mA/°C` and `muVoc=-144 mV/°C` from catalog `alphaIsc=.05%/°C` and `betaVoc=-.284%/°C`; there is **no authority to merge values from different variants silently**.
5. **Operating domain and unknowns** — out-of-range temperatures, irradiance, missing NASA samples, absent sensor readings and unmeasured converter states never produce invented power or safety approvals.
6. **Uncertainty** — report instrument precision, unmeasured model-error distributions, parameter sensitivity and scenario assumptions separately. A percentage derived from comparison with another model is **model agreement**, not physical prediction accuracy.
7. **Validation isolation** — calibrate on instrumented data from some dates/operating regimes, freeze parameters, then test on **held-out** dates, temperatures, SoCs and equipment modes. Never optimize against the same data used for the accuracy claim.

## C. Conditions currently preventing complete real-world calibration

- **No measured inverter input vs output load/temperature efficiency curves** for the actual installed variant.
- **No measured MPPT efficiency and tracking under warm/cold panels, partial shading, clipping, taper or controller standby power**.
- **No measurement-backed battery OCV-versus-SoC-versus-temperature curves, resistance dynamics, BMS/charge taper or aging**.
- **No independent generator running idle/load fuel map or dynamic power transfer/PowerAssist measurements**.
- **No full AC waveform harmonic/startup duration and service-leg distribution observations**.
- **No exact roof-level irradiance, albedo/rear gain, snow/bypass distribution or site-specific shading measurements**.
- **No recovered original NASA historical URL/time standard/source hash** (the weather data remain historical modeled estimates).
- **No verified complete installed product graph** including required return conductors, fuse interrupt ratings, bonding/neutral transfer/grounding, cable temperatures and fault currents; code certification requires local authority/qualified installer.

Any optimizer using the estimated solver without these constraints could choose a system that looks optimal in the model but underperforms or is electrically incompatible. The optimizer stays disabled.

## D. Independent authoritative references

- [PVsyst/PVPMC single-diode equivalent circuit, including PVsyst irradiance-dependent shunt resistance](https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/pvsyst-module-model/)
- [LONGi LR4-72HBD-435M PVsyst 2020 1-page manufacturer-derived report](https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf)
- [Victron SmartSolar 150/70 VE.Can exact product specifications](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html)
- [Victron SmartSolar PV startup/run troubleshooting and voltage headroom](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/troubleshooting.html)
- [Victron MultiPlus-II 120 V thermal output and VA/W ratings](https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html)
- [NASA POWER hourly API, LST default and UTC request distinction](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/)
- [NIST/NBS annealed-copper 20°C resistance coefficient](https://nvlpubs.nist.gov/nistpubs/Legacy/circ/nbscircular31e3.pdf)
- [IEEE 1459-2025, definitions for sinusoidal, distorted and unbalanced electrical power](https://standards.ieee.org/ieee/1459/7578/)
- [NLR PVWatts V8 model scope (preliminary yield versus detailed equipment model)](https://developer.nlr.gov/docs/solar/pvwatts/v8/)
- [NLR PVWatts loss categories and explicit non-duplication of inverter/temperature losses](https://pvwatts.nlr.gov/docs/help_system_sysloss.php)

Published independent references provide the **equations and constraints**. None is a substitute for measuring installed equipment or certifying electrical safety.

## E. Calibration release decision

As of this audit, **mathematical reference work is ongoing and empirically limited**. Require every test to pass after final source-bundle generation and keep:

```json
{
  "nextCoreCanReplaceLiveEngine": false,
  "householdPlannerEnabled": false,
  "optimizerEnabled": false,
  "physicalHardwareDatasetCount": 0,
  "independentWeatherClockConfirmed": false,
  "networkCodeCompliant": false
}
```

After mathematical reference coverage is demonstrably complete, the next effort is to collect and validate **real independent measurement packages** and to integrate the corrected formulas with actual hardware/topology constraints. Only then should live dispatch be migrated, followed by the household planner and automatic optimizer. Good UI or internal test counts cannot stand in for the missing measurements.

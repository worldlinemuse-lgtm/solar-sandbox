# Solar Sandbox — mathematical calibration audit and acceptance plan

**Revision:** 2026-11-04. **Scope:** equation correctness and empirical-calibration infrastructure only; NOT production dispatch, household planner, optimizer, safety certification or guaranteed yield.

## 1. Distinguish four separate meanings of "accurate"

1. **Algebra/units correctness:** An equation, its units, its declared sign convention, admissible root and conservation residual agree.
2. **Independent reference agreement:** Its implementation agrees with another published numerical model, manufacturer test curve, analytical identity or laboratory reference **at specified conditions**.
3. **Empirical calibration:** Parameters are fitted to **actual independent, time-aligned, instrumented observations** for a documented exact equipment variant, environmental regime and operating state.
4. **Out-of-sample physical validation:** Fixed calibrated parameters predict **held-out** independent measurements across varying loads, temperatures and battery states. A defensible accuracy interval is computed with the tested domain and instrument uncertainty.

Only (1) and parts of (2) are currently evidenced in this repository. **No independent instrumented whole-system dataset exists in the repository. Consequently neither real-world subsystem calibration nor whole-home prediction accuracy can be assigned a numerical percentage.** Passing internal invariants is insufficient.

## 2. Equations audited and their limits

| Domain | Authoritative mathematical relation | Implemented evidence | Remaining physical uncertainty |
| --- | --- | --- | --- |
| DC voltage and resistance | `ΔV = I R`; `P_loss = I² R`; `E_Wh = P_W Δt_seconds/3600` | Pure dimensional/analytical checks; registry-residual fixtures | Wire temperature, actual length/return topology, termination/contact resistance |
| PV I–V at module level | `I = I_L − I_0(expm1((V+IR_s)/a)) − (V+IR_s)/R_sh` | Published LONGi/PVsyst model with five 25 °C reference irradiance points; single-diode root | Module variants, partial shade, rear gain, temperature-dependent resistance/diode parameters |
| PV current scaling | `I_sc(G,T)≈I_sc,STC (G/1000)(1+α_Isc(T−25°C))` | **Corrected** simplified-panel Isc irradiance dependence, dark current zero | Low irradiance nonlinearity and bypass/rear-side effects |
| Extreme-temperature DC voltage | `V_oc,design≈N_s V_oc,STC (1+β_Voc(T_extreme−25°C))` | **New independent design envelope**; cold V not confused with current simulated temperature; two distinct 150/145-V ceilings | Above-STC irradiance requires independently verified Voc uplift; T_extreme must be site-appropriate, not assumed from one weather day |
| Short-circuit design | `I_sc,design≈N_p I_sc,STC (G_design/1000)(1+α_Isc(T_extreme−25°C))` | Formula checks against controller Isc rating; missing extremes -> indeterminate | Actual G ceiling, rear-side current, per-string/module variability, device revision |
| Nonlinear PV cable operating point | `P_port=max_V I_array(V)[N_s V−I_array(V)R_loop]` | **New I–V numerical operating-point optimizer**, analytical energy balance and independent dense-grid tests; no longer assumes fixed `V_mp` in this standalone calculation | Actual MPPT tracking time, converter heat, power/current/temperature derating and bypass groups |
| MPPT converter | `P_dc,out=η_mppt(P_in,V,T)·P_in` | Existing dispatch proxy uses published peak η, with explicit estimated status | Actual load- and temperature-dependent efficiency curve; transient behavior and nominal/rated conditions |
| Battery electrical | `V_t=OCV−IR`, `P_t=V_t I`, `P_heat=I²R`; signed Ah/SoC balance | Stable quadratic, registered energy balance; **new local Thevenin OCV/R least-squares fit** | True OCV(SOC,T), R(SOC,T,age,pulse duration), polarization, hysteresis, transient conditions |
| Battery thermal | `C·dT/dt=P_heat+P_heater−(T−T_amb)/R_th` | Exact one-node RC integration tested for timestep invariance | Real R_th, C, sensor placement and heater efficiencies remain unmeasured |
| AC real and apparent power | `P=S·PF`; `S=sqrt(P²+Q²)` for aggregate phasors | Separate W and VA; unknown motor PF/surge -> indeterminate | Signed leading/lagging PF, harmonic/distortion VA, motor locked-rotor transient |
| Generator fuel/energy | `fuel=∫ fuel_rate(P)dt`; `E=∫Pdt` | Finite tank and interpolated published operating anchors | Intermediate curve, eco throttle, true start/stop/refuel durations |
| Inverter measured DC demand | `P_DC,in(P_AC) = piecewiseLinear(measured AC/DC points)`; `P_loss=P_DC,in-P_AC ≥ 0` | **New source/next-core/calibration-curves.ts** enforces nonnegative loss and monotone load points, preserves measured idle draw without double-counting, refuses extrapolation | Multiple input voltages, temperatures, PF/VA states and different inverter models need separate instrumented curves; no measured field data yet |
| Generator measured fuel rate | `F_gal = ∫gph(P_AC) dt/3600` (t in seconds); `gph=piecewiseLinear(measured steady-state points)` | **New measured-domain interpolator** explicitly allows nonzero running idle fuel rate, rejects nonmonotone data and out-of-domain load requests | Generator operating mode, eco throttle, ambient conditions, fuel composition, transient operation and start/stop must be verified |
| Historical weather | `E_irradiation=∑mean_G × Δt_hours` | Exact hourly-step mean integration | Original NASA hourly request/time standard missing; roof-level calibration absent |

Sources: [Sandia PVPMC diode equivalent model](https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/), [PVsyst module model](https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/pvsyst-module-model/), [Victron MPPT 150/70 official technical limits](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html), [NASA POWER hourly clock requirements](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/), and the versioned LONGi/PVsyst fixture in `validation/next-core/pv-pvsyst-435m.json`. The manufacturer figures are not calibration by a real instrument.

## 3. New mathematical calibration infrastructure

- `source/next-core/pv-design.ts` calculates design-extreme string open-circuit voltage and maximum short-circuit current **separately from the current timestep**. Missing cold, hot, irradiation or above-STC Voc correction means **indeterminate**, unless a known limit already fails. Even a numerical pass is only a bounded rating comparison, not a code approval.
- `source/next-core/pv-module.ts` now makes simplified Isc depend on effective irradiance and sets dark Voc/Isc to zero. Its other linearized behavior, including inferred Vmp slope, is still a proxy. The fixed-Vmp solver retains a positive reference Vmp when PV power is zero solely for numerical compatibility; it does **not** mean an energized solar input at night.
- `source/next-core/pv-wire-iv.ts` maximizes the nonlinear **diode source curve less cable losses**, not the previous constant-Vmp proxy. It constrains the controller terminal voltage separately and records gross power, cable heat, input power and a numerical residual. **It is a standalone mathematical reference**, not yet the production MPPT or power-dispatch implementation.
- `source/next-core/calibration.ts` computes independent prediction-error statistics (bias, MAE, RMSE, absolute/relative errors and optional uncertainty-weighted chi-square) and a **local** battery `OCV−IR` least-squares fit. It rejects temperature/SoC mixing, a degenerate current range or nonphysical fitted resistance. Input provenance and units must still be verified by the caller.
- `source/next-core/calibration-curves.ts` adds inverter DC-demand versus AC-load curves and generator fuel-rate versus sustained-load curves from external measured points. Mathematical interpolation is allowed **inside the measured domain only**, preserves idle power/fuel and enforces energy/monotonicity constraints. No vendor peak-efficiency default can substitute for these points; no actual field curve has been fitted.
- The read-only browser API `SolarNextCore` now exposes the calibration estimators as well as the new reference PV formulas; they do not update active engine state.
- `source/next-core/entry.ts` exposes the nonlinear I–V and cold-design equations as read-only browser reference methods; `shadowPv` now labels its current weather-based Voc **instantaneous**, and reports an independent design assessment. Unless independent design extremes are supplied, the design rating remains **indeterminate**. Existing live household dispatch is not replaced.
- `tests/next-core/pv-math-calibration.test.cjs` compares the new equations against published benchmark arrays, analytical values, dense independent I–V searches, known synthetic electrical measurements and negative/safety boundary cases. Its regression fixtures are marked synthetic, **never real instrumentation**.

## 4. Required independent measurement packages

Each actual test record should include:

- **Device identity:** Manufacturer, exact model, part/variant, revision, serial numbers where appropriate, firmware version and configuration.
- **Instrument identity:** Manufacturer/model/serial, sensor type, measurement range, calibration date or certificate if applicable, stated absolute or relative uncertainty, sampling interval and time sync method.
- **Operating environment:** UTC timestamp and time zone, irradiance/plane-of-array sensor geometry, cell/module/battery/ambient temperature, wind, shading, tilt, surface state.
- **Electrical states:** PV string/module V and A, MPPT PV input and DC output V/I, battery terminal V/I/SoC/BMS state, AC real W and apparent VA, PF/sign, inverter transfer state, generator load and fuel level.
- **Source integrity:** Original raw file, export/software version, original URL or acquisition method, SHA-256, missing-data flags, units and any de-identification.
- **Separate training and validation sessions:** Hold out whole dates, temperatures and load scenarios—not only random samples in the same trace. Report error as a function of domain, not a universal percentage.

**Measurement safety:** Only collect operating electrical measurements using suitable enclosed/logged equipment and a qualified professional. These records do not require exposed-conductor testing or improvised mains connections.

No actual observations were added or inferred by this change. Prior JSON fixtures and published model curves remain **references/synthetic tests**, not field evidence.

## 5. Concrete calibration acceptance gates

1. **Formula identity:** Analytic and numerical roots close their physical residuals under deterministic edge cases; invalid domains fail visibly, not silently.
2. **Source agreement:** Reproduce all original five LONGi/PVsyst reference points within the existing 2% *model agreement* tolerance. Independently test the nonlinear cable solver against dense I–V sampling and zero-resistance theoretical MPP.
3. **Electrical extrema:** A warm instantaneous timestep cannot override a failing cold extreme; above-STC irradiance cannot be approved without separately bounded Voc; Isc follows design irradiance.
4. **Battery model:** Separate actual measured OCV/SOC/temperature and pulse-resistance datasets from synthetic regressions. Report predictive residuals on held-out measurements with actual sensor uncertainty.
5. **Converter/inverter model:** Use multiple independent points over input voltage, temperature and load; separate idle draw from efficiency; preserve energy/VA distinctions.
6. **Weather provenance:** Archive and independently verify NASA source requests, clock and grid. No chronological claims about a synthesized typical year.
7. **System accuracy:** Only publish a physical prediction error for the domain with **real independent measurement samples**; no global "99% accurate" claims from self-consistency or shared-model comparisons.
8. **Release isolation:** Keep `nextCoreCanReplaceLiveEngine=false`, `householdPlannerEnabled=false`, `optimizerEnabled=false` until E0-E2 source-validated formulas, independent numerical benchmarks and full chronological equipment/state integration meet the advertised scope. **Do not block engineering development pending optional field/laboratory measurements (E3).** Mathematical readiness alone does not guarantee valid state transitions or product compatibility.

**Next work after this math-focused phase:** Continue proactive authoritative-source research and equation implementation; compare independent reference solvers and source curves; resolve weather clock and product variants; then test complete state/dispatch logic and build the optimizer. **If available**, physical field datasets can be used later to estimate actual installation prediction errors. See [standing policy](DEVELOPMENT_ACCURACY_POLICY.md). References: [engineering release blocker #4](https://github.com/worldlinemuse-lgtm/solar-sandbox/issues/4) and [physical-evidence protocol](PHYSICAL_BENCHMARK_EVIDENCE.md).

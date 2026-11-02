# Milestone 1 — Simulation correctness and trustworthy results

Status: **validation in progress**, not yet a certified engineering design tool. This milestone blocks the household planner and optimizer.

## Scope and release criteria

1. **Energy accounting:** at every simulated minute, requested AC load = served AC load + unserved AC load, within numeric tolerance. Incompatible voltage is unserved load rather than disappearing from the denominator. Report total unserved load distinctly from total loss of power.
2. **Battery state:** state of charge is always finite and in [0,1]; disconnected BMS does not accept modeled generator charging; internal wiring and inverter output accounting remains consistent. Battery capacity, thermal behavior, cycle aging, and converter efficiency still require external laboratory or field calibration.
3. **Generation and backup:** no energy from an opened PV disconnect; MPPT output never exceeds modeled availability or current limits; manual generator never automatically starts; limited fuel inventory cannot increase spontaneously or become negative.
4. **Historical stresses:** test every supplied winter (25 x 120 days), separately under the built-in food-preservation and furnace load patterns, from a full battery with generator off. Archive exact results and assumptions. Do **not** interpret 25 weather histories or Wilson intervals as a forecasted future-failure probability.
5. **Regression gate:** the new `tests/test_correctness_gate.py` runs on every push and pull request and writes `tests/correctness_results.json`, included in the Actions artifact. Existing physical-integrity, solar, build-consistency, and offline tests also remain required.

## Baseline from local review (2026-11-02)

Under the **current default equipment**, with generator disabled, using the simulator's default food and furnace presets:

| Load set | Historical winters with any unmet load | Median minutes with unmet demand | Median hours |
|---|---:|---:|---:|
| Food preservation | 25/25 | 38,430 | 640.5 |
| Furnace | 25/25 | 109,830 | 1,830.5 |

These numbers are **outputs of this model** for a particular starting design, not measured performance of the user's home, and not a forecast of real-world failure risk. They cannot be compared directly with past saved LONGi-preset runs without matching hardware, load, weather, SoC, generator, and snow settings.

## Still open — engineering verification before the planner

- **AC load dynamics:** sub-minute motor starting, power factor, and inverter VA/surge curves need physically grounded modeling.
- **Generator operational constraints:** individual 0.95-gallon tank refills, shutdown to refuel, supervision gaps, maintenance, and compatible transfer/charging wiring remain approximated.
- **Battery and thermal calibration:** actual battery/BMS voltage-current curves, temperature trajectories, charge taper, self-discharge and degradation must be compared against measured data.
- **Meteorological uncertainty:** NASA POWER coarse-grid estimates and assumptions about snow, shading and actual site irradiance are not independently calibrated to the user's property.
- **Electrical system certification:** wiring checks are estimates; they do not constitute an installation approval or NEC sign-off.
- **Independent reference validation:** add fixture-level validations for voltage/current and power conversions over a wider equipment matrix. A PVWatts match alone is not complete system validation.
- **User-facing provenance:** surface versioned assumptions, dates and unknowns in mission outputs; save fully reproducible configuration with test results.

**Exit criterion:** All conservation and service-availability gates pass; every supported equipment topology is covered by edge-case tests; the full historical suite is reproducible; material model assumptions and failure limits are transparent. Only then begin the household planner and optimizer.

## Next milestones (blocked)

- **Milestone 2:** Household essential-load planner and automatic load shedding, using verified measured appliance inputs where possible.
- **Milestone 3:** Search and compare system configurations with verified compatibility, cost, and robustness metrics. No claim of globally optimal purchasing until the objective, constraints, and search completeness are documented.

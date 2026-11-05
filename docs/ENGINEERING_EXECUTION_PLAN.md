# Solar Sandbox — Gated Engineering Execution Plan
Status: ACTIVE. Started 2026-11-04. Phase 0 in progress.

## Objective
Build a physically defensible, reproducible solar and storage simulation product. Mathematical and engineering accuracy precede household planning and optimization. Manufacturer data, primary research, published reference curves, and independent numerical tests are required. Instrumented field validation is optional E3 and must not block E0–E2 development.

## Mandatory lifecycle for every phase
1. ENTRY: inspect current commit, relevant source, test coverage, authoritative references, assumptions, dependencies, and risks.
2. DESIGN: specify equations, units, sign conventions, parameter revisions, valid domains, boundary behavior, numerical methods, and acceptance tests before implementation.
3. IMPLEMENT: make isolated, reviewable changes; preserve live dispatch and offline build until migration gates pass.
4. VERIFY: run analytic limits, independent reference calculations, edge and negative cases, conservation, integration, and regression tests. Record actual commands/results; never claim unexecuted tests passed.
5. CHALLENGE: actively seek counterexamples, incorrect manufacturer variants, unsafe topology, time-alignment errors, and numerical instability.
6. EXIT: update test evidence, source provenance, coverage manifest, defect register, and next-phase handoff. Block progression when critical gates fail.

## Phase 0 — Baseline and inventory (CURRENT)
Inspect full source and tests, GitHub Actions, legacy/new-core interfaces, catalog, weather data, provenance and deterministic build. Reproduce baseline tests. Map subsystem -> source -> evidence -> tests. Exit: verified baseline and ranked defects.
Initial observations: next-core coverage reports 8 implemented, 24 partial, 17 blocked of 49 requirements (repository assertions, not independently verified). Entry API declares read-only shadow. Build script uses deterministic SHA-256 source manifest. Actual test execution pending.

## Phase 1 — Equation and parameter authority
Audit PV single diode, irradiance/transposition, temperature, I²R(T), DC converters, battery ECM/SoC/thermal, AC W/VA/var, generator fuel and timestep integration. Confirm source revisions and independent E0/E1 benchmarks. Exit: source-backed, unit-checked equations with tested valid domains and explicit unknowns.

## Phase 2 — Component physics
Complete partial shade/bypass, dynamic MPPT, battery CC/CV and BMS, inverter efficiency/thermal/VA/transients, generator and motor startup. Never invent product-specific curves. Exit: independently tested components and honest indeterminate handling.

## Phase 3 — Electrical topology and interaction
Validate voltage rails, string/controller allocations, conductor and protection uncertainty, return paths, energy conservation, split-phase and transfer behavior. Exit: independent multi-device fixtures and safe unknown handling.

## Phase 4 — Weather and chronological solver
Reconstruct NASA POWER request provenance and explicit time standard; validate weather alignment, state transitions, dispatch, reserve, generator, timestep convergence and energy ledger. Exit: E2 reproducible end-to-end scenarios with bounded residuals.

## Phase 5 — Controlled production migration
Compare reference versus legacy on frozen scenarios, diagnose discrepancies, feature-gate replacement, run browser/offline/build regression tests, retain rollback. Exit: production powered by validated core, verified CI and auditable exports.

## Phase 6 — Household planner
Model appliances, W/VA/surge, schedules, critical loads, autonomy targets, environmental constraints and uncertainty. Exit: requirements translate to valid engine inputs with sensitivity checks.

## Phase 7 — Automatic optimizer
Optimize equipment/topology/cost/reliability under physical and compatibility constraints; independently re-simulate each candidate. Exit: defensible Pareto choices, no infeasible recommendations.

## Phase 8 — Product hardening
Test mobile/offline, accessibility, performance, reporting, reproducibility, documentation and release safety claims. Exit: versioned release checklist.

## Initial critical defect register (subject to source audit)
1. NASA historical weather clock/source provenance unverified.
2. Legacy Victron 5 kVA VA-versus-W rating discrepancy.
3. New-core chronological dispatch and live integration incomplete.
4. Battery CC/CV, BMS and split-phase transfer incomplete.
5. PV bypass/partial shading and MPPT dynamic behavior incomplete.
6. Manufacturer-specific performance curves and uncertainty propagation incomplete.

## Current checkpoint and next action
Read README, development accuracy policy, independent audit, calibration audit, coverage manifest, source/next-core/entry.ts, source/next-core/pv-wire-iv.ts and source/build.py. A presumed source/next-core/dispatch.ts path was not found; locate actual dispatch through inventory. Next inventory tests and source, execute baseline checks, establish traceability matrix. Do not mark Phase 0 complete without test execution.

## Continuity
At each checkpoint record branch/commit, files changed, executed tests and results, unresolved blockers, and exact next step in this file. The plan lives in GitHub to survive chat boundaries.
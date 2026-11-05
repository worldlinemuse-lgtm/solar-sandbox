# Solar Sandbox — Engineering Implementation Blueprint
Status: ACTIVE | Revision: 2026-11-04 | Repo: worldlinemuse-lgtm/solar-sandbox | Primary branch: main

## 0. Engineering decision and scope

This is a software-based mathematical engineering simulator and product, not an instrumented laboratory project. Build it from independently verified physical laws, numerical methods, publicly available datasets, and exact manufacturer variants. Implement E0 (analytical/numerical), E1 (published-reference), and E2 (end-to-end integration) as engineering release gates. E3 physical/site measurements are an optional validation tier, NOT a gate for implementation or mathematical correctness. Never imply electrical-code compliance, an installation permit, or a site-specific error percentage unsupported by measurements.

Primary architectural decision: keep the current product usable while progressively establishing one canonical typed mathematical calculation path. Do not rewrite the complete UI or promote the new reference engine merely because its isolated calculations conserve energy. The existing public interface becomes an adapter to the new solver AFTER E0–E2 validation.

## 1. Evidence and reasoning method: apply before each edit

### 1.1 Define the claim, not just the feature
For every proposed behavior, record:
- Specific output claim, e.g. delivered AC energy for a 2S2P LONGi array connected to an exact Victron model and 24-V bank, not generic "solar power".
- Governing equation(s), derivation source, units, sign convention, boundary conditions, equipment revision and operating domain.
- All required inputs and their provenance: measured, directly published, derived, fitted to published, scenario assumption or unknown.
- What the implementation must refuse to decide (indeterminate), including mismatched device variant, missing protection ratings, outside published efficiency domains and unidentified clock.
- Observable falsifier: an independent computation, analytic limit, numerical counterexample, published curve or incompatible topology proving the implementation wrong.
- Consequence of being wrong: wrong yield, charge state, overload, unsafe advice, or only cosmetic UI error.

A passing energy-conservation equation proves accounting, NOT the source power, model parameters, feasible operating point or predicted runtime.

### 1.2 Prioritize defects by dependency and impact
Sort blockers in this order: (A) validation machinery lying or excluding legitimate progress; (B) source time, units, equipment identity and topology; (C) governing model/solver; (D) temporal integration; (E) reported result uncertainty; (F) product UX. Within a category prioritize errors capable of reversing a feasible/infeasible decision, then energy/runtime errors, then presentation.

For each decision maintain an evidence record with: claim ID; exact source URL/document revision; source date; part/firmware variant; equation ID and revision; valid range; independent fixture; acceptance tolerance; source/fixture SHA-256; implementation path; test path; code revision; result; residuals; remaining uncertainty.

### 1.3 Explore alternatives explicitly
For each physical subsystem compare: closed-form solution, independently implemented numerical root, tabulated interpolation, reduced-order dynamic model, and indeterminate unsupported case. Choose the least complex method that captures the intended claim with bounded error. If a source gives only a peak efficiency, do not fit or invent a whole efficiency curve. If data are insufficient, support a bounded scenario or return indeterminate.

### 1.4 Separate error classes
- Algebraic/numerical error: precision, discretization, solver convergence.
- Structural/model error: omitted dynamics, wrong network topology, unjustified approximation.
- Parameter error: wrong datasheet, revision, temperatures, performance curve.
- Input/provenance error: weather clock, interpolation, unit conversion, missing values.
- Stochastic/scenario uncertainty: weather sequence and household duty cycle.
Do not disguise model uncertainty with a tighter numerical tolerance.

## 2. Verified repository architecture at planning checkpoint

Main at initial review: d4372db400f68467e1d98e7b855be08d83799248.
The complete Git tree has 149 file/directory entries; GitHub reports non-truncated tree.

Current live path:
- source/sim.js: a large monolithic simulator with central step() near line 314. It runs weather sampling, snow, battery temperature, load schedules and startup, inverter/generator logic, PV/DC cables and MPPT, charging, BMS, battery state and reporting within one step.
- source/physics.js, battery.js and elec.js: legacy physical and component helpers.
- source/hist.js, tmy.js, snowhist.js: bundled source weather datasets.
- source/build.py + source/template.html: deterministic source-to-index.html build, including source hashes and bundled audio.
- tests/test_correctness_gate.py, test_v7.py and other Playwright/Python suites exercise the actual live page.

Reference path:
- source/next-core/math/{models,registry,expressions,implicit,topology}.ts: equation/units/provenance and structure checks.
- source/next-core/{pv-diode,pv-wire-iv,pvsyst-shunt,pvsyst-published-fit,pv-design,pv-module,solar,mppt-power-envelope}.ts.
- source/next-core/{battery,battery-ecm,battery-thermal,bms}.ts.
- source/next-core/{ac,ac-phasor,inverter-temperature,generator,weather}.ts.
- source/next-core/island.ts: advanceReferenceIsland(), a 0–60 s reference-only island solver; currently calls solvePvBus() from solar.ts.
- source/next-core/solar.ts: still uses a fixed-Vmp proxy for integrated PV delivery despite standalone nonlinear I-V solver in pv-wire-iv.ts.
- source/next-core/catalog.ts: published hardware identities plus explicitly synthetic 24-V battery fixture.
- source/next-core/entry.ts and browser bundle: read-only diagnostics, not production dispatcher.

Existing CI (GitHub Actions tests.yml): installs Python/Node, compiles TypeScript/esbuild bundle, runs Node math tests, Python pvlib/SciPy comparisons, browser bridge, synthetic 24-h reference, legacy correctness and 50 winter stress tests, source-bundle identity, PWA tests. Python dependencies are installed without exact version pinning; TypeScript/esbuild are version pinned. Current tests/next-core/coverage.test.cjs hard-codes several requirements as 'blocked', including optional E3 whole-system measured; this is not a valid future-ready release-gate test. Branch main protection was reported disabled at baseline.

Initial reference coverage reports 8 implemented, 24 partial, 17 blocked / 49 requirements. Treat this as a backlog status, not a weighted percent of actual physics accuracy.

## 3. End-to-end architecture to implement

Input -> normalize and verify provenance -> topology and ratings -> time-aligned environment + loads -> solve coupled network -> enforce device states/events -> integrate physical ledgers -> advance immutable state -> collect provenance and uncertainty -> UI/report/optimizer.

### 3.1 Canonical contracts
- Physical quantities must specify unit and meaning (DC W, AC W, VA, signed var, V, A, ohm, Wh, Ah, cell/ambient/conductor temperature, UTC epoch seconds).
- A model returns status = computed, bounded_estimate, indeterminate, or impossible; evidence and warnings are first-class results. 'Within published numerical rating' never means 'installation approved'.
- Device records require model, version, port types/rails and provenance. No brand-level conflation.
- Immutable SimulationInput = topology + device variants + scenario + initial state + clock + model revisions + deterministic seed where relevant.
- SimulationStep = validated state before + duration + changed state after + accepted events + individual converter/edge ledgers + unmet loads + residuals + source/equation IDs.
- Output report retains hashes, chronology, weather transform metadata, model versions, assumptions, and numerical solver status.

### 3.2 Coupled electrical solution, not a chain of arbitrary static percentages
At each accepted substep solve a self-consistent operating point:
1. Module/string I-V as a function of irradiance, temperature, bypass state and module parameter revision.
2. PV input at each controller including conductor series and return resistance: V_controller = V_array - I_array R_loop(T).
3. MPPT startup/run headroom, allowable PV voltage/Isc/port allocation, extraction, conversion efficiency or bounded envelope, output current and actual battery/DC bus voltage.
4. DC node with battery terminal voltage depending on current/SOC/temperature, battery charge acceptance, BMS permissions, cable losses and inverter DC demand.
5. AC branch with per-leg W, VA, signed reactive power, harmonics unknowns, load priorities, inverter thermal/peak/continuous and generator transfer state.
6. Solve the coupled operating constraints iteratively or with bracketed roots. Detect no feasible solution and return unmet demand/indeterminate rather than inventing a balanced answer.
7. Verify every conductor, converter and battery energy ledger as well as net node Kirchhoff residuals.

Reference identities: P_wire_loss = I^2 R(T); P_pv_port = V_array I_array - I_array^2 R; P_dc_inverter = P_ac_served + P_inverter_loss; E_Wh = integral(P_W dt_seconds)/3600. Battery charge and discharge require signed current and separate terminal, internal heat, coulombic-loss and chemical-energy ledgers.

### 3.3 Time and events
Weather hourly values are interval means, not instantaneous samples. Preserve original source clock (explicit UTC, or documented conversion from NASA LST), and never silently interpolate daily/hourly time or assume local civil time. Carry UTC internally and convert scheduled local loads using explicit zone rules where needed; distinguish leap days, DST and typical-year synthetic chronology.

Use numerical substeps around actual events: solar/controller starts, load startup, charger mode change, SoC bound, BMS trip/recovery, inverter derate/trip, generator start/stop/fuel exhaustion and weather hour boundary. The current reference kernel supports a 60-second maximum step; retained event boundaries must have durations and ledgers. For subsecond motor waveforms, either use sourced transient models with appropriately small steps or classify unknown; minute-level steady loads alone cannot certify startup.

## 4. Ordered implementation work packages

### WP0 — Establish a trustworthy baseline and gate system (FIRST)
Entry: get exact commit, tree, workflow, current test outputs. Inventory component -> input -> path -> test -> evidence and catalog conflicts. Re-run complete CI on an isolated branch (or use explicitly identified GitHub Actions commit/run); record actual results and artifacts. Freeze baseline fixtures before physics edits.

Change sequence:
1. Replace tests/next-core/coverage.test.cjs checks of 'must remain blocked' with a machine-computed feature gate predicate over required E0/E1/E2 evidence. E3 is optional; simulate a fully satisfied E0–E2 manifest with E3 absent and assert release eligibility, and the reverse.
2. Add a central feature-gate evaluator consumed by tests and UI; gate cannot be hand-flipped without evidence IDs and passing independent checks. Keep current gates false until earned.
3. Pin reproducible CI dependencies and preserve reproducible build/provenance. Check Actions job results and actual test evidence, not only README claims.
4. Add a source-to-test/evidence traceability map including missing coverage. Distinguish 'passes this limited test' from 'physically validated model'.

Exit: baseline is reproducible; gate logic tests future eligible states without requiring E3; no production behavior has changed; defects linked to files and tests.

### WP1 — Weather and temporal provenance
Entry: WP0 verified; original source weather inputs available. Compare source/tmy.js, hist.js, snowhist.js, weather-audit.json and legacy wxT()/buildHistWX() against NASA POWER/PVWatts documentation.
1. Record all raw data request parameters, UTC/LST clock, location, variables, units, query revision, missing-value flags and hashes.
2. Add a reproducible import/normalization script and checked-in, metadata-rich normalized fixtures; do not overwrite original archives without preserving their hashes.
3. Test hourly energy integrals, start-of-hour timestamps, explicit LST-to-UTC handling, DST load mapping, leap-day/winter boundary and 25 winter indexing.
4. Recreate relevant historical comparisons and investigate changes induced by legitimate timestamp correction.

Exit: weather inputs are independently reproducible and no result silently mixes solar/civil clocks. Typical-year and historical series remain distinctly labeled.

### WP2 — Electrical identity, hardware contracts and topology
Entry: WP0 contracts and source ledger. Inventory all product variants in source/sim.js and next-core/catalog.ts. Recheck current manufacturer manuals.
1. Separate inverter output rated in W versus VA; correct legacy Victron 5 kVA catalog's unsupported W label only with source-backed unit semantics and a regression test.
2. Validate exact MPPT Tr/MC4 version, per-connector 30 A when applicable, total Isc, cold Voc and start/run voltage difference, plus allowable DC rails.
3. Create exact equipment topology fixtures for supported strings, bank parallel/series, controllers, each cable/return path, split-phase buses and transfer limits.
4. Unknown neutral/grounding, interrupt rating, fuse suitability or hardware variant => no safety approval, not a guessed pass.

Exit: supported devices have machine-checkable identity/units; incompatible configurations fail before running the solver.

### WP3 — PV -> cable -> MPPT -> DC bus
Entry: weather, device and topology contracts from WP1/2.
1. Benchmark pv-diode.ts and pv-wire-iv.ts with independently solved pvlib Lambert W + SciPy extrema, source-specific irradiation/temperature points, and boundary cases.
2. Integrate nonlinear I-V/cable solution into the reference island rather than leaving solar.ts fixed-Vmp as authoritative. Preserve current proxy only as explicitly named comparison mode.
3. Model strings per controller, bypass diode/sub-string partial shade only for supported published parameters, controller operating and start states, clipping, cold design, thermal and efficiency envelope. Do not equate a 98% peak number with constant efficiency.
4. Solve controller and downstream bus load together so curtailment and cable loss reflect the actual operating point.

Exit: reference island PV delivery uses a real network operating point; zero sun, long cable, full battery, partial shade and controller limits have independently tested outcomes. Unsupported shade remains indeterminate.

### WP4 — Battery/BMS/charger
Entry: solved DC bus and exact battery variant.
1. Choose explicit model order: published OCV(SOC,T), current-dependent internal loss, optional one/two RC polarizations, thermal node, chemistry-specific CC/CV taper and BMS state machine.
2. Reuse battery-ecm.ts, bms.ts and thermal reference where valid; STOP using an unchanging OCV and R for all SOC/temperature in the integrated solver unless marked a restricted synthetic benchmark.
3. Couple charge acceptance, BMS hysteresis, charge/discharge current and voltage limits with the MPPT DC node; solve exact event boundary times.
4. Independently test constant current, zero current, full/empty, cold-charge lockout/recovery, current trip/recovery, multi-step consistency and energy dissipation.
5. Separate battery aging assumptions from an independently validated chemistry/temperature/cycle law.

Exit: chemically stored energy and terminal energy are correctly distinguished, no SOC discontinuity, and charge taper/BMS influence household runtime.

### WP5 — AC demand, inverter and generator
Entry: battery/DC source and topology are stable.
1. Replace unsigned PF-only aggregation with explicit signed Q for inductive/capacitive loads; preserve unknown harmonic/inrush signatures. Validate per-leg W/VA and 240 V allocation.
2. Use exact 3 kVA real-W thermal and 5 kVA apparent-VA published envelopes; refuse real-W guarantee where only VA is published.
3. Model inverter efficiency as a load/input-voltage/temperature curve only where sourced; otherwise bounded/estimated. Include no-load draw and continuous/thermal/peak operating limits.
4. Keep generator recoil/manual operation, fuel inventory and explicit start/refuel event handling. Honda reference fuel anchors only validate 25% to rated output. Lower-load running behavior must be a named scenario assumption or indeterminate, never 'published'.
5. Do not assume inverter PowerAssist or generator-to-battery AC charging, transfer/neutral behavior, or harmonic motor starts without source-backed topology and bounds.

Exit: AC service is physically feasible across both legs; generator and transient cases cannot silently bypass unknown constraints.

### WP6 — Unified chronological solver (E2)
Entry: WP1–WP5 independently verified for selected supported configurations.
1. Refactor advanceReferenceIsland into side-effect-free pure model step + event scheduler + ledger accumulator; preserve immutable inputs and error/status semantics.
2. Integrate dynamic PV/MPPT, battery/BMS/charger, AC/inverter and generator/transfer using a common state. Define solver convergence and retry/step-reduction rules.
3. Add physically independent integrated scenarios: dawn MPPT startup; partial shading with different strings; low-temperature charging lockout; SoC reserve reached midstep; simultaneous inverter load/surge; generator startup/fuel exhaustion; 240 V load and one weak AC leg; end of winter day; full battery PV curtailment.
4. Compare 60/30/15-second steps for smooth cases, plus event-boundary invariance in discontinuous cases. Every rejected or truncated step must not mutate state or silently accumulate energy.

Exit: end-to-end physical/electrical and chronological E2 tests pass for an explicitly stated supported domain; all residuals and indeterminacies are reported.

### WP7 — Production migration
Entry: WP6 passed, retained historical comparison fixtures.
1. Add nonmutating adapter from legacy S/cfg to typed SimulationInput with explicit missing-field handling.
2. Run both engines on frozen inputs (shadow/differential mode), investigate discrepancies by source equation, time, hardware revision and scenario; DO NOT force agreement with the legacy result.
3. Feature-gate migration per supported configuration; unsupported cases stay in clearly labeled legacy estimate or indeterminate mode.
4. Run browser, state import/export, PWA/offline, deterministic build, large winter batch and failure-mode regressions.
5. Preserve rollback to previous release; promote only after E0–E2 and CI acceptance.

Exit: validated core produces supported production output; report revision and model status describe the actual solver used.

### WP8 — Household planner
Entry: source-backed production dispatch for advertised configurations.
1. Represent each appliance in W/VA/PF, surge/duration, duty cycle, criticality, 120/240 V leg and schedule; do not assume average load alone models refrigerator/well pump.
2. Build simulation-ready household schedules with explicit priority/load-shedding and unknown-use distributions/scenarios.
3. Convert goals (outage length, critical load, reserve, cost, site constraints) to explicit requirements and scenario runs.
4. Explain historical-weather stress as scenarios, not future probabilities.

Exit: planning results reproduce with exact load inputs and supported equipment assumptions.

### WP9 — Automatic system optimizer
Entry: planner and production solver stable.
1. Define discrete decisions (module count/string partition/controllers/bank/inverter/wire choices); objectives (cost, unmet critical energy, capacity margin) and hard feasibility constraints.
2. Solve with bounded enumeration, pruning or mixed-integer/heuristic search as appropriate, but validate every proposed optimum with the SAME production physics engine.
3. Use robust scenarios and Pareto choices; uncertainty/unknown ratings disqualify 'verified feasible' but may permit clearly labeled exploratory scenarios.
4. Cross-check small designs by exhaustive enumeration to falsify the optimizer's claimed optimum.

Exit: no automatic recommendation violates simulated physical constraints; costs have source and date; sensitivity and evidence follow each recommendation.

### WP10 — Product hardening and release
Audit reporting, accessibility, mobile/offline, performance, state migration, provenance, source licensing and user-understandable limitations. Validate GitHub Actions and browser artifacts at exact release SHA. Release only claims supported by evidence, with changelog and rollback.

## 5. Universal test matrix and quantitative acceptance

Test classes:
- Analytic invariants: zero load/sun; no negative loss; no power from disconnected device; DC KCL/KVL; battery chemical/electrical balance; W/VA distinction; fuel never increases without refuel; outputs finite and in domain.
- Published E1 comparisons: freeze exact published point, reference revision and source. Current LONGi/PVsyst 25-C five-point curve agreement uses existing 2% model-reference tolerance; do not generalize that to real production accuracy. Use independently computed held-out thermal/shunt points where available.
- Numerical root/property tests: independent solver and grid checks, discriminant and root-branch selection, near-zero resistance, large current, zero voltage, high/low temperature, timestep and operating envelope extremes.
- Cross-component E2 tests: event-splitting, load shedding, charging, simultaneous sources, transfer, losses and per-leg constraints.
- Negative tests: unknown manufacturer variant, unlabeled VA, sentinel weather sample, wrong clock, mismatch between hardware port and rail, unavailable fuel curve, missing motor surge, unsupported harmonic data.
- Build/reproducibility: compile TypeScript, run Node tests and independent Python benchmarks, Python/browser legacy suites, byte-identical next-core browser bundle and index.html, export/import reproducibility and pinned dependencies.

Suggested E0 numerical power residual: abs(residual) <= 1e-6 W + 1e-8 * max(1 W, relevant power magnitudes), applied at each accepted stage; analogous energy tolerance in Wh on integrated ledgers. These are numerical consistency tolerances, NOT prediction accuracy. Set tighter source-specific solver/fixture tolerances when defensible. For smooth deterministic runs compare time-grid convergence (60/30/15 s) and investigate deviations above 0.1%; discontinuities are checked using exact event splits rather than naive interpolation. Each published-reference comparison must have its own justified tolerance and tested domain.

## 6. First five reviewable changes, in dependency order

Change 001 (test integrity): rewrite coverage/gating test, E3-optional E0–E2 readiness predicate, reproducible CI toolchain; no simulation behavior change.
Change 002 (data provenance): weather importer/source hashes/UTC alignment, boundary tests; preserve legacy fixtures until migration.
Change 003 (part identity): explicit W/VA unit contracts, Victron legacy catalog correction and hardware revision mapping, negative variant tests.
Change 004 (coupled PV path): integrate nonlinear PV-cable/controller model into reference island with independent test vectors.
Change 005 (dynamic battery): integrate chemical/electrical/BMS/CC-CV and event boundaries with reference island.

Do not combine these into a large unreviewable rewrite. For each change: write a short design note with inputs/outcomes, add a failing independent test, implement minimum mathematical correction, execute exact CI, inspect deltas, update coverage and provenance, then merge.

## 7. Required per-change handoff

Record these fields before beginning another change:
- Branch and before/after commit SHA; exact changed files; physical claim and authoritative sources.
- Original failure/counterexample, root-cause hypothesis and rejected alternative explanations.
- Chosen equation/model/algorithm, dimensional checks and source-specific operating domain.
- Test commands actually executed, result and CI run URL; never infer green from a written test.
- Reference residuals, unsupported behaviors, uncertainty/scenario assumptions and remaining open defects.
- Gate status with machine-readable evidence IDs; next task including its start condition.

## 8. Concrete immediate next action

Current phase is WP0, NOT completed. Inspect and record actual CI execution for commit d4372db. Build a subsystem traceability table from the Git tree and existing Node/Python test inventory. First code change should be the hard-coded coverage test and release-gate logic: a correct test must pass a hypothetical E0–E2-complete manifest when E3 is absent, and must fail when any required E0/E1/E2 dependency is absent. Confirm existing live outputs unchanged.

Known sources verified on 2026-11-04:
- NASA POWER hourly API documentation: https://power.larc.nasa.gov/docs/services/api/temporal/hourly/ (default LST; explicit UTC and start-of-hour samples).
- Sandia PVPMC PVsyst single diode modeling: https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/pvsyst-module-model/
- Victron SmartSolar MPPT controller manual, 150/70 model, startup voltage headroom, cold Voc, input current and published peak efficiency: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html

The next development task is a targeted gate/test change, not a speculative wholesale solver rewrite.


## 9. Execution checkpoint — 2026-11-04 21:50 America/New_York (2026-11-05 UTC)

WP0 implementation initiated on branch engineering/gate-evidence-v1, based on d1e6e507e3fe2f7aad61f4b5d40e795fb0d1d49e. Two isolated changes:
- scripts/release-gates.cjs (commit 80fe44e43d69d82a9ef53cf807f9a799c31f68f0): pure advisory gate analysis requiring completed engineering/math requirements plus externally attested CI categories. Whole-system field measurement (E3) and installation code certification do not gate engineering eligibility.
- tests/next-core/coverage.test.cjs (commit 07455771436b70f8db676c69f6dab00d179fc7d7): tests hypothetical future completion, missing weather verification, CI evidence, optional E3 and planner/optimizer dependencies; current release flags remain false.

Draft PR #16: https://github.com/worldlinemuse-lgtm/solar-sandbox/pull/16

Verification as last observed: current main commit d1e6e507 GitHub Actions tests completed successfully. Feature branch Actions were in progress, not yet verified as passed. No local checkout/test execution available in this session. Do NOT merge the draft PR or treat WP0 as complete without reviewing exact CI status, test artifacts and code review. The gate assessor currently consumes hypothetical CI attestation flags only; a trusted attestation-to-commit binding and automated release gate enforcement remain required before activation.

NEXT: review PR #16 test results; correct any failure. Build exact source-to-claim-to-test traceability ledger. Pin Python test dependencies for reproducibility as a separate reviewable change. Then verify source weather archives/provenance as WP1. Stay on E0–E2-first policy and preserve live dispatch.

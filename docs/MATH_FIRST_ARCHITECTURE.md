# Mathematical authority in Solar Sandbox

**Architecture milestone: 2026-11-03.** The existing UI remains intact. This is the computational substrate for replacing heuristic physics, not a new interface.

## 1. Non-negotiable hierarchy

```
Product identity and physical topology → validated quantities/units
                                          ↓
                          Mathematical equation registry
                                          ↓
                        Dependency closure + constraints
                                          ↓
                          Deterministic evaluation
                                          ↓
             Captured stage outputs, residuals, evidence lineage
                                          ↓
                Physical operating-state event transitions
                                          ↓
                           Existing UI and exports
```

The registry is **authoritative** for stage transformations. The imperative solver supplies inputs to registered equations, solves implicit roots/operating points, schedules events and applies protective state changes; it may not define a second, conflicting reporting formula.

Definitions and execution are different objects: `MathDefinition !== MathEvaluation !== Observation`. Passing a numerical invariant is not a measured hardware result. A convenient rendering, favorable estimate, or successful test does not grant hardware safety certification.

The formal mathematical model is:

[
\mathcal{M}=\langle X,K,T,I,B,P,F\rangle
]

- `X`: typed physical variables, equipment parameters and state vectors;
- `K`: a physical circuit/product/port graph and operating constraints;
- `T`: versioned symbolic transformations;
- `I`: conservation identities and numerical invariants;
- `B`: applicability domain and explicit unsupported boundaries;
- `P`: evidence provenance, parameter revision and uncertainty class;
- `F`: falsifiers, regression fixtures and independent physical comparisons.

The model schema must be capable of being inspected without executing a live simulation. Explicit mathematical laws are not stored as prose to be parsed dynamically; the serializable equation AST is executable by a single interpreter.

## 2. Formula authority

`source/next-core/math/expressions.ts` is the only interpreter of declarative expression ASTs. Formula text is retained for audit, but changing a LaTeX string cannot change the computed result. `registry.ts` compiles a dependency DAG, verifies units, matches declared dependencies against actual referenced symbols, rejects absent/duplicate outputs and cycles, and evaluates in topological order.

Every registered equation carries:

| Field | Function |
| --- | --- |
| `id`, `revision` | Stable equation identity distinct from software commit |
| `stage`, `output` | Explicit mathematical stage and captured output quantity |
| `unit`, `expression` | Dimensional/semantic output contract and executable AST |
| `dependsOn` | Complete declared dependency list, checked against AST |
| `math` | Human-readable symbolic rendering of the same law |
| `authority`, `evidenceTier`, `evidenceIds` | Type of law and its evidence lineage |
| `bounds`, `assumptions`, `falsifier` | Applicability, failure and validation criteria |

Outputs are `EquationCapture` objects with calculated values, units, input snapshots, model/equation revisions, origin/assumptions, evidence lineage and effective evidence tier. **R3-assumed inputs cannot be promoted to R1-published merely by running a valid equation**. `effectiveEvidenceTier` propagates the least verified required dependency, so no hidden data-authority escalation occurs.

## 3. Dimensional and semantic correctness

The AST explicitly distinguishes `W`, `VA`, `var`, `Wh`, `Ah`, `V`, `A`, `ohm` and `s`. Physically equivalent base dimensions are **not permission for semantically illegal substitutions**: apparent VA must become real W through a registered power-factor operation, and AC power does not become DC bus power by multiplying arbitrary voltage and current.

Examples:

[
P_{dc}=V_{dc}I_{dc},\qquad P_{loss}=I^2R
]

[
P_{ac,real}=S_{ac,apparent}\,PF
]

[
E_{Wh}=P_W\,\Delta t_s/3600,\qquad
\Delta Q_{Ah}=I_A\,\Delta t_s/3600.
]

Unknown or zero PF cannot automatically confer an inverter startup pass. Dimensionally invalid operations, missing state quantities, nonfinite values, under/overflow, incompatible unit arithmetic, and negative unserved demand are errors rather than display artifacts.

## 4. Stage equations registered to date

`source/next-core/math/models.ts` currently defines:

**WIRE_LOSS_MATH**:
[
\Delta V=IR,\quad P_{wire}=I^2R,\quad
E_{wire}=P_{wire}\Delta t/3600
]
with invariant `I²R = (IR)I`. Wire resistance is the value provided for **one named conductor**, not silently a full circuit loop.

**PV_DC_MATH**:
[
P_{panel}=V_{mp}I_{pv}
]
[
P_{mppt,in}=P_{panel}-I_{pv}^2R_{pv}
]
[
P_{mppt,out}=\eta_{mppt}P_{mppt,in}
]
[
P_{bus}=V_{bus}I_{bus}
]
[
P_{potential}=P_{curtailed}+P_{pvwire}+P_{mppt,loss}
 +P_{controllerwire}+P_{bus}.
]

This graph is now called by `solvePvBus` after the operating-point root solver obtains actual accepted currents. Every returned PV wattage/loss comes from its recorded equation capture; the DC-circuit and MPPT invariants must pass.

**BATTERY_MATH**:
[
V_t=V_{OCV}-IR,quad
P_t=V_tI,quad P_{heat}=I^2R.
]
For discharge-positive current, charging-only current is `I_ch=max(0,-I)`. The charging loss and retained chemical power are:
[
P_{coulombic}=V_{OCV}I_{ch}(1-\eta_C)
]
[
P_{chemical,net}=V_{OCV}I+P_{coulombic}
=P_t+P_{heat}+P_{coulombic}.
]
Charge movement and SoC:
[
I_{effective}=I+I_{ch}(1-\eta_C)
]
[
\Delta Q_{Ah}=I_{effective}\Delta t/3600,\qquad
SOC'=SOC-\Delta Q_{Ah}/Q_{available}.
]

`integrateBatteryElectrical` obtains all these physical outputs from the registry, while imperative event logic only determines when to stop at the battery reserve boundary. Battery model parameters are still model-dependent estimates until independently measured.

**AC_POWER_MATH** explicitly converts VA to W via PF and integrates the resulting real energy.

**AC_SERVICE_MATH** enforces:
[
E_{requested}=E_{served}+E_{unserved}
]
and rejects negative unserved demand.

The reference island engine now records accepted PV, battery and AC-service math frames for each committed substep. Unaccepted trial steps do not become authoritative history.

## 5. Products and physical wiring as a graph, not a diagram

`source/next-core/math/topology.ts` defines product identity (manufacturer, exact model and revision), physical terminals, rail kinds, individually identified conductors, branch current, conductor resistance, rated ampacity, fuse/breaker evidence and required positive/return pairs.

The validator checks:
- correct DC PV+/PV− and battery DC+/DC− rails and separate AC L1/L2/neutral/protective earth identities;
- incompatible direct connections and missing return paths;
- named terminal voltage overlaps and explicit unknown ratings;
- branch-current limits versus declared conductor and terminal ratings;
- protection rating that exceeds declared conductor ampacity;
- Kirchhoff current-law residuals at modeled ideal junctions;
- each wire's voltage drop, heat and energy **using the same WIRE_LOSS_MATH registry**.

Passing these checks means `structural_checks_passed`, **not NEC compliance**. The code returns `indeterminate` if required product/protection ratings are unspecified. Grounding design, fault-current behavior, breaker curves, NEC exceptions, split-phase neutral handling and energized transfer behavior remain outside the present validator. It does **not** infer a complete installer-ready connection graph from a component list.

## 6. Code authority and boundaries

- `source/next-core/math/`: canonical mathematical transformations, semantic units, dependency graph, provenance and infrastructure structure.
- `source/next-core/solar.ts`, `battery.ts`: operating-point logic and equations consumed from the math registry.
- `source/next-core/island.ts`: state machine, accepted substeps and stage captures.
- `source/next-core/entry.ts`: read-only API for inspecting the mathematical definition, evaluating registered formulas and inspecting declared wiring.
- `source/sim.js`: existing UI and its legacy dispatch engine, unchanged for live power calculations.

**No unverified physical law may be invented to bridge a missing source parameter.** Unsupported product variants, uncalibrated motor transients, missing original NASA POWER clock provenance and absent instrument measurements remain explicit blockers.

## 7. Automated falsification and release gates

`tests/next-core/math-registry.test.cjs` independently asserts numerical fixtures, unit rejection, cycle detection, dependency closure, charge sign, evidence downgrade, energy conservation and actual engine consumption of the registered formulas.

`tests/next-core/math-topology.test.cjs` verifies good/bad rail paths, missing return conductors, overcurrent, fuse rating, missing evidence, junction KCL, and that no structural pass is labeled electrical-code compliant.

CI compiles the typed engine, tests these registries, bundles them into the existing deterministic offline HTML build, and retains the full pre-existing browser, annual solar, historical winter and PWA regression gates.

**The user-facing live dispatch engine remains the existing engine until enough of its supported product/circuit physics is represented and independently validated in the new mathematical authority.** Hardware measurements and system-specific calibration remain required before promising accurate backup runtimes, code-compliant wiring or activating the optimizer.

## 8. Follow-on engineering work (not hidden in UI tasks)

1. Replace provisional PV fixed-Vmp tracking with a validated full I–V/MPPT operating-point model across controller variants and temperatures.
2. Register implicit solvers and their governing residual equations—battery terminal current, PV operating point, inverter transient and circuit-node balances—with exact convergence/failure reports.
3. Extend topology from individually checked wires to KCL/KVL-compatible network matrices, DC string/fuse/protection topology and verified 120/240 V phase/neutral relationships.
4. Connect exact equipment revisions and permissible terminal voltages/currents from catalog to the topology, removing heuristic compatibility assumptions.
5. Register charge absorption, BMS trip/recovery and thermal state equations with measured parameters and event/falsification tests.
6. Incorporate calibrated generator transfer, starting/fuel state machines and explicit fault isolation.
7. Migrate the live simulation calculation paths to equation-registered models under identical frozen scenarios, retaining the existing interface.
8. Update source hashes, scenario input snapshots, uncertainty/provenance, and test results per model revision.
9. Only then consider household planning and optimizer layers.

An internal mathematical test pass is evidence of code/math agreement, **not** evidence that actual hardware matches the assumed model.

## 9. Registered implicit electrical roots (numerical algorithms remain subordinate)

`source/next-core/math/implicit.ts` formalizes three implicit laws as independently inspectable residual ASTs:

\[
f_b(I)=(V_{OCV}-IR)I-P_{requested}=0
\]
\[
f_{pv}(I)=VI-I^2R-P_{accepted}=0
\]
\[
f_{bus}(I)=V_{bus}I+I^2R-P_{converter,out}=0.
\]

`source/next-core/numerical.ts` retains stable analytic small-root solutions for numerical conditioning, but every candidate is now verified against its registered residual. **A zero residual is not sufficient**: the quadratic's other branch can be mathematically valid yet physically inadmissible. The registry explicitly enforces the lower-current branch for battery/PV and nonnegative controller output current, and rejects division-by-zero and nonconverged roots.

The implicit law and solver implementation are separate; changing the root algorithm must preserve the law, its branch policy, units, tolerance, evidence, and falsifier. This is a first formal migration step; coupled inverter/AC/network nonlinear behavior remains an unimplemented operating-domain extension.

## 10. Reproducible source identity after migration

The deterministic website builder includes **every recursively discovered TypeScript source under `source/next-core/`**, including nested mathematical law declarations under `math/`, in the source SHA-256 manifest, in addition to the compiled inline browser bundle. CI reconstructs all hashes from source and verifies the bundled HTML byte for byte. A formula AST mutation therefore changes the model revision, cannot masquerade as a previous release, and must pass the full validation gate again.

Compiler success, a matching SHA-256 digest, and passing simulated fixtures do not elevate an estimated equation to field-validated physics. The digest proves source consistency, not experimental truth.

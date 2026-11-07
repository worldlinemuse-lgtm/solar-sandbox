# Solar Sandbox — UI Information Architecture
Status: SPECIFICATION ONLY, not a deployed redesign. Date: 2026-11-07.
Scope: reorganize information and navigation without changing simulation mathematics, product pricing facts or saved-state format.

## The problem visible in the actual repo
The current site shows a tall live SVG, controls, then Build/Loads/Missions/Score tabs. Build itself holds most hardware options, wiring and protection, backup power, save/export, prices and checks as a long scroll; a separate long How the model works section follows below the simulator. Tests currently click the legacy tabs and directly access DOM IDs. Reorganizing must preserve these functions.
The uploaded water-purification simulator is an illustrative example ONLY—not a template or design guide. General useful idea: retain visible key outputs while disclosing detailed tools in clearly named, accessible work areas. Solar Sandbox must follow its own solar-system design and shopping workflows.

## Primary navigation — six task-oriented areas
1. Overview: live PV→controller→battery→inverter→home diagram, status, Play/Pause, time/speed/weather, key metrics and one-click actions.
2. System Builder: Panels & MPPT; Batteries & Inverter; Site & Weather; Wiring & Protection; Saved Projects. Only the selected subsection is expanded by default.
3. Loads: individual appliance demand, quantity, W/VA/surge/duty cycle, scheduling, power by hour and add/edit flows.
4. Test & Analyze: Scenario/Missions, Results & timelines, warnings/faults, seasonal reliability/aging and report exports. Historical stress tests are not future-outage probabilities.
5. Shop & Compare: exact product identities and specifications, variants, hardware compatibility, bill of materials, quoted historical prices/offer freshness, missing items and cost caveats; later comparisons.
6. Sources & Help: engineering assumptions, underlying equations, data provenance, sources by product, unsupported behaviors, how-to and safety limitations.

## Content ownership map (existing DOM IDs)
Overview: #statusbar, #quick, #stage, #faults, #banner, #play, #speed, #step, #snow, #brush, #blast, #jumpM, #jumpD, #jumpH, #jump, #recharge.
Builder / Panels: #ptype, #ser, #par, #shade, #horBox, #mppt, #nMppt, #compat.
Builder / Batteries & inverter: #btype, #sysV, #bpar, #bloc, #soh, #reserve, #inv, #genOn, #genMode, #genFuel, generator and heating controls.
Builder / Site: #tilt, #az, #mount, #bifOn, #snowRec, #cold, horizon controls.
Builder / Wiring: #pvMat/#pvG/#pvFt, #cbMat/#cbG/#cbFt, #biMat/#biG/#biFt, #ambF/#ccc/#insC/#termC and #checks.
Builder / Projects: #saveB/#loadB/#exportB/#importB and state equivalents, including source-specific save status.
Loads: #pane-loads, #loadsTop, #dayChart, #loadRows and add/edit controls.
Test & Analyze: #pane-missions/#missionList and #pane-score/#score/#chart/#log; reporting controls and failure scenarios.
Shop: #costTop, #costList, #costTotal, #costNote, #otherCost and current product catalog #partsList with appropriate specification links.
Reference: How the model works, model accuracy explanations, product sources #srcParts, weather/scientific sources, not-modeled cautions.
Every current DOM control and data element must map to exactly one owned view; cross-view shortcuts navigate to it, never duplicate conflicting controls.

## Screen layout decisions
Desktop: compact persistent labeled navigation, a primary task workspace, and optional constrained-size live visual while editing. The full-height diagram must not be a scroll barrier before settings or shopping.
Mobile: clear navigation or bottom main actions plus More; one task panel at a time; compact battery/load/status strip stays visible. Overview contains the full scene, other tasks prioritize forms, product lists and results. Avoid horizontally scrolling settings forms and duplicate nav bars.
Header: project/preset title, operating state, Run/Pause and one or two key status measures. Provide direct warning access with a grounded count when available.
Disclosure: essential decisions first; advanced wire math, exact BMS settings, source equations and uncertainty remain one contextual action away. Hidden is not deleted; unsupported claims remain labeled.
Interaction: selecting panel/controller/battery in the diagram may open matching Builder subsection when those clickable hooks exist; existing diagram actions must not break. Current #qLoads points to Loads, #qCost to Shop→BOM, not deep scroll anchors.
Accessibility: explicit button labels, focus and selected state, 44px comfortable mobile targets, keyboard access, focus restoration, Escape closes overlays, no silent hiding of critical errors.

## Why this division
The user's actual sequence is: determine household load → choose actual compatible hardware → run scenarios → inspect outcomes and failure modes → see what must be purchased → check supporting source evidence. Overview is the consistent simulation home. Categories should follow jobs people want done, NOT how source modules happen to be named.

## Implementation packages
UI-00 INVENTORY: snapshot current results, screenshots and save/export behavior; create DOM/control inventory, existing click-hook map, tests selectors and content ownership. No orphan controls. Baseline branch+SHA recorded.
UI-01 NAV SHELL: add semantic responsive main navigation and one active task panel. Keep existing controls/IDs, handlers, status, simulator clock and on-screen outputs. Navigate without reinitializing state or altering equations. Preserve or migrate old four tab handlers; tests currently use selectors .tabs button[data-tab=build/loads/missions/score].
UI-02 CONTENT SPLIT: partition the massive #pane-build into Panels, Battery/Inverter, Site, Wiring, Projects. Place BOM/product source content in Shop and educational text in Reference. Existing #qLoads and #qCost shortcuts must continue to work.
UI-03 PROGRESSIVE DETAILS: collapsible advanced values, context-relevant help and source links, error/warning→setting navigation, time-stamped price caveats, source/evidence display. No claims of current inventory before a working commerce-refresh pipeline.
UI-04 QA AND RELEASE: run Node/Python/Playwright CI, source/build.py --check, deterministic bundle check, 25-winter regression, save/import/export regression, and actual browser screenshots on phone/tablet/desktop including touch/keyboard/light/dark. Compare numeric outputs on frozen scenarios byte-for-byte or by defined invariant tolerances.

## Non-negotiable acceptance criteria
- Reach hardware configuration, household appliance editing, mission tests, results, shopping BOM, and published model sources without traversing unrelated long-form content.
- On mobile, a stage taller than the screen never blocks the navigation for other workspaces.
- 100% of prior settings/actions and source links remain available; state persists when switching sections.
- Existing simulation physics, prices and model descriptions are not silently modified; no unsupported safety/availability claims.
- Every direct-navigation button performs its action and keyboard/focus behavior is verified.
- GitHub Pages still serves a deterministic offline build with index.html matching the generated source.

## Known engineering migration constraints
source/sim.js init() binds .tabs button clicks and its #qCost/#qLoads handlers use scrollIntoView. Existing Playwright tests click these tabs and direct hidden-in-future controls. UI migration MUST adapt the handler and tests in one reviewable change, not simply hide old controls.
source/build.py generates index.html from source/template.html and source scripts, embeds voice audio, and hashes inputs; production updates require rebuilding and committing generated index.html. A source-only UI change would fail build parity and would not be deployed.
Retail prices shown in the app were checked Oct 30–31, 2026. Moving BOM to Shop must retain historical-date labels, estimated/missing status, and before-tax/shipping caveats.

## Release checkpoint
This file captures a product-specific design plan after reviewing both the actual source and the user's example ZIP. It is not a finished UI, rendered mockup, browser-verified build, nor an authorization to copy the example's code, brand, or layout. Implement on isolated branch and validate before production merge.
# Solar Sandbox — Engineering and UX upgrade roadmap

**Audit date:** 2026-11-02  
**Scope:** GitHub repository `worldlinemuse-lgtm/solar-sandbox`; browser testing of a byte-identical copy of repository `index.html` at desktop (1440 px), tablet (768 px), and mobile (390 px), plus source review.  
**Limit:** The external GitHub Pages URL could not be reached from the audit environment. Browser tests used the exact same `index.html` blob (Git SHA `9a158eb739afc111147597a4ff02d38546081e17`) loaded into Chromium. This is not an end-to-end test of production Pages or service-worker hosting.

## Product inventory

- **Build:** panel model/count, series/parallel strings, MPPT choice/count, battery model/configuration/condition/location, inverter, cable gauge/material/length, ambient/termination conditions, array shading/tilt/azimuth, cost and compatibility checks.
- **Loads:** 12 starting appliances; custom appliance presets; edit wattage, quantity, voltage, surge, schedules, duty cycle, thermostat, and charging behavior; daily energy graph.
- **Missions:** custom tests, typical-year weeks, synthetic low-sun week, 25 observed November–February winter scenarios, worst-sun stretch search, 25-winter failure-rate summary, and estimated battery aging.
- **Score:** battery charge, accumulated solar and served/unserved energy, faults, blackout minutes, time-series chart, event log.
- **Persistence:** browser saved design and simulation state, JSON export/import, PWA manifest and offline caching, bundled voice guide.
- **Implementation:** `source/template.html`, `source/{sim,physics,battery,elec,tmy,hist,snowhist}.js`, `source/guide.mp3`; `source/build.py` produces the self-contained `index.html`. `tests/` holds Playwright and PV comparison checks.

## Release-blocking calculation defects

### P0-1 — Missing service is invisible to the blackout score

**Reproduced:** With a default 120 V-only inverter, other appliances off, and one continuously requesting 1,000 W at 240 V, `SIM.step()` reports `live.unfit = 1000 W`, `live.demand = 0`, `live.unserved = 0`, `stats.blackMin = 0` while accumulating `stats.unfitWh`. The daily load summary reports ~25.53 kWh/day, which includes the appliance it cannot operate.  
**Root:** `loadFits` excludes incompatible demand from the step's served/unserved calculation; `dayProfile` counts every enabled appliance without compatibility filtering.  
**Required:** Track **requested**, **electrically compatible**, **actually served**, **unserved due to unavailable supply**, and **unserved due to incompatible equipment** energy separately. Any explicitly required appliance that is not powered must be included in mission outcome/availability metrics. Never silently treat incompatible demand as successful delivery.  
**Acceptance:** For the 1,000 W, 240 V test load, after 60 min: ~1 kWh requested, 0 delivered, ~1 kWh incompatible/unserved, and >0 failed-service minutes; consistent daily and score displays. Tests across 120 V, split-phase, different leg loads, and partial service.

### P0-2 — Tripped BMS can still receive generator charging

**Reproduced in prior independent audit:** Generic `bmsTrip=true` with no PV permitted generator charging and increased SoC from 20% to 50.85% in 60 simulated minutes, despite a 'battery disconnected' status.  
**Root:** `genCharge()` in `source/sim.js` is not gated by `S.bmsTrip`.  
**Required:** Explicit charge/discharge protection flags and verified recovery rules per battery model; as a conservative baseline generic disconnected BMS cannot accept any source charge. Preserve consistent state through generator/PV/house-drop branches, resets, and saved states.  
**Acceptance:** In disconnected/tripped state both generator and PV result in zero battery charge current and no unsupported SoC gain (except the modeled self-discharge). Regression tests cover each path.

### P0-3 — Portable generator acts as unlimited, auto-start standby power

**Root:** Low-SoC control automatically starts the Honda EU2200i, with no manual-start condition or enforced fuel supply. `stats.genGal` tracks fuel consumed only after the fact.  
**Required:** Clearly distinguish theoretical ideal-backup scenario from operational backup. Support finite tank/fuel stock, manual starts, refueling actions, operator availability/delay, maintenance outages, and a physically compatible transfer/charging topology. Do not label a recoil-start generator as automatically capable of starting.  
**Acceptance:** Zero initial fuel means zero generator energy. Fuel limits constrain runtime. With manual-start mode and absent operator, generator does not start. Outage/failure results identify fuel exhaustion and unmet loads. Rerun the 25-winters scenarios after the model changes.

## P1 — Correct labeling and test confidence

1. Battery rendering in `source/sim.js` hardcodes `Battle Born` for the bank and `100Ah` for illustrated modules, including when another battery is selected. Use selected model, Ah, nominal voltage and actual `nS × nP`.
2. Separate AC requested demand, inverter idle/no-load loss, DC-side losses and actual energy delivered in Load and Score summaries. '0 appliances switched on; 0.31 kWh/day' is currently mathematically explainable by idle draw, but confusing without a clear breakdown.
3. Add fast invariants and regression tests to every pull request: no energy created, charge/state mutual consistency, correct load compatibility and outage accounting, and stable save/import migration.
4. GitHub Actions currently uses `SKIP_WINTERS=1`, intentionally skipping full historical and aging workloads. Keep fast CI, add scheduled/nightly or pre-release 25-winter and battery-aging checks with archived artifacts.
5. Audit model catalogs for supported manufacturer equipment, current pricing and source dates; show verified price vs estimate vs missing balance-of-system costs, shipping/tax/install and operational fuel separately.

## P2 — Mobile and accessibility

**Measured at 390px viewport:** status/quick controls begin ~585px; 600×1050 SVG stage renders ~663px tall from page offset 798px; Play begins ~1516px and Build pane begins ~1751px. Build pane extends ~7408px. The PV disconnect target is ~30×24px; playback/action buttons are ~35px tall. No horizontal overflow was observed, but visibility and touch usability need work.

- Make Build, Loads, Missions, Score navigation persistent or accessible without passing the entire diagram; allow collapse/expand diagram on phones.
- Replace or supplement the shrunk desktop SVG with a native responsive stacked solar → controller → battery → inverter → house view, including accessible 44px-ish touch controls.
- Add proper tab semantics (`role="tab"`, `aria-selected`, linked `tabpanel`), visible focus, keyboard access for SVG disconnect and appliance tiles, and concise screen-reader summaries for chart data.
- Restructure the extremely long Build pane into task-based groups: System, Panels, Battery, Backup, Wiring, Cost, Design check. Support anchored sections and compact summaries.
- Clarify auto-string behavior: tapping '+ panels' can change the count from 6 to 8 because of series wiring, which is physically intentional but needs explicit feedback.

## P3 — Product improvements (after model correctness)

- **Guided sizing:** 'What must stay on?' essentials-first wizard for freezer, refrigerator, pump, internet, heating controls; compare day/night and multi-day energy deficits.
- **Side-by-side design comparison:** costs, battery usable kWh, max AC W, surge handling, winter median/worst-case unmet critical loads, generator gallons and service intervention requirements.
- **Uncertainty:** show scenario ranges for shading, snow removal, dirty panels, outages, temperature, solar data, battery aging, and real-world appliance power variance. Historical frequency is NOT a probability forecast.
- **Fuel and outage logistics:** track runtime and replenishment schedules, gallons on hand and consumption, manual refueling downtime, planned battery reserve, and loss of ability to power 240 V circuits.
- **Price/provenance:** model source URL, date, spec revision, quote status, optional local tax/shipping and installation work, and a clear missing-items list.
- **Persistence:** verify PWA installation/offline/online update behavior on actual hosted HTTPS; service worker should not return cached app HTML for unrelated failed cross-origin GET requests. Test Android Chrome and a mid-range device.

## Tests executed in this review

- `index.html` SHA matched the corresponding repository content listing (blob hash `9a158eb739afc111147597a4ff02d38546081e17`).
- Chromium rendered at widths 1440, 768, and 390 without JS page errors or horizontal document overflow in the tested default screens.
- Verified tab switches, panel count control (6→8 with wiring adjustment), basic simulation advance, Load switch-all-off/reset, appliance addition and edit UI, missions startup, score update, and LONGi preset.
- Directly reproduced 240 V service omission as described above.
- Earlier audit: generator assumptions, BMS trip/charge, equipment mislabel, and solar fixture comparison.
- **Not completed:** GitHub Pages HTTPS loading (restricted), PWA install/cache/offline E2E, comprehensive import/export roundtrip, full 25-winter/aging reruns, physical electrical validation, exhaustive catalog/current-price verification.

## Implementation policy for upgrades

1. Preserve current working `main` site during development; use short feature branches and focused pull requests.
2. Edit source files, regenerate `index.html` with `python source/build.py`, and verify `python source/build.py --check`.
3. Include a direct regression for every critical physics/state bug and report exact before/after results.
4. Make incompatible load, generator availability, fuel assumptions, and uncertainty visible in the UI rather than burying them in documentation.
5. Run CI before merge, keep a recoverable version/tag, and verify the hosted Pages experience after each release.

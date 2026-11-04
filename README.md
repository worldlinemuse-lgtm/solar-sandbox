# Solar and House-Battery Sandbox

An interactive solar and house-battery simulator, with a built-in voice guide to every control. You build a system from real panels, charge controllers, batteries, an inverter and the cables between them, then run it minute by minute through Honesdale, PA weather: the typical weather year, or any of 25 NASA POWER modeled historical winters.

The whole app is one self-contained file, `index.html`. The voice guide, weather data, scripts and styles are built in, and nothing needs to be installed or built to use it. The same page is also kept as separate source files in `source/`, with a build script that puts them back together (see "Source files and building").


## Brand independence and third-party rights

**Independent app — not sponsored, certified, affiliated with, approved by or endorsed by the brands, data providers or agencies named here.** Product and company names (including LONGi, Victron, Renogy, Battle Born, LiTime and Honda) are used to identify real equipment for factual simulation and comparison. Trademarks belong to their respective owners. NASA POWER, PVWatts and other referenced sources are attributed as data/technical references, not partners or approvers.

Copyright permission is separate from attribution or a brand disclaimer. Do not add manufacturer logos, photographs, copied manuals, promotional text, third-party audio, software or data without checking the actual rights and applicable licenses. The review found an embedded voice recording with **unverified ownership/redistribution permissions** and an outstanding PVWatts/NSRDB dataset terms check; therefore the project is **not certified copyright-clear for commercial distribution**.

See [Brand, third-party content and rights audit](docs/BRAND_AND_CONTENT_RIGHTS.md) for the asset inventory, required checks and citation references.

### Legal notices and proposed terms (prepublication review)

- [Full legal, safety, brand, IP, warranty and liability notices](docs/LEGAL_NOTICES_AND_DISCLAIMERS.md) are also embedded directly in the offline application. Short, visible safety/brand warnings appear at the top of the page.
- [Terms of Use — prepublication contract draft](docs/TERMS_OF_USE_PREPUBLICATION_DRAFT.md) is **not operative** and **not an accepted user agreement**. It requires a verified operator, business model, jurisdiction, lawful consent/acceptance mechanism and legal review before publication.
- A comprehensive disclaimer **does not guarantee immunity**, make copyrighted content lawful, or eliminate applicable statutory or consumer rights. The [outstanding rights review](https://github.com/worldlinemuse-lgtm/solar-sandbox/issues/11) must still be completed before commercial release.
 A top-level software license has not been selected; public GitHub visibility is not an open-source license.

## Mathematical authority — equations first, code second

Solar Sandbox now maintains an independently inspectable mathematical equation registry for **PV/DC power, wire resistance, battery charge/SoC, AC power factor and delivered/unserved energy**. The registry is not presentation code: it checks units, dependency closure, law revisions, evidence tier and conservation residuals, while the new physics engine reads its computed stage outputs.

A companion product/topology graph identifies manufacturer-specific devices, physical terminals, individual wire runs, voltage rails and protection uncertainties. It can reject crossed rails, missing return paths, overcurrent and junction imbalances. **It cannot certify electrical installation compliance.**

The read-only integrated browser exposes `SolarNextCore.getMathematicalDefinitions()`, `evaluateMathematics(...)`, and `inspectInstallation(...)` for engineering inspection without touching the public interface's existing dispatch behavior.

See [Math-first architectural contract](docs/MATH_FIRST_ARCHITECTURE.md), [independent physical evidence](docs/PHYSICAL_BENCHMARK_EVIDENCE.md), and [release blockers](validation/next-core/coverage.json).

## Independent physical-engine validation (read-only integration)

A second, strictly type-checked TypeScript physics engine is now **bundled offline** with this website and available through the diagnostic JavaScript APIs `SolarNextCore.shadowPv(...)` and `SIM.nextCoreShadow()`. They do not alter the live simulator's dispatch decisions, energy totals, generator fuel or battery state. The current interface is unchanged.

The separate PV reference engine reconstructs the LONGi LR4-72HBD-435M single-diode model and checks against five independently published PVsyst curve points, with manufacturer/specification and pvlib regression tests. Unsupported models and missing measurements remain explicitly unsupported or estimated. An independent mathematical conservation error in battery charge-efficiency bookkeeping and unverified AC generator/inverter PowerAssist summation have also been corrected in the new core.

**This is a mathematical/published-reference milestone, not an instrument-calibrated home electrical system.** Only zero field-instrument datasets are currently available, so the new power dispatcher is NOT the live production solver. Live-engine replacement, household planner and automatic optimizer remain blocked pending measurements and topology verification.

See [reference hardware and physical evidence](docs/PHYSICAL_BENCHMARK_EVIDENCE.md), [engine design contract](docs/NEXT_CORE_ENGINE_CONTRACT.md), and [validation coverage and release gates](validation/next-core/coverage.json).

## Auditable analysis exports and version compatibility

Completed historical-winter and battery-aging calculations now provide **Export auditable results (JSON)** controls. Reports contain the exact system configuration, appliance patterns, model source SHA-256 digests, historical weather years, initial conditions, output summaries and explicit calibration limits. Change the modeled system or appliance pattern and the prior result is invalidated; repeat the calculation to obtain a new report.

Older design files can still be imported, but the app warns when the model revision differs or is missing. Simulation state files saved with a known, different model revision are not resumed as if equivalent; import their design and calculate again.

See [Analysis exports and report schema](docs/ANALYSIS_RESULT_EXPORTS.md) and [Reference validation/provenance](docs/REFERENCE_VALIDATION_AND_PROVENANCE.md).

**Validation scope:** The engineering model passes internal energy-accounting tests and selected manufacturer/reference benchmarks. Real battery, motor surge, inverter transient and location-specific irradiance calibration remains an open task. Do not use simulation results as certified wiring designs or guaranteed backup runtimes.

## What it models

- Sun on the panels for any tilt and direction, from hour-by-hour typical-year weather (NSRDB, served through PVWatts), with the Perez sky model and glass reflection loss. Checked against pvlib within 0.1% a year, and against PVWatts with widely spaced rows within 0.2% at 40° to 90° tilt.
- 25 NASA POWER modeled historical winter weather sets (Nov 1 to Feb 28, 2001–02 through 2025–26), a least-sun historical-stretch finder, and historical stress-test outcomes. These are gridded satellite/weather-model estimates, **not ground-station observations or a forecast probability**.
- Panel temperature from the Sandia model for your mount type, with each panel's own datasheet coefficients where published.
- Wire loss and voltage drop for copper or aluminum cable on each of the three runs. Wire and fuse checks use NEC ampacity tables with temperature and bundling corrections, and are labeled "Within spec", "Table math", "Estimate" or "Not verified". None of these is an approval, and no fuse is ever marked as suitable, because no battery maker here publishes a short-circuit current.
- Each battery's own cold limits from its maker's documents, AGM capacity loss at high current and in the cold from Renogy's spec sheet, the lithium absorption timer from Battle Born's data sheet, a battery health setting, and the self-heating battery's warm-up.
- Battery aging after 1, 5 and 10 years (Missions tab). It measures how many full-cycle equivalents a typical year puts on your bank and the median daily swing, then uses the maker's published cycle life: Battle Born 3,000 to 5,000 cycles (the sim uses 3,000), LiTime 4,000 cycles at 100% depth, 6,000 at 80% and 15,000 at 60% (the 48 V model gives only 4,000 at 100%), Renogy AGM 500 cycles at 50% depth. Then it runs all 25 recorded winters at each age. Estimates, marked on the page: end of rated life taken as 80% capacity left, calendar loss of 1% a year for lithium and 4% for AGM, no effect of heat or cold, and a bank that has lost capacity keeps cycling at the same rate. Below 60% health it stops and says the battery is past its rated life.
- Each Victron inverter's continuous, time-limited and peak power, heat derating, efficiency and no-load draw.
- Missions, including a synthetic worst week built from seven of the dullest December days in the weather file, and a mission for any recorded winter.
- Save and load, export and import, for both a design and a mid-run simulation state.
- A one-tap preset for 4 LONGi LR4-72HBD-435M panels (specs from LONGi's datasheet version V13), wired 2 in series by 2 strings on one Victron SmartSolar 150/70, with a list of which controllers and layouts the panels' cold open-circuit voltage allows at the sim's −20°F design temperature.
- A bill of materials where every line is marked confirmed (seller link and date), your own price, estimate, or missing, with the missing items listed by name.
- 120/240 V split phase with two MultiPlus-II 120 V units, one per leg. Each appliance goes on leg L1, L2 or both at 240 V, each leg is held to one unit's limits, and a 240 V appliance on a 120 V-only inverter is flagged and left unpowered. Includes a Franklin 1/2 HP 240 V well pump from Franklin's AIM manual; its start-up surge is an estimate.
- Controllers each take whole strings, not an equal split of the array.
- Horizon shading: the height of hills, trees or buildings in eight directions. Direct sun is blocked when the sun is lower; the diffuse-sky cut is a simple estimate.
- Snow on the panels in the recorded winters, from NASA POWER's daily snowfall. A day with at least 1 mm of water equivalent (about 1 cm of snow) covers the panels; that trigger is an estimate. Snow slides off with NREL's published model, the one in pvlib. You can switch it off.
- A battery reserve: the house goes dark at the level you choose instead of at empty.
- A Honda EU2200i generator (1,800 W rated, **recoil start**, 0.95-gallon tank). The default simulation requires a manual start. An optional **attended operator** scenario assumes a person always operates it when charge crosses thresholds; there is no automatic starting hardware. Fuel inventory is finite and bounds runtime. Larger stocks assume refueling can occur without downtime: tank refills, human availability and maintenance are not modeled. Fuel use between Honda's two published runtimes is estimated; its $1,199 quoted price is an estimate.

Every part links to its maker page or datasheet under "Sources by part" on the page.

## Put it on GitHub Pages

1. Create a new public repository on GitHub, for example `solar-sandbox`.
2. Upload everything in this folder to the root of the repository, keeping the `source`, `tests` and `validation` folders. On the repo page that's **Add file → Upload files**.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set Source to **Deploy from a branch**, then pick the `main` branch and the `/ (root)` folder, and save.
5. After a minute or two the site is live at `https://<your-username>.github.io/solar-sandbox/`.

`.nojekyll` tells GitHub to serve the files as they are, without running them through Jekyll.

## Install it on an Android phone and use it offline

This works from the GitHub Pages address, not from a file on the phone, because Chrome only installs web apps served over https.

1. Put the folder on GitHub Pages as above, including `manifest.webmanifest`, `sw.js` and the three `icon-*.png` files.
2. On the phone, open Chrome and go to `https://<your-username>.github.io/solar-sandbox/index.html`.
3. Wait for the page to finish loading once while you are online. That first visit saves the page and its icons on the phone.
4. Tap the three-dot menu at the top right, then **Install app** (on some phones it says **Add to Home screen**, then **Install**). Chrome may also show an install banner at the bottom; tapping it does the same.
5. Open **Solar Sandbox** from the home screen. It opens full screen, without the browser bar.
6. To check offline use, turn on airplane mode and open it again. It should load and run from the copy on the phone.

While you are online it fetches the newest version first; offline it uses the saved copy. After you update the site on GitHub, open the app once while online to pick up the new version. Saved builds and runs are kept in the browser's storage on the phone, so clearing Chrome's site data for the page deletes them; use **Export design file** or **Export state file** to keep a copy.

The offline setup only switches on when the page is served from a web address. Opened as a file, `index.html` doesn't need it: everything is already inside the one file.

## Automatic test runs on GitHub (Actions)

`.github/workflows/tests.yml` tells GitHub to run the checks on its own computers every time you push a change or open a pull request.

- It installs Python 3.12, Node.js 20, Playwright with Chromium, and pvlib.
- It first checks that `index.html` is exactly what `source/build.py` produces from the source files, so the page and the source can't drift apart.
- It runs the page test suite with `SKIP_WINTERS=1`, which skips the slow 25-winter runs, then the solar check (`tests/check_solar.py`, fails if any tilt is more than 0.5% off pvlib or off PVWatts with widely spaced rows), then the offline install check (`tests/test_pwa.py`, which serves the folder, waits for the offline cache, goes offline and reloads).
- It keeps `tests/test_v7_results.json` as a downloadable result on the run's page, even when a step fails.
- See the results on the repo's **Actions** tab. A green check means every step passed; a red X names the step that failed.

GitHub's web uploader can skip folders whose names start with a dot. If `.github` doesn't appear in the repo after uploading, use **Add file → Create new file**, type `.github/workflows/tests.yml` as the name, and paste in the file's contents. Actions must be allowed for the repo under **Settings → Actions → General**.

## Source files and building

`source/` holds the page split into its parts. `index.html` is built from them and is byte-for-byte the same as what the build script makes.

- `template.html`: the layout, styles and controls, with a placeholder where each part below goes in.
- `sim.js`: the simulator and the page logic (parts, wiring checks, missions, saving, cost list).
- `physics.js`: sun on the panel for any tilt, direction and horizon, and panel temperature. The solar checks in `validation/` test this same file.
- `battery.js`: battery models, cold limits and the self-heating battery.
- `elec.js`: wire loss, wire and fuse checks, inverter limits and efficiency.
- `tmy.js`: the typical-year weather. `hist.js`: the 25 recorded winters. `snowhist.js`: their daily snowfall.
- `guide.mp3`: the voice guide.
- `build.py`: puts them together. It needs only Python 3.

To change something, edit the file in `source/`, then rebuild and test from the repo folder:

```
python source/build.py
python source/build.py --check
python tests/test_v7.py
```

The first line rewrites `index.html`. The second confirms `index.html` matches the source build; GitHub runs it on every push. The audio is put into the page as base64, and every script goes in where its placeholder is, so the result still works as a single file with no network.

## Run it locally

Open `index.html` in any modern browser. No server is needed. To try the installable version on a computer, serve the folder instead, for example `python -m http.server` in this folder, then open `http://localhost:8000/index.html`.

## Rerun the tests

The tests drive the real page in a headless Chromium browser and check the simulator's numbers. They need Python 3 and the Playwright package.

```
pip install playwright
python -m playwright install chromium
python tests/test_v7.py
```

By default it tests `index.html` in this folder; pass another path to test a different copy, for example `python tests/test_v7.py /path/to/page.html`. A full run took about 6 minutes here. Set `SKIP_WINTERS=1` to skip the LONGi 25-winter runs. It writes `tests/test_v7_results.json`. Look at:

- `asserts`: 56 pass/fail checks (54 with `SKIP_WINTERS=1`). The 31 older ones cover zero sun, empty battery, inverter overload timing, controller clipping, thin cable, battery temperature extremes, equipment that doesn't fit together, check labels, NEC tables, fault-current estimate, AGM drain, absorption timer, battery health, heater speeds, energy balance, weather switch, wind effect, recorded-winter mission, worst-stretch finder, failure rates, state save and resume, bad files refused, and the new inputs. The 12 newer ones cover the LONGi specs, the cold open-circuit voltage, compatible and incompatible controller layouts, the LONGi preset, each bill-of-materials category and the totals, the default build's panel price being confirmed, split-phase per-leg limits, a 240 V load on a 120 V-only inverter, the well pump surge, per-string controller sharing, the day counter past 365 days, and the aging math against hand-worked values. Nine more cover horizon shading (physics and in the sim), snow coverage compared minute by minute with pvlib's `coverage_nrel` on the same inputs, snow switched off and absent in the typical year, the battery reserve, the generator's specs and fuel curve, a generator run with an energy balance, no generator on an inverter without a charger, and the generator's cost line. `aging_run` runs the aging estimate on the LONGi preset and checks health falls each year, blackout hours never fall as health drops, and your own design and battery health come back unchanged. `aging_ui` runs it with the Renogy AGM bank through the page's own buttons, including the past-rated-life case and the button that sets battery health. `voice_guide_current` checks that the built-in voice guide is the current 2-minute-23-second recording and that no out-of-date note is on the page. `phone_layout_light_dark` fails if any of the eight phone views below overflows or has overlapping controls. Every entry should have `"passed": true`. Three checks also compare the sim with the saved LONGi datasheet, Franklin manual and dealer prices; those files aren't in this folder, so here the entries show `datasheet_checked`, `aim_row_checked` or `seller_checked` as false and only the sim side is tested.
- `longi_25_winters`: the LONGi preset run through all 25 recorded winters with three appliance sets, then the food-cold set again with the rear-side gain on. `longi_25_winters_v8` repeats it with recorded snow on, and then with the generator added.
- `balance` and `balance_year`: energy in equals energy out plus losses, minute by minute.
- `buyCost`: the price math against a brute-force check, with no mismatches.
- `missions`, `persistence`, `state_save`: mission results and save/load round trips.
- `layout_light_*` and `layout_dark_*`: a 390-pixel-wide phone screen with no overflow (`bad` empty) and no overlapping controls.
- `errors`: page errors during the run. It should be empty.

Two more checks:

```
python tests/test_offline_file.py
python tests/test_pwa.py
```

`test_offline_file.py` opens `index.html` from disk with the browser offline and every web request blocked, and checks that the simulator runs and the voice guide loads. `test_pwa.py` checks the installable version: the manifest, the icons, the offline cache, and a reload with the network off.

## Rerun the solar validation

This compares the page's solar model (`validation/physics.js`, the same code built into `index.html`) with pvlib and with saved PVWatts runs on the same weather. It needs Node.js and Python with pvlib.

```
pip install pvlib pandas numpy
cd validation/bench
python validate_pv.py
python bifacial_check.py
```

They write `validation_pv.txt` and `bifacial_check.txt` in the same folder. In `validation_pv.txt`, the sandbox and pvlib columns should match within about 0.1%. PVWatts reads 3 to 7% lower on steep tilts in the saved runs that use its default row spacing (ground coverage ratio 0.4), because it assumes rows of panels shading each other. `compare_gcr.py` checks that: it compares the sandbox with PVWatts v8 runs at 40°, 60°, 75° and 90° facing south with widely spaced rows (ratio 0.01, the lowest PVWatts accepts), saved as `pvwg_t*_a180_gcr001.json` on October 31, 2026 from developer.nlr.gov. Yearly sun on the panel matched within 0.2% at every one of those tilts (`compare_gcr.txt`):

```
cd validation/bench
python compare_gcr.py
```
 Matching PVWatts tests only the sun-to-panel part, not the batteries or wiring.

## Limits

Snow cover in the recorded winters starts from a daily snowfall total, so when in the day it fell is not known. This is a learning model, not a wiring plan or a safety check. The inverter efficiency curve shape, appliance running watts, charger efficiency, the AGM voltage curve, the charge taper start, the bifacial rear gain and the self-heating battery's warm-up rate are estimates, and the page labels them. PVWatts was cross-checked only up to a 40° tilt with a single row. The typical-year file's very light wind (about 0.2 m/s) hasn't been confirmed. Prices were taken from makers' and dealers' sites on October 30 and 31, 2026, before tax and shipping. The LONGi panels use your own $100 purchase price. Fuse and cable sizing, code compliance and real output still come from the manuals, the NEC and a licensed electrician.

## Corrected model integrity (November 2, 2026)

- Incompatible 240 V loads on a 120 V inverter are **unserved demand** and cause failed-service/blackout minutes. They no longer disappear from mission outcomes.
- The load summary separates appliance demand, compatible and incompatible energy, and estimated inverter overhead.
- The generic tripped BMS state blocks all charging, including generator charging, until a manual reset.
- EU2200i operation defaults to manual recoil start. An **attended-operator** mode models a person starting/stopping it at battery thresholds. This is *not automatic standby equipment*.
- A finite fuel stock is tracked. This model still does not simulate separate 0.95-gallon tank refills, refilling delays, operator absences, maintenance, or a certified electrical transfer arrangement.
- The battery drawing and title use the selected model and its nominal Ah instead of hard-coded Battle Born 100 Ah labels.
- `tests/test_integrity.py` adds specific browser regressions for inverter compatibility, BMS isolation, manual startup and bounded fuel.

**Stale saved results:** `tests/test_v7_results.json` was generated *before* these corrections and includes generator-assisted historical calculations with unrealistic operation. It is archival only. Run the updated full historical suite to produce corrected scenarios. Even corrected historical runs are stress tests, **not** a predictive future-failure probability.

**Still unverified or simplified:** Motor startup apparent power (VA), power factor and transient timing, PV shading/snow uncertainty, battery aging, component pricing, field measurements, equipment integration, and code-compliant transfer arrangements. The app is an exploratory engineering model, not an electrical safety certification or guarantee of blackout survival.

### Visible missing-service indication

If a required appliance is incompatible with the configured inverter, the house display now shows **delivered and unserved watts**, and the affected appliance tile is marked as unpowered instead of looking switched off. The inverter display compares delivered AC output with all requested appliance watts, not only compatible watts.

### Verification

The corrected source and prebuilt `index.html` must match exactly; run `python source/build.py --check`. The fast browser integrity regression (`python tests/test_integrity.py`) and full fast CI suite (`SKIP_WINTERS=1 python tests/test_v7.py`) must pass before merging. The old 25-winter generator results in `tests/test_v7_results.json` remain historical artifacts, not validated outputs of this corrected engine.

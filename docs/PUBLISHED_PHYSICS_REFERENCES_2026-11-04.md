# Published physics implementation and independently checked inputs

**Date:** November 4, 2026  
**Development goal:** Engineer a scientifically grounded solar–battery simulation product using published physics and real manufacturer data. **Do not require private laboratory measurements to implement well-established equations.** The numerical simulation is not a certified electrical design.

## 1. Primary sources and equations incorporated

### PV module — complete single-diode source equation

Sandia PVPMC provides the PVsyst module relation:

\[
I=I_L-I_0\left(e^{(V+IR_s)/a}-1\right)-(V+IR_s)/R_{sh}(G).
\]

For a specified reference temperature and irradiance:

\[
I_L(G,T)=\frac{G}{1000}\left(I_{L,ref}+\mu_{Isc}(T-25)\right).
\]

The source-corrected absolute Isc temperature coefficient for the **2020 LONGi LR4-72HBD-435M PVsyst model** is **+6.7 mA/°C**. It must not be substituted with another revision's relative coefficient. We correct the photocurrent expression and benchmark against independent pvlib Lambert-W computations.

PVsyst documents irradiance-dependent shunt resistance:

\[
R_{sh}(G)=R_{base}+(R_{sh,0}-R_{base})\exp(-kG/G_{ref}),\quad
R_{base}=\frac{R_{sh,ref}-R_{sh,0}e^{-k}}{1-e^{-k}}.
\]

The 2020 LONGi report supplies **Rsh at STC = 1000 Ω**, but does **not** publish `Rsh0`. The separate reference fit `fitPublishedLongiPvsystRshZero()` derives an inverse-model value by minimizing relative squared errors at the **published 200/600 W/m²** 25°C MPP power points. The **400/800 W/m²** published results are held out for independent comparison, and 1000 W/m² is an STC identity check. This is a **fit to real publicly published mathematical output**, not a made-up datasheet constant or laboratory observation.

Implementation: `source/next-core/pv-diode.ts`, `pvsyst-shunt.ts`, `pvsyst-published-fit.ts`, `pv-wire-iv.ts`.

Tests: `tests/next-core/pvsyst-shunt.test.cjs`, `pvsyst-published-fit.test.cjs`, `tests/next_core_pvlib_pvsyst_shunt.py`, `tests/next_core_pvlib_iv.py`.

Source: https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/pvsyst-module-model/  
Published equipment curve: https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf  
PVsyst discussion of default/fitted secondary module parameters: https://www.pvsyst.com/help/physical-models-used/pv-module-standard-one-diode-model/parameters-besides-datasheets.html

### MPPT — efficiency *bound* and DC charge-current ceiling

Manufacturer `98% peak efficiency` is not a constant efficiency curve.

\[
P_{out,max}\le\min\{\eta_{peak}P_{input,available}, I_{charge,max}V_{battery,charge}\}.
\]

The controller may curtail power before extraction; **unharvested source potential is not automatically controller heat**. Victron's recommended nominal array wattage does not constitute a strict instantaneous DC power-input ceiling. Dynamic tracking, actual efficiency as a function of P/V/T, and charge-state taper remain separate tasks.

Implementation: `source/next-core/mppt-power-envelope.ts`, `victron-controller-reference.ts`.  
Official manufacturer limits: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html

### Battery — exact constant-current Thevenin RC state evolution

For signed current **positive on discharge**:

\[
\frac{dSOC}{dt}=\frac{-I\eta_{c}}{3600C_{Ah}},\qquad
\frac{dV_j}{dt}=\frac{I}{C_j}-\frac{V_j}{R_jC_j},\qquad
V_{terminal}=OCV(SOC)-IR_0-\sum_jV_j
\]

where charge efficiency is used during charging, and equals unity on discharge.

The **exact** fixed-current RC state over `Δt` (no forward-Euler timing error) is:

\[
V_j(t+\Delta t)=IR_j+[V_j(t)-IR_j]e^{-\Delta t/(R_jC_j)}.
\]

`advanceBatteryEcm()` checks voltage/SoC domains, interpolates user/source-supplied `OCV(SOC)` without extrapolation, computes signed terminal power and ohmic heating, and splits the timestep at the exact SOC boundary. It does **not** invent LFP/AGM RC components, measured `OCV(SOC,T)`, hysteresis, or BMS trip thresholds. Its exactness is mathematical **given fixed supplied parameters**.

Implementation: `source/next-core/battery-ecm.ts`.  
Independent analytic tests: `tests/next-core/battery-ecm.test.cjs`.

Technical model: https://thevenin.readthedocs.io/stable/user_guide/model_description.html  
NLR/NREL SAM battery-model inputs: https://samrepo.nlr.gov/help/battery_storage_btm.html

### Generator — real published fuel-consumption anchors

For the Honda EU2200i, Honda publishes **0.95 US gallons**, **8.1 h at 25% of 1800 W rated load** and **3.2 h at rated load**. Therefore the *published* steady points correspond to **450 W** and **1800 W**.

\[
gph(450)=0.95/8.1,\qquad gph(1800)=0.95/3.2.
\]

A two-point straight-line fuel interpolation is explicitly tagged as an **estimate between these two manufacturer anchors only**; the manufacturer did not publish zero-load/idle consumption here. `estimateHondaFuelGph(0)` returns an unknown out-of-domain result instead of manufacturing an idle measurement.

Implementation: `source/next-core/published-hardware.ts`.  
Source: https://powerequipment.honda.com/generators/models/EU2200i/

### Battery equipment limits — variant-specific official revision

Battle Born BB10012 published 100Ah, 7mΩ internal resistance, 100A continuous and 200A short surge up to 30s, recommended 50A charging and temperature constraints have been entered as *nameplate data*. The cited manual URL currently serves **Revision 038 (August 12, 2026)** despite its older `Rev032` filename, so the verified revision is stored explicitly.

Implementation: `source/next-core/published-hardware.ts`; no invented OCV curve.  
Source: https://battlebornbatteries.com/wp-content/uploads/2022/10/100Ah-12V-Standard-Battery-Manual_Rev032_1.29.26.pdf

## 2. Mathematical evidence protocol

For each function, tests distinguish (1) analytic identities/physical domain, (2) independent solver agreement, (3) published source reference points and held-out public results, (4) *optional* hardware/site-specific prediction checks.

This repository validates published mathematical models, not a particular physical installation. It must never convert a 0.05% agreement against pvlib into “0.05% real-world prediction error.”

Source revisions/variants and assumptions are tracked in the [standing accuracy policy](DEVELOPMENT_ACCURACY_POLICY.md) and the [coverage/release gate](../validation/next-core/coverage.json).

## 3. Next engineering work (no waiting for the user)

- Reimport NASA POWER historical weather through documented `time-standard=UTC` API requests; record original request, response hashes and hourly/civil-time conversion. The previous `source/hist.js` provenance is insufficient and must not be guessed.
- Expand PV bypass-diode/submodule shading and bifacial temperature/irradiance models using exact variant data; scalar shade losses are not adequate for every array.
- Implement full MPPT and battery/inverter numerical integration, including measured-or-published efficiency curves and chemistry-specific OCV, temperature, charge taper and aging.
- Reconcile all new math with live time-stepping and equipment compatibility, then run independent end-to-end conservation/state/parameter-domain tests **before** household planning and optimization.
- Keep any actual measured-site predictive accuracy claims separately conditional on having legitimate test observations. **Do not block E0–E2 engineering progress waiting for those observations.**

## 4. Merge criteria

- TypeScript strict compilation and Node mathematical regression tests.
- Independent pvlib, SciPy, manufacturer-source curve checks.
- Browser read-only API and no legacy state mutation.
- Deterministic generated `source/next-core-browser.js` and `index.html`.
- Battery/DC/inverter/generator integrity, 50 historical modeled winters and offline PWA tests.
- Clear distinctions among published parameters, derived values, fitted values and assumptions.

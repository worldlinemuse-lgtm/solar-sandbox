"""Independent nonlinear PV module AND cable-MPP benchmark against pvlib + SciPy.

Separate equations from the JavaScript one-diode/array/cable implementation:
* Lambert W single-diode I(V) in pvlib;
* SciPy bounded optimize delivered power after I^2 R wiring loss.
Only verifies agreement with a second physically parameterized *model*.
No instrumented hardware observations or installed-site calibration are implied.
"""
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import pvlib
from scipy.optimize import minimize_scalar

ROOT = Path(__file__).resolve().parent.parent
CASES = [
    {"irradiance": 200, "tempC": 25, "ohm": 0.0},
    {"irradiance": 400, "tempC": 25, "ohm": 0.5},
    {"irradiance": 600, "tempC": -10, "ohm": 0.1},
    {"irradiance": 800, "tempC": 45, "ohm": 0.3},
    {"irradiance": 1000, "tempC": 25, "ohm": 0.75},
    {"irradiance": 1100, "tempC": -5, "ohm": 1.0},
]
NODE = r"""
const fs=require('fs');
const {LONGI_435_PVSYST,singleDiodeMpp}=require('./.next-core-dist/pv-diode.js');
const {solveDiodeArrayCableMpp}=require('./.next-core-dist/pv-wire-iv.js');
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(cases.map(c=>{
 const module=singleDiodeMpp(LONGI_435_PVSYST,c.irradiance,c.tempC);
 const cable=solveDiodeArrayCableMpp({
   reference:LONGI_435_PVSYST,irradianceWm2:c.irradiance,
   cellTemperatureC:c.tempC,modulesInSeries:2,stringsInParallel:2,
   pvWireLoopOhm:c.ohm,minimumControllerInputVoltageV:0
 });
 return {moduleMppW:module.maxPowerW,moduleVocV:module.openCircuitVoltageV,
   moduleIscA:module.shortCircuitCurrentA,portW:cable.maximumControllerInputW,
   arrayGrossW:cable.arrayGrossPowerW,wireLossW:cable.pvWireLossW,
   moduleVoltageV:cable.moduleVoltageV,arrayCurrentA:cable.arrayCurrentA,
   residualW:cable.conservationResidualW};
})));
"""
js = json.loads(subprocess.run(
    ["node", "-e", NODE], cwd=ROOT, input=json.dumps(CASES),
    capture_output=True, text=True, check=True).stdout)

# These *same* published module parameters are deliberately passed into a
# mathematically independent Lambert-W implementation. Agreement verifies
# implementation, not accuracy of parameters in an actual installation.
N = 72
n = 1.04
RS = 0.27
RSH = 1000.0
I0REF = 0.087e-9
ISCREF = 11.36
# Exact PVsyst report 20 Feb 2020: muIsc=+6.7 mA/C, Isc_STC=11.36 A
ALPHA_ISC_REL = 0.0067 / 11.36
EG_EV = 1.121
TREF = 298.15
KB = 1.380649e-23
Q_E = 1.602176634e-19
KB_EV = 8.617333262145e-5
AREF = n * N * KB * TREF / Q_E
ILREF = ISCREF + I0REF * math.expm1(ISCREF * RS / AREF) + ISCREF * RS / RSH

def pvsyst_lambert_inputs(g, tc):
    tk = tc + 273.15
    il = ILREF * g / 1000 * (1 + ALPHA_ISC_REL * (tc - 25))
    i0 = I0REF * (tk / TREF)**3 * math.exp(
        EG_EV / (n * KB_EV) * (1 / TREF - 1 / tk))
    a = n * N * KB * tk / Q_E
    return il, i0, RS, RSH, a

def close(a, b, label, relative=0.0005):
    assert math.isfinite(a) and math.isfinite(b), (label, a, b)
    assert abs(a - b) <= relative * max(1, abs(b)), (label, a, b)

for c, got in zip(CASES, js):
    g = c["irradiance"]
    tc = c["tempC"]
    rs = c["ohm"]
    il, i0, rseries, rshunt, a = pvsyst_lambert_inputs(g, tc)
    diode = pvlib.pvsystem.singlediode(
        photocurrent=il, saturation_current=i0, resistance_series=rseries,
        resistance_shunt=rshunt, nNsVth=a, method="lambertw")
    close(got["moduleMppW"], float(diode["p_mp"]), "module MPP")
    close(got["moduleVocV"], float(diode["v_oc"]), "module Voc")
    close(got["moduleIscA"], float(diode["i_sc"]), "module Isc")

    maxV = float(diode["v_oc"])
    def point(module_v):
        i_module = max(0.0, float(pvlib.pvsystem.i_from_v(
            module_v, il, i0, rseries, rshunt, a, method="lambertw")))
        current = 2 * i_module
        source_v = 2 * module_v
        pv_wire = current * current * rs
        power = source_v * current - pv_wire
        return power, current, source_v * current, pv_wire

    result = minimize_scalar(lambda v: -point(v)[0],
        bounds=(0.0, maxV), method="bounded",
        options={"xatol":1e-10})
    assert result.success, (c, result)
    port, current, gross, wire_heat = point(result.x)
    close(got["portW"], port, "nonlinear cable MPP")
    close(got["arrayCurrentA"], current, "array current")
    close(got["arrayGrossW"], gross, "gross module power")
    close(got["wireLossW"], wire_heat, "wire Joule loss")
    close(got["arrayGrossW"], got["portW"]+got["wireLossW"],
        "electrical conservation", relative=1e-8)
    close(got["residualW"], 0, "registered source-loss-sink residual", relative=1e-8)
    assert got["portW"] <= 4 * float(diode["p_mp"]) * (1 + 1e-8)

print(f"PASS: {len(CASES)} nonlinear module/cable operating points match pvlib Lambert-W + SciPy reference; NOT field calibration")

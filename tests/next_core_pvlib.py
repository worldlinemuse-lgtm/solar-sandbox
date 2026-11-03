"""External pvlib benchmark: JS thermal and PV DC model versus independently implemented pvlib.

These test published Sandia coefficients and PVWatts DC algebra, not the electrical
performance of the assembled user's equipment.
"""
import json, subprocess
from pathlib import Path
import pvlib

ROOT = Path(__file__).resolve().parent.parent
cases = [
    {"mount":"open_rack_glass_glass","e":1000,"ta":25,"wind":1},
    {"mount":"open_rack_glass_polymer","e":1000,"ta":25,"wind":1},
    {"mount":"close_mount_glass_glass","e":750,"ta":-5,"wind":4},
    {"mount":"insulated_back_glass_polymer","e":300,"ta":30,"wind":0},
    {"mount":"open_rack_glass_glass","e":0,"ta":-20,"wind":10},
    {"mount":"open_rack_glass_glass","e":600,"ta":-15,"wind":2},
]
node_code = r"""
const fs=require('fs');
const {sandiaTemperature}=require('./.next-core-dist/solar-thermal.js');
const {makePvModuleSnapshot}=require('./.next-core-dist/pv-module.js');
const m={id:'lg435',pStcW:435,vmpStcV:40.8,vocStcV:49.1,
 iscStcA:11.36,powerTempCoefficientPerC:-0.0035,
 vocTempCoefficientPerC:-0.00284,iscTempCoefficientPerC:.0005,sourceReference:'LONGi V13'};
const inp=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(inp.map(c=>{
 const t=sandiaTemperature(c.e,c.ta,c.wind,c.mount);
 const p=makePvModuleSnapshot(m,{series:2,parallel:2},
 {effectiveIrradianceWm2:c.e,cellTemperatureC:t.cellC,
  shadeFraction:0,snowCoveredFraction:0,additionalLossFraction:0});
 return {tm:t.moduleC,tc:t.cellC,p:p.availablePowerW};
})));
"""
process=subprocess.run(["node","-e",node_code],cwd=ROOT,
    input=json.dumps(cases),capture_output=True,text=True,check=True)
js=json.loads(process.stdout)
for case, got in zip(cases, js):
    a=pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS["sapm"][case["mount"]]
    tm=pvlib.temperature.sapm_module(case["e"],case["ta"],case["wind"],a["a"],a["b"])
    tc=pvlib.temperature.sapm_cell_from_module(tm,case["e"],a["deltaT"])
    pdc=pvlib.pvsystem.pvwatts_dc(case["e"],tc,pdc0=1740,gamma_pdc=-0.0035)
    for key,expected in (("tm",tm),("tc",tc),("p",pdc)):
        assert abs(got[key]-expected)<1e-7*max(1,abs(expected)),(case,key,got[key],expected)
print("PASS: next-core Sandia and PVWatts DC compared to independent pvlib across",len(cases),"fixtures")

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const base=path.resolve(__dirname,"../../.next-core-dist");
const {pvsystShuntResistance}=require(path.join(base,"pvsyst-shunt.js"));
const {LONGI_435_PVSYST,singleDiodeMpp}=require(path.join(base,"pv-diode.js"));
const params=(g,z=4000)=>({irradianceWm2:g,referenceIrradianceWm2:1000,
 rshReferenceOhm:1000,rshAtZeroIrradianceOhm:z,decay:5.5});
const close=(x,y,tol=1e-9)=>assert.ok(Math.abs(x-y)<=tol*Math.max(1,Math.abs(y)),x+" != "+y);
test("Sandia PVsyst Rsh formula reproduces Rsh0, RshRef and physical decaying curve",()=>{
 close(pvsystShuntResistance(params(0)),4000);
 close(pvsystShuntResistance(params(1000)),1000);
 const at200=pvsystShuntResistance(params(200));
 assert.ok(at200>1000&&at200<4000);
 assert.ok(pvsystShuntResistance(params(400))<at200);
 assert.ok(pvsystShuntResistance(params(1200))>0);
});
test("PVsyst outdoor crystalline x4 Rsh0 is an ASSUMED scenario, not a published LONGi parameter",()=>{
 const assumed={...LONGI_435_PVSYST,shuntAtZeroIrradianceOhm:4000,
  shuntIrradianceDecay:5.5};
 const baseline=singleDiodeMpp(LONGI_435_PVSYST,200,25);
 const scenario=singleDiodeMpp(assumed,200,25);
 assert.ok(scenario.maxPowerW>baseline.maxPowerW);
 const stc0=singleDiodeMpp(LONGI_435_PVSYST,1000,25);
 const stc1=singleDiodeMpp(assumed,1000,25);
 close(stc0.maxPowerW,stc1.maxPowerW,1e-10);
 assert.ok(singleDiodeMpp(assumed,0,25).maxPowerW===0);
});
test("PVsyst Rsh0 and exponent MUST come together, avoiding fabricated source parameters",()=>{
 const base={...LONGI_435_PVSYST,shuntAtZeroIrradianceOhm:4000};
 assert.throws(()=>singleDiodeMpp(base,300,25),/requires both/);
 assert.throws(()=>pvsystShuntResistance(params(-1)),/physical/);
 assert.throws(()=>pvsystShuntResistance(params(100,300000)),/Nonpositive/);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {assessInverterThermalCapacity,VICTRON_3KVA_120V_THERMAL,VICTRON_5KVA_120V_THERMAL}=
 require(path.resolve(__dirname,"../../.next-core-dist/inverter-temperature.js"));
const close=(got,expected)=>assert.ok(Math.abs(got-expected)<1e-9*Math.max(1,Math.abs(expected)),got+" != "+expected);
const assess=(t,w,va=2500)=>assessInverterThermalCapacity(VICTRON_3KVA_120V_THERMAL,t,w,va);
test("Victron 3-kVA 120V published 25/40/65C real-power anchors are kept separate from VA",()=>{
 close(assess(25,2400,3000).conservativeNextHotterAnchorW,2400);
 close(assess(40,2200,3000).conservativeNextHotterAnchorW,2200);
 close(assess(65,1700,3000).conservativeNextHotterAnchorW,1700);
 assert.equal(assess(65,2000).status,"exceeds_conservative_envelope");
 assert.equal(assess(25,1800,3100).status,"exceeds_conservative_envelope");
});
test("a hot cabinet is not silently tested against the 25C published rating",()=>{
 const x=assess(50,1900);
 close(x.estimatedContinuousW,2000);
 close(x.conservativeNextHotterAnchorW,1700);
 assert.equal(x.status,"exceeds_conservative_envelope");
 assert.ok(assess(50,1600).status==="rated_reference_estimate");
});
test("temperatures outside published ratings are indeterminate, not extrapolated to a safe pass",()=>{
 assert.equal(assess(-15,2000).status,"indeterminate_temperature");
 assert.equal(assess(75,800).status,"indeterminate_temperature");
 assert.equal(assess(75,800).estimatedContinuousW,null);
 assert.throws(()=>assess(-300,300),/invalid/);
});
test("5-kVA published anchors are separately variant scoped",()=>{
 const a=assessInverterThermalCapacity(VICTRON_5KVA_120V_THERMAL,40,3500,4500);
 assert.equal(a.status,"rated_reference_estimate");
 close(a.conservativeNextHotterAnchorW,3700);
 close(a.permittedNominalVA,5000);
 assert.equal(assessInverterThermalCapacity(VICTRON_5KVA_120V_THERMAL,65,3200,4000).status,
   "exceeds_conservative_envelope");
});

"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const doc=JSON.parse(fs.readFileSync(path.join(root,"validation/next-core/coverage.json"),"utf8"));
test("every engineering, controls and product gate has exactly one status",()=>{
 assert.equal(doc.schema,1);
 assert.ok(doc.requirements.length>=40);
 const ids=doc.requirements.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const x of doc.requirements){
   assert.ok(["implemented","partial","blocked"].includes(x.status),x.id);
   assert.ok(x.description.length>15,x.id);
 }
 assert.equal(doc.completedCount,doc.requirements.filter(x=>x.status==="implemented").length);
 assert.equal(doc.totalCount,doc.requirements.length);
});
test("planner/optimizer and live engine cannot be enabled while core physical gates are unresolved",()=>{
 const required=["whole_system_measured","weather_clock_validation","split_phase_transfer",
   "generator_battery_charger","battery_aging","uncertainty"];
 const map=Object.fromEntries(doc.requirements.map(x=>[x.id,x.status]));
 assert.ok(required.every(k=>map[k]==="blocked"));
 assert.equal(doc.releaseGates.nextCoreCanReplaceLiveEngine,false);
 assert.equal(doc.releaseGates.householdPlannerEnabled,false);
 assert.equal(doc.releaseGates.optimizerEnabled,false);
 assert.equal(doc.releaseGates.shadowModeIntegrated,true);
 assert.equal(doc.releaseGates.physicalHardwareDatasetCount,0);
 assert.equal(doc.releaseGates.externalPvsystPvCurvePoints,5);
 assert.equal(doc.releaseGates.independentWeatherClockConfirmed,false);
});

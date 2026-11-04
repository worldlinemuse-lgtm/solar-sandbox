"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {HONDA_EU2200I_PUBLISHED,BATTLE_BORN_BB10012_PUBLISHED,estimateHondaFuelGph}=
 require(path.resolve(__dirname,"../../.next-core-dist/published-hardware.js"));
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),a+" != "+b);
test("Honda EU2200i manufacturer runtime anchors translate exactly to gph",()=>{
 const a=estimateHondaFuelGph(450);
 const b=estimateHondaFuelGph(1800);
 assert.equal(a.status,"within_published_load_anchor_range");
 assert.equal(b.status,"within_published_load_anchor_range");
 close(a.fuelGallonsPerHour,.95/8.1);
 close(b.fuelGallonsPerHour,.95/3.2);
 close(a.runtimeHoursForTank,8.1);
 close(b.runtimeHoursForTank,3.2);
 close(HONDA_EU2200I_PUBLISHED.maximumW,2200);
});
test("intermediate Honda fuel is clearly a two-point interpolation only",()=>{
 const a=estimateHondaFuelGph(1125);
 close(a.fuelGallonsPerHour,0.5*(.95/8.1+.95/3.2));
 assert.equal(a.basis,"linear_interpolation_of_two_published_runtime_anchors");
 assert.equal(estimateHondaFuelGph(0).status,"below_published_range");
 assert.equal(estimateHondaFuelGph(0).fuelGallonsPerHour,null);
 assert.equal(estimateHondaFuelGph(2000).status,"above_published_range");
 assert.throws(()=>estimateHondaFuelGph(-1),/negative/);
});
test("Battle Born published electrical and thermal limits remain sourced, no arbitrary OCV curve",()=>{
 const m=BATTLE_BORN_BB10012_PUBLISHED;
 assert.equal(m.nominalCapacityAh,100);
 close(m.publishedInternalResistanceOhm,.007);
 close(m.minimumChargeTemperatureC,-35/9);
 close(m.maximumChargeTemperatureC,55);
 close(m.minimumDischargeTemperatureC,-20);
 close(m.maxContinuousDischargeA,100);
 close(m.dischargeSurgeA,200);
 close(m.dischargeSurgeDurationSeconds,30);
 assert.equal(Object.hasOwn(m,"ocvCurve"),false);
});

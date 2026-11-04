"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const path=require("node:path");
const {makeInverterDcCurve,interpolateInverterDcInput,
 makeGeneratorFuelCurve,interpolateGeneratorFuelRate}=
  require(path.resolve(__dirname,"../../.next-core-dist/calibration-curves.js"));
const close=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(b)),
  "Got "+a+" expected "+b);
test("inverter curve uses independently provided DC-input measurements without double counting idle",()=>{
 // Synthetic numbers, NEVER external empirical measurements.
 const fit=makeInverterDcCurve([{acRealOutputW:1000,dcInputW:1110},
   {acRealOutputW:0,dcInputW:12},
   {acRealOutputW:500,dcInputW:565}]);
 assert.equal(fit.includedIdleObservation,true);
 const idle=interpolateInverterDcInput(fit,0);
 close(idle.predictedDcInputW,12);
 close(idle.predictedConversionLossW,12);
 close(idle.predictedEfficiency,0);
 const x=interpolateInverterDcInput(fit,250);
 close(x.predictedDcInputW,288.5);
 close(x.predictedConversionLossW,38.5);
 close(x.predictedEfficiency,250/288.5);
 const end=interpolateInverterDcInput(fit,1000);
 close(end.predictedDcInputW,1110);
 close(end.predictedConversionLossW,110);
 assert.equal(x.validation,"numerical_fit_not_verified_instrumentation");
 assert.throws(()=>interpolateInverterDcInput(fit,1200),/outside measured/);
 assert.throws(()=>interpolateInverterDcInput(fit,-1),/negative/);
});
test("inverter refuses impossible energy gain but does not censor nonmonotonic valid measurements",()=>{
 assert.throws(()=>makeInverterDcCurve([{acRealOutputW:0,dcInputW:10},
   {acRealOutputW:500,dcInputW:450}]),/cannot exceed/);
 const nonMonotone=makeInverterDcCurve([{acRealOutputW:0,dcInputW:20},
   {acRealOutputW:500,dcInputW:1510},
   {acRealOutputW:1000,dcInputW:1490}]);
 // Real devices can switch modes: do not label physically valid knots impossible.
 assert.equal(nonMonotone.observedDcDrawMonotone,false);
 assert.ok(interpolateInverterDcInput(nonMonotone,750).predictedDcInputW>=750);
 assert.equal(fitIsMonotone(),true);
 function fitIsMonotone(){
   return makeInverterDcCurve([{acRealOutputW:0,dcInputW:12},
     {acRealOutputW:500,dcInputW:565}]).observedDcDrawMonotone;
 }
 assert.throws(()=>makeInverterDcCurve([{acRealOutputW:500,dcInputW:600},
   {acRealOutputW:500,dcInputW:600}]),/distinct/);
 assert.throws(()=>makeInverterDcCurve([]),/at least two/);
});
test("running generator fuel curve preserves nonzero idle, interpolates, integrates time exactly",()=>{
 // Numbers below are synthetic fixtures, not Honda/other manufacturer data.
 const fit=makeGeneratorFuelCurve([
   {deliveredAcRealW:1800,measuredGallonsPerHour:.30},
   {deliveredAcRealW:450,measuredGallonsPerHour:.12},
   {deliveredAcRealW:0,measuredGallonsPerHour:.08}
 ]);
 close(interpolateGeneratorFuelRate(fit,0).gallonsPerHour,.08);
 const mid=interpolateGeneratorFuelRate(fit,1125);
 close(mid.gallonsPerHour,.21);
 close(mid.gallonsOverSeconds(1800),.105);
 close(mid.gallonsOverSeconds(60),.21/60);
 assert.throws(()=>interpolateGeneratorFuelRate(fit,1900),/outside measured/);
 assert.throws(()=>mid.gallonsOverSeconds(-1),/Negative generator runtime/);
});
test("generator nonmonotonic measured rates are preserved but duplicate power points rejected",()=>{
 const observation=makeGeneratorFuelCurve([
   {deliveredAcRealW:100,measuredGallonsPerHour:.3},
   {deliveredAcRealW:500,measuredGallonsPerHour:.2}]);
 assert.equal(observation.observedFuelRateMonotone,false);
 close(interpolateGeneratorFuelRate(observation,300).gallonsPerHour,.25);
 assert.throws(()=>makeGeneratorFuelCurve([{deliveredAcRealW:100,measuredGallonsPerHour:.2},
   {deliveredAcRealW:100,measuredGallonsPerHour:.2}]),/distinct/);
 assert.throws(()=>makeGeneratorFuelCurve([{deliveredAcRealW:100,measuredGallonsPerHour:.2}]),/at least two/);
});

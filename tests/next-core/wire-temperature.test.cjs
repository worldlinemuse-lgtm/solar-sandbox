"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {NIST_ANNEALED_COPPER_ALPHA_20_PER_C,conductorTemperatureLoss}=
 require(path.resolve(__dirname,"../../.next-core-dist/wire-temperature.js"));
const close=(got,expected)=>assert.ok(Math.abs(got-expected)<1e-10*Math.max(1,Math.abs(expected)),got+" != "+expected);
const input={loopResistanceAtReferenceOhm:.10,referenceTemperatureC:20,
 conductorTemperatureC:20,temperatureCoefficientAtReferencePerC:.00393,
 currentA:20,intervalSeconds:3600};
test("NIST 100%-IACS copper 20-to-50C resistance correction and I2R energy accounting",()=>{
 close(NIST_ANNEALED_COPPER_ALPHA_20_PER_C,.00393);
 const a=conductorTemperatureLoss(input);
 close(a.correctedLoopResistanceOhm,.10);
 close(a.powerLossW,40);
 close(a.heatWh,40);
 const hot=conductorTemperatureLoss({...input,conductorTemperatureC:50});
 close(hot.resistanceMultiplier,1+.00393*30);
 close(hot.correctedLoopResistanceOhm,.11179);
 close(hot.voltageDropV,20*.11179);
 close(hot.powerLossW,20**2*.11179);
 close(hot.heatWh,20**2*.11179);
});
test("conductor I²R heating is sign invariant but voltage drop retains current direction",()=>{
 const f=conductorTemperatureLoss({...input,currentA:-20,conductorTemperatureC:80,
 intervalSeconds:1800});
 close(f.powerLossW,400*.1*(1+.00393*60));
 close(f.heatWh,f.powerLossW/2);
 assert.ok(f.voltageDropV<0);
});
test("wire correction never confuses Celsius thermal limits or generates negative R",()=>{
 assert.throws(()=>conductorTemperatureLoss({...input,conductorTemperatureC:-275}),/Nonphysical/);
 assert.throws(()=>conductorTemperatureLoss({...input,loopResistanceAtReferenceOhm:-1}),/negative/);
 assert.throws(()=>conductorTemperatureLoss({...input,currentA:NaN}),/not finite/);
 assert.throws(()=>conductorTemperatureLoss({...input,temperatureCoefficientAtReferencePerC:-.1}),/negative/);
});

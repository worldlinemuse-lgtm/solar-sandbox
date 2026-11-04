"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const base=path.resolve(__dirname,"../../.next-core-dist");
const {LONGI_435_PVSYST,singleDiodeMpp}=require(path.join(base,"pv-diode.js"));
const {fitPublishedPvThermalSlope,LONGI_PVSYST_2020_THERMAL_ANCHORS}=
  require(path.join(base,"pv-temperature-reference.js"));
const close=(x,y,e=1e-6)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=e*Math.max(1,Math.abs(y)),
 "got "+x+" expected "+y);
test("PVsyst published Isc coefficient uses 6.7 mA/C, not the distinct module catalog 0.05 percent/C",()=>{
 close(LONGI_435_PVSYST.iscTemperatureCoeffPerC*11.36,.0067,1e-12);
 const low=singleDiodeMpp(LONGI_435_PVSYST,1000,24.5);
 const hi=singleDiodeMpp(LONGI_435_PVSYST,1000,25.5);
 const estimated=(hi.shortCircuitCurrentA-low.shortCircuitCurrentA);
 close(estimated,.0067,0.0002);
});
test("original unanchored temperature model DOES NOT match published -144mV/C; explicitly quantify it",()=>{
 const x=fitPublishedPvThermalSlope(LONGI_435_PVSYST,LONGI_PVSYST_2020_THERMAL_ANCHORS);
 assert.ok(x.originalVocSlopeVPerC>-.13 && x.originalVocSlopeVPerC<-.12,x.originalVocSlopeVPerC);
 assert.ok(Math.abs(x.originalVocSlopeVPerC-(-.144))>.01);
 // Correct temperature derivative only by explicitly fitting a reference-only
 // EFFECTIVE activation; the original silicon material-bandgap prior is kept.
 close(x.fittedVocSlopeVPerC,-.144,0.00001);
 assert.ok(x.effectiveThermalActivationEV>1.18&&x.effectiveThermalActivationEV<1.23);
 assert.equal(x.fittedReference.bandgapEV,1.121);
 assert.ok(x.fittedReference.effectiveThermalActivationEV>1.18);
 // The independent -0.34%/C MPP slope WAS NOT used for fitting. It must be
 // compared against a distinct published anchor rather than being forced.
 assert.ok(x.originalMaxPowerCoefficientPerC>-.0032);
 assert.ok(x.fittedMaxPowerCoefficientPerC<-.0033);
 assert.ok(Math.abs(x.residualMaxPowerCoefficientPerC)<0.0002,
   "Pmp temperature slope disagrees with independently published benchmark: "+
      x.residualMaxPowerCoefficientPerC);
 assert.equal(x.evidence,"fitted_to_published_reference_slope_not_instrumented_hardware");
});
test("fitted thermal reference preserves published STC I-V and does not mutate original model",()=>{
 const fitted=fitPublishedPvThermalSlope(LONGI_435_PVSYST,LONGI_PVSYST_2020_THERMAL_ANCHORS);
 const before=singleDiodeMpp(LONGI_435_PVSYST,1000,25);
 const after=singleDiodeMpp(fitted.fittedReference,1000,25);
 close(before.maxPowerW,after.maxPowerW,1e-10);
 close(before.openCircuitVoltageV,after.openCircuitVoltageV,1e-10);
 const beforeCold=singleDiodeMpp(LONGI_435_PVSYST,1000,-20);
 const afterCold=singleDiodeMpp(fitted.fittedReference,1000,-20);
 assert.ok(afterCold.openCircuitVoltageV>beforeCold.openCircuitVoltageV);
 assert.equal(LONGI_435_PVSYST.effectiveThermalActivationEV,undefined);
});
test("temperature fit never silently invents an unbracketed or unreferenced calibration",()=>{
 assert.throws(()=>fitPublishedPvThermalSlope(LONGI_435_PVSYST,
   {...LONGI_PVSYST_2020_THERMAL_ANCHORS,vocSlopeVPerC:-4}),
   /cannot be matched/);
 assert.throws(()=>fitPublishedPvThermalSlope(LONGI_435_PVSYST,
   {...LONGI_PVSYST_2020_THERMAL_ANCHORS,sourceUrl:""}),/source URL/);
});

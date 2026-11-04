"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const root=path.resolve(__dirname,"../../.next-core-dist");
const {fitPublishedLongiPvsystRshZero,LONGI_PVSYST_POWER_2020}=
 require(path.join(root,"pvsyst-published-fit.js"));
const {singleDiodeMpp,LONGI_435_PVSYST}=require(path.join(root,"pv-diode.js"));
test("published-model Rsh0 inverse-fit uses separate PVsyst training and held-out curves",()=>{
 const r=fitPublishedLongiPvsystRshZero();
 assert.ok(r.fittedRshZeroOhm>15000&&r.fittedRshZeroOhm<50000,r.fittedRshZeroOhm);
 assert.ok(r.trainingRelativeRmse<0.001,r.trainingRelativeRmse);
 assert.ok(r.heldOutRelativeRmse<0.002,r.heldOutRelativeRmse);
 assert.ok(Math.abs(r.stcRelativeError)<0.003);
 assert.equal(r.points.filter(x=>x.role==="fit").length,2);
 assert.equal(r.points.filter(x=>x.role==="holdout").length,2);
 assert.equal(r.points.filter(x=>x.role==="stc_check").length,1);
 assert.equal(r.evidence,"fit_to_published_pvsyst_mpp_points_not_hardware_measurements");
 assert.ok(r.modelLimits.some(x=>x.includes("not a published manufacturer measurement")));
});
test("published reference fit never mutates the baseline or changes STC power to force agreement",()=>{
 const before=singleDiodeMpp(LONGI_435_PVSYST,1000,25);
 const fit=fitPublishedLongiPvsystRshZero();
 const after=singleDiodeMpp(fit.calibratedReference,1000,25);
 assert.ok(Math.abs(after.maxPowerW-before.maxPowerW)<1e-6);
 assert.equal(LONGI_435_PVSYST.shuntAtZeroIrradianceOhm,undefined);
 assert.equal(LONGI_PVSYST_POWER_2020.training[0].powerW,85.7);
});

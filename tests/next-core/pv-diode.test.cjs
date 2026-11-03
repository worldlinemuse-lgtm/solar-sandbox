"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {LONGI_435_PVSYST,singleDiodeMpp}=require(path.resolve(__dirname,"../../.next-core-dist/pv-diode.js"));
const published=[
{g:200,watts:85.7},{g:400,watts:174.6},{g:600,watts:263.2},
{g:800,watts:350.6},{g:1000,watts:436.1}
];
test("LONGi 435 W PVsyst published independent five-point irradiance performance",()=>{
 for(const {g,watts} of published){
  const r=singleDiodeMpp(LONGI_435_PVSYST,g,25);
  assert.equal(r.converged,true);
  assert.ok(Math.abs(r.maxPowerW-watts)<=0.02*watts,
    g+" W/m2: model "+r.maxPowerW+" W, external PVsyst "+watts+" W");
  assert.ok(r.maxPowerVoltageV>30&&r.maxPowerVoltageV<45);
  assert.ok(r.maxPowerCurrentA>0&&r.maxPowerCurrentA<r.shortCircuitCurrentA);
 }
});
test("STC Isc and Voc are constrained independently of nominal power",()=>{
 const v=singleDiodeMpp(LONGI_435_PVSYST,1000,25);
 assert.ok(Math.abs(v.shortCircuitCurrentA-11.36)<.02);
 assert.ok(Math.abs(v.openCircuitVoltageV-49.1)<.25);
 assert.ok(Math.abs(v.maxPowerW-435)<10);
 const night=singleDiodeMpp(LONGI_435_PVSYST,0,0);
 assert.equal(night.maxPowerW,0);assert.equal(night.shortCircuitCurrentA,0);
});
test("irradiance temperature variations produce finite physically feasible I-V points",()=>{
 for(const temp of [-20,0,25,45,65]){
  for(const g of [50,200,600,1000]){
   const r=singleDiodeMpp(LONGI_435_PVSYST,g,temp);
   assert.ok(r.converged&&r.maxPowerW>0);
   assert.ok(r.maxPowerCurrentA<r.shortCircuitCurrentA);
  }
 }
 assert.throws(()=>singleDiodeMpp(LONGI_435_PVSYST,-1,25),/negative/);
});

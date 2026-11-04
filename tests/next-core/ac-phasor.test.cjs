"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {assessSignedAcPhasors}=require(path.resolve(__dirname,"../../.next-core-dist/ac-phasor.js"));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),a+" != "+b);
const limits=(sinusoidalWaveformsConfirmed=true)=>({phases:"split120_240V",
 continuousRealWPerLeg:2400,continuousApparentVAPerLeg:3000,
 sinusoidalWaveformsConfirmed});
test("signed inductive and capacitive vars cancel with phasor addition, not summed absolute VA",()=>{
 const x=assessSignedAcPhasors([
  {id:"inductive",realPowerW:600,reactiveVarSigned:800,leg:"L1"},
  {id:"capacitive",realPowerW:600,reactiveVarSigned:-800,leg:"L1"}
 ],limits());
 assert.equal(x.status,"pass_sinusoidal_model");
 close(x.legs[0].realPowerW,1200);
 close(x.legs[0].reactiveVarSigned,0);
 close(x.legs[0].fundamentalApparentVA,1200);
 close(x.totalRealPowerW,1200);
});
test("a balanced 240 V load splits both P and signed Q equally across two legs",()=>{
 const a=assessSignedAcPhasors([
  {id:"pump",realPowerW:2400,reactiveVarSigned:1800,leg:"BOTH"}
 ],limits());
 assert.equal(a.status,"pass_sinusoidal_model");
 for(const leg of a.legs){
  close(leg.realPowerW,1200);close(leg.reactiveVarSigned,900);
  close(leg.rmsApparentVA,1500);
 }
});
test("unknown nonsinusoidal harmonic demand cannot receive a full RMS VA pass",()=>{
 const v=assessSignedAcPhasors([
  {id:"charger",realPowerW:200,reactiveVarSigned:0,leg:"L1"}
 ],limits(false));
 assert.equal(v.status,"indeterminate_harmonics");
 close(v.legs[0].fundamentalApparentVA,200);
 assert.equal(v.legs[0].rmsApparentVA,null);
 assert.ok(v.reasons.some(x=>x.includes("Harmonic")));
});
test("fundamental VA lower bound can rigorously prove an overloaded inverter even without harmonics",()=>{
 const v=assessSignedAcPhasors([
  {id:"pump",realPowerW:2000,reactiveVarSigned:2600,leg:"L1"}
 ],limits(false));
 assert.equal(v.status,"fail");
 assert.ok(v.legs[0].fundamentalApparentVA>3000);
});
test("incompatible 240 V load rejected, invalid phase data and duplicate ID rejected",()=>{
 const data=[{id:"240-pump",realPowerW:1200,reactiveVarSigned:0,leg:"BOTH"}];
 assert.equal(assessSignedAcPhasors(data,{...limits(),phases:"120V"}).status,"fail");
 assert.throws(()=>assessSignedAcPhasors([
  {id:"bad",realPowerW:100,reactiveVarSigned:NaN,leg:"L1"}],limits()),/finite/);
 assert.throws(()=>assessSignedAcPhasors([
  {id:"same",realPowerW:100,reactiveVarSigned:0,leg:"L1"},
  {id:"same",realPowerW:100,reactiveVarSigned:0,leg:"L1"}
 ],limits()),/unique/);
});

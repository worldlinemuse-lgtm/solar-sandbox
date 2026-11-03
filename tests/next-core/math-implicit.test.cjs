"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const root=path.resolve(__dirname,"../../.next-core-dist");
const {verifyImplicitRoot,BATTERY_TERMINAL_CURRENT,PV_INPUT_CABLE_CURRENT,
CONTROLLER_OUTPUT_CABLE_CURRENT,IMPLICIT_LAWS}=require(path.join(root,"math/implicit.js"));
const {terminalCurrentA,deliveryCurrentA,extractionCurrentA}=require(path.join(root,"numerical.js"));
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),a+" != "+b);
test("battery solver candidates satisfy registered quadratic law",()=>{
 for(const [voc,r,p] of [[12,.02,100],[12,.02,-120],[24,0,300],[48,.05,500],[12,0,0],[12,.2,100]]){
  const current=terminalCurrentA(voc,r,p);
  const proof=verifyImplicitRoot(BATTERY_TERMINAL_CURRENT,
   {"battery.ocvV":voc,"battery.internalOhm":r,"battery.requiredW":p},current);
  assert.equal(proof.passed,true);near(proof.residual,0);
  assert.equal(proof.physicalCalibrationVerified,false);
 }
});
test("a mathematically valid but physically wrong quadratic root is rejected",()=>{
 const v=12,r=.02,p=100,high=(v+Math.sqrt(v*v-4*r*p))/(2*r);
 near((v-r*high)*high,p);
 assert.throws(()=>verifyImplicitRoot(BATTERY_TERMINAL_CURRENT,
  {"battery.ocvV":v,"battery.internalOhm":r,"battery.requiredW":p},high),
  /high-current quadratic branch/);
});
test("PV and MPPT cable roots use distinct physical branch contracts",()=>{
 const ctl=deliveryCurrentA(24,.05,300);
 near(verifyImplicitRoot(CONTROLLER_OUTPUT_CABLE_CURRENT,
  {"wire.busV":24,"wire.loopOhm":.05,"wire.sourceW":300},ctl).residual,0);
 const pv=extractionCurrentA(40,.2,300);
 near(verifyImplicitRoot(PV_INPUT_CABLE_CURRENT,
  {"wire.sourceV":40,"wire.loopOhm":.2,"wire.acceptedW":300},pv).residual,0);
 const high=(40+Math.sqrt(40*40-4*.2*300))/(2*.2);
 assert.throws(()=>verifyImplicitRoot(PV_INPUT_CABLE_CURRENT,
  {"wire.sourceV":40,"wire.loopOhm":.2,"wire.acceptedW":300},high),
  /lower-current branch/);
 const negative=-24/.05-ctl;
 assert.throws(()=>verifyImplicitRoot(CONTROLLER_OUTPUT_CABLE_CURRENT,
  {"wire.busV":24,"wire.loopOhm":.05,"wire.sourceW":300},negative),
  /nonnegative/);
});
test("implicit laws reject wrong dimensions, missing inputs, and wrong residuals",()=>{
 assert.equal(IMPLICIT_LAWS.length,3);
 const x={"battery.ocvV":12,"battery.internalOhm":.02,"battery.requiredW":100};
 assert.throws(()=>verifyImplicitRoot(BATTERY_TERMINAL_CURRENT,{...x,extra:1},5),
  /missing or extraneous/);
 assert.throws(()=>verifyImplicitRoot(BATTERY_TERMINAL_CURRENT,x,0),/residual/);
 assert.throws(()=>verifyImplicitRoot({...BATTERY_TERMINAL_CURRENT,residualUnit:"A"},x,1),
  /residual dimension/);
});

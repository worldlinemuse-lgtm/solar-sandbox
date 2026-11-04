"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {boundMpptDcPower}=require(path.resolve(__dirname,"../../.next-core-dist/mppt-power-envelope.js"));
const q=(availableControllerInputPowerW,batteryChargeVoltageV=28.8)=>boundMpptDcPower({
 availableControllerInputPowerW,batteryChargeVoltageV,
 ratedMaximumBatteryChargeCurrentA:70,publishedPeakConversionEfficiency:.98,
 nominalArrayReferenceW:2000
});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),a+" != "+b);
test("Victron peak efficiency is an upper bound, NOT guaranteed power across irradiance",()=>{
 const a=q(2000);
 close(a.dcOutputMaximumPossibleW,1960);
 close(a.dcChargeCurrentUpperBoundA,1960/28.8);
 assert.equal(a.controllerPowerOrCurrentLimited,"peak_efficiency");
 assert.equal(a.conversionEfficiencyIsPeakOnly,true);
 assert.equal(a.nominalArrayReferenceIsHardInputLimit,false);
});
test("MPPT current output cap applies at actual charge voltage; nominal PV reference is not a hard ceiling",()=>{
 const a=q(2500);
 close(a.dcOutputMaximumPossibleW,70*28.8);
 close(a.dcChargeCurrentUpperBoundA,70);
 assert.equal(a.controllerPowerOrCurrentLimited,"battery_current");
 close(a.nominalArrayOversizeFactor,1.25);
 const b=q(2500,57.6);
 close(b.dcOutputMaximumPossibleW,2450);
 assert.equal(b.controllerPowerOrCurrentLimited,"peak_efficiency");
});
test("zero PV, invalid or incomplete efficiency parameters never fabricate output",()=>{
 close(q(0).dcOutputMaximumPossibleW,0);
 assert.throws(()=>q(-10),/negative/);
 assert.throws(()=>boundMpptDcPower({availableControllerInputPowerW:200,
  batteryChargeVoltageV:28.8,ratedMaximumBatteryChargeCurrentA:70,
  publishedPeakConversionEfficiency:1.2,nominalArrayReferenceW:2000}),/physical/);
});

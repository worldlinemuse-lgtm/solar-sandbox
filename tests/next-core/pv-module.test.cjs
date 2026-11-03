"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {makePvModuleSnapshot,checkControllerLimits}=require(
  path.resolve(__dirname,"../../.next-core-dist/pv-module.js"));
const {solvePvBus}=require(path.resolve(__dirname,"../../.next-core-dist/solar.js"));
const {assessAcLoads}=require(path.resolve(__dirname,"../../.next-core-dist/ac.js"));
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-8*Math.max(1,Math.abs(y)),x+" vs "+y);
const longi={id:"lg435-LR4-72HBD-435M",pStcW:435,vmpStcV:40.8,vocStcV:49.1,
 iscStcA:11.36,powerTempCoefficientPerC:-.0035,
 vocTempCoefficientPerC:-.00284,iscTempCoefficientPerC:.0005,
 sourceReference:"LONGi LR4-72HBD 435M datasheet V13"};
const conditions=(e,t)=>({effectiveIrradianceWm2:e,cellTemperatureC:t,
 shadeFraction:0,snowCoveredFraction:0,additionalLossFraction:0});
const limit={absoluteMaxVocV:150,operatingMaxVocV:145,maxInputIscA:50};
test("LONGi dual-glass 2S2P at standard conditions has correct W/V/A",()=>{
 const a=makePvModuleSnapshot(longi,{series:2,parallel:2},conditions(1000,25));
 close(a.availablePowerW,1740);close(a.stcTotalPowerW,1740);
 close(a.seriesVmpV,81.6);close(a.seriesVocV,98.2);
 close(a.totalShortCircuitA,22.72);
 assert.equal(checkControllerLimits(a,limit).status,"pass");
 const pv=solvePvBus({maximumPanelPowerW:a.availablePowerW,
   voltageAtMaxPowerV:a.seriesVmpV,pvWireLoopOhm:.05,
   mpptEfficiency:.98,mpptMaxOutputCurrentA:70,
   batteryBusVoltageV:27,controllerWireLoopOhm:.02});
 assert.ok(pv.busPowerW<=a.availablePowerW);
 close(pv.maximumPanelPowerW,pv.curtailedPanelW+pv.pvCableLossW+pv.mpptLossW+
   pv.controllerCableLossW+pv.busPowerW);
});
test("temperature coefficients and multiplicative shade/snow derating are explicit",()=>{
 const hot=makePvModuleSnapshot(longi,{series:2,parallel:2},conditions(1000,60));
 close(hot.availablePowerW,1740*(1-.0035*35));
 const factor=.9*.8*.95;
 const shaded=makePvModuleSnapshot(longi,{series:2,parallel:2},
   {...conditions(1000,25),shadeFraction:.1,snowCoveredFraction:.2,additionalLossFraction:.05});
 close(shaded.availablePowerW,1740*factor);
 const cold=makePvModuleSnapshot(longi,{series:3,parallel:2},conditions(1000,-20));
 close(cold.seriesVocV,3*49.1*(1-.00284*(-45)));
 assert.equal(checkControllerLimits(cold,limit).status,"fail");
 assert.throws(()=>makePvModuleSnapshot(longi,{series:0,parallel:1},conditions(1000,25)),/positive integers/);
});
test("unknown motor startup PF still permits a rigorous VA failure when impossible",()=>{
 const inverter={phases:"split120_240V",continuousWPerLeg:2400,
   continuousVAPerLeg:3000,peakWPerLeg:5500,peakVAPerLeg:3500,
   peakDurationSeconds:1,idleWPerUnit:13,estimatedRunningEfficiency:.94,inverterUnits:2};
 const load={id:"pump",watts:670,powerFactor:.8,leg:"BOTH",
   starting:{apparentVA:7406,powerFactor:null,durationSeconds:null}};
 const x=assessAcLoads([load],inverter);
 assert.equal(x.status,"fail");
 assert.ok(x.reasons.some(r=>r.includes("rigorous minimum apparent demand")));
 close(x.peakLegs[0].va,3703);close(x.peakLegs[1].va,3703);
 assert.equal(x.peakLegs[0].vaIsLowerBound,true);
});

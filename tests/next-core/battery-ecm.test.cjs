"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const path=require("node:path");
const {advanceBatteryEcm,batteryOcvAt}=require(path.resolve(
 __dirname,"../../.next-core-dist/battery-ecm.js"));
const base={capacityAh:100,ohmicResistanceOhm:.02,
 coulombicChargingEfficiency:.98,
 ocvCurve:[{soc:0,openCircuitVoltageV:24},
  {soc:.5,openCircuitVoltageV:26},
  {soc:1,openCircuitVoltageV:28}],
 polarizationPairs:[{resistanceOhm:.01,capacitanceF:1000}]};
const first={soc:.5,polarizationVoltagesV:[0]};
const close=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(a)&&
 Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),a+" != "+b);
test("battery Thevenin first-order polarization matches analytical exponential",()=>{
 const p=advanceBatteryEcm(base,first,10,30);
 close(p.endState.soc,.5-10*30/360000);
 close(p.endState.polarizationVoltagesV[0],.1*(1-Math.exp(-3)));
 close(p.initialTerminalVoltageV,26-10*.02);
 close(p.terminalVoltageAtEndV,
    batteryOcvAt(base.ocvCurve,p.endState.soc)-.2-.1*(1-Math.exp(-3)));
 close(p.ohmicHeatAtEndW,10*10*.02);
 assert.equal(p.polarizationStatesExactForConstantCurrent,true);
});
test("time subdivision invariance: exact RC solution agrees at 2 sec and 100 sec steps",()=>{
 const full=advanceBatteryEcm(base,first,10,100);
 let s=first;for(let k=0;k<50;k++)s=advanceBatteryEcm(base,s,10,2).endState;
 close(full.endState.soc,s.soc,1e-10);
 close(full.endState.polarizationVoltagesV[0],s.polarizationVoltagesV[0],1e-10);
 close(full.terminalVoltageAtEndV,
  batteryOcvAt(base.ocvCurve,s.soc)-10*.02-s.polarizationVoltagesV[0],1e-10);
});
test("charging negative current raises SoC by Coulombic charge efficiency",()=>{
 const p=advanceBatteryEcm(base,first,-20,3600);
 close(p.endState.soc,.5+20*.98/100);
 close(p.endState.polarizationVoltagesV[0],-.2);
 assert.ok(p.deliveredTerminalPowerAtEndW<0);
 close(p.ohmicHeatAtEndW,8);
});
test("zero current relaxes polarization without changing charge",()=>{
 const p=advanceBatteryEcm(base,{soc:.75,polarizationVoltagesV:[.2]},0,10);
 close(p.endState.soc,.75);
 close(p.endState.polarizationVoltagesV[0],.2*Math.exp(-1));
 close(p.ohmicHeatAtEndW,0);
});
test("SOC boundaries split time exactly rather than changing capacity or silently clipping",()=>{
 const low=advanceBatteryEcm(base,{soc:.001,polarizationVoltagesV:[0]},100,60);
 close(low.completedSeconds,.001*3600);
 close(low.remainingRequestedSeconds,60-3.6);
 close(low.endState.soc,0);
 assert.equal(low.status,"lower_soc_boundary");
 const top=advanceBatteryEcm(base,{soc:.999,polarizationVoltagesV:[0]},-10,60);
 close(top.completedSeconds,.001*3600*100/(10*.98));
 assert.equal(top.status,"upper_soc_boundary");
 close(top.endState.soc,1);
});
test("no fabricated terminal output beyond voltage or source OCV curve",()=>{
 assert.throws(()=>advanceBatteryEcm(base,first,2000,60),/terminal voltage nonpositive/);
 assert.throws(()=>advanceBatteryEcm(base,{soc:1.2,polarizationVoltagesV:[0]},10,60),
  /outside source curve/);
 assert.throws(()=>advanceBatteryEcm(base,{soc:.5,polarizationVoltagesV:[]},10,60),
  /dimension/);
 assert.throws(()=>advanceBatteryEcm({...base,polarizationPairs:[{resistanceOhm:-1,
 capacitanceF:1000}]},first,10,60),/must exceed zero/);
 assert.throws(()=>advanceBatteryEcm(base,first,10,-3),/within/);
});

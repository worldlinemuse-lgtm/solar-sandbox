"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {advanceBatteryThermal}=require(path.resolve(__dirname,"../../.next-core-dist/battery-thermal.js"));
const {advanceBms}=require(path.resolve(__dirname,"../../.next-core-dist/bms.js"));
const close=(x,y,eps=1e-9)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<eps*Math.max(1,Math.abs(y)),x+" != "+y);
const thermal={heatCapacityJPerK:10000,thermalResistanceKPerW:.2,parameterEvidence:"scenario_assumed"};
const point={ambientTemperatureC:0,batteryCurrentA:0,batteryInternalResistanceOhm:0,heaterPowerW:100};
const spec={
 chargeCutoffColdC:0,chargeResumeC:5,
 dischargeCutoffColdC:-20,dischargeResumeC:-15,
 chargeOvercurrentA:50,dischargeOvercurrentA:100,
 overcurrentHoldSeconds:5,tripDisconnects:"affected_port",
 resetPolicy:"manual",evidenceSource:"Synthetic BMS reference; NOT a vendor datasheet"
};
const state=(port="none")=>({chargeConnected:true,dischargeConnected:true,
  overcurrentSeconds:0,trippedOvercurrent:port!=="none",trippedPort:port});
const inp=(temp,current,seconds,reset=false)=>({
 temperatureC:temp,batteryCurrentA:current,dtSeconds:seconds,manualResetRequested:reset
});

test("battery RC thermal solution is analytic and timestep invariant for constant inputs",()=>{
 const initial={batteryTemperatureC:-10};
 const total=advanceBatteryThermal(thermal,initial,point,7200);
 const eq=point.ambientTemperatureC+point.heaterPowerW*thermal.thermalResistanceKPerW;
 close(total.thermalTimeConstantSeconds,2000);
 close(total.nextTemperatureC,eq+(initial.batteryTemperatureC-eq)*Math.exp(-7200/2000));
 let temp=-10;
 for(let j=0;j<120;j++){
   const x=advanceBatteryThermal(thermal,{batteryTemperatureC:temp},point,60);
   temp=x.nextTemperatureC;
 }
 close(temp,total.nextTemperatureC,1e-10);
 // Heat capacity energy change equals input heat minus average ambient loss.
 const thermalStoreJ=thermal.heatCapacityJPerK*(total.nextTemperatureC+10);
 const heatInJ=point.heaterPowerW*7200;
 const ambientLossJ=(total.averageTemperatureC-point.ambientTemperatureC)/
   thermal.thermalResistanceKPerW*7200;
 close(thermalStoreJ,heatInJ-ambientLossJ,1e-10);
});

test("heating I²R and heater input are independent and nonnegative",()=>{
 const r=advanceBatteryThermal(thermal,{batteryTemperatureC:10},{
    ambientTemperatureC:20,batteryCurrentA:100,batteryInternalResistanceOhm:.01,
    heaterPowerW:50
 },120);
 close(r.internalHeatW,100);
 close(r.heatingPowerW,50);
 assert.ok(r.nextTemperatureC>10);
 assert.throws(()=>advanceBatteryThermal(
   {...thermal,heatCapacityJPerK:0},{batteryTemperatureC:10},point,60),/positive/);
});

test("charge and discharge ports have distinct temperature hysteresis",()=>{
 const cold=advanceBms(spec,state(),inp(-5,-10,60));
 assert.equal(cold.currentSupportedSeconds,0);
 assert.equal(cold.next.chargeConnected,false);
 assert.equal(cold.next.dischargeConnected,true);
 const warm=advanceBms(spec,cold.next,inp(3,0,60));
 assert.equal(warm.next.chargeConnected,false);
 const recovered=advanceBms(spec,warm.next,inp(5,0,60));
 assert.equal(recovered.next.chargeConnected,true);
 const disCold=advanceBms(spec,state(),inp(-25,20,60));
 assert.equal(disCold.next.dischargeConnected,false);
 close(disCold.currentSupportedSeconds,0);
});

test("overcurrent trips at a real event boundary and latches the affected port",()=>{
 const timed=advanceBms(spec,state(),inp(25,150,8));
 close(timed.currentSupportedSeconds,5);
 assert.equal(timed.next.trippedOvercurrent,true);
 assert.equal(timed.next.trippedPort,"discharge");
 assert.equal(timed.next.dischargeConnected,false);
 assert.equal(timed.next.chargeConnected,true);
 const incoming=advanceBms(spec,timed.next,inp(25,-10,60));
 close(incoming.currentSupportedSeconds,60);
 assert.equal(incoming.next.trippedPort,"discharge");
 assert.equal(incoming.next.chargeConnected,true);
 assert.equal(incoming.next.dischargeConnected,false);
 const still=advanceBms(spec,incoming.next,inp(25,0,60));
 assert.equal(still.next.trippedOvercurrent,true);
 const reset=advanceBms(spec,still.next,inp(25,0,60,true));
 assert.equal(reset.next.trippedOvercurrent,false);
 assert.equal(reset.next.trippedPort,"none");
 assert.equal(reset.next.dischargeConnected,true);
});

test("both-port trip blocks subsequent generator or solar charging until verified reset",()=>{
 const both={...spec,tripDisconnects:"both"};
 const x=advanceBms(both,state(),inp(25,150,10));
 assert.equal(x.next.chargeConnected,false);
 assert.equal(x.next.dischargeConnected,false);
 assert.equal(x.next.trippedPort,"both");
 close(advanceBms(both,x.next,inp(25,-15,60)).currentSupportedSeconds,0);
});

test("invalid and missing protection limits fail instead of silently defaulting",()=>{
 assert.throws(()=>advanceBms({...spec,chargeResumeC:-1},state(),inp(25,1,60)),/resume temperature/);
 assert.throws(()=>advanceBms({...spec,overcurrentHoldSeconds:0},state(),inp(25,1,60)),/positive/);
 assert.throws(()=>advanceBms(spec,{...state(),trippedOvercurrent:true},inp(25,1,60)),/no recorded affected port/);
});

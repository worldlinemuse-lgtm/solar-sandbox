"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {advanceReferenceIsland} = require(path.resolve(__dirname,"../../.next-core-dist/island.js"));
const near=(x,y,eps=1e-8)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=eps*Math.max(1,Math.abs(y)),
  x+" != "+y);
const spec=(pvW=0,withGen=false)=>({
  pv:{maximumPanelPowerW:pvW,voltageAtMaxPowerV:40,pvWireLoopOhm:0,
    mpptEfficiency:1,mpptMaxOutputCurrentA:50,batteryBusVoltageV:12,
    controllerWireLoopOhm:0},
  battery:{capacityAh:100,openCircuitVoltageV:12,internalResistanceOhm:0,
    maximumChargeCurrentA:50,maximumDischargeCurrentA:100,
    minimumTerminalVoltageV:10,maximumTerminalVoltageV:15,
    coulombicChargeEfficiency:1,socFloor:0.2,socCeiling:1},
  inverter:{phases:"120V",continuousWPerLeg:2000,continuousVAPerLeg:2400,
    peakWPerLeg:3000,peakVAPerLeg:null,peakDurationSeconds:null,
    idleWPerUnit:10,estimatedRunningEfficiency:.9,inverterUnits:1},
  allow120VGeneratorPassThrough:withGen,
  generator:withGen?{ratedW:1800,tankCapacityGallons:.95,
    quarterLoadGallonsPerHour:.95/8.1,ratedLoadGallonsPerHour:.95/3.2,
    startSeconds:15,coolingSeconds:120,refuelSeconds:60}:null
});
const state=(soc=.8,gen=false)=>({
  elapsedSeconds:0,
  battery:{soc,chargeConnected:true,dischargeConnected:true},
  generator:gen?{mode:"off",tankGallons:.95,reserveGallons:0,remainingTransitionSec:0}:null
});
const req=(w=300,sec=60,cmd="none")=>({
  loads:[{id:"reference",watts:w,powerFactor:1,leg:"L1"}],
  durationSeconds:sec,
  generatorCommand:{action:cmd,operatorPresent:true}
});

test("coupled AC/DC: independently calculated battery current and energy",()=>{
  const o=advanceReferenceIsland(spec(200),state(.8),req());
  assert.equal(o.status,"complete");near(o.ledgerWh.requestedAc,5);
  near(o.ledgerWh.servedAc,5);near(o.ledgerWh.unservedAc,0);
  const inverterDc=300/.9+10;
  near(o.ledgerWh.inverterDc,inverterDc/60);
  near(o.ledgerWh.pvBus,200/60);
  near(o.ledgerWh.batteryTerminal,(inverterDc-200)/60);
  near(o.nextState.battery.soc,.8-(inverterDc-200)/(12*60*100));
  near(o.ledgerWh.pvPotential,o.ledgerWh.pvBus+o.ledgerWh.pvCurtailed+
    o.ledgerWh.pvWireLoss+o.ledgerWh.mpptLoss+o.ledgerWh.controllerWireLoss);
  near(o.nextState.elapsedSeconds,60);
  assert.equal(o.validation,"mathematical_only_not_field_calibrated");
});
test("PV surplus charges battery and excess energy is curtailed at full SOC",()=>{
  const s=spec(400);
  const nearFull=advanceReferenceIsland(s,state(.9),req(0));
  near(nearFull.ledgerWh.unservedAc,0);
  assert.ok(nearFull.nextState.battery.soc>.9);
  const full=advanceReferenceIsland(s,state(1),req(0));
  near(full.nextState.battery.soc,1);
  near(full.ledgerWh.pvBus,10/60);
  assert.ok(full.ledgerWh.pvCurtailed>0);
});
test("SOC floor is reached at an event boundary and remaining AC becomes unserved",()=>{
  const s=spec(0);
  s.battery.capacityAh=1;
  s.battery.socFloor=.2;
  const r=advanceReferenceIsland(s,state(.21),req(120));
  assert.equal(r.status,"unserved");
  near(r.nextState.battery.soc,.2);
  assert.ok(r.ledgerWh.servedAc>0&&r.ledgerWh.unservedAc>0);
  assert.ok(r.substeps>=2);
  near(r.ledgerWh.requestedAc,r.ledgerWh.servedAc+r.ledgerWh.unservedAc);
  assert.ok(r.reasons.some(s=>s.includes("boundary")));
});
test("generator recoil start yields no energy before startup; no fuel is fabricated",()=>{
  const r=advanceReferenceIsland(spec(0,true),state(.8,true),req(300,60,"start"));
  assert.equal(r.status,"complete");
  near(r.ledgerWh.generatorAc,300*45/3600);
  near(r.ledgerWh.inverterAc,300*15/3600);
  near(r.ledgerWh.servedAc,5);
  near(r.generator.gallonsConsumed,(.95/8.1)*45/3600);
  assert.ok(r.nextState.generator.tankGallons<.95);
});
test("missing motor startup data or unverified split-phase transfer cannot be silently passed",()=>{
  const p=req();
  p.loads[0].starting={apparentVA:7406,powerFactor:null,durationSeconds:null};
  const stopped=advanceReferenceIsland(spec(0),state(.8),p);
  assert.equal(stopped.status,"indeterminate");
  near(stopped.nextState.elapsedSeconds,0);
  const mismatch=spec(0,true);
  mismatch.inverter.phases="split120_240V";
  mismatch.inverter.inverterUnits=2;
  assert.equal(advanceReferenceIsland(mismatch,state(.8,true),req()).status,"indeterminate");
  const charge=req();
  charge.generatorChargerTargetAcW=100;
  assert.equal(advanceReferenceIsland(spec(),state(),charge).status,"indeterminate");
});
test("an open battery discharge port cannot create AC service",()=>{
  const x=state(.9);x.battery.dischargeConnected=false;
  const o=advanceReferenceIsland(spec(0),x,req(300));
  assert.equal(o.status,"unserved");near(o.ledgerWh.servedAc,0);
  near(o.ledgerWh.unservedAc,5);near(o.nextState.battery.soc,.9);
});
test("pure operation: the initial configuration and state are never mutated",()=>{
  const s=spec(100,true),o=state(.8,true),q=req(350,60,"start");
  const before=JSON.stringify([s,o,q]);
  const ans=advanceReferenceIsland(s,o,q);
  assert.equal(JSON.stringify([s,o,q]),before);
  assert.ok(ans.nextState.elapsedSeconds>0);
});

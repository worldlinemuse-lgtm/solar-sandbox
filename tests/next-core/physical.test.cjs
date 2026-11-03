"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname,"..","..");
const ref = JSON.parse(fs.readFileSync(path.join(root,"validation/next-core/reference_points.json"),"utf8"));
const {terminalCurrentA,deliveryCurrentA,extractionCurrentA,assertPowerBalance} =
  require(path.join(root,".next-core-dist/numerical.js"));
const {solvePvBus} = require(path.join(root,".next-core-dist/solar.js"));
const {integrateBatteryElectrical} = require(path.join(root,".next-core-dist/battery.js"));
const {assessAcLoads} = require(path.join(root,".next-core-dist/ac.js"));
const {advanceGenerator,estimatedFuelRateGph} = require(path.join(root,".next-core-dist/generator.js"));
const close = (got,exp,eps=1e-9) => assert.ok(Number.isFinite(got)&&Math.abs(got-exp)<=eps*Math.max(1,Math.abs(exp)),
  "actual="+got+" expected="+exp+" tolerance="+eps);
const battSpec=()=>({capacityAh:100,openCircuitVoltageV:12,
  internalResistanceOhm:0.02,maximumChargeCurrentA:50,maximumDischargeCurrentA:100,
  minimumTerminalVoltageV:10,maximumTerminalVoltageV:14.4,
  coulombicChargeEfficiency:0.98,socFloor:0.2,socCeiling:1});
const batteryState=(soc,chargeConnected=true,dischargeConnected=true)=>({soc,chargeConnected,dischargeConnected});
const genSpec=()=>({ratedW:1800,tankCapacityGallons:0.95,
  quarterLoadGallonsPerHour:0.95/8.1,ratedLoadGallonsPerHour:0.95/3.2,
  startSeconds:15,coolingSeconds:120,refuelSeconds:45});
const genState=(mode,tank=0.95,reserve=0)=>({mode,tankGallons:tank,reserveGallons:reserve,remainingTransitionSec:0});
const inverter=(phases="120V")=>({
  phases,continuousWPerLeg:2400,continuousVAPerLeg:3000,
  peakWPerLeg:5500,peakVAPerLeg:null,peakDurationSeconds:null,
  idleWPerUnit:13,estimatedRunningEfficiency:0.94,
  inverterUnits:phases==="120V"?1:2
});

test("published manufacturer anchors are preserved and scoped to exact variants",()=>{
  assert.equal(ref.schema,1);
  const m=ref.evidence.find(x=>x.id==="victron-mppt-15070").parameters;
  assert.equal(m.maxChargeA,70);assert.equal(m.operatingVocV,145);
  assert.equal(m.absoluteVocV,150);assert.equal(m.maxPvIscA,50);
  const i=ref.evidence.find(x=>x.id==="victron-multiplus-24-3000").parameters;
  assert.equal(i.steadyVA,3000);assert.equal(i.steadyW,2400);
  assert.equal(i.peakVA,null);
  const g=ref.evidence.find(x=>x.id==="honda-eu2200i").parameters;
  assert.equal(g.ratedW,1800);assert.equal(g.tankGal,0.95);
});

test("independent quadratic roots satisfy exact terminal and cable equations",()=>{
  const current=terminalCurrentA(12,0.02,100);
  close(12*current-0.02*current*current,100);
  close(current,200/(12+Math.sqrt(144-8)));
  const charging=terminalCurrentA(12,0.02,-120);
  assert.ok(charging<0);close((12-0.02*charging)*charging,-120);
  assert.throws(()=>terminalCurrentA(12,1,37),/maximum available/);
  close(deliveryCurrentA(24,0.1,250)*24+
    Math.pow(deliveryCurrentA(24,0.1,250),2)*0.1,250);
  close(extractionCurrentA(40,0.2,390)*40-
    0.2*Math.pow(extractionCurrentA(40,0.2,390),2),390);
  close(assertPowerBalance("fixture",[400],[200,100,100]),0);
  assert.throws(()=>assertPowerBalance("bad",[400],[200]),/imbalance/);
});

test("MPPT PV output clips by DC current and uses ACTUAL current for cable losses",()=>{
  const x={maximumPanelPowerW:400,voltageAtMaxPowerV:40,pvWireLoopOhm:0,
    mpptEfficiency:0.98,mpptMaxOutputCurrentA:10,batteryBusVoltageV:25,
    controllerWireLoopOhm:0};
  const r=solvePvBus(x);
  close(r.busCurrentA,10);close(r.busPowerW,250);
  close(r.controllerInputW,250/0.98);
  close(r.curtailedPanelW,400-250/0.98);
  close(r.pvCableLossW,0);close(r.powerResidualW,0);
  const losses=solvePvBus({...x,pvWireLoopOhm:0.2,controllerWireLoopOhm:0.1,
    mpptMaxOutputCurrentA:50});
  close(losses.maximumPanelPowerW,losses.curtailedPanelW+losses.pvCableLossW+
    losses.mpptLossW+losses.controllerCableLossW+losses.busPowerW);
  close(losses.pvCableLossW,losses.panelCurrentA**2*0.2);
  close(losses.controllerCableLossW,losses.busCurrentA**2*0.1);
  assert.ok(losses.busPowerW<392);
  const sink=solvePvBus({...x,busSinkLimitW:5});
  close(sink.busPowerW,5);close(sink.busCurrentA,0.2);
  const noSun=solvePvBus({...x,maximumPanelPowerW:0});
  close(noSun.busPowerW,0);
});

test("battery has correct signed current, I²R heat, coulombic balance and bounded SOC",()=>{
  const d=integrateBatteryElectrical(battSpec(),batteryState(0.8),100,60);
  assert.ok(d.currentA>0&&d.nextSoc<0.8);
  close(d.terminalVoltageV*d.currentA,100);
  close(d.chemicalPowerW,100+d.batteryInternalHeatW);
  close(d.nextSoc,0.8-d.currentA/6000);
  close(d.supportedSeconds,60);
  const c=integrateBatteryElectrical(battSpec(),batteryState(0.8),-100,60);
  assert.ok(c.currentA<0&&c.nextSoc>0.8);
  close(c.terminalVoltageV*c.currentA,-100);
  close(c.coulombicChargeLossW,(-c.currentA*12)*0.02);
  close(c.chemicalPowerW,
    c.terminalPowerW+c.batteryInternalHeatW+c.coulombicChargeLossW);
  close(c.nextSoc,0.8-c.currentA*0.98/6000);
});

test("battery boundary is an event, never energy generated by SOC clipping",()=>{
  const spec={...battSpec(),socFloor:0.5};
  const d=integrateBatteryElectrical(spec,batteryState(0.501),100,60);
  assert.ok(d.boundaryReached);assert.ok(d.supportedSeconds>0&&d.supportedSeconds<60);
  close(d.nextSoc,0.5);
  const c=integrateBatteryElectrical(battSpec(),batteryState(0.999),-100,60);
  assert.ok(c.boundaryReached);close(c.nextSoc,1);
  // At the SOC floor the solver returns zero delivered duration, never fictional capacity.
  const zero=integrateBatteryElectrical(spec,batteryState(0.5),100,60);
  close(zero.supportedSeconds,0);close(zero.nextSoc,0.5);
  assert.throws(()=>integrateBatteryElectrical(spec,batteryState(.7,false,true),-100,60),
    /Charge port/);
});

test("AC continuous W and VA are independently enforced; phase topology is explicit",()=>{
  const atLimit=assessAcLoads([{id:"load",watts:2400,powerFactor:0.8,leg:"L1"}],inverter());
  assert.equal(atLimit.status,"pass");close(atLimit.legs[0].va,3000);
  const reactive=assessAcLoads([{id:"load",watts:2400,powerFactor:0.7,leg:"L1"}],inverter());
  assert.equal(reactive.status,"fail");
  assert.ok(reactive.reasons.some(s=>s.includes("VA")));
  const wrongLeg=assessAcLoads([{id:"pump",watts:670,powerFactor:.85,leg:"BOTH"}],inverter());
  assert.equal(wrongLeg.status,"fail");
  const split=assessAcLoads([{id:"pump",watts:2400,powerFactor:0.8,leg:"BOTH"}],inverter("split120_240V"));
  assert.equal(split.status,"pass");close(split.legs[0].w,1200);close(split.legs[1].va,1500);
});

test("motor start does not equate 7.4kVA with watts or approve missing peak VA",()=>{
  const l={id:"franklin",watts:670,powerFactor:.8,leg:"BOTH",
    starting:{apparentVA:230*32.2,powerFactor:null,durationSeconds:null}};
  const x=assessAcLoads([l],inverter("split120_240V"));
  assert.equal(x.status,"indeterminate");
  assert.ok(x.reasons.some(s=>s.includes("startup PF")));
  const proper={...l,starting:{apparentVA:7406,powerFactor:.5,durationSeconds:.5}};
  const peakSpec={...inverter("split120_240V"),peakVAPerLeg:3500,peakDurationSeconds:2};
  assert.equal(assessAcLoads([proper],peakSpec).status,"fail");
  assert.equal(assessAcLoads([proper],{...peakSpec,peakVAPerLeg:4000}).status,"pass");
});

test("generator two published fuel anchors, timed startup, empty-tank midstep",()=>{
  const s=genSpec();
  close(estimatedFuelRateGph(s,450),.95/8.1);
  close(estimatedFuelRateGph(s,1800),.95/3.2);
  const start=advanceGenerator(s,genState("off"),{action:"start",operatorPresent:true},1800,60);
  assert.equal(start.state.mode,"running");
  close(start.deliveredWh,1800*45/3600);
  close(start.gallonsConsumed,(.95/3.2)*45/3600);
  const forbidden=advanceGenerator(s,genState("off"),{action:"start",operatorPresent:false},1800,60);
  close(forbidden.deliveredWh,0);assert.equal(forbidden.state.mode,"off");
  const tiny=advanceGenerator(s,genState("running",.001),{action:"none",operatorPresent:false},1800,60);
  assert.equal(tiny.state.mode,"off");
  close(tiny.deliveredWh,.001/(.95/3.2)*1800);
  close(tiny.state.tankGallons,0);
  close(tiny.segments.reduce((z,a)=>z+a.durationSeconds,0),60);
});
test("generator refuel requires operator, stopped/cool machine and reserve fuel",()=>{
  const s=genSpec();
  const deny=advanceGenerator(s,genState("running",0.2,1),{action:"refuel",operatorPresent:true},0,60);
  assert.ok(deny.events.some(e=>e.includes("prohibited")));
  close(deny.state.reserveGallons,1);
  const cool=advanceGenerator(s,genState("running",0.2,1),{action:"stop",operatorPresent:true},0,60);
  assert.equal(cool.state.mode,"cooling");
  const rest=advanceGenerator(s,cool.state,{action:"none",operatorPresent:false},0,60);
  assert.equal(rest.state.mode,"off");
  const refill=advanceGenerator(s,rest.state,{action:"refuel",operatorPresent:true},0,60);
  assert.equal(refill.state.mode,"off");
  close(refill.state.tankGallons,0.95);close(refill.state.reserveGallons,0.25);
});

test("seeded property sweep: conservation holds for many PV and battery states",()=>{
  let seed=20261103;
  const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  for(let i=0;i<1000;i++){
    const p=1000*rnd(),v=25+60*rnd(),rp=.01+.2*rnd(),rc=.005+.15*rnd();
    const pv=solvePvBus({maximumPanelPowerW:p,voltageAtMaxPowerV:v,
      pvWireLoopOhm:rp,mpptEfficiency:.9+.1*rnd(),
      mpptMaxOutputCurrentA:5+80*rnd(),batteryBusVoltageV:12+45*rnd(),
      controllerWireLoopOhm:rc,busSinkLimitW:100+1200*rnd()});
    close(p,pv.curtailedPanelW+pv.pvCableLossW+pv.mpptLossW+
      pv.controllerCableLossW+pv.busPowerW,1e-8);
    assert.ok(pv.busPowerW>=0&&pv.controllerInputW>=0);
    const power=(rnd()-.5)*200;
    const step=integrateBatteryElectrical(battSpec(),batteryState(.3+.6*rnd()),power,60);
    close(step.chemicalPowerW,step.terminalPowerW+
      step.batteryInternalHeatW+step.coulombicChargeLossW);
    assert.ok(step.nextSoc>=.2-1e-10&&step.nextSoc<=1+1e-10);
  }
});

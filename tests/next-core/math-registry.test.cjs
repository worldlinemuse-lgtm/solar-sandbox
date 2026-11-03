"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"../../.next-core-dist");
const {M,unitOf,evaluate,references}=require(path.join(root,"math/expressions.js"));
const {FormulaRegistry}=require(path.join(root,"math/registry.js"));
const {MATHEMATICS}=require(path.join(root,"math/models.js"));
const {solvePvBus}=require(path.join(root,"solar.js"));
const {integrateBatteryElectrical}=require(path.join(root,"battery.js"));
const near=(got,expected,rel=1e-9)=>assert.ok(Number.isFinite(got)&&
  Math.abs(got-expected)<=rel*Math.max(1,Math.abs(expected)),
  "math "+got+" != "+expected);
const formula=(id,out,expr,unit,dependsOn)=>({
 id,revision:1,stage:"electrical",output:out,expression:expr,unit,dependsOn,
 math:"symbolic contract",authority:"DERIVED",evidenceTier:"R2_derived",
 evidenceIds:["math:test"],assumptions:[],falsifier:"non-zero residual"
});
const input=(name,unit)=>({
 name,unit,role:"parameter",evidenceTier:"R3_assumed",
 evidenceIds:["fixture:test"],description:"independently injected test value"
});

test("semantic units prohibit W/VA confusion and implicit seconds-to-hours conversion",()=>{
 assert.equal(unitOf(M.acW(M.ref("apparent"),M.ref("pf")),
   {apparent:"VA",pf:"1"}),"W");
 assert.equal(unitOf(M.acVA(M.ref("real"),M.ref("pf")),
   {real:"W",pf:"1"}),"VA");
 assert.throws(()=>unitOf(M.add(M.ref("real"),M.ref("apparent")),
   {real:"W",apparent:"VA"}),/cannot combine W and VA/);
 assert.throws(()=>unitOf(M.mul(M.ref("apparent"),M.ref("pf")),
   {apparent:"VA",pf:"1"})==="W"?null:(()=>{throw Error("not real")}),/not real/);
 assert.equal(unitOf(M.mul(M.ref("apparent"),M.ref("pf")),
   {apparent:"VA",pf:"1"}),"VA");
 assert.throws(()=>unitOf(M.dc(M.ref("real"),M.ref("current")),
   {real:"W",current:"A"}),/dcPower requires V/);
 assert.throws(()=>unitOf(M.div(M.ref("energy"),M.ref("real")),
   {energy:"Wh",real:"W"}),/requires a factor of 3600/);
 assert.equal(unitOf(M.wh(M.ref("real"),M.c(60,"s")),
   {real:"W"}),"Wh");
 near(evaluate(M.wh(M.c(100,"W"),M.c(60,"s")),(100/60));
 near(evaluate(M.ah(M.c(-10,"A"),M.c(90,"s")),-.25);
 assert.deepEqual(references(M.add(M.ref("a"),M.ref("a"))),["a"]);
});
test("PV output is compiled from the equations, not recomputed in report code",()=>{
 const v=40,i=5,rv=.2,eff=.98,vb=24,rb=.05;
 const extracted=v*i,pvHeat=i*i*rv,mpptOut=(extracted-pvHeat)*eff;
 const busI=2*mpptOut/(vb+Math.sqrt(vb*vb+4*rb*mpptOut));
 const trace=MATHEMATICS.pv.evaluate({
  "panel.availableW":400,"panel.operatingV":v,"panel.currentA":i,
  "pv.loopOhm":rv,"mppt.efficiency":eff,
  "bus.voltageV":vb,"bus.currentA":busI,
  "controller.loopOhm":rb,"interval.seconds":60
 });
 near(trace.values["pv.extractedW"],200);
 near(trace.values["pv.cableLossW"],5);
 near(trace.values["mppt.inputW"],195);
 near(trace.values["mppt.outputW"],191.1);
 near(trace.values["pv.curtailedW"],200);
 near(trace.values["bus.deliveredW"],busI*24);
 near(trace.values["bus.deliveredWh"],busI*24/60);
 assert.equal(trace.invariants.length,2);
 trace.invariants.forEach(x=>assert.ok(x.passed,x.id));
 assert.equal(trace.mathEmitted,undefined);
 assert.equal(trace.notPhysicalCalibration,true);
 assert.ok(trace.captures.every(x=>x.math.length>0&&x.expression&&x.falsifier));
 const one=trace.captures.find(x=>x.id==="pv.cable_heat.v1");
 assert.ok(one&&one.inputs["panel.currentA"].value===5);
 assert.equal(one.effectiveEvidenceTier,"R3_assumed");
 assert.throws(()=>MATHEMATICS.pv.evaluate({
  "panel.availableW":400,"panel.operatingV":40,"panel.currentA":5,
  "pv.loopOhm":.2,"mppt.efficiency":.98,
  "bus.voltageV":24,"bus.currentA":10,
  "controller.loopOhm":.05,"interval.seconds":60
 }),/conservation|balance/);
});
test("battery charge retained energy and SoC derive from registered signed equations",()=>{
 const r=MATHEMATICS.battery.evaluate({
  "battery.ocvV":12,"battery.currentA":-10,"battery.internalOhm":.02,
  "battery.chargeEfficiency":.9,"battery.capacityAh":100,
  "battery.soc":.5,"interval.seconds":3600
 });
 near(r.values["battery.terminalV"],12.2);
 near(r.values["battery.terminalW"],-122);
 near(r.values["battery.heatW"],2);
 near(r.values["battery.chargeLossW"],12);
 near(r.values["battery.netChemicalW"],-108);
 near(r.values["battery.effectiveCurrentA"],-9);
 near(r.values["battery.deltaAh"],-9);
 near(r.values["battery.socNext"],.59);
 assert.ok(r.invariants.every(x=>x.passed));
 assert.equal(r.captures.find(x=>x.id==="battery.soc_after.v1").effectiveEvidenceTier,"R3_assumed");
 const atBound=MATHEMATICS.battery.evaluate({
  "battery.ocvV":12,"battery.currentA":10,"battery.internalOhm":.02,
  "battery.chargeEfficiency":.9,"battery.capacityAh":100,
  "battery.soc":.2,"interval.seconds":0
 });
 near(atBound.values["battery.socNext"],.2);
});
test("AC service accepts no invented power: request = served + unserved",()=>{
 const t=MATHEMATICS.acService.evaluate({
  "ac.requestedW":200,"ac.servedW":160,"interval.seconds":45
 });
 near(t.values["ac.unservedW"],40);
 near(t.values["ac.servedWh"],2);
 near(t.values["ac.requestedWh"],2.5);
 near(t.values["ac.unservedWh"],.5);
 assert.ok(t.invariants[0].passed);
 assert.throws(()=>MATHEMATICS.acService.evaluate({
  "ac.requestedW":100,"ac.servedW":150,"interval.seconds":60
 }),/below minimum|unserved/); // will be output bounded in an upcoming constraint gate
});
test("wire I²R invariant handles negative current without negative heat",()=>{
 const t=MATHEMATICS.wire.evaluate({
  "wire.currentA":-30,"wire.loopOhm":.025,"interval.seconds":45
 });
 near(t.values["wire.voltageDropV"],-.75);
 near(t.values["wire.heatW"],22.5);
 near(t.values["wire.heatWh"],22.5*45/3600);
 assert.ok(t.invariants.every(x=>x.passed));
});
test("registry rejects missing variables, undeclared changes, duplicate outputs and cycles",()=>{
 const good={
  id:"test.graph",revision:1,inputs:[input("a","W")],
  equations:[formula("e1","b",M.add(M.ref("a"),M.c(1,"W")),"W",["a"])],
  invariants:[]
 };
 const model=new FormulaRegistry(good);
 near(model.evaluate({a:5}).values.b,6);
 assert.throws(()=>model.evaluate({a:5,extra:2}),/unexpected input/);
 assert.throws(()=>model.evaluate({}),/missing required input/);
 assert.throws(()=>new FormulaRegistry({...good,equations:[
  formula("bad","b",M.ref("a"),"VA",["a"])]}),/expected VA.*produces W/);
 assert.throws(()=>new FormulaRegistry({...good,equations:[
  formula("bad","b",M.ref("a"),"W",[])]}),/dependencies disagree/);
 assert.throws(()=>new FormulaRegistry({...good,equations:[
  formula("e1","b",M.ref("c"),"W",["c"]),
  formula("e2","c",M.ref("b"),"W",["b"])
 ]}),/cyclic/);
});
test("production new-core PV and battery outputs carry exact equation captures",()=>{
 const pv=solvePvBus({
  maximumPanelPowerW:400,voltageAtMaxPowerV:40,
  pvWireLoopOhm:.02,mpptEfficiency:.98,
  mpptMaxOutputCurrentA:20,batteryBusVoltageV:24,
  controllerWireLoopOhm:.02
 });
 near(pv.busPowerW,pv.mathTrace.values["bus.deliveredW"]);
 near(pv.pvCableLossW,pv.mathTrace.values["pv.cableLossW"]);
 assert.equal(pv.mathTrace.modelId,"solar.pv.dc-network");
 assert.ok(pv.mathTrace.invariants.every(x=>x.passed));
 const battery=integrateBatteryElectrical({
  capacityAh:100,openCircuitVoltageV:12,internalResistanceOhm:.02,
  maximumChargeCurrentA:50,maximumDischargeCurrentA:100,
  minimumTerminalVoltageV:10,maximumTerminalVoltageV:15,
  coulombicChargeEfficiency:.95,socFloor:.2,socCeiling:1
 },{soc:.9,chargeConnected:true,dischargeConnected:true},-120,60);
 near(battery.nextSoc,battery.mathTrace.values["battery.socNext"]);
 near(battery.chemicalPowerW,battery.mathTrace.values["battery.netChemicalW"]);
 assert.ok(battery.mathTrace.invariants.every(x=>x.passed));
});

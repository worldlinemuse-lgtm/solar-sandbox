"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {evaluateInstallation}=require(path.resolve(__dirname,"../../.next-core-dist/math/topology.js"));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),a+" vs "+b);
function graph(){
 const products=[
  {id:"p1",maker:"LONGi",model:"LR4-72HBD-435M",revision:"V13",
   datasheetUrl:"https://solarshop.baywa-re.ca/site/assets/Product%20Specs/LON-4203_DS.pdf",role:"pv_module"},
  {id:"m1",maker:"Victron",model:"SmartSolar 150/70",revision:"VE.Can manual",
   datasheetUrl:"https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html",role:"mppt"}
 ];
 const tp=(id,productId,rail)=>({id,productId,kind:"equipment_terminal",rail,
   minimumV:30,maximumV:60,currentLimitA:15,evidenceIds:["synthetic:fixture"],
   requiredConnection:true});
 const terminals=[tp("p1.plus","p1","PV_POS"),tp("p1.minus","p1","PV_NEG"),
   tp("m1.plus","m1","PV_POS"),tp("m1.minus","m1","PV_NEG")];
 const wire=(id,from,to,currentA)=>({id,from,to,currentA,
   resistanceOhm:.05,continuousAmpacityA:15,
   protection:{kind:"fuse",tripRatingA:15,interruptRatingA:1000,evidenceIds:["synthetic:fixture"]},
   evidenceIds:["synthetic:fixture"]});
 return {id:"test-installed-wiring",products,terminals,
   conductors:[wire("pv.pos","p1.plus","m1.plus",10),
     wire("pv.neg","p1.minus","m1.minus",-10)],
   requiredPairs:[{productId:"p1",positiveTerminal:"p1.plus",negativeTerminal:"p1.minus",kind:"PV_DC"},
    {productId:"m1",positiveTerminal:"m1.plus",negativeTerminal:"m1.minus",kind:"PV_DC"}]
 };
}
test("named hardware, positive/return paths and wire I²R use canonical equation graph",()=>{
 const g=graph(),before=JSON.stringify(g);
 const result=evaluateInstallation(g,60);
 assert.equal(result.status,"structural_checks_passed");
 assert.equal(result.codeComplianceVerified,false);
 assert.equal(result.independentHardwareCalibration,false);
 assert.equal(result.findings.filter(x=>x.severity==="error").length,0);
 near(result.totalHeatW,10);
 near(result.totalHeatWh,10/60);
 near(result.conductors[0].voltageDropV,.5);
 near(result.conductors[1].voltageDropV,-.5);
 assert.equal(result.conductors[0].math.modelId,"solar.wire.segment");
 assert.ok(result.conductors[0].math.invariants[0].passed);
 assert.equal(result.conductors[0].math.captures.find(x=>
   x.id==="wire.ohmic_loss.v1").effectiveEvidenceTier,"R3_assumed");
 assert.equal(JSON.stringify(g),before,"Topology inspection is immutable");
});
test("missing return path is structurally invalid",()=>{
 const g=graph();g.conductors.pop();
 const out=evaluateInstallation(g,60);
 assert.equal(out.status,"invalid");
 assert.ok(out.findings.some(x=>x.id==="return.incomplete"||x.id==="required.unconnected"));
});
test("positive-to-negative edge fails rather than inventing a valid circuit",()=>{
 const g=graph();g.conductors[0].to="m1.minus";
 const out=evaluateInstallation(g,60);
 assert.equal(out.status,"invalid");
 assert.ok(out.findings.some(x=>x.id==="rail.mismatch"));
});
test("conductor, equipment-port and protection ratings are independent constraints",()=>{
 const over=graph();over.conductors[0].currentA=20;
 assert.equal(evaluateInstallation(over,60).status,"invalid");
 assert.ok(evaluateInstallation(over,60).findings.some(x=>x.id==="conductor.overcurrent"));
 const fuse=graph();fuse.conductors[0].protection.tripRatingA=30;
 assert.ok(evaluateInstallation(fuse,60).findings.some(x=>x.id==="protection.overrated"));
 const port=graph();port.terminals[0].currentLimitA=5;
 assert.ok(evaluateInstallation(port,60).findings.some(x=>x.id==="terminal.overcurrent"));
});
test("unverified datasheets, ampacity and interrupt ratings return indeterminate",()=>{
 const x=graph();x.products[0].revision=null;
 x.conductors[0].continuousAmpacityA=null;
 x.conductors[0].protection.interruptRatingA=null;
 const out=evaluateInstallation(x,60);
 assert.equal(out.status,"indeterminate");
 assert.ok(out.findings.some(x=>x.id==="product.provenance"));
 assert.ok(out.findings.some(x=>x.id==="interrupt.unknown"));
 assert.ok(out.findings.some(x=>x.id==="ampacity.unspecified"));
});
test("junction currents must close by Kirchhoff; structural pass is never code compliance",()=>{
 const x=graph();
 x.products.push({id:"bus",maker:"Fixture",model:"PV junction",revision:"1",
   datasheetUrl:"https://example.invalid/",role:"bus"});
 x.terminals.push({...x.terminals[0],id:"bus.pos",productId:"bus",kind:"junction"});
 x.conductors[0].to="bus.pos";
 x.conductors.push({...x.conductors[0],id:"tap",from:"bus.pos",to:"m1.plus",currentA:8});
 const out=evaluateInstallation(x,60);
 assert.equal(out.status,"invalid");
 near(out.junctionResidualA["bus.pos"],2);
 assert.ok(out.findings.some(x=>x.id==="junction.kcl"));
 assert.equal(out.codeComplianceVerified,false);
});


test("required positive and return wires must reach the SAME counterparty, not unrelated devices",()=>{
 const g=graph();
 g.products.push({...g.products[0],id:"unrelated",role:"other"});
 g.terminals.push({...g.terminals[3],id:"unrelated.minus",productId:"unrelated"});
 // All declared source terminals are connected, but their two rails serve
 // unrelated products. The previous implementation reported structural pass.
 g.conductors[1].to="unrelated.minus";
 g.terminals[3].requiredConnection=false;
 g.requiredPairs.splice(1);
 const out=evaluateInstallation(g,60);
 assert.equal(out.status,"invalid");
 assert.ok(out.findings.some(x=>x.id==="return.counterparty"));
 assert.ok(!out.findings.some(x=>x.id==="return.incomplete"));
});

test("the return path may traverse an explicitly wired junction",()=>{
 const g=graph();
 g.products.push({id:"pvbus",maker:"Fixture",model:"Positive junction",revision:"1",
   datasheetUrl:"https://example.invalid/",role:"bus"});
 g.terminals.push({...g.terminals[0],id:"pvbus.positive",productId:"pvbus",kind:"junction"});
 g.conductors[0].to="pvbus.positive";
 g.conductors.push({...g.conductors[0],id:"bus.to.mppt",
   from:"pvbus.positive",to:"m1.plus",currentA:10});
 const out=evaluateInstallation(g,60);
 assert.equal(out.status,"structural_checks_passed");
 near(out.junctionResidualA["pvbus.positive"],0);
 assert.ok(!out.findings.some(x=>x.id==="return.counterparty"));
});

test("L2-to-neutral 120 V branch is separate from L1-to-neutral, not conflated with 240 V",()=>{
 const g=graph();
 g.products[0]={...g.products[0],maker:"Fixture",model:"Split-phase source",role:"generator"};
 g.products[1]={...g.products[1],maker:"Fixture",model:"L2 120 V load",role:"load"};
 g.terminals=g.terminals.map(t=>({
   ...t,rail:t.rail==="PV_POS"?"AC_L2":"AC_NEUTRAL",
   minimumV:110,maximumV:125
 }));
 g.requiredPairs=g.requiredPairs.map(p=>({...p,kind:"AC_120_L2"}));
 assert.equal(evaluateInstallation(g,60).status,"structural_checks_passed");
 g.requiredPairs=g.requiredPairs.map(p=>({...p,kind:"AC_120"}));
 assert.ok(evaluateInstallation(g,60).findings.some(x=>x.id==="pair.rails"));
 g.requiredPairs=g.requiredPairs.map(p=>({...p,kind:"AC_240"}));
 assert.ok(evaluateInstallation(g,60).findings.some(x=>x.id==="pair.rails"));
});

test("duplicate required circuit declarations fail rather than double-certify",()=>{
 const g=graph();g.requiredPairs.push({...g.requiredPairs[0]});
 assert.throws(()=>evaluateInstallation(g,60),/duplicate required terminal pair/);
});

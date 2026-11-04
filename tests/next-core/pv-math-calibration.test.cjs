"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"../../.next-core-dist");
const {LONGI_LR4_72HBD_435M}=require(path.join(root,"catalog.js"));
const {makePvModuleSnapshot}=require(path.join(root,"pv-module.js"));
const {assessPvColdDesign}=require(path.join(root,"pv-design.js"));
const {singleDiodeMpp,diodeCurrentAtVoltage,LONGI_435_PVSYST}=require(path.join(root,"pv-diode.js"));
const {solveDiodeArrayCableMpp}=require(path.join(root,"pv-wire-iv.js"));
const {calibrationResiduals,fitLocalThevenin}=require(path.join(root,"calibration.js"));
const close=(a,b,eps=1e-8)=>{
  assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
    Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),
    "Got "+a+", expected "+b+" (relative eps "+eps+")");
};
const c={absoluteMaximumInputVoltageV:150,
 startupOperatingMaximumInputVoltageV:145,maximumPvShortCircuitCurrentA:50};
const panel={
 vocStcV:LONGI_LR4_72HBD_435M.vocStcV,iscStcA:LONGI_LR4_72HBD_435M.iscStcA,
 vocTemperatureCoefficientPerC:LONGI_LR4_72HBD_435M.vocTempCoefficientPerC,
 iscTemperatureCoefficientPerC:LONGI_LR4_72HBD_435M.iscTempCoefficientPerC
};
const climate={minimumDesignCellTemperatureC:-29.5,
 maximumDesignCellTemperatureC:45,maximumDesignEffectiveIrradianceWm2:1000};
const cold=(ns,np=2,env=climate)=>assessPvColdDesign(
 panel,{modulesInSeries:ns,stringsInParallel:np},env,c);
const pv=(irradiance=1000,temp=25,resistance=0,minInput=0)=>solveDiodeArrayCableMpp({
 reference:LONGI_435_PVSYST,irradianceWm2:irradiance,
 cellTemperatureC:temp,modulesInSeries:2,stringsInParallel:2,
 pvWireLoopOhm:resistance,minimumControllerInputVoltageV:minInput
});
test("PV Isc scales with irradiance rather than incorrectly remaining at STC current",()=>{
 const snap=(g)=>makePvModuleSnapshot(LONGI_LR4_72HBD_435M,
  {series:2,parallel:2},{effectiveIrradianceWm2:g,cellTemperatureC:25,
    shadeFraction:0,snowCoveredFraction:0,additionalLossFraction:0});
 close(snap(1000).totalShortCircuitA,22.72);
 close(snap(500).totalShortCircuitA,11.36);
 close(snap(200).totalShortCircuitA,4.544);
 close(snap(0).totalShortCircuitA,0);
 close(snap(0).seriesVocV,0);
 close(snap(0).availablePowerW,0);
 // The fixed-Vmp approximation uses an inactive reference voltage at night;
 // no accepted energy/current is ever inferred from this reference number.
 assert.ok(snap(0).seriesVmpV>0);
 const warm=makePvModuleSnapshot(LONGI_LR4_72HBD_435M,
  {series:1,parallel:1},{effectiveIrradianceWm2:800,cellTemperatureC:45,
    shadeFraction:0,snowCoveredFraction:0,additionalLossFraction:0});
 close(warm.totalShortCircuitA,11.36*.8*(1+.0005*20));
});
test("cold design Voc never silently uses today's 25C cell temperature",()=>{
 const normal=cold(2);
 assert.equal(normal.status,"pass_checked_envelope");
 close(normal.designColdOpenCircuitVoltageV,2*49.1*(1-.00284*(-29.5-25)));
 close(normal.designMaximumShortCircuitCurrentA,2*11.36*(1+.0005*(45-25)));
 assert.ok(normal.designColdOpenCircuitVoltageV>98.2);
 const wrong=cold(3);
 assert.equal(wrong.status,"fail");
 assert.ok(wrong.designColdOpenCircuitVoltageV>150);
 assert.ok(wrong.absoluteVoltageMarginV<0);
});
test("unknown design extreme, above-STC irradiance and current overload fail closed",()=>{
 assert.equal(cold(2,2,{...climate,minimumDesignCellTemperatureC:null}).status,"indeterminate");
 assert.equal(cold(2,2,{...climate,maximumDesignEffectiveIrradianceWm2:null}).status,"indeterminate");
 const ghi=cold(2,2,{...climate,maximumDesignEffectiveIrradianceWm2:1300});
 assert.equal(ghi.status,"indeterminate"); // no documented irradiance Voc correction
 close(ghi.designMaximumShortCircuitCurrentA,2*11.36*1.3*(1+.0005*20));
 assert.equal(cold(2,5).status,"fail");
 const documented=cold(2,2,{...climate,maximumDesignEffectiveIrradianceWm2:1300,
   maximumIrradianceVocFactor:1.025});
 assert.equal(documented.status,"pass_checked_envelope");
 close(documented.designColdOpenCircuitVoltageV,
   2*49.1*(1-.00284*(-54.5))*1.025);
 assert.throws(()=>cold(2,2,{...climate,minimumDesignCellTemperatureC:60}),/exceeds maximum/);
 assert.throws(()=>cold(2,2,{...climate,maximumIrradianceVocFactor:.98}),/>= 1/);
});
test("zero external cable resistance agrees with independently benchmarked single-diode MPP",()=>{
 for(const g of [200,400,600,800,1000]){
  const module=singleDiodeMpp(LONGI_435_PVSYST,g,25);
  const result=pv(g,25,0);
  assert.equal(result.status,"modeled_reference_only");
  close(result.maximumArrayUnwiredW,module.maxPowerW*4,1e-9);
  close(result.maximumControllerInputW,module.maxPowerW*4,1e-5);
  close(result.pvWireLossW,0);
  close(result.conservationResidualW,0);
  close(result.relativePowerRecovery,1,1e-5);
 }
});
test("nonlinear cable optimum conserves energy and matches independent brute-force grid",()=>{
 for(const g of [200,600,1000]){
  const model=singleDiodeMpp(LONGI_435_PVSYST,g,25);
  const r=.75,result=pv(g,25,r);
  assert.equal(result.status,"modeled_reference_only");
  assert.ok(result.maximumControllerInputW<result.maximumArrayUnwiredW);
  assert.ok(result.pvWireLossW>0);
  close(result.arrayGrossPowerW,
   result.pvWireLossW+result.maximumControllerInputW,1e-8);
  close(result.arrayCurrentA,2*diodeCurrentAtVoltage(
    LONGI_435_PVSYST,g,25,result.moduleVoltageV),1e-8);
  let gridBest=0;
  for(let k=0;k<=1200;k++){
    const vm=k/1200*model.openCircuitVoltageV;
    const i=2*diodeCurrentAtVoltage(LONGI_435_PVSYST,g,25,vm);
    const port=2*vm-i*r;
    gridBest=Math.max(gridBest,Math.max(0,port*i));
  }
  // Independent dense grid may be lower than the continuous optimum by at most
  // the discretization error (here we require a 0.2% agreement).
  assert.ok(result.maximumControllerInputW>=gridBest*(1-0.002));
  assert.ok(result.maximumControllerInputW<=gridBest*(1+0.002));
 }
});
test("MPPT input-voltage threshold is a separate reference constraint",()=>{
 const best=pv(1000,25,.5,0);
 const constrained=pv(1000,25,.5,90);
 assert.ok(constrained.controllerInputVoltageV>=90-1e-8);
 assert.ok(constrained.maximumControllerInputW<=best.maximumControllerInputW+1e-7);
 const none=pv(1000,25,.5,200);
 assert.equal(none.status,"insufficient_input_voltage");
 close(none.maximumControllerInputW,0);
 const night=pv(0,25,.5,5);
 assert.equal(night.status,"no_irradiance");
 close(night.arrayCurrentA,0);
});
test("local Thevenin fit exactly recovers known voltage drop in a SYNTHETIC fixture",()=>{
 const samples=[-40,-15,0,15,45].map(currentA=>({
  currentA,terminalVoltageV:26.4-.032*currentA,
  soc:.65,cellTemperatureC:22
 }));
 const model=fitLocalThevenin(samples);
 close(model.fittedOpenCircuitVoltageV,26.4);
 close(model.fittedInternalResistanceOhm,.032);
 close(model.residuals.rmse,0);
 assert.equal(model.evidence,"local_linear_thevenin_fit_only_unverified_instrument_records");
 assert.equal(model.sampleCount,5);
});
test("local Thevenin identification rejects mixed operating points and unphysical slope",()=>{
 const base=[0,10,20].map(i=>({currentA:i,terminalVoltageV:26-i*.01,
   soc:.5,cellTemperatureC:25}));
 assert.throws(()=>fitLocalThevenin(base.map((p,j)=>({...p,soc:.5+j*.02}))),/narrow SOC/);
 assert.throws(()=>fitLocalThevenin(base.map((p,j)=>({...p,cellTemperatureC:25+j*3}))),/narrow SOC\/temperature/);
 assert.throws(()=>fitLocalThevenin(base.map(p=>({...p,currentA:10}))),/insufficiently varied/);
 assert.throws(()=>fitLocalThevenin(base.map(p=>({...p,terminalVoltageV:24+p.currentA*.1}))),/not physically admissible/);
});
test("independent prediction-error metrics retain sign and reject meaningless percentages",()=>{
 const r=calibrationResiduals([{observed:10,predicted:12,standardUncertainty:1},
   {observed:20,predicted:19,standardUncertainty:1},
   {observed:30,predicted:29,standardUncertainty:2}],1);
 close(r.bias,0);close(r.mae,4/3);close(r.rmse,Math.sqrt(6/3));
 close(r.maximumAbsoluteError,2);
 close(r.weightedAbsolutePercentageError,4/60);
 close(r.chiSquare,4+1+.25);
 close(r.reducedChiSquare,(4+1+.25)/2);
 const zero=calibrationResiduals([{observed:0,predicted:1}]);
 assert.equal(zero.relativeRmsError,null);
 assert.equal(zero.weightedAbsolutePercentageError,null);
 assert.equal(zero.chiSquare,null);
 assert.throws(()=>calibrationResiduals([]),/at least one/);
 assert.throws(()=>calibrationResiduals([{observed:10,predicted:11,standardUncertainty:0}]),/positive/);
});
test("bounded deterministic IV parameter sweep never invents power",()=>{
 let seed=24019;
 const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let k=0;k<32;k++){
  const g=10+1200*rnd(),temp=-25+85*rnd(),res=2*rnd();
  const cur=pv(g,temp,res);
  assert.equal(cur.status,"modeled_reference_only");
  assert.ok(cur.maximumControllerInputW>=0);
  assert.ok(cur.maximumControllerInputW<=cur.maximumArrayUnwiredW+1e-6);
  close(cur.arrayGrossPowerW,cur.pvWireLossW+cur.maximumControllerInputW,1e-8);
 }
});

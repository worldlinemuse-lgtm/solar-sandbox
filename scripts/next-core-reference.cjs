"use strict";
/**
 * Reproducible 24h SYNTHETIC reference only — not an Honesdale prediction or
 * equipment recommendation. Requires TypeScript core compiled to .next-core-dist.
 */
const {makeSyntheticBenchSpec}=require("../.next-core-dist/catalog.js");
const {advanceReferenceIsland}=require("../.next-core-dist/island.js");
const syntheticInput={
  assumptions:"Synthetic no-surge, constant duty, fixed-Vmp PV and battery R/OCV test bench",
  load:{watts:125,powerFactor:.95},
  sampleSeconds:60,minutes:1440,sourceRevision:"next-core mathematical bench"
};
let state={elapsedSeconds:0,
  battery:{soc:.8,chargeConnected:true,dischargeConnected:true},
  generator:null};
const totals={requestedAc:0,servedAc:0,unservedAc:0,pvBus:0,batteryTerminal:0};
let failedServiceMinutes=0,boundaryEvents=0;
for(let minute=0;minute<1440;minute++){
  const hour=minute/60;
  const e=(hour>=7&&hour<17)?Math.max(0,800*Math.sin(Math.PI*(hour-7)/10)):0;
  const {spec}=makeSyntheticBenchSpec({effectiveIrradianceWm2:e,
    ambientC:20,windMps:1});
  const out=advanceReferenceIsland(spec,state,{
    loads:[{id:"synthetic-constant",watts:125,powerFactor:.95,leg:"L1"}],
    durationSeconds:60,generatorCommand:{action:"none",operatorPresent:false}
  });
  state=out.nextState;
  if(out.status==="indeterminate")throw Error("Synthetic benchmark unexpectedly indeterminate");
  for(const k of Object.keys(totals))totals[k]+=out.ledgerWh[k];
  if(out.ledgerWh.unservedAc>0)failedServiceMinutes++;
  if(out.substeps>1)boundaryEvents++;
}
if(Math.abs(totals.requestedAc-totals.servedAc-totals.unservedAc)>1e-7)
  throw Error("Synthetic AC conservation failed");
if(!(state.battery.soc>=.1&&state.battery.soc<=1))
  throw Error("Synthetic SOC outside physical bounds");
console.log(JSON.stringify({status:"mathematical_only_synthetic_test",input:syntheticInput,
  finalSoc:state.battery.soc,totals,failedServiceMinutes,boundaryEvents},null,2));

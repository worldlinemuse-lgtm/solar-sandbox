/**
 * Explicit charge/discharge BMS ports, temperature hysteresis, timed overcurrent,
 * and manual/automatic reset. Every threshold and reset policy is equipment-specific.
 * Do not supply a default to fill missing manufacturer data.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export interface BmsProtectionSpec {
 readonly chargeCutoffColdC:number;
 readonly chargeResumeC:number;
 readonly dischargeCutoffColdC:number;
 readonly dischargeResumeC:number;
 readonly chargeOvercurrentA:number;
 readonly dischargeOvercurrentA:number;
 readonly overcurrentHoldSeconds:number;
 readonly tripDisconnects:"both"|"affected_port";
 readonly resetPolicy:"manual"|"automatic";
 readonly evidenceSource:string;
}
export interface BmsState {
 readonly chargeConnected:boolean;
 readonly dischargeConnected:boolean;
 readonly overcurrentSeconds:number;
 readonly trippedOvercurrent:boolean;
 readonly trippedPort:"none"|"charge"|"discharge"|"both";
}
export interface BmsPoint {
 readonly temperatureC:number;
 /** Battery signed current: positive discharge, negative charge. */
 readonly batteryCurrentA:number;
 readonly dtSeconds:number;
 readonly manualResetRequested:boolean;
}
export interface BmsAdvance {
 readonly next:BmsState;
 readonly currentSupportedSeconds:number;
 readonly events:readonly string[];
 readonly validation:"parameterized_protection_not_manufacturer_verified";
}
export function advanceBms(p:Readonly<BmsProtectionSpec>,s:Readonly<BmsState>,
  x:Readonly<BmsPoint>):BmsAdvance {
  finite("temperatureC",x.temperatureC);finite("batteryCurrentA",x.batteryCurrentA);
  if(!(finite("dtSeconds",x.dtSeconds)>0))
    throw new ModelFailure("INVALID_INPUT","BMS interval must be positive");
  for(const k of ["chargeCutoffColdC","chargeResumeC","dischargeCutoffColdC",
    "dischargeResumeC"] as const)finite(k,p[k]);
  if(p.chargeResumeC<p.chargeCutoffColdC||
    p.dischargeResumeC<p.dischargeCutoffColdC)
      throw new ModelFailure("INVALID_INPUT","BMS resume temperature below trip temperature");
  if(!(finite("overcurrentHoldSeconds",p.overcurrentHoldSeconds)>0))
    throw new ModelFailure("INVALID_INPUT","BMS overcurrent hold must be positive");
  nonnegative("chargeOvercurrentA",p.chargeOvercurrentA);
  nonnegative("dischargeOvercurrentA",p.dischargeOvercurrentA);
  nonnegative("overcurrentSeconds",s.overcurrentSeconds);
  const events:string[]=[];
  let trip=s.trippedOvercurrent, trippedPort=s.trippedPort;
  if(trip&&trippedPort==="none")
    throw new ModelFailure("INVALID_INPUT","Latched fault has no recorded affected port");
  if(!trip&&trippedPort!=="none")
    throw new ModelFailure("INVALID_INPUT","Unlatched fault has a stale affected port");
  if(trip&&x.manualResetRequested&&p.resetPolicy==="manual"){
    trip=false;trippedPort="none";events.push("Manual overcurrent reset requested");
  } else if(trip&&p.resetPolicy==="automatic"&&x.batteryCurrentA===0) {
    trip=false;trippedPort="none";events.push("Automatic overcurrent reset under verified zero-current condition");
  }
  let charge=s.chargeConnected,discharge=s.dischargeConnected;
  if(x.temperatureC<p.chargeCutoffColdC)charge=false;
  else if(x.temperatureC>=p.chargeResumeC)charge=true;
  if(x.temperatureC<p.dischargeCutoffColdC)discharge=false;
  else if(x.temperatureC>=p.dischargeResumeC)discharge=true;
  if(trip){
    if(trippedPort==="both"||trippedPort==="charge")charge=false;
    if(trippedPort==="both"||trippedPort==="discharge")discharge=false;
  }
  if(!charge&&x.batteryCurrentA<0||!discharge&&x.batteryCurrentA>0){
    return {next:{chargeConnected:charge,dischargeConnected:discharge,
      overcurrentSeconds:s.overcurrentSeconds,trippedOvercurrent:trip,trippedPort},
      currentSupportedSeconds:0,events:events.concat(["Requested port disconnected"]),
      validation:"parameterized_protection_not_manufacturer_verified"};
  }
  const excess=x.batteryCurrentA>p.dischargeOvercurrentA||
    -x.batteryCurrentA>p.chargeOvercurrentA;
  let accum=excess?s.overcurrentSeconds:0;
  let supported=x.dtSeconds;
  if(excess) {
    const remaining=Math.max(0,p.overcurrentHoldSeconds-accum);
    supported=Math.min(x.dtSeconds,remaining);
    accum+=supported;
    if(supported<x.dtSeconds-1e-10||accum>=p.overcurrentHoldSeconds-1e-10){
      trip=true;
      trippedPort=p.tripDisconnects==="both"?"both":x.batteryCurrentA<0?"charge":"discharge";
      if(trippedPort==="both"||trippedPort==="charge")charge=false;
      if(trippedPort==="both"||trippedPort==="discharge")discharge=false;
      events.push("Timed BMS current protection tripped: "+trippedPort);
    }
  }
  return {next:{chargeConnected:charge,dischargeConnected:discharge,
      overcurrentSeconds:accum,trippedOvercurrent:trip,trippedPort},
    currentSupportedSeconds:supported,events,
    validation:"parameterized_protection_not_manufacturer_verified"};
}

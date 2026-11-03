import {ModelFailure,finite,nonnegative} from "./contracts";

export type GeneratorMode = "off"|"starting"|"running"|"cooling"|"refueling";
export interface GeneratorSpec {
  readonly ratedW:number;
  readonly tankCapacityGallons:number;
  readonly quarterLoadGallonsPerHour:number;
  readonly ratedLoadGallonsPerHour:number;
  /** All three times are explicitly configured R3 operational assumptions, not Honda specifications. */
  readonly startSeconds:number;
  readonly coolingSeconds:number;
  readonly refuelSeconds:number;
}
export interface GeneratorState {
  readonly mode:GeneratorMode;
  readonly tankGallons:number;
  readonly reserveGallons:number;
  readonly remainingTransitionSec:number;
}
export interface GeneratorCommand {
  readonly action:"none"|"start"|"stop"|"refuel";
  readonly operatorPresent:boolean;
}
export interface GeneratorSegment {
  readonly durationSeconds:number;
  readonly deliveredW:number;
  readonly mode:GeneratorMode;
}
export interface GeneratorAdvance {
  readonly state:GeneratorState;
  readonly segments:readonly GeneratorSegment[];
  readonly deliveredWh:number;
  readonly gallonsConsumed:number;
  readonly events:readonly string[];
  readonly validation:"interpolated_fuel_curve_and_assumed_operating_times";
}

export function estimatedFuelRateGph(s:Readonly<GeneratorSpec>,loadW:number):number {
  if(!(finite("ratedW",s.ratedW)>0))throw new ModelFailure("INVALID_INPUT","Generator rated power must be >0");
  nonnegative("loadW",loadW);
  const low=nonnegative("quarterLoadGallonsPerHour",s.quarterLoadGallonsPerHour);
  const high=nonnegative("ratedLoadGallonsPerHour",s.ratedLoadGallonsPerHour);
  if(high<low)throw new ModelFailure("INVALID_INPUT","Fuel endpoints nonmonotonic");
  // Below 25% load is assumed constant at the 25%-load measured/published point.
  const x=Math.min(1,Math.max(0,(loadW-s.ratedW/4)/(s.ratedW*0.75)));
  return low+(high-low)*x;
}

/** Finite tank and separately held reserve. A stopped generator delivers no energy.
 * Refuel is prohibited while running/hot and requires operator action.
 * Intra-step startup, shutdown and fuel exhaustion produce subinterval segments.
 */
export function advanceGenerator(s:Readonly<GeneratorSpec>,original:Readonly<GeneratorState>,
  cmd:Readonly<GeneratorCommand>,requestW:number,dtSec:number):GeneratorAdvance {
  if(!(finite("dtSec",dtSec)>0&&dtSec<=86400))throw new ModelFailure("INVALID_INPUT","Generator dt invalid");
  nonnegative("requested generator W",requestW);
  nonnegative("tank capacity",s.tankCapacityGallons);
  for(const k of ["startSeconds","coolingSeconds","refuelSeconds"] as const)nonnegative(k,s[k]);
  let tank=nonnegative("tank gallons",original.tankGallons);
  let reserve=nonnegative("reserve gallons",original.reserveGallons);
  if(tank>s.tankCapacityGallons+1e-9)throw new ModelFailure("INVALID_INPUT","Tank over capacity");
  let mode=original.mode,remaining=nonnegative("transition",original.remainingTransitionSec);
  const events:string[]=[],segments:GeneratorSegment[]=[];
  if(cmd.action!=="none"&&!cmd.operatorPresent){
    events.push("Operator unavailable; requested generator action rejected");
  }else if(cmd.action==="start"&&mode==="off"){
    if(tank>0){mode="starting";remaining=s.startSeconds;events.push("Operator started recoil procedure");}
    else events.push("Cannot start empty tank");
  }else if(cmd.action==="stop"&&(mode==="running"||mode==="starting")){
    mode="cooling";remaining=s.coolingSeconds;events.push("Stopped; cooling required");
  }else if(cmd.action==="refuel"){
    if(mode!=="off")events.push("Refueling prohibited until engine stopped and cool");
    else {
      const amount=Math.min(reserve,Math.max(0,s.tankCapacityGallons-tank));
      tank+=amount;reserve-=amount;mode="refueling";remaining=s.refuelSeconds;
      events.push("Operator transferred "+amount.toFixed(6)+" gallons from reserve to tank");
    }
  }
  let t=dtSec,deliveredWh=0,used=0,guard=0;
  const append=(duration:number,power:number,which:GeneratorMode)=>{
    if(duration>0){segments.push({durationSeconds:duration,deliveredW:power,mode:which});
      deliveredWh+=power*duration/3600;}
  };
  while(t>1e-10){
    if(++guard>20)throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","Generator event transition did not converge");
    if(mode==="off"){append(t,0,mode);t=0;break;}
    if(mode==="running"){
      const out=Math.min(requestW,s.ratedW),gph=estimatedFuelRateGph(s,out);
      if(tank<=1e-12){tank=0;mode="off";events.push("Fuel exhausted");continue;}
      const fuelTime=gph>0?tank*3600/gph:Infinity;
      const chunk=Math.min(t,fuelTime);
      append(chunk,out,mode);const gallons=gph*chunk/3600;
      used+=gallons;tank=Math.max(0,tank-gallons);t-=chunk;
      if(chunk>=fuelTime-1e-9){tank=0;mode="off";events.push("Fuel exhausted");}
      continue;
    }
    const chunk=Math.min(t,remaining);
    append(chunk,0,mode);remaining-=chunk;t-=chunk;
    if(remaining<=1e-10){
      if(mode==="starting"){mode=tank>0?"running":"off";events.push(mode==="running"?"Generator running":"Start failed: no fuel");}
      else if(mode==="cooling"||mode==="refueling")mode="off";
      remaining=0;
    }
  }
  const seconds=segments.reduce((x,y)=>x+y.durationSeconds,0);
  if(Math.abs(seconds-dtSec)>1e-7)throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","Unaccounted generator elapsed time");
  return {state:{mode,tankGallons:tank,reserveGallons:reserve,remainingTransitionSec:remaining},
    segments,deliveredWh,gallonsConsumed:used,events,
    validation:"interpolated_fuel_curve_and_assumed_operating_times"};
}

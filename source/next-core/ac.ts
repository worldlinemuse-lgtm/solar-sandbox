import {ModelFailure,finite,inRange,nonnegative} from "./contracts";

export type AcLeg = "L1" | "L2" | "BOTH";
export interface AcStarting {
  readonly apparentVA:number;
  readonly powerFactor:number|null;
  readonly durationSeconds:number|null;
}
export interface AcDemand {
  readonly id:string;
  readonly watts:number;
  readonly powerFactor:number;
  readonly leg:AcLeg;
  readonly starting?:AcStarting;
}
export interface InverterLimits {
  readonly phases:"120V"|"split120_240V";
  /** At each 120V inverter output, not the summed split-phase rating. */
  readonly continuousWPerLeg:number;
  readonly continuousVAPerLeg:number;
  readonly peakWPerLeg:number|null;
  readonly peakVAPerLeg:number|null;
  readonly peakDurationSeconds:number|null;
  readonly idleWPerUnit:number;
  readonly estimatedRunningEfficiency:number;
  readonly inverterUnits:1|2;
}
export interface AcAssessment {
  readonly status:"pass"|"fail"|"indeterminate";
  readonly reasons:readonly string[];
  readonly requestedW:number;
  readonly requestedVA:number;
  readonly legs:readonly {readonly w:number;readonly var:number;readonly va:number}[];
  readonly peakLegs:readonly {readonly w:number|null;readonly va:number;readonly vaIsLowerBound:boolean}[];
  readonly estimatedInverterDcW:number|null;
  readonly estimatedInverterLossW:number|null;
  readonly validation:"source_limits_with_estimated_conversion_efficiency";
}

/** Real/reactive power is vectorially aggregated. Summing VA as W is prohibited.
 * For a 240-V balanced appliance, half of the real and reactive power burdens each leg.
 * Inrush is a separate event: missing PF, VA, or duration produces indeterminate status.
 */
export function assessAcLoads(loads:readonly AcDemand[], i:Readonly<InverterLimits>):AcAssessment {
  for(const field of ["continuousWPerLeg","continuousVAPerLeg","idleWPerUnit"] as const)
    nonnegative(field,i[field]);
  if(i.peakWPerLeg!==null)nonnegative("peakWPerLeg",i.peakWPerLeg);
  if(i.peakVAPerLeg!==null)nonnegative("peakVAPerLeg",i.peakVAPerLeg);
  if(i.peakDurationSeconds!==null)nonnegative("peakDurationSeconds",i.peakDurationSeconds);
  inRange("estimatedRunningEfficiency",i.estimatedRunningEfficiency,0.000001,1);
  const count=i.phases==="split120_240V"?2:1;
  if(i.inverterUnits!==count)throw new ModelFailure("INVALID_INPUT","Inverter unit count does not match topology");
  const legs=Array.from({length:count},()=>({w:0,var:0}));
  const peak=Array.from({length:count},()=>({w:0 as number|null,var:0,known:true,
    unknownVA:[] as number[],unknownSteadyP:0,unknownSteadyQ:0}));
  const reasons:string[]=[];let indeterminate=false,fail=false;
  for(const l of loads){
    nonnegative("load watts",l.watts);
    inRange("load PF",l.powerFactor,0.000001,1);
    if(!l.id)throw new ModelFailure("INVALID_INPUT","AC load must have a stable ID");
    if(count===1&&l.leg!=="L1"){
      fail=true;reasons.push(l.id+": incompatible 120/240-V topology");continue;
    }
    const q=l.watts*Math.sqrt(1/(l.powerFactor*l.powerFactor)-1);
    const indexes=l.leg==="BOTH"?[0,1]:[l.leg==="L1"?0:1];
    const share=l.leg==="BOTH"?0.5:1;
    for(const n of indexes){
      legs[n].w+=l.watts*share;legs[n].var+=q*share;
      if(l.starting){
        nonnegative("starting VA",l.starting.apparentVA);
        if(l.starting.powerFactor===null||l.starting.durationSeconds===null){
          indeterminate=true;
          reasons.push(l.id+": startup PF and/or duration missing; no certified startup pass");
          peak[n].known=false;peak[n].w=null;
          peak[n].unknownVA.push(l.starting.apparentVA*share);
          peak[n].unknownSteadyP+=l.watts*share;
          peak[n].unknownSteadyQ+=q*share;
        }else{
          inRange("startup PF",l.starting.powerFactor,0.000001,1);
          nonnegative("starting duration",l.starting.durationSeconds);
          const ps=l.starting.apparentVA*l.starting.powerFactor*share;
          const qs=l.starting.apparentVA*Math.sqrt(1-l.starting.powerFactor*l.starting.powerFactor)*share;
          if(peak[n].w!==null)peak[n].w+=ps-l.watts*share;
          peak[n].var+=qs-q*share;
          if(i.peakDurationSeconds===null||l.starting.durationSeconds>i.peakDurationSeconds){
            indeterminate=true;reasons.push(l.id+": inverter surge-duration capability not established");
          }
        }
      }
    }
  }
  const steady=legs.map(v=>({w:v.w,var:v.var,va:Math.hypot(v.w,v.var)}));
  const started=legs.map((v,n)=>{
    const u=peak[n],isUnknown=u.unknownVA.length>0;
    const knownP=v.w-u.unknownSteadyP+(u.w??0);
    const knownQ=v.var-u.unknownSteadyQ+u.var;
    const knownVA=Math.hypot(knownP,knownQ);
    if(!isUnknown)return {w:knownP,va:knownVA,vaIsLowerBound:false};
    // Reverse triangle inequality: a conservative lower bound on apparent
    // demand when starting PF is unknown. No assumed phasor angle.
    const total=u.unknownVA.reduce((x,y)=>x+y,0);
    const largest=Math.max(...u.unknownVA);
    const lower=Math.max(0,knownVA-total,largest-(total-largest)-knownVA);
    return {w:null,va:lower,vaIsLowerBound:true};
  });
  for(let n=0;n<count;n++){
    if(steady[n].w>i.continuousWPerLeg+1e-9||steady[n].va>i.continuousVAPerLeg+1e-9){
      fail=true;reasons.push("L"+(n+1)+": continuous W/VA limit exceeded");
    }
    if(started[n].w!==null&&i.peakWPerLeg!==null&&started[n].w!>i.peakWPerLeg+1e-9){
      fail=true;reasons.push("L"+(n+1)+": verified peak W limit exceeded");
    }
    if(i.peakVAPerLeg!==null){
      if(started[n].va>i.peakVAPerLeg+1e-9){
        fail=true;reasons.push("L"+(n+1)+": peak VA limit exceeded"+
          (started[n].vaIsLowerBound?" even at the rigorous minimum apparent demand":""));
      }
    }else if(started[n].va>i.continuousVAPerLeg+1e-9){
      indeterminate=true;reasons.push("L"+(n+1)+": peak VA not published");
    }
  }
  const requestedW=loads.reduce((s,l)=>s+l.watts,0);
  const requestedVA=Math.hypot(steady.reduce((s,v)=>s+v.w,0),
    steady.reduce((s,v)=>s+v.var,0));
  const status=fail?"fail":indeterminate?"indeterminate":"pass";
  const loss=i.inverterUnits*i.idleWPerUnit+
    requestedW*(1/i.estimatedRunningEfficiency-1);
  return {status,reasons,requestedW,requestedVA,legs:steady,peakLegs:started,
    estimatedInverterDcW:status==="pass"?requestedW+loss:null,
    estimatedInverterLossW:status==="pass"?loss:null,
    validation:"source_limits_with_estimated_conversion_efficiency"};
}

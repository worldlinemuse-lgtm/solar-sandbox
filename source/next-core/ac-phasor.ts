/**
 * Sinusoidal fundamental-frequency AC phasor reference.
 *
 * Existing legacy AC compatibility estimates |Q| from unsigned PF and therefore
 * presumes ALL loads have lagging/reactive Q. This independent reference accepts
 * signed var explicitly (capacitive Q<0, inductive Q>0).
 *
 * At a common frequency and phase convention:
 *   P_sum = sum P_i; Q_sum = sum Q_i; S_1 = hypot(P_sum,Q_sum).
 * Per-leg phase burdens are evaluated independently; a 240V balanced load
 * contributes half of P and Q to each 120V leg.
 *
 * If the user has not independently established SINUSOIDAL loading, harmonics
 * are unknown: S_1 is a rigorous lower bound, NOT actual RMS VA. This method
 * refuses a 'pass' for non-sinusoidal unknown distortion, in accordance with
 * the distinction emphasized by IEEE 1459-2025.
 *
 * Source: https://standards.ieee.org/ieee/1459/7578/
 * This is electrical POWER accounting, not a full circuit safety approval.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export type PhasorLeg="L1"|"L2"|"BOTH";
export interface SignedReactiveLoad {
 readonly id:string;
 readonly realPowerW:number;
 readonly reactiveVarSigned:number;
 readonly leg:PhasorLeg;
}
export interface PhasorLimits {
 readonly phases:"120V"|"split120_240V";
 readonly continuousRealWPerLeg:number;
 readonly continuousApparentVAPerLeg:number;
 /** True only when fundamental sinusoidal power is a valid full-RMS VA model. */
 readonly sinusoidalWaveformsConfirmed:boolean;
}
export interface LegPhasorBalance {
 readonly leg:"L1"|"L2";
 readonly realPowerW:number;
 readonly reactiveVarSigned:number;
 /** Lower bound if waveforms/harmonic content are not independently measured. */
 readonly fundamentalApparentVA:number;
 readonly rmsApparentVA:number|null;
 readonly possibleHarmonicDistortion:"unknown"|"confirmed_sinusoidal";
}
export interface AcPhasorAssessment {
 readonly status:"pass_sinusoidal_model"|"fail"|"indeterminate_harmonics";
 readonly totalRealPowerW:number;
 readonly totalFundamentalReactiveVar:number;
 readonly legs:readonly LegPhasorBalance[];
 readonly reasons:readonly string[];
 readonly validation:"phasor_math_only_not_instrumented";
}
export function assessSignedAcPhasors(
 loads:readonly SignedReactiveLoad[],limits:Readonly<PhasorLimits>
):AcPhasorAssessment{
 const maxP=nonnegative("continuousRealWPerLeg",limits.continuousRealWPerLeg);
 const maxVA=nonnegative("continuousApparentVAPerLeg",limits.continuousApparentVAPerLeg);
 const split=limits.phases==="split120_240V";
 if(!split&&limits.phases!=="120V")
   throw new ModelFailure("INVALID_INPUT","Unsupported inverter AC phases");
 if(typeof limits.sinusoidalWaveformsConfirmed!=="boolean")
   throw new ModelFailure("INVALID_INPUT","Explicit waveform confirmation required");
 const aggregate=Array.from({length:split?2:1},()=>({p:0,q:0}));
 const ids=new Set<string>();
 const reasons:string[]=[];let fail=false;
 for(const x of loads){
   if(!x.id||ids.has(x.id))
     throw new ModelFailure("INVALID_INPUT","AC load IDs must be unique and nonempty");
   ids.add(x.id);
   const real=nonnegative("realPowerW",x.realPowerW);
   const reactive=finite("reactiveVarSigned",x.reactiveVarSigned);
   if(!["L1","L2","BOTH"].includes(x.leg))
     throw new ModelFailure("INVALID_INPUT","Unrecognized AC phase leg");
   if(!split&&x.leg!=="L1"){
     fail=true;reasons.push(x.id+": 120V-only output cannot supply L2/240V load");
     continue;
   }
   const per=x.leg==="BOTH"?0.5:1;
   const indexes=x.leg==="BOTH"?[0,1]:[x.leg==="L1"?0:1];
   for(const i of indexes){aggregate[i].p+=real*per;aggregate[i].q+=reactive*per;}
 }
 const legs:LegPhasorBalance[]=aggregate.map((x,i)=>{
   const apparent=Math.hypot(x.p,x.q);
   if(x.p>maxP+1e-9){fail=true;reasons.push("L"+(i+1)+": real continuous W rating exceeded");}
   if(apparent>maxVA+1e-9){fail=true;reasons.push("L"+(i+1)+": fundamental VA alone exceeds RMS rating");}
   return {
     leg:i===0?"L1":"L2",realPowerW:x.p,reactiveVarSigned:x.q,
     fundamentalApparentVA:apparent,
     rmsApparentVA:limits.sinusoidalWaveformsConfirmed?apparent:null,
     possibleHarmonicDistortion:limits.sinusoidalWaveformsConfirmed?
       "confirmed_sinusoidal":"unknown"
   };
 });
 if(!limits.sinusoidalWaveformsConfirmed&&!fail)
   reasons.push("Harmonic/distortion VA remains unknown; fundamental apparent power alone cannot certify RMS current and VA limits");
 return {
   status:fail?"fail":limits.sinusoidalWaveformsConfirmed?
     "pass_sinusoidal_model":"indeterminate_harmonics",
   totalRealPowerW:loads.reduce((p,l)=>p+l.realPowerW,0),
   totalFundamentalReactiveVar:loads.reduce((q,l)=>q+l.reactiveVarSigned,0),
   legs,reasons,validation:"phasor_math_only_not_instrumented"
 };
}

/**
 * Battery electrical equivalent-circuit mathematics (1–N Thevenin RC pairs).
 *
 * Sources:
 * https://thevenin.readthedocs.io/stable/user_guide/model_description.html
 * https://samrepo.nlr.gov/help/battery_storage_btm.html
 *
 * Positive current DISCHARGES; negative current CHARGES:
 *   dSOC/dt = -I * (I>=0 ? 1 : eta_charge) / (3600 * capacityAh)
 *   dVpol_j/dt = I/C_j - Vpol_j/(R_j C_j)
 *   Vt = OCV(SOC) - I R0 - sum(Vpol_j)
 *
 * For constant I, R, C over interval dt, exact exponential substep:
 *   Vpol_j(dt) = I R_j + (Vpol_j(0)-I R_j) exp(-dt/(R_j C_j)).
 *
 * This mathematical kernel does NOT invent equipment OCV(SOC), RC parameters,
 * hysteresis, or BMS thresholds. They must be published/fitted and passed in.
 * It DOES NOT update live simulator state or approve a physical battery.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export interface OcvKnot {readonly soc:number;readonly openCircuitVoltageV:number}
export interface RcPair {readonly resistanceOhm:number;readonly capacitanceF:number}
export interface BatteryEcmParameters {
 readonly capacityAh:number;
 readonly ohmicResistanceOhm:number;
 readonly coulombicChargingEfficiency:number;
 readonly ocvCurve:readonly OcvKnot[];
 readonly polarizationPairs:readonly RcPair[];
}
export interface BatteryEcmState{
 readonly soc:number;
 readonly polarizationVoltagesV:readonly number[];
}
export interface BatteryEcmStep{
 readonly status:"completed"|"lower_soc_boundary"|"upper_soc_boundary";
 readonly completedSeconds:number;
 readonly remainingRequestedSeconds:number;
 readonly endState:BatteryEcmState;
 readonly initialTerminalVoltageV:number;
 readonly terminalVoltageAtEndV:number;
 readonly initialOpenCircuitVoltageV:number;
 readonly finalOpenCircuitVoltageV:number;
 readonly deliveredTerminalPowerAtEndW:number;
 readonly ohmicHeatAtEndW:number;
 readonly polarizationStatesExactForConstantCurrent:true;
 readonly modelEvidence:"published_thevenin_equations_parameter_values_caller_supplied";
}
function curveCheck(p:Readonly<BatteryEcmParameters>):void {
 if(!(finite("capacityAh",p.capacityAh)>0))
   throw new ModelFailure("INVALID_INPUT","Positive battery Ah needed");
 nonnegative("ohmicResistanceOhm",p.ohmicResistanceOhm);
 const eta=finite("coulombicChargingEfficiency",p.coulombicChargingEfficiency);
 if(eta<=0||eta>1)
   throw new ModelFailure("INVALID_INPUT","Coulombic efficiency must be within (0,1]");
 if(p.ocvCurve.length<2)
   throw new ModelFailure("INVALID_INPUT","OCV curve requires at least two genuine voltage/SoC points");
 for(let i=0;i<p.ocvCurve.length;i++){
   const x=p.ocvCurve[i];
   const z=finite("ocv soc",x.soc),v=finite("ocv voltage",x.openCircuitVoltageV);
   if(z<0||z>1||v<=0)
     throw new ModelFailure("INVALID_INPUT","Invalid OCV SOC/voltage sample");
   if(i>0&&z<=p.ocvCurve[i-1].soc)
     throw new ModelFailure("INVALID_INPUT","OCV SoC knots must be strictly increasing");
 }
 for(const pair of p.polarizationPairs){
   if(!(finite("polarization resistance",pair.resistanceOhm)>0)||
      !(finite("polarization capacitance",pair.capacitanceF)>0))
     throw new ModelFailure("INVALID_INPUT","RC pair R and C must exceed zero");
 }
}
export function batteryOcvAt(
 curve:readonly OcvKnot[],soc:number
):number{
 const z=finite("SOC",soc);
 if(curve.length<2||z<curve[0].soc-1e-12||z>curve[curve.length-1].soc+1e-12)
   throw new ModelFailure("INVALID_INPUT","SOC outside published OCV curve; extrapolation not allowed");
 for(let i=1;i<curve.length;i++){
   const a=curve[i-1],b=curve[i];
   if(z<=b.soc){
     return a.openCircuitVoltageV+
       (b.openCircuitVoltageV-a.openCircuitVoltageV)*
       (z-a.soc)/(b.soc-a.soc);
   }
 }
 return curve[curve.length-1].openCircuitVoltageV;
}
export function advanceBatteryEcm(
 p:Readonly<BatteryEcmParameters>,state:Readonly<BatteryEcmState>,
 signedCurrentA:number,requestedSeconds:number
):BatteryEcmStep{
 curveCheck(p);
 const i=finite("signedCurrentA",signedCurrentA);
 const dt=finite("requestedSeconds",requestedSeconds);
 if(dt<=0||dt>86400)
   throw new ModelFailure("INVALID_INPUT","Battery step duration must lie within (0,86400]");
 const z=finite("initial SOC",state.soc);
 if(state.polarizationVoltagesV.length!==p.polarizationPairs.length)
   throw new ModelFailure("INVALID_INPUT","RC state dimension does not match model");
 const min=p.ocvCurve[0].soc,max=p.ocvCurve[p.ocvCurve.length-1].soc;
 if(z<min||z>max)
   throw new ModelFailure("INVALID_INPUT","Battery SOC outside source curve domain");
 const states=state.polarizationVoltagesV.map((v,k)=>
   finite("RC initial voltage "+k,v));
 const dzdt=-i*(i<0?p.coulombicChargingEfficiency:1)/(3600*p.capacityAh);
 const desiredZ=z+dzdt*dt;
 let used=dt;
 let status:BatteryEcmStep["status"]="completed";
 if(dzdt<0&&desiredZ<min){
   used=(min-z)/dzdt;status="lower_soc_boundary";
 }else if(dzdt>0&&desiredZ>max){
   used=(max-z)/dzdt;status="upper_soc_boundary";
 }
 used=Math.max(0,Math.min(dt,used));
 const endZ=Math.max(min,Math.min(max,z+dzdt*used));
 const initialOcv=batteryOcvAt(p.ocvCurve,z);
 const finalOcv=batteryOcvAt(p.ocvCurve,endZ);
 const polarEnd=p.polarizationPairs.map((pair,k)=>{
   const target=i*pair.resistanceOhm;
   // -expm1(-x) is stable when x is small.
   const fraction=-Math.expm1(-used/(pair.resistanceOhm*pair.capacitanceF));
   return states[k]+(target-states[k])*fraction;
 });
 const initialTerminal=initialOcv-i*p.ohmicResistanceOhm-
   states.reduce((a,b)=>a+b,0);
 const finalTerminal=finalOcv-i*p.ohmicResistanceOhm-
   polarEnd.reduce((a,b)=>a+b,0);
 if(!Number.isFinite(initialTerminal)||!Number.isFinite(finalTerminal)||
   initialTerminal<=0||finalTerminal<=0)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "Battery terminal voltage nonpositive under requested fixed current; current limit/voltage compatibility must be handled separately");
 return {
   status,completedSeconds:used,remainingRequestedSeconds:dt-used,
   endState:{soc:endZ,polarizationVoltagesV:polarEnd},
   initialTerminalVoltageV:initialTerminal,
   terminalVoltageAtEndV:finalTerminal,
   initialOpenCircuitVoltageV:initialOcv,
   finalOpenCircuitVoltageV:finalOcv,
   deliveredTerminalPowerAtEndW:i*finalTerminal,
   ohmicHeatAtEndW:i*i*p.ohmicResistanceOhm,
   polarizationStatesExactForConstantCurrent:true,
   modelEvidence:"published_thevenin_equations_parameter_values_caller_supplied"
 };
}

/**
 * Measured-point conversion and generator curve MATHEMATICS.
 *
 * Build a device-specific curve from separately verified observations. The
 * compiler cannot verify the instrument, firmware, logging timestamps,
 * temperature, calibration certificates, or identity of the measured part:
 * the caller is responsible for those, including held-out validation.
 *
 * No extrapolation outside the measured input domain. No invention of an
 * appliance/generator curve from published peak efficiency or two endpoints.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";

export interface InverterOperatingObservation {
 readonly acRealOutputW:number;
 readonly dcInputW:number;
}
export interface InverterDcPrediction {
 readonly acRealOutputW:number;
 readonly predictedDcInputW:number;
 readonly predictedConversionLossW:number;
 readonly predictedEfficiency:number|null;
 readonly domain:"interpolated_measured_domain_only";
 readonly validation:"numerical_fit_not_verified_instrumentation";
}
export interface InverterDcCurve {
 readonly observations:readonly InverterOperatingObservation[];
 readonly minimumAcW:number;
 readonly maximumAcW:number;
 readonly includedIdleObservation:boolean;
 /** Data flag only. A real device may show mode-dependent nonmonotonic values. */
 readonly observedDcDrawMonotone:boolean;
 readonly status:"numerical_fit_not_verified_instrumentation";
}
/** Positive output is AC delivered, positive input is DC supplied.
 * An idle reading at zero output contributes to the measured loss; it is NOT
 * added again to a measured-input curve (avoids double-counting idle losses).
 */
export function makeInverterDcCurve(
 observations:readonly InverterOperatingObservation[]
):InverterDcCurve{
 if(observations.length<2)throw new ModelFailure("INVALID_INPUT",
   "Inverter curve requires at least two distinct independent operating points");
 const rows=observations.map((o,i)=>{
   const ac=nonnegative("AC output W["+i+"]",o.acRealOutputW);
   const dc=nonnegative("DC input W["+i+"]",o.dcInputW);
   if(dc+1e-10<ac)throw new ModelFailure("PHYSICAL_INFEASIBILITY",
      "Inverter output power cannot exceed its input power in a steady conversion snapshot");
   return {acRealOutputW:ac,dcInputW:dc};
 }).sort((a,b)=>a.acRealOutputW-b.acRealOutputW);
 let monotone=true;
 for(let i=1;i<rows.length;i++){
   if(rows[i].acRealOutputW<=rows[i-1].acRealOutputW)
     throw new ModelFailure("INVALID_INPUT","Inverter AC load knots must be distinct");
   // A lower measured DC draw at greater AC output is unusual but not a
   // thermodynamic impossibility: the converter may change operating mode.
   // Do not destroy legitimate field observations to force a preferred shape.
   if(rows[i].dcInputW<rows[i-1].dcInputW)monotone=false;
 }
 return {
   observations:rows.map(x=>Object.freeze(x)),
   minimumAcW:rows[0].acRealOutputW,maximumAcW:rows[rows.length-1].acRealOutputW,
   includedIdleObservation:rows[0].acRealOutputW===0,
   observedDcDrawMonotone:monotone,
   status:"numerical_fit_not_verified_instrumentation"
 };
}
export function interpolateInverterDcInput(
 curve:Readonly<InverterDcCurve>,acOutputW:number
):InverterDcPrediction {
 const p=nonnegative("acOutputW",acOutputW);
 const v=piecewiseLinear(curve.observations,p,"acRealOutputW","dcInputW");
 const loss=v-p;
 if(loss < -1e-9*Math.max(1,p))
   throw new ModelFailure("PHYSICAL_INFEASIBILITY","Interpolated inverter power violates energy conservation");
 return {acRealOutputW:p,predictedDcInputW:v,predictedConversionLossW:Math.max(0,loss),
   predictedEfficiency:v>0?p/v:null,
   domain:"interpolated_measured_domain_only",
   validation:"numerical_fit_not_verified_instrumentation"};
}

export interface GeneratorOperatingObservation {
 readonly deliveredAcRealW:number;
 /** Sustained RUNNING fuel draw, not generator-off or hot/cooldown consumption. */
 readonly measuredGallonsPerHour:number;
}
export interface GeneratorRateCurve {
 readonly observations:readonly GeneratorOperatingObservation[];
 readonly minimumLoadW:number;
 readonly maximumLoadW:number;
 readonly observedFuelRateMonotone:boolean;
 readonly status:"numerical_fit_not_verified_instrumentation";
}
/** No assumption that fuel burn at zero load vanishes: running-idle fuel
 * consumption may be positive. The separate generator state machine must
 * consume zero fuel when the engine is stopped.
 */
export function makeGeneratorFuelCurve(
 observations:readonly GeneratorOperatingObservation[]
):GeneratorRateCurve{
 if(observations.length<2)throw new ModelFailure("INVALID_INPUT",
    "Fuel-rate curve requires at least two distinct steady operating points");
 const rows=observations.map((x,i)=>({
   deliveredAcRealW:nonnegative("generator output W["+i+"]",x.deliveredAcRealW),
   measuredGallonsPerHour:nonnegative("generator gph["+i+"]",x.measuredGallonsPerHour)
 })).sort((a,b)=>a.deliveredAcRealW-b.deliveredAcRealW);
 let monotone=true;
 for(let i=1;i<rows.length;i++){
   if(rows[i].deliveredAcRealW<=rows[i-1].deliveredAcRealW)
     throw new ModelFailure("INVALID_INPUT","Generator power knots must be distinct");
   // Distinct operating modes (e.g. ECO-throttle) can violate monotonicity.
   // Record the anomaly without mislabelling measured data 'impossible physics'.
   if(rows[i].measuredGallonsPerHour<rows[i-1].measuredGallonsPerHour)monotone=false;
 }
 return {observations:rows.map(x=>Object.freeze(x)),minimumLoadW:rows[0].deliveredAcRealW,
   maximumLoadW:rows[rows.length-1].deliveredAcRealW,
   observedFuelRateMonotone:monotone,
   status:"numerical_fit_not_verified_instrumentation"};
}
export function interpolateGeneratorFuelRate(
 curve:Readonly<GeneratorRateCurve>,loadW:number
):{loadW:number;gallonsPerHour:number;gallonsOverSeconds:(dtSeconds:number)=>number;
   domain:"interpolated_measured_domain_only"} {
 const p=nonnegative("generator loadW",loadW);
 const rate=piecewiseLinear(curve.observations,p,"deliveredAcRealW","measuredGallonsPerHour");
 return {loadW:p,gallonsPerHour:rate,
   gallonsOverSeconds:(dt:number)=>{
     if(!(finite("durationSeconds",dt)>=0))
       throw new ModelFailure("INVALID_INPUT","Negative generator runtime");
     return rate*dt/3600;
   },domain:"interpolated_measured_domain_only"};
}
function piecewiseLinear<T extends Record<K|V,number>,K extends string,V extends string>(
 rows:readonly T[],x:number,xKey:K,yKey:V
):number {
 if(rows.length<2)throw new ModelFailure("INVALID_INPUT","Unfitted or empty calibration curve");
 const min=rows[0][xKey],max=rows[rows.length-1][xKey];
 if(x<min-1e-10*Math.max(1,Math.abs(min))||
    x>max+1e-10*Math.max(1,Math.abs(max)))
   throw new ModelFailure("INVALID_INPUT",
      "Prediction outside measured calibration domain; extrapolation is not authorized");
 // Clamp floating point at an exact measurement endpoint only.
 const px=Math.min(max,Math.max(min,x));
 for(let i=1;i<rows.length;i++){
   const a=rows[i-1],b=rows[i];
   if(px<=b[xKey]){
     const t=(px-a[xKey])/(b[xKey]-a[xKey]);
     return a[yKey]+(b[yKey]-a[yKey])*t;
   }
 }
 return rows[rows.length-1][yKey];
}

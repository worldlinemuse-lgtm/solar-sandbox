/**
 * Temperature-reference slope calibration from a PUBLISHED external source.
 * This is NOT calibration to real deployed hardware or a validation outside
 * the supplied reference operating conditions.
 *
 * At G=1000 W/m² and Tref=25°C, fit the diode's effective I0(T) exponential
 * activation parameter E_eff so a central numerical derivative matches the
 * separately reported dVoc/dT. Keep the physically motivated bandgap prior
 * unchanged; E_eff is an inverse-model parameter, NOT silicon's true bandgap.
 *
 * Also check dPmp/dT from the SAME fitted diode curve against the independent
 * published Pmp temperature coefficient. Matching only the fitted Voc slope
 * is insufficient to claim full temperature-model calibration.
 *
 * PVsyst 6.80 LONGi 435 report (20 February 2020):
 * https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf
 * muVoc = -144 mV/C, muIsc = +6.7 mA/C, muPmax = -0.34%/C.
 *
 * The more general PVsyst irradiance model also permits Rsh(G) variation;
 * this simplified reference retains constant Rsh and is NOT full PVsyst.
 */
import {ModelFailure,finite} from "./contracts";
import {singleDiodeMpp} from "./pv-diode";
import type {SingleDiodeReference} from "./pv-diode";

export interface PublishedPvThermalAnchors {
 readonly referenceIrradianceWm2:number;
 readonly referenceCellTemperatureC:number;
 /** Published absolute open-circuit-voltage slope in V per C. */
 readonly vocSlopeVPerC:number;
 /** Published relative max-power slope in fraction per C (not percentage). */
 readonly maxPowerCoefficientPerC:number;
 readonly sourceUrl:string;
}
export interface PvThermalSlopeAssessment {
 readonly fittedReference:SingleDiodeReference;
 readonly effectiveThermalActivationEV:number;
 readonly originalVocSlopeVPerC:number;
 readonly fittedVocSlopeVPerC:number;
 readonly originalMaxPowerCoefficientPerC:number;
 readonly fittedMaxPowerCoefficientPerC:number;
 readonly publishedVocSlopeVPerC:number;
 readonly publishedMaxPowerCoefficientPerC:number;
 readonly residualVocSlopeVPerC:number;
 readonly residualMaxPowerCoefficientPerC:number;
 readonly evidence:"fitted_to_published_reference_slope_not_instrumented_hardware";
 readonly unresolvedAssumptions:readonly string[];
}
const STEP_C=0.25;
function slopes(x:Readonly<SingleDiodeReference>,g:number,t:number):
  {voc:number;pmax:number}{
 const lo=singleDiodeMpp(x,g,t-STEP_C);
 const hi=singleDiodeMpp(x,g,t+STEP_C);
 const mid=singleDiodeMpp(x,g,t);
 if(mid.maxPowerW<=0)throw new ModelFailure("PHYSICAL_INFEASIBILITY",
   "Published reference point must have nonzero max power");
 return {
  voc:(hi.openCircuitVoltageV-lo.openCircuitVoltageV)/(2*STEP_C),
  pmax:(hi.maxPowerW-lo.maxPowerW)/(2*STEP_C*mid.maxPowerW)
 };
}
export function fitPublishedPvThermalSlope(
 reference:Readonly<SingleDiodeReference>,anchors:Readonly<PublishedPvThermalAnchors>
):PvThermalSlopeAssessment{
 const g=finite("referenceIrradianceWm2",anchors.referenceIrradianceWm2);
 const t=finite("referenceCellTemperatureC",anchors.referenceCellTemperatureC);
 const vocPublished=finite("vocSlopeVPerC",anchors.vocSlopeVPerC);
 const pmpPublished=finite("maxPowerCoefficientPerC",anchors.maxPowerCoefficientPerC);
 if(!(g>0)||!(t> -273.15+STEP_C)||!anchors.sourceUrl)
   throw new ModelFailure("INVALID_INPUT","Published thermal reference requires valid illuminated STC conditions and source URL");
 if(!(pmpPublished>-1&&pmpPublished<1))
   throw new ModelFailure("INVALID_INPUT","Thermal Pmp temperature coefficient outside meaningful fractional units");
 // The baseline is explicit, not overwritten to make a benchmark appear passed.
 const original=slopes(reference,g,t);
 const at=(effective:number)=>{
   const updated={...reference,effectiveThermalActivationEV:effective};
   return slopes(updated,g,t);
 };
 // Bracket thermal activation in a physically moderate positive numerical
 // domain. Do not extrapolate an unconstrained effective activation arbitrarily.
 let left=0.5,right=2.0;
 let low=at(left).voc-vocPublished,high=at(right).voc-vocPublished;
 if(!Number.isFinite(low)||!Number.isFinite(high)||low*high>0)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "Published Voc slope cannot be matched within the declared effective thermal activation domain");
 for(let k=0;k<52;k++){
   const m=(left+right)/2,err=at(m).voc-vocPublished;
   if(err*low>0){left=m;low=err;}else{right=m;high=err;}
 }
 const fitted=(left+right)/2;
 const calibrated={...reference,effectiveThermalActivationEV:fitted};
 const result=slopes(calibrated,g,t);
 return {
   fittedReference:calibrated,effectiveThermalActivationEV:fitted,
   originalVocSlopeVPerC:original.voc,fittedVocSlopeVPerC:result.voc,
   originalMaxPowerCoefficientPerC:original.pmax,
   fittedMaxPowerCoefficientPerC:result.pmax,
   publishedVocSlopeVPerC:vocPublished,
   publishedMaxPowerCoefficientPerC:pmpPublished,
   residualVocSlopeVPerC:result.voc-vocPublished,
   residualMaxPowerCoefficientPerC:result.pmax-pmpPublished,
   evidence:"fitted_to_published_reference_slope_not_instrumented_hardware",
   unresolvedAssumptions:[
     "One published Voc temperature derivative fitted; no temperature-stratified measured I-V curves",
     "Isc coefficient must come from the SAME published reference variant",
     "Temperature-dependent Rs, Rsh, diode ideality and bifacial operation not calibrated",
     "Effective thermal activation is an inverse-model coefficient, not the silicon material bandgap",
     "Source PDF's Pmax slope is a separate validation check, not an exact fitting constraint"
   ]
 };
}
export const LONGI_PVSYST_2020_THERMAL_ANCHORS:Readonly<PublishedPvThermalAnchors>={
 referenceIrradianceWm2:1000,
 referenceCellTemperatureC:25,
 vocSlopeVPerC:-0.144,
 maxPowerCoefficientPerC:-0.0034,
 sourceUrl:"https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf"
};

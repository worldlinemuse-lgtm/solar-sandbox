/**
 * Independent DC product-design voltage/current ENVELOPE equations.
 *
 * STC maker coefficients bound operating conditions only within their validated
 * domains. A current timestep's Voc is not the coldest-design Voc.
 * Missing design conditions NEVER produce an equipment compatibility approval.
 *
 * Reference: Victron SmartSolar 150/70 VE.Can technical specifications:
 * https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html
 * Absolute input 150 V at coldest conditions; 145 V start/operate; 50 A Isc.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";

export interface PvDesignNameplate {
 readonly vocStcV:number;
 readonly iscStcA:number;
 /** Fraction per degree C; e.g. -0.00284 / C, NOT -0.284. */
 readonly vocTemperatureCoefficientPerC:number;
 readonly iscTemperatureCoefficientPerC:number;
}
export interface PvDesignTopology {
 readonly modulesInSeries:number;
 readonly stringsInParallel:number;
}
export interface PvDesignEnvironment {
 /** The cell temperature used for *design extreme*, not the current weather step. */
 readonly minimumDesignCellTemperatureC:number|null;
 readonly maximumDesignCellTemperatureC:number|null;
 /** Array-effective irradiance INCLUDING any quantified bifacial rear contribution. */
 readonly maximumDesignEffectiveIrradianceWm2:number|null;
 /** Documented multiplicative Voc uplift for irradiance > 1000 W/m2, if verified.
  * A fabricated 'safety factor' must not silently be treated as measurement. */
 readonly maximumIrradianceVocFactor?:number|null;
}
export interface PvControllerDesignLimits {
 readonly absoluteMaximumInputVoltageV:number;
 readonly startupOperatingMaximumInputVoltageV:number;
 readonly maximumPvShortCircuitCurrentA:number;
}
export interface PvDesignAssessment {
 readonly status:"pass_checked_envelope"|"fail"|"indeterminate";
 readonly designColdOpenCircuitVoltageV:number|null;
 readonly designMaximumShortCircuitCurrentA:number|null;
 readonly absoluteVoltageMarginV:number|null;
 readonly operatingVoltageMarginV:number|null;
 readonly shortCircuitCurrentMarginA:number|null;
 readonly reasons:readonly string[];
 readonly equationIds:readonly string[];
 readonly evidence:"manufacturer_stc_coefficients_and_explicit_design_extremes_not_installation_approval";
}

const requirePositive=(name:string,v:number):number=>{
 if(!(finite(name,v)>0))throw new ModelFailure("INVALID_INPUT",name+" must exceed zero");
 return v;
};
const validateTemp=(name:string,t:number|null):number|null=>{
 if(t===null)return null;
 const v=finite(name,t);
 if(v<=-273.15)throw new ModelFailure("INVALID_INPUT",name+" below absolute zero");
 return v;
};
/** Conservative STC-based design check; no claim of regulatory approval.
 * Voc/irradiance changes above STC are UNKNOWN absent validated correction.
 * If a limit is exceeded from known inputs, that failure overrides missing data.
 */
export function assessPvColdDesign(
 m:Readonly<PvDesignNameplate>,top:Readonly<PvDesignTopology>,
 env:Readonly<PvDesignEnvironment>,lim:Readonly<PvControllerDesignLimits>
):PvDesignAssessment{
 requirePositive("vocStcV",m.vocStcV);
 requirePositive("iscStcA",m.iscStcA);
 const beta=finite("vocTemperatureCoefficientPerC",m.vocTemperatureCoefficientPerC);
 const alpha=finite("iscTemperatureCoefficientPerC",m.iscTemperatureCoefficientPerC);
 if(!Number.isSafeInteger(top.modulesInSeries)||top.modulesInSeries<1||
    !Number.isSafeInteger(top.stringsInParallel)||top.stringsInParallel<1)
   throw new ModelFailure("INVALID_INPUT","Positive integer PV series/parallel counts required");
 const absolute=requirePositive("absoluteMaximumInputVoltageV",lim.absoluteMaximumInputVoltageV);
 const operating=requirePositive("startupOperatingMaximumInputVoltageV",lim.startupOperatingMaximumInputVoltageV);
 const maxIsc=requirePositive("maximumPvShortCircuitCurrentA",lim.maximumPvShortCircuitCurrentA);
 if(operating>absolute)
   throw new ModelFailure("INVALID_INPUT","Operating maximum cannot exceed absolute maximum");
 const low=validateTemp("minimumDesignCellTemperatureC",env.minimumDesignCellTemperatureC);
 const high=validateTemp("maximumDesignCellTemperatureC",env.maximumDesignCellTemperatureC);
 if(low!==null&&high!==null&&low>high)
   throw new ModelFailure("INVALID_INPUT","Minimum design temperature exceeds maximum");
 const g=env.maximumDesignEffectiveIrradianceWm2===null?null:
   nonnegative("maximumDesignEffectiveIrradianceWm2",env.maximumDesignEffectiveIrradianceWm2);
 const factor=env.maximumIrradianceVocFactor??null;
 if(factor!==null&&!(finite("maximumIrradianceVocFactor",factor)>=1))
   throw new ModelFailure("INVALID_INPUT","A Voc upper-bound factor must be >= 1");
 const reasons:string[]=[];
 // beta<0 -> colder cell produces higher Voc; beta>0 -> hotter cell does.
 const extremeVocT=beta<=0?low:high;
 const extremeIscT=alpha>=0?high:low;
 let voc:number|null=null,isc:number|null=null;
 let missing=false;
 if(extremeVocT===null){
   missing=true;reasons.push("Design-extreme cell temperature for Voc was not provided");
 } else {
   const scale=1+beta*(extremeVocT-25);
   if(scale<=0)throw new ModelFailure("PHYSICAL_INFEASIBILITY",
      "STC Voc temperature linearization outside valid domain");
   voc=top.modulesInSeries*m.vocStcV*scale;
   if(g!==null&&g>1000){
     if(factor===null){
       missing=true;
       reasons.push("Above-STC design irradiance requires a validated Voc uplift; published temperature coefficient alone cannot certify a pass");
     }else voc*=factor;
   }
 }
 if(extremeIscT===null||g===null){
   missing=true;reasons.push("Maximum design irradiance and extreme cell temperature for Isc are required");
 } else {
   const scale=1+alpha*(extremeIscT-25);
   if(scale<0)throw new ModelFailure("PHYSICAL_INFEASIBILITY",
      "STC Isc temperature linearization outside valid domain");
   isc=top.stringsInParallel*m.iscStcA*(g/1000)*scale;
 }
 const absMargin=voc===null?null:absolute-voc;
 const opMargin=voc===null?null:operating-voc;
 const iscMargin=isc===null?null:maxIsc-isc;
 const eps=1e-9;
 if(absMargin!==null&&absMargin < -eps)reasons.push("Coldest-design string Voc exceeds absolute controller limit");
 if(opMargin!==null&&opMargin < -eps)reasons.push("Design string Voc exceeds controller startup/operating ceiling");
 if(iscMargin!==null&&iscMargin < -eps)reasons.push("Design parallel-string Isc exceeds controller PV short-circuit rating");
 const fail=[absMargin,opMargin,iscMargin].some(v=>v!==null&&v < -eps);
 if(!fail&&!missing)reasons.push("Calculated reference conditions lie within these three published ratings; other installation constraints remain unverified");
 return {
   status:fail?"fail":missing?"indeterminate":"pass_checked_envelope",
   designColdOpenCircuitVoltageV:voc,
   designMaximumShortCircuitCurrentA:isc,
   absoluteVoltageMarginV:absMargin,operatingVoltageMarginV:opMargin,
   shortCircuitCurrentMarginA:iscMargin,reasons,
   equationIds:["PV_DESIGN_VOC_STC_BETA_V1","PV_DESIGN_ISC_STC_ALPHA_G_V1"],
   evidence:"manufacturer_stc_coefficients_and_explicit_design_extremes_not_installation_approval"
 };
}

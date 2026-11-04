/**
 * Victron MultiPlus-II 120 V temperature-dependent published output ratings.
 *
 * CRITICAL SOURCE-UNIT DISTINCTION, verified in official Victron table:
 * 24/3000/70-50: 25/40/65C real W = 2400/2200/1700, 3000 VA nominal.
 * 24/5000/120-95: 25/40/65C values = 4000/3700/3000 **VA**,
 * NOT watts; 5000 VA nominal. The published operating temperature range
 * for 5 kVA is -40 to +60C, despite a 65C derating anchor.
 *
 * Do not silently convert those 5k values to real watts. Without a
 * separately established real-W rating, 5k reference can establish a
 * VA-limit failure, but not certify the requested real-W output as passing.
 *
 * Manufacturer source:
 * https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html
 *
 * Linear interpolation is an ESTIMATE. Next-hotter published anchor checks
 * assume nonincreasing capability with increasing ambient temperature.
 * Neither establishes actual thermal behavior or electrical code approval.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";

export interface InverterThermalAnchor {
 readonly ambientTemperatureC:number;
 readonly continuousRating:number;
}
export interface InverterThermalReference {
 readonly id:string;
 readonly ratedQuantityUnit:"W"|"VA";
 readonly publishedAtC:readonly InverterThermalAnchor[];
 readonly maximumPublishedOperatingTemperatureC:number;
 readonly nominalApparentVA:number;
 readonly sourceUrl:string;
}
export type InverterThermalStatus=
 "rated_reference_estimate"|"exceeds_conservative_envelope"|
 "indeterminate_temperature"|"indeterminate_real_power";
export interface InverterThermalResult {
 readonly status:InverterThermalStatus;
 readonly requestedRealW:number;
 readonly requestedApparentVA:number;
 readonly estimatedContinuousW:number|null;
 readonly conservativeNextHotterAnchorW:number|null;
 readonly estimatedContinuousVA:number|null;
 readonly conservativeNextHotterAnchorVA:number|null;
 readonly permittedNominalVA:number;
 readonly sourceId:string;
 readonly sourceRatedUnit:"W"|"VA";
 readonly reasons:readonly string[];
 readonly validation:"published_discrete_temperatures_plus_assumed_interpolation_not_certified";
}
const SOURCE="https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html";

export const VICTRON_3KVA_120V_THERMAL:Readonly<InverterThermalReference>={
 id:"MultiPlus-II_120V_24-3000_thermal_2026",
 ratedQuantityUnit:"W",
 publishedAtC:[{ambientTemperatureC:25,continuousRating:2400},
  {ambientTemperatureC:40,continuousRating:2200},
  {ambientTemperatureC:65,continuousRating:1700}],
 maximumPublishedOperatingTemperatureC:65,
 nominalApparentVA:3000,
 sourceUrl:SOURCE
};
export const VICTRON_5KVA_120V_THERMAL:Readonly<InverterThermalReference>={
 id:"MultiPlus-II_120V_24-5000_thermal_2026",
 ratedQuantityUnit:"VA",
 publishedAtC:[{ambientTemperatureC:25,continuousRating:4000},
  {ambientTemperatureC:40,continuousRating:3700},
  {ambientTemperatureC:65,continuousRating:3000}],
 maximumPublishedOperatingTemperatureC:60,
 nominalApparentVA:5000,
 sourceUrl:SOURCE
};
export function assessInverterThermalCapacity(
 reference:Readonly<InverterThermalReference>,ambientC:number,
 requestW:number,requestVA:number
):InverterThermalResult{
 const t=finite("inverter ambientC",ambientC);
 const p=nonnegative("requestedRealW",requestW);
 const s=nonnegative("requestedApparentVA",requestVA);
 if(t<=-273.15||!reference.id||!reference.sourceUrl||p>s+1e-9)
   throw new ModelFailure("INVALID_INPUT",
     "Inverter reference or ambient invalid; real watts cannot exceed apparent VA");
 if(reference.ratedQuantityUnit!=="W"&&reference.ratedQuantityUnit!=="VA")
   throw new ModelFailure("INVALID_INPUT","Published rating unit must be W or VA");
 const ratedVA=nonnegative("nominalApparentVA",reference.nominalApparentVA);
 const upper=finite("maximumPublishedOperatingTemperatureC",
   reference.maximumPublishedOperatingTemperatureC);
 const rows=reference.publishedAtC;
 if(rows.length<2)throw new ModelFailure("INVALID_INPUT",
   "At least two sourced temperature anchors required");
 for(let i=0;i<rows.length;i++){
   finite("published temperature",rows[i].ambientTemperatureC);
   nonnegative("published continuous "+reference.ratedQuantityUnit,
     rows[i].continuousRating);
   if(i>0&&(rows[i].ambientTemperatureC<=rows[i-1].ambientTemperatureC||
       rows[i].continuousRating>rows[i-1].continuousRating))
     throw new ModelFailure("INVALID_INPUT",
       "Inverter thermal anchors must have rising temperatures and nonincreasing ratings");
 }
 const reasons:string[]=[];
 const nominalVAExceeded=s>ratedVA+1e-9;
 if(nominalVAExceeded)
   reasons.push("Requested VA exceeds manufacturer's nominal VA ceiling");
 const invalidTemperature=t<rows[0].ambientTemperatureC||
   t>rows[rows.length-1].ambientTemperatureC||t>upper;
 const report=(status:InverterThermalStatus,interpolated:number|null,
   hotter:number|null):InverterThermalResult=>({
     status,requestedRealW:p,requestedApparentVA:s,
     estimatedContinuousW:reference.ratedQuantityUnit==="W"?interpolated:null,
     conservativeNextHotterAnchorW:reference.ratedQuantityUnit==="W"?hotter:null,
     estimatedContinuousVA:reference.ratedQuantityUnit==="VA"?interpolated:null,
     conservativeNextHotterAnchorVA:reference.ratedQuantityUnit==="VA"?hotter:null,
     permittedNominalVA:ratedVA,sourceId:reference.id,
     sourceRatedUnit:reference.ratedQuantityUnit,
     reasons,validation:"published_discrete_temperatures_plus_assumed_interpolation_not_certified"
 });
 if(invalidTemperature){
   reasons.push("Ambient temperature is outside available reference/operating domain; no extrapolation");
   return report(nominalVAExceeded?"exceeds_conservative_envelope":
     "indeterminate_temperature",null,null);
 }
 let hot=rows[rows.length-1],estimate=hot.continuousRating;
 if(t<=rows[0].ambientTemperatureC){
   hot=rows[0];estimate=hot.continuousRating;
 }else for(let i=1;i<rows.length;i++){
   if(t<=rows[i].ambientTemperatureC){
     const low=rows[i-1];hot=rows[i];
     const frac=(t-low.ambientTemperatureC)/
       (hot.ambientTemperatureC-low.ambientTemperatureC);
     estimate=low.continuousRating+
       (hot.continuousRating-low.continuousRating)*frac;
     break;
   }
 }
 if(reference.ratedQuantityUnit==="W"){
   if(p>hot.continuousRating+1e-9)
     reasons.push("Requested real W exceeds next-hotter published real-W reference anchor");
   if(s>ratedVA+1e-9||p>hot.continuousRating+1e-9)
     return report("exceeds_conservative_envelope",estimate,hot.continuousRating);
   reasons.push("Within published-W reference envelope only; no empirical waveform/thermal certification");
   return report("rated_reference_estimate",estimate,hot.continuousRating);
 }
 // The 5k table is apparent VA. DO NOT claim this establishes continuous real W.
 if(s>hot.continuousRating+1e-9||nominalVAExceeded){
   reasons.push("Requested VA exceeds next-hotter published apparent-VA anchor");
   return report("exceeds_conservative_envelope",estimate,hot.continuousRating);
 }
 reasons.push("Published thermal anchor is VA, not W; cannot establish real-W capacity from this table");
 return report("indeterminate_real_power",estimate,hot.continuousRating);
}

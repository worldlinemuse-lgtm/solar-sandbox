/**
 * Published ambient-temperature continuous output derating, NOT a fixed
 * 25°C rating applied to hot operating cabinets.
 *
 * Manufacturer gives discrete steady-state power points. Linear interpolation
 * between them is a *scenario estimate*, not a verified guaranteed rating.
 * A separate conservative step envelope uses the next hotter published
 * operating anchor as a bound, under explicit monotone-derating assumption.
 * No cold (<minimum) or over-temperature (>maximum) extrapolation is allowed.
 *
 * Victron MultiPlus-II 120V:
 * https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html
 * 3 kVA: 2400W @25C, 2200W @40C, 1700W @65C; 3000VA @25C.
 * 5 kVA: 4000W @25C, 3700W @40C, 3000W @65C; 5000VA @25C.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export interface InverterThermalAnchor {readonly ambientTemperatureC:number;readonly continuousW:number}
export interface InverterThermalReference {
 readonly id:string;
 readonly publishedAtC:readonly InverterThermalAnchor[];
 /** Datasheet VA rating, never treated as W. */
 readonly nominalApparentVA:number;
 readonly sourceUrl:string;
}
export interface InverterThermalResult {
 readonly status:"rated_reference_estimate"|"exceeds_conservative_envelope"|"indeterminate_temperature";
 readonly requestedRealW:number;
 readonly requestedApparentVA:number;
 readonly estimatedContinuousW:number|null;
 readonly conservativeNextHotterAnchorW:number|null;
 readonly permittedNominalVA:number;
 readonly sourceId:string;
 readonly validation:"published_discrete_temperatures_plus_assumed_interpolation_not_certified";
 readonly reasons:readonly string[];
}
export const VICTRON_3KVA_120V_THERMAL:Readonly<InverterThermalReference>={
 id:"MultiPlus-II_120V_24-3000_thermal_2026",
 publishedAtC:[{ambientTemperatureC:25,continuousW:2400},
  {ambientTemperatureC:40,continuousW:2200},
  {ambientTemperatureC:65,continuousW:1700}],
 nominalApparentVA:3000,
 sourceUrl:"https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html"
};
export const VICTRON_5KVA_120V_THERMAL:Readonly<InverterThermalReference>={
 id:"MultiPlus-II_120V_24-5000_thermal_2026",
 publishedAtC:[{ambientTemperatureC:25,continuousW:4000},
  {ambientTemperatureC:40,continuousW:3700},
  {ambientTemperatureC:65,continuousW:3000}],
 nominalApparentVA:5000,
 sourceUrl:"https://www.victronenergy.com/media/pg/MultiPlus-II_120V/en/technical-specifications-mp-ii-120v.html"
};
export function assessInverterThermalCapacity(
 reference:Readonly<InverterThermalReference>,ambientC:number,
 requestW:number,requestVA:number
):InverterThermalResult{
 const temperature=finite("inverter ambientC",ambientC);
 const power=nonnegative("requestedRealW",requestW);
 const apparent=nonnegative("requestedApparentVA",requestVA);
 if(temperature<=-273.15||!reference.id||!reference.sourceUrl)
   throw new ModelFailure("INVALID_INPUT","Inverter ambient temperature or source reference invalid");
 const va=nonnegative("nominalApparentVA",reference.nominalApparentVA);
 const rows=reference.publishedAtC;
 if(rows.length<2)throw new ModelFailure("INVALID_INPUT","At least two published temperature points required");
 for(let i=0;i<rows.length;i++){
   finite("published temperature",rows[i].ambientTemperatureC);
   nonnegative("published continuous W",rows[i].continuousW);
   if(i>0&&(rows[i].ambientTemperatureC<=rows[i-1].ambientTemperatureC||
       rows[i].continuousW>rows[i-1].continuousW))
     throw new ModelFailure("INVALID_INPUT",
       "Inverter thermal anchors must be sorted by rising temperature and nonincreasing rated W");
 }
 const reasons:string[]=[];
 if(apparent>va+1e-9)reasons.push("Requested VA exceeds published 25C nominal VA rating");
 if(temperature<rows[0].ambientTemperatureC||temperature>rows[rows.length-1].ambientTemperatureC){
   reasons.push("Temperature outside independently published continuous-power reference points; do not extrapolate");
   return {status:"indeterminate_temperature",requestedRealW:power,
     requestedApparentVA:apparent,estimatedContinuousW:null,
     conservativeNextHotterAnchorW:null,permittedNominalVA:va,
     sourceId:reference.id,validation:"published_discrete_temperatures_plus_assumed_interpolation_not_certified",
     reasons};
 }
 let hot=rows[rows.length-1],estimate=hot.continuousW;
 if(temperature<=rows[0].ambientTemperatureC){hot=rows[0];estimate=hot.continuousW;}
 else for(let i=1;i<rows.length;i++){
   if(temperature<=rows[i].ambientTemperatureC){
     const low=rows[i-1];hot=rows[i];
     const frac=(temperature-low.ambientTemperatureC)/
       (hot.ambientTemperatureC-low.ambientTemperatureC);
     estimate=low.continuousW+(hot.continuousW-low.continuousW)*frac;
     break;
   }
 }
 const violates=power>hot.continuousW+1e-9||apparent>va+1e-9;
 if(power>hot.continuousW+1e-9)
   reasons.push("Real W demand exceeds the next-hotter published continuous-power anchor");
 if(!violates)
   reasons.push("Within next-hotter-anchor arithmetic only; no field temperature, waveform, surge or full equipment verification");
 return {status:violates?"exceeds_conservative_envelope":"rated_reference_estimate",
   requestedRealW:power,requestedApparentVA:apparent,
   estimatedContinuousW:estimate,conservativeNextHotterAnchorW:hot.continuousW,
   permittedNominalVA:va,sourceId:reference.id,
   validation:"published_discrete_temperatures_plus_assumed_interpolation_not_certified",
   reasons};
}

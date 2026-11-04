/**
 * Explicit manufacturer-published independent product reference inputs.
 *
 * Data in this module are FACTUAL product specs and two-point anchors,
 * not synthetic default curves or operating measurements we performed.
 * Product revisions must be matched to the exact installed hardware.
 *
 * Honda EU2200i: https://powerequipment.honda.com/generators/models/EU2200i/
 * Battle Born BB10012:
 * https://battlebornbatteries.com/wp-content/uploads/2022/10/100Ah-12V-Standard-Battery-Manual_Rev032_1.29.26.pdf
 * Victron SmartSolar 150/70:
 * https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html
 *
 * No explicit original manual for a specific user's device has been checked.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";

export const HONDA_EU2200I_PUBLISHED=Object.freeze({
 id:"Honda EU2200i EU2200ITAN",
 outputVoltageV:120,ratedContinuousW:1800,maximumW:2200,
 fuelTankUSGallons:0.95,
 ratedLoadHoursPerTank:3.2,
 quarterLoadHoursPerTank:8.1,
 fuelRateReference:[
  {loadW:1800/4,gallonsPerHour:.95/8.1},
  {loadW:1800,gallonsPerHour:.95/3.2}
 ],
 sourceUrl:"https://powerequipment.honda.com/generators/models/EU2200i/",
 dataTier:"manufacturer_public_specification_two_points_only"
});
export const BATTLE_BORN_BB10012_PUBLISHED=Object.freeze({
 id:"Battle Born BB10012 12V 100Ah 2026 revised manual",
 nominalCapacityAh:100,
 publishedInternalResistanceOhm:0.007,
 maxContinuousDischargeA:100,
 dischargeSurgeA:200,
 dischargeSurgeDurationSeconds:30,
 recommendedChargingCurrentA:50,
 minimumChargeTemperatureC:-35/9, // 25°F => -3.888...°C
 maximumChargeTemperatureC:55, // 131°F; manual also has mixed 135°F text
 minimumDischargeTemperatureC:-20,
 sourceUrl:"https://battlebornbatteries.com/wp-content/uploads/2022/10/100Ah-12V-Standard-Battery-Manual_Rev032_1.29.26.pdf",
 dataTier:"manufacturer_published_limits_not_soc_voltage_curve"
});
export interface HondaFuelEstimate{
 readonly status:"within_published_load_anchor_range"|"below_published_range"|"above_published_range";
 readonly fuelGallonsPerHour:number|null;
 readonly runtimeHoursForTank:number|null;
 readonly basis:"linear_interpolation_of_two_published_runtime_anchors";
}
/** Only 25%-100% continuous rated load is supported by the two Honda points.
 * Honda has NOT published a no-load/idle GPH at this reference URL.
 * Never claim 1/4-load fuel rate is the measured idle fuel rate.
 */
export function estimateHondaFuelGph(loadW:number):HondaFuelEstimate{
 const w=nonnegative("Honda delivered AC loadW",loadW);
 const rated=HONDA_EU2200I_PUBLISHED.ratedContinuousW;
 const lo=rated/4;
 const make=(status:HondaFuelEstimate["status"],gph:number|null)=>({
  status,fuelGallonsPerHour:gph,
  runtimeHoursForTank:gph===null?null:HONDA_EU2200I_PUBLISHED.fuelTankUSGallons/gph,
  basis:"linear_interpolation_of_two_published_runtime_anchors" as const
 });
 if(w<lo)return make("below_published_range",null);
 if(w>rated)return make("above_published_range",null);
 const a=HONDA_EU2200I_PUBLISHED.fuelRateReference[0];
 const b=HONDA_EU2200I_PUBLISHED.fuelRateReference[1];
 const t=(w-a.loadW)/(b.loadW-a.loadW);
 return make("within_published_load_anchor_range",
   a.gallonsPerHour+(b.gallonsPerHour-a.gallonsPerHour)*t);
}

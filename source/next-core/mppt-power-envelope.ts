/**
 * Product-independent upper bound for MPPT DC/DC conversion.
 *
 * Manufacturer "98% peak efficiency" is an UPPER BOUND, not a uniform
 * operating efficiency at night, cold/hot, low irradiance or curtailed load.
 *
 * Pout_actual <= min(Pin_available * eta_peak, Icharge_max * Vcharge).
 *
 * Input "available" is PV source/controller-port power under explicit
 * operating constraints; the controller may CURTAIL upstream extraction.
 * Thus potential Pin - this output bound is NOT automatically device heat.
 *
 * Source example: Victron SmartSolar MPPT 150/70 VE.Can, peak 98%,
 * 70 A battery output, 24 V nominal PV input power listing 2000 W (a
 * nominal array guideline, NOT a 2000 W hard instantaneous input ceiling).
 * https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export interface MpptPowerEnvelopeInput{
 readonly availableControllerInputPowerW:number;
 readonly batteryChargeVoltageV:number;
 readonly ratedMaximumBatteryChargeCurrentA:number;
 readonly publishedPeakConversionEfficiency:number;
 readonly nominalArrayReferenceW:number|null;
}
export interface MpptPowerEnvelope{
 readonly dcOutputMaximumPossibleW:number;
 readonly dcChargeCurrentUpperBoundA:number;
 readonly conversionEfficiencyIsPeakOnly:true;
 readonly controllerPowerOrCurrentLimited:"peak_efficiency"|"battery_current"|"both";
 readonly nominalArrayOversizeFactor:number|null;
 readonly nominalArrayReferenceIsHardInputLimit:false;
 readonly validation:"upper_power_bound_not_actual_mppt_tracking_or_energy_yield";
}
export function boundMpptDcPower(
 x:Readonly<MpptPowerEnvelopeInput>
):MpptPowerEnvelope{
 const available=nonnegative("availableControllerInputPowerW",x.availableControllerInputPowerW);
 const v=finite("batteryChargeVoltageV",x.batteryChargeVoltageV);
 const maxI=nonnegative("ratedMaximumBatteryChargeCurrentA",
   x.ratedMaximumBatteryChargeCurrentA);
 const eta=finite("publishedPeakConversionEfficiency",
   x.publishedPeakConversionEfficiency);
 if(v<=0||eta<=0||eta>1)
   throw new ModelFailure("INVALID_INPUT",
     "MPPT output voltage and efficiency must lie in physical ranges");
 const nominal=x.nominalArrayReferenceW===null?null:
   finite("nominalArrayReferenceW",x.nominalArrayReferenceW);
 if(nominal!==null&&nominal<=0)
   throw new ModelFailure("INVALID_INPUT","Nominal PV reference must be positive");
 const fromEfficiency=available*eta;
 const fromCurrent=maxI*v;
 const bound=Math.min(fromEfficiency,fromCurrent);
 const diff=fromEfficiency-fromCurrent;
 const scale=Math.max(1,fromEfficiency,fromCurrent);
 const type=Math.abs(diff)<=1e-10*scale?"both":
   diff<0?"peak_efficiency":"battery_current";
 return {
   dcOutputMaximumPossibleW:bound,
   dcChargeCurrentUpperBoundA:bound/v,
   conversionEfficiencyIsPeakOnly:true,
   controllerPowerOrCurrentLimited:type,
   nominalArrayOversizeFactor:nominal===null?null:available/nominal,
   nominalArrayReferenceIsHardInputLimit:false,
   validation:"upper_power_bound_not_actual_mppt_tracking_or_energy_yield"
 };
}

/**
 * Temperature-dependent metallic conductor resistance and Joule heating.
 *
 * R(T) = R_ref [1 + alpha_ref (T - T_ref)]
 * ΔV = I R(T); P_wire = I² R(T); E_Wh = P_wire * seconds / 3600.
 *
 * IMPORTANT: temperature refers to CONDUCTOR temperature, NOT ambient air,
 * PV cell temperature or inverter internal temperature. Loop resistance must
 * include BOTH outgoing and returning conductors in an ordinary two-wire
 * circuit. Connector/contact resistance is additional, independently measured.
 *
 * NIST/NBS copper standard annealed 100% IACS:
 * alpha_20 = 0.00393 /°C at 20 °C.
 * https://nvlpubs.nist.gov/nistpubs/Legacy/circ/nbscircular31e3.pdf
 *
 * Other conductor alloys, contacts, busbars and AC frequencies require their
 * own sourced material data. Temperature correction does NOT certify ampacity
 * or NEC compliance. This is reference-only and leaves the active engine alone.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export const NIST_ANNEALED_COPPER_ALPHA_20_PER_C=0.00393;
export interface TemperatureWireInput {
 readonly loopResistanceAtReferenceOhm:number;
 readonly referenceTemperatureC:number;
 readonly conductorTemperatureC:number;
 /** Must match the supplied reference temperature and material. */
 readonly temperatureCoefficientAtReferencePerC:number;
 readonly currentA:number;
 readonly intervalSeconds:number;
}
export interface TemperatureWireResult {
 readonly correctedLoopResistanceOhm:number;
 readonly voltageDropV:number;
 readonly powerLossW:number;
 readonly heatWh:number;
 readonly resistanceMultiplier:number;
 readonly validation:"linear_conductor_temperature_reference_only";
}
export function conductorTemperatureLoss(
 x:Readonly<TemperatureWireInput>
):TemperatureWireResult {
 const rr=nonnegative("loopResistanceAtReferenceOhm",x.loopResistanceAtReferenceOhm);
 const tr=finite("referenceTemperatureC",x.referenceTemperatureC);
 const tc=finite("conductorTemperatureC",x.conductorTemperatureC);
 const alpha=nonnegative("temperatureCoefficientAtReferencePerC",
   x.temperatureCoefficientAtReferencePerC);
 const current=finite("currentA",x.currentA);
 const dt=nonnegative("intervalSeconds",x.intervalSeconds);
 if(tr<=-273.15||tc<=-273.15)
   throw new ModelFailure("INVALID_INPUT","Nonphysical conductor temperature");
 const factor=1+alpha*(tc-tr);
 if(factor<=0)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "Linear metallic resistance correction outside valid temperature domain");
 const rt=rr*factor;
 const drop=current*rt;
 const power=current*current*rt;
 return {
   correctedLoopResistanceOhm:rt,voltageDropV:drop,
   powerLossW:power,heatWh:power*dt/3600,
   resistanceMultiplier:factor,
   validation:"linear_conductor_temperature_reference_only"
 };
}

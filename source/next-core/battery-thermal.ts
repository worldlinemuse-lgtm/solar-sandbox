/**
 * Exact solution of a one-node RC battery thermal balance over a constant interval:
 * C*dT/dt = I^2 R + heaterW - (T - ambient)/Rth.
 * C and Rth are REQUIRED measured/scenario parameters, never universal constants.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export interface ThermalParameters {
  readonly heatCapacityJPerK:number;
  readonly thermalResistanceKPerW:number;
  readonly parameterEvidence:"measured"|"scenario_assumed";
}
export interface ThermalState {readonly batteryTemperatureC:number}
export interface ThermalPoint {
  readonly ambientTemperatureC:number;
  readonly batteryCurrentA:number;
  readonly batteryInternalResistanceOhm:number;
  readonly heaterPowerW:number;
}
export interface ThermalAdvance {
  readonly nextTemperatureC:number;
  readonly averageTemperatureC:number;
  readonly internalHeatW:number;
  readonly heatingPowerW:number;
  readonly thermalTimeConstantSeconds:number;
  readonly validation:"single_node_constant_input_R_C";
}
export function advanceBatteryThermal(p:Readonly<ThermalParameters>,s:Readonly<ThermalState>,
  x:Readonly<ThermalPoint>,dtSeconds:number):ThermalAdvance {
  if(!(finite("heatCapacityJPerK",p.heatCapacityJPerK)>0))
    throw new ModelFailure("INVALID_INPUT","Heat capacity must be positive");
  if(!(finite("thermalResistanceKPerW",p.thermalResistanceKPerW)>0))
    throw new ModelFailure("INVALID_INPUT","Thermal resistance must be positive");
  finite("batteryTemperatureC",s.batteryTemperatureC);
  finite("ambientTemperatureC",x.ambientTemperatureC);
  finite("batteryCurrentA",x.batteryCurrentA);
  nonnegative("batteryInternalResistanceOhm",x.batteryInternalResistanceOhm);
  nonnegative("heaterPowerW",x.heaterPowerW);
  if(!(finite("dtSeconds",dtSeconds)>0))
    throw new ModelFailure("INVALID_INPUT","Thermal interval must be positive");
  const heat=x.batteryCurrentA*x.batteryCurrentA*x.batteryInternalResistanceOhm;
  const power=heat+x.heaterPowerW;
  const tau=p.heatCapacityJPerK*p.thermalResistanceKPerW;
  const tEq=x.ambientTemperatureC+power*p.thermalResistanceKPerW;
  const decay=Math.exp(-dtSeconds/tau);
  const next=tEq+(s.batteryTemperatureC-tEq)*decay;
  const average=tEq+(s.batteryTemperatureC-tEq)*(-Math.expm1(-dtSeconds/tau))*tau/dtSeconds;
  return {nextTemperatureC:next,averageTemperatureC:average,
    internalHeatW:heat,heatingPowerW:x.heaterPowerW,
    thermalTimeConstantSeconds:tau,
    validation:"single_node_constant_input_R_C"};
}

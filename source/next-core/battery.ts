import {ModelFailure,inRange,finite,nonnegative} from "./contracts";
import {terminalCurrentA,assertPowerBalance} from "./numerical";

export interface BatteryElectricalSpec {
  readonly capacityAh:number;
  readonly openCircuitVoltageV:number;
  readonly internalResistanceOhm:number;
  readonly maximumChargeCurrentA:number;
  readonly maximumDischargeCurrentA:number;
  readonly minimumTerminalVoltageV:number;
  readonly maximumTerminalVoltageV:number;
  readonly coulombicChargeEfficiency:number;
  readonly socFloor:number;
  readonly socCeiling:number;
}
export interface BatteryElectricalState {
  readonly soc:number;
  readonly chargeConnected:boolean;
  readonly dischargeConnected:boolean;
}
export interface BatteryStep {
  readonly currentA:number;
  readonly terminalVoltageV:number;
  readonly terminalPowerW:number;
  readonly batteryInternalHeatW:number;
  readonly chemicalPowerW:number;
  readonly coulombicChargeLossW:number;
  readonly supportedSeconds:number;
  readonly nextSoc:number;
  readonly boundaryReached:boolean;
  readonly chemicalBalanceResidualW:number;
}

/** Positive P discharges. Negative P charges. Boundary times split exactly.
 * OCV and R are a single-point proxy, not a validated temperature/SoC lookup.
 */
export function integrateBatteryElectrical(
  p:Readonly<BatteryElectricalSpec>,s:Readonly<BatteryElectricalState>,
  terminalPowerW:number,dtSec:number
):BatteryStep {
  if(!(finite("capacityAh",p.capacityAh)>0))throw new ModelFailure("INVALID_INPUT","Battery Ah must be positive");
  if(!(finite("openCircuitVoltageV",p.openCircuitVoltageV)>0))throw new ModelFailure("INVALID_INPUT","OCV must be positive");
  nonnegative("resistance",p.internalResistanceOhm);
  nonnegative("maximumChargeCurrentA",p.maximumChargeCurrentA);
  nonnegative("maximumDischargeCurrentA",p.maximumDischargeCurrentA);
  inRange("charge coulombic efficiency",p.coulombicChargeEfficiency,0.000001,1);
  inRange("socFloor",p.socFloor,0,1);
  inRange("socCeiling",p.socCeiling,p.socFloor,1);
  inRange("soc",s.soc,p.socFloor,p.socCeiling);
  if(!(finite("dtSec",dtSec)>0&&dtSec<=86400))
    throw new ModelFailure("INVALID_INPUT","Time interval must lie in (0,86400] seconds");
  finite("terminalPowerW",terminalPowerW);
  if(terminalPowerW>0&&!s.dischargeConnected)
    throw new ModelFailure("BMS_DISCONNECTED","Discharge port is unavailable");
  if(terminalPowerW<0&&!s.chargeConnected)
    throw new ModelFailure("BMS_DISCONNECTED","Charge port is unavailable");
  const current=terminalCurrentA(p.openCircuitVoltageV,p.internalResistanceOhm,terminalPowerW);
  if(current>p.maximumDischargeCurrentA+1e-9)
    throw new ModelFailure("CURRENT_LIMIT","Discharge current exceeds published/modelled maximum");
  if(-current>p.maximumChargeCurrentA+1e-9)
    throw new ModelFailure("CURRENT_LIMIT","Charge current exceeds published/modelled maximum");
  const terminalV=p.openCircuitVoltageV-current*p.internalResistanceOhm;
  if(terminalV<p.minimumTerminalVoltageV-1e-9 || terminalV>p.maximumTerminalVoltageV+1e-9)
    throw new ModelFailure("VOLTAGE_LIMIT","Battery terminal voltage outside permitted bounds");
  const effectiveA=current<0?current*p.coulombicChargeEfficiency:current;
  const ahHeadroom=effectiveA>0 ? (s.soc-p.socFloor)*p.capacityAh:
    effectiveA<0?(p.socCeiling-s.soc)*p.capacityAh:Infinity;
  const toBoundary=effectiveA===0?Infinity:Math.max(0,3600*ahHeadroom/Math.abs(effectiveA));
  const seconds=Math.min(dtSec,toBoundary);
  const nextSoc=inRange("new battery SOC",s.soc-effectiveA*seconds/(3600*p.capacityAh),
    Math.max(0,p.socFloor-1e-10),Math.min(1,p.socCeiling+1e-10));
  const heat=current*current*p.internalResistanceOhm;
  const chemical=p.openCircuitVoltageV*current;
  const coulombicLoss=current<0?(-chemical)*(1-p.coulombicChargeEfficiency):0;
  const residual=assertPowerBalance("Battery terminals", [chemical],[terminalPowerW,heat]);
  return {
    currentA:current,terminalVoltageV:terminalV,terminalPowerW,
    batteryInternalHeatW:heat,chemicalPowerW:chemical,
    coulombicChargeLossW:coulombicLoss,supportedSeconds:seconds,
    nextSoc:Math.max(p.socFloor,Math.min(p.socCeiling,nextSoc)),
    boundaryReached:seconds<dtSec-1e-10,chemicalBalanceResidualW:residual
  };
}

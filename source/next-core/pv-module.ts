import {ModelFailure,finite,inRange,nonnegative} from "./contracts";
export interface PvModuleSpec {
  readonly id:string;
  readonly pStcW:number;
  readonly vmpStcV:number;
  readonly vocStcV:number;
  readonly iscStcA:number;
  readonly powerTempCoefficientPerC:number;
  readonly vocTempCoefficientPerC:number;
  readonly iscTempCoefficientPerC:number;
  readonly sourceReference:string;
}
export interface ArrayArrangement {readonly series:number;readonly parallel:number}
export interface PvEnvironmentalPoint {
  readonly effectiveIrradianceWm2:number;
  readonly cellTemperatureC:number;
  readonly shadeFraction:number;
  readonly snowCoveredFraction:number;
  readonly additionalLossFraction:number;
}
export interface PvModuleSnapshot {
  readonly availablePowerW:number;
  readonly seriesVmpV:number;
  readonly seriesVocV:number;
  readonly totalShortCircuitA:number;
  readonly stcTotalPowerW:number;
  readonly status:"modelled_with_published_coefficients";
}
export interface ControllerVoltageConstraint {
 readonly absoluteMaxVocV:number;
 readonly operatingMaxVocV:number;
 readonly maxInputIscA:number;
}
export function makePvModuleSnapshot(m:Readonly<PvModuleSpec>,a:Readonly<ArrayArrangement>,
  env:Readonly<PvEnvironmentalPoint>):PvModuleSnapshot {
  for(const n of ["pStcW","vmpStcV","vocStcV","iscStcA"] as const){
    if(!(finite(n,m[n])>0))throw new ModelFailure("INVALID_INPUT",n+" must be >0");
  }
  if(!Number.isInteger(a.series)||a.series<1||!Number.isInteger(a.parallel)||a.parallel<1)
    throw new ModelFailure("INVALID_INPUT","Array strings and panel count must be positive integers");
  nonnegative("effectiveIrradianceWm2",env.effectiveIrradianceWm2);
  finite("cellTemperatureC",env.cellTemperatureC);
  inRange("shadeFraction",env.shadeFraction,0,1);
  inRange("snowCoveredFraction",env.snowCoveredFraction,0,1);
  inRange("additionalLossFraction",env.additionalLossFraction,0,1);
  finite("powerTempCoefficientPerC",m.powerTempCoefficientPerC);
  finite("vocTempCoefficientPerC",m.vocTempCoefficientPerC);
  finite("iscTempCoefficientPerC",m.iscTempCoefficientPerC);
  const d=env.cellTemperatureC-25;
  const powerFactor=Math.max(0,1+m.powerTempCoefficientPerC*d);
  const vocFactor=1+m.vocTempCoefficientPerC*d;
  const iscFactor=1+m.iscTempCoefficientPerC*d;
  if(vocFactor<=0||iscFactor<=0)
    throw new ModelFailure("PHYSICAL_INFEASIBILITY","Linear PV temperature model is outside its valid range");
  const pTotal=a.series*a.parallel*m.pStcW;
  const available=pTotal*env.effectiveIrradianceWm2/1000*
    powerFactor*(1-env.shadeFraction)*(1-env.snowCoveredFraction)*
    (1-env.additionalLossFraction);
  // Vmp temperature slope is inferred from d(P=V*I):
  // gammaVmp ~= gammaPmax - alphaIsc, a provisional approximation.
  const vmpFactor=1+(m.powerTempCoefficientPerC-m.iscTempCoefficientPerC)*d;
  if(vmpFactor<=0)
    throw new ModelFailure("PHYSICAL_INFEASIBILITY","PV voltage linearization invalid");
  // Photocurrent/Isc is proportional to effective irradiance in the linear
  // STC reference approximation. At zero sunlight, there is no I_sc or V_oc.
  // At nonzero irradiance, Voc is still a temperature-adjusted STC proxy:
  // an actual diode curve must supply the logarithmic irradiance dependence.
  const illuminated=env.effectiveIrradianceWm2>0;
  // The fixed-Vmp reference solver still needs a positive *reference* voltage
  // at zero sunlight; it multiplies by 0 W and cannot infer an energized port.
  return {availablePowerW:available,seriesVmpV:a.series*m.vmpStcV*vmpFactor,
    seriesVocV:illuminated?a.series*m.vocStcV*vocFactor:0,
    totalShortCircuitA:a.parallel*m.iscStcA*
      (env.effectiveIrradianceWm2/1000)*iscFactor,
    stcTotalPowerW:pTotal,status:"modelled_with_published_coefficients"};
}
/** Instantaneous modeled snapshot comparison ONLY. For a design's coldest Voc and
 * maximum irradiance/current, use assessPvColdDesign, with explicit design extremes.
 * This function does NOT establish compatibility of an installation. */
export function checkControllerLimits(s:PvModuleSnapshot,limit:Readonly<ControllerVoltageConstraint>):
  {status:"pass"|"fail";reasons:string[]} {
  const reasons:string[]=[];
  if(s.seriesVocV>limit.absoluteMaxVocV+1e-9)reasons.push("Absolute PV Voc limit exceeded");
  if(s.seriesVocV>limit.operatingMaxVocV+1e-9)reasons.push("PV operating voltage limit exceeded");
  if(s.totalShortCircuitA>limit.maxInputIscA+1e-9)reasons.push("PV short-circuit current limit exceeded");
  return {status:reasons.length?"fail":"pass",reasons};
}

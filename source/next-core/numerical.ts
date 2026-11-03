import {ModelFailure, finite, nonnegative} from "./contracts";

/** Small-magnitude root of R I^2 - V I + P = 0, stable as R -> 0.
 * For a battery P=Vterminal*I, Vterminal=Voc-R*I; current is positive on discharge.
 * A negative discriminant is an impossible load, never silently clipped.
 */
export function terminalCurrentA(openV: number, internalOhm: number, terminalW: number): number {
  if (!(finite("openV",openV)>0)) throw new ModelFailure("INVALID_INPUT", "openV must be positive");
  nonnegative("internalOhm",internalOhm); finite("terminalW",terminalW);
  if (internalOhm===0) return terminalW/openV;
  const discriminant=openV*openV-4*internalOhm*terminalW;
  if (discriminant < 0) throw new ModelFailure("PHYSICAL_INFEASIBILITY","Terminal load exceeds maximum available electrical power");
  return 2*terminalW/(openV+Math.sqrt(discriminant));
}

/** Current delivering P to a remote bus through positive R: P=I*Vbus+I^2*R.
 * Stable quadratic solution, exact for R=0.
 */
export function deliveryCurrentA(busV: number, loopOhm: number, sourcePowerW: number): number {
  if (!(finite("busV",busV)>0)) throw new ModelFailure("INVALID_INPUT","busV must be positive");
  nonnegative("loopOhm",loopOhm);nonnegative("sourcePowerW",sourcePowerW);
  return 2*sourcePowerW/(busV+Math.sqrt(busV*busV+4*loopOhm*sourcePowerW));
}

/** Lower-current solution to P = I*V - R*I^2.
 * Used for PV source wiring at a fixed Vmp approximation (not a full I-V curve).
 */
export function extractionCurrentA(sourceV: number, loopOhm: number, acceptedPowerW: number): number {
  if (!(finite("sourceV",sourceV)>0)) throw new ModelFailure("INVALID_INPUT","sourceV must be positive");
  nonnegative("loopOhm",loopOhm);nonnegative("acceptedPowerW",acceptedPowerW);
  const disc=sourceV*sourceV-4*loopOhm*acceptedPowerW;
  if (disc < -1e-9*Math.max(1,sourceV*sourceV)) {
    throw new ModelFailure("PHYSICAL_INFEASIBILITY","PV cable cannot deliver requested power");
  }
  return 2*acceptedPowerW/(sourceV+Math.sqrt(Math.max(0,disc)));
}

export function powerResidualW(inputsW: readonly number[], outputsW: readonly number[]): number {
  return inputsW.reduce((s,p)=>s+finite("input power",p),0)-
    outputsW.reduce((s,p)=>s+finite("output power",p),0);
}
export function assertPowerBalance(label:string, inW:readonly number[], outW:readonly number[]): number {
  const residual=powerResidualW(inW,outW);
  const scale=Math.max(1, ...inW.map(Math.abs),...outW.map(Math.abs));
  if(Math.abs(residual)>1e-9*scale)
    throw new ModelFailure("PHYSICAL_INFEASIBILITY",label+" energy imbalance "+residual+" W");
  return residual;
}

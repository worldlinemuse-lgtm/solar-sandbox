/**
 * Standalone model contracts. Numerical quantities are SI engineering magnitudes:
 * W, Wh, VA, A, V, ohm, seconds, degrees C, gallons. No implicit minute/hour conversions.
 * Physics and sources are distinct: passing math is NOT an instrument calibration.
 */
export type EvidenceTier = "R0_measured" | "R1_published" | "R2_derived" | "R3_assumed";
export type ValidationStatus = "physical_reference" | "published_reference" |
  "mathematical_only" | "estimated" | "indeterminate" | "unsupported";
export type ModelFailureCode =
  "NONFINITE" | "INVALID_INPUT" | "PHYSICAL_INFEASIBILITY" |
  "BMS_DISCONNECTED" | "CURRENT_LIMIT" | "VOLTAGE_LIMIT" |
  "SOC_BOUND" | "UNVERIFIED_SURGE" | "SOLVER_DID_NOT_CONVERGE";

export interface Evidence {
  readonly id: string;
  readonly sourceUrl: string | null;
  readonly revision: string | null;
  readonly tier: EvidenceTier;
  readonly status: ValidationStatus;
  readonly parameter: string;
  readonly unit: string;
  readonly min: number | null;
  readonly max: number | null;
}

export class ModelFailure extends Error {
  readonly code: ModelFailureCode;
  constructor(code: ModelFailureCode, message: string) {
    super(message);
    this.name = "ModelFailure";
    this.code = code;
  }
}

export function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new ModelFailure("NONFINITE", name + " is not finite");
  return value;
}
export function inRange(name: string, value: number, min: number, max: number): number {
  finite(name, value);
  if (value < min || value > max) {
    throw new ModelFailure("INVALID_INPUT", name + "=" + value + " outside [" + min + "," + max + "]");
  }
  return value;
}
export function nonnegative(name: string, value: number): number {
  finite(name, value);
  if (value < 0) throw new ModelFailure("INVALID_INPUT", name + " is negative");
  return value;
}
export function near(actual: number, expected: number, scale: number = 1): boolean {
  finite("actual", actual); finite("expected", expected);
  return Math.abs(actual - expected) <= Math.max(1e-9, 1e-9 * Math.abs(scale));
}

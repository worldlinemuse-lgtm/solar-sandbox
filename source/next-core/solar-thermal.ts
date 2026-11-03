/**
 * Sandia Array Performance Model module/cell temperature.
 * Source: Sandia PVPMC and pvlib TEMPERATURE_MODEL_PARAMETERS.
 * The distinct glass/cell/glass open-rack coefficients matter for LONGi dual glass.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export type SandiaMount =
  "open_rack_glass_glass"|"close_mount_glass_glass"|
  "open_rack_glass_polymer"|"insulated_back_glass_polymer";
export interface ThermalCoefficients {readonly a:number;readonly b:number;readonly deltaTC:number}
export const SANDIA_THERMAL:Readonly<Record<SandiaMount,ThermalCoefficients>>={
  open_rack_glass_glass:{a:-3.47,b:-0.0594,deltaTC:3},
  close_mount_glass_glass:{a:-2.98,b:-0.0471,deltaTC:1},
  open_rack_glass_polymer:{a:-3.56,b:-0.075,deltaTC:3},
  insulated_back_glass_polymer:{a:-2.81,b:-0.0455,deltaTC:0}
};
export function sandiaTemperature(
 irradianceWm2:number,airC:number,windMps:number,mount:SandiaMount
):{moduleC:number;cellC:number;coefficients:ThermalCoefficients}{
 nonnegative("POA irradiance",irradianceWm2);finite("airC",airC);
 nonnegative("wind speed",windMps);
 const c=SANDIA_THERMAL[mount];
 if(!c)throw new ModelFailure("INVALID_INPUT","Unsupported module construction/mount");
 const tm=airC+irradianceWm2*Math.exp(c.a+c.b*windMps);
 return {moduleC:tm,cellC:tm+irradianceWm2*c.deltaTC/1000,coefficients:c};
}

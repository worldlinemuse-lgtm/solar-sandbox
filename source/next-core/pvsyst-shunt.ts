import {ModelFailure,finite} from "./contracts";
/** Sandia PVPMC PVsyst irradiance-dependent Rsh model. Rsh0 must be sourced
 * separately; the published 2020 LONGi one-page PDF gives only Rsh_ref.
 * https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/pvsyst-module-model/
 */
export interface ShuntParameters{
 readonly irradianceWm2:number;
 readonly referenceIrradianceWm2:number;
 readonly rshReferenceOhm:number;
 readonly rshAtZeroIrradianceOhm:number;
 readonly decay:number;
}
export function pvsystShuntResistance(x:Readonly<ShuntParameters>):number{
 const g=finite("irradianceWm2",x.irradianceWm2);
 const gr=finite("referenceIrradianceWm2",x.referenceIrradianceWm2);
 const rr=finite("rshReferenceOhm",x.rshReferenceOhm);
 const r0=finite("rshAtZeroIrradianceOhm",x.rshAtZeroIrradianceOhm);
 const k=finite("decay",x.decay);
 if(g<0||gr<=0||rr<=0||r0<=0||k<=0)
   throw new ModelFailure("INVALID_INPUT","PVsyst shunt parameters must be physical");
 const expRef=Math.exp(-k);
 const rbase=(rr-r0*expRef)/(1-expRef);
 if(!(rbase>0)||!Number.isFinite(rbase))
   throw new ModelFailure("PHYSICAL_INFEASIBILITY","Nonpositive Rsh base");
 return rbase+(r0-rbase)*Math.exp(-k*g/gr);
}

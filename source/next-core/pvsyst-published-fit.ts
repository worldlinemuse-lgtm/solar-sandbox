/**
 * Inverse-calibration to existing PUBLISHED PVsyst 2020 curves.
 *
 * This is lawful/useful calibration of a mathematical reference using
 * real published manufacturer-derived modeling data. It does NOT assert
 * that the resulting Rsh0 was independently measured for any real panel.
 *
 * Train on 200 and 600 W/m2 Pmpp at 25 C; independently compare held-out
 * 400 and 800 W/m2 curves; use 1000 W/m2 STC as an identity check.
 * All five points are taken from the PDF below, with values in W.
 * https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf
 *
 * Sandia PVPMC supplies the functional form of Rsh(G), while the original
 * PDF only reports Rsh_ref(1000)=1000 ohms and NOT Rsh0.
 */
import {ModelFailure} from "./contracts";
import {LONGI_435_PVSYST,singleDiodeMpp} from "./pv-diode";
import type {SingleDiodeReference} from "./pv-diode";
export interface PublishedPowerPoint {
 readonly irradianceWm2:number;readonly powerW:number;
}
export const LONGI_PVSYST_POWER_2020={
 pdf:"https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf",
 temperatureC:25,
 stc:{irradianceWm2:1000,powerW:436.1},
 training:[
  {irradianceWm2:200,powerW:85.7},
  {irradianceWm2:600,powerW:263.2}
 ] as readonly PublishedPowerPoint[],
 heldOut:[
  {irradianceWm2:400,powerW:174.6},
  {irradianceWm2:800,powerW:350.6}
 ] as readonly PublishedPowerPoint[]
} as const;
export interface PublishedCurveFit {
 readonly calibratedReference:Readonly<SingleDiodeReference>;
 readonly fittedRshZeroOhm:number;
 readonly trainingRelativeRmse:number;
 readonly heldOutRelativeRmse:number;
 readonly stcRelativeError:number;
 readonly points:readonly {
  readonly irradianceWm2:number;readonly publishedPowerW:number;
  readonly predictedPowerW:number;readonly relativeError:number;
  readonly role:"fit"|"holdout"|"stc_check";
 }[];
 readonly evidence:"fit_to_published_pvsyst_mpp_points_not_hardware_measurements";
 readonly modelLimits:readonly string[];
}
/** Numerical one-dimensional fit of Rsh0 with the PVsyst-standard k=5.5.
 * This inverse problem is restricted to a physically admissible interval.
 * Other diode parameters and the original reference object stay unchanged.
 */
export function fitPublishedLongiPvsystRshZero():PublishedCurveFit{
 const base=LONGI_435_PVSYST;
 const rref=base.shuntResistanceOhm;
 const decay=5.5;
 const lo=rref,hi=200*rref;
 const test=(r0:number)=>({...base,shuntAtZeroIrradianceOhm:r0,
   shuntIrradianceDecay:decay});
 const evalPoint=(r0:number,p:PublishedPowerPoint)=>
    singleDiodeMpp(test(r0),p.irradianceWm2,
      LONGI_PVSYST_POWER_2020.temperatureC).maxPowerW;
 const objective=(r0:number)=>LONGI_PVSYST_POWER_2020.training
    .reduce((sum,p)=>sum+Math.pow((evalPoint(r0,p)-p.powerW)/p.powerW,2),0);
 let a=lo,b=hi;
 const k=(Math.sqrt(5)-1)/2;
 let c=b-k*(b-a),d=a+k*(b-a);
 let vc=objective(c),vd=objective(d);
 for(let i=0;i<48;i++){
   if(vc>vd){a=c;c=d;vc=vd;d=a+k*(b-a);vd=objective(d);}
   else{b=d;d=c;vd=vc;c=b-k*(b-a);vc=objective(c);}
 }
 const r0=(a+b)/2;
 if(r0<=lo*1.0001||r0>=hi*0.9999)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "PVsyst Rsh0 inverse fit pinned to search boundary; cannot identify parameter reliably");
 const fitted=test(r0);
 const point=(p:PublishedPowerPoint,role:"fit"|"holdout"|"stc_check")=>{
   const computed=singleDiodeMpp(fitted,p.irradianceWm2,25).maxPowerW;
   return {irradianceWm2:p.irradianceWm2,
     publishedPowerW:p.powerW,predictedPowerW:computed,
     relativeError:(computed-p.powerW)/p.powerW,role};
 };
 const points=[
   ...LONGI_PVSYST_POWER_2020.training.map(p=>point(p,"fit")),
   ...LONGI_PVSYST_POWER_2020.heldOut.map(p=>point(p,"holdout")),
   point(LONGI_PVSYST_POWER_2020.stc,"stc_check")
 ];
 const metric=(role:"fit"|"holdout")=>{
   const rows=points.filter(p=>p.role===role);
   return Math.sqrt(rows.reduce((s,p)=>s+p.relativeError**2,0)/rows.length);
 };
 return {
   calibratedReference:fitted,fittedRshZeroOhm:r0,
   trainingRelativeRmse:metric("fit"),
   heldOutRelativeRmse:metric("holdout"),
   stcRelativeError:points[4].relativeError,
   points,
   evidence:"fit_to_published_pvsyst_mpp_points_not_hardware_measurements",
   modelLimits:[
     "Fitted Rsh0 is an inverse-model parameter, not a published manufacturer measurement",
     "Only 25C irradiance curves were available; temperature-dependent shunt remains unverified",
     "Two fitted points and two independently held-out published points do not measure field performance",
     "Shadow and live production solvers are unchanged; use as diagnostic reference only"
   ]
 };
}

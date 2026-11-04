/**
 * Single-diode PV module reference using PVsyst published LR4-72HBD-435M
 * one-diode parameter set (2020), independently benchmarked at five irradiances.
 * Temperature/irradiance extrapolation requires model-specific measurements.
 *
 * Source: https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf
 * PVsyst V6.80 manufacturer-derived report, 20 Feb 2020.
 * STC: Isc=11.36 A, Voc=49.1 V, Rs=.27 ohm, Rsh=1000 ohm,
 * I0=.087 nA, gamma=1.04, effective series cell count=72.
 *
 * 144 half-cells are wired as 72 equivalent series cells. This assumption
 * must be checked against the exact module manufacturer wiring variant.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
const K_B=1.380649e-23;
const Q_E=1.602176634e-19;
export interface SingleDiodeReference {
  readonly id:string;
  readonly shortCircuitCurrentRefA:number;
  readonly idealityFactor:number;
  readonly equivalentCellsInSeries:number;
  readonly seriesResistanceOhm:number;
  readonly shuntResistanceOhm:number;
  readonly saturationCurrentRefA:number;
  readonly iscTemperatureCoeffPerC:number;
  readonly bandgapEV:number;
  readonly evidenceUrl:string;
}
export const LONGI_435_PVSYST:Readonly<SingleDiodeReference>={
 id:"LONGi_LR4-72HBD-435M_PVsyst2020",
 shortCircuitCurrentRefA:11.36,
 idealityFactor:1.04,
 equivalentCellsInSeries:72,
 seriesResistanceOhm:.27,
 shuntResistanceOhm:1000,
 saturationCurrentRefA:0.087e-9,
 iscTemperatureCoeffPerC:0.0005,
 bandgapEV:1.121, // Silicon bandgap approximation; R3 assumed for temperature extrapolation
 evidenceUrl:"https://greensun.ro/wp-content/uploads/2021/05/LR4_72HBD-435M-Glass_Glass_435W.pdf"
};
export interface SingleDiodeOperatingPoint {
  readonly irradianceWm2:number;
  readonly cellTemperatureC:number;
  readonly shortCircuitCurrentA:number;
  readonly openCircuitVoltageV:number;
  readonly maxPowerW:number;
  readonly maxPowerVoltageV:number;
  readonly maxPowerCurrentA:number;
  readonly converged:boolean;
  readonly evidence:"published_pvsyst_irradiance_curve_reference_temperature_extrapolation_estimated";
}

function diodeParams(x:SingleDiodeReference,g:number,tc:number) {
  nonnegative("irradianceWm2",g);finite("cellTemperatureC",tc);
  const tk=tc+273.15;
  if(!(tk>0))throw new ModelFailure("INVALID_INPUT","PV temperature must exceed absolute zero");
  for(const k of ["shortCircuitCurrentRefA","idealityFactor","equivalentCellsInSeries",
   "seriesResistanceOhm","shuntResistanceOhm","saturationCurrentRefA",
   "bandgapEV"] as const){
    if(!(finite(k,x[k])>0))throw new ModelFailure("INVALID_INPUT","PV diode parameter "+k+" must be positive");
  }
  finite("iscTemperatureCoeffPerC",x.iscTemperatureCoeffPerC);
  const ar=x.idealityFactor*x.equivalentCellsInSeries*K_B*298.15/Q_E;
  const i0r=x.saturationCurrentRefA;
  const ilr=x.shortCircuitCurrentRefA+
   i0r*Math.expm1(x.shortCircuitCurrentRefA*x.seriesResistanceOhm/ar)+
   x.shortCircuitCurrentRefA*x.seriesResistanceOhm/x.shuntResistanceOhm;
  const factor=1+x.iscTemperatureCoeffPerC*(tc-25);
  if(factor<0)throw new ModelFailure("PHYSICAL_INFEASIBILITY","PV photocurrent temperature extrapolation invalid");
  const il=ilr*g/1000*factor;
  const alpha=x.idealityFactor*x.equivalentCellsInSeries*K_B*tk/Q_E;
  // Silicon bandgap approximation, per-cell thermal dependence of dark saturation current.
  // This is an explicit R3 extrapolation, not published temperature-characterized IV data.
  const kEV=8.617333262145e-5;
  const exponent=x.bandgapEV/(x.idealityFactor*kEV)*(1/298.15-1/tk);
  const i0=i0r*Math.pow(tk/298.15,3)*Math.exp(exponent);
  return {il,alpha,i0,rs:x.seriesResistanceOhm,rsh:x.shuntResistanceOhm};
}
function diodeTerm(z:number):number{
 if(z>700) return Infinity;
 return Math.expm1(z);
}
function bisectRoot(f:(v:number)=>number,low:number,high:number,maxIter=64):number{
 const fl=f(low),fh=f(high);
 if(!Number.isFinite(fl)||!Number.isFinite(fh)||fl<0||fh>0)
  throw new ModelFailure("PHYSICAL_INFEASIBILITY","Diode root not bracketed");
 for(let n=0;n<maxIter;n++){
  const mid=(low+high)/2, fm=f(mid);
  if(fm>0)low=mid;else high=mid;
 }
 return (low+high)/2;
}
function currentAtVoltage(
 p:ReturnType<typeof diodeParams>,v:number
):number {
 if(v<0)throw new ModelFailure("INVALID_INPUT","PV module voltage below zero");
 if(p.il===0)return 0;
 const balance=(i:number)=>p.il-p.i0*diodeTerm((v+i*p.rs)/p.alpha)-
  (v+i*p.rs)/p.rsh-i;
 if(balance(0)<=0)return 0;
 return bisectRoot(balance,0,p.il+1);
}
export function singleDiodeMpp(
 r:Readonly<SingleDiodeReference>,g:number,cellC:number
):SingleDiodeOperatingPoint {
 const p=diodeParams(r,g,cellC);
 if(p.il===0)return {irradianceWm2:g,cellTemperatureC:cellC,
   shortCircuitCurrentA:0,openCircuitVoltageV:0,maxPowerW:0,
   maxPowerVoltageV:0,maxPowerCurrentA:0,converged:true,
   evidence:"published_pvsyst_irradiance_curve_reference_temperature_extrapolation_estimated"};
 const iSc=currentAtVoltage(p,0);
 const vOpen=bisectRoot((v)=>p.il-p.i0*diodeTerm(v/p.alpha)-v/p.rsh,
   0,Math.max(1,120*p.alpha));
 // Concave in typical crystalline-Si operating range: safeguarded golden-section search.
 let left=0,right=vOpen;
 const invPhi=(Math.sqrt(5)-1)/2;
 let a=right-invPhi*(right-left),b=left+invPhi*(right-left);
 let pa=a*currentAtVoltage(p,a),pb=b*currentAtVoltage(p,b);
 for(let n=0;n<60;n++){
   if(pa<pb){left=a;a=b;pa=pb;b=left+invPhi*(right-left);pb=b*currentAtVoltage(p,b);}
   else {right=b;b=a;pb=pa;a=right-invPhi*(right-left);pa=a*currentAtVoltage(p,a);}
 }
 const vm=(left+right)/2,im=currentAtVoltage(p,vm),pm=vm*im;
 if(!Number.isFinite(pm)||pm<0||pm>Math.max(1,g/1000)*r.shortCircuitCurrentRefA*vOpen*2)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY","Diode MPP outside expected power envelope");
 return {irradianceWm2:g,cellTemperatureC:cellC,
   shortCircuitCurrentA:iSc,openCircuitVoltageV:vOpen,
   maxPowerW:pm,maxPowerVoltageV:vm,maxPowerCurrentA:im,converged:true,
   evidence:"published_pvsyst_irradiance_curve_reference_temperature_extrapolation_estimated"};
}

/** A point on the parameterized SINGLE-DIODE I-V curve, before external wiring.
 * Not a sensor reading. This call allows an independent cable operating-point
 * maximizer to use the complete nonlinear source curve instead of fixed Vmp.
 */
export function diodeCurrentAtVoltage(
 r:Readonly<SingleDiodeReference>,g:number,cellC:number,moduleVoltageV:number
):number {
 nonnegative("moduleVoltageV",moduleVoltageV);
 const p=diodeParams(r,g,cellC);
 return currentAtVoltage(p,moduleVoltageV);
}

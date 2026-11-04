/**
 * Calibration MATHEMATICS; never invented physical observations.
 *
 * This module does not import catalog defaults, weather, timestamps, or product
 * names. Callers must furnish verified independent instrument records.
 * Synthetic fixtures exercise the algebra but do NOT upgrade evidence tier.
 *
 * Thevenin local battery approximation: V_terminal = V_OCV - I * R.
 * Fit is only valid near a stable SOC/temperature under specified pulse
 * conditions. True BMS, dynamic polarization, long-term aging and OCV curves
 * cannot be inferred from one local linear regression.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";

export interface CalibrationPair {
 readonly observed:number;
 readonly predicted:number;
 readonly standardUncertainty?:number|null;
}
export interface CalibrationResiduals {
 readonly sampleCount:number;
 /** Prediction minus measured; positive indicates systematic overprediction. */
 readonly bias:number;
 readonly mae:number;
 readonly rmse:number;
 readonly maximumAbsoluteError:number;
 /** Root mean square / RMS measured magnitude; null when reference RMS is zero. */
 readonly relativeRmsError:number|null;
 /** Sum abs errors / sum abs measured; null when denominator is zero. */
 readonly weightedAbsolutePercentageError:number|null;
 /** Chi-square, available only if ALL samples have positive uncertainty. */
 readonly chiSquare:number|null;
 readonly reducedChiSquare:number|null;
 readonly measurementUnits:"not_checked_by_this_numerical_kernel";
 readonly status:"math_only_measurement_provenance_not_verified";
}
export function calibrationResiduals(
 points:readonly CalibrationPair[],estimatedParameterCount=0
):CalibrationResiduals{
 if(points.length<1)throw new ModelFailure("INVALID_INPUT","Calibration requires at least one independent observation");
 if(!Number.isSafeInteger(estimatedParameterCount)||estimatedParameterCount<0)
   throw new ModelFailure("INVALID_INPUT","Invalid fitted parameter count");
 let sum=0,abs=0,err2=0,observed2=0,measuredAbs=0,max=0,chi=0,allSigma=true;
 for(const [idx,p] of points.entries()){
   const y=finite("observation "+idx,p.observed),yh=finite("prediction "+idx,p.predicted);
   const e=yh-y,ea=Math.abs(e);
   sum+=e;abs+=ea;err2+=e*e;max=Math.max(max,ea);
   observed2+=y*y;measuredAbs+=Math.abs(y);
   if(p.standardUncertainty===undefined||p.standardUncertainty===null)allSigma=false;
   else {
     const s=p.standardUncertainty;
     if(!(finite("standard uncertainty",s)>0))
       throw new ModelFailure("INVALID_INPUT","Uncertainty must be positive");
     chi+=(e/s)*(e/s);
   }
 }
 const n=points.length;
 return {
   sampleCount:n,bias:sum/n,mae:abs/n,rmse:Math.sqrt(err2/n),
   maximumAbsoluteError:max,
   relativeRmsError:observed2>0?Math.sqrt(err2/observed2):null,
   weightedAbsolutePercentageError:measuredAbs>0?abs/measuredAbs:null,
   chiSquare:allSigma?chi:null,
   reducedChiSquare:allSigma&&n>estimatedParameterCount?
     chi/(n-estimatedParameterCount):null,
   measurementUnits:"not_checked_by_this_numerical_kernel",
   status:"math_only_measurement_provenance_not_verified"
 };
}
export interface TheveninSample {
 /** Signed amps; + discharge, - charge. */
 readonly currentA:number;
 readonly terminalVoltageV:number;
 readonly soc:number;
 readonly cellTemperatureC:number;
}
export interface TheveninFit {
 readonly fittedOpenCircuitVoltageV:number;
 readonly fittedInternalResistanceOhm:number;
 readonly socCenter:number;
 readonly cellTemperatureCenterC:number;
 readonly currentSpanA:number;
 readonly sampleCount:number;
 readonly residuals:CalibrationResiduals;
 readonly evidence:"local_linear_thevenin_fit_only_unverified_instrument_records";
}
/** Ordinary least squares. This is NOT an empirical result until inputs are
 * traced to independent, documented, calibrated instrumentation and repeated
 * under stable rest/pulse conditions. Temperature and SoC have narrow gates. */
export function fitLocalThevenin(
 samples:readonly TheveninSample[],
 maxSocSpread=0.02,maxTemperatureSpreadC=2
):TheveninFit{
 if(samples.length<3)throw new ModelFailure("INVALID_INPUT","At least three independent current/voltage observations are needed");
 nonnegative("maxSocSpread",maxSocSpread);
 nonnegative("maxTemperatureSpreadC",maxTemperatureSpreadC);
 let minSoc=Infinity,maxSoc=-Infinity,minTemp=Infinity,maxTemp=-Infinity;
 let minI=Infinity,maxI=-Infinity,sumI=0,sumV=0,sumSoc=0,sumTemp=0;
 for(const row of samples){
   const i=finite("currentA",row.currentA),v=finite("terminalVoltageV",row.terminalVoltageV);
   if(v<=0)throw new ModelFailure("INVALID_INPUT","Battery terminal voltage must exceed zero");
   const soc=finite("soc",row.soc),temp=finite("cellTemperatureC",row.cellTemperatureC);
   if(soc<0||soc>1||temp<=-273.15)
     throw new ModelFailure("INVALID_INPUT","Invalid battery SOC or temperature");
   minSoc=Math.min(minSoc,soc);maxSoc=Math.max(maxSoc,soc);
   minTemp=Math.min(minTemp,temp);maxTemp=Math.max(maxTemp,temp);
   minI=Math.min(minI,i);maxI=Math.max(maxI,i);
   sumI+=i;sumV+=v;sumSoc+=soc;sumTemp+=temp;
 }
 if(maxSoc-minSoc>maxSocSpread+1e-12||maxTemp-minTemp>maxTemperatureSpreadC+1e-12)
   throw new ModelFailure("INVALID_INPUT","Samples do not share a sufficiently narrow SOC/temperature operating point");
 const span=maxI-minI;
 if(span<1e-6)throw new ModelFailure("INVALID_INPUT","Battery currents insufficiently varied to identify resistance");
 const n=samples.length,mi=sumI/n,mv=sumV/n;
 let xx=0,xy=0;
 for(const s of samples){const di=s.currentA-mi;xx+=di*di;xy+=di*(s.terminalVoltageV-mv);}
 if(xx<=0)throw new ModelFailure("INVALID_INPUT","Degenerate Thevenin regression");
 const r=-xy/xx,voc=mv+r*mi;
 if(!Number.isFinite(r)||!Number.isFinite(voc)||r<0||voc<=0)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY","Fitted Thevenin OCV/R is not physically admissible");
 const residuals=calibrationResiduals(samples.map(s=>({
   observed:s.terminalVoltageV,predicted:voc-r*s.currentA
 })),2);
 return {
   fittedOpenCircuitVoltageV:voc,fittedInternalResistanceOhm:r,
   socCenter:sumSoc/n,cellTemperatureCenterC:sumTemp/n,
   currentSpanA:span,sampleCount:n,residuals,
   evidence:"local_linear_thevenin_fit_only_unverified_instrument_records"
 };
}

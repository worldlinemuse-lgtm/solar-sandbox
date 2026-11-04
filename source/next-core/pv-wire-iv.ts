/**
 * Uniform-irradiance nonlinear PV string/parallel-array + cable DC optimum.
 *
 * Unlike fixed-Vmp approximations, the operating voltage and source current
 * are coupled by the one-diode I-V relation:
 *
 *    I_array(V_module) = N_parallel * I_diode(V_module)
 *    V_array = N_series * V_module
 *    V_controller = V_array - I_array * R_loop
 *    P_controller,max = max_{V_module} I_array * V_controller
 *
 * The full continuous diode curve is searched numerically at a physically
 * admissible cable voltage. No MPPT dynamic tracking, converter efficiency,
 * controller output limiting, bypass/substring shading or cold design rating
 * is inferred from this *reference-only* DC operating envelope.
 *
 * References: Sandia PVPMC single-diode equivalent-circuit model and
 * standard Kirchhoff/Joule cable equations:
 * https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/single-diode-equivalent-circuit-models/
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
import {diodeCurrentAtVoltage,singleDiodeMpp} from "./pv-diode";
import type {SingleDiodeReference} from "./pv-diode";

export interface DiodeArrayCableInput {
 readonly reference:Readonly<SingleDiodeReference>;
 readonly irradianceWm2:number;
 readonly cellTemperatureC:number;
 readonly modulesInSeries:number;
 readonly stringsInParallel:number;
 readonly pvWireLoopOhm:number;
 /** Actual module-side V/I must yield a controller-port voltage >= this value.
  * With an MPPT, the threshold depends on operational start/run state and Vbat. */
 readonly minimumControllerInputVoltageV:number;
}
export interface DiodeArrayCableResult {
 readonly status:"modeled_reference_only"|"no_irradiance"|"insufficient_input_voltage";
 readonly moduleVoltageV:number;
 readonly arrayTerminalVoltageV:number;
 readonly arrayCurrentA:number;
 readonly controllerInputVoltageV:number;
 readonly arrayGrossPowerW:number;
 readonly pvWireLossW:number;
 readonly maximumControllerInputW:number;
 readonly maximumArrayUnwiredW:number;
 readonly curtailedAtArrayW:number;
 readonly conservationResidualW:number;
 readonly relativePowerRecovery:number|null;
 readonly evidence:"published_diode_parameters_temperature_extrapolated_not_measured";
}

export function solveDiodeArrayCableMpp(x:Readonly<DiodeArrayCableInput>):DiodeArrayCableResult{
 const g=nonnegative("irradianceWm2",x.irradianceWm2);
 finite("cellTemperatureC",x.cellTemperatureC);
 const rs=nonnegative("pvWireLoopOhm",x.pvWireLoopOhm);
 const minV=nonnegative("minimumControllerInputVoltageV",x.minimumControllerInputVoltageV);
 if(!Number.isSafeInteger(x.modulesInSeries)||x.modulesInSeries<1||
    !Number.isSafeInteger(x.stringsInParallel)||x.stringsInParallel<1)
   throw new ModelFailure("INVALID_INPUT","PV series and parallel counts must be positive integers");
 const model=singleDiodeMpp(x.reference,g,x.cellTemperatureC);
 const maxUnwired=model.maxPowerW*x.modulesInSeries*x.stringsInParallel;
 const zero=(status:"no_irradiance"|"insufficient_input_voltage"):DiodeArrayCableResult=>({
   status,moduleVoltageV:0,arrayTerminalVoltageV:0,arrayCurrentA:0,
   controllerInputVoltageV:0,arrayGrossPowerW:0,pvWireLossW:0,
   maximumControllerInputW:0,maximumArrayUnwiredW:maxUnwired,
   curtailedAtArrayW:maxUnwired,conservationResidualW:0,
   relativePowerRecovery:maxUnwired>0?0:null,
   evidence:"published_diode_parameters_temperature_extrapolated_not_measured"
 });
 if(g===0||model.maxPowerW===0)return zero("no_irradiance");
 // Open-circuit voltage is the greatest nonnegative controller-port voltage.
 if(model.openCircuitVoltageV*x.modulesInSeries<minV-1e-9)
   return zero("insufficient_input_voltage");

 type Point={v:number;i:number;sourceV:number;portV:number;gross:number;loss:number;net:number};
 const sample=(moduleV:number):Point=>{
   const current=x.stringsInParallel*diodeCurrentAtVoltage(
      x.reference,g,x.cellTemperatureC,moduleV);
   const sourceV=x.modulesInSeries*moduleV;
   const portV=sourceV-current*rs;
   const gross=sourceV*current;
   const loss=current*current*rs;
   const net=portV*current;
   return {v:moduleV,i:current,sourceV,portV,gross,loss,net};
 };
 // V_controller(V_module) is monotonic on the forward quadrant of the
 // single-diode curve, so all admissible module voltages form one interval.
 const open=model.openCircuitVoltageV;
 let left=0,right=open;
 if(sample(0).portV<minV){
   for(let j=0;j<90;j++){
     const mid=(left+right)/2;
     if(sample(mid).portV<minV)left=mid;else right=mid;
   }
   left=right;
 }
 const lower=left;
 if(lower>=open)return zero("insufficient_input_voltage");
 const n=128,step=(open-lower)/n;
 let best=sample(lower),bestIndex=0;
 // Coarse global scan prevents a local optimizer from implicitly presuming
 // a globally concave objective across every supported parameter set.
 for(let j=1;j<=n;j++){
   const p=sample(lower+j*step);
   if(p.portV>=minV-1e-9&&p.net>best.net){
     best=p;bestIndex=j;
   }
 }
 const lowerBracket=Math.max(lower,lower+(bestIndex-1)*step);
 const upperBracket=Math.min(open,lower+(bestIndex+1)*step);
 let a=lowerBracket,b=upperBracket;
 const invPhi=(Math.sqrt(5)-1)/2;
 let c=b-invPhi*(b-a),d=a+invPhi*(b-a);
 let pc=sample(c),pd=sample(d);
 for(let j=0;j<90;j++){
   if(pc.net<pd.net){
     a=c;c=d;pc=pd;d=a+invPhi*(b-a);pd=sample(d);
   }else{
     b=d;d=c;pd=pc;c=b-invPhi*(b-a);pc=sample(c);
   }
 }
 const optimum=sample((a+b)/2);
 if(optimum.portV>=minV-1e-9&&optimum.net>best.net)best=optimum;
 if(best.portV<minV-1e-8)
   throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","PV array voltage constraint violated");
 const residual=best.gross-best.loss-best.net;
 const errorScale=Math.max(1,best.gross,best.loss,best.net);
 if(best.net< -1e-9||!Number.isFinite(best.net)||
   Math.abs(residual)>1e-8*errorScale||best.gross>maxUnwired+1e-7*errorScale)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY","Nonlinear PV cable energy or maximum-power invariant failed");
 return {
   status:"modeled_reference_only",
   moduleVoltageV:best.v,arrayTerminalVoltageV:best.sourceV,
   arrayCurrentA:best.i,controllerInputVoltageV:best.portV,
   arrayGrossPowerW:best.gross,pvWireLossW:best.loss,
   maximumControllerInputW:best.net,maximumArrayUnwiredW:maxUnwired,
   curtailedAtArrayW:Math.max(0,maxUnwired-best.gross),
   conservationResidualW:residual,
   relativePowerRecovery:maxUnwired>0?best.net/maxUnwired:null,
   evidence:"published_diode_parameters_temperature_extrapolated_not_measured"
 };
}

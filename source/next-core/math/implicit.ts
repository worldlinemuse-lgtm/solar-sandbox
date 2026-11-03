/**
 * Implicit physical laws precede numerical root-finding algorithms.
 *
 * A solver may choose an analytic root, bisection or a safeguarded nonlinear
 * method. It cannot declare success until its candidate satisfies the
 * registered residual, declared units, branch policy and error tolerance.
 * A residual check proves mathematical consistency, not physical calibration.
 */
import {ModelFailure,finite} from "../contracts";
import {M,unitOf,evaluate,references} from "./expressions";
import type {Expr,Unit} from "./expressions";

export interface ImplicitLaw {
 readonly id:string;
 readonly revision:number;
 readonly math:string;
 readonly unknown:{readonly name:string;readonly unit:Unit};
 readonly inputs:Readonly<Record<string,Unit>>;
 readonly residual:Expr;
 readonly residualUnit:Unit;
 readonly declaredVariables:readonly string[];
 readonly relativeTolerance:number;
 readonly absoluteTolerance:number;
 readonly branchPolicy:string;
 readonly branchKind:"battery_low_current"|"pv_low_current"|"controller_positive";
 readonly evidenceIds:readonly string[];
 readonly assumptions:readonly string[];
}
export interface VerifiedRoot {
 readonly lawId:string;
 readonly revision:number;
 readonly variable:string;
 readonly unit:Unit;
 readonly value:number;
 readonly residual:number;
 readonly residualUnit:Unit;
 readonly allowedResidual:number;
 readonly passed:true;
 readonly math:string;
 readonly branchPolicy:string;
 readonly physicalCalibrationVerified:false;
}
function invalid(message:string):never{
 throw new ModelFailure("INVALID_INPUT","Implicit law: "+message);
}
function verifyDefinition(law:ImplicitLaw):void{
 if(!law.id||!law.math||!law.branchPolicy||!law.evidenceIds.length)
  invalid("missing mathematical law identity, branch rule or evidence");
 if(law.unknown.name in law.inputs)
  invalid("unknown must be independent of inputs");
 const context={...law.inputs,[law.unknown.name]:law.unknown.unit};
 if(unitOf(law.residual,context)!==law.residualUnit)
  invalid(law.id+" residual dimension does not match "+law.residualUnit);
 const from=references(law.residual);
 if(from.join("|")!==[...law.declaredVariables].sort().join("|"))
  invalid(law.id+" declared variables are not equal to the residual references");
 if(law.relativeTolerance<0||!Number.isFinite(law.relativeTolerance)||
    law.absoluteTolerance<0||!Number.isFinite(law.absoluteTolerance))
  invalid("invalid root tolerance");
}
export function verifyImplicitRoot(
 law:ImplicitLaw,inputs:Readonly<Record<string,number>>,candidate:number
):VerifiedRoot{
 verifyDefinition(law);
 const names=Object.keys(law.inputs).sort();
 if(Object.keys(inputs).sort().join("|")!==names.join("|"))
  invalid(law.id+" missing or extraneous input variables");
 const values:Record<string,number>={};
 for(const key of names)values[key]=finite(key,inputs[key]);
 values[law.unknown.name]=finite("candidate root",candidate);
 // A zero residual alone is insufficient for a nonlinear electrical device:
 // a quadratic can have a second mathematically correct but unphysical root.
 // The admissible branch must be specified and verified independently.
 const upperTol=1e-9*Math.max(1,Math.abs(candidate));
 if(law.branchKind==="battery_low_current"){
  const voc=values["battery.ocvV"],r=values["battery.internalOhm"];
  if(r>0&&candidate>voc/(2*r)+upperTol)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "Battery operating point selected unstable/high-current quadratic branch");
 }else if(law.branchKind==="pv_low_current"){
  const v=values["wire.sourceV"],r=values["wire.loopOhm"];
  if(candidate<0||r>0&&candidate>v/(2*r)+upperTol)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "PV operating point not on nonnegative lower-current branch");
 }else if(law.branchKind==="controller_positive"){
  if(candidate<0)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "Controller output current must be nonnegative");
 }
 const residual=evaluate(law.residual,values);
 const scale=Math.max(1,...Object.values(inputs).map(Math.abs));
 const tolerance=law.absoluteTolerance+law.relativeTolerance*scale;
 if(Math.abs(residual)>tolerance)
  throw new ModelFailure("SOLVER_DID_NOT_CONVERGE",
   law.id+" residual "+residual+" "+law.residualUnit+" exceeds "+tolerance);
 return {lawId:law.id,revision:law.revision,variable:law.unknown.name,
  unit:law.unknown.unit,value:candidate,residual,residualUnit:law.residualUnit,
  allowedResidual:tolerance,passed:true,math:law.math,
  branchPolicy:law.branchPolicy,physicalCalibrationVerified:false};
}
const x=M.ref;
export const BATTERY_TERMINAL_CURRENT:ImplicitLaw={
 id:"battery.terminal_current.quadratic",revision:1,
 math:String.raw`P_{requested}=(V_{OCV}-IR)I`,
 unknown:{name:"battery.currentA",unit:"A"},
 inputs:{"battery.ocvV":"V","battery.internalOhm":"ohm",
   "battery.requiredW":"W"},
 residual:M.sub(M.dc(
   M.sub(x("battery.ocvV"),M.mul(x("battery.currentA"),x("battery.internalOhm"))),
   x("battery.currentA")),x("battery.requiredW")),
 residualUnit:"W",
 declaredVariables:["battery.currentA","battery.ocvV",
   "battery.internalOhm","battery.requiredW"],
 relativeTolerance:1e-10,absoluteTolerance:1e-9,
 branchPolicy:"Lower-current branch continuous as R→0; reject negative discriminant",
 branchKind:"battery_low_current",
 evidenceIds:["physics:ohm-law","physics:terminal-power"],
 assumptions:["Single-point OCV/R approximation", "No dynamic polarization or battery capacitance"]
};
export const PV_INPUT_CABLE_CURRENT:ImplicitLaw={
 id:"pv.input_cable_current.quadratic",revision:1,
 math:String.raw`P_{accepted}=V_{source}I-I^2R`,
 unknown:{name:"wire.currentA",unit:"A"},
 inputs:{"wire.sourceV":"V","wire.loopOhm":"ohm","wire.acceptedW":"W"},
 residual:M.sub(M.sub(
  M.dc(x("wire.sourceV"),x("wire.currentA")),
  M.i2r(x("wire.currentA"),x("wire.loopOhm"))),x("wire.acceptedW")),
 residualUnit:"W",
 declaredVariables:["wire.currentA","wire.sourceV","wire.loopOhm","wire.acceptedW"],
 relativeTolerance:1e-10,absoluteTolerance:1e-9,
 branchPolicy:"Small positive current root, I <= V/(2R); Vmp assumed constant",
 branchKind:"pv_low_current",
 evidenceIds:["physics:ohm-law","physics:dc-power"],
 assumptions:["Fixed Vmp model; complete module I-V root is a later migration"]
};
export const CONTROLLER_OUTPUT_CABLE_CURRENT:ImplicitLaw={
 id:"controller.output_cable_current.quadratic",revision:1,
 math:String.raw`P_{output}=V_{bus}I+I^2R`,
 unknown:{name:"wire.currentA",unit:"A"},
 inputs:{"wire.busV":"V","wire.loopOhm":"ohm","wire.sourceW":"W"},
 residual:M.sub(M.add(
  M.dc(x("wire.busV"),x("wire.currentA")),
  M.i2r(x("wire.currentA"),x("wire.loopOhm"))),x("wire.sourceW")),
 residualUnit:"W",
 declaredVariables:["wire.currentA","wire.busV","wire.loopOhm","wire.sourceW"],
 relativeTolerance:1e-10,absoluteTolerance:1e-9,
 branchPolicy:"Nonnegative solution of V*I + I²R = accepted output power",
 branchKind:"controller_positive",
 evidenceIds:["physics:ohm-law","physics:dc-power"],
 assumptions:["Steady DC bus voltage; no controller dynamics or transient reactance"]
};
export const IMPLICIT_LAWS=[
 BATTERY_TERMINAL_CURRENT,PV_INPUT_CABLE_CURRENT,CONTROLLER_OUTPUT_CABLE_CURRENT
] as const;

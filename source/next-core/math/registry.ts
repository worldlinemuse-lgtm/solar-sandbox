/**
 * Canonical math authority: compile a directed dependency graph from equations,
 * check symbolic dimensions and semantic power kinds, then evaluate each
 * transformation exactly once and capture its immutable result.
 *
 * No eval(), Function(), executable model-formula strings or hidden outputs.
 * Equation text is for human audit; the typed expression tree is executable law.
 */
import {ModelFailure,finite,EvidenceTier} from "../contracts";
import {Expr,Unit,references,unitOf,evaluate} from "./expressions";

export type FormulaAuthority =
  "PUBLISHED_REFERENCE" | "DERIVED" | "PROXY" |
  "FORMAL_CONTRACT" | "UNRESOLVED";
export type Stage =
  "source" | "topology" | "electrical" | "storage" |
  "conversion" | "energy" | "safety" | "reporting";
export interface Interval {readonly min?:number;readonly max?:number}
export interface InputDefinition {
 readonly name:string;
 readonly unit:Unit;
 readonly role:"parameter"|"state"|"disturbance"|"observation";
 readonly bounds?:Interval;
 readonly evidenceIds:readonly string[];
 readonly evidenceTier:EvidenceTier;
 readonly description:string;
}
export interface EquationDefinition {
 readonly id:string;
 readonly revision:number;
 readonly stage:Stage;
 readonly output:string;
 readonly unit:Unit;
 readonly expression:Expr;
 /** Must equal the expression AST references; checked at compile time. */
 readonly dependsOn:readonly string[];
 readonly math:string;
 readonly authority:FormulaAuthority;
 readonly evidenceTier:EvidenceTier;
 readonly evidenceIds:readonly string[];
 readonly bounds?:Interval;
 readonly assumptions:readonly string[];
 readonly falsifier:string;
}
export interface InvariantDefinition {
 readonly id:string;
 readonly revision:number;
 readonly math:string;
 /** A symbolic expression expected to equal exactly zero, within tolerance. */
 readonly residual:Expr;
 readonly unit:Unit;
 readonly referenceScale:readonly string[];
 readonly absoluteTolerance:number;
 readonly relativeTolerance:number;
 readonly violation:"error"|"record";
 readonly source:string;
}
export interface MathDefinition {
 readonly id:string;
 readonly revision:number;
 readonly inputs:readonly InputDefinition[];
 readonly equations:readonly EquationDefinition[];
 readonly invariants:readonly InvariantDefinition[];
}
export interface EquationCapture {
 readonly id:string;
 readonly revision:number;
 readonly stage:Stage;
 readonly output:string;
 readonly unit:Unit;
 readonly value:number;
 readonly inputs:Readonly<Record<string,{readonly value:number;readonly unit:Unit}>>;
 readonly math:string;
 readonly expression:Expr;
 readonly authority:FormulaAuthority;
 readonly effectiveEvidenceTier:EvidenceTier;
 readonly assumptions:readonly string[];
 readonly evidenceIds:readonly string[];
 readonly falsifier:string;
}
export interface InvariantCapture {
 readonly id:string;
 readonly value:number;
 readonly unit:Unit;
 readonly threshold:number;
 readonly passed:boolean;
 readonly math:string;
}
export interface MathEvaluation {
 readonly modelId:string;
 readonly revision:number;
 readonly values:Readonly<Record<string,number>>;
 readonly captures:readonly EquationCapture[];
 readonly invariants:readonly InvariantCapture[];
 readonly mathematicallyConsistent:boolean;
 readonly notPhysicalCalibration:true;
}
function reject(message:string):never{
 throw new ModelFailure("INVALID_INPUT","Math registry: "+message);
}
function identifier(name:string):void{
 if(!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name))reject("invalid symbol / formula id "+name);
}
function boundsCheck(id:string,value:number,bounds?:Interval):void{
 finite(id,value);
 if(!bounds)return;
 if(bounds.min!==undefined&&value<bounds.min-1e-10*Math.max(1,Math.abs(bounds.min)))
  reject(id+" below minimum "+bounds.min+": "+value);
 if(bounds.max!==undefined&&value>bounds.max+1e-10*Math.max(1,Math.abs(bounds.max)))
  reject(id+" above maximum "+bounds.max+": "+value);
}
function listEqual(a:readonly string[],b:readonly string[]):boolean{
 const sorted=(x:readonly string[])=>[...x].sort().join("\u0000");
 return a.length===new Set(a).size&&sorted(a)===sorted(b);
}
export class FormulaRegistry {
 readonly spec:MathDefinition;
 readonly ordered:readonly EquationDefinition[];
 readonly symbolUnits:Readonly<Record<string,Unit>>;
 private readonly declaredInputs:readonly InputDefinition[];

 constructor(spec:MathDefinition){
  identifier(spec.id);
  if(!Number.isInteger(spec.revision)||spec.revision<1)
   reject("registry revision must be an integer >= 1");
  const units:Record<string,Unit>={},inputs:Record<string,InputDefinition>={};
  const outputs:Record<string,EquationDefinition>={},equationIds=new Set<string>();
  for(const input of spec.inputs){
   identifier(input.name);
   if(Object.prototype.hasOwnProperty.call(units,input.name))
    reject("duplicate input symbol "+input.name);
   units[input.name]=input.unit;inputs[input.name]=input;
   if(!input.description||!input.evidenceIds)
    reject(input.name+" missing evidence metadata");
  }
  for(const eq of spec.equations){
   identifier(eq.id);identifier(eq.output);
   if(!Number.isInteger(eq.revision)||eq.revision<1)
    reject(eq.id+" missing integer equation revision");
   if(equationIds.has(eq.id))reject("duplicate formula id "+eq.id);
   if(Object.prototype.hasOwnProperty.call(units,eq.output)||
      Object.prototype.hasOwnProperty.call(outputs,eq.output))
    reject("duplicate output "+eq.output);
   if(!eq.math||!eq.falsifier||!eq.assumptions||!eq.evidenceIds)
    reject(eq.id+" missing canonical math and provenance");
   if(!listEqual(eq.dependsOn,references(eq.expression)))
    reject(eq.id+" declared dependencies disagree with executable expression");
   outputs[eq.output]=eq;equationIds.add(eq.id);
  }
  const state:Record<string,0|1|2>={};
  const ordered:EquationDefinition[]=[];
  const visit=(output:string):void=>{
   if(state[output]===2)return;
   if(state[output]===1)reject("cyclic mathematical dependency at "+output);
   const eq=outputs[output];
   if(!eq)reject("missing equation output "+output);
   state[output]=1;
   for(const ref of references(eq.expression)){
    if(Object.prototype.hasOwnProperty.call(outputs,ref))visit(ref);
    else if(!Object.prototype.hasOwnProperty.call(inputs,ref))
      reject(eq.id+" references unknown symbol "+ref);
   }
   const actual=unitOf(eq.expression,units);
   if(actual!==eq.unit)reject(eq.id+" expected "+eq.unit+" but expression produces "+actual);
   units[eq.output]=eq.unit;
   state[output]=2;ordered.push(eq);
  };
  for(const eq of [...spec.equations].sort((a,b)=>a.id.localeCompare(b.id)))
   visit(eq.output);
  const invariantIds=new Set<string>();
  for(const invariant of spec.invariants){
   identifier(invariant.id);
   if(invariantIds.has(invariant.id))reject("duplicate invariant "+invariant.id);
   invariantIds.add(invariant.id);
   if(!invariant.math||!invariant.source)reject(invariant.id+" missing mathematical source");
   if(unitOf(invariant.residual,units)!==invariant.unit)
    reject(invariant.id+" residual unit mismatch");
   if(invariant.absoluteTolerance<0||invariant.relativeTolerance<0||
      !Number.isFinite(invariant.absoluteTolerance)||!Number.isFinite(invariant.relativeTolerance))
     reject("invalid invariant tolerance "+invariant.id);
   for(const name of invariant.referenceScale)
    if(!Object.prototype.hasOwnProperty.call(units,name))
     reject(invariant.id+" references missing scale "+name);
   // Require explicit invariant mathematical authority; no unregistered safety tests.
  }
  this.spec=spec;this.ordered=Object.freeze(ordered.slice());
  this.declaredInputs=Object.freeze(spec.inputs.slice());
  this.symbolUnits=Object.freeze({...units});
 }

 evaluate(inputValues:Readonly<Record<string,number>>):MathEvaluation{
  const values:Record<string,number>={};
  for(const key of Object.keys(inputValues))
   if(!this.declaredInputs.some(x=>x.name===key))
    reject("unexpected input "+key);
  for(const input of this.declaredInputs){
   if(!Object.prototype.hasOwnProperty.call(inputValues,input.name))
    reject("missing required input "+input.name);
   const x=finite(input.name,inputValues[input.name]);
   boundsCheck(input.name,x,input.bounds);
   values[input.name]=x;
  }
  const captures:EquationCapture[]=[];
  const evidence:Record<string,{tier:EvidenceTier;ids:readonly string[]}>=
    Object.fromEntries(this.declaredInputs.map(x=>[x.name,{tier:x.evidenceTier,ids:x.evidenceIds}]));
  const tierRank:Record<EvidenceTier,number>={
    R0_measured:0,R1_published:1,R2_derived:2,R3_assumed:3
  };
  for(const eq of this.ordered){
   const inputs:Record<string,{value:number;unit:Unit}>={};
   for(const ref of references(eq.expression))
    inputs[ref]={value:values[ref],unit:this.symbolUnits[ref]};
   const result=evaluate(eq.expression,values);
   boundsCheck(eq.output,result,eq.bounds);
   values[eq.output]=result;
   let tier=eq.evidenceTier;
   const provenance=new Set<string>(eq.evidenceIds);
   for(const dep of references(eq.expression)){
     const information=evidence[dep];
     if(tierRank[information.tier]>tierRank[tier])tier=information.tier;
     for(const id of information.ids)provenance.add(id);
   }
   evidence[eq.output]={tier,ids:[...provenance].sort()};
   captures.push(Object.freeze({
     id:eq.id,revision:eq.revision,stage:eq.stage,
     output:eq.output,unit:eq.unit,value:result,inputs:Object.freeze(inputs),
     math:eq.math,expression:eq.expression,authority:eq.authority,
     effectiveEvidenceTier:tier,
     assumptions:eq.assumptions,evidenceIds:Object.freeze([...provenance].sort()),
     falsifier:eq.falsifier
   }));
  }
  const checks:InvariantCapture[]=[];
  for(const invariant of this.spec.invariants){
   const residual=evaluate(invariant.residual,values);
   const scale=Math.max(1,...invariant.referenceScale.map(x=>Math.abs(values[x])));
   const tolerance=invariant.absoluteTolerance+invariant.relativeTolerance*scale;
   const passed=Math.abs(residual)<=tolerance;
   checks.push(Object.freeze({
    id:invariant.id,value:residual,unit:invariant.unit,
    threshold:tolerance,passed,math:invariant.math
   }));
   if(!passed&&invariant.violation==="error")
    throw new ModelFailure("PHYSICAL_INFEASIBILITY",
      invariant.id+" residual "+residual+" "+invariant.unit+" exceeds "+tolerance);
  }
  return Object.freeze({
   modelId:this.spec.id,revision:this.spec.revision,
   values:Object.freeze({...values}),
   captures:Object.freeze(captures),
   invariants:Object.freeze(checks),
   mathematicallyConsistent:checks.every(c=>c.passed),
   notPhysicalCalibration:true as const
  });
 }
}

export function assertFormulaOutputs(result:MathEvaluation,
 expected:Readonly<Record<string,number>>,
 tolerance=1e-9):void{
 for(const [symbol,actualExpected] of Object.entries(expected)){
  if(!Object.prototype.hasOwnProperty.call(result.values,symbol))
   reject("absent verification output "+symbol);
  const value=result.values[symbol];
  const eps=tolerance*Math.max(1,Math.abs(value),Math.abs(actualExpected));
  if(!Number.isFinite(actualExpected)||Math.abs(value-actualExpected)>eps)
   throw new ModelFailure("PHYSICAL_INFEASIBILITY",
     "Math output "+symbol+" mismatch "+value+" != "+actualExpected);
 }
}

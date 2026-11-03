/**
 * Explicit infrastructure graph: named products, terminal rails, individual
 * conductors, junctions, protection uncertainty and Kirchhoff balance.
 *
 * The graph VALIDATES a supplied operating state. It does not invent a circuit,
 * design a household installation, infer AC neutral/ground behavior or certify
 * National Electrical Code compliance. All I/O is immutable and auditable.
 */
import {ModelFailure,finite,nonnegative} from "../contracts";
import {MATHEMATICS} from "./models";
import type {MathEvaluation} from "./registry";

export type Rail =
 "PV_POS"|"PV_NEG"|"BAT_POS"|"BAT_NEG"|
 "AC_L1"|"AC_L2"|"AC_NEUTRAL"|"PE";
export type NodeKind="equipment_terminal"|"junction";
export interface ProductRef {
 readonly id:string;
 readonly maker:string;
 readonly model:string;
 readonly revision:string|null;
 readonly datasheetUrl:string|null;
 readonly role:"pv_module"|"mppt"|"battery"|"inverter"|"generator"|
  "load"|"bus"|"protection"|"transfer"|"other";
}
export interface Terminal {
 readonly id:string;
 readonly productId:string;
 readonly kind:NodeKind;
 readonly rail:Rail;
 readonly minimumV:number|null;
 readonly maximumV:number|null;
 readonly currentLimitA:number|null;
 readonly evidenceIds:readonly string[];
 readonly requiredConnection:boolean;
}
export interface Conductor {
 readonly id:string;
 readonly from:string;
 readonly to:string;
 /** Signed branch current, positive in the edge's declared direction. */
 readonly currentA:number;
 /** Resistance of THIS ONE conductor; explicitly NOT a round-trip loop value. */
 readonly resistanceOhm:number;
 readonly continuousAmpacityA:number|null;
 /** A fuse/circuit breaker is declared ONLY if actually present in this model. */
 readonly protection:{
   readonly kind:"fuse"|"breaker";
   readonly tripRatingA:number;
   readonly interruptRatingA:number|null;
   readonly evidenceIds:readonly string[];
 }|null;
 readonly evidenceIds:readonly string[];
}
export interface PortPair {
 readonly productId:string;
 readonly positiveTerminal:string;
 readonly negativeTerminal:string;
 readonly kind:"PV_DC"|"BAT_DC"|"AC_120"|"AC_240";
}
export interface InstallationGraph {
 readonly id:string;
 readonly products:readonly ProductRef[];
 readonly terminals:readonly Terminal[];
 readonly conductors:readonly Conductor[];
 readonly requiredPairs:readonly PortPair[];
}
export interface GraphFinding {
 readonly severity:"error"|"unknown"|"notice";
 readonly id:string;
 readonly message:string;
 readonly relatedIds:readonly string[];
}
export interface ConductorCapture {
 readonly id:string;
 readonly from:string;
 readonly to:string;
 readonly rail:Rail;
 readonly currentA:number;
 readonly resistanceOhm:number;
 readonly voltageDropV:number;
 readonly heatW:number;
 readonly heatWh:number;
 readonly math:MathEvaluation;
}
export interface GraphEvaluation {
 readonly graphId:string;
 readonly status:"invalid"|"indeterminate"|"structural_checks_passed";
 readonly codeComplianceVerified:false;
 readonly independentHardwareCalibration:false;
 readonly findings:readonly GraphFinding[];
 readonly conductors:readonly ConductorCapture[];
 readonly totalHeatWh:number;
 readonly totalHeatW:number;
 readonly junctionResidualA:Readonly<Record<string,number>>;
}
function invalid(msg:string):never{
 throw new ModelFailure("INVALID_INPUT","Topology: "+msg);
}
function identified(name:string):void{
 if(!/^[A-Za-z][A-Za-z0-9_.:-]{0,100}$/.test(name))invalid("invalid id "+name);
}
function isPositive(rail:Rail){return rail==="PV_POS"||rail==="BAT_POS";}
function isNegative(rail:Rail){return rail==="PV_NEG"||rail==="BAT_NEG";}
function isAc(rail:Rail){return rail==="AC_L1"||rail==="AC_L2"||rail==="AC_NEUTRAL";}
const pairRails:Record<PortPair["kind"],[Rail,Rail]|[Rail,Rail,Rail]> = {
 PV_DC:["PV_POS","PV_NEG"],
 BAT_DC:["BAT_POS","BAT_NEG"],
 AC_120:["AC_L1","AC_NEUTRAL"],
 AC_240:["AC_L1","AC_L2"]
};

/** Structural validation and per-conductor energy conservation.
 * Unknown protection/port ratings downgrade the result to indeterminate.
 */
export function evaluateInstallation(
 graph:Readonly<InstallationGraph>,durationSeconds:number
):GraphEvaluation{
 identified(graph.id);
 if(!(finite("durationSeconds",durationSeconds)>0))
   invalid("duration must exceed zero");
 const products=new Map<string,ProductRef>();
 const ports=new Map<string,Terminal>();
 const seenEdges=new Set<string>();
 const findings:GraphFinding[]=[];
 const report=(severity:GraphFinding["severity"],id:string,message:string,relatedIds:string[])=>{
  findings.push({severity,id,message,relatedIds:[...relatedIds]});
 };
 for(const p of graph.products){
  identified(p.id);
  if(products.has(p.id))invalid("duplicate product "+p.id);
  if(!p.maker||!p.model)invalid("missing manufacturer and exact model for "+p.id);
  products.set(p.id,p);
  if(!p.revision||!p.datasheetUrl)
    report("unknown","product.provenance","Model variant or datasheet revision not supplied",[p.id]);
 }
 for(const node of graph.terminals){
  identified(node.id);
  if(ports.has(node.id))invalid("duplicate terminal "+node.id);
  if(!products.has(node.productId))invalid("terminal "+node.id+" refers to missing product");
  if(node.minimumV!==null&&node.maximumV!==null&&node.minimumV>node.maximumV)
    invalid("terminal voltage interval reversed: "+node.id);
  if(node.currentLimitA!==null)nonnegative("terminal current",node.currentLimitA);
  if(node.minimumV!==null)finite("terminal min V",node.minimumV);
  if(node.maximumV!==null)finite("terminal max V",node.maximumV);
  ports.set(node.id,node);
 }
 const connected=new Set<string>(),junctions:Record<string,number>={};
 const captures:ConductorCapture[]=[];
 for(const edge of graph.conductors){
  identified(edge.id);
  if(seenEdges.has(edge.id))invalid("duplicate conductor "+edge.id);
  seenEdges.add(edge.id);
  const a=ports.get(edge.from),z=ports.get(edge.to);
  if(!a||!z)invalid("conductor "+edge.id+" has unrecognized endpoint");
  if(edge.from===edge.to)invalid("conductor "+edge.id+" shorts terminal onto itself");
  connected.add(a.id);connected.add(z.id);
  const affected=[edge.id,a.id,z.id];
  if(a.rail!==z.rail)
    report("error","rail.mismatch","Conductor directly connects different rails "+a.rail+" / "+z.rail,affected);
  if(isPositive(a.rail)&&isNegative(z.rail)||
     isNegative(a.rail)&&isPositive(z.rail))
    report("error","short.polarity","Positive/negative direct connection",affected);
  if(isAc(a.rail)!==isAc(z.rail)||
     a.rail==="PE"&&z.rail!=="PE"||z.rail==="PE"&&a.rail!=="PE")
    report("error","domain.mismatch","DC, AC and protective earth cannot be conflated",affected);
  if(a.minimumV!==null&&z.maximumV!==null&&a.minimumV>z.maximumV||
     z.minimumV!==null&&a.maximumV!==null&&z.minimumV>a.maximumV)
    report("error","voltage.nonoverlap","Terminal operating voltage ranges have no intersection",affected);
  if(a.minimumV===null||a.maximumV===null||
     z.minimumV===null||z.maximumV===null)
    report("unknown","voltage.unspecified","Operating voltage envelope is incomplete",affected);
  const amps=Math.abs(finite("conductor current",edge.currentA));
  const res=nonnegative("conductor resistance",edge.resistanceOhm);
  for(const term of [a,z])
   if(term.currentLimitA!==null&&amps>term.currentLimitA+1e-8)
    report("error","terminal.overcurrent","Current exceeds declared terminal limit",[edge.id,term.id]);
  if(a.currentLimitA===null||z.currentLimitA===null)
    report("unknown","terminal.unrated","Terminal current limit unspecified",affected);
  if(edge.continuousAmpacityA!==null){
   nonnegative("conductor ampacity",edge.continuousAmpacityA);
   if(amps>edge.continuousAmpacityA+1e-8)
    report("error","conductor.overcurrent","Conductor current exceeds declared ampacity",affected);
  }else report("unknown","ampacity.unspecified","Conductor ampacity not verified",affected);
  if(!edge.protection){
   report("unknown","protection.unspecified",
    "No documented branch protection: code necessity depends on complete installation",affected);
  }else{
   const f=edge.protection;
   nonnegative("fuse/breaker rating",f.tripRatingA);
   if(f.interruptRatingA!==null)nonnegative("interrupt rating",f.interruptRatingA);
   if(f.interruptRatingA===null)
    report("unknown","interrupt.unknown",
      "Protection device interrupting capacity has no manufacturer evidence",affected);
   if(edge.continuousAmpacityA!==null&&f.tripRatingA>edge.continuousAmpacityA+1e-8)
    report("error","protection.overrated",
      "Protection rating exceeds declared conductor continuous ampacity; exceptions not adjudicated",affected);
  }
  if(a.kind==="junction")junctions[a.id]=(junctions[a.id]??0)-edge.currentA;
  if(z.kind==="junction")junctions[z.id]=(junctions[z.id]??0)+edge.currentA;
  const math=MATHEMATICS.wire.evaluate({
    "wire.currentA":edge.currentA,"wire.conductorOhm":res,
    "interval.seconds":durationSeconds
  });
  captures.push({id:edge.id,from:a.id,to:z.id,rail:a.rail,
    currentA:edge.currentA,resistanceOhm:res,
    voltageDropV:math.values["wire.voltageDropV"],
    heatW:math.values["wire.heatW"],heatWh:math.values["wire.heatWh"],math});
 }
 for(const port of ports.values()){
  if(port.requiredConnection&&!connected.has(port.id))
   report("error","required.unconnected","Required terminal has no conductor",[port.id]);
 }
 for(const pair of graph.requiredPairs){
  const p=ports.get(pair.positiveTerminal),n=ports.get(pair.negativeTerminal);
  const rails=pairRails[pair.kind];
  if(!p||!n||p.productId!==pair.productId||n.productId!==pair.productId)
   invalid("required return-path pair references unrelated or missing product terminals");
  if(p.rail!==rails[0]||n.rail!==rails[1])
   report("error","pair.rails","Terminal rails do not match declared circuit type",
     [pair.productId,p.id,n.id]);
  if(!connected.has(p.id)||!connected.has(n.id))
   report("error","return.incomplete","Declared circuit lacks one or both conductors",
     [pair.productId,p.id,n.id]);
 }
 for(const [node,residual] of Object.entries(junctions)){
  const scale=Math.max(1,...graph.conductors.filter(e=>e.from===node||e.to===node)
    .map(e=>Math.abs(e.currentA)));
  if(Math.abs(residual)>1e-9*scale)
    report("error","junction.kcl","Kirchhoff current residual "+residual+" A",[node]);
 }
 const invalidGraph=findings.some(x=>x.severity==="error");
 const uncertain=findings.some(x=>x.severity==="unknown");
 return {graphId:graph.id,
   status:invalidGraph?"invalid":uncertain?"indeterminate":"structural_checks_passed",
   codeComplianceVerified:false,independentHardwareCalibration:false,
   findings,conductors:captures,
   totalHeatWh:captures.reduce((s,x)=>s+x.heatWh,0),
   totalHeatW:captures.reduce((s,x)=>s+x.heatW,0),
   junctionResidualA:junctions};
}

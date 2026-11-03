/**
 * Browser integration for independently tested models.
 * This is a read-only diagnostics API, NOT an approved replacement for the
 * legacy live simulation or electrical design certification.
 */
import {singleDiodeMpp,LONGI_435_PVSYST} from "./pv-diode";
import {solvePvBus} from "./solar";
import {advanceReferenceIsland} from "./island";
import {makeSyntheticBenchSpec} from "./catalog";
import type {IslandSpec,IslandState,IslandRequest} from "./island";
import {ModelFailure,finite,nonnegative} from "./contracts";
import {MATHEMATICS} from "./math/models";
import {evaluateInstallation} from "./math/topology";
import type {InstallationGraph} from "./math/topology";

export const validationStatus=Object.freeze({
  schema:1,
  runMode:"read_only_shadow",
  mathRegistryRevision:1,
  mathematicalModels:Object.keys(MATHEMATICS),
  wiringValidation:"structural_only_not_code_compliant",
  canReplaceProductionSolver:false,
  physicalCalibration:false,
  model:"Math-registry governed PV, wiring, battery and AC reference models (read-only)",
  status:"partial_reference_validation",
  missing:["whole-system instrument data","measured battery OCV/SoC/temperature",
    "motor transient power factor and duration","generator PowerAssist/transfer calibration",
    "provenance of original historical NASA POWER request","complete equipment topology coverage"]
});
export interface ShadowPvRequest{
 readonly panelId:string;
 readonly controllerId:string;
 readonly irradianceWm2:number;
 readonly cellTemperatureC:number;
 readonly series:number;
 readonly stringsByController:readonly number[];
 readonly mpptCurrentLimitA:number;
 readonly mpptAbsoluteVocV:number;
 readonly mpptOperatingVocV:number;
 readonly mpptIscLimitA:number;
 readonly mpptEfficiency:number;
 readonly pvCableLoopOhm:number;
 readonly controllerCableLoopOhm:number;
 readonly busVoltageV:number;
 readonly legacyControllerOutputW:number|null;
 readonly legacySnowFraction:number;
}
export function shadowPv(x:Readonly<ShadowPvRequest>):unknown {
 if(x.panelId!=="lg435"||x.controllerId!=="150/70")
   return {status:"unsupported",reason:"Only EXACT LONGi LR4-72HBD-435M + Victron 150/70 published fixtures are validated"};
 if(x.legacySnowFraction>0)
   return {status:"indeterminate",reason:"Snow/bypass diode distribution is not calibrated"};
 if(!Number.isInteger(x.series)||x.series<1||!x.stringsByController.length||
     x.stringsByController.some(n=>!Number.isInteger(n)||n<1))
   throw new ModelFailure("INVALID_INPUT","Invalid array string count");
 nonnegative("irradianceWm2",x.irradianceWm2);
 finite("cellTemperatureC",x.cellTemperatureC);
 nonnegative("legacySnowFraction",x.legacySnowFraction);
 const module=singleDiodeMpp(LONGI_435_PVSYST,x.irradianceWm2,x.cellTemperatureC);
 const coldVoc=x.series*module.openCircuitVoltageV;
 if(coldVoc>x.mpptAbsoluteVocV||coldVoc>x.mpptOperatingVocV)
   return {status:"fail",reason:"Panel Voc exceeds controller limit at provided cell temperature",
     seriesVocV:coldVoc,limitAbsoluteV:x.mpptAbsoluteVocV,limitOperatingV:x.mpptOperatingVocV};
 const controllers=x.stringsByController.map(strings=>{
   const isc=strings*module.shortCircuitCurrentA;
   if(isc>x.mpptIscLimitA)
     return {status:"fail" as const,strings,iscA:isc,
       reason:"Controller PV Isc limit exceeded"};
   const bus=solvePvBus({
     maximumPanelPowerW:module.maxPowerW*x.series*strings,
     voltageAtMaxPowerV:x.series*(module.maxPowerVoltageV||40.8),
     pvWireLoopOhm:x.pvCableLoopOhm,
     mpptEfficiency:x.mpptEfficiency,
     mpptMaxOutputCurrentA:x.mpptCurrentLimitA,
     batteryBusVoltageV:x.busVoltageV,
     controllerWireLoopOhm:x.controllerCableLoopOhm
   });
   return {status:"estimated" as const,strings,iscA:isc,
     maximumArrayW:module.maxPowerW*x.series*strings,
     maximumBusW:bus.busPowerW,controllerCableLossW:bus.controllerCableLossW,
     pvCableLossW:bus.pvCableLossW,mpptLossW:bus.mpptLossW};
 });
 if(controllers.some(x=>x.status==="fail"))
   return {status:"fail",reason:"Manufacturer input current limit exceeded",controllers};
 const envelope=controllers.reduce((s,c)=>s+(typeof c.maximumBusW==="number"?c.maximumBusW:0),0);
 return {status:"estimated",schema:1,validation:"partial_reference_validation",
   explanation:"Modeled upper-generation envelope, NOT predicted delivered/charged power; legacy can curtail further",
   boundaryConditions:{irradianceWm2:x.irradianceWm2,cellTemperatureC:x.cellTemperatureC,
     busVoltageV:x.busVoltageV,series:x.series,stringsByController:[...x.stringsByController]},
   moduleMppW:module.maxPowerW,controllerMaximumEnvelopeW:envelope,controllers,
   legacyControllerOutputW:x.legacyControllerOutputW,
   diagnosticDeltaW:x.legacyControllerOutputW===null?null:envelope-x.legacyControllerOutputW,
   limitations:["Effective irradiance/cell temperature are inherited from legacy weather; this is not an independent weather validation",
    "No modeled charge taper, snow patches, bypass-diode strings, MPPT dynamic tracking or output sink constraint",
    "Published PVsyst IV parameters are a model, not independently instrumented field tests",
    "Peak controller efficiency used at all loads; not field validated"]};
}
export function runReferenceIsland(spec:Readonly<IslandSpec>,state:Readonly<IslandState>,
 request:Readonly<IslandRequest>){
 return advanceReferenceIsland(spec,state,request);
}

/** Inspect the mathematical authority without updating the simulation state.
 * Formula definitions, dependency closure, semantics and provenance are
 * independent from the visual presentation and imperative runtime.
 */
type ModelKey=keyof typeof MATHEMATICS;
function mathModel(name:string){
 if(!Object.prototype.hasOwnProperty.call(MATHEMATICS,name))
   throw new ModelFailure("INVALID_INPUT","Unregistered mathematical model "+name);
 return MATHEMATICS[name as ModelKey];
}
export function getMathematicalDefinitions(){
 return JSON.parse(JSON.stringify(
  Object.fromEntries(Object.entries(MATHEMATICS).map(([name,model])=>
    [name,{id:model.spec.id,revision:model.spec.revision,
      inputs:model.spec.inputs,equations:model.ordered,
      invariants:model.spec.invariants}]))
 ));
}
export function evaluateMathematics(
 name:string,variables:Readonly<Record<string,number>>){
 return mathModel(name).evaluate(variables);
}
/** Wiring validity is only structural, NEVER a certified electrical installation. */
export function inspectInstallation(graph:InstallationGraph,seconds:number){
 return evaluateInstallation(graph,seconds);
}

export {makeSyntheticBenchSpec};

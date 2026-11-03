/**
 * Conservative, reference-only single-phase island energy step.
 * Deterministic, side-effect-free, event driven at generator start/fuel exhaustion
 * and battery charge boundaries. No appliances with unknown startup behavior are
 * permitted. No generator->battery charger or 240 V transfer is falsely simulated.
 *
 * This is a next-engine verification kernel, not the live UI or equipment certification.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
import {solvePvBus,PvBusInput,PvBusResult} from "./solar";
import {integrateBatteryElectrical,BatteryElectricalSpec,BatteryElectricalState,BatteryStep} from "./battery";
import {assessAcLoads,AcDemand,InverterLimits} from "./ac";
import {advanceGenerator,GeneratorSpec,GeneratorState,GeneratorCommand,GeneratorAdvance} from "./generator";
import {assertPowerBalance} from "./numerical";
import {MATHEMATICS} from "./math/models";
import type {MathEvaluation} from "./math/registry";

export interface IslandSpec {
  readonly inverter:InverterLimits;
  readonly battery:BatteryElectricalSpec;
  readonly pv:PvBusInput;
  /** Must be independently confirmed before any use in an actual system. */
  readonly allow120VGeneratorPassThrough:boolean;
  readonly generator:GeneratorSpec|null;
}
export interface IslandState {
  readonly battery:BatteryElectricalState;
  readonly generator:GeneratorState|null;
  readonly elapsedSeconds:number;
}
export interface IslandRequest {
  readonly loads:readonly AcDemand[];
  readonly durationSeconds:number;
  readonly generatorCommand:GeneratorCommand;
  /** Charging the battery from the generator is not yet supported by this kernel. */
  readonly generatorChargerTargetAcW?:number;
}
export interface IslandLedgerWh {
  requestedAc:number;servedAc:number;unservedAc:number;
  generatorAc:number;inverterAc:number;inverterDc:number;
  inverterLoss:number;pvPotential:number;pvCurtailed:number;
  pvWireLoss:number;mpptLoss:number;controllerWireLoss:number;
  pvBus:number;batteryTerminal:number;batteryChemical:number;
  batteryHeat:number;batteryChargeCoulombicLoss:number;
}
export interface IslandMathFrame {
  readonly durationSeconds:number;
  readonly pv:MathEvaluation;
  readonly battery:MathEvaluation;
  readonly acService:MathEvaluation;
}
export interface IslandResult {
  /** Only committed, accepted physical substeps are captured. */
  readonly mathFrames?:readonly IslandMathFrame[];
  readonly status:"complete"|"unserved"|"indeterminate";
  readonly nextState:IslandState;
  readonly ledgerWh:IslandLedgerWh;
  readonly generator:GeneratorAdvance|null;
  readonly reasons:readonly string[];
  readonly substeps:number;
  readonly validation:"mathematical_only_not_field_calibrated";
}

function emptyLedger():IslandLedgerWh{
  return {requestedAc:0,servedAc:0,unservedAc:0,generatorAc:0,inverterAc:0,
    inverterDc:0,inverterLoss:0,pvPotential:0,pvCurtailed:0,
    pvWireLoss:0,mpptLoss:0,controllerWireLoss:0,pvBus:0,
    batteryTerminal:0,batteryChemical:0,batteryHeat:0,batteryChargeCoulombicLoss:0};
}
function maxChargingTerminalPowerW(b:BatteryElectricalSpec,s:BatteryElectricalState,seconds:number):number{
  if(!s.chargeConnected||s.soc>=b.socCeiling-1e-12)return 0;
  const byCapacity=(b.socCeiling-s.soc)*b.capacityAh*3600/(seconds*b.coulombicChargeEfficiency);
  const amps=Math.min(b.maximumChargeCurrentA,byCapacity);
  return amps*(b.openCircuitVoltageV+amps*b.internalResistanceOhm);
}
interface OperatingPoint{
  genW:number; invAcW:number; invDcW:number;invLossW:number;
  pv:PvBusResult; battery:BatteryStep; servedW:number; unservedW:number;
}
function operatingPoint(spec:IslandSpec, state:BatteryElectricalState,
  requestW:number, generatorW:number,seconds:number,runInverter:boolean):OperatingPoint {
  const generatorDelivered=Math.min(requestW,generatorW);
  // A generator on the AC input and an inverter output cannot be summed as
  // concurrent sources without an independently validated PowerAssist/parallel
  // topology. In pass-through mode, any generator overload is unserved.
  const inverterEnabled=runInverter&&generatorDelivered===0;
  const invAc=inverterEnabled?requestW:0;
  const invLoss=inverterEnabled?
    (spec.inverter.inverterUnits*spec.inverter.idleWPerUnit+
     invAc*(1/spec.inverter.estimatedRunningEfficiency-1)):0;
  const invDc=invAc+invLoss;
  const chargeHeadroom=maxChargingTerminalPowerW(spec.battery,state,seconds);
  const solar=solvePvBus({...spec.pv,
    busSinkLimitW:invDc+chargeHeadroom,intervalSeconds:seconds});
  const netBatteryTerminal=invDc-solar.busPowerW;
  const battery=integrateBatteryElectrical(spec.battery,state,netBatteryTerminal,seconds);
  assertPowerBalance("Island DC node",
    [solar.busPowerW,Math.max(0,netBatteryTerminal)],
    [invDc,Math.max(0,-netBatteryTerminal)]);
  assertPowerBalance("Inverter DC->AC",
    [invDc],[invAc,invLoss]);
  const served=generatorDelivered+invAc;
  return {genW:generatorDelivered,invAcW:invAc,invDcW:invDc,invLossW:invLoss,pv:solar,battery,
    servedW:served,unservedW:Math.max(0,requestW-served)};
}
function recoverable(e:unknown):boolean{
  return e instanceof ModelFailure&&
    ["BMS_DISCONNECTED","SOC_BOUND","CURRENT_LIMIT","VOLTAGE_LIMIT",
      "PHYSICAL_INFEASIBILITY"].includes(e.code);
}
function collect(ledger:IslandLedgerWh,p:OperatingPoint,dt:number,
 requestedW:number,frames:IslandMathFrame[]):void {
  const h=dt/3600;
  const acService=MATHEMATICS.acService.evaluate({
    "ac.requestedW":requestedW,"ac.servedW":p.servedW,
    "interval.seconds":dt
  });
  ledger.requestedAc+=acService.values["ac.requestedWh"];
  ledger.servedAc+=acService.values["ac.servedWh"];
  ledger.unservedAc+=acService.values["ac.unservedWh"];
  ledger.generatorAc+=p.genW*h;
  frames.push({durationSeconds:dt,pv:p.pv.mathTrace,
    battery:p.battery.mathTrace,acService});
  ledger.inverterAc+=p.invAcW*h;ledger.inverterDc+=p.invDcW*h;ledger.inverterLoss+=p.invLossW*h;
  ledger.pvPotential+=p.pv.maximumPanelPowerW*h;
  ledger.pvCurtailed+=p.pv.curtailedPanelW*h;
  ledger.pvWireLoss+=p.pv.pvCableLossW*h;
  ledger.mpptLoss+=p.pv.mpptLossW*h;
  ledger.controllerWireLoss+=p.pv.controllerCableLossW*h;
  ledger.pvBus+=p.pv.busPowerW*h;
  ledger.batteryTerminal+=p.battery.terminalPowerW*h;
  ledger.batteryChemical+=p.battery.chemicalPowerW*h;
  ledger.batteryHeat+=p.battery.batteryInternalHeatW*h;
  ledger.batteryChargeCoulombicLoss+=p.battery.coulombicChargeLossW*h;
}

/** Pure reference kernel for steady AC loads. Aborts rather than faking missing physics.
 * It can return unmet load after a battery reaches its reserve within the interval.
 * The generator's time-sliced output is exact for its stated piecewise fuel-rate assumption.
 */
export function advanceReferenceIsland(
  spec:Readonly<IslandSpec>,old:Readonly<IslandState>,request:Readonly<IslandRequest>
):IslandResult {
  const seconds=finite("durationSeconds",request.durationSeconds);
  if(!(seconds>0&&seconds<=60))
    throw new ModelFailure("INVALID_INPUT","Reference engine advances 0-60 seconds at a time");
  nonnegative("elapsedSeconds",old.elapsedSeconds);
  const ledger=emptyLedger();
  const reasons:string[]=[];
  const ac=assessAcLoads(request.loads,spec.inverter);
  if(ac.status!=="pass"||request.loads.some(l=>l.starting!==undefined)){
    return {status:"indeterminate",nextState:old,ledgerWh:ledger,generator:null,
      reasons:ac.reasons.concat(["AC topology or motor startup needs additional verified constraints"]),
      substeps:0,validation:"mathematical_only_not_field_calibrated"};
  }
  if(request.generatorChargerTargetAcW!==undefined&&request.generatorChargerTargetAcW!==0)
    return {status:"indeterminate",nextState:old,ledgerWh:ledger,generator:null,
      reasons:["Generator-to-battery charge topology has not yet been independently modeled/validated"],
      substeps:0,validation:"mathematical_only_not_field_calibrated"};
  if(spec.generator&&spec.inverter.phases!=="120V"&&spec.allow120VGeneratorPassThrough)
    return {status:"indeterminate",nextState:old,ledgerWh:ledger,generator:null,
      reasons:["120/240 V generator transfer topology is not yet independently validated"],
      substeps:0,validation:"mathematical_only_not_field_calibrated"};
  if(spec.generator&&(!old.generator||!spec.allow120VGeneratorPassThrough))
    return {status:"indeterminate",nextState:old,ledgerWh:ledger,generator:null,
      reasons:["Generator state and explicit validated single-phase pass-through required"],
      substeps:0,validation:"mathematical_only_not_field_calibrated"};
  let generator:GeneratorAdvance|null=null;
  let segments:{durationSeconds:number;deliveredW:number}[]=[{durationSeconds:seconds,deliveredW:0}];
  if(spec.generator&&old.generator){
    // Rated generator VA is not yet represented here. Therefore only PF=1 loads
    // are supported when the generator is connected; no inference about inductive starts.
    if(ac.requestedVA>ac.requestedW+1e-7)
      return {status:"indeterminate",nextState:old,ledgerWh:ledger,generator:null,
        reasons:["Generator apparent-power constraint must be independently specified"],
        substeps:0,validation:"mathematical_only_not_field_calibrated"};
    generator=advanceGenerator(spec.generator,old.generator,request.generatorCommand,
      ac.requestedW,seconds);
    segments=generator.segments.map(s=>({durationSeconds:s.durationSeconds,deliveredW:s.deliveredW}));
  }
  let battery=old.battery,substeps=0;
  const mathFrames:IslandMathFrame[]=[];
  for(const segment of segments){
    let left=segment.durationSeconds;
    while(left>1e-9){
      if(++substeps>100)throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","Too many island event substeps");
      let point:OperatingPoint,runInv=segment.deliveredW===0;
      try{point=operatingPoint(spec,battery,ac.requestedW,segment.deliveredW,left,runInv);}
      catch(e){
        if(!recoverable(e))throw e;
        runInv=false;
        reasons.push("Inverter demand rejected at an electrical/BMS limit; entire remaining AC inverter load shed");
        point=operatingPoint(spec,battery,ac.requestedW,segment.deliveredW,left,false);
      }
      if(point.battery.supportedSeconds<=1e-9&&runInv){
        runInv=false;reasons.push("Battery reserve boundary reached; inverter load shed");
        point=operatingPoint(spec,battery,ac.requestedW,segment.deliveredW,left,false);
      }
      if(point.battery.supportedSeconds<=1e-9)
        throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","Battery reached boundary despite output curtailment");
      if(point.battery.supportedSeconds<left-1e-9){
        const dt=point.battery.supportedSeconds;
        point=operatingPoint(spec,battery,ac.requestedW,segment.deliveredW,dt,runInv);
        if(point.battery.supportedSeconds<dt-1e-6)
          throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","Battery boundary did not converge on split interval");
        collect(ledger,point,dt,ac.requestedW,mathFrames);
        battery={...battery,soc:point.battery.nextSoc};
        left-=dt;
        reasons.push("Battery reached charge/discharge boundary within an operating interval");
      }else{
        collect(ledger,point,left,ac.requestedW,mathFrames);
        battery={...battery,soc:point.battery.nextSoc};
        left=0;
      }
    }
  }
  // Independent whole-step ledgers. Signed battery terminal energy separates charge from discharge.
  assertPowerBalance("Integrated AC service",[ledger.requestedAc],[ledger.servedAc,ledger.unservedAc]);
  assertPowerBalance("Integrated DC bus",[ledger.pvBus,Math.max(0,ledger.batteryTerminal)],
    [ledger.inverterDc,Math.max(0,-ledger.batteryTerminal)]);
  assertPowerBalance("Integrated solar potential",[ledger.pvPotential],
    [ledger.pvCurtailed,ledger.pvWireLoss,ledger.mpptLoss,ledger.controllerWireLoss,ledger.pvBus]);
  assertPowerBalance("Integrated battery terminals",[ledger.batteryChemical],
    [ledger.batteryTerminal,ledger.batteryHeat,ledger.batteryChargeCoulombicLoss]);
  const nextState:IslandState={elapsedSeconds:old.elapsedSeconds+seconds,battery,
    generator:generator?generator.state:old.generator};
  return {status:ledger.unservedAc>1e-10?"unserved":"complete",
    nextState,ledgerWh:ledger,generator,reasons,substeps,
    mathFrames,validation:"mathematical_only_not_field_calibrated"};
}

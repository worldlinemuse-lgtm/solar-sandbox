import {ModelFailure,finite,inRange,nonnegative} from "./contracts";
import {deliveryCurrentA,extractionCurrentA} from "./numerical";
import {MATHEMATICS} from "./math/models";
import type {MathEvaluation} from "./math/registry";

/** Fixed-Vmp constrained maximum-power proxy.
 * Uses the actual extracted current for PV and controller-to-bus I²R losses.
 * It is NOT a complete diode I-V / dynamically tracked MPPT model.
 */
export interface PvBusInput {
  readonly maximumPanelPowerW: number;
  readonly voltageAtMaxPowerV: number;
  readonly pvWireLoopOhm: number;
  readonly mpptEfficiency: number;
  readonly mpptMaxOutputCurrentA: number;
  readonly batteryBusVoltageV: number;
  readonly controllerWireLoopOhm: number;
  readonly busSinkLimitW?: number;
}
export interface PvBusResult {
  readonly maximumPanelPowerW:number;
  readonly curtailedPanelW:number;
  readonly extractedPanelW:number;
  readonly panelCurrentA:number;
  readonly pvCableLossW:number;
  readonly controllerInputW:number;
  readonly mpptLossW:number;
  readonly controllerOutputW:number;
  readonly controllerCableLossW:number;
  readonly busCurrentA:number;
  readonly busPowerW:number;
  readonly powerResidualW:number;
  /** Equation-registered values and provenance for the accepted operating point. */
  readonly mathTrace:MathEvaluation;
  readonly validation:"estimated_operating_point";
}

export function solvePvBus(x:Readonly<PvBusInput>):PvBusResult {
  const p=nonnegative("maximumPanelPowerW",x.maximumPanelPowerW);
  const v=finite("voltageAtMaxPowerV",x.voltageAtMaxPowerV);
  if(v<=0)throw new ModelFailure("INVALID_INPUT","Vmp must exceed zero");
  const rp=nonnegative("pvWireLoopOhm",x.pvWireLoopOhm);
  const rc=nonnegative("controllerWireLoopOhm",x.controllerWireLoopOhm);
  const eff=inRange("mpptEfficiency",x.mpptEfficiency,0.000001,1);
  const imax=nonnegative("mpptMaxOutputCurrentA",x.mpptMaxOutputCurrentA);
  const vb=finite("batteryBusVoltageV",x.batteryBusVoltageV);
  if(vb<=0)throw new ModelFailure("INVALID_INPUT","Battery bus V must exceed zero");
  const sink=x.busSinkLimitW===undefined?Infinity:nonnegative("busSinkLimitW",x.busSinkLimitW);
  // The physically deliverable maximum at the source's MPP-voltage proxy.
  const iMpp=p/v;
  const maxCurrent=rp>0?Math.min(iMpp,v/(2*rp)):iMpp;
  const availableAtController=Math.max(0,v*maxCurrent-rp*maxCurrent*maxCurrent);
  const pControllerMax=availableAtController*eff;
  const iAvailable=deliveryCurrentA(vb,rc,pControllerMax);
  const iBus=Math.min(iAvailable,imax,sink/vb);
  const busW=iBus*vb;
  const cableW=iBus*iBus*rc;
  const controllerOut=busW+cableW;
  const controllerIn=controllerOut/eff;
  const iPv=extractionCurrentA(v,rp,controllerIn);
  if(iPv>maxCurrent+1e-7*Math.max(1,maxCurrent))
    throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","PV operating current outside admissible branch");
  // The operating-point solver supplies only Ipv and Ibus. Every reported
  // physical transformation now comes from the canonical equation registry,
  // which independently checks both MPPT and whole-PV conservation identities.
  const mathTrace=MATHEMATICS.pv.evaluate({
    "panel.availableW":p,"panel.operatingV":v,"panel.currentA":iPv,
    "pv.loopOhm":rp,"mppt.efficiency":eff,
    "bus.voltageV":vb,"bus.currentA":iBus,
    "controller.loopOhm":rc,"interval.seconds":1
  });
  const m=mathTrace.values;
  const residual=mathTrace.invariants.find(x=>x.id==="pv.global_conservation")!.value;
  return {maximumPanelPowerW:p,curtailedPanelW:m["pv.curtailedW"],
    extractedPanelW:m["pv.extractedW"],panelCurrentA:iPv,
    pvCableLossW:m["pv.cableLossW"],controllerInputW:m["mppt.inputW"],
    mpptLossW:m["mppt.heatW"],controllerOutputW:m["mppt.outputW"],
    controllerCableLossW:m["controller.cableLossW"],busCurrentA:iBus,
    busPowerW:m["bus.deliveredW"],powerResidualW:residual,
    mathTrace,validation:"estimated_operating_point"};
}

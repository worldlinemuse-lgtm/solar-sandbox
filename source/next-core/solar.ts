import {ModelFailure,finite,inRange,nonnegative} from "./contracts";
import {deliveryCurrentA,extractionCurrentA,assertPowerBalance} from "./numerical";

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
  const panelExtract=v*iPv;
  const pvLoss=iPv*iPv*rp;
  const controllerLoss=controllerIn-controllerOut;
  const curtailed=Math.max(0,p-panelExtract);
  const residual=assertPowerBalance("PV/DC", [p],
    [curtailed,pvLoss,controllerLoss,cableW,busW]);
  return {maximumPanelPowerW:p,curtailedPanelW:curtailed,
    extractedPanelW:panelExtract,panelCurrentA:iPv,
    pvCableLossW:pvLoss,controllerInputW:controllerIn,
    mpptLossW:controllerLoss,controllerOutputW:controllerOut,
    controllerCableLossW:cableW,busCurrentA:iBus,
    busPowerW:busW,powerResidualW:residual,
    validation:"estimated_operating_point"};
}

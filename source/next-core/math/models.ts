/**
 * Solar Sandbox mathematical authority v1.
 *
 * Formula IDs and revisions persist independently of application code or UI.
 * Executable ASTs ARE the formulas: the English/LaTeX annotations cannot change
 * the numerical result. The solver supplies physical operating-point currents.
 * The registry verifies/captures the laws at each stage, without recomputing them
 * in a second presentation formula.
 */
import {M} from "./expressions";
import type {Expr,Unit} from "./expressions";
import {FormulaRegistry,MathDefinition,InputDefinition,EquationDefinition,
  InvariantDefinition,Stage} from "./registry";
import {EvidenceTier} from "../contracts";
const r=M.ref,c=M.c;
const nonneg={min:0},positive={min:1e-12},fraction={min:0,max:1};
type Origin=InputDefinition["role"];
function input(name:string,unit:Unit,role:Origin="parameter",
 evidenceTier:EvidenceTier="R3_assumed",bounds?:{min?:number;max?:number},
 evidenceIds:readonly string[]=["input:scenario_or_equipment_catalog"]):InputDefinition{
 return {name,unit,role,evidenceTier,bounds,evidenceIds,
   description:"Physical quantity supplied explicitly by state, catalog or scenario"};
}
function equation(
 id:string,stage:Stage,output:string,unit:Unit,expression:Expr,
 dependsOn:readonly string[],math:string,
 assumption="Steady-state electrical operation",
 evidenceIds:readonly string[]=["math:electrical_conservation"]
):EquationDefinition{
 return {id,revision:1,stage,output,unit,expression,dependsOn,math,
   authority:"DERIVED",evidenceTier:"R2_derived",evidenceIds,
   assumptions:[assumption],falsifier:"A trace that violates its source equation or an independent physical reference"};
}
function invariant(id:string,unit:Unit,residual:Expr,
 referenceScale:readonly string[],math:string):InvariantDefinition{
 return {id,revision:1,unit,residual,referenceScale,math,
   absoluteTolerance:1e-9,relativeTolerance:1e-9,violation:"error",
   source:"Conservation and Kirchhoff electrical-network identities"};
}

export const WIRE_LOSS_MATH:MathDefinition={
 id:"solar.wire.segment",revision:1,
 inputs:[
  input("wire.currentA","A","state"),
  input("wire.loopOhm","ohm","parameter","R3_assumed",nonneg),
  input("interval.seconds","s","state","R2_derived",positive)
 ],
 equations:[
  equation("wire.voltage_drop.v1","electrical","wire.voltageDropV","V",
   M.mul(r("wire.currentA"),r("wire.loopOhm")),
   ["wire.currentA","wire.loopOhm"],String.raw`\Delta V=IR`),
  equation("wire.ohmic_loss.v1","electrical","wire.heatW","W",
   M.i2r(r("wire.currentA"),r("wire.loopOhm")),
   ["wire.currentA","wire.loopOhm"],String.raw`P_{heat}=I^2 R`),
  equation("wire.thermal_energy.v1","energy","wire.heatWh","Wh",
   M.wh(r("wire.heatW"),r("interval.seconds")),
   ["wire.heatW","interval.seconds"],String.raw`E_{heat}=I^2 R\Delta t/3600`)
 ],
 invariants:[invariant("wire.i2r_vs_iv","W",
  M.sub(r("wire.heatW"),M.dc(r("wire.voltageDropV"),r("wire.currentA"))),
  ["wire.heatW"],String.raw`I^2R=(IR)I`)]
};

export const PV_DC_MATH:MathDefinition={
 id:"solar.pv.dc-network",revision:1,
 inputs:[
  input("panel.availableW","W","disturbance","R3_assumed",nonneg),
  input("panel.operatingV","V","state","R3_assumed",positive),
  input("panel.currentA","A","state","R2_derived",nonneg),
  input("pv.loopOhm","ohm","parameter","R3_assumed",nonneg),
  input("mppt.efficiency","1","parameter","R3_assumed",{min:1e-12,max:1}),
  input("bus.voltageV","V","state","R3_assumed",positive),
  input("bus.currentA","A","state","R2_derived",nonneg),
  input("controller.loopOhm","ohm","parameter","R3_assumed",nonneg),
  input("interval.seconds","s","state","R2_derived",positive)
 ],
 equations:[
  equation("pv.extracted_power.v1","electrical","pv.extractedW","W",
   M.dc(r("panel.operatingV"),r("panel.currentA")),
   ["panel.operatingV","panel.currentA"],String.raw`P_{panel}=V_{mp} I_{pv}`),
  equation("pv.cable_heat.v1","electrical","pv.cableLossW","W",
   M.i2r(r("panel.currentA"),r("pv.loopOhm")),
   ["panel.currentA","pv.loopOhm"],String.raw`P_{pvwire}=I_{pv}^2R_{pv}`),
  equation("pv.converter_input.v1","conversion","mppt.inputW","W",
   M.sub(r("pv.extractedW"),r("pv.cableLossW")),
   ["pv.extractedW","pv.cableLossW"],String.raw`P_{mppt,in}=P_{panel}-I_{pv}^2R_{pv}`),
  equation("pv.converter_output.v1","conversion","mppt.outputW","W",
   M.mul(r("mppt.inputW"),r("mppt.efficiency")),
   ["mppt.inputW","mppt.efficiency"],String.raw`P_{mppt,out}=\eta_{mppt}P_{mppt,in}`,
   "MPPT load-dependent efficiency curve is not yet independently measured"),
  equation("pv.converter_loss.v1","conversion","mppt.heatW","W",
   M.sub(r("mppt.inputW"),r("mppt.outputW")),
   ["mppt.inputW","mppt.outputW"],String.raw`P_{mppt,loss}=P_{in}-P_{out}`),
  equation("pv.dc_bus_power.v1","electrical","bus.deliveredW","W",
   M.dc(r("bus.voltageV"),r("bus.currentA")),
   ["bus.voltageV","bus.currentA"],String.raw`P_{bus}=V_{bus}I_{bus}`),
  equation("pv.controller_cable_heat.v1","electrical","controller.cableLossW","W",
   M.i2r(r("bus.currentA"),r("controller.loopOhm")),
   ["bus.currentA","controller.loopOhm"],String.raw`P_{ctlwire}=I_{bus}^2R_{ctl}`),
  equation("pv.curtailment.v1","energy","pv.curtailedW","W",
   M.sub(r("panel.availableW"),r("pv.extractedW")),
   ["panel.availableW","pv.extractedW"],String.raw`P_{curtailed}=P_{available}-P_{extracted}`),
  equation("pv.energy_bus.v1","energy","bus.deliveredWh","Wh",
   M.wh(r("bus.deliveredW"),r("interval.seconds")),
   ["bus.deliveredW","interval.seconds"],String.raw`E_{bus}=P_{bus}\Delta t/3600`)
 ],
 invariants:[
  invariant("pv.controller_conversion_balance","W",
   M.sub(r("mppt.outputW"),M.add(r("bus.deliveredW"),r("controller.cableLossW"))),
   ["mppt.outputW","bus.deliveredW"],String.raw`P_{mppt,out}=P_{bus}+P_{ctlwire}`),
  invariant("pv.global_conservation","W",
   M.sub(r("panel.availableW"),
    M.add(r("pv.curtailedW"),
     M.add(r("pv.cableLossW"),
      M.add(r("mppt.heatW"),
       M.add(r("controller.cableLossW"),r("bus.deliveredW")))))),
   ["panel.availableW","bus.deliveredW"],
   String.raw`P_{pv,potential}=P_{curtailed}+P_{pvwire}+P_{mppt,loss}+P_{ctlwire}+P_{bus}`)
 ]
};

export const BATTERY_MATH:MathDefinition={
 id:"solar.battery.electrical",revision:1,
 inputs:[
  input("battery.ocvV","V","parameter","R3_assumed",positive),
  input("battery.currentA","A","state","R2_derived"),
  input("battery.internalOhm","ohm","parameter","R3_assumed",nonneg),
  input("battery.chargeEfficiency","1","parameter","R3_assumed",{min:1e-12,max:1}),
  input("battery.capacityAh","Ah","parameter","R3_assumed",positive),
  input("battery.soc","1","state","R2_derived",fraction),
  // An electrical state can remain at a protection boundary for exactly 0 s.
  input("interval.seconds","s","state","R2_derived",nonneg)
 ],
 equations:[
  equation("battery.terminal_drop.v1","electrical","battery.dropV","V",
   M.mul(r("battery.currentA"),r("battery.internalOhm")),
   ["battery.currentA","battery.internalOhm"],String.raw`\Delta V=IR`),
  equation("battery.terminal_voltage.v1","electrical","battery.terminalV","V",
   M.sub(r("battery.ocvV"),r("battery.dropV")),
   ["battery.ocvV","battery.dropV"],String.raw`V_t=V_{OCV}-IR`),
  equation("battery.terminal_power.v1","electrical","battery.terminalW","W",
   M.dc(r("battery.terminalV"),r("battery.currentA")),
   ["battery.terminalV","battery.currentA"],String.raw`P_t=V_t I`),
  equation("battery.internal_heat.v1","electrical","battery.heatW","W",
   M.i2r(r("battery.currentA"),r("battery.internalOhm")),
   ["battery.currentA","battery.internalOhm"],String.raw`P_{heat}=I^2R`),
  equation("battery.gross_energy_v1","storage","battery.grossChemicalW","W",
   M.dc(r("battery.ocvV"),r("battery.currentA")),
   ["battery.ocvV","battery.currentA"],String.raw`P_{gross}=V_{OCV}I`),
  equation("battery.charge_only_current.v1","storage","battery.chargeCurrentA","A",
   M.max(M.neg(r("battery.currentA")),c(0,"A")),
   ["battery.currentA"],String.raw`I_{charge}=\max(0,-I)`),
  equation("battery.coulombic_heat.v1","storage","battery.chargeLossW","W",
   M.mul(M.dc(r("battery.ocvV"),r("battery.chargeCurrentA")),
    M.sub(c(1),r("battery.chargeEfficiency"))),
   ["battery.ocvV","battery.chargeCurrentA","battery.chargeEfficiency"],
   String.raw`P_{coulombic}=V_{OCV} I_{charge}(1-\eta_C)`),
  equation("battery.net_chemical_v1","storage","battery.netChemicalW","W",
   M.add(r("battery.grossChemicalW"),r("battery.chargeLossW")),
   ["battery.grossChemicalW","battery.chargeLossW"],
   String.raw`P_{chemical,net}=V_{OCV}I+P_{coulombic}`),
  equation("battery.effective_current.v1","storage","battery.effectiveCurrentA","A",
   M.add(r("battery.currentA"),
    M.mul(r("battery.chargeCurrentA"),M.sub(c(1),r("battery.chargeEfficiency")))),
   ["battery.currentA","battery.chargeCurrentA","battery.chargeEfficiency"],
   String.raw`I_{eff}=I+I_{charge}(1-\eta_C)`),
  equation("battery.integrated_charge.v1","energy","battery.deltaAh","Ah",
   M.ah(r("battery.effectiveCurrentA"),r("interval.seconds")),
   ["battery.effectiveCurrentA","interval.seconds"],
   String.raw`\Delta Q_{Ah}=I_{eff}\Delta t/3600`),
  equation("battery.soc_after.v1","storage","battery.socNext","1",
   M.sub(r("battery.soc"),M.div(r("battery.deltaAh"),r("battery.capacityAh"))),
   ["battery.soc","battery.deltaAh","battery.capacityAh"],
   String.raw`SOC'=SOC-\Delta Q_{Ah}/Q_{capacity}`),
  equation("battery.terminal_energy.v1","energy","battery.terminalWh","Wh",
   M.wh(r("battery.terminalW"),r("interval.seconds")),
   ["battery.terminalW","interval.seconds"],String.raw`E_{terminal}=P_t\Delta t/3600`)
 ],
 invariants:[
  invariant("battery.terminal_energy_conservation","W",
   M.sub(r("battery.netChemicalW"),
    M.add(r("battery.terminalW"),M.add(r("battery.heatW"),r("battery.chargeLossW")))),
   ["battery.netChemicalW","battery.terminalW"],
   String.raw`P_{chemical,net}=P_t+P_{heat}+P_{coulombic}`),
  invariant("battery.terminal_equivalent","W",
   M.sub(r("battery.grossChemicalW"),M.add(r("battery.terminalW"),r("battery.heatW"))),
   ["battery.grossChemicalW"],
   String.raw`V_{OCV}I=V_tI+I^2R`)
 ]
};

export const AC_POWER_MATH:MathDefinition={
 id:"solar.ac.power-factor",revision:1,
 inputs:[
  input("ac.apparentVA","VA","observation","R3_assumed",nonneg),
  input("ac.powerFactor","1","observation","R3_assumed",fraction),
  input("interval.seconds","s","state","R2_derived",positive)
 ],
 equations:[
  equation("ac.real_from_va.v1","conversion","ac.realW","W",
   M.acW(r("ac.apparentVA"),r("ac.powerFactor")),
   ["ac.apparentVA","ac.powerFactor"],String.raw`P_{real}=S_{apparent}\cdot PF`,
   "AC real and apparent power are semantically distinct"),
  equation("ac.real_energy.v1","energy","ac.energyWh","Wh",
   M.wh(r("ac.realW"),r("interval.seconds")),
   ["ac.realW","interval.seconds"],String.raw`E_{ac}=P_{real}\Delta t/3600`)
 ],
 invariants:[]
};

export const AC_SERVICE_MATH:MathDefinition={
 id:"solar.ac.service",revision:1,
 inputs:[
  input("ac.requestedW","W","state","R3_assumed",nonneg),
  input("ac.servedW","W","state","R2_derived",nonneg),
  input("interval.seconds","s","state","R2_derived",positive)
 ],
 equations:[
  {...equation("ac.unserved_power.v1","energy","ac.unservedW","W",
   M.sub(r("ac.requestedW"),r("ac.servedW")),
   ["ac.requestedW","ac.servedW"],String.raw`P_{unserved}=P_{requested}-P_{served}`),
   bounds:nonneg},
  equation("ac.requested_energy.v1","energy","ac.requestedWh","Wh",
   M.wh(r("ac.requestedW"),r("interval.seconds")),
   ["ac.requestedW","interval.seconds"],String.raw`E_{requested}=P_{requested}\Delta t/3600`),
  equation("ac.served_energy.v1","energy","ac.servedWh","Wh",
   M.wh(r("ac.servedW"),r("interval.seconds")),
   ["ac.servedW","interval.seconds"],String.raw`E_{served}=P_{served}\Delta t/3600`),
  equation("ac.unserved_energy.v1","energy","ac.unservedWh","Wh",
   M.wh(r("ac.unservedW"),r("interval.seconds")),
   ["ac.unservedW","interval.seconds"],String.raw`E_{unserved}=P_{unserved}\Delta t/3600`)
 ],
 invariants:[invariant("ac.service_energy_balance","Wh",
   M.sub(r("ac.requestedWh"),M.add(r("ac.servedWh"),r("ac.unservedWh"))),
   ["ac.requestedWh"],String.raw`E_{requested}=E_{served}+E_{unserved}`)]
};

export const MATHEMATICS={
 wire:new FormulaRegistry(WIRE_LOSS_MATH),
 pv:new FormulaRegistry(PV_DC_MATH),
 battery:new FormulaRegistry(BATTERY_MATH),
 acPower:new FormulaRegistry(AC_POWER_MATH),
 acService:new FormulaRegistry(AC_SERVICE_MATH)
} as const;

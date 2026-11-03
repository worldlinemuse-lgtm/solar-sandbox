/** Published model identities plus explicit synthetic fixture parameters.
 * Manufacturer peak efficiencies and our synthetic battery are NOT calibrated curves.
 */
import {PvModuleSpec,makePvModuleSnapshot,checkControllerLimits} from "./pv-module";
import {sandiaTemperature} from "./solar-thermal";
import {IslandSpec} from "./island";
import {BatteryElectricalSpec} from "./battery";
import {InverterLimits} from "./ac";
import {GeneratorSpec} from "./generator";
import {ModelFailure} from "./contracts";

export const LONGI_LR4_72HBD_435M:Readonly<PvModuleSpec>={
 id:"LR4-72HBD-435M",
 pStcW:435,vmpStcV:40.8,vocStcV:49.1,iscStcA:11.36,
 powerTempCoefficientPerC:-0.00350,
 vocTempCoefficientPerC:-0.00284,
 iscTempCoefficientPerC:0.00050,
 sourceReference:"LONGi 20210508 V13 425-455 M; https://solarshop.baywa-re.ca/site/assets/Product%20Specs/LON-4203_DS.pdf"
};
export const VICTRON_SMARTSOLAR_150_70:Readonly<{
 maxChargeA:number;absoluteVocV:number;operatingVocV:number;maxPvIscA:number;peakEfficiency:number;
 sourceUrl:string;
}>={
 maxChargeA:70,absoluteVocV:150,operatingVocV:145,maxPvIscA:50,
 peakEfficiency:0.98,
 sourceUrl:"https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html"
};
export const VICTRON_MULTIPLUS_24_3000_120:Readonly<InverterLimits>={
 phases:"120V",continuousWPerLeg:2400,continuousVAPerLeg:3000,
 peakWPerLeg:5500,peakVAPerLeg:null,peakDurationSeconds:null,
 idleWPerUnit:13,estimatedRunningEfficiency:.94,inverterUnits:1
};
export const HONDA_EU2200I:Readonly<GeneratorSpec>={
 ratedW:1800,tankCapacityGallons:.95,
 quarterLoadGallonsPerHour:.95/8.1,ratedLoadGallonsPerHour:.95/3.2,
 // Explicitly ASSUMED human-operated times; not published Honda test measurements:
 startSeconds:15,coolingSeconds:120,refuelSeconds:45
};
/** A **fictional** two-module 24-V laboratory reference bank.
 * These electrical values are fixture parameters, NOT certified LiTime or Battle Born values.
 */
export const SYNTHETIC_BATTERY_24V_100AH:Readonly<BatteryElectricalSpec>={
 capacityAh:100,openCircuitVoltageV:26.4,internalResistanceOhm:.02,
 maximumChargeCurrentA:50,maximumDischargeCurrentA:100,
 minimumTerminalVoltageV:20,maximumTerminalVoltageV:32,
 coulombicChargeEfficiency:.98,socFloor:.1,socCeiling:1
};
export function makeSyntheticBenchSpec(point:{
 effectiveIrradianceWm2:number;ambientC:number;windMps:number;
 shadeFraction?:number;snowFraction?:number;
}):{spec:IslandSpec;cellTemperatureC:number;arrayPowerW:number}{
 const temperature=sandiaTemperature(point.effectiveIrradianceWm2,
    point.ambientC,point.windMps,"open_rack_glass_glass");
 const pv=makePvModuleSnapshot(LONGI_LR4_72HBD_435M,
    {series:2,parallel:2},{
      effectiveIrradianceWm2:point.effectiveIrradianceWm2,
      cellTemperatureC:temperature.cellC,
      shadeFraction:point.shadeFraction??0,
      snowCoveredFraction:point.snowFraction??0,
      additionalLossFraction:0
    });
 const valid=checkControllerLimits(pv,{
  absoluteMaxVocV:VICTRON_SMARTSOLAR_150_70.absoluteVocV,
  operatingMaxVocV:VICTRON_SMARTSOLAR_150_70.operatingVocV,
  maxInputIscA:VICTRON_SMARTSOLAR_150_70.maxPvIscA
 });
 if(valid.status==="fail")throw new ModelFailure("VOLTAGE_LIMIT",valid.reasons.join("; "));
 return {spec:{
  inverter:VICTRON_MULTIPLUS_24_3000_120,
  battery:SYNTHETIC_BATTERY_24V_100AH,
  pv:{maximumPanelPowerW:pv.availablePowerW,voltageAtMaxPowerV:pv.seriesVmpV,
   pvWireLoopOhm:0.10,mpptEfficiency:VICTRON_SMARTSOLAR_150_70.peakEfficiency,
   mpptMaxOutputCurrentA:VICTRON_SMARTSOLAR_150_70.maxChargeA,
   batteryBusVoltageV:26.4,controllerWireLoopOhm:0.03},
  allow120VGeneratorPassThrough:false,generator:null
 },cellTemperatureC:temperature.cellC,arrayPowerW:pv.availablePowerW};
}

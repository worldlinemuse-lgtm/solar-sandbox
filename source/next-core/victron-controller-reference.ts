/**
 * Scope-limited Victron SmartSolar MPPT 150/70 VE.Can reference constraints.
 *
 * Manufacturer explicitly distinguishes:
 * - 150 V ABSOLUTE cold-weather PV open-circuit maximum
 * - 145 V startup/operating PV open-circuit maximum
 * - 50 A TOTAL PV short-circuit limit
 * - 30 A max current PER MC4 connector (TR variant has other terminals)
 * - charging starts when PV V>Vbat+5V, continues while PV V>=Vbat+1V
 * - output DC current max 70A, but input max power is NOT simply rated
 *   battery voltage * output current (nor does PV nominal W certify output).
 *
 * Manufacturer official spec:
 * https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html
 * https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/troubleshooting.html
 *
 * This reference math cannot certify installation wiring, protection, NEC
 * compliance, firmware/config compatibility, or real tracker performance.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export type Victron15070Termination="MC4_TWO_PAIRS"|"TR_SCREW_TERMINALS";
export interface Victron15070Point{
 readonly termination:Victron15070Termination;
 readonly mode:"starting"|"charging";
 readonly batteryBusVoltageV:number;
 readonly pvInputPortVoltageV:number|null;
 /** Independently evaluated cold-design array Voc, not a current-minute Voc. */
 readonly maximumColdDesignVocV:number|null;
 /** Design total short-circuit current INCLUDING bifacial max contribution. */
 readonly maximumDesignIscA:number|null;
 /** Design Isc per each of the two MC4 input pairs; omitted => indeterminate. */
 readonly mc4PairDesignIscA?:readonly number[]|null;
}
export interface Victron15070Assessment{
 readonly status:"checked_ratings_only"|"fail"|"indeterminate";
 readonly minimumPvOperatingVoltageV:number;
 readonly maximumContinuousBatteryChargeCurrentA:70;
 readonly maximumBatteryPortPowerEnvelopeW:number;
 readonly absoluteVocMarginV:number|null;
 readonly operatingVocMarginV:number|null;
 readonly totalIscMarginA:number|null;
 readonly mc4PairCurrentMarginsA:readonly number[]|null;
 readonly reasons:readonly string[];
 readonly validation:"exact_device_ratings_only_not_installation_approval";
}
export function assessVictron15070Point(
 x:Readonly<Victron15070Point>
):Victron15070Assessment{
 const vbat=finite("batteryBusVoltageV",x.batteryBusVoltageV);
 if(vbat<=0)throw new ModelFailure("INVALID_INPUT","Battery bus voltage must exceed zero");
 if(x.mode!=="starting"&&x.mode!=="charging")
   throw new ModelFailure("INVALID_INPUT","Unknown MPPT operating mode");
 if(x.termination!=="MC4_TWO_PAIRS"&&x.termination!=="TR_SCREW_TERMINALS")
   throw new ModelFailure("INVALID_INPUT","Unverified PV input connector variant");
 const threshold=vbat+(x.mode==="starting"?5:1);
 let failed=false,missing=false;
 const reasons:string[]=[];
 const portV=x.pvInputPortVoltageV===null?null:
   nonnegative("pvInputPortVoltageV",x.pvInputPortVoltageV);
 if(portV===null){missing=true;reasons.push("Controller PV port voltage unavailable");}
 else if(portV<threshold-1e-9){
   failed=true;reasons.push("PV voltage is below published start/run headroom at battery bus");
 }
 // A running PV voltage does not prove the 24-hour/cold open-circuit design.
 const cold=x.maximumColdDesignVocV===null?null:
   nonnegative("maximumColdDesignVocV",x.maximumColdDesignVocV);
 const absMargin=cold===null?null:150-cold;
 const opMargin=cold===null?null:145-cold;
 if(cold===null){missing=true;reasons.push("Cold design Voc is not independently established");}
 if(absMargin!==null&&absMargin<-1e-9){
   failed=true;reasons.push("150 V absolute cold Voc maximum exceeded");
 }
 if(opMargin!==null&&opMargin<-1e-9){
   failed=true;reasons.push("145 V operating Voc maximum exceeded");
 }
 const isc=x.maximumDesignIscA===null?null:
   nonnegative("maximumDesignIscA",x.maximumDesignIscA);
 const totalIscMargin=isc===null?null:50-isc;
 if(isc===null){missing=true;reasons.push("Maximum design PV short-circuit current absent");}
 else if(totalIscMargin<-1e-9){
   failed=true;reasons.push("Total design Isc exceeds 50 A manufacturer limit");
 }
 let margins:readonly number[]|null=null;
 if(x.termination==="MC4_TWO_PAIRS"){
   const distribution=x.mc4PairDesignIscA??null;
   if(distribution===null){
     missing=true;reasons.push("MC4 per-pair current allocation unknown; total 50 A check alone is insufficient");
   } else {
     if(distribution.length!==2)throw new ModelFailure("INVALID_INPUT",
       "This MC4 variant has exactly two input connector pairs");
     const amps=distribution.map((a,j)=>nonnegative("MC4 input pair "+j+" design IscA",a));
     if(isc!==null&&Math.abs(amps[0]+amps[1]-isc)>1e-6*Math.max(1,isc))
       throw new ModelFailure("INVALID_INPUT",
         "Per-MC4 current allocation is inconsistent with total design Isc");
     margins=amps.map(a=>30-a);
     if(margins.some(m=>m<-1e-9)){
       failed=true;reasons.push("An MC4 input exceeds the manufacturer's 30 A per-connector rating");
     }
   }
 } else if(x.mc4PairDesignIscA!==undefined&&x.mc4PairDesignIscA!==null){
   throw new ModelFailure("INVALID_INPUT","MC4 allocation supplied for screw-terminal device");
 }
 if(!failed&&!missing)reasons.push(
   "Only these exact published electrical rating checks pass; MPPT tracking and installation approval remain unresolved");
 return {
   status:failed?"fail":missing?"indeterminate":"checked_ratings_only",
   minimumPvOperatingVoltageV:threshold,
   maximumContinuousBatteryChargeCurrentA:70,
   maximumBatteryPortPowerEnvelopeW:vbat*70,
   absoluteVocMarginV:absMargin,
   operatingVocMarginV:opMargin,totalIscMarginA:totalIscMargin,
   mc4PairCurrentMarginsA:margins,reasons,
   validation:"exact_device_ratings_only_not_installation_approval"
 };
}

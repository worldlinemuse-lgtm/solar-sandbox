/**
 * Compile-time dimensional safety for new-core boundaries.
 * Branded SI scalars prevent W, VA, Wh, V, A and s being interchangeable in TS.
 * All JSON/external values must be validated using constructors at boundaries.
 */
import {finite,nonnegative} from "./contracts";
declare const unitBrand: unique symbol;
export type Watts = number & {readonly [unitBrand]:"W"};
export type VoltAmps = number & {readonly [unitBrand]:"VA"};
export type WattHours = number & {readonly [unitBrand]:"Wh"};
export type Volts = number & {readonly [unitBrand]:"V"};
export type Amps = number & {readonly [unitBrand]:"A"};
export type Ohms = number & {readonly [unitBrand]:"ohm"};
export type Seconds = number & {readonly [unitBrand]:"s"};
export type DegreesC = number & {readonly [unitBrand]:"degC"};
export function watts(x:number):Watts{return nonnegative("watts",x) as Watts;}
export function voltAmps(x:number):VoltAmps{return nonnegative("volt amps",x) as VoltAmps;}
export function wattHours(x:number):WattHours{return finite("watt hours",x) as WattHours;}
export function volts(x:number):Volts{return nonnegative("volts",x) as Volts;}
export function amps(x:number):Amps{return finite("amps",x) as Amps;}
export function ohms(x:number):Ohms{return nonnegative("ohms",x) as Ohms;}
export function seconds(x:number):Seconds{return nonnegative("seconds",x) as Seconds;}
export function degreesC(x:number):DegreesC{return finite("degrees C",x) as DegreesC;}
export function integratePower(p:Watts,interval:Seconds):WattHours{
 return wattHours(p*interval/3600);
}
export function electricalPower(voltage:Volts,current:Amps):Watts{
 return (voltage*current) as Watts;
}
export function resistiveHeat(current:Amps,resistance:Ohms):Watts{
 return (current*current*resistance) as Watts;
}

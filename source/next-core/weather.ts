/**
 * Time integration of hourly source data.
 * NASA POWER hourly values are hourly AVERAGES with start-of-hour timestamps;
 * they are not instantaneous points to be linearly interpolated.
 * Time-standard provenance is mandatory to align weather with appliance schedules.
 */
import {ModelFailure,finite,nonnegative} from "./contracts";
export type WeatherClock="UTC"|"LST"|"CIVIL_STANDARD"|"UNKNOWN";
export interface WeatherProvenance {
  readonly datasetId:string;
  readonly sourceUrl:string;
  readonly clock:WeatherClock;
  readonly longitudeDeg:number;
  readonly latitudeDeg:number;
  readonly utcOffsetHours:number|null;
  readonly sourceHashSha256:string|null;
  readonly originalRequestUrl:string|null;
}
export interface HourlySeries {
  readonly meanValues:readonly number[];
  readonly firstHourStartSeconds:number;
  readonly units:"W/m2"|"C"|"m/s";
  readonly provenance:WeatherProvenance;
}
export interface IntegratedHourly {
  readonly timeIntegralInHours:number;
  readonly mean:number;
  readonly minimum:number;
  readonly maximum:number;
  readonly hoursTouched:number;
}
export function assertKnownClock(a:WeatherProvenance,expected:Exclude<WeatherClock,"UNKNOWN">):void{
  if(a.clock==="UNKNOWN"||a.clock!==expected) {
    throw new ModelFailure("INVALID_INPUT",
      "Weather "+a.datasetId+" uses clock "+a.clock+
      "; expected "+expected+". Supply independently verified original request/time conversion.");
  }
}
/** Exact rectangle integration of hour-mean data, including hour-boundary events.
 * For irradiance in W/m2, timeIntegralInHours is Wh/m2.
 * For temperature in C, it is degreeC-hours, not an energy quantity.
 */
export function integrateHourlyMeans(series:HourlySeries,startSecond:number,durationSeconds:number):IntegratedHourly{
  finite("startSecond",startSecond);
  if(!(finite("durationSeconds",durationSeconds)>0))
    throw new ModelFailure("INVALID_INPUT","duration must be positive");
  // An unknown clock cannot be silently aligned to a civil-time load schedule.
  // NASA POWER defaults to local SOLAR time, which differs from civil local time.
  // Conversion is a separate explicit, provenanced step, never a DST guess.
  if(series.provenance.clock==="UNKNOWN")
    throw new ModelFailure("INVALID_INPUT",
      "Unknown weather clock: original NASA POWER time-standard request must be verified");
  const first=finite("firstHourStartSeconds",series.firstHourStartSeconds);
  if(!Number.isInteger(first)||!Number.isInteger(startSecond))
    throw new ModelFailure("INVALID_INPUT",
      "Weather intervals must use integer timestamp seconds for reproducible hour boundaries");
  if(!series.meanValues.length)throw new ModelFailure("INVALID_INPUT","Empty weather series");
  const end=startSecond+durationSeconds;
  if(startSecond<first||end>first+3600*series.meanValues.length+1e-9)
    throw new ModelFailure("INVALID_INPUT","Requested interval lies outside weather samples");
  let sum=0,lo=Infinity,hi=-Infinity,n=0;
  let t=startSecond;
  while(t<end-1e-12){
    const k=Math.floor((t-first)/3600);
    if(k<0||k>=series.meanValues.length)
      throw new ModelFailure("INVALID_INPUT","Weather array index out of bounds");
    // NASA missing/fill values must be rejected, never treated as negative
    // solar generation, negative wind, or a valid sub-absolute-zero temperature.
    const value=finite("weather sample",series.meanValues[k]);
    if(series.units==="W/m2"||series.units==="m/s"){
      nonnegative("weather "+series.units+" sample",value);
    }else if(series.units==="C"){
      if(value<=-273.15)
        throw new ModelFailure("INVALID_INPUT",
          "Temperature is at/below absolute zero; missing/sentinel sample suspected");
    }else throw new ModelFailure("INVALID_INPUT","Unrecognized weather units");
    const next=Math.min(end,first+(k+1)*3600);
    if(next<=t)throw new ModelFailure("SOLVER_DID_NOT_CONVERGE","Weather hour boundary stalled");
    const sec=next-t;
    sum+=value*sec/3600;lo=Math.min(lo,value);hi=Math.max(hi,value);n++;t=next;
  }
  return {timeIntegralInHours:sum,mean:sum*3600/durationSeconds,
    minimum:lo,maximum:hi,hoursTouched:n};
}

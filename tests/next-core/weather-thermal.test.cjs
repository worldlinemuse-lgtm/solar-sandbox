"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const {integrateHourlyMeans,assertKnownClock}=require(path.join(root,".next-core-dist/weather.js"));
const {sandiaTemperature,SANDIA_THERMAL}=require(path.join(root,".next-core-dist/solar-thermal.js"));
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-9*Math.max(1,Math.abs(y)),x+" != "+y);
const source={datasetId:"fixture-hourly",sourceUrl:"https://power.larc.nasa.gov/",
 clock:"LST",latitudeDeg:41.577,longitudeDeg:-75.258,
 utcOffsetHours:null,sourceHashSha256:null,originalRequestUrl:"https://example.test/?time-standard=LST"};
test("hourly irradiance means conserve integrated energy at hour boundaries",()=>{
 const series={meanValues:[100,300,200],firstHourStartSeconds:0,units:"W/m2",provenance:source};
 const result=integrateHourlyMeans(series,1800,5400);
 close(result.timeIntegralInHours,350);
 close(result.mean,350/1.5);
 assert.equal(result.hoursTouched,2);
 close(integrateHourlyMeans(series,0,3600).timeIntegralInHours,100);
 close(integrateHourlyMeans(series,3600,3600).timeIntegralInHours,300);
 close(integrateHourlyMeans(series,0,3*3600).timeIntegralInHours,600);
 assert.throws(()=>integrateHourlyMeans(series,0,4*3600),/outside/);
 assert.throws(()=>integrateHourlyMeans({...series,meanValues:[1,NaN,3]},3600,60),/not finite/);
});
test("unknown NASA POWER time standard is a correctness blocker, not assumed Eastern local",()=>{
 const audit=JSON.parse(fs.readFileSync(path.join(root,"validation/next-core/weather-audit.json"),"utf8"));
 assert.equal(audit.legacyHistorical.apiTimeStandard,"UNKNOWN");
 assert.equal(audit.legacyHistorical.requestUrl,"MISSING");
 const meta=vm.runInNewContext(fs.readFileSync(path.join(root,"source/hist.js"),"utf8")+"\nHIST.meta;");
 assert.equal(meta.first,2001);assert.equal(meta.last,2025);
 assert.equal(meta.tz,-5);assert.equal(meta.hours,2880);
 assert.throws(()=>assertKnownClock({...source,clock:"UNKNOWN"},"CIVIL_STANDARD"),/UNKNOWN/);
 assert.throws(()=>assertKnownClock(source,"CIVIL_STANDARD"),/LST/);
 assert.doesNotThrow(()=>assertKnownClock(source,"LST"));
});
test("Sandia glass/glass is not silently assigned glass/polymer thermal coefficients",()=>{
 assert.equal(SANDIA_THERMAL.open_rack_glass_glass.a,-3.47);
 assert.equal(SANDIA_THERMAL.open_rack_glass_glass.b,-.0594);
 assert.equal(SANDIA_THERMAL.open_rack_glass_glass.deltaTC,3);
 const x=sandiaTemperature(1000,25,1,"open_rack_glass_glass");
 const y=sandiaTemperature(1000,25,1,"open_rack_glass_polymer");
 close(x.moduleC,25+1000*Math.exp(-3.47-0.0594));
 close(x.cellC,x.moduleC+3);
 close(y.moduleC,25+1000*Math.exp(-3.56-0.075));
 assert.notEqual(x.cellC,y.cellC);
 const dark=sandiaTemperature(0,-5,2,"close_mount_glass_glass");
 close(dark.cellC,-5);
 assert.throws(()=>sandiaTemperature(-1,25,1,"open_rack_glass_glass"),/negative/);
});

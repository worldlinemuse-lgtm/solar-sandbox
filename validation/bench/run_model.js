// Dump this sandbox's hourly model for a list of orientations so validate_pv.py can compare it to PVWatts and pvlib.
const fs=require('fs');
const PHYS=require('../physics.js');
const d=JSON.parse(fs.readFileSync(__dirname+'/../pvw.json'));
const o=d.outputs,st=d.station_info;
const W={dn:o.dn,df:o.df,ta:o.tamb,ws:o.wspd,alb:o.alb,lat:st.lat,lon:st.lon,tz:st.tz};
const cfgs=JSON.parse(process.argv[2]);
const out={};
for(const c of cfgs){const r=PHYS.hourly(W,c);out[c.key]={poa:Array.from(r.poa),eff:Array.from(r.eff),tcell:Array.from(r.tcell),rear:Array.from(r.rear),ghi:Array.from(r.ghi)};}
fs.writeFileSync(__dirname+'/model_out.json',JSON.stringify(out));
console.log('ok',Object.keys(out).length);

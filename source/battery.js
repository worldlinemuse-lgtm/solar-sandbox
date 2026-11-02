// battery.js - capacity versus discharge rate and temperature, absorption charging and self-heating
// parameters. Pure functions, no DOM; loaded in the page and in Node tests.
// Every number says where it comes from. 'src' = maker document, 'est' = assumption with no source.
(function(root){
'use strict';

// Renogy 12 V 100 Ah AGM spec sheet ("12V 100Ah/10HR"), constant-current discharge table at 25 C,
// final voltage 1.75 V per cell (10.5 V), the end voltage the sheet gives for discharge rates below 0.2C.
// [hours, amps]. Read from the spec sheet image (Home Depot-hosted Renogy PDF):
// https://images.thdstatic.com/catalog/pdfImages/1d/1d0afee3-061e-447a-a38a-6826588bee5f.pdf
const AGM_RATE = [[0.25,149.1],[0.5,86.32],[1,54.00],[3,25.56],[5,17.24],[8,11.40],[10,9.52],[20,5.00]];
// Same sheet, temperature effect on capacity (20-hour rate): [degC, fraction]
const AGM_TEMP = [[-15,0.65],[0,0.85],[20,1.00],[40,1.02]];
const AGM_C20 = 20*5.00; // 100 Ah at the 20-hour rate

// Capacity (Ah) available at a constant current, interpolated log-log between table points.
function agmCapAt(amps){
  const T = AGM_RATE;
  if(amps <= T[T.length-1][1]) return {ah:AGM_C20, beyond:false, below:true};
  if(amps >= T[0][1]) return {ah:T[0][0]*T[0][1], beyond:true, below:false};
  for(let i=T.length-1;i>0;i--){
    const lo=T[i], hi=T[i-1]; // lo = lower current
    if(amps <= hi[1]){
      const c1=lo[0]*lo[1], c2=hi[0]*hi[1];
      const f=(Math.log(amps)-Math.log(lo[1]))/(Math.log(hi[1])-Math.log(lo[1]));
      return {ah:Math.exp(Math.log(c1)+f*(Math.log(c2)-Math.log(c1))), beyond:false, below:false};
    }
  }
  return {ah:AGM_C20, beyond:false, below:true};
}
function lin(T, x){
  if(x<=T[0][0]) return T[0][1];
  for(let i=1;i<T.length;i++){ if(x<=T[i][0]){ const a=T[i-1], b=T[i]; return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]); } }
  return T[T.length-1][1];
}
function agmTempFactor(c){ return lin(AGM_TEMP, c); }

// Drain multiplier: how much faster the state of charge falls than the energy taken out, because less
// capacity is available at high current or in the cold. Battery-monitor (Peukert-style) approach:
// charge used = Ah out x C20 / C(I), then / temperature factor. Effects only; never below 1 for rate
// (the sheet has no data below the 20-hour current). Combining rate and temperature by multiplying is an
// assumption (the sheet gives them separately).
function drainMult(chem, ampsPerString, tempC){
  if(chem!=='agm') return {m:1, rate:1, temp:1, note:'none'};
  const r = ampsPerString>0 ? agmCapAt(ampsPerString) : {ah:AGM_C20, beyond:false, below:true};
  const rate = AGM_C20 / r.ah;
  const tf = agmTempFactor(tempC);
  return {m: rate/tf, rate, temp: tf, beyond: r.beyond, cold: tempC < AGM_TEMP[0][0]};
}
// Best-fit Peukert exponent from the table, for display only.
function agmPeukert(){
  // least squares of log(t) on log(I)
  const xs=AGM_RATE.map(r=>Math.log(r[1])), ys=AGM_RATE.map(r=>Math.log(r[0]));
  const n=xs.length, mx=xs.reduce((a,b)=>a+b)/n, my=ys.reduce((a,b)=>a+b)/n;
  let sxy=0,sxx=0; for(let i=0;i<n;i++){sxy+=(xs[i]-mx)*(ys[i]-my);sxx+=(xs[i]-mx)**2;}
  return -sxy/sxx;
}

// Absorption stage. absStart = state of charge where the charger reaches its absorption voltage and the
// current starts to taper (no maker publishes this; assumption). absMinPer100Ah = time the charger holds
// absorption before dropping to float.
const ABS = {
  lfp: {absStart:0.95, absStartSrc:'est', taperFloor:0.03,
        absMinPer100Ah:30, absSrc:'Battle Born BB10012 data sheet: "Absorption Time: 30 Minutes per 100Ah Battery Bank" (read here as 30 minutes per 100 Ah of bank capacity)'},
  agm: {absStart:0.80, absStartSrc:'est', taperFloor:0.03, absMinPer100Ah:null,
        absSrc:'Renogy publishes a 14.7 V cycle charge voltage (2.45 V per cell) and a 30 A (0.3C) maximum charge current, but no absorption time; the sim keeps tapering until full (assumption)'}
};
// Charge-current limit during bulk/absorption. soc 0..1, absMin = minutes spent in absorption today.
// Returns {mult, phase}: mult scales the bulk current limit.
function absorption(chem, soc, absMin, bankAh, holdMin){
  const a = chem==='agm' ? ABS.agm : ABS.lfp;
  if(soc >= 1) return {mult:0, phase:'float'};
  if(soc <= a.absStart) return {mult:1, phase:'bulk'};
  const limit = holdMin!=null ? holdMin : (a.absMinPer100Ah!=null ? a.absMinPer100Ah*bankAh/100 : null);
  if(limit!=null && absMin >= limit) return {mult:0, phase:'float', limit};
  return {mult: Math.max(a.taperFloor, (1-soc)/(1-a.absStart)), phase:'absorption', limit};
}

// LiTime 12V 100Ah Group 24 self-heating battery user manual: heating needs at least 10 A of charge
// current; heating time at 10 A: 70-90 min from 14 F (-10 C) and 100-150 min from -4 F (-20 C).
// Charging resumes at 41 F (5 C). Net warming rates that fit inside both published ranges:
// 15 C in 70-90 min = 0.167-0.214 C/min; 25 C in 100-150 min = 0.167-0.25 C/min. Overlap 0.167-0.214.
const HEAT = {
  fast:{rate:15/70, label:'Fast end of LiTime\u2019s range'},
  mid:{rate:0.19, label:'Middle of LiTime\u2019s range'},
  slow:{rate:15/90, label:'Slow end of LiTime\u2019s range'}
};
function heatMinutes(rate, fromC, toC){ return (toC-fromC)/rate; }

const BATTMODEL = {AGM_RATE, AGM_TEMP, AGM_C20, agmCapAt, agmTempFactor, drainMult, agmPeukert, ABS, absorption, HEAT, heatMinutes,
  SRC:{agm:'Renogy 12V 100Ah AGM spec sheet (discharge table at 1.75 V/cell and temperature table)',
       lfpRate:'No maker of these lithium batteries publishes capacity versus discharge rate or temperature, so the sim does not change their capacity with rate or temperature.',
       heat:'LiTime self-heating battery user manual (10 A minimum, 70-90 min from 14\u00b0F, 100-150 min from \u22124\u00b0F)'}};
if(typeof module!=='undefined' && module.exports) module.exports = BATTMODEL; else root.BATTMODEL = BATTMODEL;
})(typeof window!=='undefined'?window:this);

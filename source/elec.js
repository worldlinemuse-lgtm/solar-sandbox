// elec.js - wire ampacity table math, fuse interrupt ratings and battery fault-current estimates.
// Pure functions, no DOM. Loaded in the page and in Node tests (module.exports at the bottom).
// Nothing here is a code-compliance or safety approval. It reproduces published table math
// and says "not verified" whenever an input or a source value is missing.
(function(root){
'use strict';

// NEC Table 310.16 allowable ampacities (not more than three current-carrying conductors, 30 C / 86 F ambient).
// Values as reproduced in Cerrowire's ampacity chart (2017 NEC Table 310.16):
// https://www.cerrowire.com/products/resources/tables-calculators/ampacity-charts/
// null = no value in that source for that column; the page then says "not verified".
const AMP = {
  cu: { // 60C, 75C, 90C
    '14':[15,20,25], '12':[20,25,30], '10':[30,35,40], '8':[40,50,55], '6':[55,65,75],
    '4':[70,85,95], '2':[95,115,130], '1/0':[null,150,170], '2/0':[null,175,195],
    '3/0':[null,200,225], '4/0':[null,230,260]
  },
  al: {
    '12':[null,20,25], '10':[null,30,35], '8':[null,40,45], '6':[null,50,55], '4':[null,65,75],
    '2':[null,90,100], '1/0':[null,120,135], '2/0':[null,135,150], '3/0':[null,155,175], '4/0':[null,180,205]
  }
};
const COL = {60:0, 75:1, 90:2};

// NEC Table 310.15(B)(1) (2020/2023 numbering; 310.15(B)(2)(a) in 2017): ambient temperature correction
// factors for a 30 C table. Rows are the upper bound of each ambient band in C. null = not permitted.
const TCORR = [
  [10, 1.29, 1.20, 1.15], [15, 1.22, 1.15, 1.12], [20, 1.15, 1.11, 1.08], [25, 1.08, 1.05, 1.04],
  [30, 1.00, 1.00, 1.00], [35, 0.91, 0.94, 0.96], [40, 0.82, 0.88, 0.91], [45, 0.71, 0.82, 0.87],
  [50, 0.58, 0.75, 0.82], [55, 0.41, 0.67, 0.76], [60, null, 0.58, 0.71], [65, null, 0.47, 0.65],
  [70, null, 0.33, 0.58], [75, null, null, 0.50], [80, null, null, 0.41], [85, null, null, 0.29]
];
// NEC Table 310.15(C)(1) (2020/2023; 310.15(B)(3)(a) in 2017): adjustment for more than three
// current-carrying conductors in a raceway or cable, or bundled.
const BUNDLE = [[3,1.00],[6,0.80],[9,0.70],[20,0.50],[30,0.45],[40,0.40],[Infinity,0.35]];

function tempFactor(ambC, rating){
  if(ambC==null || !isFinite(ambC) || !(rating in COL)) return null;
  // NEC rounds the ambient into bands; fractional C values go to the next band up (conservative).
  const a = Math.ceil(ambC - 1e-9);
  for(const row of TCORR){ if(a <= row[0]) return row[1+COL[rating]]; }
  return null; // hotter than the table
}
function bundleFactor(n){
  if(n==null || !isFinite(n) || n < 1) return null;
  for(const [max,f] of BUNDLE){ if(n <= max) return f; }
  return null;
}
function baseAmp(mat, gauge, rating){
  const t = AMP[mat] && AMP[mat][gauge];
  if(!t || !(rating in COL)) return null;
  return t[COL[rating]];
}

// One cable run. inp: {mat, gauge, ambC, ccc, ins (60|75|90|null), term (60|75|90|null)}
// need: {imax (A, before the 125% factor), cont125 (bool: apply the 125% continuous rule)}
// Returns a status that is never an approval:
//  'nv'   not verified: an input or a table value is missing
//  'fail' the table math says the wire is too small for this current
//  'tbl'  the table math passes; this is arithmetic, not an installation check
function ampacityCheck(inp, need){
  const missing = [];
  if(inp.ambC==null || !isFinite(inp.ambC)) missing.push('hottest air temperature around the cable');
  if(inp.ccc==null || !isFinite(inp.ccc)) missing.push('how many current-carrying wires share the conduit or bundle');
  if(!(inp.ins in COL)) missing.push('the insulation temperature rating printed on the cable');
  if(!(inp.term in COL)) missing.push('the terminal temperature rating of the equipment at each end');
  const r = {missing, base:null, tf:null, bf:null, corrected:null, termLimit:null, allowed:null,
             required:null, requiredUncorr:null, status:'nv', notes:[]};
  const imax = need.imax;
  r.required = imax;
  r.requiredUncorr = need.cont125 ? imax*1.25 : imax;
  if(inp.ins in COL){
    r.base = baseAmp(inp.mat, inp.gauge, inp.ins);
    if(r.base==null) missing.push('a table value for '+inp.gauge+' AWG '+(inp.mat==='al'?'aluminum':'copper')+' at '+inp.ins+'\u00b0C in our source');
  }
  r.tf = tempFactor(inp.ambC, inp.ins);
  if(inp.ambC!=null && isFinite(inp.ambC) && (inp.ins in COL) && r.tf==null){
    r.status='fail'; r.notes.push('The table gives no ampacity at this temperature for this insulation rating.');
    return r;
  }
  r.bf = bundleFactor(inp.ccc);
  if(inp.term in COL){
    r.termLimit = baseAmp(inp.mat, inp.gauge, inp.term);
    if(r.termLimit==null) missing.push('a table value at the '+inp.term+'\u00b0C terminal rating in our source');
  }
  if(inp.term in COL && inp.ins in COL && inp.term > inp.ins) r.notes.push('Terminal rating is higher than the cable insulation rating; the cable rating limits it.');
  if(missing.length){ r.status='nv'; return r; }
  r.corrected = r.base * r.tf * r.bf;
  // Corrections apply to the insulation column; the result may not exceed the terminal column (uncorrected).
  r.allowed = Math.min(r.corrected, r.termLimit);
  const okCorr = r.corrected >= imax;          // corrected ampacity carries the max current
  const okTerm = r.termLimit >= r.requiredUncorr; // terminal column carries 125% before corrections
  r.status = (okCorr && okTerm) ? 'tbl' : 'fail';
  if(!okCorr) r.notes.push('After the temperature and bundling factors the wire carries '+r.corrected.toFixed(0)+' A, less than the '+imax.toFixed(1)+' A it may see.');
  if(!okTerm) r.notes.push('At the '+inp.term+'\u00b0C terminal rating the table allows '+r.termLimit+' A, less than '+r.requiredUncorr.toFixed(1)+' A (125% of the maximum current).');
  return r;
}

// Fuse interrupt ratings from the fuse maker's own product pages (Blue Sea Systems, read Oct 30-31 2026).
// aic: list of [max volts DC, amps] - the rating that applies is the first entry whose voltage covers the system.
const FUSES = [
  {id:'mrbf', name:'MRBF terminal fuse', maker:'Blue Sea Systems', model:'5183 (30-300 A series)', aic:[[14,10000],[32,5000],[58,2000]],
   url:'https://www.bluesea.com/products/5183'},
  {id:'anl', name:'ANL fuse', maker:'Blue Sea Systems', model:'5127 (ANL series)', aic:[[80,6000]],
   url:'https://www.bluesea.com/products/5127/ANL_Fuse_-_100A'},
  {id:'classt', name:'Class T fuse', maker:'Blue Sea Systems', model:'5114 (Class T series)', aic:[[125,20000]],
   url:'https://www.bluesea.com/products/5114/Class_T_Fuse_-_100A'}
];
function fuseAic(f, vmax){
  for(const [v,a] of f.aic){ if(vmax <= v) return {amps:a, atV:v}; }
  return null; // system voltage above every published rating
}

// Battery fault-current estimate for a bank of ns in series x bp in parallel.
// res: {ohm, kind} where kind is 'published' (maker's resistance figure), 'upper' (maker gives only a
// maximum, e.g. "<= 40 mOhm") or 'est' (no maker figure). No maker of these batteries publishes a
// short-circuit current, so every result here is an estimate and is flagged unverified.
function faultEstimate(vOpen, ns, bp, res, cableOhm){
  const rBank = res.ohm * ns / bp;
  const rTot = rBank + (cableOhm||0);
  const amps = vOpen / rTot;
  let basis, isFloor = false;
  if(res.kind==='published') basis = 'the maker\u2019s published internal resistance';
  else if(res.kind==='upper'){ basis = 'the maker\u2019s maximum internal resistance, so the real fault current could be higher'; isFloor = true; }
  else basis = 'an estimated internal resistance (no maker figure)';
  return {amps, rBank, rTot, basis, isFloor, verified:false};
}
// Compare a fuse's interrupt rating with the estimate. Never returns a suitability approval.
function fuseVsFault(f, vmax, fault){
  const aic = fuseAic(f, vmax);
  if(!aic) return {status:'fail', aic:null, msg:'No published interrupt rating at '+vmax.toFixed(1)+' V.'};
  if(aic.amps < fault.amps) return {status:'fail', aic, msg:'Interrupt rating '+aic.amps.toLocaleString('en-US')+' A is below the estimated fault current.'};
  if(fault.isFloor) return {status:'nv', aic, msg:'Rated '+aic.amps.toLocaleString('en-US')+' A, but the fault estimate is only a minimum, so this comparison proves nothing.'};
  return {status:'nv', aic, msg:'Rated '+aic.amps.toLocaleString('en-US')+' A, above the estimate ('+(aic.amps/fault.amps).toFixed(1)+'\u00d7). Not verified: the estimate is not a maker short-circuit figure.'};
}

const ELEC = {AMP, TCORR, BUNDLE, FUSES, tempFactor, bundleFactor, baseAmp, ampacityCheck, fuseAic, faultEstimate, fuseVsFault,
  SOURCES:{
    amp:'NEC Table 310.16, as reproduced in Cerrowire\u2019s ampacity chart (2017 NEC)',
    tcorr:'NEC Table 310.15(B)(1) ambient temperature correction (2020/2023 numbering)',
    bundle:'NEC Table 310.15(C)(1) adjustment for more than three current-carrying conductors (2020/2023 numbering)',
    pv:'NEC 690.8: PV maximum current is the modules\u2019 short-circuit current \u00d7 125%, and the wire must carry 125% of that before corrections',
    fuses:'Blue Sea Systems product pages for the MRBF, ANL and Class T fuses'
  }};
if(typeof module!=='undefined' && module.exports) module.exports = ELEC; else root.ELEC = ELEC;
})(typeof window!=='undefined'?window:this);

// ---------- Physics core (no page code; the node tests load this same file) ----------
// Solar position: NOAA general solar position equations (fractional-year form).
// Sky diffuse on a tilted plane: Perez 1990 all-sites composite coefficients, the model PVWatts uses.
// Glass reflection: physical (Fresnel + absorption) model, n=1.526, K=4/m, L=2 mm, as in PVWatts;
// diffuse parts use the Brandemuehl-Beckman effective angles.
// Cell temperature: Sandia (King 2004) model, coefficients per mounting type.
// Cable resistance: NEC Chapter 9 Table 8 DC resistance at 75 C, corrected with its own formula.
// Ampacity: NEC Table 310.16, 75 C column (30 C ambient, not more than 3 current-carrying conductors).
const PHYS=(function(){
const D2R=Math.PI/180, R2D=180/Math.PI;
function horAt(H,az){const x=((az%360)+360)%360/45,i=Math.floor(x)%8,f=x-Math.floor(x);return H[i]*(1-f)+H[(i+1)%8]*f;} // horizon height at a sun azimuth, straight-line between the 8 directions
function solarPos(doy,hr,lat,lon,tz){
 const g=2*Math.PI/365*(doy-1+(hr-12)/24);
 const eqt=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
 const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
 const tst=hr*60+eqt+4*lon-60*tz;
 const ha=(tst/4-180)*D2R, la=lat*D2R;
 let cz=Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha);cz=Math.max(-1,Math.min(1,cz));
 const zen=Math.acos(cz)*R2D;
 let az=Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(la)-Math.tan(dec)*Math.cos(la))*R2D+180; // degrees east of north
 return {zen,az,cz};
}
function dniExtra(doy){const b=2*Math.PI*(doy-1)/365;return 1367*(1.00011+0.034221*Math.cos(b)+0.00128*Math.sin(b)+0.000719*Math.cos(2*b)+0.000077*Math.sin(2*b));}
function airmass(zen){if(zen>=90)return NaN;return 1/(Math.cos(zen*D2R)+0.50572*Math.pow(96.07995-zen,-1.6364));} // Kasten-Young 1989
const PF1=[[-0.008,0.588,-0.062],[0.13,0.683,-0.151],[0.33,0.487,-0.221],[0.568,0.187,-0.295],[0.873,-0.392,-0.362],[1.132,-1.237,-0.412],[1.06,-1.6,-0.359],[0.678,-0.327,-0.25]];
const PF2=[[-0.06,0.072,-0.022],[-0.019,0.066,-0.029],[0.055,-0.064,-0.026],[0.109,-0.152,-0.014],[0.226,-0.462,0.001],[0.288,-0.823,0.056],[0.264,-1.127,0.131],[0.156,-1.377,0.251]];
const EBIN=[1.065,1.23,1.5,1.95,2.8,4.5,6.2];
function perez(tilt,dhi,dni,dniE,zen,cosAoi,am){
 if(dhi<=0)return 0;
 const z=zen*D2R,k=1.041*z*z*z;
 const eps=((dhi+dni)/dhi+k)/(1+k);
 let b=0;while(b<7&&eps>=EBIN[b])b++;
 const delta=dhi*am/dniE;
 const F1=Math.max(0,PF1[b][0]+PF1[b][1]*delta+PF1[b][2]*z);
 const F2=PF2[b][0]+PF2[b][1]*delta+PF2[b][2]*z;
 const A=Math.max(0,cosAoi),B=Math.max(Math.cos(85*D2R),Math.cos(z));
 const t=tilt*D2R;
 return Math.max(0,dhi*((1-F1)*(1+Math.cos(t))/2+F1*A/B+F2*Math.sin(t)));
}
function iam(aoi){ // physical glass model, ratio to normal incidence
 const n=1.526,K=4,L=0.002;
 if(aoi>=90)return 0;
 const th=Math.max(aoi,1e-6)*D2R, tr=Math.asin(Math.sin(th)/n);
 const rs=Math.pow(Math.sin(tr-th),2)/Math.pow(Math.sin(tr+th),2), rp=Math.pow(Math.tan(tr-th),2)/Math.pow(Math.tan(tr+th),2);
 const tau=Math.exp(-K*L/Math.cos(tr))*(1-(rs+rp)/2);
 const tau0=Math.exp(-K*L)*(1-Math.pow((1-n)/(1+n),2));
 return Math.max(0,tau/tau0);
}
const MOUNTS={ // Sandia module temperature model (King et al. 2004, SAND2004-3535); a, b, dT
 open:{a:-3.56,b:-0.075,dT:3,label:'Open rack (ground or pole mount, air behind)'},
 roof:{a:-2.98,b:-0.0471,dT:1,label:'Close roof mount (a few inches of air gap)'},
 glued:{a:-2.81,b:-0.0455,dT:0,label:'Glued flat to a surface, no air behind'}
};
function cellTemp(E,ta,ws,m){const p=MOUNTS[m]||MOUNTS.open;const tm=E*Math.exp(p.a+p.b*ws)+ta;return tm+E/1000*p.dT;}
// Hourly plane-of-array irradiance and cell temperature for one array orientation over the weather year.
// Returns Float32Arrays: poa (front, before glass loss), eff (front after glass loss, plus rear * bifaciality), tcell, ghi.
function hourly(W,o){
 const HOR=(o.hor&&o.hor.some(x=>x>0))?o.hor:null; // obstruction height angle (deg) toward N, NE, E, SE, S, SW, W, NW
 const skyF=HOR?1-HOR.reduce((a,h)=>a+Math.pow(Math.sin(h*D2R),2),0)/HOR.length:1; // sky light lost to the obstructions: isotropic-sky approximation, an estimate
 const N=W.dn.length, lat=W.lat, lon=W.lon, tz=W.tz;
 const tilt=o.tilt, az=o.az, t=tilt*D2R, ct=Math.cos(t), st=Math.sin(t);
 const thS=59.7-0.1388*tilt+0.001497*tilt*tilt, thG=90-0.5788*tilt+0.002693*tilt*tilt;
 const iS=iam(thS), iG=tilt<1?0:iam(thG);
 const poa=new Float32Array(N),eff=new Float32Array(N),tc=new Float32Array(N),ghiA=new Float32Array(N),rearA=new Float32Array(N);
 for(let i=0;i<N;i++){
  const doy=Math.floor(i/24)+1,h0=i%24;
  let up=0,sumH=0,vis=0;for(let k=0;k<20;k++){const hh=h0+(k+0.5)/20;const p_=solarPos(doy,hh,lat,lon,tz);if(p_.zen<90){up++;sumH+=hh;if(!HOR||90-p_.zen>horAt(HOR,p_.az))vis++;}}
  const fvis=up?vis/up:1; // share of the sun-up part of the hour with the sun above your horizon
  const ta=W.ta[i],ws=W.ws[i],rho=W.alb[i];
  if(up===0){tc[i]=ta;continue;}
  const hr=up===20?h0+0.5:sumH/up;
  const sp=solarPos(doy,hr,lat,lon,tz);
  const zen=Math.min(sp.zen,89.9);
  const dni=W.dn[i],dhi=W.df[i];
  const ghi=dni*Math.cos(zen*D2R)+dhi; ghiA[i]=ghi;
  const cosA=Math.cos(zen*D2R)*ct+Math.sin(zen*D2R)*st*Math.cos((sp.az-az)*D2R);
  const beam=Math.max(0,dni*cosA)*fvis;
  const sky=perez(tilt,dhi,dni,dniExtra(doy),zen,cosA,airmass(zen))*skyF;
  const gnd=ghi*rho*(1-ct)/2;
  const front=beam+sky+gnd; poa[i]=front;
  const aoi=Math.acos(Math.max(-1,Math.min(1,cosA)))*R2D;
  let e=beam*iam(aoi)+sky*iS+gnd*iG;
  let rear=0;
  if(o.bif>0){ // isotropic view-factor rear side, ground under the array assumed unshaded: an upper bound
   const cosR=-cosA;
   rear=Math.max(0,dni*cosR)*fvis+dhi*(1-ct)/2*skyF+ghi*rho*(1+ct)/2;
   e+=o.bif*rear*(1-(o.rearLoss||0));
  }
  rearA[i]=rear; eff[i]=e;
  tc[i]=cellTemp(front,ta,ws,o.mount);
 }
 return {poa,eff,tcell:tc,ghi:ghiA,rear:rearA};
}
// ---------- Cables ----------
// [ohms per 1000 ft at 75 C, stranded uncoated copper / stranded aluminum (NEC Ch.9 Table 8), ampacity A at 75 C column (NEC 310.16)]
const WIRE={
 cu:{'14':[3.14,20],'12':[1.98,25],'10':[1.24,35],'8':[0.778,50],'6':[0.491,65],'4':[0.308,85],'2':[0.194,115],'1/0':[0.122,150],'2/0':[0.0967,175],'3/0':[0.0766,200],'4/0':[0.0608,230]},
 al:{'12':[3.25,20],'10':[2.04,30],'8':[1.28,40],'6':[0.808,50],'4':[0.508,65],'2':[0.319,90],'1/0':[0.201,120],'2/0':[0.159,135],'3/0':[0.126,155],'4/0':[0.100,180]}
};
const WALPHA={cu:0.00323,al:0.00330}; // NEC Ch.9 Table 8 note: R2 = R1[1 + a(T2 - 75)]
const MM2={'14':2.08,'12':3.31,'10':5.26,'8':8.37,'6':13.3,'4':21.2,'2':33.6,'1/0':53.5,'2/0':67.4,'3/0':85.0,'4/0':107};
function wireOk(mat,g){return !!(WIRE[mat]&&WIRE[mat][g]);}
// Round-trip (out and back) resistance of a two-conductor run, ohms, at conductor temperature tC.
function loopR(mat,g,ft,tC){const w=WIRE[mat][g];return w[0]*2*ft/1000*(1+WALPHA[mat]*(tC-75));}
function ampacity(mat,g){return WIRE[mat][g][1];}
// Conductor temperature estimate: NEC 75 C ampacity is the current that holds the conductor at 75 C in 30 C air,
// a 45 C rise; rise taken as proportional to current squared (estimate, not an NEC method).
function condTemp(ta,I,mat,g){const a=ampacity(mat,g);return ta+45*Math.pow(Math.min(2,Math.abs(I)/a),2);}
// Power lost in a run carrying current I (A), iterating once on conductor heating.
function runLoss(mat,g,ft,ta,I){const T=condTemp(ta,I,mat,g);const R=loopR(mat,g,ft,T);return {R,T,W:I*I*R,V:I*R};}
// ---------- Inverter ----------
// Loss = P0 + k1*P + k2*P^2. P0 = datasheet zero-load power. The datasheet gives only max efficiency, not a curve,
// so the load where efficiency peaks (PEAK_AT of the 25 C rating) is an assumption; k1 and k2 follow from it.
const PEAK_AT=0.4;
function invCoef(I,peakAt){const pk=(peakAt||PEAK_AT)*I.c25;const k2=I.idle/(pk*pk);const k1=Math.max(0,(1/I.eff-1)-2*I.idle/pk);return {k1,k2};}
function invLoss(I,P,peakAt){if(P<=0)return I.idle;const c=invCoef(I,peakAt);return I.idle+c.k1*P+c.k2*P*P;}
// Continuous rating vs inverter air temperature, straight-line between datasheet points.
function invCont(I,tC){const pts=I.contPts;if(tC<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++){if(tC<=pts[i][0]){const a=pts[i-1],b=pts[i];return a[1]+(b[1]-a[1])*(tC-a[0])/(b[0]-a[0]);}}const L=pts[pts.length-1];if(I.derF){return Math.max(0,L[1]*(1-I.derF*(tC-L[0])*9/5));}return L[1];}
return {solarPos,dniExtra,airmass,perez,iam,cellTemp,MOUNTS,hourly,WIRE,WALPHA,MM2,wireOk,loopR,ampacity,condTemp,runLoss,invCoef,invLoss,invCont,PEAK_AT};
})();
if(typeof module!=='undefined')module.exports=PHYS;

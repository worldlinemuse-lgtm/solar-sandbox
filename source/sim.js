(function(){
'use strict';
// ---------- Parts (maker spec sheets) ----------
// Panel catalog. Electrical specs and prices from each maker's own product page (checked Oct 30, 2026).
// tiers: [quantity in the pack, price of that pack]. The cost model buys the cheapest mix of packs that covers your count.
const PANELS=[
 {id:'r200',name:'Renogy 200 W 12 V N-type',short:'Renogy 200 W',w:200,voc:23,isc:11.05,vmp:19.2,imp:10.42,tiers:[[1,179.99],[2,352.99],[4,705.99]],kind:'Rigid glass panel. The starting setup.',src:'renogy.com',url:'https://www.renogy.com/products/renogy-n-type-solar-panel'},
 {id:'r320',name:'Renogy 320 W N-type',short:'Renogy 320 W',w:320,voc:43.82,isc:8.92,vmp:37.85,imp:8.46,tiers:[[2,599.99],[4,1099.99],[6,1599.99],[8,2099.99],[10,2499.99]],kind:'Big rigid panel, higher voltage. Sold in packs of 2 or more.',src:'renogy.com',url:'https://www.renogy.com/products/renogy-n-type-320-watt-monocrystalline-solar-panel'},
 {id:'r400',name:'Renogy 400 W N-type bifacial',short:'Renogy 400 W bifacial',w:400,voc:39.42,isc:13.06,vmp:34.0,imp:11.76,tiers:[[2,659.99],[4,1293.99],[6,1880.99],[10,3035.99]],kind:'Largest panel here. Its back side also makes power off snow or light ground; the sim counts that only if you switch on rear-side gain under Panel mount, and Renogy\u2019s "up to 30%" is a best case. Sold in packs of 2 or more.',src:'renogy.com',url:'https://www.renogy.com/products/400w-n-type-bifacial-solar-panel'},
 {id:'rs200',name:'Rich Solar MEGA 200 PRO ONYX 24 V',short:'Rich Solar 200 W 24 V',w:200,voc:43.5,isc:5.93,vmp:36.3,imp:5.51,tiers:[[1,249.99]],kind:'Higher-voltage 200 W panel, so fewer panels fit in series and wires carry less current.',src:'richsolar.com',url:'https://richsolar.com/products/mega-200-pro-onyx-200-watt-24-volt-solar-panel'},
 {id:'rs100',name:'Rich Solar MEGA 100 ONYX 12 V',short:'Rich Solar 100 W',w:100,voc:22.8,isc:5.78,vmp:18.6,imp:5.38,tiers:[[1,119.99]],kind:'Small rigid panel for tight spots.',src:'richsolar.com',url:'https://richsolar.com/products/mega-100-onyx-100-watt-solar-panel-premier-12v-off-grid-solar-panel-for-vans-campers-boats-25-year-output-warranty'},
 {id:'rf100',name:'Renogy 100 W 12 V flexible',short:'Renogy 100 W flexible',w:100,voc:22.5,isc:5.75,vmp:18.9,imp:5.29,tiers:[[1,149.99]],kind:'Thin and bendable, glued or taped down. Costs more per watt. This sim treats it like a rigid panel and ignores the extra heat a glued-down panel runs at.',src:'renogy.com',url:'https://www.renogy.com/products/100-watt-12-volt-flexible-monocrystalline-solar-panel'},
 {id:'lg435',name:'LONGi Hi-MO 4m LR4-72HBD-435M bifacial',short:'LONGi 435 W',w:435,voc:49.1,isc:11.36,vmp:40.8,imp:10.66,tiers:[[1,100]],owned:true,priceKind:'yours',priceNote:'Your own purchase price: $400 for four ($100 each). Extra panels beyond your four are priced the same here, which is only a guess.',kind:'Your panels: 144 half-cell bifacial, dual glass, 2094 × 1038 × 35 mm, 27.5 kg each. The back side adds power only on an open rack with rear-side gain switched on.',src:'LONGi datasheet (V13)',url:'https://solarshop.baywa-re.ca/site/assets/Product%20Specs/LON-4203_DS.pdf'}
];
let PANEL=PANELS[0];
const MPPTS=[
 {id:'100/30',price:135.15,name:'SmartSolar MPPT 100/30',amps:30,abs:100,op:100,isc:35,eff:0.98,volts:[12,24]},
 {id:'150/35',price:193.8,name:'SmartSolar MPPT 150/35',amps:35,abs:150,op:145,isc:40,eff:0.98,volts:[12,24,48]},
 {id:'150/70',price:402.05,name:'SmartSolar MPPT 150/70',amps:70,abs:150,op:145,isc:50,eff:0.98,volts:[12,24,48]},
 {id:'250/70',price:502.35,name:'SmartSolar MPPT 250/70',amps:70,abs:250,op:245,isc:35,eff:0.99,volts:[12,24,48]}
];
// Victron 120 V AC inverters. restart for MultiPlus assumed equal to Phoenix restart level.
const INVS=[
 {id:'p12-800',price:238.0,name:'Phoenix 12/800 120V',v:12,cont:650,peak:1500,eff:0.90,idle:6.5,low:9.3,restart:10.9},
 {id:'p12-1200',price:279.65,name:'Phoenix 12/1200 120V',v:12,cont:1000,peak:2200,eff:0.91,idle:10,low:9.3,restart:10.9},
 {id:'m12-3000',price:885.7,name:'MultiPlus-II 12/3000 120V',v:12,cont:2400,peak:5500,eff:0.93,idle:13,low:9.5,restart:10.9},
 {id:'p24-800',price:225.25,name:'Phoenix 24/800 120V',v:24,cont:650,peak:1500,eff:0.90,idle:7,low:18.6,restart:21.8},
 {id:'p24-1200',price:298.35,name:'Phoenix 24/1200 120V',v:24,cont:1000,peak:2200,eff:0.91,idle:11,low:18.6,restart:21.8},
 {id:'m24-3000',price:885.7,name:'MultiPlus-II 24/3000 120V',v:24,cont:2400,peak:5500,eff:0.94,idle:13,low:19,restart:21.8},
 {id:'m24-5000',price:1620.95,name:'MultiPlus-II 24/5000 120V',v:24,cont:4000,peak:9000,eff:0.95,idle:24,low:19,restart:21.8},
 {id:'p48-800',price:225.25,name:'Phoenix 48/800 120V',v:48,cont:650,peak:1500,eff:0.91,idle:9.5,low:37.2,restart:43.6},
 {id:'p48-1200',price:298.35,name:'Phoenix 48/1200 120V',v:48,cont:1000,peak:2200,eff:0.92,idle:12,low:37.2,restart:43.6},
 {id:'m48-3000',price:881.45,name:'MultiPlus-II 48/3000 120V',v:48,cont:2400,peak:5500,eff:0.95,idle:11,low:38,restart:43.6},
 {id:'m48-5000',price:1307.3,name:'MultiPlus-II 48/5000 120V',v:48,cont:4000,peak:9000,eff:0.96,idle:15,low:38,restart:43.6}
];
// Battery catalog. Ah, volts, current limits, charge range and price from each maker's page (checked Oct 30, 2026).
// mod: the nominal voltage class of one battery (12 or 48). maxSer/maxPar: the maker's series/parallel limit.
// chargeA: the sim's charge cap per battery = half its Ah (0.5C) or the maker's max charge current, whichever is lower (assumed).
// r (ohms per battery), eta (one-way efficiency), the AGM voltage curve and the heater warm-up rate are estimates.
const BATTS=[
 {id:'bb100',name:'Battle Born 100 Ah 12 V',short:'Battle Born 100 Ah',chem:'lfp',mod:12,ah:100,vnom:12.8,cont:100,surge:200,r:0.007,chargeA:50,absorb:14.4,maxSer:4,maxPar:8,eta:0.975,selfM:0.025,floor:0,heatW:0,tiers:[[1,799]],kind:'Lithium iron phosphate, US-assembled, premium price. Its built-in protection stops charging below 25°F (data sheet). Maker limit: 4 in series (48 V), no stated parallel limit.',src:'battlebornbatteries.com',url:'https://battlebornbatteries.com/products/100ah-12v-lifepo4-deep-cycle-battery'},
 {id:'lt100',name:'LiTime 12 V 100 Ah',short:'LiTime 100 Ah',chem:'lfp',mod:12,ah:100,vnom:12.8,cont:100,surge:400,r:0.01,chargeA:50,absorb:14.4,maxSer:4,maxPar:4,eta:0.975,selfM:0.03,floor:0,heatW:0,tiers:[[1,335.99],[2,661.9],[3,987.81],[4,1303.64]],kind:'Lithium iron phosphate, budget price. Same usable energy as the Battle Born. No low-temperature protection: nothing stops a charger below 32°F, so keep it warm. Maker limit: 4 in series, 4 in parallel.',src:'litime.com',url:'https://www.litime.com/products/litime-12v-100ah-lithium-lifepo4-battery'},
 {id:'lt230',name:'LiTime 12 V 230 Ah Plus',short:'LiTime 230 Ah',chem:'lfp',mod:12,ah:230,vnom:12.8,cont:200,surge:600,r:0.006,chargeA:115,absorb:14.4,maxSer:4,maxPar:4,eta:0.975,selfM:0.03,floor:0,heatW:0,tiers:[[1,484.49],[2,954.45],[3,1424.4],[4,1879.82]],kind:'One big lithium battery, 2.94 kWh, cheapest per kWh here. Stops charging below 32°F.',src:'litime.com',url:'https://www.litime.com/products/12v-230ah-plus-lifepo4-battery'},
 {id:'lth100',name:'LiTime LiHeat 12 V 100 Ah self-heating',short:'LiTime 100 Ah self-heating',chem:'lfp',mod:12,ah:100,vnom:12.8,cont:100,surge:500,r:0.01,chargeA:50,absorb:14.4,maxSer:4,maxPar:4,eta:0.975,selfM:0.03,floor:0,heatW:100,tiers:[[1,409.99],[2,807.68],[4,1590.76]],kind:'Lithium with a built-in 100 W heating pad, made for cold sheds. LiTime says it warms from 14°F in 70 to 90 minutes before charging. The sim runs the pad off solar power.',src:'litime.com',url:'https://www.litime.com/products/12v-100ah-group-24-bluetooth-self-heating-battery'},
 {id:'lt48',name:'LiTime 51.2 V 100 Ah server rack',short:'LiTime 48 V rack 100 Ah',chem:'lfp',mod:48,ah:100,vnom:51.2,cont:100,surge:500,r:0.03,chargeA:50,absorb:57.6,maxSer:1,maxPar:16,eta:0.975,selfM:0.03,floor:0,heatW:0,tiers:[[1,1099.99]],kind:'One 5.12 kWh 48 V battery for a rack. Works only in a 48 V system, and only in parallel. Stops charging below 32°F.',src:'litime.com',url:'https://www.litime.com/products/48v-100ah-lithium-home-storage-battery'},
 {id:'agm100',name:'Renogy 12 V 100 Ah AGM (lead-acid)',short:'Renogy 100 Ah AGM',chem:'agm',mod:12,ah:100,vnom:12,cont:0,surge:1100,r:0.008,chargeA:30,absorb:14.6,maxSer:99,maxPar:4,eta:0.9,selfM:0.03,floor:0.5,heatW:0,tiers:[[1,208.99],[2,406.99],[4,791.99]],kind:'Sealed lead-acid: cheapest to buy, heaviest, and only about half its energy is usable. Renogy rates it 500 cycles at 50% depth, so the sim stops the house at 50%. Renogy lists charging from 32°F to 122°F.',src:'renogy.com',url:'https://www.renogy.com/products/deep-cycle-agm-battery-12-volt-100ah'}
];
let BATT=BATTS[0];
const OCV_AGM=[[0,11.8],[0.25,12.0],[0.5,12.2],[0.75,12.5],[1,12.8]]; // resting volts vs charge, estimate
const OCV=[[0,10.0],[0.02,11.6],[0.05,12.4],[0.1,12.9],[0.2,13.05],[0.4,13.15],[0.6,13.22],[0.8,13.3],[0.95,13.4],[0.99,13.6],[1,13.8]];
function bv(s){const T=BATT.chem==='agm'?OCV_AGM:OCV;return (BATT.mod/12)*tab(T,s);}
function tab(T,s){s=Math.max(0,Math.min(1,s));for(let i=1;i<T.length;i++){if(s<=T[i][0]){const a=T[i-1],b=T[i];return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0]);}}return T[T.length-1][1];}
const HEAT_RATE=0.19; // degC per minute, net of heat lost to the air: LiTime says 70-90 min from 14F to charging (15 degC) and 100-150 min from -4F (25 degC); 0.19 sits inside both ranges (estimate)
function bankCont(bp){return BATT.cont>0?bp*BATT.cont:Infinity;}
function usableWh(){return capWh()*(1-BATT.floor);}
// cheapest way to buy at least n units from pack tiers; returns {cost,bought}
function buyCost(n,tiers){if(n<=0)return {cost:0,bought:0};const maxQ=Math.max(...tiers.map(t=>t[0]));const L=n+maxQ;const best=new Array(L+1).fill(Infinity);const from=new Array(L+1).fill(null);best[0]=0;
 for(let q=1;q<=L;q++)for(const [k,p] of tiers){if(q-k>=0&&best[q-k]+p<best[q]){best[q]=best[q-k]+p;from[q]=k;}}
 let bq=-1;for(let q=n;q<=L;q++)if(best[q]<Infinity&&(bq<0||best[q]<best[bq]-0.001))bq=q;return {cost:best[bq],bought:bq};}
function ocv(s){s=Math.max(0,Math.min(1,s));for(let i=1;i<OCV.length;i++){if(s<=OCV[i][0]){const a=OCV[i-1],b=OCV[i];return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0]);}}return 13.8;}

// ---------- Loads (editable estimates) ----------
const hr=m=>Math.floor(m/60)%24;
const inH=(m,a,b)=>{const h=(m%1440)/60;return h>=a&&h<b;};
const hm=h=>Math.round(h*60);
// Every appliance: watts each, how many, start-up surge multiple, Auto/On/Off,
// the clock windows it runs in on Auto ([start,end] in minutes; start===end means all day),
// and while running either steady, cycling (cyc) or thermostat-driven (thermo).
function mkLoad(o){return Object.assign({qty:1,surge:1,mode:'auto',wins:[[0,0]],cyc:null,thermo:null,chg:null,off:0,basis:'',volt:120,leg:1},o);}
// Where the appliance numbers come from. ES = ENERGY STAR certified-product data (data.energystar.gov, pulled Oct 30, 2026).
const ES_URL='https://www.energystar.gov/productfinder/product/certified-residential-refrigerators/results';
const ESF_URL='https://www.energystar.gov/productfinder/product/certified-residential-freezers/results';
const HP_URL='https://www.hp.com/us-en/shop/pdp/hp-elitebook-8-g1i-14-inch-ai-customizable-ap6j3av-mb';
const SL_URL='https://api.starlink.com/public-files/specification_sheet_standard.pdf';
const B={
 fridge:'Set to 1.0 kWh a day: the median ENERGY STAR label for 17 to 19 cu ft top-freezer fridges is 366 kWh a year (353 models). The 125 W running draw and 20-minutes-an-hour cycle are estimates that add up to that. A warm kitchen or lots of door opening raises it.',
 freezer:'Set to about 0.58 kWh a day: the median ENERGY STAR label for 8 to 12 cu ft chest freezers is 213 kWh a year (only 5 models listed). Running watts and cycle are estimates.',
 laptop:'HP spec for the EliteBook 8 G1i 14": 62 Wh battery, 65 W USB-C adapter. (HP\'s 50%-in-30-minutes fast charge needs its 100 W adapter at this battery size.) Assumed 85% charger efficiency, so one full charge pulls about 73 Wh from the outlet. Real charging slows near full; the sim runs at 65 W for a shorter time, which uses the same energy.',
 phone:'Galaxy S25-class phone: 4,000 mAh battery per Samsung\'s spec, about 15.4 Wh at an assumed 3.85 V, on a 25 W charger. Assumed 80% wall-to-battery efficiency, so about 19 Wh per full charge each. Charge from nearly empty; set charges a day below 1 for top-ups.',
 est:'Estimate. The label on the appliance or a plug-in watt meter gives yours.'
};
const DEFAULT_LOADS=[
 {id:'lights',name:'LED lights',short:'Lights',w:60,wins:[[hm(6),hm(7)],[hm(17),hm(23)]],basis:'Estimate: about six 10 W LED bulbs.'},
 {id:'fridge',name:'Refrigerator, 18 cu ft top-freezer',short:'Fridge',w:125,surge:3,cyc:{on:20,every:60},basis:B.fridge,src:ES_URL},
 {id:'freezer',name:'Chest freezer, 8 to 12 cu ft',short:'Freezer',w:90,surge:3,cyc:{on:16,every:60},off:30,basis:B.freezer,src:ESF_URL},
 {id:'router',name:'Radio, router and modem',short:'Radio/router',w:15,basis:B.est},
 {id:'charge',name:'Phones charging (7)',short:'Phones',w:25,qty:7,chg:{wh:15.4,per:1,eff:0.8},wins:[[hm(19),hm(19)]],basis:B.phone},
 {id:'pump',name:'Water system pump',short:'Water pump',w:100,surge:3,wins:[[hm(8),hm(10)]],basis:B.est},
 {id:'furnace',name:'Furnace blower (oil or propane)',short:'Furnace fan',w:500,surge:2,mode:'off',thermo:{set:60,every:30},basis:B.est},
 {id:'laptop',name:'HP EliteBook 8 G1i 14" laptop, charging',short:'Laptop',w:65,mode:'off',chg:{wh:62,per:1,eff:0.85},wins:[[hm(19),hm(19)]],basis:B.laptop,src:HP_URL},
 {id:'tv',name:'TV',short:'TV',w:100,mode:'off',wins:[[hm(20),hm(22)]],basis:B.est},
 {id:'micro',name:'Microwave',short:'Microwave',w:1200,mode:'off',wins:[[hm(12),hm(12)+10],[hm(18),hm(18)+10]],basis:'Estimate. Use the input watts on the nameplate, which run higher than the cooking watts on the box.'},
 {id:'coffee',name:'Coffee maker',short:'Coffee',w:900,mode:'off',wins:[[hm(7),hm(7)+10]],basis:B.est},
 {id:'heater',name:'Space heater',short:'Space heater',w:1500,mode:'off',wins:[[hm(17),hm(23)]],cyc:{on:30,every:60},basis:'1,500 W is the high setting on most plug-in heaters; the 30-minutes-an-hour cycle is an estimate.'}
].map(mkLoad);
// Appliances you can add, grouped for the dropdown.
const PRESETS=[
 {g:'Your own',name:'Custom appliance',short:'Custom',w:100,basis:'Enter the watts from its label or a plug-in meter, and set when it runs.'},
 {g:'Your own',name:'Custom battery charger',short:'Charger',w:60,chg:{wh:100,per:1,eff:0.85},wins:[[hm(13),hm(13)]],basis:'Enter the battery size in Wh (mAh × volts ÷ 1000, or amp-hours × volts) and the charger\'s watts. 85% charger efficiency is an assumption.'},
 {g:'Charging and electronics',name:'HP EliteBook 8 G1i 14" laptop, charging',short:'Laptop',w:65,chg:{wh:62,per:1,eff:0.85},wins:[[hm(21),hm(21)]],basis:B.laptop,src:HP_URL},
 {g:'Charging and electronics',name:'HP EliteBook laptop, plugged in while working',short:'Laptop (work)',w:15,wins:[[hm(9),hm(17)]],basis:'Estimate: 10 to 20 W for office work with the battery already full; video calls and heavy work run higher. The 65 W adapter is the most it can pull.',src:HP_URL},
 {g:'Charging and electronics',name:'Smartphone, charging',short:'Phone',w:25,chg:{wh:15.4,per:1,eff:0.8},wins:[[hm(22),hm(22)]],basis:B.phone},
 {g:'Charging and electronics',name:'Power-tool battery charger (20 V, 5 Ah)',short:'Tool charger',w:90,chg:{wh:100,per:1,eff:0.85},wins:[[hm(13),hm(13)]],basis:'Estimate: a 20 V 5 Ah pack holds about 100 Wh; the 90 W charger draw and 85% efficiency are assumptions.'},
 {g:'Charging and electronics',name:'Starlink Standard dish',short:'Starlink',w:85,basis:'Starlink\'s spec sheet lists 75 to 100 W average for the Standard kit. Set to 85 W, on all day.',src:SL_URL},
 {g:'Charging and electronics',name:'Router and modem',short:'Router',w:15,basis:B.est},
 {g:'Charging and electronics',name:'TV',short:'TV',w:100,wins:[[hm(20),hm(22)]],basis:B.est},
 {g:'Charging and electronics',name:'CPAP machine',short:'CPAP',w:40,wins:[[hm(22),hm(6)]],basis:'Estimate; a heated humidifier raises it. Your machine\'s manual lists its draw.'},
 {g:'Food',name:'Refrigerator, 18 cu ft top-freezer',short:'Fridge',w:125,surge:3,cyc:{on:20,every:60},off:40,basis:B.fridge,src:ES_URL},
 {g:'Food',name:'Refrigerator, French-door or bottom-freezer',short:'Fridge (French door)',w:170,surge:3,cyc:{on:24,every:60},off:40,basis:'Set to about 1.6 kWh a day: the median ENERGY STAR label for 20 to 26 cu ft bottom-freezer fridges is 598 kWh a year (527 models). Running watts and cycle are estimates.',src:ES_URL},
 {g:'Food',name:'Refrigerator, side-by-side',short:'Fridge (side-by-side)',w:175,surge:3,cyc:{on:25,every:60},off:40,basis:'Set to about 1.75 kWh a day: the median ENERGY STAR label for 20 to 28 cu ft side-by-side fridges is 640 kWh a year (99 models). Running watts and cycle are estimates.',src:ES_URL},
 {g:'Food',name:'Compact refrigerator',short:'Mini fridge',w:80,surge:3,cyc:{on:19,every:60},off:20,basis:'Set to about 0.6 kWh a day: the median ENERGY STAR label for compact fridges up to 4.5 cu ft is 227 kWh a year (1,354 models). Running watts and cycle are estimates.',src:ES_URL},
 {g:'Food',name:'Chest freezer, 8 to 12 cu ft',short:'Freezer',w:90,surge:3,cyc:{on:16,every:60},off:10,basis:B.freezer,src:ESF_URL},
 {g:'Food',name:'Upright freezer, 13 to 17 cu ft',short:'Upright freezer',w:140,surge:3,cyc:{on:20,every:60},off:50,basis:'Set to about 1.1 kWh a day: the median ENERGY STAR label for 13 to 17 cu ft upright freezers is 405 kWh a year (223 models). Running watts and cycle are estimates.',src:ESF_URL},
 {g:'Food',name:'Electric kettle',short:'Kettle',w:1500,wins:[[hm(7),hm(7)+5]],basis:B.est},
 {g:'Water, heat and animals',name:'Heated water bowl for animals',short:'Water heater',w:60,thermo:{set:32,every:30},basis:B.est},
 {g:'Water, heat and animals',name:'Well pump, 1/2 HP 240 V submersible (Franklin 244505, 2-wire)',short:'Well pump 240V',w:670,surge:11,volt:240,wins:[[hm(7),hm(7)+12],[hm(18),hm(18)+12]],basis:'Franklin Electric AIM manual (M1311), single-phase motor table, 1/2 HP 230 V 2-wire model 244505: 670 W at full load (960 W at maximum service-factor load), 32.2 A locked rotor. Start-up surge here is 230 V × 32.2 A = about 7.4 kVA, about 11× running watts; that treats volt-amps as watts, which overstates the real start-up watts (an estimate). Franklin\u2019s generator table asks for at least 3 kW for this motor. Run time (two 12-minute runs a day) is a guess: set it for your tank and water use.',src:'https://franklinwater.com/resources/franklin-aim/'},
 {g:'Water, heat and animals',name:'Sump pump',short:'Sump pump',w:800,surge:3,cyc:{on:5,every:60},off:10,basis:B.est},
 {g:'Water, heat and animals',name:'Small space heater, low setting',short:'Heater (low)',w:750,wins:[[hm(21),hm(6)]],cyc:{on:30,every:60},basis:'750 W is the low setting on most plug-in heaters; the cycle is an estimate.'},
 {g:'Water, heat and animals',name:'Electric blanket',short:'Blanket',w:100,wins:[[hm(21),hm(23)]],basis:B.est},
 {g:'Household',name:'Washing machine',short:'Washer',w:500,surge:3,wins:[[hm(10),hm(11)]],basis:B.est},
 {g:'Household',name:'Box fan',short:'Box fan',w:50,wins:[[hm(13),hm(19)]],basis:B.est}
];
// Charging loads: run at the charger's watts from the start time until the battery is full, then stop.
function chgWh(l){return l.chg.wh*l.chg.per/l.chg.eff;} // outlet Wh per device per day
function chgMin(l){return Math.min(1440,Math.max(1,Math.round(chgWh(l)/Math.max(1,l.w)*60)));}
let loadSeq=0;
function cloneLoad(l){return JSON.parse(JSON.stringify(l));}
const dayMin=t=>((t%1440)+1440)%1440;
function inWin(md,s,e){if(s===e)return true;return s<e?(md>=s&&md<e):(md>=s||md<e);}
function inWins(md,w){for(const x of w)if(inWin(md,x[0],x[1]))return true;return false;}
function loadOn(l,t,tF){
 if(l.mode==='off')return false;
 if(l.chg){const md=dayMin(t);const st=l.wins[0][0];return ((md-st+1440)%1440)<chgMin(l);} // chargers stop when full, even when set to On
 if(l.mode==='on')return true;
 const md=dayMin(t); if(!inWins(md,l.wins))return false;
 if(l.thermo){const ev=l.thermo.every||30;const d=Math.max(0,Math.min(0.6,(l.thermo.set-tF)/80));return ((md+l.off)%ev)<d*ev;}
 if(l.cyc)return ((md+l.off)%l.cyc.every)<l.cyc.on;
 return true;}
function loadW(l){return l.w*l.qty;}
function loadFits(l,I){return !(l.volt===240&&!(I&&I.split));} // a 240 V load can\u2019t run on a 120 V-only inverter
function legShare(l){return l.volt===240?[0.5,0.5]:(l.leg===2?[0,1]:[1,0]);}
function fmtClock(m){m=dayMin(m);const h=Math.floor(m/60),mm=m%60;const ap=h<12?'am':'pm';return ((h%12)||12)+(mm?':'+String(mm).padStart(2,'0'):'')+' '+ap;}
function winText(l){
 if(l.mode==='off')return 'Off';
 if(l.chg){const m=chgMin(l);return 'Charges from '+fmtClock(l.wins[0][0])+' for about '+(m>=90?(m/60).toFixed(1)+' hr':m+' min')+', '+Math.round(chgWh(l))+' Wh from the outlet'+(l.qty>1?' each':'')+' a day';}
 if(l.mode==='on')return 'On nonstop';
 const all=l.wins.some(w=>w[0]===w[1]);
 let s=all?'All day':l.wins.map(w=>fmtClock(w[0])+'–'+fmtClock(w[1])).join(', ');
 if(l.thermo)s+=', more the colder it is below '+l.thermo.set+'°F outside';
 else if(l.cyc)s+=', running '+l.cyc.on+' of every '+l.cyc.every+' min';
 return s;}


// ---------- v4 equipment data from makers' datasheets (see the Sources tab) ----------
// Panel temperature coefficients (%/C): g = power (Pmax), b = open-circuit voltage, a = short-circuit current.
const PANEL_TC={
 r200:{g:-0.37,b:-0.28,a:0.05,fuse:20,mount:'open',tcSrc:'Renogy RSP200D-G3 datasheet',ds:'https://cdn.shopify.com/s/files/1/0631/0137/0483/files/RSP200D-G3_20Datasheet.pdf'},
 r320:{g:-0.37,b:-0.28,a:0.05,fuse:null,mount:'open',tcAssumed:true,tcSrc:'Coefficients and fuse rating not found for this model. The sim uses the most cautious values among the other datasheets.'},
 r400:{g:-0.32,b:-0.26,a:0.046,fuse:25,mount:'open',bifacial:true,tcSrc:'Renogy 320/400 W N-type bifacial datasheet (RSP400DCT). Renogy gives no bifaciality number.',ds:'https://cdn.shopify.com/s/files/1/0631/0137/0483/files/RSP400DCT-108x2-Datasheet.pdf'},
 rs200:{g:-0.35,b:-0.28,a:0.045,fuse:15,mount:'open',tcSrc:'Rich Solar RS-M200P datasheet',ds:'https://cdn.shopify.com/s/files/1/0058/2769/0553/files/RS-M200P_M200PB_20260717.pdf'},
 rs100:{g:-0.35,b:-0.28,a:0.045,fuse:10,mount:'open',tcSrc:'Rich Solar RS-M100 datasheet (the product page says 15 A fuse; the datasheet 10 A is used)',ds:'https://cdn.shopify.com/s/files/1/0058/2769/0553/files/RS-M100_M100B_20260717.pdf'},
 rf100:{g:-0.37,b:-0.28,a:0.05,fuse:15,mount:'glued',tcAssumed:true,tcSrc:'Fuse rating from the Renogy product page. Temperature coefficients not published there: cautious values assumed.'},
 lg435:{g:-0.350,b:-0.284,a:0.050,fuse:25,mount:'open',bifacial:true,bifi:0.70,noct:45,dims:'2094 × 1038 × 35 mm, 27.5 kg',vsys:1500,tcSrc:'LONGi LR4-72HBD 425-455M datasheet, version 20210508V13: Pmax −0.350 %/°C, Voc −0.284 %/°C, Isc +0.050 %/°C, NOCT 45 ± 2 °C, max series fuse 25 A, bifaciality 70 ± 5 %. The sim\u2019s cell-temperature model uses the open-rack glass/polymer coefficients for every panel; this one is dual glass, so its cell temperature is an approximation.',ds:'https://solarshop.baywa-re.ca/site/assets/Product%20Specs/LON-4203_DS.pdf'}
};
PANELS.forEach(p=>Object.assign(p,PANEL_TC[p.id]||{g:-0.37,b:-0.28,a:0.05,fuse:null,mount:'open',tcAssumed:true,tcSrc:'assumed'}));
// Battery temperature limits. bms:true means the battery itself blocks charging when cold.
const F2C=f=>(f-32)*5/9;
const BATT_TEMP={
 bb100:{bms:true,chgMinC:F2C(25),chgResumeC:F2C(25),disMinC:-20,parMax:16,tSrc:'Battle Born BB10012 data sheet: charge temperature 25\u00b0F to 135\u00b0F with low-temperature charging protection; discharge -4\u00b0F to 135\u00b0F; series up to 48 V; unlimited parallel. It lists low-temperature protection without a discharge number, so the sim assumes discharging stops below -4\u00b0F, and the charge resume point is not published, so the sim uses the same 25\u00b0F. The sim caps parallel at 16 only to keep the page usable.',ds:'https://battlebornbatteries.com/cdn/shop/files/BB10012_Data_Sheet.pdf'},
 lt100:{bms:false,chgMinC:0,disMinC:null,tSrc:'LiTime product page: charge 32\u2013122\u00b0F, and this model has no low-temperature protection. Nothing stops a charger below freezing, which LiTime says not to do.',coldMsg:'Charging the LiTime 100Ah below 32\u00b0F. This model has no cold protection, so the charger keeps going; LiTime says not to charge it below freezing (lithium plating damage).'},
 lt230:{bms:true,chgMinC:0,chgResumeC:5,disMinC:-20,tSrc:'LiTime product page: 32\u00b0F charging off, -4\u00b0F discharging off, 41\u00b0F charging resume.'},
 lth100:{bms:true,chgMinC:0,chgResumeC:5,disMinC:-20,tSrc:'LiTime product page: charging off below 32\u00b0F, back on at 41\u00b0F; 100 W heating pads run when it is between -4\u00b0F and 41\u00b0F and the charger gives at least 10 A; heating takes 70\u201390 min from 14\u00b0F and 100\u2013150 min from -4\u00b0F. The page leaves the discharge cutoff blank, so the sim assumes -4\u00b0F, the bottom of its rated discharge range.'},
 lt48:{bms:true,chgMinC:0,chgResumeC:5,disMinC:-20,tAssumed:true,tSrc:'LiTime says this battery has low-temperature protection with automatic recovery but gives no numbers here: 32\u00b0F off, 41\u00b0F on and -4\u00b0F discharge cutoff assumed from LiTime\u2019s 230Ah.'},
 agm100:{bms:false,chgMinC:0,disMinC:null,tSrc:'Renogy rates charging at 32\u2013122\u00b0F. An AGM has no BMS, so nothing stops a charger below that; the sim keeps charging and counts the minutes.',coldMsg:'Charging the AGM below 32\u00b0F, outside Renogy\u2019s rated charging range. Nothing stops it; the sim keeps charging.',ds:'https://images.thdstatic.com/catalog/pdfImages/1d/1d0afee3-061e-447a-a38a-6826588bee5f.pdf'}
};
BATTS.forEach(b=>{Object.assign(b,BATT_TEMP[b.id]||{bms:true,chgMinC:0,chgResumeC:5,disMinC:-20});if(b.parMax)b.maxPar=b.parMax;});
// Internal resistance for the fault-current estimate (elec.js). Battle Born data sheet: 7 milliohms. LiTime 12 V user manuals
// (100 Ah, 230 Ah, self-heating): "<=40 milliohms", an upper limit. No figure found for the 48 V rack or the Renogy AGM.
const FAULT_RES={bb100:{ohm:0.007,kind:'published',src:'Battle Born data sheet: 7 m\u03a9'},lt100:{ohm:0.040,kind:'upper',src:'LiTime manual: \u226440 m\u03a9'},lt230:{ohm:0.040,kind:'upper',src:'LiTime manual: \u226440 m\u03a9'},lth100:{ohm:0.040,kind:'upper',src:'LiTime manual: \u226440 m\u03a9'}};
BATTS.forEach(b=>{b.fres=FAULT_RES[b.id]||{ohm:b.r,kind:'est',src:'no maker figure; '+Math.round(b.r*1000)+' m\u03a9 assumed'};});
// Inverters: Victron datasheets. contPts = continuous watts vs inverter air temperature.
const INV_DS={
 'p12-800':{name:'Victron Phoenix 12/800 120V',cont:800,contPts:[[25,800],[40,650]],derF:0.0125,tl:{w:900,min:60},peak:1200,peakS:15,eff:0.90,idle:8,low:9.3,restart:10.9},
 'p24-800':{name:'Victron Phoenix 24/800 120V',cont:800,contPts:[[25,800],[40,650]],derF:0.0125,tl:{w:900,min:60},peak:1200,peakS:15,eff:0.90,idle:8,low:18.6,restart:21.8},
 'p12-1200':{name:'Victron Phoenix 12/1200 120V',cont:1200,contPts:[[25,1200],[40,1100]],derF:0.0125,tl:{w:1300,min:60},peak:1600,peakS:15,eff:0.91,idle:11,low:9.3,restart:10.9},
 'p24-1200':{name:'Victron Phoenix 24/1200 120V',cont:1200,contPts:[[25,1200],[40,1100]],derF:0.0125,tl:{w:1300,min:60},peak:1600,peakS:15,eff:0.91,idle:11,low:18.6,restart:21.8},
 'p48-800':{name:'Victron Phoenix 48/800 120V',contPts:[[25,800],[40,650]],derF:0.0125,tl:{w:900,min:60},peak:1200,peakS:15,eff:0.91,idle:9,low:37.2,restart:43.6},
 'p48-1200':{name:'Victron Phoenix 48/1200 120V',contPts:[[25,1200],[40,1100]],derF:0.0125,tl:{w:1300,min:60},peak:1600,peakS:15,eff:0.92,idle:12,low:37.2,restart:43.6},
 'm12-3000':{contPts:[[25,2400],[40,2200],[65,1700]]},'m24-3000':{contPts:[[25,2400],[40,2200],[65,1700]]},'m48-3000':{contPts:[[25,2400],[40,2200],[65,1700]]},
 'm24-5000':{contPts:[[25,4000],[40,3700],[65,3000]]},'m48-5000':{contPts:[[25,4000],[40,3700],[65,3000]]}
};
const PH_DS='https://www.victronenergy.com/upload/documents/Datasheet-Inverter-VE.Direct-250W-1600W-120V-EN_.pdf',MP_DS='https://www.victronenergy.com/upload/documents/Datasheet-MultiPlus-II-120V-EN.pdf';
const MPPT_DS={'100/30':'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-100-30-&-100-50-EN.pdf','150/35':'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-150-35-EN.pdf','150/70':'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-150-45-up-to-150-100-EN.pdf','250/70':'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-250-60-up-to-250-100-EN.pdf'};
INVS.forEach(i=>{Object.assign(i,INV_DS[i.id]||{});i.ds=i.id[0]==='m'?MP_DS:PH_DS;if(!i.contPts)i.contPts=[[25,i.cont]];i.c25=i.contPts[0][1];i.cont=i.c25;i.units=1;});
// 120/240 V split phase: two identical MultiPlus-II 120V units, one per leg. Victron\u2019s MultiPlus-II 120V datasheet: \u201ctwo units of the same model can be connected for a 240 V split phase output\u201d. Each leg is limited to one unit\u2019s rating; a 240 V load draws half its power from each unit.
['m12-3000','m24-3000','m24-5000','m48-3000','m48-5000'].forEach(id=>{const b=INVS.find(i=>i.id===id);INVS.push(Object.assign({},b,{id:'sp-'+id,base:id,name:'2 × '+b.name+', split phase 120/240 V',units:2,split:true,price:Math.round(b.price*2*100)/100}));});
function invLossT(I,P,legs){if(!I.split)return PHYS.invLoss(I,P);const a=legs?legs[0]:P/2,b=legs?legs[1]:P/2;return PHYS.invLoss(I,a)+PHYS.invLoss(I,b);} // total loss of both units of a pair
// Controller battery-terminal size limits (Victron datasheets); null = not stated in the datasheet on file.
const MPPT_TERM={'100/30':'6','100/50':'6','150/35':'6','150/45':'6','150/70':'2','250/70':'2'};
// Nominal PV power per battery voltage (Victron SmartSolar datasheets). Extra panel watts are clipped, not harmful.
const MPPT_PV={'100/30':{12:440,24:880},'150/35':{12:500,24:1000,48:2000},'150/70':{12:1000,24:2000,48:4000},'250/70':{12:1000,24:2000,48:4000}};
MPPTS.forEach(m=>{const k=(m.name.match(/(\d+\/\d+)/)||[])[1];m.termG=k&&MPPT_TERM[k]!==undefined?MPPT_TERM[k]:null;m.pv=MPPT_PV[m.id]||{};m.ds=MPPT_DS[m.id];});
const INDOOR_C=18;            // assumed heated-room temperature (64F)
// PVWatts default loss categories the sim keeps: soiling 2%, mismatch 2%, connections 0.5%, light-induced 1.5%, nameplate 1%.
// Wiring, shading, snow and availability are modeled separately or left out.
const OTHER_LOSS=1-0.98*0.98*0.995*0.985*0.99;
const GAUGES=['14','12','10','8','6','4','2','1/0','2/0','3/0','4/0'];
const STD_FUSES=[15,20,25,30,35,40,45,50,60,70,80,90,100,110,125,150,175,200,225,250,300,350,400,450,500,600];
// Weather access: day remap lets the synthetic worst-week line up gray days that are not consecutive in the file.
let REMAP=null;
function wxT(t){if(!REMAP)return t;const d=Math.floor(t/1440)%365;const r=REMAP[d];return r===undefined?t:t+(r-d)*1440;}
let _pvh=null,_pvhKey='';
function pvHourly(){const c=S.cfg;const mount=(c.mount&&c.mount!=='auto')?c.mount:PANEL.mount;const bif=(PANEL.bifacial&&c.bifOn&&mount==='open')?(PANEL.bifi||BIFACIALITY):0; // the back can only see light with open air behind it
const k=[WXID,c.tilt,c.az,mount,bif,(c.hor||[]).join(',')].join('|');if(_pvh&&_pvhKey===k)return _pvh;_pvh=PHYS.hourly(WX,{tilt:+c.tilt,az:+c.az,mount,bif,rearLoss:0,hor:c.hor});_pvhKey=k;return _pvh;}
const BIFACIALITY=0.70; // assumed for the Renogy 400 W (Renogy publishes no bifaciality figure); LONGi publishes 70 +- 5 % for its panel (PANEL.bifi)
// ---------- Weather ----------
const N=8760, YEARMIN=N*60;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MDAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
const MSTART=[];{let s=0;for(const d of MDAYS){MSTART.push(s);s+=d;}}
// clear-ish reference per hour: max over +-7 days of the same hour
const REF=new Float32Array(N);
const WX_TMY={dn:TMY.dn,df:TMY.df,ta:TMY.ta,ws:TMY.ws,alb:TMY.alb,lat:TMY.meta.lat,lon:TMY.meta.lon,tz:TMY.meta.tz};
// Weather in use. 'tmy' = the typical year (NSRDB TMY via PVWatts). 'w2009' = observed winter Nov 1 2009 - Feb 28 2010
// from NASA POWER hourly data, spliced into the typical year (days outside Nov-Feb stay typical).
let WX=WX_TMY, WXID='tmy', GHI=null;
function computeRef(){GHI=PHYS.hourly(WX,{tilt:0,az:180,mount:'open',bif:0}).ghi;for(let i=0;i<N;i++){let mx=0;const h=i%24,d=Math.floor(i/24);for(let k=-7;k<=7;k++){const dd=(d+k+365)%365;const v=GHI[dd*24+h];if(v>mx)mx=v;}REF[i]=mx;}}
computeRef();
const HIST_DAY0=304; // Nov 1 in a 365-day year
const _histCache={};
function histWinter(y){
 if(_histCache[y])return _histCache[y];
 if(typeof HIST==='undefined')return null;
 const w=HIST.winters.find(x=>x.y===y);if(!w)return null;
 const bin=atob(w.b64),H=2880,u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
 const dv=new DataView(u8.buffer),dn=new Float32Array(H),df=new Float32Array(H),ta=new Float32Array(H),ws=new Float32Array(H),alb=new Float32Array(120);
 for(let i=0;i<H;i++){dn[i]=dv.getUint16(i*2,true);df[i]=dv.getUint16(2*H+i*2,true);ta[i]=dv.getInt8(4*H+i)/2;ws[i]=dv.getUint8(5*H+i)/10;}
 for(let d=0;d<120;d++){const a=dv.getUint8(6*H+d);alb[d]=a===255?NaN:a/100;}
 return(_histCache[y]={y,dn,df,ta,ws,alb});
}
// hour index in the 8760-h year for winter hour k (0..2879)
function histHourIdx(k){const d=Math.floor(k/24),h=k%24;const yd=d<61?HIST_DAY0+d:d-61;return yd*24+h;}
function buildHistWX(y){
 const W=histWinter(y);if(!W)return null;
 const o={dn:Float64Array.from(TMY.dn),df:Float64Array.from(TMY.df),ta:Float64Array.from(TMY.ta),ws:Float64Array.from(TMY.ws),alb:Float64Array.from(TMY.alb),lat:TMY.meta.lat,lon:TMY.meta.lon,tz:TMY.meta.tz};
 for(let k=0;k<2880;k++){const i=histHourIdx(k);o.dn[i]=W.dn[k];o.df[i]=W.df[k];o.ta[i]=W.ta[k];o.ws[i]=W.ws[k];const a=W.alb[Math.floor(k/24)];if(isFinite(a))o.alb[i]=a;}
 return o;
}
// Weather switch. Each weather set keeps its own derived arrays so switching back and forth is cheap.
const _wxCache={};
function setWeather(id){
 if(id===WXID)return true;
 _wxCache[WXID]={WX,GHI,REF:Float32Array.from(REF),pvh:_pvh,pvhKey:_pvhKey};
 const c=_wxCache[id];
 if(c){WX=c.WX;GHI=c.GHI;REF.set(c.REF);_pvh=c.pvh;_pvhKey=c.pvhKey;WXID=id;return true;}
 if(id==='tmy'){WX=WX_TMY;}
 else{if(!/^w\d{4}$/.test(String(id)))return false;const y=+String(id).slice(1);const o=buildHistWX(y);if(!o)return false;WX=o;}
 WXID=id;_pvh=null;_pvhKey='';computeRef();return true;
}
function dropWxCache(){for(const k in _wxCache)if(k!=='tmy'&&k!==WXID)delete _wxCache[k];}
function wxYear(t){if(WXID==='tmy')return '';const y=+WXID.slice(1),d=Math.floor((((t%YEARMIN)+YEARMIN)%YEARMIN)/1440);if(d>=HIST_DAY0)return ' '+y;if(d<59)return ' '+(y+1);return ' (typical)';}
function wxLabel(id){id=id||WXID;if(id==='tmy')return 'Typical year (TMY)';const y=+String(id).slice(1);return 'Observed winter '+y+'\u2013'+String(y+1).slice(2)+' (NASA POWER)';}
function lerpArr(a,t){const x=t/60-0.5;let i=Math.floor(x);const f=x-i;const i0=(i%N+N)%N,i1=((i+1)%N+N)%N;return a[i0]*(1-f)+a[i1]*f;}
function cToF(c){return c*9/5+32;}
function fToC(f){return (f-32)*5/9;}
function dateStr(t){t=((t%YEARMIN)+YEARMIN)%YEARMIN;const d=Math.floor(t/1440);let m=0;while(m<11&&d>=MSTART[m+1])m++;const day=d-MSTART[m]+1;const mi=t%1440;let h=Math.floor(mi/60),mm=Math.floor(mi%60);const ap=h<12?'am':'pm';let h12=h%12;if(h12===0)h12=12;return MONTHS[m]+' '+day+', '+h12+':'+String(mm).padStart(2,'0')+' '+ap;}

// ---------- State ----------
const S={
 cfg:{panel:'r200',batt:'bb100',other:0,sysV:24,ser:3,par:2,shade:0,mppt:'150/35',nMppt:1,bpar:2,bloc:'in',inv:'m24-3000',coldF:-20,tilt:40,az:180,mount:'auto',bifOn:false,pvMat:'cu',pvG:'10',pvFt:50,cbMat:'cu',cbG:'6',cbFt:5,biMat:'cu',biG:'2/0',biFt:5,soh:100,heatSpeed:'mid',ambF:null,ccc:null,insC:null,termC:null,hor:[0,0,0,0,0,0,0,0],snowRec:true,reserve:0,genOn:false,genMode:'manual',genFuel:0.95,genStart:20,genStop:80,ageOn:false,ageYears:0},
 loads:DEFAULT_LOADS.map(cloneLoad),savedLoads:null,pvOpen:false,
 t:(302*1440)+6*60, soc:1, battT:18, snow:0, blastUntil:-1, randomSnow:false,
 mpptDead:false, mpptRun:false, invOn:true, invTrip:false, invLow:false, bmsTrip:false, overMin:0, ovl:0, coldLock:false, coldDis:false, coldWarnDay:-1, genRun:false, genFuelLeft:0.95, prevOn:{},
 lastI:0, vbat:0, absMin:0, absDay:-1, live:{}, stats:null, day:null, hist:[], log:[], mission:null, missionEnd:null, playing:false, warnedIsc:false
};
const SNOW_COVER_MM=1, SNOW_RATIO=10, SNOW_M=-80, SNOW_SLIDE=0.197; // cover trigger: >= 1 mm/day water equivalent (about 1 cm of snow at an assumed 10:1 ratio): an estimate adapted from pvlib's 1 cm/hour trigger, because NASA POWER gives daily totals
function newStats(){return {startT:S.t,mins:0,served:0,unserved:0,requested:0,unfitWh:0,unfitMin:0,blackMin:0,pvIn:0,pvWaste:0,minSoc:S.soc,faults:0,tripInv:0,tripBms:0,lowV:0,dead:0,heat:0,wirePv:0,wireCb:0,wireBi:0,invLoss:0,ctlLoss:0,coldChg:0,coldDis:0};}
function newDay(){return {pv:0,load:0,d:Math.floor(S.t/1440)};}
S.stats=newStats();S.day=newDay();

function mppt(){return MPPTS.find(m=>m.id===S.cfg.mppt);} 
function inv(){return INVS.find(i=>i.id===S.cfg.inv);} 
function nSer(){const n=S.cfg.sysV/BATT.mod;return n>=1?Math.round(n):0;}
function nBatt(){return nSer()*S.cfg.bpar;}
// ---------- Multi-year battery aging (estimate) ----------
// Cycle life: each maker's published cycles at a depth of discharge. Turned into full-cycle equivalents (cycles x depth),
// so 15,000 cycles at 60% = 9,000 full cycles' worth of energy. End of rated life is taken as 80% capacity left: an
// estimate, because none of these makers says what capacity remains at the end. Calendar loss is an estimate too: no
// maker here publishes one. Capacity loss is a straight line in both, and a battery that has lost capacity is assumed
// to keep cycling at the same rate (in reality a smaller bank cycles deeper and wears a little faster).
const LT3=[[60,15000],[80,6000],[100,4000]];
const LT3_NOTE='LiTime\'s page: 4,000 cycles at 100% depth, 6,000 at 80% and 15,000 at 60%, and a 10-year lifespan.';
const AGE_DATA={
 bb100:{cyc:[[100,3000]],cal:0.01,note:'Battle Born\'s data sheet: 3,000 to 5,000 deep discharge cycles, 100% usable depth. The sim uses the low end, 3,000, at every depth; the data sheet gives no figure for shallower cycling.'},
 lt100:{cyc:LT3,cal:0.01,note:LT3_NOTE},
 lt230:{cyc:LT3,cal:0.01,note:LT3_NOTE},
 lth100:{cyc:LT3,cal:0.01,note:LT3_NOTE},
 lt48:{cyc:[[100,4000]],cal:0.01,note:'LiTime\'s page: 4,000+ cycles at 100% depth and 10+ years of battery life. It gives no figure for shallower cycling, so 4,000 is used at every depth.'},
 agm100:{cyc:[[50,500]],cal:0.04,note:'Renogy\'s page: 500 cycles at 50% depth (0.5C, 77\u00b0F). It gives no figure for other depths, so 500 is used at every depth; for daily swings deeper than 50% that flatters the battery.'}};
const AGE_EOL=0.8,AGE_YEARS=[1,5,10],AGE_MIN=0.6;
let AGE_SOH=null,AGE_RUN=null;
function ageEfcLife(d,dod){const pts=d.cyc.map(([p,n])=>[p,n*p/100]);if(dod<=pts[0][0])return pts[0][1];
 for(let i=1;i<pts.length;i++)if(dod<=pts[i][0]){const [a,x]=pts[i-1],[b,y]=pts[i];return x+(y-x)*(dod-a)/(b-a);}return pts[pts.length-1][1];}
function ageSoh(d,efcYr,dod,years){return 1-years*((1-AGE_EOL)*efcYr/ageEfcLife(d,dod)+d.cal);}
function sohF(){if(AGE_SOH!==null)return AGE_SOH;const v=+S.cfg.soh;return (isFinite(v)&&v>=50&&v<=100?v:100)/100;}
function capWh(){return nBatt()*BATT.ah*BATT.vnom*sohF();}
function bankAh(){return S.cfg.bpar*BATT.ah*sohF();}
function heatRate(){return (BATTMODEL.HEAT[S.cfg.heatSpeed]||BATTMODEL.HEAT.mid).rate;}
function ctlShares(par,nC){const a=[];for(let k=0;k<nC;k++)a.push(Math.floor(par/nC)+(k<par%nC?1:0));return a;}
function arrayW(){return S.cfg.ser*S.cfg.par*PANEL.w;}
function log(msg,bad){if(S.quiet)return;S.log.unshift({t:S.t,msg,bad:!!bad});if(S.log.length>80)S.log.pop();renderLog();}

// ---------- One simulated minute ----------
function step(){const FL=Math.max(BATT.floor,(S.cfg.reserve||0)/100); // empty point: the battery's own floor or your reserve, whichever is higher
 const c=S.cfg, M=mppt(), I=inv(), ns=nSer(), bp=c.bpar, nC=c.nMppt;
 const t=S.t, tw=wxT(t);
 const blast=(S.blastUntil>t)?-15:0;
 const ta=lerpArr(WX.ta,tw)+blast; const taF=cToF(ta);
 const PVH=pvHourly();
 const poa=Math.max(0,lerpArr(PVH.poa,tw)), geff=Math.max(0,lerpArr(PVH.eff,tw));
 const tcell=lerpArr(PVH.tcell,tw)+blast;
 // snow
 if(S.randomSnow&&t%1440===0){const d=Math.floor(t/1440);const mo=monthOf(d);if((mo<=2||mo>=10)&&Math.random()<0.12&&ta<2){S.snow=1;log('Overnight snow buried the panels. Brush them off.',true);}}
 const recSnow=c.snowRec&&WXID!=='tmy'&&typeof SNOWHIST!=='undefined';
 if(recSnow&&t%1440===0){const d=Math.floor(t/1440),wi=d>=HIST_DAY0?d-HIST_DAY0:d+(365-HIST_DAY0);const w=SNOWHIST.w[WXID.slice(1)];const sf=w&&wi>=0&&wi<120?w.sf[wi]:0;
  if(sf>=SNOW_COVER_MM){S.snow=1;S.stats.snowDays=(S.stats.snowDays||0)+1;log('Recorded snowfall ('+(sf*SNOW_RATIO/10).toFixed(1)+' cm estimated) covered the panels.',true);}}
 if(S.snow>0){if(recSnow){// Marion et al. 2013 (NREL), as in pvlib.snow.coverage_nrel: snow slides when air temp > POA / m (m = -80 W/m2/C), 0.197 x sin(tilt) of the panel per hour
   if(ta>poa/SNOW_M)S.snow=Math.max(0,S.snow-SNOW_SLIDE*Math.sin(c.tilt*Math.PI/180)/60);}
  else{let melt=0;if(ta>2)melt+=0.12/60;if(poa>300&&ta>-3)melt+=0.06/60;S.snow=Math.max(0,S.snow-melt);}
  if(S.snow>0)S.stats.snowMin=(S.stats.snowMin||0)+1;if(S.snow===0)log('The snow slid off the panels.');}
 // battery temperature (follows the room or the shed air with a 4-hour lag: estimate)
 const envT=c.bloc==='in'?INDOOR_C:ta; S.battT+=(envT-S.battT)*(1/240);
 // cold limits, per battery, from each maker's published numbers
 let coldBlock=false;
 if(BATT.bms){if(S.coldLock){if(S.battT>=BATT.chgResumeC)S.coldLock=false;}else if(S.battT<BATT.chgMinC)S.coldLock=true;coldBlock=S.coldLock;}
 const coldRisk=!BATT.bms&&S.battT<BATT.chgMinC;
 if(BATT.disMinC!=null&&BATT.bms){if(S.battT<BATT.disMinC){if(!S.coldDis){S.coldDis=true;S.stats.coldDis++;log('Battery too cold to power anything: its BMS cut discharging at '+Math.round(cToF(S.battT))+'°F (rated down to '+Math.round(cToF(BATT.disMinC))+'°F).',true);}}else if(S.coldDis&&S.battT>BATT.disMinC+2){S.coldDis=false;log('Battery warmed up: discharging allowed again.');}}
 // loads
 let demand=0,surge=0,unfit=0;const on={},legD=[0,0],legS=[0,0];
 for(const l of S.loads){let o=loadOn(l,t,taF);if(o&&!loadFits(l,I)){unfit+=loadW(l);o=false;}on[l.id]=o;if(o){const w=loadW(l),sh=legShare(l),su=!S.prevOn[l.id]?w*(l.surge-1):0;demand+=w;surge+=su;legD[0]+=w*sh[0];legD[1]+=w*sh[1];legS[0]+=su*sh[0];legS[1]+=su*sh[1];}}
 S.unfitW=unfit; // Incompatible requests remain unmet household demand, not a successful blackout-free minute.
 // per-unit view: a single inverter sees everything; a split-phase pair is judged on its busier leg
 const uD=I.split?Math.max(legD[0],legD[1]):demand, uS=I.split?Math.max(legD[0]+legS[0],legD[1]+legS[1])-uD:surge;
 S.prevOn=on;
 // battery voltage (rest + last current)
 const imod=S.lastI/bp; const vb=ns*(bv(S.soc)+imod*BATT.r); S.vbat=vb; const vRest=ns*bv(S.soc);
 // inverter: continuous rating at its air temperature (inverter sits with the battery)
 const invT=c.bloc==='in'?INDOOR_C:ta;
 const contNow=PHYS.invCont(I,invT);
 let invRun=S.invOn&&!S.invTrip&&!S.invLow&&!S.bmsTrip&&!S.coldDis;
 if(S.invLow&&!S.bmsTrip&&!S.coldDis&&vRest>=I.restart*(c.sysV/I.v)&&(FL<=0||S.soc>=FL+0.05)){S.invLow=false;log('Battery recovered: inverter restarted.');invRun=S.invOn&&!S.invTrip;}
 if(invRun){
  const trip=m=>{S.invTrip=true;S.stats.tripInv++;S.stats.faults++;log(m,true);invRun=false;};
  const legTxt=I.split?' on one leg (each unit carries one leg)':'';
  if(uD+uS>I.peak)trip('Inverter overload trip: '+Math.round(uD+uS)+' W start-up surge'+legTxt+' beat its '+I.peak+' W peak.');
  else if(uD>contNow){
   if(I.tl){
    if(uD>I.tl.w)trip('Inverter overload trip: '+Math.round(demand)+' W is over its '+I.tl.w+' W time-limited rating; it holds its '+I.peak+' W peak only '+I.peakS+' seconds.');
    else{S.ovl+=(uD-contNow)/Math.max(1,I.tl.w-contNow)/I.tl.min;if(S.ovl>=1)trip('Inverter overload trip: ran over its '+Math.round(contNow)+' W continuous rating until it overheated ('+I.tl.w+' W is rated for '+I.tl.min+' min from cold).');}
   }else{S.overMin++;if(S.overMin>=2)trip('Inverter overload trip: '+Math.round(uD)+' W'+legTxt+' for 2 minutes, rated '+Math.round(contNow)+' W at '+Math.round(cToF(invT))+'°F.');}
  }else{S.overMin=0;S.ovl=Math.max(0,S.ovl-(I.tl?1/I.tl.min:1));}
 }
 // generator backup (MultiPlus PowerControl: house loads pass through, whatever is left charges the battery)
 // The EU2200i is recoil-started: manual mode NEVER silently starts it. Attended
 // mode explicitly assumes a person is present to operate it at the thresholds.
 const gOK=c.genOn&&chgA(I)>0;
 if(!gOK||S.genFuelLeft<genGph(0)/60){
  if(S.genRun&&S.genFuelLeft<genGph(0)/60)log('Generator stopped: not enough fuel for another full simulated minute.',true);
  S.genRun=false;
 }else if(c.genMode==='attended'){
  if(!S.genRun&&S.soc<=c.genStart/100){S.genRun=true;S.stats.genStarts=(S.stats.genStarts||0)+1;log('Attended operator assumed: generator manually started at '+Math.round(S.soc*100)+'% battery.');}
  else if(S.genRun&&S.soc>=c.genStop/100){S.genRun=false;log('Attended operator assumed: generator manually stopped.');}
 }
 // Available fuel bounds output within each minute, not just after the simulation.
 const minGph=genGph(0),ratedGph=genGph(GEN_DS.w);
 const fuelPower=S.genFuelLeft>=ratedGph/60?GEN_DS.w:Math.max(0,GEN_DS.w/4+(S.genFuelLeft*60-minGph)*(GEN_DS.w*0.75)/(ratedGph-minGph));
 const genLimit=S.genRun?Math.min(GEN_DS.w,fuelPower):0;
 const genAC=S.genRun&&invRun?Math.min(I.split?legD[0]:demand,genLimit):0; // 120 V input is only on L1
 const invD=demand-genAC,invLeg=I.split?[legD[0]-genAC,legD[1]]:legD;
 let invLossW=invRun?invLossT(I,invD,invLeg):0;
 let invDC=invRun?invD+invLossW:0; // at the inverter's DC terminals
 // battery-to-inverter cable: the battery supplies invDC plus the cable's I^2R
 const nU=I.units||1;const biCable=()=>{if(invDC<=0)return {I:0,R:0,W:0,V:0};const P=invDC/nU;const T=PHYS.condTemp(envT,P/vb,c.biMat,c.biG);const R=PHYS.loopR(c.biMat,c.biG,c.biFt,T);const disc=vb*vb-4*R*P;const Ii=disc>0?(vb-Math.sqrt(disc))/(2*R):vb/(2*R);return {I:Ii*nU,R,W:Ii*Ii*R*nU,V:Ii*R,collapse:disc<=0};}; // a split-phase pair has one cable per unit
 let bi=biCable();
 // PV: per-panel output from this array's own sun, glass loss, cell temperature and datasheet coefficient
 const nP=c.ser*c.par;
 const pPanel=Math.max(0,PANEL.w*geff/1000*(1+PANEL.g/100*(tcell-25))*(1-OTHER_LOSS));
 const pvAvail=pPanel*nP*(1-c.shade/100)*(1-S.snow);
 const voc=c.ser*PANEL.voc*(1+PANEL.b/100*(tcell-25));
 const vmpS=c.ser*PANEL.vmp*(1+(PANEL.g-PANEL.a)/100*(tcell-25));
 const SH=ctlShares(c.par,nC); // strings on each controller (whole strings, never an equal split)
 const pvRunAt=Ptot=>{if(Ptot<=0||vmpS<=0)return {W:0,V:0};let Wt=0,Vm=0;for(const k of SH){if(!k)continue;const r=PHYS.runLoss(c.pvMat,c.pvG,c.pvFt,ta,Ptot*k/c.par/vmpS);Wt+=r.W;Vm=Math.max(Vm,r.V);}return {W:Wt,V:Vm};};
 const pvFull=pvRunAt(pvAvail);
 const vmp=vmpS-pvFull.V; // what the controller sees
 let state='Night';
 let harvestable=Math.max(0,pvAvail-pvFull.W)*M.eff, mOut=0;
 const supportsV=M.volts.includes(c.sysV);
 const lit=poa>2;
 if(S.mpptDead){state='Burned out';S.mpptRun=false;}
 else if(S.pvOpen){state='PV disconnect open: no panel power';S.mpptRun=false;harvestable=0;}
 else if(!supportsV){state='Wrong battery voltage';S.mpptRun=false;}
 else if(lit&&voc>M.abs){S.mpptDead=true;S.mpptRun=false;S.stats.dead++;S.stats.faults++;state='Burned out';log('Controller destroyed: panel voltage hit '+voc.toFixed(0)+' V on a '+Math.round(taF)+'°F morning, over its '+M.abs+' V absolute limit.',true);}
 else if(lit&&voc>M.op){state='PV over-voltage, waiting';S.mpptRun=false;}
 else if(!lit||pvAvail<1){state=!lit?'Night':S.snow>0.9?'Panels buried in snow':'Too little light';S.mpptRun=false;}
 else{
  if(!S.mpptRun&&vmp>=vb+5)S.mpptRun=true;
  if(S.mpptRun&&vmp<vb+1)S.mpptRun=false;
  state=S.mpptRun?'Charging':'PV voltage too low to start';
 }
 if(S.bmsTrip){S.mpptRun=false;if(!S.mpptDead)state='Battery disconnected';}
 const maxOut=S.mpptRun?SH.reduce((a,k)=>a+Math.min(harvestable*k/c.par,M.amps*vb),0):0; // a controller can only convert its own strings, up to its own current limit
 let chargeLim=0;const cap=capWh();
 // absorption stage (battery.js): taper from absStart (assumed), lithium drops to float after Battle Born's 30 min per 100 Ah
 const absA=BATTMODEL.ABS[BATT.chem==='agm'?'agm':'lfp'];
 if(S.soc<absA.absStart-0.05||Math.floor(t/1440)!==S.absDay){S.absMin=0;S.absDay=Math.floor(t/1440);} // re-bulk point (assumed) and daily reset
 const ab=BATTMODEL.absorption(BATT.chem,S.soc,S.absMin,bankAh(),null);
 if(!S.bmsTrip&&!coldBlock&&!S.coldDis&&S.soc<1&&ab.mult>0){const a=bp*BATT.chargeA*Math.min(1,ab.mult);chargeLim=Math.min(a*vb,(1-S.soc)*cap*60/BATT.eta);}
 const possible=Math.min(harvestable,maxOut);
 // controller-to-battery cable(s)
 const cbAt=out=>{if(out<=0)return {W:0,V:0};const sh=SH.map(k=>Math.min(harvestable*k/c.par,M.amps*vb));const tot=sh.reduce((a,b)=>a+b,0)||1;let Wt=0,Vm=0;for(const x of sh){if(x<=0)continue;const r=PHYS.runLoss(c.cbMat,c.cbG,c.cbFt,envT,out*x/tot/vb);Wt+=r.W;Vm=Math.max(Vm,r.V);}return {W:Wt,V:Vm};};
 const withCb=x=>{let y=x;for(let k=0;k<4;k++)y=x+cbAt(y).W;return y;}; // the cable loss depends on the current it carries
 // self-heating battery: pad runs from solar when the battery is below freezing, until about 41F (maker's resume point)
 let heatW=0;
 if(BATT.heatW>0&&S.mpptRun&&!S.bmsTrip&&S.soc<1&&S.battT>=-20&&(S.battT<0||(S.heatOn&&S.battT<5))){const want=nBatt()*BATT.heatW;const spare=Math.max(0,possible-withCb(invDC+bi.W+nBatt()*BATT.heatW)+nBatt()*BATT.heatW);
  // LiTime: the pads need at least 10 A from the charger per battery string; they run at full 100 W or not at all
  if(spare>=Math.max(want,10*bp*vb))heatW=want;S.heatOn=heatW>0;if(heatW>0)S.battT+=heatRate()+(S.battT-envT)/240;}
 else S.heatOn=false;
 const need=invDC+bi.W+chargeLim+heatW;
 mOut=Math.min(possible,withCb(need));
 let cb=cbAt(mOut);
 if(S.mpptRun){if(heatW>0&&coldBlock)state='Heating battery before charging';else if(coldBlock&&mOut<possible-1)state='Battery too cold to charge (BMS)';else if(S.soc>=0.999&&mOut<possible-1)state='Float: battery full';else if(ab.phase==='float'&&mOut<possible-1)state='Float: absorption time done';else if(ab.phase==='absorption')state='Absorption';else if(mOut>=maxOut-1&&harvestable>maxOut)state='Bulk, at current limit';else state='Bulk';}
 // battery
 let P=mOut-cb.W-invDC-bi.W-heatW;
 let genDC=0;const genCharge=()=>{if(!S.genRun||S.bmsTrip)return 0;const room=Math.max(0,chargeLim-P);return Math.min(chgA(I)*vb,Math.max(0,genLimit-genAC)*CHG_EFF_EST,room);};
 genDC=genCharge();P+=genDC;
 const dropHouse=()=>{invRun=false;invDC=0;bi={I:0,R:0,W:0,V:0};mOut=Math.min(possible,withCb(chargeLim+heatW));cb=cbAt(mOut);P=mOut-cb.W-heatW;genDC=genCharge();P+=genDC;};
 if(P<0&&S.soc<=FL+1e-9){ // empty: BMS low cut (AGM: sim stops at 50%)
  if(invRun){S.invLow=true;S.stats.lowV++;log(FL>BATT.floor+1e-9?'Battery down to your '+Math.round(FL*100)+'% reserve: the sim shut the house off to keep the reserve in the battery.':FL>0?'Battery down to '+Math.round(FL*100)+'%: the sim shut the house off to protect the lead-acid battery.':'Battery empty: the battery cut off and the house went dark.',true);}
  dropHouse();
 }
 let Ibank=P/vb;
 // BMS current check
 if(!S.bmsTrip&&invRun){const peakI=(invDC+bi.W+surge+invLossT(I,demand+surge,[legD[0]+legS[0],legD[1]+legS[1]])-invLossW)/vb;
  if(BATT.cont>0&&(peakI>bp*BATT.surge||(-Ibank)>bankCont(bp))){S.bmsTrip=true;S.stats.tripBms++;S.stats.faults++;log('Battery BMS tripped: '+Math.round(Math.max(peakI,-Ibank))+' A draw beat '+bankCont(bp)+' A continuous / '+bp*BATT.surge+' A surge for this bank.',true);invRun=false;invDC=0;bi={I:0,R:0,W:0,V:0};mOut=0;cb={W:0,V:0};P=0;Ibank=0;genDC=0;heatW=0;S.heatOn=false;}}
 // low-voltage inverter shutdown: judged at the inverter's own terminals, after the cable drop
 let vInv=0;
 if(invRun){const vLoad=ns*(bv(S.soc)+(Ibank/bp)*BATT.r); vInv=vLoad-bi.V; if(bi.collapse||vInv<I.low*(c.sysV/I.v)){S.invLow=true;S.stats.lowV++;log('Inverter low-battery shutdown at '+Math.max(0,vInv).toFixed(1)+' V at its terminals'+(bi.V>0.2?' ('+bi.V.toFixed(1)+' V lost in the battery cable)':'')+'.',true);dropHouse();Ibank=P/vb;}}
 // battery runs empty part-way through this minute: serve only the share of the minute it can cover, then cut off
 // AGM: charge falls faster than energy out at high current and in the cold (Renogy sheet tables, battery.js)
 const dmR=P<0?BATTMODEL.drainMult(BATT.chem,(-P/vb)/bp,S.battT):{m:1};const dm=dmR.m;
 let fServe=1;
 if(P<0&&invRun){const avail=Math.max(0,S.soc-FL)*cap;if(-P*dm/BATT.eta/60>avail){const A=mOut-cb.W-heatW,H=invDC+bi.W;fServe=H>0?Math.max(0,Math.min(1,(A+avail*BATT.eta*60/dm)/H)):0;
  invDC*=fServe;invLossW*=fServe;bi={I:bi.I*fServe,R:bi.R,W:bi.W*fServe,V:bi.V};P=A-invDC-bi.W+genDC;Ibank=P/vb;S.invLow=true;S.stats.lowV++;
  log(FL>BATT.floor+1e-9?'Battery down to your '+Math.round(FL*100)+'% reserve: the sim shut the house off to keep the reserve in the battery.':FL>0?'Battery down to '+Math.round(FL*100)+'%: the sim shut the house off to protect the lead-acid battery.':'Battery empty: the battery cut off and the house went dark.',true);}}
 if(P>0){S.soc+=P*BATT.eta/60/cap;if(ab.phase==='absorption')S.absMin++;} else S.soc+=P*dm/BATT.eta/60/cap;
 if(fServe<1)S.soc=Math.max(S.soc,FL);
 S.soc-=BATT.selfM/(30*1440); S.soc=Math.max(0,Math.min(1,S.soc));
 S.lastI=Ibank;
 const served=invRun?genAC+invD*fServe:0, unservedSupply=invRun?invD*(1-fServe):demand, unserved=unservedSupply+unfit, requested=demand+unfit;
 if(S.genRun){
  const acDelivered=invRun?genAC:0;
  const gl=acDelivered+genDC/CHG_EFF_EST;
  const fuelUsed=Math.min(S.genFuelLeft,genGph(gl)/60);
  S.genFuelLeft=Math.max(0,S.genFuelLeft-fuelUsed);
  S.stats.genMin=(S.stats.genMin||0)+1;
  S.stats.genGal=(S.stats.genGal||0)+fuelUsed;
  S.stats.genACWh=(S.stats.genACWh||0)+acDelivered/60;
  S.stats.genDCWh=(S.stats.genDCWh||0)+genDC/60;
  if(S.genFuelLeft<genGph(0)/60){S.genRun=false;log('Generator fuel exhausted for continuous full-minute operation.',true);}
 }
 // PV cable loss at the power actually drawn
 const pIn=M.eff>0?mOut/M.eff:0; const pvRun=pvRunAt(pIn);
 // stats
 const st=S.stats;st.served+=served/60;st.unserved+=unserved/60;st.requested+=requested/60;st.unfitWh+=unfit/60;if(unfit>0)st.unfitMin++;if(unserved>1e-6)st.blackMin++;st.pvIn+=mOut/60;st.heat+=heatW/60;st.pvWaste+=Math.max(0,harvestable-mOut)/60;st.minSoc=Math.min(st.minSoc,S.soc);
 st.wirePv+=pvRun.W/60;st.wireCb+=cb.W/60;st.wireBi+=bi.W/60;st.invLoss+=(invRun?invLossW:0)/60;st.ctlLoss+=pIn*(1-M.eff)/60;
 if(P>0&&coldRisk){st.coldChg++;if(S.coldWarnDay!==Math.floor(t/1440)){S.coldWarnDay=Math.floor(t/1440);log(BATT.coldMsg,true);}}
 const d=Math.floor(t/1440);if(d!==S.day.d)S.day=newDay();S.day.pv+=mOut/60;S.day.load+=served/60;
 S.live={legD,requested,unservedSupply,unfit,genFuelLeft:S.genFuelLeft,genAC:invRun?genAC:0,genDC,genRun:!!S.genRun,ghi:lerpArr(GHI,tw),ta,taF,poa,geff,tcell,pPanel,pvAvail,harvestable,mOut,invDC,invLossW,contNow,heatW,demand,served,unserved,on,voc,vmp,state,Ibank,vb,vInv,invRun,coldBlock,coldRisk,maxOut,dm,absPhase:ab.phase,absMin:S.absMin,absLimit:ab.limit,wire:{pv:pvRun.W,cb:cb.W,bi:bi.W,biV:bi.V}};
 if(t%10===0){S.hist.push([t,mOut,served,S.soc]);if(S.hist.length>288)S.hist.shift();}
 S.t++; if(S.t>=YEARMIN)S.t-=YEARMIN; S.stats.mins=(S.stats.mins||0)+1; // elapsed minutes: never wraps at the year end
 if(S.mission&&S.missionEnd!==null&&((S.t-S.missionEnd+YEARMIN)%YEARMIN)<1)endMission();
}
function monthOf(d){let m=0;while(m<11&&d>=MSTART[m+1])m++;return m;}

// ---------- Design check ----------
function nextFuse(a){for(const f of STD_FUSES)if(f>=a)return f;return Math.ceil(a/50)*50;}
function gIdx(g){return GAUGES.indexOf(g);}
// Static wiring and protection figures for the current build (used by checks and the Wiring panel).
function wiringReport(){
 const c=S.cfg,M=mppt(),I=inv(),ns=nSer(),bp=c.bpar,perCtl=Math.ceil(c.par/c.nMppt);
 const r={};
 // PV home run, per controller: NEC 690.8(A)(1) max current = 1.25 x Isc of the parallel strings; 690.8(B) conductor >= 1.25 x that
 const iscCtl=perCtl*PANEL.isc;
 r.pvImax=1.25*iscCtl; r.pvNeed=1.25*r.pvImax; r.pvAmp=PHYS.ampacity(c.pvMat,c.pvG);
 const vmpStr=c.ser*PANEL.vmp, impCtl=perCtl*PANEL.imp;
 r.pvR75=PHYS.loopR(c.pvMat,c.pvG,c.pvFt,75); r.pvVd=impCtl*r.pvR75/vmpStr*100; r.pvLossW=impCtl*impCtl*r.pvR75;
 // string fusing: a shorted string can be back-fed by the others; needed when that exceeds the module's series fuse rating
 r.backfeed=(perCtl-1)*1.25*PANEL.isc; r.strFuseNeeded=PANEL.fuse!=null?r.backfeed>PANEL.fuse:(perCtl>=2?null:false);
 r.strFuse=PANEL.fuse!=null?Math.min(PANEL.fuse,Math.max(nextFuse(1.56*PANEL.isc),0)):null;
 // controller to battery: rated output current
 r.cbI=M.amps; r.cbFuse=nextFuse(1.25*M.amps); r.cbAmp=PHYS.ampacity(c.cbMat,c.cbG);
 r.cbR75=PHYS.loopR(c.cbMat,c.cbG,c.cbFt,75); r.cbVd=M.amps*r.cbR75/c.sysV*100;
 r.cbTooBig=M.termG!=null&&gIdx(c.cbG)>gIdx(M.termG);
 // battery to inverter: highest continuous DC current = rated output plus losses at the low-battery cutoff voltage
 const vLow=I.low*(c.sysV/I.v);
 r.biI=(I.cont+PHYS.invLoss(I,I.cont))/vLow; r.biFuse=nextFuse(1.25*r.biI); r.biAmp=PHYS.ampacity(c.biMat,c.biG);
 r.biR75=PHYS.loopR(c.biMat,c.biG,c.biFt,75); r.biVd=r.biI*r.biR75/c.sysV*100;
 r.biSurgeI=(I.peak+PHYS.invLoss(I,I.peak))/vLow;
 // prospective short-circuit current of the bank at its terminals (full charge, cable not counted: worst case)
 const vFull=ns*bv(1.0);
 r.faultV=vFull; r.faultE=ELEC.faultEstimate(vFull,ns,bp,BATT.fres,0); r.fault=r.faultE.amps;
 r.fuseCmp=ELEC.FUSES.map(f=>Object.assign({f},ELEC.fuseVsFault(f,vFull,r.faultE)));
 // NEC ampacity table math for each run (elec.js), with the corrections the user enters
 const inp=k=>({mat:c[k+'Mat'],gauge:c[k+'G'],ambC:c.ambF==null?null:(c.ambF-32)*5/9,ccc:c.ccc,ins:c.insC,term:c.termC});
 const best=k=>({mat:c[k+'Mat'],gauge:c[k+'G'],ambC:10,ccc:1,ins:90,term:90});
 const needs={pv:{imax:r.pvImax,cont125:true},cb:{imax:r.cbI,cont125:true},bi:{imax:r.biI,cont125:true}};
 r.amp={};for(const k of ['pv','cb','bi']){const a=ELEC.ampacityCheck(inp(k),needs[k]);a.best=ELEC.ampacityCheck(best(k),needs[k]);r.amp[k]=a;}
 return r;
}
function wfmt(x){return Math.round(x).toLocaleString('en-US')+' W';}
function legPeaks(){const I=inv(),r={d:[0,0],s:[0,0],unfit:[]};for(const l of S.loads){if(l.mode==='off')continue;if(!loadFits(l,I)){r.unfit.push(l);continue;}const w=loadW(l),sh=legShare(l);r.d[0]+=w*sh[0];r.d[1]+=w*sh[1];r.s[0]=Math.max(r.s[0],w*(l.surge-1)*sh[0]);r.s[1]=Math.max(r.s[1],w*(l.surge-1)*sh[1]);}return r;}
function checks(){
 const c=S.cfg,M=mppt(),I=inv(),out=[];const perCtl=Math.ceil(c.par/c.nMppt);
 {const LP=legPeaks();if(LP.unfit.length)out.push(['fail','Incompatible: '+LP.unfit.map(l=>l.name).join(', ')+(LP.unfit.length>1?' need':' needs')+' 240 V, but the '+I.name+' puts out 120 V only. The sim leaves '+(LP.unfit.length>1?'them':'it')+' unpowered. Pick a split-phase pair (two MultiPlus-II 120V units) or set '+(LP.unfit.length>1?'them':'it')+' to 120 V if the appliance really is 120 V.']);
  if(I.split){out.push(['info','Split phase: two '+I.name.replace(/^2 × /,'').replace(/, split phase.*$/,'')+' units, one per leg. Each leg is limited to one unit: '+I.cont+' W continuous, '+I.peak+' W peak. A 240 V load takes half its power from each leg. Victron\u2019s MultiPlus-II 120V datasheet allows two units of the same model in split phase; setting them up is in Victron\u2019s manual.']);
   const tag=(x)=>x>I.cont?'over':'within';out.push([(LP.d[0]>I.cont||LP.d[1]>I.cont)?'warn':'est','Leg loads if everything on Auto ran at once: L1 '+wfmt(LP.d[0])+' and L2 '+wfmt(LP.d[1])+', '+tag(Math.max(LP.d[0],LP.d[1]))+' one unit\u2019s '+wfmt(I.cont)+'. Biggest single start-up on a leg: L1 '+wfmt(LP.s[0])+', L2 '+wfmt(LP.s[1])+' on top of running loads, against its '+wfmt(I.peak)+' peak. Balance 120 V loads between L1 and L2.']);}
 }
 const coldC=(c.coldF-32)*5/9;
 const vocCold=c.ser*PANEL.voc*(1+PANEL.b/100*(coldC-25));
 const PVH=pvHourly(); let tMax=-99; for(let i=0;i<PVH.tcell.length;i++)if(PVH.poa[i]>200&&PVH.tcell[i]>tMax)tMax=PVH.tcell[i];
 const vmpHot=c.ser*PANEL.vmp*(1+(PANEL.g-PANEL.a)/100*(tMax-25));
 const isc=perCtl*PANEL.isc;
 const pvW=perCtl*c.ser*PANEL.w;
 const nominal=M.amps*c.sysV, pvLimit=M.pv[c.sysV]||0;
 const ns=nSer();
 const W=wiringReport();
 if(!M.volts.includes(c.sysV))out.push(['fail',M.name+' can\'t charge a '+c.sysV+' V battery.']);
 if(c.sysV%BATT.mod!==0||ns>BATT.maxSer)out.push(['fail',BATT.name+': '+c.sysV+' V needs '+ns+' in series; the maker allows '+BATT.maxSer+'.']);
 if(c.bpar>BATT.maxPar)out.push(['fail',BATT.name+': the maker allows up to '+BATT.maxPar+' in parallel.']);
 if(I.v!==c.sysV)out.push(['fail',I.name+' needs a '+I.v+' V battery, not '+c.sysV+' V.']);
 out.push([vocCold>M.abs?'fail':vocCold>M.abs*0.97?'warn':'spec','Cold-morning string voltage at '+c.coldF+'\u00b0F: '+vocCold.toFixed(1)+' V vs '+M.abs+' V controller limit. Uses this panel\u2019s '+PANEL.b+' %/\u00b0C voltage coefficient'+(PANEL.tcAssumed?' (assumed: not published)':'')+'.']);
 out.push([vmpHot<c.sysV*1.25+5?'warn':'est','Hottest-cell working voltage: '+vmpHot.toFixed(1)+' V at '+Math.round(tMax)+'\u00b0C cell temperature (from this year\u2019s weather and your mount). The controller needs about 5 V above battery voltage to start.']);
 out.push([isc>M.isc?'fail':'spec','Panel short-circuit current per controller: '+isc.toFixed(1)+' A vs '+M.isc+' A max.']);
 out.push([pvW>pvLimit*1.0001?'warn':'spec','Panels per controller: '+Math.round(pvW)+' W vs '+pvLimit+' W listed for '+c.sysV+' V. Extra is clipped, not harmful.']);
 out.push(['info','Controller output limit: '+M.amps+' A \u00d7 '+c.nMppt+' = about '+Math.round(nominal*c.nMppt)+' W.']);
 const bc=bankCont(c.bpar);
 const invMaxI=W.biI;
 if(BATT.cont>0)out.push([invMaxI>bc?'fail':invMaxI>bc*0.9?'warn':'spec','Inverter at full power draws about '+Math.round(invMaxI)+' A at its low-battery cutoff; bank allows '+bc+' A continuous.']);
 if(BATT.chem==='agm'){out.push(['warn','AGM: only the top 50% is used here to protect battery life.']);
  const d1=BATTMODEL.drainMult('agm',54,25),dc=BATTMODEL.drainMult('agm',5,0);
  out.push(['info','AGM capacity (Renogy spec sheet): at the 1-hour rate only 54 Ah of the 100 Ah is available, and at 32\u00b0F 85%. The sim drains charge faster to match: '+d1.m.toFixed(2)+'\u00d7 at 54 A, '+dc.m.toFixed(2)+'\u00d7 at 5 A in the cold. Combining the two effects by multiplying is an estimate.']);}
 const absA=BATTMODEL.ABS[BATT.chem==='agm'?'agm':'lfp'];
 out.push(['info',BATT.chem==='agm'?'Charging: current tapers from '+Math.round(absA.absStart*100)+'% charge (estimate) until full. Renogy publishes no absorption time.':'Charging: current tapers from '+Math.round(absA.absStart*100)+'% charge (estimate), and absorption ends after '+Math.round(absA.absMinPer100Ah*bankAh()/100)+' minutes for this bank, from Battle Born\u2019s 30 minutes per 100 Ah'+(BATT.id==='bb100'?'':' (Battle Born\u2019s figure, used here for '+BATT.short+' too: an estimate)')+'. Then the charger floats.']);
 if(sohF()<1)out.push(['info','Battery health set to '+Math.round(sohF()*100)+'%: the bank holds '+Math.round(capWh())+' Wh instead of '+Math.round(nBatt()*BATT.ah*BATT.vnom)+' Wh. This is your own estimate of wear.']);
 if(BATT.heatW>0){const H=BATTMODEL.HEAT[c.heatSpeed]||BATTMODEL.HEAT.mid;out.push(['info','Self-heating warm-up: '+H.label+', '+Math.round(BATTMODEL.heatMinutes(H.rate,-10,5))+' minutes from 14\u00b0F to the 41\u00b0F charging point (LiTime: 70 to 90 minutes). Needs at least 10 A from the charger.']);}
 if(I.tl)out.push(['info','Inverter overload rule (approximate): Victron publishes '+I.cont+' W continuous at 77\u00b0F, '+I.tl.w+' W for up to '+I.tl.min+' minutes from a cold start and '+I.peak+' W for '+I.peakS+' seconds. The sim trips above '+I.tl.w+' W at once and at '+I.tl.w+' W after '+I.tl.min+' minutes; how a real unit behaves between those points isn\u2019t published.']);
 else out.push(['info','Inverter overload rule (approximate): Victron publishes '+I.cont+' W continuous and '+I.peak+' W peak'+(I.peakS?' for '+I.peakS+' seconds':'')+'. Running over the continuous rating for 2 minutes trips it in the sim; that time is an assumption.']);
 // wiring and protection
 const ampLine=(k,label)=>{const a=W.amp[k];const g=c[k+'G']+' AWG '+(c[k+'Mat']==='cu'?'copper':'aluminum');
  if(a.status==='nv'&&a.best.status==='fail')return ['fail',label+' ('+g+'): too small for '+a.required.toFixed(1)+' A even in the most favorable case the NEC tables allow (90\u00b0C cable and terminals, cool air, no bundling). '+a.best.notes.join(' ')];
  if(a.status==='nv')return ['nv',label+' ('+g+'): ampacity not checked. Enter '+a.missing.join(', ')+' under Wiring.'];
  if(a.status==='fail')return ['fail',label+' ('+g+'): '+a.notes.join(' ')];
  return ['tbl',label+' ('+g+'): NEC table math gives '+a.base+' A at '+c.insC+'\u00b0C \u00d7 '+a.tf+' (air) \u00d7 '+a.bf+' (bundling) = '+a.corrected.toFixed(0)+' A, vs '+a.required.toFixed(1)+' A; '+c.termC+'\u00b0C terminals allow '+a.termLimit+' A vs '+a.requiredUncorr.toFixed(1)+' A (125%). Arithmetic only.'+(a.notes.length?' '+a.notes.join(' '):'')];};
 out.push(ampLine('pv','Panel cable'));
 out.push([W.pvVd>5?'fail':W.pvVd>2.5?'warn':'est','Panel cable drop at full sun: '+W.pvVd.toFixed(1)+'% over '+c.pvFt+' ft (about '+Math.round(W.pvLossW)+' W per controller). Victron\u2019s guide aims for 2.5% or less.']);
 if(W.strFuseNeeded===true)out.push(['warn','String fuses needed: with '+perCtl+' strings in parallel a shorted string can be back-fed '+W.backfeed.toFixed(1)+' A, over the panel\u2019s '+PANEL.fuse+' A series fuse rating. Fuse each string at '+PANEL.fuse+' A or less.']);
 else if(W.strFuseNeeded===null)out.push(['warn','This panel\u2019s maximum series fuse rating isn\u2019t published: check the label before paralleling '+perCtl+' strings without fuses.']);
 else if(perCtl>1)out.push(['spec','String fuses: back-feed into a shorted string is '+W.backfeed.toFixed(1)+' A with '+perCtl+' strings in parallel, under the panel\u2019s '+PANEL.fuse+' A series fuse rating.']);
 out.push(ampLine('cb','Controller-to-battery cable'));
 out.push(['info','Controller-to-battery fuse in the sim: '+W.cbFuse+' A (the next standard size at or above 125% of the controller\u2019s '+W.cbI+' A).']);
 if(W.cbTooBig)out.push(['fail','Controller-to-battery cable '+c.cbG+' AWG is thicker than '+M.name+'\u2019s terminals take ('+M.termG+' AWG max, datasheet).']);
 out.push([W.cbVd>5?'fail':W.cbVd>2.5?'warn':'est','Controller-to-battery drop at full output: '+W.cbVd.toFixed(1)+'%.']);
 out.push(ampLine('bi','Battery-to-inverter cable'));
 out.push(['info','Battery-to-inverter fuse in the sim: '+W.biFuse+' A (125% of '+Math.round(W.biI)+' A at full power on a low battery).']);
 out.push([W.biVd>5?'fail':W.biVd>2.5?'warn':'est','Battery-to-inverter drop at full power: '+W.biVd.toFixed(1)+'% over '+c.biFt+' ft. Drop here can trip the inverter\u2019s low-battery cutoff early.']);
 const fe=W.faultE;
 out.push(['nv','Bank short-circuit current: '+(fe.isFloor?'at least ':'about ')+Math.round(fe.amps).toLocaleString('en-US')+' A at '+W.faultV.toFixed(1)+' V, from '+fe.basis+' ('+BATT.fres.src+'). No battery maker here publishes a short-circuit current, so this is unverified.']);
 for(const x of W.fuseCmp)out.push([x.status,x.f.name+' ('+x.f.maker+' '+x.f.model+'): '+x.msg]);
 if(!BATT.bms)out.push(['warn',BATT.name+': nothing in the battery stops charging below '+Math.round(cToF(BATT.chgMinC))+'\u00b0F. '+(c.bloc==='shed'?'In an unheated shed this will happen.':'Keep it indoors.')]);
 return out.filter(Boolean);
}
function dayProfile(){const I=inv();const d=Math.floor(S.t/1440);const per={};S.loads.forEach(l=>per[l.id]=0);const hourW=new Array(24).fill(0);let peak=0,peakAt=0,wh=0,requestedWh=0,compatibleWh=0,incompatibleWh=0,overheadWh=0;
 for(let m=0;m<1440;m++){const tt=d*1440+m;const tF=cToF(lerpArr(WX.ta,wxT(tt)));let w=0,good=0;const leg=[0,0];for(const l of S.loads){if(loadOn(l,tt,tF)){const x=loadW(l);w+=x;per[l.id]+=x/60;if(loadFits(l,I)){good+=x;const sh=legShare(l);leg[0]+=x*sh[0];leg[1]+=x*sh[1];}else incompatibleWh+=x/60;}}hourW[Math.floor(m/60)]+=w/60;if(w>peak){peak=w;peakAt=m;}const idle=invLossT(I,good,leg);requestedWh+=w/60;compatibleWh+=good/60;overheadWh+=idle/60;wh+=(w+idle)/60;}
 return {wh,requestedWh,compatibleWh,incompatibleWh,overheadWh,per,hourW,peak,peakAt};}
function dailyLoadWh(){return dayProfile().wh;}

// ---------- Missions ----------
const BASE={lights:'auto',fridge:'auto',freezer:'auto',router:'auto',charge:'auto',pump:'auto',furnace:'off',laptop:'off',tv:'off',micro:'off',coffee:'off',heater:'off'};
const MISSIONS=[
 {id:'jan',name:'Keep the food cold: a January week',desc:'Jan 8–15. Fridge, freezer, lights, radio, charging and the water pump. Win: no blackout for 7 days.',startDay:7,days:7,modes:BASE,goal:s=>s.blackMin===0},
 {id:'dark',name:'The darkest two weeks',desc:'Nov 30–Dec 14, the least sun in the weather year. Same loads. Win: no blackout for 14 days.',startDay:333,days:14,modes:BASE,goal:s=>s.blackMin===0},
 {id:'cold',name:'Cold snap with the furnace running',desc:'Jan 18–25, the coldest week in the file. Adds the furnace blower. Win: no blackout and no faults.',startDay:17,days:7,modes:Object.assign({},BASE,{furnace:'auto'}),goal:s=>s.blackMin===0&&s.faults===0},
 {id:'worst',name:'Synthetic worst week',desc:'Dec 14–20, made up on purpose: the 7 grayest days between Nov 15 and Feb 14 in the weather file, lined up back to back. Each day is real; the run of them is not, so it is harsher than anything in this typical year. Battery starts at 80%. Same appliances as Keep the food cold. Win: no blackout.',startDay:347,days:7,startSoc:0.8,remap:true,modes:BASE,goal:(s)=>s.blackMin===0},
 {id:'summer',name:'Summer comfort',desc:'Jul 1–8. Adds laptop, TV, microwave and coffee maker. Win: no blackout and the battery ends above 80%.',startDay:181,days:7,modes:Object.assign({},BASE,{laptop:'auto',tv:'auto',micro:'auto',coffee:'auto'}),goal:(s)=>s.blackMin===0&&S.soc>0.8}
];
// Synthetic worst week: the N grayest days (lowest daily sun on the ground) from Nov 15 to Feb 14, back to back.
function grayDays(n){const days=[];for(let d=0;d<365;d++){if(!(d>=318||d<45))continue;let g=0;for(let h=0;h<24;h++)g+=GHI[d*24+h];days.push([g,d]);}days.sort((a,b)=>a[0]-b[0]);return days.slice(0,n);}
function worstWeekMap(start,n){const g=grayDays(n).map(x=>x[1]).sort((a,b)=>((a+20)%365)-((b+20)%365));const m={};for(let i=0;i<n;i++)m[(start+i)%365]=g[i];return m;}
function missionLoads(modes){return DEFAULT_LOADS.map(l=>{const c=cloneLoad(l);c.mode=modes[l.id]||'off';return c;});}
function restoreLoads(quiet){if(!S.savedLoads)return false;S.loads=S.savedLoads;S.savedLoads=null;buildAppl();renderLoads();if(!quiet)log('Your own appliance settings are back.');return true;}
// Every mission can be rebuilt from a small plain spec, so a saved simulation state can carry it.
const HIST_YEARS=(typeof HIST!=='undefined')?HIST.winters.map(w=>w.y):[];
function winterName(y){return y+'\u2013'+String(y+1).slice(2);}
function histDayToYearDay(k){return k<61?HIST_DAY0+k:k-61;}
function dayLabel(yd){let m=0;while(m<11&&yd>=MSTART[m+1])m++;return MONTHS[m]+' '+(yd-MSTART[m]+1);}
function makeMission(sp){
 if(!sp||typeof sp!=='object')return null;
 const soc=[1,0.75,0.5,0.25,0.8].includes(sp.soc)?sp.soc:1;
 if(sp.type==='builtin'){const m=MISSIONS.find(x=>x.id===sp.id);return m?Object.assign({},m,{spec:{type:'builtin',id:m.id},wx:'tmy'}):null;}
 if(sp.type==='own'){const sd=Math.round(num(sp.sd,0,364,NaN)),n=Math.round(num(sp.n,1,60,NaN));if(!isFinite(sd)||!isFinite(n))return null;const nf=!!sp.nf;
  return {id:'own',spec:{type:'own',sd,n,soc,nf},wx:'tmy',name:'Your own test, '+dayLabel(sd)+', '+n+' day'+(n>1?'s':''),startDay:sd,days:n,modes:null,startSoc:soc,goal:s=>s.blackMin===0&&(!nf||s.faults===0)};}
 if(sp.type==='hist'||sp.type==='stretch'){const y=Math.round(Number(sp.y));if(!HIST_YEARS.includes(y))return null;const own=!!sp.own;const modes=own?null:BASE;
  if(sp.type==='hist')return {id:'hist',spec:{type:'hist',y,soc,own},wx:'w'+y,observed:true,name:'Observed winter '+winterName(y),desc:'',startDay:HIST_DAY0,days:120,modes,startSoc:soc,goal:s=>s.blackMin===0};
  const k=Math.round(num(sp.k,0,119,NaN)),n=Math.round(num(sp.n,1,30,NaN));if(!isFinite(k)||!isFinite(n)||k+n>120)return null;const sd=histDayToYearDay(k);
  return {id:'stretch',spec:{type:'stretch',y,k,n,soc,own},wx:'w'+y,observed:true,name:'Worst recorded '+n+'-day stretch: '+dayLabel(sd)+', winter '+winterName(y),startDay:sd,days:n,modes,startSoc:soc,goal:s=>s.blackMin===0};}
 return null;}
function startMission(m){
 if(!m.spec)m=makeMission({type:'builtin',id:m.id})||m;
 if(!S.mission)S.wxBefore=WXID;
 if(!setWeather(m.wx||'tmy')){log('That winter\u2019s weather isn\u2019t in this page.',true);return;}
 if(m.modes){if(!S.savedLoads)S.savedLoads=S.loads.map(cloneLoad);S.loads=missionLoads(m.modes);buildAppl();}
 else if(S.savedLoads)restoreLoads(true);
 REMAP=m.remap?worstWeekMap(m.startDay,m.days):null;S.mission=m;S.t=m.startDay*1440;S.missionEnd=(S.t+m.days*1440)%YEARMIN;S.soc=m.startSoc!=null?m.startSoc:1;S.battT=S.cfg.bloc==='in'?INDOOR_C:WX.ta[Math.floor(wxT(m.startDay*1440)/60)];S.snow=0;S.genRun=false;S.genFuelLeft=S.cfg.genFuel;S.blastUntil=-1;
 S.mpptDead=false;S.invTrip=false;S.invLow=false;S.bmsTrip=false;S.overMin=0;S.ovl=0;S.coldLock=false;S.coldDis=false;S.lastI=0;S.absMin=0;S.absDay=-1;S.heatOn=false;S.hist=[];
 S.stats=newStats();S.day=newDay();
 hideBanner();log('Mission started: '+m.name+'. Battery '+Math.round(S.soc*100)+'%.'+(m.observed?' Weather: '+wxLabel()+'.':'')+(m.modes?' It uses the mission\'s appliance list; yours come back when it ends.':' Using your own appliances.'));renderLoads();renderAll();setPlaying(true);
}
function leaveMissionWeather(){if(S.wxBefore&&S.wxBefore!==WXID){setWeather(S.wxBefore);syncWxSelect();}S.wxBefore=null;}
function endMission(){
 const m=S.mission;if(!m)return;const st=S.stats;const win=m.goal(st);
 setPlaying(false);
 const msg=(win?'<b>Mission passed: '+m.name+'.</b> ':'<b>Mission failed: '+m.name+'.</b> ')+'Lowest battery '+Math.round(st.minSoc*100)+'%, '+fmtH(st.blackMin)+' of blackout, '+st.faults+' fault'+(st.faults===1?'':'s')+', '+(st.unserved/1000).toFixed(1)+' kWh of power you needed and didn\'t get.'+(m.observed?' Weather: '+wxLabel()+'.':'');
 log((win?'Passed: ':'Failed: ')+m.name,!win);S.mission=null;S.missionEnd=null;REMAP=null;
 const back=restoreLoads();showBanner(msg+(back?' Your own appliance settings are back.':''));leaveMissionWeather();renderAll();
}
function fmtH(min){if(min<60)return min+' min';const h=min/60;return (h<10?h.toFixed(1):Math.round(h))+' h';}
function showBanner(h){const b=document.getElementById('banner');b.innerHTML=h;b.classList.add('show');}
function hideBanner(){document.getElementById('banner').classList.remove('show');}

// ---------- Rendering ----------
const $=id=>document.getElementById(id);
const SVGNS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent){const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
let panelEls=[],battEls=[],applEls={};
function buildArray(){
 const g=$('array');g.innerHTML='';panelEls=[];
 const ser=S.cfg.ser,par=S.cfg.par;
 const W=440,H=180,x0=20,y0=95;
 const pw=Math.min(62,(W-(ser-1)*4)/ser), ph=Math.min(40,(H-(par-1)*6)/par);
 for(let r=0;r<par;r++){
  const yy=y0+r*(ph+6)+(H-par*(ph+6))/2;
  for(let s=0;s<ser;s++){
   const xx=x0+s*(pw+4);
   el('rect',{x:xx,y:yy,width:pw,height:ph,fill:'url(#cells)',stroke:'#0d1520','stroke-width':1},g);
   const sn=el('rect',{x:xx,y:yy,width:pw,height:0,fill:'#f4f7fa',opacity:.95},g);
   panelEls.push(sn);
   if(s<ser-1)el('line',{x1:xx+pw,y1:yy+ph/2,x2:xx+pw+4,y2:yy+ph/2,stroke:'#e0a100','stroke-width':1.5},g);
  }
  el('line',{x1:x0+ser*(pw+4)-4,y1:yy+ph/2,x2:472,y2:yy+ph/2,stroke:'var(--sm)','stroke-width':1.2},g);
 }
 el('rect',{x:472,y:y0+H/2-24,width:14,height:48,rx:3,class:'box'},g);
 el('text',{x:479,y:y0+H/2-30,'font-size':11,'text-anchor':'middle',style:'fill:#13202f'},g).textContent='combiner';
}
function buildBank(){
 const g=$('bank');g.innerHTML='';battEls=[];
 const ns=nSer(),bp=S.cfg.bpar;
 const W=280,H=170,x0=28,y0=632;
 const bw=Math.min(84,(W-(ns-1)*10)/ns), bh=Math.min(46,(H-(bp-1)*8)/bp);
 for(let r=0;r<bp;r++){const yy=y0+r*(bh+8);
  for(let s=0;s<ns;s++){const xx=x0+s*(bw+10);
   el('rect',{x:xx,y:yy,width:bw,height:bh,rx:4,class:'box'},g);
   el('rect',{x:xx+bw*0.18,y:yy-3,width:6,height:3,fill:'var(--si)'},g);el('rect',{x:xx+bw*0.72,y:yy-3,width:6,height:3,fill:'var(--si)'},g);
   const f=el('rect',{x:xx+3,y:yy+3,width:0,height:bh-6,rx:2,fill:'#2e7d32',opacity:.75},g);battEls.push({f,w:bw-6});
   if(bh>22)el('text',{x:xx+bw/2,y:yy+bh/2+4,'font-size':Math.min(12,bw/5.5),'text-anchor':'middle'},g).textContent=BATT.ah+'Ah';
   if(s<ns-1)el('line',{x1:xx+bw,y1:yy+bh/2,x2:xx+bw+10,y2:yy+bh/2,stroke:'var(--si)','stroke-width':1.5},g);
  }
  el('line',{x1:12,y1:yy+bh/2,x2:x0,y2:yy+bh/2,stroke:'var(--sm)','stroke-width':1.2},g);
 }
 el('line',{x1:12,y1:505,x2:12,y2:y0+(bp-1)*(bh+8)+bh/2,stroke:'var(--sm)','stroke-width':1.2},g);
}
function buildAppl(){
 const g=$('appl');g.innerHTML='';applEls={};
 const cols=4,x0=28,y0=942,cw=138,ch=31,rows=Math.max(3,Math.ceil(S.loads.length/cols));
 S.loads.forEach((l,i)=>{const cx=x0+(i%cols)*cw,cy=y0+Math.floor(i/cols)*ch;
  const grp=el('g',{class:'tile',role:'button',tabindex:'0','aria-label':l.name+': tap to switch off or on'},g);
  const r=el('rect',{x:cx,y:cy,width:cw-6,height:ch-5,rx:6,fill:'var(--sg)',stroke:'var(--sr)'},grp);
  const t=el('text',{x:cx+8,y:cy+18,'font-size':13},grp);t.textContent=shortName(l);
  grp.addEventListener('click',()=>toggleLoad(l.id));
  applEls[l.id]={r,t};});
 const bottom=y0+rows*ch+24;
 el('text',{x:300,y:bottom-6,'font-size':12,'text-anchor':'middle',class:'mut'},g).textContent='Tap an appliance to switch it off or back on';
 $('housePath').setAttribute('d','M20 932 L300 872 L580 932 V'+bottom+' H20 Z');
 $('stage').setAttribute('viewBox','0 0 600 '+(bottom+10));
}
function shortName(l){const s=l.short||l.name;return s.length>15?s.slice(0,14)+'…':s;}
function toggleLoad(id){const l=S.loads.find(x=>x.id===id);if(!l)return;l.mode=l.mode==='off'?'auto':'off';log(l.name+(l.mode==='off'?' switched off.':' switched back on (Auto).'));updateCard(l);afterLoadChange(true);if(S.playing)render();}
function setFlow(id,power,ref){const p=$(id);if(!p)return;if(Math.abs(power)<1){p.style.opacity=0;p._v=0;return;}p.style.opacity=0.95;p._v=Math.sign(power)*Math.min(140,18+60*Math.sqrt(Math.abs(power)/ref));}
function W(x){return Math.abs(x)>=1000?(x/1000).toFixed(2)+' kW':Math.round(x)+' W';}
function render(){
 const L=S.live,c=S.cfg,M=mppt(),I=inv();if(!L.state)return;
 $('sbDate').textContent=dateStr(S.t)+wxYear(S.t);
 const cloud=REF[Math.floor(wxT(S.t)/60)%N]>20?1-Math.min(1,(L.ghi||0)/Math.max(1,lerpArr(REF,wxT(S.t)))):0;
 const wx=L.poa<2?'Dark':cloud>0.7?'Overcast':cloud>0.35?'Partly cloudy':'Sunny';
 $('sbWeather').textContent=wx+(S.snow>0.02?', panels snowed over':'')+(S.blastUntil>S.t?', Arctic blast':'');
 $('sbTemp').textContent=Math.round(L.taF)+'°F';
 $('sbSoc').textContent=Math.round(S.soc*100)+'%';
 $('sbMission').textContent=S.mission?'Mission: '+S.mission.name+', '+missionLeft():'Free play';
 // sky
 const night=L.poa<2;const b=Math.min(1,L.poa/700);
 $('sky1').setAttribute('stop-color',night?'#0f1a2b':mix('#6f8db0','#7fb2e5',b*(1-cloud*0.7)));
 $('sky2').setAttribute('stop-color',night?'#24344c':mix('#b7c2cc','#e6eef6',b));
 const mi=S.t%1440;const fr=(mi/60-5)/15;
 $('sun').setAttribute('cx',30+fr*540);$('sun').setAttribute('cy',260-Math.sin(Math.max(0,Math.min(1,fr))*Math.PI)*205);$('sun').style.opacity=night?0:Math.max(0.25,1-cloud*0.8);
 $('stars').style.opacity=night?0.8:0;
 const cg=$('clouds');const nC=Math.round(cloud*6);if(cg._n!==nC){cg.innerHTML='';for(let i=0;i<nC;i++){const x=60+i*95,y=55+(i%2)*28;const g=el('g',{opacity:0.88},cg);el('ellipse',{cx:x,cy:y,rx:42,ry:14,fill:'#dfe4ea'},g);el('ellipse',{cx:x+22,cy:y-9,rx:24,ry:12,fill:'#e9edf1'},g);}cg._n=nC;}
 $('skyText').textContent=night?'Night':Math.round(L.poa)+' W/m² on the panels';
 $('skyText').style.fill=night?'#e6eef6':'#13202f';
 panelEls.forEach(p=>{const h=parseFloat(p.previousSibling.getAttribute('height'));p.setAttribute('height',h*S.snow);});
 $('arrayLabel').textContent=c.ser+' in series × '+c.par+' strings = '+(c.ser*c.par)+' panels, '+arrayW()+' W';$('arrayLabel2').textContent='Open-circuit '+L.voc.toFixed(0)+' V   Could make '+W(L.pvAvail);
 // mppt
 $('mpptName').textContent=(c.nMppt>1?c.nMppt+' × ':'')+M.name;
 $('mpptPV').textContent='In '+(S.mpptRun?L.vmp.toFixed(0)+' V  ':'')+W(S.mpptRun?L.mOut/M.eff:0);
 $('mpptOut').textContent='Out '+W(L.mOut)+'  '+(L.mOut/L.vb).toFixed(1)+' A';
 $('mpptState').textContent=L.state;
 const bad=S.mpptDead||/over-voltage|Wrong|blocked|too low/.test(L.state);
 $('mpptState').setAttribute('class',bad?'fault':'mut');$('mpptBox').style.stroke=S.mpptDead?'#c62828':'';
 // bus & battery
 $('busText').textContent=L.vb.toFixed(1)+' V  '+(L.Ibank>=0?'+':'')+L.Ibank.toFixed(0)+' A';
 $('fuseText').textContent='Class T fuse: '+Math.abs(L.Ibank).toFixed(0)+' A through it';
 const ns=nSer();
 $('bankTitle').textContent=ns+'S × '+c.bpar+'P '+BATT.short+', '+(capWh()/1000).toFixed(2)+' kWh';
 $('bankText').textContent=L.vb.toFixed(1)+' V  '+(L.Ibank>=0?'+':'')+L.Ibank.toFixed(0)+' A  '+W(Math.abs(L.Ibank*L.vb))+(L.Ibank>0.5?' in':L.Ibank<-0.5?' out':'');
 $('bankState').textContent=S.bmsTrip?'BMS tripped: battery disconnected':L.coldBlock?'Too cold to charge ('+Math.round(cToF(S.battT))+'°F)':S.soc<=0.001?'Empty':L.Ibank>0.5?'Charging':L.Ibank<-0.5?'Discharging':'Idle';
 $('bankState').setAttribute('class',(S.bmsTrip||L.coldBlock||S.soc<=0.001)?'fault':'mut');
 const col=S.soc<0.2?'#c62828':S.soc<0.5?'#b26a00':'#2e7d32';
 battEls.forEach(e=>{e.f.setAttribute('width',Math.max(0,e.w*S.soc));e.f.setAttribute('fill',col);});
 $('socBar').setAttribute('width',Math.max(0,416*S.soc));$('socBar').setAttribute('fill',col);
 const hrsLeft=(L.Ibank<-0.5)?(S.soc*capWh()/Math.abs(L.Ibank*L.vb)):null;
 $('socText').textContent=Math.round(S.soc*100)+'% charged, '+(S.soc*capWh()/1000).toFixed(2)+' kWh left'+(hrsLeft!==null?', about '+(hrsLeft<48?hrsLeft.toFixed(1)+' h':Math.round(hrsLeft/24)+' days')+' at this draw':'');
 // inverter
 $('invName').textContent=I.name;$('invRating').textContent=I.cont+' W continuous, '+I.peak+' W peak';
 $('invAC').textContent='AC out '+W(L.served)+(L.served<L.demand-0.5?' / '+W(L.demand):'');
 $('invDC').textContent='DC in '+W(L.invDC)+'  '+(L.invDC/L.vb).toFixed(0)+' A';
 const ist=!S.invOn?'Switched off':S.bmsTrip?'No DC: battery disconnected':S.invTrip?'Overload trip: reset it':S.invLow?'Low-battery shutdown':L.demand>I.cont?'Overloaded!':'Running, '+Math.round(L.demand/I.cont*100)+'% load';
 $('invState').textContent=ist;$('invState').setAttribute('class',(S.invTrip||S.invLow||S.bmsTrip||L.demand>I.cont)?'fault':'mut');$('invBox').style.stroke=(S.invTrip||S.invLow)?'#c62828':'';
 $('discTxt').textContent=S.pvOpen?'OPEN':'ON';$('discTxt').style.fill=S.pvOpen?'#c62828':'';$('discRect').setAttribute('stroke',S.pvOpen?'#c62828':'');
 $('houseW').textContent=L.invRun?W(L.served)+' in use':(L.demand>0?'DARK, '+W(L.demand)+' not served':'Off');
 for(const l of S.loads){const e=applEls[l.id];if(!e)continue;const o=L.on[l.id];const lit=o&&L.invRun;e.r.setAttribute('fill',lit?'#f6c443':o?'#c62828':'var(--sg)');e.r.setAttribute('opacity',lit||o?0.9:1);e.r.setAttribute('stroke',l.mode==='on'?'var(--si)':'var(--sr)');e.r.setAttribute('stroke-dasharray',l.mode==='off'?'4 3':'none');e.t.style.fill=lit?'#13202f':o?'#fff':l.mode==='off'?'var(--sm)':'var(--si)';e.t.style.opacity=l.mode==='off'?0.55:1;}
 $('todayText').textContent='Today solar in: '+(S.day.pv/1000).toFixed(2)+' kWh';$('todayText2').textContent='Today house used: '+(S.day.load/1000).toFixed(2)+' kWh';
 $('todayText3').textContent='Solar going unused now: '+W(Math.max(0,L.harvestable-L.mOut));
 $('bigMsg').textContent=S.mpptDead?'Controller burned out!':(L.unserved>0.01?'Unmet demand: '+W(L.unserved)+' (including incompatible loads)':'');
 $('bigMsg').setAttribute('class',(S.mpptDead||L.unserved>0.01)?'fault':'');
 setFlow('fPV',L.mOut>0?L.pvAvail:0,1500);setFlow('fMB',L.mOut,1500);setFlow('fBat',L.Ibank*L.vb,1500);setFlow('fInv',L.invDC,1500);setFlow('fAC',L.served,1500);
 $('fBat').setAttribute('stroke',L.Ibank>=0?'#2e7d32':'#b26a00');
 renderFaults();
}
function missionLeft(){const left=((S.missionEnd-S.t)+YEARMIN)%YEARMIN;const d=Math.floor(left/1440),h=Math.floor((left%1440)/60);return d+'d '+h+'h left';}
function mix(a,b,f){const pa=[1,3,5].map(i=>parseInt(a.substr(i,2),16)),pb=[1,3,5].map(i=>parseInt(b.substr(i,2),16));return '#'+pa.map((v,i)=>Math.round(v+(pb[i]-v)*f).toString(16).padStart(2,'0')).join('');}
function renderFaults(){
 const f=$('faults');const want=[];
 if(S.invTrip)want.push(['rInv','Reset inverter']);
 if(S.bmsTrip)want.push(['rBms','Reset battery BMS']);
 if(S.mpptDead)want.push(['rMppt','Replace controller']);
 want.push(['tPv',S.pvOpen?'Close PV disconnect':'Open PV disconnect']);
 want.push(['tInv',S.invOn?'Switch inverter off':'Switch inverter on']);
 const key=want.map(w=>w[1]).join('|');if(f._k===key)return;f._k=key;f.innerHTML='';
 for(const [id,label] of want){const b=document.createElement('button');b.id=id;b.textContent=label;if(id[0]==='r')b.className='warnbtn';f.appendChild(b);}
}
const CHECK_TAGS={spec:'Within spec',est:'Estimate',tbl:'Table math',nv:'Not verified',warn:'Warning',fail:'Problem',info:'Info'};
function renderChecks(){const ul=$('checks');ul.innerHTML='';for(const [k,m] of checks()){const li=document.createElement('li');li.innerHTML='<span class="tag '+k+'">'+CHECK_TAGS[k]+'</span><span></span>';li.lastChild.textContent=m;ul.appendChild(li);}}
function renderScore(){
 const st=S.stats;const el_=$('score');const days=(st.mins!=null?st.mins:(((S.t-st.startT)+YEARMIN)%YEARMIN))/1440;
 const items=[[days.toFixed(1),'days simulated'],[(st.pvIn/1000).toFixed(1)+' kWh','solar used'],[(st.pvWaste/1000).toFixed(1)+' kWh','solar wasted (full, clipped, off)'],[(st.served/1000).toFixed(1)+' kWh','power delivered'],[(st.requested/1000).toFixed(1)+' kWh','requested appliance energy'],[(st.unserved/1000).toFixed(1)+' kWh','power you needed, not delivered'],[(st.unfitWh/1000).toFixed(1)+' kWh','of which incompatible with inverter'],[fmtH(st.unfitMin),'minutes with an incompatible load'],[fmtH(st.blackMin),'blackout time'],[Math.round(st.minSoc*100)+'%','lowest battery'],[st.faults,'faults (trips, burnouts)']];
 el_.innerHTML=items.map(i=>'<div><b>'+i[0]+'</b><span>'+i[1]+'</span></div>').join('');
}
function renderLog(){const ul=$('log');if(!ul)return;ul.innerHTML='';for(const e of S.log.slice(0,60)){const li=document.createElement('li');if(e.bad)li.className='bad';li.innerHTML='<span></span>';li.firstChild.textContent=dateStr(e.t);li.appendChild(document.createTextNode(e.msg));ul.appendChild(li);}}
function renderChart(){
 const cv=$('chart');const dpr=window.devicePixelRatio||1;const w=cv.clientWidth||900,h=170;if(cv.width!==Math.round(w*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
 const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
 const H=S.hist;if(H.length<2)return;const ink=getComputedStyle(cv).color||'#111';
 let mx=200;for(const r of H)mx=Math.max(mx,r[1],r[2]);
 const px=i=>8+(w-16)*i/287, py=v=>h-14-(h-30)*v/mx, ps=s=>h-14-(h-30)*s;
 x.font='11px sans-serif';x.fillStyle=ink;x.globalAlpha=0.6;x.fillText('peak '+W(mx),10,12);x.fillText('last 48 h',w-60,12);x.globalAlpha=1;
 x.beginPath();x.moveTo(px(0),py(0));H.forEach((r,i)=>x.lineTo(px(i),py(r[1])));x.lineTo(px(H.length-1),py(0));x.closePath();x.fillStyle='rgba(224,161,0,.35)';x.fill();
 x.beginPath();H.forEach((r,i)=>i?x.lineTo(px(i),py(r[2])):x.moveTo(px(i),py(r[2])));x.strokeStyle='#5c6bc0';x.lineWidth=1.6;x.stroke();
 x.beginPath();H.forEach((r,i)=>i?x.lineTo(px(i),ps(r[3])):x.moveTo(px(i),ps(r[3])));x.strokeStyle=ink;x.setLineDash([5,3]);x.lineWidth=1.6;x.stroke();x.setLineDash([]);
}
function renderLoads(){
 const box=$('loadRows');box.innerHTML='';
 S.loads.forEach(l=>box.appendChild(loadCard(l)));
 afterLoadChange(true);
}
function findLoad(id){return S.loads.find(x=>x.id===id);}
function loadCard(l){
 const d=document.createElement('div');d.className='load';d.dataset.id=l.id;
 d.innerHTML='<div class="lh"><div class="ln"><b></b><small class="lf"></small><small class="lk"></small></div><span class="seg">'+['auto','on','off'].map(m=>'<button type="button" data-m="'+m+'">'+({auto:'Auto',on:'On',off:'Off'})[m]+'</button>').join('')+'</span></div><button type="button" class="ledit" aria-expanded="false">Change watts and times</button><div class="le" hidden></div>';
 d.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{const x=findLoad(l.id);if(!x)return;x.mode=b.dataset.m;updateCard(x);afterLoadChange(true);if(S.playing)render();}));
 const eb=d.querySelector('.ledit'),le=d.querySelector('.le');
 eb.addEventListener('click',()=>{const open=le.hidden;le.hidden=!open;eb.setAttribute('aria-expanded',String(open));eb.textContent=open?'Done changing':'Change watts and times';if(open)editPanel(findLoad(l.id),le);});
 updateCard(l,d);
 return d;
}
function updateCard(l,d){
 d=d||document.querySelector('#loadRows .load[data-id="'+l.id+'"]');if(!d)return;
 d.classList.toggle('isoff',l.mode==='off');
 d.querySelector('.ln b').textContent=l.name;
 const I_=inv();d.querySelector('.lf').textContent=(l.qty>1?l.qty+' × '+l.w+' W = '+loadW(l)+' W':l.w+' W')+(l.surge>1?', '+l.surge+'× start-up surge':'')+', '+(l.volt===240?'240 V':'120 V'+(I_&&I_.split?' leg L'+(l.leg===2?2:1):''))+'. '+(loadFits(l,I_)?'':'Can\u2019t run: this inverter is 120 V only. ')+winText(l);
 d.querySelectorAll('.seg button').forEach(x=>x.classList.toggle('on',x.dataset.m===l.mode));
}
const t2s=m=>{m=dayMin(m);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
const s2t=v=>{const p=String(v||'').split(':');if(p.length<2)return null;const h=Number(p[0]),m=Number(p[1]);if(!isFinite(h)||!isFinite(m))return null;return Math.max(0,Math.min(1439,h*60+m));};
function editPanel(l,box){
 if(!l)return;
 const pat=l.chg?'chg':l.thermo?'thermo':l.cyc?'cyc':'steady';
 box.innerHTML='<div class="lg"><label>Name<input type="text" data-k="name" maxlength="40"></label><label>Watts each<input type="number" inputmode="numeric" data-k="w" min="0" max="5000" step="5"></label><label>How many<input type="number" inputmode="numeric" data-k="qty" min="1" max="20"></label><label>Start-up surge<select data-k="surge">'+[...new Set([1,2,3,4,5,6,l.surge])].sort((a,b)=>a-b).map(n=>'<option value="'+n+'">'+(n===1?'None':n+'× running watts')+'</option>').join('')+'</select></label><label>Voltage<select data-k="vleg"><option value="120-1">120 V, leg L1</option><option value="120-2">120 V, leg L2</option><option value="240">240 V (both legs)</option></select></label></div>'+
  '<p class="lt">When it runs on Auto</p><div class="wins"></div><div class="lbtns"><button type="button" data-a="addwin">Add another time</button><button type="button" data-a="allday">All day</button></div>'+
  '<p class="lt">While it runs</p><select data-k="pat" aria-label="While it runs"><option value="steady">Draws its watts the whole time</option><option value="cyc">Cycles on and off, like a compressor</option><option value="thermo">Thermostat: runs more the colder it is</option><option value="chg">Charges a battery, then stops</option></select><div class="patx"></div>'+
  '<p class="lsrc"></p>'+
  '<div class="lbtns"><button type="button" class="warnbtn" data-a="remove">Remove this appliance</button></div>';
 const q=s=>box.querySelector(s);
 const drawSrc=()=>{const e=q('.lsrc');e.textContent='Where these numbers come from: '+(l.basis||'you set them.')+' ';if(l.src){const a=document.createElement('a');a.href=l.src;a.target='_blank';a.rel='noopener';a.textContent='Source';e.appendChild(a);}};drawSrc();
 q('[data-k=name]').value=l.name;q('[data-k=w]').value=l.w;q('[data-k=qty]').value=l.qty;q('[data-k=surge]').value=String(l.surge);q('[data-k=vleg]').value=l.volt===240?'240':'120-'+(l.leg===2?2:1);q('[data-k=vleg]').addEventListener('change',e=>{const v=e.target.value;l.volt=v==='240'?240:120;l.leg=v==='120-2'?2:1;changed(false);renderCost();});q('[data-k=pat]').value=pat;
 const changed=(rebuildTiles)=>{updateCard(l);if(rebuildTiles)buildAppl();afterLoadChange(true);};
 q('[data-k=name]').addEventListener('change',e=>{const v=e.target.value.trim()||'Appliance';l.name=v;l.short=v;changed(true);});
 q('[data-k=w]').addEventListener('change',e=>{const v=Math.max(0,Math.min(5000,Math.round(Number(e.target.value)||0)));e.target.value=v;l.w=v;changed();});
 q('[data-k=qty]').addEventListener('change',e=>{const v=clampInt(e.target.value,1,20);e.target.value=v;l.qty=v;changed();});
 q('[data-k=surge]').addEventListener('change',e=>{l.surge=Number(e.target.value)||1;changed();});
 const drawWins=()=>{const w=q('.wins');w.innerHTML='';
  box.querySelectorAll('[data-a=addwin],[data-a=allday]').forEach(b=>b.hidden=!!l.chg);
  if(l.chg){const r=document.createElement('div');r.className='win';r.innerHTML='<span>Starts charging at</span><input type="time" step="300" aria-label="Charging start time">';const a=r.querySelector('input');a.value=t2s(l.wins[0][0]);
   a.addEventListener('change',()=>{const v=s2t(a.value);if(v===null)return;l.wins=[[v,v]];changed();drawPat();});w.appendChild(r);
   const n=document.createElement('p');n.className='note';n.textContent=l.mode==='off'?'Set to Off. Tap Auto to charge at this time.':'It draws its watts from this time until the battery is full, then stops'+(l.mode==='on'?' (On works the same as Auto for a charger)':'')+'.';w.appendChild(n);return;}
  l.wins.forEach((win,i)=>{const r=document.createElement('div');r.className='win';
   if(win[0]===win[1]){r.innerHTML='<span>All day, around the clock</span>';}
   else{r.innerHTML='<span>From</span><input type="time" step="300" aria-label="Start time"><span>to</span><input type="time" step="300" aria-label="End time">';
    const [a,b]=r.querySelectorAll('input');a.value=t2s(win[0]);b.value=t2s(win[1]);
    const upd=()=>{const s=s2t(a.value),e=s2t(b.value);if(s===null||e===null)return;if(s===e){b.value=t2s(e+5);win[1]=dayMin(e+5);}else win[1]=e;win[0]=s;changed();};
    a.addEventListener('change',upd);b.addEventListener('change',upd);}
   const x=document.createElement('button');x.type='button';x.className='wx';x.textContent='Remove';x.setAttribute('aria-label','Remove this time');x.disabled=l.wins.length<2;
   x.addEventListener('click',()=>{if(l.wins.length<2)return;l.wins.splice(i,1);drawWins();changed();});r.appendChild(x);w.appendChild(r);});
  if(l.mode!=='auto'){const n=document.createElement('p');n.className='note';n.textContent=l.mode==='on'?'Set to On, so it runs nonstop and ignores these times. Tap Auto to use them.':'Set to Off. Tap Auto to run it at these times.';w.appendChild(n);}
 };
 drawWins();
 q('[data-a=addwin]').addEventListener('click',()=>{const all=l.wins.findIndex(w=>w[0]===w[1]);if(all>=0)l.wins.splice(all,1);l.wins.push([hm(18),hm(20)]);drawWins();changed();});
 q('[data-a=allday]').addEventListener('click',()=>{l.wins=[[0,0]];drawWins();changed();});
 const drawPat=()=>{const p=q('.patx');p.innerHTML='';
  if(l.chg){p.innerHTML='<div class="lg"><label>Battery size, Wh<input type="number" inputmode="decimal" data-c="wh" min="1" max="5000" step="0.1"></label><label>Full charges a day<input type="number" inputmode="decimal" data-c="per" min="0.1" max="5" step="0.1"></label><label>Charger efficiency, %<input type="number" inputmode="numeric" data-c="eff" min="50" max="100" step="1"></label></div><p class="note chgx"></p>';
   const wh=p.querySelector('[data-c=wh]'),per=p.querySelector('[data-c=per]'),ef=p.querySelector('[data-c=eff]');wh.value=l.chg.wh;per.value=l.chg.per;ef.value=Math.round(l.chg.eff*100);
   const sum=()=>{const m=chgMin(l);p.querySelector('.chgx').textContent='Each one pulls about '+Math.round(chgWh(l))+' Wh a day from the outlet ('+l.chg.wh+' Wh × '+l.chg.per+' ÷ '+Math.round(l.chg.eff*100)+'%), about '+fmtH(m)+' at '+l.w+' W. Battery Wh = mAh × volts ÷ 1000. The inverter\'s own loss is added on top, once, by the sim.';};sum();
   const u=()=>{const a=Math.max(1,Math.min(5000,Number(wh.value)||1)),b=Math.max(0.1,Math.min(5,Number(per.value)||1)),e=Math.max(50,Math.min(100,Math.round(Number(ef.value)||85)));wh.value=a;per.value=b;ef.value=e;l.chg={wh:a,per:b,eff:e/100};sum();changed();};
   [wh,per,ef].forEach(x=>x.addEventListener('change',u));return;}
  if(l.cyc){p.innerHTML='<div class="win"><span>On</span><input type="number" inputmode="numeric" data-c="on" min="1" max="240" aria-label="Minutes on"><span>min out of every</span><input type="number" inputmode="numeric" data-c="every" min="2" max="240" aria-label="Cycle minutes"><span>min</span></div>';
   const on=p.querySelector('[data-c=on]'),ev=p.querySelector('[data-c=every]');on.value=l.cyc.on;ev.value=l.cyc.every;
   const u=()=>{const e=clampInt(ev.value,2,240),o=clampInt(on.value,1,e);ev.value=e;on.value=o;l.cyc={on:o,every:e};changed();};on.addEventListener('change',u);ev.addEventListener('change',u);}
  else if(l.thermo){p.innerHTML='<div class="win"><span>Starts below</span><input type="number" inputmode="numeric" data-c="set" min="-20" max="80" aria-label="Outdoor temperature"><span>°F outside, up to 60% of the time in deep cold</span></div>';
   const st=p.querySelector('[data-c=set]');st.value=l.thermo.set;st.addEventListener('change',()=>{const v=clampInt(st.value,-20,80);st.value=v;l.thermo={set:v,every:l.thermo.every||30};changed();});}
 };
 drawPat();
 q('[data-k=pat]').addEventListener('change',e=>{const v=e.target.value;const st=l.wins[0][0]||hm(19);
  if(v==='chg'){if(!l.chg)l.chg={wh:50,per:1,eff:0.85};l.wins=[[st,st]];}else if(l.chg){l.chg=null;l.wins=[[st,dayMin(st+120)]];}
  l.cyc=v==='cyc'?(l.cyc||{on:20,every:60}):null;l.thermo=v==='thermo'?(l.thermo||{set:60,every:30}):null;drawWins();if(v!=='steady'&&!l.off)l.off=(S.loads.indexOf(l)*7)%30;drawPat();changed();});
 q('[data-a=remove]').addEventListener('click',()=>{const i=S.loads.indexOf(l);if(i<0)return;S.loads.splice(i,1);log(l.name+' removed.');buildAppl();renderLoads();});
}
function presetTag(p){if(p.chg)return Math.round(p.chg.wh*p.chg.per/p.chg.eff)+' Wh per charge at '+p.w+' W';if(p.cyc){return 'about '+(p.w*24*p.cyc.on/p.cyc.every/1000).toFixed(2)+' kWh a day';}return p.w+' W';}
function addLoad(pi){const p=PRESETS[pi];if(!p)return;if(S.loads.length>=24){log('That\'s the limit of 24 appliances.',true);return;}
 const l=mkLoad(cloneLoad(p));l.id='c'+(++loadSeq);if(p.g==='Your own'){l.name=p.name.replace('Custom ','Your ')+' '+loadSeq;l.short=l.name;}delete l.g;
 S.loads.push(l);log(l.name+' added at '+l.w+' W.');buildAppl();
 const box=$('loadRows');const card=loadCard(l);box.appendChild(card);afterLoadChange(true);
 const eb=card.querySelector('.ledit');eb.click();card.scrollIntoView({block:'nearest'});}
function afterLoadChange(quiet){
 const P=dayProfile();const I=inv();const n=S.loads.filter(l=>l.mode!=='off').length;
 const top=S.loads.filter(l=>P.per[l.id]>0).sort((a,b)=>P.per[b.id]-P.per[a.id]).slice(0,3).map(l=>l.name+' '+(P.per[l.id]/1000).toFixed(2));
 $('loadSum').innerHTML='<b></b><span></span>';
 $('loadSum').firstChild.textContent=n+' of '+S.loads.length+' appliances switched on. About '+(P.wh/1000).toFixed(2)+' kWh/day requested including estimated inverter overhead.';
 $('loadSum').lastChild.textContent='Busiest moment '+Math.round(P.peak)+' W at '+fmtClock(P.peakAt)+(P.peak>I.cont?', over the inverter\'s '+I.cont+' W: it will trip':', inverter limit '+I.cont+' W')+'. '+(top.length?'Biggest users, kWh a day: '+top.join(', ')+'.':'');
 S.loads.forEach(l=>{const d=document.querySelector('#loadRows .load[data-id="'+l.id+'"] .lk');if(d)d.textContent=l.mode==='off'?'':(P.per[l.id]/1000).toFixed(2)+' kWh today';});
 $('loadEst').textContent='Today: '+(P.requestedWh/1000).toFixed(2)+' kWh appliance demand; '+(P.compatibleWh/1000).toFixed(2)+' kWh electrically compatible; '+(P.incompatibleWh/1000).toFixed(2)+' kWh incompatible/unserved before any battery shortage; '+(P.overheadWh/1000).toFixed(2)+' kWh estimated inverter overhead. Incompatible demand is NOT delivered.';
 const q=$('qLoads');if(q)q.textContent='What\'s powered: '+n+' of '+S.loads.length;
 drawDay(P);renderChecks();if(!S.playing)refreshLive();}
function drawDay(P){
 const cv=$('dayChart');if(!cv)return;const dpr=window.devicePixelRatio||1;const w=cv.clientWidth||600,h=150;if(cv.width!==Math.round(w*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
 const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
 const d=Math.floor(S.t/1440),kW=arrayW()/1000,c=S.cfg,M=mppt();const pv=[];
 const PVH=pvHourly(),nP=c.ser*c.par;for(let hh=0;hh<24;hh++){let s=0;for(let m=0;m<60;m+=5){const tw=wxT(d*1440+hh*60+m);const g=Math.max(0,lerpArr(PVH.eff,tw)),tc=lerpArr(PVH.tcell,tw);s+=Math.max(0,PANEL.w*g/1000*(1+PANEL.g/100*(tc-25))*(1-OTHER_LOSS))*nP*(1-c.shade/100)*M.eff;}pv.push(s/12);}
 let mx=100;for(let i=0;i<24;i++)mx=Math.max(mx,P.hourW[i],pv[i]);
 const ink=getComputedStyle(cv).color||'#111';const L=8,B=h-18,T=16,bw=(w-L-8)/24;
 x.font='11px sans-serif';x.fillStyle=ink;x.globalAlpha=0.65;x.fillText('peak '+W(mx),L,11);x.textAlign='right';x.fillText(dateStr(d*1440).replace(/,.*/,''),w-8,11);x.textAlign='left';
 [0,6,12,18].forEach(hh=>{x.fillText(['12a','6a','12p','6p'][hh/6],L+hh*bw,h-4);});x.globalAlpha=1;
 x.fillStyle='rgba(224,161,0,.35)';x.beginPath();x.moveTo(L,B);pv.forEach((v,i)=>x.lineTo(L+(i+0.5)*bw,B-(B-T)*v/mx));x.lineTo(L+24*bw,B);x.closePath();x.fill();
 x.fillStyle='#5c6bc0';P.hourW.forEach((v,i)=>{const bh=(B-T)*v/mx;x.fillRect(L+i*bw+1,B-bh,Math.max(1,bw-2),bh);});
 const nowH=Math.floor((S.t%1440)/60);x.strokeStyle=ink;x.globalAlpha=0.5;x.beginPath();x.moveTo(L+(nowH+0.5)*bw,T);x.lineTo(L+(nowH+0.5)*bw,B);x.stroke();x.globalAlpha=1;
}
function grp(box,title,note){const g=document.createElement('div');g.className='mgroup';g.innerHTML='<b></b><small></small>';g.querySelector('b').textContent=title;g.querySelector('small').textContent=note;box.appendChild(g);}
function wxOptions(){return '<option value="tmy">Typical year (NREL TMY via PVWatts)</option>'+HIST_YEARS.map(y=>'<option value="w'+y+'">Observed winter '+winterName(y)+' (NASA POWER)</option>').join('');}
function syncWxSelect(){const e=$('wxSel');if(e)e.value=WXID;}
const SOC_OPTS='<option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.25">25%</option>';
const LOAD_OPTS='<option value="0">Keep-the-food-cold list</option><option value="1">My own appliances</option>';
function renderMissions(){const box=$('missionList');box.innerHTML='';
 const fp=document.createElement('div');fp.className='mission';fp.innerHTML='<b>Free play</b><small>Any day, any appliances, no clock on you. Your build carries into every mission.</small><div class="ownrow"><label>Weather<select id="wxSel" aria-label="Weather for free play">'+wxOptions()+'</select></label></div><small id="wxNote"></small><button>Free play from here</button>';
 fp.querySelector('button').onclick=()=>{const was=!!S.mission;S.mission=null;S.missionEnd=null;REMAP=null;hideBanner();restoreLoads();if(was)leaveMissionWeather();S.stats=newStats();log('Free play.');renderAll();};box.appendChild(fp);
 fp.querySelector('#wxSel').onchange=e=>{if(S.mission){syncWxSelect();log('Finish or leave the mission before changing the weather.',true);return;}const id=e.target.value;if(setWeather(id)){log('Weather now: '+wxLabel()+'.'+(id!=='tmy'?' Only Nov 1 to Feb 28 is observed; the rest of the year stays typical.':''));}refreshLive();wxNoteText();};
 grp(box,'Typical-year missions','Weather from the typical-year file for Honesdale. The typical year is built from many years and is milder than a bad real winter.');
 const own=document.createElement('div');own.className='mission';
 own.innerHTML='<b>Your own test</b><small>Your appliances and times, your build, any stretch of the typical year. Win: no blackout.</small><div class="ownrow"><label>Start<select id="oM" aria-label="Start month"></select></label><label>Day<input type="number" id="oD" min="1" max="31" value="1"></label><label>Days<input type="number" id="oN" min="1" max="60" value="7"></label><label>Battery at<select id="oS">'+SOC_OPTS+'</select></label></div><label class="ownck"><input type="checkbox" id="oF"> Also no trips or burnouts</label><button>Start your test</button>';
 own.querySelector('#oM').innerHTML=MONTHS.map((m,i)=>'<option value="'+i+'">'+m+'</option>').join('');own.querySelector('#oM').value=0;
 own.querySelector('button:last-child').onclick=()=>{const mo=Number($('oM').value);const dd=clampInt($('oD').value,1,MDAYS[mo]);$('oD').value=dd;const n=clampInt($('oN').value,1,60);$('oN').value=n;
  startMission(makeMission({type:'own',sd:MSTART[mo]+dd-1,n,soc:Number($('oS').value),nf:$('oF').checked}));};
 box.appendChild(own);
 for(const m of MISSIONS){const d=document.createElement('div');d.className='mission'+(m.remap?' synth':'');d.innerHTML='<b></b><small></small><button>Start mission</button>';d.querySelector('b').textContent=(m.remap?'Synthetic: ':'')+m.name;d.querySelector('small').textContent=m.desc+' Uses its own appliance list; yours come back after.';d.querySelector('button').onclick=()=>startMission(m);box.appendChild(d);}
 if(HIST_YEARS.length){
  grp(box,'Observed winters, '+HIST_YEARS[0]+' to '+(HIST_YEARS[HIST_YEARS.length-1]+1),'Real recorded weather, hour by hour, Nov 1 to Feb 28, from NASA POWER: satellite and weather-model estimates on a coarse grid, not a ground station. Its wind averages about 2.7 m/s against 0.2 m/s in the typical-year file, so panels run cooler, worth about 1% more output.');
  const hw=document.createElement('div');hw.className='mission';
  hw.innerHTML='<b>Run a whole recorded winter</b><small>Nov 1 to Feb 28, 120 days. Win: no blackout.</small><div class="ownrow"><label>Winter<select id="hY" aria-label="Winter">'+HIST_YEARS.map(y=>'<option value="'+y+'">'+winterName(y)+'</option>').join('')+'</select></label><label>Battery at<select id="hS">'+SOC_OPTS+'</select></label><label>Appliances<select id="hL">'+LOAD_OPTS+'</select></label></div><button>Run this winter</button>';
  hw.querySelector('#hY').value=String(HIST_YEARS[HIST_YEARS.length-1]);
  hw.querySelector('button').onclick=()=>startMission(makeMission({type:'hist',y:Number($('hY').value),soc:Number($('hS').value),own:$('hL').value==='1'}));
  box.appendChild(hw);
  const wf=document.createElement('div');wf.className='mission';
  wf.innerHTML='<b>Find the worst recorded low-sun stretch</b><small>Searches all '+HIST_YEARS.length+' winters for the run of days with the least sun on your panels, at your tilt and direction.</small><div class="ownrow"><label>Days<input type="number" id="fN" min="1" max="30" value="7"></label><label>Battery at<select id="fS">'+SOC_OPTS+'</select></label><label>Appliances<select id="fL">'+LOAD_OPTS+'</select></label></div><button id="fGo">Find it</button><small id="fOut" aria-live="polite"></small><button id="fRun" hidden>Run this stretch</button>';
  box.appendChild(wf);
  wf.querySelector('#fGo').onclick=()=>{const n=clampInt($('fN').value,1,30);$('fN').value=n;$('fGo').disabled=true;$('fRun').hidden=true;$('fOut').textContent='Searching\u2026';
   findWorstStretch(n,(i,tot)=>{$('fOut').textContent='Searching winter '+i+' of '+tot+'\u2026';},r=>{$('fGo').disabled=false;FOUND=r;
    $('fOut').textContent='Worst recorded '+n+'-day stretch for your panels: '+dayLabel(histDayToYearDay(r.k))+' to '+dayLabel(histDayToYearDay(r.k+n-1))+', winter '+winterName(r.y)+'. Sun on the panels: '+r.kwh.toFixed(2)+' kWh per square meter over the '+n+' days, '+Math.round(r.pctTyp)+'% of the same dates in the typical year. These days happened in this order.';$('fRun').hidden=false;});};
  wf.querySelector('#fRun').onclick=()=>{if(!FOUND)return;startMission(makeMission({type:'stretch',y:FOUND.y,k:FOUND.k,n:FOUND.n,soc:Number($('fS').value),own:$('fL').value==='1'}));};
  grp(box,'Failure-rate estimate','Runs your current design through every recorded winter at full speed, from a full battery on Nov 1. It counts how many of these past winters it would have had any blackout. That is a rate over '+HIST_YEARS.length+' past winters with coarse data, not a forecast.');
  const fr=document.createElement('div');fr.className='mission';
  fr.innerHTML='<b>Failure rate across all winters</b><small>Appliance use: the keep-the-food-cold list, the same plus the furnace blower on its thermostat, and your own list as set now.</small><div class="ownrow"><label>Appliance use<select id="rP" aria-label="Appliance use"><option value="all">All three</option><option value="food">Keep-the-food-cold list</option><option value="furnace">Food list plus furnace</option><option value="mine">My own appliances</option></select></label></div><button id="rGo">Run '+HIST_YEARS.length+' winters</button><small>About 15 seconds per appliance set on a computer; longer on a phone. You can keep reading while it runs.</small><small id="rProg" aria-live="polite"></small><div id="rOut"></div>';
  box.appendChild(fr);
  fr.querySelector('#rGo').onclick=()=>{if(RATE_RUN){RATE_RUN.cancel=true;return;}const sel=$('rP').value;const pats=sel==='all'?['food','furnace','mine']:[sel];$('rOut').innerHTML='';$('rGo').textContent='Stop';
   runFailureRates(pats,(txt)=>{$('rProg').textContent=txt;},(res,why)=>{$('rGo').textContent='Run '+HIST_YEARS.length+' winters';$('rProg').textContent=why||'Done.';if(res.length)$('rOut').innerHTML=res.map(rateHtml).join('');});};
  const ag=document.createElement('div');ag.className='mission';
  ag.innerHTML='<b>Battery aging: after 1, 5 and 10 years</b><small>Estimates the capacity your batteries keep, from the maker\'s published cycle life and how hard a typical year cycles them in your design, then runs all '+HIST_YEARS.length+' recorded winters at each age. The aging itself is an estimate; the details show with the results.</small><div class="ownrow"><label>Appliance use<select id="ageP" aria-label="Appliance use for aging"><option value="food">Keep-the-food-cold list</option><option value="furnace">Food list plus furnace</option><option value="mine">My own appliances</option></select></label></div><button id="ageGo">Run aging estimate</button><small>About as long as four failure-rate runs.</small><small id="ageProg" aria-live="polite"></small><div id="ageOut"></div>';
  box.appendChild(ag);
  ag.querySelector('#ageGo').onclick=()=>{if(AGE_RUN){AGE_RUN.cancel=true;if(RATE_RUN)RATE_RUN.cancel=true;return;}if(RATE_RUN){$('ageProg').textContent='Wait for the failure-rate run to finish, or stop it.';return;}
   $('ageOut').innerHTML='';$('ageGo').textContent='Stop';
   runAging($('ageP').value,txt=>{$('ageProg').textContent=txt;},(out,why)=>{$('ageGo').textContent='Run aging estimate';$('ageProg').textContent=why||'Done.';if(out){AGE_LAST=out;$('ageOut').innerHTML=ageHtml(out);}});};
  ag.querySelector('#ageOut').onclick=e=>{const b=e.target.closest('.ageUse');if(!b)return;const v=clampInt(b.dataset.soh,50,100);S.cfg.soh=v;$('soh').value=v;$('sohV').textContent=v+'%';log('Battery health set to '+v+'% from the aging estimate.');cfgChanged(true);};
 }
 const rs=document.createElement('div');rs.className='row';rs.innerHTML='<label>Random winter snow<small>Game event: some cold nights Nov–Mar bury the panels</small></label><input type="checkbox" id="rsnow">';box.appendChild(rs);$('rsnow').checked=S.randomSnow;$('rsnow').onchange=e=>{S.randomSnow=e.target.checked;};
 syncWxSelect();wxNoteText();
}
function wxNoteText(){const e=$('wxNote');if(e)e.textContent=WXID==='tmy'?'Typical year: the national typical-weather file for Honesdale.':'Observed '+winterName(+WXID.slice(1))+' from NASA POWER, Nov 1 to Feb 28 only; other months use the typical year.';}
let FOUND=null,AGE_LAST=null;
// ---------- Worst recorded stretch ----------
// Ranks runs of days by plane-of-array sun (your tilt, direction and mount) from the observed NASA POWER winters.
function mountUsed(){const c=S.cfg;return (c.mount&&c.mount!=='auto')?c.mount:PANEL.mount;}
function poaDaily(wx){const c=S.cfg;const mount=mountUsed();const h=PHYS.hourly(wx,{tilt:+c.tilt,az:+c.az,mount,bif:0,rearLoss:0,hor:c.hor});const out=new Float64Array(120);for(let k=0;k<120;k++){const yd=histDayToYearDay(k);let sum=0;for(let i=0;i<24;i++)sum+=h.poa[yd*24+i];out[k]=sum/1000;}return out;}
function findWorstStretch(n,prog,done){const typ=poaDaily(WX_TMY);let best=null,i=0;
 const next=()=>{if(i>=HIST_YEARS.length){done(best);return;}const y=HIST_YEARS[i++];const d=poaDaily(buildHistWX(y));
  for(let k=0;k+n<=120;k++){let a=0,t=0;for(let j=0;j<n;j++){a+=d[k+j];t+=typ[k+j];}if(!best||a<best.kwh)best={y,k,n,kwh:a,pctTyp:t>0?a/t*100:0};}
  prog(i,HIST_YEARS.length);setTimeout(next,0);};next();}
// ---------- Failure-rate runs ----------
const STATE_KEYS=['t','soc','battT','snow','blastUntil','randomSnow','mpptDead','mpptRun','invOn','invTrip','invLow','bmsTrip','overMin','ovl','coldLock','coldDis','coldWarnDay','prevOn','lastI','vbat','absMin','absDay','heatOn','genRun','genFuelLeft','stats','day','hist','log','mission','missionEnd','warnedIsc','loads','savedLoads','live'];
function grabState(){const o={};for(const k of STATE_KEYS)o[k]=S[k];o.REMAP=REMAP;o.WXID=WXID;return o;}
function putState(o){for(const k of STATE_KEYS)S[k]=o[k];REMAP=o.REMAP;if(WXID!==o.WXID)setWeather(o.WXID);}
let RATE_RUN=null;
function patternLoads(p){if(p==='mine')return S.loads.map(cloneLoad);return missionLoads(p==='furnace'?Object.assign({},BASE,{furnace:'auto'}):BASE);}
const PAT_NAME={food:'Keep-the-food-cold list',furnace:'Food list plus furnace blower',mine:'Your own appliances'};
function runFailureRates(pats,prog,done,sohOv){
 const cfgKey=JSON.stringify(S.cfg),wasPlaying=S.playing;setPlaying(false);
 const jobs=[];for(const p of pats)for(const y of HIST_YEARS)jobs.push({p,y});
 const loadsFor={};for(const p of pats)loadsFor[p]=patternLoads(p);
 const res={};for(const p of pats)res[p]={p,runs:[]};
 const run=RATE_RUN={cancel:false};let j=0,cur=null,left=0;const PER=120*1440,CHUNK=60000;
 const finish=why=>{RATE_RUN=null;dropWxCache();if(wasPlaying&&!why)setPlaying(true);done(why?[]:pats.map(p=>summarizeRuns(res[p])),why);};
 const tick=()=>{
  if(run.cancel){finish('Stopped. Nothing was counted.');return;}
  if(JSON.stringify(S.cfg)!==cfgKey){finish('Your design changed during the run, so it stopped. Run it again.');return;}
  const user=grabState();
  try{
   if(!cur){const jb=jobs[j];setWeather('w'+jb.y);REMAP=null;S.mission=null;S.missionEnd=null;S.loads=loadsFor[jb.p].map(cloneLoad);S.savedLoads=null;S.prevOn={};S.log=[];S.hist=[];
    S.t=HIST_DAY0*1440;S.soc=1;S.battT=S.cfg.bloc==='in'?INDOOR_C:WX.ta[HIST_DAY0*24];S.snow=0;S.genRun=false;S.genFuelLeft=S.cfg.genFuel;S.blastUntil=-1;S.randomSnow=false;S.mpptDead=false;S.invTrip=false;S.invLow=false;S.bmsTrip=false;S.overMin=0;S.ovl=0;S.coldLock=false;S.coldDis=false;S.lastI=0;S.absMin=0;S.absDay=-1;S.heatOn=false;S.invOn=true;S.live={};
    S.stats=newStats();S.day=newDay();cur=grabState();cur.WXID=WXID;left=PER;}
   else putState(cur);
   S.quiet=true;AGE_SOH=sohOv||null;const n=Math.min(CHUNK,left);for(let i=0;i<n;i++)step();left-=n;S.quiet=false;AGE_SOH=null;
   cur=grabState();
   if(left<=0){const jb=jobs[j];const st=S.stats;res[jb.p].runs.push({y:jb.y,black:st.blackMin,faults:st.faults,minSoc:st.minSoc,unserved:st.unserved,genGal:st.genGal||0,genMin:st.genMin||0,genStarts:st.genStarts||0,snowDays:st.snowDays||0,snowMin:st.snowMin||0});j++;cur=null;}
  }finally{S.quiet=false;AGE_SOH=null;putState(user);}
  if(j>=jobs.length){finish(null);return;}
  prog('Winter '+(j%HIST_YEARS.length+1)+' of '+HIST_YEARS.length+(pats.length>1?', appliance set '+(Math.floor(j/HIST_YEARS.length)+1)+' of '+pats.length:'')+'\u2026');
  setTimeout(tick,0);};
 prog('Starting\u2026');setTimeout(tick,0);}
function wilson(k,n){const z=1.96,p=k/n,d=1+z*z/n,c=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [Math.max(0,(c-r)/d),Math.min(1,(c+r)/d)];}
function summarizeRuns(r){const runs=r.runs,n=runs.length;const fails=runs.filter(x=>x.black>0);const bh=runs.map(x=>x.black/60).sort((a,b)=>a-b);const med=n%2?bh[(n-1)/2]:(bh[n/2-1]+bh[n/2])/2;
 const worst=runs.reduce((a,b)=>b.black>a.black?b:a,runs[0]);const ci=wilson(fails.length,n);
 const medOf=a=>{a=a.slice().sort((x,y)=>x-y);return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};const gal=runs.map(x=>x.genGal||0),sd=runs.map(x=>x.snowDays||0);
 return {p:r.p,n,fails:fails.length,rate:fails.length/n,ci,medH:med,minH:bh[0],maxH:bh[n-1],worst,faultWinters:runs.filter(x=>x.faults>0).length,lowSoc:Math.min(...runs.map(x=>x.minSoc)),genOn:!!S.cfg.genOn,genGalMed:medOf(gal),genGalMin:Math.min(...gal),genGalMax:Math.max(...gal),genHMed:medOf(runs.map(x=>(x.genMin||0)/60)),snowRec:!!S.cfg.snowRec,snowDaysMed:medOf(sd),snowDaysMin:Math.min(...sd),snowDaysMax:Math.max(...sd),reserve:S.cfg.reserve||0,runs};}
function rateHtml(x){const pc=v=>Math.round(v*100)+'%';const h=v=>v<1&&v>0?'under 1 h':Math.round(v)+' h';
 return '<div class="rate"><b>'+PAT_NAME[x.p]+'</b><p>Blackout in <b>'+x.fails+' of '+x.n+'</b> recorded winters ('+pc(x.rate)+'). With only '+x.n+' winters, the true rate could reasonably be anywhere from '+pc(x.ci[0])+' to '+pc(x.ci[1])+' (95% Wilson interval).</p><p>Blackout per winter: median '+h(x.medH)+', range '+h(x.minH)+' to '+h(x.maxH)+'. Worst: '+winterName(x.worst.y)+' with '+h(x.worst.black/60)+'. Winters with a trip or fault: '+x.faultWinters+'. Lowest battery in any winter: '+Math.round(x.lowSoc*100)+'%.</p>'+(x.snowRec?'<p>Recorded snowfall covered the panels on a median '+x.snowDaysMed+' days a winter (range '+x.snowDaysMin+' to '+x.snowDaysMax+'). The cover trigger is an estimate.</p>':'<p>Recorded snow on the panels is switched off for this run.</p>')+(x.genOn?'<p>Generator: median '+x.genHMed.toFixed(0)+' hours and '+x.genGalMed.toFixed(1)+' gallons of fuel a winter, range '+x.genGalMin.toFixed(1)+' to '+x.genGalMax.toFixed(1)+' gallons. Fuel use is an estimate drawn between Honda\'s two published runtimes.</p>':'')+(x.reserve>0?'<p>Battery reserve: '+x.reserve+'% held back, so the house goes dark at '+x.reserve+'%.</p>':'')+'</div>';}
function runAging(pat,prog,done){
 const d=AGE_DATA[BATT.id];if(!d){done(null,'No published cycle life for this battery.');return;}
 const cfgKey=JSON.stringify(S.cfg),wasPlaying=S.playing;setPlaying(false);
 const run=AGE_RUN={cancel:false};const loads=patternLoads(pat);const Y=365*1440;
 let cur=null,left=Y,thru=0,prev=1,dmax=1,dmin=1,lastDay=0;const swings=[];
 const finish=(out,why)=>{AGE_RUN=null;AGE_SOH=null;dropWxCache();if(wasPlaying&&!why)setPlaying(true);done(out,why);};
 const winters=out=>{let k=0;const next=()=>{
   if(run.cancel){finish(null,'Stopped. Nothing was counted.');return;}
   if(k>=AGE_YEARS.length){finish(out,null);return;}
   const row=out.rows[k++];if(row.soh<AGE_MIN){row.past=true;next();return;}
   runFailureRates([pat],txt=>prog('Year '+row.y+' (health '+Math.round(row.soh*100)+'%): '+txt),(res,why)=>{
    if(why){finish(null,why);return;}row.sum=res[0];next();},row.soh);};next();};
 const tick=()=>{
  if(run.cancel){finish(null,'Stopped. Nothing was counted.');return;}
  if(JSON.stringify(S.cfg)!==cfgKey){finish(null,'Your design changed during the run, so it stopped. Run it again.');return;}
  const user=grabState();
  try{
   if(!cur){setWeather('tmy');REMAP=null;S.mission=null;S.missionEnd=null;S.loads=loads.map(cloneLoad);S.savedLoads=null;S.prevOn={};S.log=[];S.hist=[];
    S.t=0;S.soc=1;S.battT=S.cfg.bloc==='in'?INDOOR_C:WX.ta[0];S.snow=0;S.genRun=false;S.genFuelLeft=S.cfg.genFuel;S.blastUntil=-1;S.randomSnow=false;S.mpptDead=false;S.invTrip=false;S.invLow=false;S.bmsTrip=false;S.overMin=0;S.ovl=0;S.coldLock=false;S.coldDis=false;S.lastI=0;S.absMin=0;S.absDay=-1;S.heatOn=false;S.invOn=true;S.live={};
    S.stats=newStats();S.day=newDay();cur=grabState();cur.WXID=WXID;}
   else putState(cur);
   S.quiet=true;AGE_SOH=1;const n=Math.min(60000,left);
   for(let i=0;i<n;i++){step();const v=S.soc;if(v<prev)thru+=prev-v;prev=v;if(v>dmax)dmax=v;if(v<dmin)dmin=v;
    const dd=Math.floor(S.t/1440);if(dd!==lastDay){swings.push(dmax-dmin);dmax=dmin=v;lastDay=dd;}}
   left-=n;S.quiet=false;AGE_SOH=null;cur=grabState();
  }finally{S.quiet=false;AGE_SOH=null;putState(user);}
  if(left>0){prog('Measuring a typical year of cycling: day '+Math.floor((Y-left)/1440)+' of 365\u2026');setTimeout(tick,0);return;}
  const sw=swings.slice().sort((a,b)=>a-b),med=sw.length?sw[Math.floor(sw.length/2)]:0;
  const dod=Math.max(1,Math.min(100,med*100)),life=ageEfcLife(d,dod);
  const out={pat,batt:BATT.id,name:BATT.name,url:BATT.url,note:d.note,cal:d.cal,efcYr:thru,dod,life,days:sw.length,
   rows:AGE_YEARS.map(y=>({y,soh:ageSoh(d,thru,dod,y)}))};
  winters(out);};
 prog('Starting\u2026');setTimeout(tick,0);}
function ageHtml(o){const pc=v=>Math.round(v*100)+'%';const h=v=>v<1&&v>0?'under 1 h':Math.round(v)+' h';
 const rows=o.rows.map(r=>'<div class="rate"><b>After '+r.y+' year'+(r.y>1?'s':'')+': '+(r.past?'below '+pc(AGE_MIN):'about '+pc(r.soh))+' health</b>'+(r.past?'<p>Below '+pc(AGE_MIN)+', well past the rated life this estimate is built on, so the winters weren\'t run. Plan on replacing the battery before this.</p>':
  '<p>Blackout in <b>'+r.sum.fails+' of '+r.sum.n+'</b> recorded winters. Blackout per winter: median '+h(r.sum.medH)+', range '+h(r.sum.minH)+' to '+h(r.sum.maxH)+'.'+(r.sum.genOn?' Generator fuel: median '+r.sum.genGalMed.toFixed(1)+' gallons a winter.':'')+'</p><button class="ageUse" data-soh="'+Math.round(r.soh*100)+'">Set battery health to '+pc(r.soh)+'</button>')+'</div>').join('');
 return '<div class="rate"><b>How hard your design cycles the batteries</b><p>'+PAT_NAME[o.pat]+', typical year, new batteries: '+Math.round(o.efcYr)+' full-cycle equivalents a year, with a median daily swing of '+Math.round(o.dod)+'% of capacity.</p><p>'+o.note+' At that swing the sim allows '+Math.round(o.life).toLocaleString()+' full-cycle equivalents before the battery is down to '+pc(AGE_EOL)+' of its capacity. The 80% end point is an estimate: the maker doesn\'t say what capacity is left at the end of the rated cycles.</p><p>Calendar loss: '+(o.cal*100).toFixed(0)+'% of capacity a year on top of cycling. That is an estimate; no maker here publishes one. Heat and cold aren\'t counted in either loss.</p></div>'+rows;}
function renderAll(){render();renderScore();renderChart();}
// recompute live readings without advancing time
function refreshLive(){
 const saved={t:S.t,soc:S.soc,stats:Object.assign({},S.stats),day:Object.assign({},S.day),hist:S.hist.slice(),battT:S.battT,heatOn:S.heatOn,snow:S.snow,lastI:S.lastI,prevOn:Object.assign({},S.prevOn),overMin:S.overMin,ovl:S.ovl,coldLock:S.coldLock,coldDis:S.coldDis,coldWarnDay:S.coldWarnDay,mpptRun:S.mpptRun,absMin:S.absMin,absDay:S.absDay,logLen:S.log.length,inv:[S.invTrip,S.invLow,S.bmsTrip,S.mpptDead]};
 step();
 const tripped=[S.invTrip,S.invLow,S.bmsTrip,S.mpptDead];
 S.t=saved.t;S.soc=saved.soc;S.stats=saved.stats;S.day=saved.day;S.hist=saved.hist;S.battT=saved.battT;S.heatOn=saved.heatOn;S.snow=saved.snow;S.lastI=saved.lastI;S.overMin=saved.overMin;S.ovl=saved.ovl;S.coldLock=saved.coldLock;S.coldDis=saved.coldDis;S.coldWarnDay=saved.coldWarnDay;S.prevOn=saved.prevOn;S.mpptRun=saved.mpptRun;S.absMin=saved.absMin;S.absDay=saved.absDay;
 // keep faults the preview found (they are real consequences of the change), but not time
 renderAll();}


// ---------- Mount, wiring, save/load ----------
const WIRE=PHYS.WIRE;
function esc(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
const MOUNT_LABEL={open:'open rack, air behind',roof:'close to a roof',glued:'glued flat, no air behind',open_gg:'open rack (glass-glass panel)'};
function mountUsed(){const c=S.cfg;return (c.mount&&c.mount!=='auto')?c.mount:PANEL.mount;}
function compass(a){return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((a%360)+360)%360/22.5)%16];}
function gaugeOpts(mat){return Object.keys(WIRE[mat]).map(g=>'<option value="'+g+'">'+(g.indexOf('/')>0?g:g+' AWG')+'</option>').join('');}
function syncMountWiring(){const c=S.cfg;
 $('tilt').value=c.tilt;$('tiltV').textContent=c.tilt+'°';$('az').value=c.az;$('azV').textContent=c.az+'° '+compass(c.az);
 $('mount').value=c.mount||'auto';$('mountNote').textContent='Using '+(MOUNT_LABEL[mountUsed()]||mountUsed())+'. Hotter panels make less power; temperatures use the Sandia model with this mount.';
 const bif=!!PANEL.bifacial;$('bifRow').style.display=bif?'':'none';$('bifOn').value=c.bifOn?'1':'0';
 $('bifNote').textContent=(mountUsed()!=='open'?'Only counts on an open rack: on this mount the back can\u2019t see the sky or ground. ':'')+'Bifaciality 0.70 is assumed (Renogy publishes no figure). Sky and ground light on the back are counted with nothing under the panel blocking them, so treat it as an upper-end estimate.';
 const W=wiringReport();
 [['pv','pvWireNote'],['cb','cbWireNote'],['bi','biWireNote']].forEach(([k,nid])=>{const mat=c[k+'Mat'];
  const ms=$(k+'Mat');if(!ms.options.length)ms.innerHTML='<option value="cu">Copper</option><option value="al">Aluminum</option>';ms.value=mat;
  const gs=$(k+'G');gs.innerHTML=gaugeOpts(mat);if(!WIRE[mat][c[k+'G']])c[k+'G']=Object.keys(WIRE[mat])[0];gs.value=c[k+'G'];$(k+'Ft').value=c[k+'Ft'];
  const I={pv:W.pvImax,cb:W.cbI,bi:W.biI}[k],A={pv:W.pvAmp,cb:W.cbAmp,bi:W.biAmp}[k],V={pv:W.pvVd,cb:W.cbVd,bi:W.biVd}[k];
  $(nid).textContent='Design current '+I.toFixed(1)+' A; this wire is rated '+A+' A. Voltage drop '+V.toFixed(1)+'% at '+(k==='pv'?'the panels\u2019 working current':'full rated current')+(k==='pv'&&V>3?' (Victron advises under 3%)':'')+'.';});}
function wireChanged(k){const c=S.cfg;const mat=$(k+'Mat').value==='al'?'al':'cu';
 if(mat!==c[k+'Mat']){c[k+'Mat']=mat;if(!WIRE[mat][c[k+'G']]){const gs=Object.keys(WIRE[mat]);c[k+'G']=gs.find(g=>WIRE[mat][g][1]>=(WIRE.cu[c[k+'G']]||[0,0])[1])||gs[gs.length-1];}}
 else{const g=$(k+'G').value;if(WIRE[mat][g])c[k+'G']=g;}
 c[k+'Ft']=clampInt($(k+'Ft').value,1,k==='pv'?500:100);cfgChanged(false);}
const SAVE_KEY='solarSandboxBuild.v4';
const CFG_NUM={other:[0,10000],sysV:[12,48],ser:[1,20],par:[1,20],shade:[0,90],nMppt:[1,8],bpar:[1,16],coldF:[-40,50],tilt:[0,90],az:[90,270],pvFt:[1,500],cbFt:[1,100],biFt:[1,100],soh:[50,100],reserve:[0,80],genStart:[5,90],genStop:[10,100],genFuel:[0,500],ageYears:[0,20]};
function buildPayload(){return {app:'solar-battery-sandbox',kind:'design',version:5,saved:new Date().toISOString(),cfg:JSON.parse(JSON.stringify(S.cfg)),loads:S.loads.map(cloneLoad)};}
function num(v,a,b,d){v=Number(v);if(!isFinite(v))return d;return Math.max(a,Math.min(b,v));}
function cleanWins(w){if(!Array.isArray(w)||!w.length)return null;const o=[];for(const x of w.slice(0,6)){if(!Array.isArray(x)||x.length!==2)return null;o.push([Math.round(num(x[0],0,1439,0)),Math.round(num(x[1],0,1439,0))]);}return o;}
function cleanLoad(l,used){if(!l||typeof l!=='object')return null;const w=num(l.w,0,20000,NaN);if(!isFinite(w)||typeof l.name!=='string')return null;
 const o=mkLoad({id:'',name:l.name.slice(0,60),short:(typeof l.short==='string'?l.short:l.name).slice(0,30),w:Math.round(w),qty:Math.round(num(l.qty,1,50,1)),surge:num(l.surge,1,15,1),volt:l.volt===240?240:120,leg:l.leg===2?2:1,
  mode:['auto','on','off'].includes(l.mode)?l.mode:'auto',off:Math.round(num(l.off,0,1439,0)),basis:typeof l.basis==='string'?l.basis.slice(0,1200):'',src:typeof l.src==='string'&&/^https:\/\//.test(l.src)?l.src.slice(0,400):undefined});
 const wins=cleanWins(l.wins);if(!wins)return null;o.wins=wins;
 if(l.cyc){const on=num(l.cyc.on,1,1440,NaN),ev=num(l.cyc.every,1,1440,NaN);if(!isFinite(on)||!isFinite(ev)||on>ev)return null;o.cyc={on:Math.round(on),every:Math.round(ev)};}
 if(l.thermo){const st=num(l.thermo.set,-40,120,NaN);if(!isFinite(st))return null;o.thermo={set:st,every:Math.round(num(l.thermo.every,5,240,30))};}
 if(l.chg){const wh=num(l.chg.wh,0.5,5000,NaN);if(!isFinite(wh))return null;o.chg={wh:wh,per:Math.round(num(l.chg.per,1,10,1)),eff:num(l.chg.eff,0.5,1,0.85)};o.wins=[[o.wins[0][0],o.wins[0][0]]];}
 if(o.src===undefined)delete o.src;
 let id=typeof l.id==='string'&&/^[A-Za-z0-9_-]{1,24}$/.test(l.id)?l.id:'';if(!id||used.has(id))id='c'+(++loadSeq);used.add(id);o.id=id;return o;}
// Returns an error string, or null after applying the build.
function applyPayload(p){
 if(p&&typeof p==='object'&&p.app==='solar-battery-sandbox'&&p.kind==='state')return 'That is a simulation state file. Use Import state file instead.';
 if(!p||typeof p!=='object'||p.app!=='solar-battery-sandbox'||!p.cfg||!Array.isArray(p.loads))return 'That file is not a build saved from this sandbox.';
 const c=p.cfg,n=JSON.parse(JSON.stringify(S.cfg));
 const pan=PANELS.find(x=>x.id===c.panel),bat=BATTS.find(x=>x.id===c.batt),mp=MPPTS.find(x=>x.id===c.mppt),iv=INVS.find(x=>x.id===c.inv);
 if(!pan||!bat||!mp||!iv)return 'The file names a part this version doesn\u2019t have.';
 for(const k in CFG_NUM){if(c[k]!==undefined){const [a,b]=CFG_NUM[k];n[k]=num(c[k],a,b,n[k]);if(k!=='shade'&&k!=='other')n[k]=Math.round(n[k]);}}
 if(![12,24,48].includes(n.sysV))return 'The file has a system voltage this sandbox can\u2019t use.';
 if(iv.v!==n.sysV)return 'The inverter in the file doesn\u2019t match its system voltage.';
 n.panel=pan.id;n.batt=bat.id;n.mppt=mp.id;n.inv=iv.id;n.bloc=c.bloc==='shed'?'shed':'in';n.mount=['auto','open','roof','glued'].includes(c.mount)?c.mount:'auto';n.bifOn=!!c.bifOn;
 const oN=(v,a,b)=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);if(!isFinite(x))return undefined;return Math.round(Math.max(a,Math.min(b,x)));};
 n.soh=c.soh===undefined?100:Math.round(num(c.soh,50,100,100));n.heatSpeed=['fast','mid','slow'].includes(c.heatSpeed)?c.heatSpeed:'mid';
 n.ambF=oN(c.ambF,-40,160);n.ccc=oN(c.ccc,1,50);if(n.ambF===undefined||n.ccc===undefined)return 'The wiring inputs in the file are damaged, so nothing was changed.';
 n.insC=[60,75,90].includes(c.insC)?c.insC:null;n.termC=[60,75,90].includes(c.termC)?c.termC:null;
 n.hor=Array.isArray(c.hor)&&c.hor.length===8?c.hor.map(x=>Math.round(num(x,0,60,0))):[0,0,0,0,0,0,0,0];n.snowRec=c.snowRec===undefined?true:!!c.snowRec;n.genOn=!!c.genOn;n.genMode=c.genMode==='attended'?'attended':'manual';n.genFuel=num(c.genFuel,0,500,0.95);n.ageOn=!!c.ageOn;
 for(const k of ['reserve','genStart','genStop','ageYears'])n[k]=Math.round(num(c[k],CFG_NUM[k][0],CFG_NUM[k][1],n[k]));if(n.genStop<=n.genStart)n.genStop=Math.min(100,n.genStart+10);
 for(const k of ['pv','cb','bi']){const mat=c[k+'Mat']==='al'?'al':'cu';n[k+'Mat']=mat;n[k+'G']=WIRE[mat][c[k+'G']]?c[k+'G']:n[k+'G'];if(!WIRE[mat][n[k+'G']])n[k+'G']=Object.keys(WIRE[mat])[3];}
 const used=new Set(),loads=[];for(const l of p.loads.slice(0,24)){const o=cleanLoad(l,used);if(!o)return 'An appliance in the file is incomplete or damaged, so nothing was changed.';loads.push(o);}
 if(S.mission){S.mission=null;S.missionEnd=null;REMAP=null;hideBanner();leaveMissionWeather();log('Build replaced: mission abandoned.');}
 S.cfg=n;PANEL=pan;BATT=bat;S.genFuelLeft=n.genFuel;S.genRun=false;S.loads=loads;S.savedLoads=null;S.mpptDead=false;
 buildAppl();renderLoads();cfgChanged(true,true);return null;}
function saveNote(t,bad){const e=$('saveNote');e.textContent=t;e.style.color=bad?'var(--warn,#c0392b)':'';}
function saveLocal(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(buildPayload()));saveNote('Saved in this browser at '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'.');log('Build saved in this browser.');}catch(e){saveNote('This browser blocked saving. Use Export design file instead.',true);}}
function loadLocal(){let raw=null;try{raw=localStorage.getItem(SAVE_KEY);}catch(e){}
 if(!raw){saveNote('Nothing saved in this browser yet.',true);return;}
 let p;try{p=JSON.parse(raw);}catch(e){saveNote('The saved build is damaged.',true);return;}
 const err=applyPayload(p);if(err)saveNote(err,true);else{saveNote('Loaded the build saved '+(p.saved?new Date(p.saved).toLocaleString():'earlier')+'.');log('Saved build loaded.');}}
function exportBuild(){const blob=new Blob([JSON.stringify(buildPayload(),null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='solar-build.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);saveNote('Exported solar-build.json.');}
function importBuild(file){if(!file)return;if(file.size>500000){saveNote('That file is too big to be a build.',true);return;}
 const r=new FileReader();r.onload=()=>{let p;try{p=JSON.parse(r.result);}catch(e){saveNote('That file isn\u2019t valid JSON.',true);return;}const err=applyPayload(p);if(err)saveNote(err,true);else{saveNote('Imported '+file.name+'.');log('Build imported from '+file.name+'.');}};r.onerror=()=>saveNote('The file could not be read.',true);r.readAsText(file);}
// ---------- Save simulation state ----------
const STATE_KEY='solarSandboxState.v1';
function buildStatePayload(){const L=x=>x?x.map(cloneLoad):null;
 return {app:'solar-battery-sandbox',kind:'state',version:1,saved:new Date().toISOString(),design:buildPayload(),
  state:{t:S.t,soc:S.soc,battT:S.battT,snow:S.snow,blastUntil:S.blastUntil,randomSnow:S.randomSnow,mpptDead:S.mpptDead,invOn:S.invOn,invTrip:S.invTrip,invLow:S.invLow,bmsTrip:S.bmsTrip,overMin:S.overMin,ovl:S.ovl,coldLock:S.coldLock,coldDis:S.coldDis,coldWarnDay:S.coldWarnDay,lastI:S.lastI,absMin:S.absMin,absDay:S.absDay,heatOn:!!S.heatOn,genRun:!!S.genRun,genFuelLeft:S.genFuelLeft,
   prevOn:Object.assign({},S.prevOn),stats:Object.assign({},S.stats),day:Object.assign({},S.day),hist:S.hist.map(h=>h.slice()),log:S.log.map(e=>({t:e.t,msg:e.msg,bad:!!e.bad})),
   wx:WXID,wxBefore:S.wxBefore||null,mission:S.mission?S.mission.spec:null,missionEnd:S.mission?S.missionEnd:null,savedLoads:L(S.savedLoads)}};}
// Returns {err} or {st} with every field checked. Nothing is changed here.
function cleanState(p){
 const bad=m=>({err:m||'The state file is damaged, so nothing was changed.'});
 if(!p||typeof p!=='object'||p.app!=='solar-battery-sandbox')return bad('That file is not saved from this sandbox.');
 if(p.kind!=='state')return bad('That is a design file. Use Import design file instead.');
 if(p.version!==1)return bad('That state file is from a version this page can\u2019t read.');
 const x=p.state;if(!x||typeof x!=='object'||!p.design)return bad();
 const N=(v,a,b)=>typeof v==='number'&&isFinite(v)&&v>=a&&v<=b;const B=v=>typeof v==='boolean';
 if(!N(x.t,0,YEARMIN-1)||!N(x.soc,0,1)||!N(x.battT,-60,80)||!N(x.snow,0,1)||!N(x.blastUntil,-1,YEARMIN*2)||!N(x.overMin,0,1e5)||!N(x.ovl,-1e7,1e7)||!N(x.coldWarnDay,-1,400)||!N(x.lastI,-1e5,1e5)||!N(x.absMin,0,1e5)||!N(x.absDay,-1,400))return bad();
 for(const k of ['randomSnow','mpptDead','invOn','invTrip','invLow','bmsTrip','coldLock','coldDis','heatOn'])if(!B(x[k]))return bad();
 if(!x.prevOn||typeof x.prevOn!=='object'||Array.isArray(x.prevOn)||Object.keys(x.prevOn).length>60)return bad();
 const prevOn={};for(const k in x.prevOn){if(!/^[A-Za-z0-9_-]{1,24}$/.test(k)||!B(x.prevOn[k]))return bad();prevOn[k]=x.prevOn[k];}
 const tmpl=newStats();if(!x.stats||typeof x.stats!=='object')return bad();const stats={};for(const k in tmpl){const v=x.stats[k]===undefined&&['requested','unfitWh','unfitMin'].includes(k)?0:x.stats[k];if(!N(v,-1e13,1e13))return bad();stats[k]=v;}
 if(!x.day||!N(x.day.pv,0,1e9)||!N(x.day.load,0,1e9)||!N(x.day.d,0,1e6))return bad();
 if(!Array.isArray(x.hist)||x.hist.length>288)return bad();for(const h of x.hist)if(!Array.isArray(h)||h.length!==4||!h.every(v=>N(v,-1e9,1e9)))return bad();
 if(!Array.isArray(x.log)||x.log.length>80)return bad();for(const e of x.log)if(!e||!N(e.t,-1e9,1e9)||typeof e.msg!=='string'||e.msg.length>600||!B(e.bad))return bad();
 const wxOk=w=>w==='tmy'||(typeof w==='string'&&/^w\d{4}$/.test(w)&&HIST_YEARS.includes(+w.slice(1)));
 if(!wxOk(x.wx)||(x.wxBefore!==null&&!wxOk(x.wxBefore)))return bad();
 let mission=null;if(x.mission!==null){mission=makeMission(x.mission);if(!mission||!N(x.missionEnd,0,YEARMIN-1)||mission.wx!==x.wx)return bad();}
 let savedLoads=null;if(x.savedLoads!==null){if(!Array.isArray(x.savedLoads)||x.savedLoads.length>24)return bad();const used=new Set();savedLoads=[];for(const l of x.savedLoads){const o=cleanLoad(l,used);if(!o)return bad();savedLoads.push(o);}}
 return {st:{t:x.t,soc:x.soc,battT:x.battT,snow:x.snow,blastUntil:x.blastUntil,randomSnow:x.randomSnow,mpptDead:x.mpptDead,invOn:x.invOn,invTrip:x.invTrip,invLow:x.invLow,bmsTrip:x.bmsTrip,overMin:x.overMin,ovl:x.ovl,coldLock:x.coldLock,coldDis:x.coldDis,coldWarnDay:x.coldWarnDay,lastI:x.lastI,absMin:x.absMin,absDay:x.absDay,heatOn:x.heatOn,genRun:!!x.genRun,genFuelLeft:N(x.genFuelLeft,0,500)?x.genFuelLeft:0,
  prevOn,stats,day:{pv:x.day.pv,load:x.day.load,d:x.day.d},hist:x.hist.map(h=>h.slice()),log:x.log.map(e=>({t:e.t,msg:e.msg,bad:e.bad})),wx:x.wx,wxBefore:x.wxBefore,mission,missionEnd:x.missionEnd,savedLoads}};}
function applyState(p){
 if(RATE_RUN)return 'Wait for the failure-rate run to finish first.';
 const c=cleanState(p);if(c.err)return c.err;
 if(p.design&&p.design.kind==='state')return 'The state file is damaged, so nothing was changed.';
 const before=buildStatePayload();
 const err=applyPayload(p.design);if(err)return err;
 const st=c.st;setPlaying(false);
 if(!setWeather(st.wx)){applyPayload(before.design);return 'The state file names weather this page doesn\u2019t have.';}
 for(const k of ['t','soc','battT','snow','blastUntil','randomSnow','mpptDead','invOn','invTrip','invLow','bmsTrip','overMin','ovl','coldLock','coldDis','coldWarnDay','lastI','absMin','absDay','heatOn','genRun','genFuelLeft','prevOn','stats','day','hist','log'])S[k]=st[k];
 S.wxBefore=st.wxBefore;S.mission=st.mission;S.missionEnd=st.mission?st.missionEnd:null;REMAP=(st.mission&&st.mission.remap)?worstWeekMap(st.mission.startDay,st.mission.days):null;
 S.savedLoads=st.savedLoads;hideBanner();buildAppl();renderLoads();renderMissions();syncWxSelect();renderLog();renderAll();return null;}
function saveStateLocal(){try{localStorage.setItem(STATE_KEY,JSON.stringify(buildStatePayload()));saveNote('Simulation state saved in this browser at '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'.');log('Simulation state saved in this browser.');}catch(e){saveNote('This browser blocked saving. Use Export state file instead.',true);}}
function loadStateLocal(){let raw=null;try{raw=localStorage.getItem(STATE_KEY);}catch(e){}
 if(!raw){saveNote('No simulation state saved in this browser yet.',true);return;}
 let p;try{p=JSON.parse(raw);}catch(e){saveNote('The saved state is damaged.',true);return;}
 const err=applyState(p);if(err)saveNote(err,true);else{saveNote('Loaded the simulation state saved '+(p.saved?new Date(p.saved).toLocaleString():'earlier')+'.');log('Saved simulation state loaded.');}}
function exportState(){const blob=new Blob([JSON.stringify(buildStatePayload())],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='solar-state.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);saveNote('Exported solar-state.json.');}
function importState(file){if(!file)return;if(file.size>2000000){saveNote('That file is too big to be a saved state.',true);return;}
 const r=new FileReader();r.onload=()=>{let p;try{p=JSON.parse(r.result);}catch(e){saveNote('That file isn\u2019t valid JSON.',true);return;}const err=applyState(p);if(err)saveNote(err,true);else{saveNote('Imported '+file.name+'.');log('Simulation state imported from '+file.name+'.');}};r.onerror=()=>saveNote('The file could not be read.',true);r.readAsText(file);}
function renderSources(){const ul=$('srcParts');if(!ul)return;const a=(u,t)=>u?' <a href="'+esc(u)+'" target="_blank" rel="noopener">'+t+'</a>':'';const li=(n,t,pg,ds)=>'<li><b>'+esc(n)+'</b>: '+esc(t)+a(pg,'Product page')+(pg&&ds?',':'')+a(ds,'Datasheet')+'</li>';let h='';
 PANELS.forEach(p=>{h+=li(p.name,p.voc+' V open-circuit, '+p.isc+' A short-circuit, '+p.vmp+' V and '+p.imp+' A at max power. Heat: '+p.g+'%/\u00b0C power. '+p.tcSrc+(p.tcAssumed?' (assumed values).':'.'),p.url,p.ds);});
 BATTS.forEach(b=>{h+=li(b.name,(b.tSrc||''),b.url,b.ds);});
 INVS.forEach(i=>{h+=li(i.name,i.c25+' W continuous at 77\u00b0F'+(i.contPts.length>1?', '+i.contPts[1][1]+' W at 104\u00b0F':'')+(i.tl?', '+i.tl.w+' W for up to '+i.tl.min+' min from cold':'')+', '+i.peak+' W peak'+(i.peakS?' for '+i.peakS+' s':' (duration not published; the sim allows 2 min over the continuous rating)')+', '+Math.round(i.eff*100)+'% peak efficiency, '+i.idle+' W at no load (Victron datasheet).',null,i.ds);});
 MPPTS.forEach(m=>{h+=li(m.name,m.amps+' A, '+m.abs+' V max, PV short-circuit '+m.isc+' A, nominal PV '+Object.entries(m.pv).map(([v,w])=>w+' W at '+v+' V').join(', ')+', battery cable up to '+(m.termG||'?')+' AWG (Victron datasheet).',null,m.ds);});
 ul.innerHTML=h;}
// ---------- Controls ----------
function syncInputs(){const c=S.cfg;
 document.querySelectorAll('#sysV button').forEach(b=>b.classList.toggle('on',Number(b.dataset.v)===c.sysV));
 $('ser').value=c.ser;$('par').value=c.par;$('shade').value=c.shade;$('shadeV').textContent=c.shade+'%';$('nMppt').value=c.nMppt;$('bpar').value=c.bpar;$('bloc').value=c.bloc;$('cold').value=c.coldF;$('coldV').textContent=c.coldF+'°F';
 $('soh').value=c.soh;$('sohV').textContent=c.soh+'%';renderV8Controls(c);$('heatSpeed').value=c.heatSpeed;$('heatRow').hidden=!(BATT.heatW>0);
 $('ambF').value=c.ambF==null?'':c.ambF;$('ccc').value=c.ccc==null?'':c.ccc;$('insC').value=c.insC==null?'':String(c.insC);$('termC').value=c.termC==null?'':String(c.termC);
 const ms=$('mppt');ms.innerHTML=MPPTS.map(m=>'<option value="'+m.id+'">'+m.name+' ('+m.amps+' A, '+m.abs+' V) — '+money(m.price)+'</option>').join('');ms.value=c.mppt;
 const iv=$('inv');iv.innerHTML=INVS.filter(i=>i.v===c.sysV).map(i=>'<option value="'+i.id+'">'+i.name+' ('+i.cont+' W'+(i.split?' per leg':'')+') — '+money(i.price)+'</option>').join('');
 if(!INVS.find(i=>i.id===c.inv&&i.v===c.sysV)){const same=INVS.filter(i=>i.v===c.sysV);const prev=INVS.find(i=>i.id===c.inv);c.inv=(same.find(i=>prev&&i.cont===prev.cont)||same[same.length>2?2:0]).id;}
 iv.value=c.inv;
 const np=c.ser*c.par,nb=nSer()*c.bpar;
 document.querySelectorAll('.qP').forEach(e=>e.textContent=np);
 document.querySelectorAll('.qPs').forEach(e=>e.textContent=W(np*PANEL.w)+', '+c.ser+' in series × '+c.par+(c.par>1?' strings':' string'));
 document.querySelectorAll('.qB').forEach(e=>e.textContent=nb);
 document.querySelectorAll('.qBs').forEach(e=>e.textContent=(capWh()/1000).toFixed(1)+' kWh, '+nSer()+'S × '+c.bpar+'P');
 syncParts();renderCost();syncMountWiring();renderCompat();}
const money=v=>'$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function syncParts(){const c=S.cfg;
 $('ptype').value=c.panel;$('btype').value=c.batt;
 $('pKind').textContent=PANEL.w+' W each. '+PANEL.kind;$('bKind').textContent=(BATT.ah*BATT.vnom/1000).toFixed(2)+' kWh each'+(BATT.floor>0?' ('+(BATT.ah*BATT.vnom*(1-BATT.floor)/1000).toFixed(2)+' usable)':'')+'. '+BATT.kind;
 document.querySelectorAll('.pName').forEach(e=>e.textContent=PANEL.name+', per string');document.querySelectorAll('.bName').forEach(e=>e.textContent=BATT.name+(nSer()>1?', '+nSer()+' in series per string':' each'));
 $('sysVnote').textContent=BATT.mod===48?'This battery is 48 V on its own, so only 48 V works':'Battery bank: '+BATT.mod+' V batteries in series';
 document.querySelectorAll('#sysV button').forEach(b=>{b.disabled=Number(b.dataset.v)<BATT.mod||Number(b.dataset.v)/BATT.mod>BATT.maxSer;});
 $('bpar').max=BATT.maxPar;if(document.activeElement!==$('otherCost'))$('otherCost').value=c.other||0;}
const GEN={get on(){return !!S.cfg.genOn;}};
// Honda EU2200i, from Honda's own product page (checked Oct 31, 2026): 1,800 W rated, 2,200 W max, 120 V, 0.95 gal tank, 3.2 h at rated load, 8.1 h at 1/4 load, MSRP $1,199.
const GEN_DS={name:'Honda EU2200i inverter generator',w:1800,max:2200,tank:0.95,rtRated:3.2,rtQuarter:8.1,price:1199,priceAsOf:'Oct 31, 2026',priceSrc:'Honda',priceUrl:'https://powerequipment.honda.com/generators/models/eu2200i'};
function genGph(loadW){const g1=GEN_DS.tank/GEN_DS.rtQuarter,g2=GEN_DS.tank/GEN_DS.rtRated,q=GEN_DS.w/4; // gal/hour: straight line between Honda's two published points; below 1/4 load held at the 1/4-load figure (an estimate)
 if(loadW<=q)return g1;return g1+(g2-g1)*Math.min(1,(loadW-q)/(GEN_DS.w-q));}
// MultiPlus-II 120V datasheet, max. battery charge current: 12/3000 120 A, 24/3000 70 A, 48/3000 35 A, 24/5000 120 A, 48/5000 70 A. Phoenix inverters have no charger.
const CHG_A={'m12-3000':120,'m24-3000':70,'m48-3000':35,'m24-5000':120,'m48-5000':70};
function chgA(I){return CHG_A[I.base||I.id]||0;}
const CHG_EFF_EST=0.90; // charger efficiency: Victron publishes no charger-efficiency figure in this datasheet, so 90 % is an estimate
// ---------- Bill of materials ----------
// Every line is one of: confirmed (seller page, link and date), yours (your own purchase price), estimated (no quote: a labeled guess), missing (not priced).
const PRICE_DATE_MAIN='Oct 30, 2026';   // panels, batteries, controllers and inverters: checked on each seller's page that day
const PRICE_DATE_BOS='Oct 31, 2026';    // Victron balance-of-system parts: Blue Marine product pages, fetched Oct 31, 2026 (UTC)
const BM='https://bluemarine.com/products/';
const BOS_SRC={shunt:BM+'victron-smartshunt-50mv',lynxT:BM+'victron-lynx-power-in',lynxD:BM+'victron-lynx-distributor',mega:BM+'victron-mega-fuse-32v-48v-80v'};
// Wire price per foot, one conductor: ESTIMATE, not a quote (typical US retail for stranded copper; aluminum taken as 40% of copper).
const WIRE_FT_EST={'14':0.35,'12':0.45,'10':0.65,'8':1.1,'6':1.7,'4':2.6,'2':3.9,'1/0':6,'2/0':7.5,'3/0':9.5,'4/0':12};
function wireFt(mat,g){const v=WIRE_FT_EST[g]||2;return mat==='al'?v*0.4:v;}
function costLines(){const c=S.cfg,np=c.ser*c.par,nb=nSer()*c.bpar,M=mppt(),I=inv();const pc=buyCost(np,PANEL.tiers),bc=buyCost(nb,BATT.tiers);
 const packs=t=>t.length>1||t[0][0]>1?' Bought as the cheapest mix of the packs sold'+(t[0][0]>1?' (smallest pack: '+t[0][0]+')':'')+'.':'';
 const own=PANEL.priceKind==='yours';
 const L=[{k:'panels',grp:'main',status:own?'yours':'confirmed',asOf:own?'':PRICE_DATE_MAIN,name:np+' × '+PANEL.name,note:own?PANEL.priceNote+(np>4?' You own 4; the other '+(np-4)+' are priced at the same $100, a guess.':''):(pc.bought>np?'You\'d buy '+pc.bought+', so '+(pc.bought-np)+' spare.':'')+packs(PANEL.tiers),cost:pc.cost,src:PANEL.src,url:PANEL.url},
  {k:'ctrl',grp:'main',status:'confirmed',asOf:PRICE_DATE_MAIN,name:c.nMppt+' × '+M.name,note:money(M.price)+' each.',cost:c.nMppt*M.price,src:'bluemarine.com',url:CTRL_URL[M.id]},
  {k:'batt',grp:'main',status:'confirmed',asOf:PRICE_DATE_MAIN,name:nb+' × '+BATT.name,note:(bc.bought>nb?'You\'d buy '+bc.bought+', so '+(bc.bought-nb)+' spare.':'')+packs(BATT.tiers),cost:bc.cost,src:BATT.src,url:BATT.url},
  {k:'inv',grp:'main',status:'confirmed',asOf:I.asOf||PRICE_DATE_MAIN,name:I.split?I.name:'1 × '+I.name,note:I.units>1?money(I.price/I.units)+' each, '+I.units+' units wired for 120/240 V split phase.':'',cost:I.price,src:'bluemarine.com',url:I.url||(I.id[0]==='m'?MP_URL:PH_URL)}];
 // balance of system
 const W_=wiringReport();const runs=[['pv','Panels to controller',c.nMppt],['cb','Controller to battery',c.nMppt],['bi','Battery to inverter',I.units||1]];
 for(const [k,lab,n] of runs){const ft=c[k+'Ft']*2*n,g=c[k+'G'],mat=c[k+'Mat'];L.push({k:'w'+k,grp:'bos',status:'estimated',name:lab+' cable: '+ft+' ft of '+g+' AWG '+(mat==='al'?'aluminum':'copper'),note:'About '+money(wireFt(mat,g))+' a foot, a typical retail figure, not a quote. Round trip'+(n>1?', '+n+' runs':'')+'.',cost:Math.round(ft*wireFt(mat,g)*100)/100});}
 const bankA=Math.max(W_&&W_.biI||0,0);
 const shuntBig=bankA>400;
 L.push({k:'shunt',grp:'bos',status:'confirmed',asOf:PRICE_DATE_BOS,name:'1 × Victron SmartShunt '+(shuntBig?'1000':'500')+' A battery monitor',note:'Counts amp-hours in and out so you can see the real charge.',cost:shuntBig?165.75:100.3,src:'bluemarine.com',url:BOS_SRC.shunt});
 L.push({k:'lynxT',grp:'bos',status:'confirmed',asOf:PRICE_DATE_BOS,name:'1 × Victron Lynx Class-T Power In',note:'Busbar with a holder for the main Class T battery fuse.',cost:212.5,src:'bluemarine.com',url:BOS_SRC.lynxT});
 L.push({k:'tfuse',grp:'bos',status:'missing',name:'1 × Class T main battery fuse',note:'Not priced. Size it from the inverter\u2019s manual.',cost:0});
 L.push({k:'lynxD',grp:'bos',status:'confirmed',asOf:PRICE_DATE_BOS,name:'1 × Victron Lynx Distributor',note:'Fused busbar for the controller and inverter circuits (MEGA fuses).',cost:232.9,src:'bluemarine.com',url:BOS_SRC.lynxD});
 L.push({k:'mega',grp:'bos',status:'confirmed',asOf:PRICE_DATE_BOS,name:'2 × packs of 5 Victron MEGA fuses',note:'One pack per fuse rating: one for the controller circuit, one for the inverter.',cost:93.5,src:'bluemarine.com',url:BOS_SRC.mega});
 if(W_&&W_.strFuseNeeded)L.push({k:'sfuse',grp:'bos',status:'missing',name:c.par+' × PV string fuses and holders',note:'Needed with this many strings in parallel. Not priced.',cost:0});
 L.push({k:'mc4',grp:'bos',status:'estimated',name:'MC4 connectors'+(c.par>1?' and branch connectors':''),note:'Typical retail figure, not a quote.',cost:15+(c.par>1?20*c.nMppt:0)});
 L.push({k:'pvdisc',grp:'bos',status:'estimated',name:c.nMppt+' × DC-rated PV disconnect or breaker',note:'Typical retail figure for a DC-rated breaker and box, not a quote.',cost:60*c.nMppt});
 L.push({k:'batlug',grp:'bos',status:'estimated',name:'Battery cable lugs and heat-shrink',note:'Typical retail figure, not a quote.',cost:30});
 L.push({k:'rack',grp:'bos',status:'missing',name:'Ground-mount racking for '+np+' panels',note:'Depends on your site and build. Not priced.',cost:0});
 L.push({k:'acpanel',grp:'bos',status:'missing',name:'AC breakers, subpanel and transfer switch or interlock',note:'Depends on your house wiring. Not priced; see the not-modeled list.',cost:0});
 L.push({k:'gnd',grp:'bos',status:'missing',name:'Grounding and bonding: ground rod, grounding conductors, lugs',note:'Not priced.',cost:0});
 if(GEN.on)L.push({k:'gen',grp:'bos',status:GEN_DS.price?'estimated':'missing',asOf:GEN_DS.priceAsOf,name:'1 × '+GEN_DS.name,note:'Honda\'s suggested retail price as a search result reported it; the Honda page read on Oct 31, 2026 confirmed the specs but didn\'t show the price. Dealers set the price.',cost:GEN_DS.price||0,src:GEN_DS.priceSrc,url:GEN_DS.priceUrl});
 if(c.other>0)L.push({k:'other',grp:'bos',status:'estimated',name:'Your own estimate for anything else',note:'Your figure.',cost:c.other});
 return L;}
function costSums(){const L=costLines();const sum=f=>L.filter(f).reduce((a,l)=>a+l.cost,0);return {L,confirmed:sum(l=>l.status==='confirmed'),yours:sum(l=>l.status==='yours'),estimated:sum(l=>l.status==='estimated'),missing:L.filter(l=>l.status==='missing')};}
function totalCost(){const s=costSums();return s.confirmed+s.yours+s.estimated;}
const STATUS_TXT={confirmed:'Confirmed price',yours:'Your purchase price',estimated:'Estimate',missing:'Missing: not priced'};
function renderCost(){const s=costSums(),L=s.L,tot=s.confirmed+s.yours+s.estimated,c=S.cfg;
 const li=l=>'<li class="bom-'+l.status+'"><span>'+esc(l.name)+'<small><i>'+STATUS_TXT[l.status]+(l.asOf?', as of '+l.asOf:'')+'.</i> '+esc(l.note||'')+(l.url?' <a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.src)+'</a>':'')+'</small></span><b>'+(l.status==='missing'?'—':money(l.cost))+'</b></li>';
 $('costList').innerHTML='<li class="bom-h"><span>Main parts</span></li>'+L.filter(l=>l.grp==='main').map(li).join('')+'<li class="bom-h"><span>Wiring, protection, monitoring and mounting</span></li>'+L.filter(l=>l.grp==='bos').map(li).join('');
 const kw=c.ser*c.par*PANEL.w/1000;
 $('costTotal').textContent='Total so far: '+money(tot);
 $('costNote').textContent='That is '+money(s.confirmed)+' confirmed'+(s.yours>0?' + '+money(s.yours)+' your own purchase price':'')+' + '+money(s.estimated)+' estimated. Not included because they aren\u2019t priced: '+s.missing.map(l=>l.name.replace(/^\d+ × /,'')).join('; ')+'. So the real total will be higher. Before tax and shipping. Works out to '+money(tot/Math.max(0.001,usableWh()/1000))+' per usable kWh of battery and '+money(tot/Math.max(0.001,kw*1000))+' per panel watt for the priced items.';
 const q=$('qCost');if(q)q.textContent='Parts priced so far: '+money(tot);}
function setPanelType(id,quiet){const c=S.cfg,N=c.ser*c.par;const P=PANELS.find(p=>p.id===id);if(!P)return;PANEL=P;c.panel=id;
 const oldSer=c.ser;if(quiet&&!checks().some(x=>x[0]==='fail'&&/series|beat|over/i.test(x[1]))){cfgChanged(true,true);return;}
 let got=null,n=N;for(let d=0;d<80&&!got;d++){for(const t of [N+d,N-d]){if(t>=1&&t<=80&&!got){const g=arrangeFor(t);if(g){got=g;n=t;}}}}
 if(got){const M=mppt();let k=got.n;while(k<Math.min(4,got.par)&&n*PANEL.w/(k*M.amps*nSer()*BATT.vnom)>1.35)k++;c.ser=got.ser;c.par=got.par;c.nMppt=k;if(!quiet||n!==N||got.ser!==oldSer)log((quiet?'Rewired the panels for the new battery voltage: ':'Switched to '+PANEL.name+': ')+n+' panels, '+got.ser+' in series × '+got.par+(got.par>1?' strings':' string')+' ('+W(n*PANEL.w)+').');}
 else log('Switched to '+PANEL.name+', but no layout of these panels suits this controller. Check the design list.',true);
 cfgChanged(true,true);}
function setBattType(id){const c=S.cfg;const Bn=BATTS.find(b=>b.id===id);if(!Bn)return;const oldWh=capWh();BATT=Bn;c.batt=id;
 if(c.sysV<BATT.mod||c.sysV/BATT.mod>BATT.maxSer){c.sysV=BATT.mod===48?48:Math.min(48,BATT.mod*BATT.maxSer);log('System voltage changed to '+c.sysV+' V to suit this battery.');}
 const M0=mppt();if(!M0.volts.includes(c.sysV)){const M1=MPPTS.find(m=>m.volts.includes(c.sysV)&&m.amps>=M0.amps)||MPPTS.filter(m=>m.volts.includes(c.sysV)).pop();if(M1){c.mppt=M1.id;log('Controller changed to '+M1.name+': the '+M0.name+' can\'t charge a '+c.sysV+' V bank.');}}
 let bp=Math.max(1,Math.round(oldWh/(nSer()*BATT.ah*BATT.vnom)));bp=Math.min(BATT.maxPar,bp);c.bpar=bp;S.lastI=0;S.heatOn=false;S.bmsTrip=false;S.invLow=false;if(S.soc<BATT.floor)S.soc=BATT.floor;
 log('Switched to '+BATT.name+': '+nSer()*bp+' batteries ('+nSer()+'S × '+bp+'P), '+(capWh()/1000).toFixed(2)+' kWh, kept close to the old bank size. New batteries join at the same charge.');setPanelType(c.panel,true);}

// ---------- Controller compatibility for the chosen panel (Victron limits from its MPPT datasheets) ----------
const HIST_COLD_F=-21.1; // coldest hour in the 25 NASA POWER winters (Jan 16, 2009 grid-cell air temperature, -29.5 C)
function compatRows(N){const c=S.cfg,coldC=fToC(c.coldF),vAbs=nSer()*BATT.absorb,P=PANEL,rows=[];
 for(let ser=1;ser<=N;ser++){if(N%ser)continue;const par=N/ser;
  const vocC=ser*P.voc*(1+P.b/100*(coldC-25)),vmpHot=ser*P.vmp*(1+(P.g-P.a)/100*40),iscC=P.isc*(1+P.a/100*(35-25));
  for(const M of MPPTS)for(let nC=1;nC<=Math.min(2,par);nC++){const per=Math.ceil(par/nC),isc=per*P.isc,pvW=per*ser*P.w,nomW=M.amps*c.sysV;
   const why=[];let ok=true;
   if(!M.volts.includes(c.sysV)){ok=false;why.push('can\u2019t charge a '+c.sysV+' V bank');}
   if(vocC>M.abs){ok=false;why.push('cold Voc '+vocC.toFixed(1)+' V is over the '+M.abs+' V absolute limit: this destroys the controller');}
   else if(vocC>M.op){ok=false;why.push('cold Voc '+vocC.toFixed(1)+' V is over the '+M.op+' V operating limit');}
   if(isc>M.isc){ok=false;why.push(per+' strings give '+isc.toFixed(1)+' A short-circuit, over its '+M.isc+' A maximum');}
   if(ser*P.vmp<vAbs+5){ok=false;why.push('string voltage '+(ser*P.vmp).toFixed(1)+' V is too low to charge a '+c.sysV+' V bank (needs about '+(vAbs+5).toFixed(0)+' V)');}
   else if(vmpHot<vAbs+5)why.push('on hot days the string drops to about '+vmpHot.toFixed(0)+' V, close to the charging threshold');
   if(ok&&pvW>nomW*1.0)why.push(W(pvW)+' of panels per controller is over its about '+W(nomW)+' nominal output at '+c.sysV+' V, so it clips on bright cold days (Victron allows this; it wastes some solar)');
   if(ok&&P.bifacial&&c.bifOn)why.push('rear-side gain raises short-circuit current above the front-only '+isc.toFixed(1)+' A; check the margin');
   rows.push({ser,par,nC,M,ok,vocC,isc,pvW,cost:nC*M.price,why});}}
 return rows;}
function renderCompat(){const box=$('compat');if(!box)return;const c=S.cfg,N=c.ser*c.par,R=compatRows(N);
 const good=R.filter(r=>r.ok),bad=R.filter(r=>!r.ok);
 const li=r=>'<li class="'+(r.ok?'spec':'fail')+'"><b>'+r.ser+' in series × '+r.par+(r.par>1?' strings':' string')+' on '+r.nC+' × '+r.M.name.replace('SmartSolar ','')+'</b> ('+money(r.cost)+'): cold-morning open-circuit '+r.vocC.toFixed(1)+' V, short-circuit '+r.isc.toFixed(1)+' A per controller. '+(r.why.length?esc(r.why.join('; '))+'.':'')+'</li>';
 box.innerHTML='<p class="note">For '+N+' × '+esc(PANEL.name)+' at '+c.sysV+' V, designing for '+c.coldF+'°F (the coldest hour in the 25 NASA POWER winters was '+HIST_COLD_F+'°F). Cold voltage uses the panel\u2019s own Voc coefficient ('+PANEL.b+' %/°C). Victron limits: 100/30 is 100 V and 35 A short-circuit; 150/35 is 150 V (145 V to operate) and 40 A; 150/70 is 150 V and 50 A; 250/70 is 250 V (245 V to operate) and 35 A. Layouts within those limits are marked within spec; that is not an approval.</p>'+
 '<p class="lt">Works within Victron\u2019s published limits</p><ul class="checks">'+(good.length?good.map(li).join(''):'<li class="fail">No layout of '+N+' panels works with these controllers at '+c.sysV+' V.</li>')+'</ul>'+
 '<p class="lt">Doesn\u2019t work</p><ul class="checks">'+bad.map(li).join('')+'</ul>';}
function useMyLongi(){const c=S.cfg;PANEL=PANELS.find(p=>p.id==='lg435');c.panel='lg435';
 // keep the default battery bank; 2 in series x 2 strings on one SmartSolar 150/70 at 24 V
 if(c.batt!=='bb100'){BATT=BATTS.find(b=>b.id==='bb100');c.batt='bb100';}c.sysV=24;c.bpar=2;c.ser=2;c.par=2;c.mppt='150/70';c.nMppt=1;c.mount='open';
 if(!INVS.find(i=>i.id===c.inv&&i.v===24))c.inv='m24-3000';if(gIdx(c.cbG)<gIdx('4'))c.cbG='4';S.mpptDead=false;
 log('Your four LONGi 435 W panels: 2 in series × 2 strings (1,740 W) on one SmartSolar 150/70, default 24 V Battle Born bank. Check "Which controllers work" for other layouts.');cfgChanged(true,true);}
function renderPartsList(){const li=(name,url,src,txt)=>'<li><a href="'+url+'" target="_blank" rel="noopener">'+name+'</a> ('+src+'): '+txt+'</li>';const pr=t=>t.map(x=>(x[0]>1?x[0]+' for ':'')+money(x[1])).join(', ');
 $('partsList').innerHTML=PANELS.map(p=>li(p.name,p.url,p.src,p.voc+' V open-circuit, '+p.isc+' A short-circuit, '+p.vmp+' V and '+p.imp+' A at max power. '+(p.priceKind==='yours'?'$100 each: your own purchase price ($400 for four), not a store price':pr(p.tiers)+', price as of '+PRICE_DATE_MAIN)+'.'+(PANEL_TC[p.id]&&PANEL_TC[p.id].dims?' '+PANEL_TC[p.id].dims+'; bifaciality '+Math.round(PANEL_TC[p.id].bifi*100)+' ± 5 %; max series fuse '+PANEL_TC[p.id].fuse+' A.':''))).join('')+
 BATTS.map(b=>li(b.name,b.url,b.src,b.vnom+' V, '+b.ah+' Ah'+(b.cont>0?', '+b.cont+' A continuous':', no protection board')+', '+(b.maxSer>8?'':'up to '+b.maxSer+' in series, ')+'up to '+b.maxPar+' in parallel'+(b.heatW?', '+b.heatW+' W heating pad':'')+'. '+pr(b.tiers)+', price as of '+PRICE_DATE_MAIN+'.')).join('')+
 '<li>Victron SmartSolar controllers ('+MPPTS.map(m=>m.name.replace('SmartSolar ','')+' '+money(m.price)).join(', ')+'), Phoenix inverters and MultiPlus-II inverter-chargers: ratings from Victron\'s datasheets, prices from <a href="https://bluemarine.com/products/victron-smartsolar-charge-controller-mppt-150-35-150-45" target="_blank" rel="noopener">Blue Marine</a>, a Victron dealer, as of '+PRICE_DATE_MAIN+'. PV must beat battery voltage by 5 V to start; too much short-circuit current can damage a controller.</li>'+
 '<li>Split phase 120/240 V: two MultiPlus-II 120V units of the same model, per <a href="'+MP_DS+'" target="_blank" rel="noopener">Victron\u2019s MultiPlus-II 120V datasheet</a> (\u201ctwo units of the same model can be connected for a 240 V split phase output\u201d). Priced as two units at Blue Marine\u2019s single-unit price, as of '+PRICE_DATE_MAIN+'.</li>'+
 '<li>Balance of system: <a href="'+BOS_SRC.shunt+'" target="_blank" rel="noopener">SmartShunt</a> 500 A $100.30 and 1000 A $165.75, <a href="'+BOS_SRC.lynxT+'" target="_blank" rel="noopener">Lynx Class-T Power In</a> $212.50, <a href="'+BOS_SRC.lynxD+'" target="_blank" rel="noopener">Lynx Distributor</a> $232.90, <a href="'+BOS_SRC.mega+'" target="_blank" rel="noopener">MEGA fuses</a> $46.75 for 5: Blue Marine, as of '+PRICE_DATE_BOS+'. Wire, connectors, disconnects and lugs are estimates, not quotes. Racking, the main Class T fuse, AC breakers and grounding aren\u2019t priced.</li>'+
 '<li>Well pump: <a href="https://franklinwater.com/resources/franklin-aim/" target="_blank" rel="noopener">Franklin Electric AIM manual (M1311)</a>, 1/2 HP 230 V 2-wire motor 244505: 670 W full load, 960 W at maximum service factor, 32.2 A locked rotor.</li>';}
const CTRL_URL={'100/30':'https://bluemarine.com/products/victron-smartsolar-charge-controller-mppt-100-30-100-50','150/35':'https://bluemarine.com/products/victron-smartsolar-charge-controller-mppt-150-35-150-45','150/70':'https://bluemarine.com/products/victron-smartsolar-charge-controller-mppt-150-60-up-to-250-70','250/70':'https://bluemarine.com/products/victron-smartsolar-charge-controller-mppt-150-60-up-to-250-70'};
const PH_URL='https://bluemarine.com/products/victron-energy-phoenix-inverter-v-e-direct-120v',MP_URL='https://bluemarine.com/products/victron-multiplus-ii';
// Wire a total panel count into equal strings that suit the controller and battery voltage.
function arrangeFor(N){const M=mppt(),c=S.cfg,ns=nSer(),coldC=fToC(c.coldF),vAbs=ns*BATT.absorb;let best=null;
 for(let ser=10;ser>=1;ser--){if(N%ser)continue;const par=N/ser;if(par>8)continue;
  if(ser*PANEL.voc*(1+PANEL.b/100*(coldC-25))>M.op)continue;
  if(ser*PANEL.vmp<vAbs+5)continue;
  const hotOk=ser*PANEL.vmp*(1+(PANEL.g-PANEL.a)/100*40)>=vAbs+5;
  let n=1;while(n<4&&Math.ceil(par/n)*PANEL.isc>M.isc)n++;if(Math.ceil(par/n)*PANEL.isc>M.isc)continue;
  const sc=(hotOk?100:0)+ser;if(!best||sc>best.sc)best={ser,par,n,sc};}
 return best;}
function stepPanels(dir){const c=S.cfg;const cur=c.ser*c.par;
 if(!mppt().volts.includes(c.sysV)){log(mppt().name+' can\'t charge a '+c.sysV+' V bank. Pick another controller or battery voltage first.',true);return;}
 let N=cur+dir,got=null;
 while(N>=1&&N<=80){got=arrangeFor(N);if(got)break;N+=dir;}
 if(!got){log(dir>0?'No bigger array can be wired evenly for this controller at '+c.sysV+' V. Try a bigger controller or a higher battery voltage.':'No smaller array can be wired to charge a '+c.sysV+' V bank with these panels.',true);return;}
 if(Math.abs(N-cur)>1)log((cur+dir)+(Math.abs(N-cur)>2?' to '+(N-dir):'')+' panels can\'t be split into equal strings that suit this controller, so the count went to '+N+'.');
 const oldN=c.nMppt,M=mppt();let n=got.n;while(n<Math.min(4,got.par)&&N*PANEL.w/(n*M.amps*nSer()*BATT.vnom)>1.35)n++;
 c.ser=got.ser;c.par=got.par;c.nMppt=n;
 log(N+' panels, wired '+got.ser+' in series × '+got.par+(got.par>1?' strings':' string')+'.'+(n!==oldN?' Controllers: '+n+(n>oldN?', so the extra current and power have somewhere to go.':', since fewer are needed now.'):''));
 cfgChanged(true,true);}
function stepBatts(dir){const c=S.cfg;const nb=Math.max(1,Math.min(BATT.maxPar,c.bpar+dir));if(nb===c.bpar){log(dir>0?BATT.maxPar+' parallel strings is the most '+(BATT.maxPar===8?'this sandbox allows':'the maker allows for this battery')+'.':'You need at least one battery string.',true);return;}c.bpar=nb;S.lastI=0;log('Battery bank now '+nSer()*nb+' batteries ('+nSer()+'S × '+nb+'P). New batteries join at the same charge.');cfgChanged(true);}
function togglePv(){S.pvOpen=!S.pvOpen;log(S.pvOpen?'PV disconnect opened: the panels are cut off from the controller.':'PV disconnect closed: panels connected.');refreshLive();}
function cfgChanged(rebuild,layoutChange){
 if(layoutChange&&S.mpptDead){S.mpptDead=false;log('New panel layout or controller: controller replaced.');}
 syncInputs();if(rebuild){buildArray();buildBank();}renderChecks();afterLoadChange(true);refreshLive();}
function renderV8Controls(c){
 document.querySelectorAll('.hor').forEach(el=>{el.value=c.hor[+el.dataset.i];});
 $('snowRec').value=c.snowRec?'1':'0';$('reserve').value=c.reserve;$('reserveV').textContent=c.reserve+'%';
 $('genOn').value=c.genOn?'1':'0';$('genMode').value=c.genMode; $('genFuel').value=c.genFuel;$('genFuelLeft').textContent=S.genFuelLeft.toFixed(2)+' gal remaining';$('genManual').textContent=S.genRun?'Stop generator':'Start generator (recoil)';$('genManual').disabled=!c.genOn||c.genMode!=='manual'||chgA(inv())<=0||S.genFuelLeft<genGph(0)/60;$('genStart').value=c.genStart;$('genStartV').textContent=c.genStart+'%';$('genStop').value=c.genStop;$('genStopV').textContent=c.genStop+'%';
 document.querySelectorAll('.genRow').forEach(el=>{el.style.display=c.genOn?'':'none';});
 const I=inv(),ok=chgA(I)>0;
 $('genNote').textContent=!c.genOn?'':(!ok?'This inverter has no charger or AC input, so the generator can\'t connect. Pick a MultiPlus-II.':
  'Honda EU2200i: recoil start, not automatic. Manual mode requires you to press Start. Attended mode assumes a person always starts/stops it at the selected thresholds; this is NOT unattended backup. Up to '+c.genFuel+' gallons are available for this run; actual fuel remaining '+S.genFuelLeft.toFixed(2)+' gallons. 0.95-gallon physical tank requires refills. Model assumes refueling is possible without stopping; delays, maintenance and transfer wiring are NOT simulated. Fuel curve is estimated from Honda runtimes. Charger up to '+chgA(I)+' A with assumed 90% efficiency.'+(I.split?' A 120 V generator feeds one unit of the split-phase pair, so it covers leg L1 only and can\'t run 240 V loads.':''));
}
function wireV8Controls(){
 document.querySelectorAll('.hor').forEach(el=>{el.onchange=e=>{const i=+e.target.dataset.i;const v=clampInt(e.target.value,0,60);S.cfg.hor=S.cfg.hor.slice();S.cfg.hor[i]=v;e.target.value=v;log('Horizon toward '+['N','NE','E','SE','S','SW','W','NW'][i]+' set to '+v+'°.');cfgChanged(true);};});
 $('snowRec').onchange=e=>{S.cfg.snowRec=e.target.value==='1';log('Recorded snow on the panels '+(S.cfg.snowRec?'on':'off')+'.');cfgChanged(true);};
 $('reserve').oninput=e=>{$('reserveV').textContent=e.target.value+'%';};
 $('reserve').onchange=e=>{S.cfg.reserve=clampInt(e.target.value,0,80);log('Battery reserve set to '+S.cfg.reserve+'%.');cfgChanged(true);};
 $('genOn').onchange=e=>{S.cfg.genOn=e.target.value==='1';S.genRun=false;S.genFuelLeft=S.cfg.genFuel;log(S.cfg.genOn?'Generator enabled: manual start and finite fuel.':'Generator removed.');cfgChanged(true);};
 $('genMode').onchange=e=>{S.cfg.genMode=e.target.value==='attended'?'attended':'manual';S.genRun=false;log(S.cfg.genMode==='attended'?'Operator-attended start/stop assumed for the scenario.':'Manual recoil start required.');cfgChanged(true);};
 $('genFuel').onchange=e=>{S.cfg.genFuel=Math.max(0,Math.min(500,Number(e.target.value)||0));S.genFuelLeft=S.cfg.genFuel;S.genRun=false;log('Fuel inventory reset to '+S.genFuelLeft.toFixed(2)+' gal; current generator run stopped.');cfgChanged(true);};
 $('genManual').onclick=()=>{if(S.cfg.genMode!=='manual'||!S.cfg.genOn||chgA(inv())<=0)return;if(S.genRun){S.genRun=false;log('Manual generator stop simulated.');}else if(S.genFuelLeft>=genGph(0)/60){S.genRun=true;S.stats.genStarts=(S.stats.genStarts||0)+1;log('Manual recoil start simulated.');}cfgChanged(true);};
 $('genStart').oninput=e=>{$('genStartV').textContent=e.target.value+'%';};$('genStop').oninput=e=>{$('genStopV').textContent=e.target.value+'%';};
 $('genStart').onchange=e=>{S.cfg.genStart=clampInt(e.target.value,5,90);if(S.cfg.genStop<=S.cfg.genStart)S.cfg.genStop=Math.min(100,S.cfg.genStart+10);cfgChanged(true);};
 $('genStop').onchange=e=>{S.cfg.genStop=clampInt(e.target.value,10,100);if(S.cfg.genStop<=S.cfg.genStart)S.cfg.genStart=Math.max(5,S.cfg.genStop-10);cfgChanged(true);};
}
function clampInt(v,a,b){v=Math.round(Number(v)||a);return Math.max(a,Math.min(b,v));}
function setPlaying(p){S.playing=p;$('play').textContent=p?'Pause':'Play';last=performance.now();}
let last=performance.now(),acc=0,dashT=0;
function frame(now){
 const dt=Math.min(0.25,(now-last)/1000);last=now;
 if(S.playing){acc+=dt*Number($('speed').value);let n=Math.floor(acc);acc-=n;n=Math.min(n,3000);for(let i=0;i<n&&S.playing;i++)step();if(n>0){render();if(Math.floor(now/400)!==Math.floor((now-dt*1000)/400)){renderScore();renderChart();}}}
 dashT+=dt;for(const id of ['fPV','fMB','fBat','fInv','fAC']){const p=$(id);if(p&&p._v){p._o=(p._o||0)-p._v*dt;p.style.strokeDashoffset=p._o;}}
 requestAnimationFrame(frame);
}
function init(){
 syncInputs();buildArray();buildBank();buildAppl();renderLoads();renderMissions();
 const st=$('stars');for(let i=0;i<40;i++)el('circle',{cx:(i*137)%600,cy:(i*53)%280,r:1.2,fill:'#fff'},st);
 const jm=$('jumpM');jm.innerHTML=MONTHS.map((m,i)=>'<option value="'+i+'">'+m+'</option>').join('');jm.value=9;$('jumpD').value=30;
 const jh=$('jumpH');let o='';for(let h=0;h<24;h++){const ap=h<12?'am':'pm';o+='<option value="'+h+'">'+((h%12)||12)+' '+ap+'</option>';}jh.innerHTML=o;jh.value=6;
 $('ptype').innerHTML=PANELS.map(p=>'<option value="'+p.id+'">'+p.short+' — '+money(Math.min(...p.tiers.map(t=>t[1]/t[0])))+' each</option>').join('');
 $('btype').innerHTML=BATTS.map(b=>'<option value="'+b.id+'">'+b.short+' — '+money(b.tiers[0][1]/b.tiers[0][0])+'</option>').join('');
 $('ptype').onchange=e=>setPanelType(e.target.value);$('btype').onchange=e=>setBattType(e.target.value);
 $('otherCost').onchange=e=>{S.cfg.other=Math.max(0,Math.min(50000,Math.round(Number(e.target.value)||0)));e.target.value=S.cfg.other;renderCost();};
 $('qCost').onclick=()=>{document.querySelector('.tabs button[data-tab=build]').click();$('costTop').scrollIntoView({behavior:'smooth',block:'start'});};
 renderPartsList();syncInputs();
 document.querySelectorAll('#sysV button').forEach(b=>b.onclick=()=>{if(b.disabled)return;S.cfg.sysV=Number(b.dataset.v);S.lastI=0;cfgChanged(true,true);});
 $('ser').onchange=e=>{S.cfg.ser=clampInt(e.target.value,1,10);cfgChanged(true,true);};
 $('par').onchange=e=>{S.cfg.par=clampInt(e.target.value,1,8);cfgChanged(true,true);};
 $('shade').oninput=e=>{S.cfg.shade=Number(e.target.value);cfgChanged(false);};
 $('mppt').onchange=e=>{S.cfg.mppt=e.target.value;cfgChanged(false,true);};
 $('nMppt').onchange=e=>{S.cfg.nMppt=clampInt(e.target.value,1,4);cfgChanged(false,true);};
 $('bpar').onchange=e=>{const old=S.cfg.bpar;S.cfg.bpar=clampInt(e.target.value,1,BATT.maxPar);if(S.cfg.bpar!==old)log('Battery bank now '+nSer()+'S × '+S.cfg.bpar+'P. New batteries join at the same charge.');S.lastI=0;cfgChanged(true);};
 $('bloc').onchange=e=>{S.cfg.bloc=e.target.value;cfgChanged(false);};
 $('soh').oninput=e=>{$('sohV').textContent=e.target.value+'%';};wireV8Controls();
 $('soh').onchange=e=>{S.cfg.soh=clampInt(e.target.value,50,100);log('Battery health set to '+S.cfg.soh+'%.');cfgChanged(true);};
 $('heatSpeed').onchange=e=>{const v=e.target.value;S.cfg.heatSpeed=['fast','mid','slow'].includes(v)?v:'mid';cfgChanged(false);};
 const optNum=(v,a,b)=>{if(v===''||v==null)return null;const x=Number(v);return isFinite(x)?Math.round(Math.max(a,Math.min(b,x))):null;};
 $('ambF').onchange=e=>{S.cfg.ambF=optNum(e.target.value,-40,160);e.target.value=S.cfg.ambF==null?'':S.cfg.ambF;cfgChanged(false);};
 $('ccc').onchange=e=>{S.cfg.ccc=optNum(e.target.value,1,50);e.target.value=S.cfg.ccc==null?'':S.cfg.ccc;cfgChanged(false);};
 $('insC').onchange=e=>{const v=Number(e.target.value);S.cfg.insC=[60,75,90].includes(v)?v:null;cfgChanged(false);};
 $('termC').onchange=e=>{const v=Number(e.target.value);S.cfg.termC=[60,75,90].includes(v)?v:null;cfgChanged(false);};
 $('inv').onchange=e=>{S.cfg.inv=e.target.value;S.invTrip=false;S.invLow=false;cfgChanged(false);};
 $('cold').oninput=e=>{S.cfg.coldF=Number(e.target.value);$('coldV').textContent=S.cfg.coldF+'°F';renderChecks();};
 $('tilt').oninput=e=>{$('tiltV').textContent=e.target.value+'°';};
 $('tilt').onchange=e=>{S.cfg.tilt=clampInt(e.target.value,0,90);log('Panel tilt set to '+S.cfg.tilt+'°.');cfgChanged(false);};
 $('az').oninput=e=>{const a=Number(e.target.value);$('azV').textContent=a+'° '+compass(a);};
 $('az').onchange=e=>{S.cfg.az=clampInt(e.target.value,90,270);log('Panels now face '+S.cfg.az+'° ('+compass(S.cfg.az)+').');cfgChanged(false);};
 $('mount').onchange=e=>{const v=e.target.value;S.cfg.mount=['open','roof','glued'].includes(v)?v:'auto';cfgChanged(false);};
 $('bifOn').onchange=e=>{S.cfg.bifOn=e.target.value==='1';log(S.cfg.bifOn?'Counting rear-side gain (estimate).':'Rear-side gain off.');cfgChanged(false);};
 ['pv','cb','bi'].forEach(k=>{['Mat','G','Ft'].forEach(f=>{$(k+f).onchange=()=>wireChanged(k);});});
 $('myLongiB').onclick=useMyLongi;$('saveB').onclick=saveLocal;$('loadB').onclick=loadLocal;$('exportB').onclick=exportBuild;
 $('saveSB').onclick=saveStateLocal;$('loadSB').onclick=loadStateLocal;$('exportSB').onclick=exportState;
 $('importSB').onclick=()=>{$('importSF').value='';$('importSF').click();};$('importSF').onchange=e=>importState(e.target.files[0]);
 $('importB').onclick=()=>{$('importF').value='';$('importF').click();};$('importF').onchange=e=>importBuild(e.target.files[0]);
 renderSources();
 $('play').onclick=()=>setPlaying(!S.playing);
 $('step').onclick=()=>{for(let i=0;i<60;i++)step();renderAll();};
 $('snow').onclick=()=>{S.snow=1;log('Snowstorm: the panels are buried.',true);refreshLive();};
 $('brush').onclick=()=>{if(S.snow>0){S.snow=0;log('You brushed the snow off the panels.');}refreshLive();};
 $('blast').onclick=()=>{S.blastUntil=(S.t+36*60)%YEARMIN;if(S.blastUntil<S.t)S.blastUntil=S.t+36*60;log('Arctic blast: 27°F colder than normal for 36 hours.',true);refreshLive();};
 $('jump').onclick=()=>{const m=Number($('jumpM').value);const d=Math.max(1,Math.min(MDAYS[m],Number($('jumpD').value)||1));$('jumpD').value=d;S.t=(MSTART[m]+d-1)*1440+Number($('jumpH').value)*60;S.blastUntil=-1;S.hist=[];S.day=newDay();if(S.mission){S.mission=null;S.missionEnd=null;REMAP=null;log('Jumped dates: mission abandoned.');restoreLoads();}log('Jumped to '+dateStr(S.t)+'.');afterLoadChange(true);};
 $('recharge').onclick=()=>{S.soc=1;S.invLow=false;log('Battery refilled to 100% (cheat: a generator top-up).');refreshLive();};
 $('faults').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='rInv'){S.invTrip=false;S.overMin=0;S.ovl=0;log('Inverter reset.');}
  if(b.id==='rBms'){S.bmsTrip=false;log('Battery BMS reset.');}
  if(b.id==='rMppt'){S.mpptDead=false;log('Controller replaced. Fix the layout first, or it burns out again.');}
  if(b.id==='tPv')togglePv();
  if(b.id==='tInv'){S.invOn=!S.invOn;log(S.invOn?'Inverter switched on.':'Inverter switched off: no idle draw, no AC power.');}
  refreshLive();});
 document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{const q=b.dataset.q;if(q==='p+')stepPanels(1);if(q==='p-')stepPanels(-1);if(q==='b+')stepBatts(1);if(q==='b-')stepBatts(-1);}));
 $('qLoads').onclick=()=>{document.querySelector('.tabs button[data-tab=loads]').click();$('loadsTop').scrollIntoView({behavior:'smooth',block:'start'});};
 $('discBox').addEventListener('click',togglePv);
 const as=$('addSel');const groups=[...new Set(PRESETS.map(p=>p.g))];
 as.innerHTML=groups.map(g=>'<optgroup label="'+g+'">'+PRESETS.map((p,i)=>p.g!==g?'':'<option value="'+i+'">'+p.name+' — '+presetTag(p)+'</option>').join('')+'</optgroup>').join('');
 as.value='2';const showInfo=()=>{const p=PRESETS[Number(as.value)];const e=$('addInfo');e.textContent=p.basis+' ';if(p.src){const x=document.createElement('a');x.href=p.src;x.target='_blank';x.rel='noopener';x.textContent='Source';e.appendChild(x);}};
 as.addEventListener('change',showInfo);showInfo();
 $('addBtn').onclick=()=>addLoad(Number(as.value));
 $('allOff').onclick=()=>{S.loads.forEach(l=>{l.mode='off';updateCard(l);});log('Every appliance switched off.');afterLoadChange(true);};
 $('resetLoads').onclick=()=>{S.loads=DEFAULT_LOADS.map(cloneLoad);S.savedLoads=null;buildAppl();renderLoads();log('Back to the starting appliance list.');};
 window.addEventListener('resize',()=>{if($('pane-loads').classList.contains('on'))drawDay(dayProfile());});
 document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='pane-'+b.dataset.tab));if(b.dataset.tab==='score'){renderScore();renderChart();}if(b.dataset.tab==='loads')drawDay(dayProfile());});
 log('Ready. Starting Oct 30 at 6 am with a full battery. Press Play.');
 refreshLive();
 requestAnimationFrame(frame);
}
// test hooks
window.SIM={runAging,ageSoh,ageEfcLife,AGE_DATA,get AGE_LAST(){return AGE_LAST;},sohF,get WXNOW(){return WX;},get PANELNOW(){return PANEL;},mountUsed,poaDaily,buildHistWX,endMission,WX_TMY,S,buildStatePayload,applyState,cleanState,makeMission,setWeather,wxId:()=>WXID,findWorstStretch,runFailureRates,summarizeRuns,grabState,putState,HIST_YEARS,BATTMODEL,ELEC,wiringReport,step,checks,startMission,MISSIONS,MPPTS,INVS,capWh,dailyLoadWh,dayProfile,cfgChanged,syncInputs,refreshLive,setPlaying,loadOn,arrangeFor,stepPanels,stepBatts,addLoad,PRESETS,DEFAULT_LOADS,restoreLoads,togglePv,renderLoads,PANELS,BATTS,buyCost,costLines,totalCost,setPanelType,setBattType,chgMin,chgWh,nSer,usableWh,wiringReport,pvHourly,buildPayload,applyPayload,saveLocal,loadLocal,mountUsed,WX,PHYS,INV_DS:INVS,get REMAP(){return REMAP;},get PANEL(){return PANEL;},get BATT(){return BATT;},useMyLongi,compatRows,ctlShares,HIST_COLD_F,GEN_DS,genGph};
init();
})();

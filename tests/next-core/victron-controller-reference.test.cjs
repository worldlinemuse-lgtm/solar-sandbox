"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {assessVictron15070Point}=require(path.resolve(
 __dirname,"../../.next-core-dist/victron-controller-reference.js"));
const base={termination:"MC4_TWO_PAIRS",mode:"starting",batteryBusVoltageV:26.4,
 pvInputPortVoltageV:31.4,maximumColdDesignVocV:112,
 maximumDesignIscA:25,mc4PairDesignIscA:[12,13]};
test("Victron published start needs Vbat+5V, continuing charge only Vbat+1V",()=>{
 const initial=assessVictron15070Point(base);
 assert.equal(initial.status,"checked_ratings_only");
 assert.equal(initial.minimumPvOperatingVoltageV,31.4);
 assert.equal(initial.maximumBatteryPortPowerEnvelopeW,26.4*70);
 const low={...base,pvInputPortVoltageV:28.4};
 assert.equal(assessVictron15070Point(low).status,"fail");
 const running=assessVictron15070Point({...low,mode:"charging"});
 assert.equal(running.status,"checked_ratings_only");
 assert.equal(running.minimumPvOperatingVoltageV,27.4);
});
test("cold Voc and per-MC4 connector limits are independent from total array Isc",()=>{
 const v148=assessVictron15070Point({...base,maximumColdDesignVocV:148});
 assert.equal(v148.status,"fail");
 assert.ok(v148.absoluteVocMarginV>0);
 assert.ok(v148.operatingVocMarginV<0);
 const current=assessVictron15070Point({...base,maximumDesignIscA:40,
  mc4PairDesignIscA:[32,8]});
 assert.equal(current.status,"fail");
 assert.equal(current.totalIscMarginA,10);
 assert.deepEqual(current.mc4PairCurrentMarginsA,[-2,22]);
 const aggregate=assessVictron15070Point({...base,maximumDesignIscA:52,
  mc4PairDesignIscA:[26,26]});
 assert.equal(aggregate.status,"fail");
 assert.equal(aggregate.totalIscMarginA,-2);
});
test("missing design Voc or unknown MC4 distribution stays indeterminate",()=>{
 assert.equal(assessVictron15070Point({...base,maximumColdDesignVocV:null}).status,
  "indeterminate");
 assert.equal(assessVictron15070Point({...base,mc4PairDesignIscA:null}).status,
  "indeterminate");
 const tr=assessVictron15070Point({...base,termination:"TR_SCREW_TERMINALS",
  mc4PairDesignIscA:null});
 assert.equal(tr.status,"checked_ratings_only");
 assert.equal(tr.mc4PairCurrentMarginsA,null);
});
test("refuse fabricated MC4 current allocations and invalid nameplate variants",()=>{
 assert.throws(()=>assessVictron15070Point({...base,mc4PairDesignIscA:[15]}),/two input/);
 assert.throws(()=>assessVictron15070Point({...base,mc4PairDesignIscA:[12,14]}),/inconsistent/);
 assert.throws(()=>assessVictron15070Point({...base,batteryBusVoltageV:-10}),/exceed zero/);
});

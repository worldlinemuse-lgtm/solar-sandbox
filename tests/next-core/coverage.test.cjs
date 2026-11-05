"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const doc=JSON.parse(fs.readFileSync(path.join(root,"validation/next-core/coverage.json"),"utf8"));
const {REQUIRED_CI_EVIDENCE,assessReadiness,assertNoUnsupportedActivation}
  =require("../../scripts/release-gates.cjs");
const clone=x=>JSON.parse(JSON.stringify(x));
const allEvidence=Object.fromEntries(REQUIRED_CI_EVIDENCE.map(k=>[k,true]));

test("engineering requirements have valid, unique statuses and internally consistent counts",()=>{
 assert.equal(doc.schema,1);
 assert.ok(doc.requirements.length>=40);
 const ids=doc.requirements.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const x of doc.requirements){
   assert.ok(["implemented","partial","blocked"].includes(x.status),x.id);
   assert.ok(x.description.length>15,x.id);
 }
 assert.equal(doc.completedCount,doc.requirements.filter(x=>x.status==="implemented").length);
 assert.equal(doc.totalCount,doc.requirements.length);
});

test("actual current manifest cannot claim the new core, planner, or optimizer ready",()=>{
 const assessment=assertNoUnsupportedActivation(doc);
 assert.equal(assessment.coreReady,false);
 assert.ok(assessment.unresolvedCoreRequirements.length>0);
 assert.ok(assessment.missingCiEvidence.length>0);
 assert.equal(doc.releaseGates.nextCoreCanReplaceLiveEngine,false);
 assert.equal(doc.releaseGates.householdPlannerEnabled,false);
 assert.equal(doc.releaseGates.optimizerEnabled,false);
 assert.equal(doc.releaseGates.shadowModeIntegrated,true);
});

test("E0-E2 readiness CAN be satisfied without optional E3 measurements or code certification",()=>{
 const hypothetical=clone(doc);
 for(const r of hypothetical.requirements){
   if(r.category==="engineering_math" && 
      !["whole_system_measured","grounding_certification"].includes(r.id))
     r.status="implemented";
   if(["new_core_result_provenance","catalog_variant_audit",
       "mathematical_output_provenance","reproducible_randomness"].includes(r.id))
     r.status="implemented";
 }
 hypothetical.requirements.find(r=>r.id==="whole_system_measured").status="blocked";
 hypothetical.requirements.find(r=>r.id==="grounding_certification").status="blocked";
 hypothetical.completedCount=hypothetical.requirements.filter(r=>r.status==="implemented").length;
 const result=assessReadiness(hypothetical,allEvidence);
 assert.equal(result.coreReady,true);
 assert.equal(result.plannerReady,false);
 assert.equal(result.optimizerReady,false);
 assert.deepEqual(result.unresolvedCoreRequirements,[]);
 assert.ok(result.optionalNotGating.includes("whole_system_measured"));
 assert.ok(result.optionalNotGating.includes("grounding_certification"));
});

test("missing weather-time verification or any new mandatory physics blocks readiness",()=>{
 const hypot=clone(doc);
 for(const r of hypot.requirements)
   if(r.category==="engineering_math" &&
       !["whole_system_measured","grounding_certification"].includes(r.id) ||
      ["new_core_result_provenance","catalog_variant_audit",
       "mathematical_output_provenance","reproducible_randomness"].includes(r.id))
     r.status="implemented";
 hypot.requirements.find(r=>r.id==="weather_clock_validation").status="blocked";
 const blocked=assessReadiness(hypot,allEvidence);
 assert.equal(blocked.coreReady,false);
 assert.ok(blocked.unresolvedCoreRequirements.includes("weather_clock_validation"));
 hypot.requirements.find(r=>r.id==="weather_clock_validation").status="implemented";
 hypot.requirements.push({id:"new_mandatory_physics",category:"engineering_math",status:"partial",description:"Not yet proven"});
 assert.ok(assessReadiness(hypot,allEvidence).unresolvedCoreRequirements.includes("new_mandatory_physics"));
});

test("unattested CI always blocks readiness even if every mathematical requirement is marked implemented",()=>{
 const hypot=clone(doc);
 for(const r of hypot.requirements){
   if(r.category==="engineering_math" &&
      !["whole_system_measured","grounding_certification"].includes(r.id) ||
      ["new_core_result_provenance","catalog_variant_audit",
       "mathematical_output_provenance","reproducible_randomness"].includes(r.id))
      r.status="implemented";
 }
 const r=assessReadiness(hypot,{typed_core:true});
 assert.equal(r.coreReady,false);
 assert.ok(r.missingCiEvidence.includes("chronological_e2"));
});

test("planner and optimizer depend on proven core and their own readiness",()=>{
 const hypot=clone(doc);
 for(const r of hypot.requirements){
   if(r.category==="engineering_math" &&
     !["whole_system_measured","grounding_certification"].includes(r.id) ||
     ["new_core_result_provenance","catalog_variant_audit",
     "mathematical_output_provenance","reproducible_randomness"].includes(r.id))
     r.status="implemented";
 }
 hypot.requirements.find(r=>r.id==="household_load_planner").status="implemented";
 assert.equal(assessReadiness(hypot,allEvidence).plannerReady,true);
 assert.equal(assessReadiness(hypot,allEvidence).optimizerReady,false);
 for(const id of ["system_optimizer","ranking_completeness","price_cost_audit"])
   hypot.requirements.find(r=>r.id===id).status="implemented";
 assert.equal(assessReadiness(hypot,allEvidence).optimizerReady,true);
});

test("no release flag may be enabled on an unproven manifest",()=>{
 for(const flag of ["nextCoreCanReplaceLiveEngine","householdPlannerEnabled","optimizerEnabled"]){
   const changed=clone(doc);
   changed.releaseGates[flag]=true;
   assert.throws(()=>assertNoUnsupportedActivation(changed),/enabled without/);
 }
});

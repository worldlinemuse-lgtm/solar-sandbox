"use strict";
/**
 * Declarative engineering release-readiness analysis.
 *
 * Does not activate runtime features. A manifest saying "implemented" is only
 * a necessary condition; actual CI evidence must be externally attested by the
 * controlled build/release process. Tests use synthetic attestations ONLY to
 * verify the predicate. Never interpret this as safety certification.
 */
const EXCLUDED_FROM_MATHEMATICAL_RELEASE = new Set([
  "whole_system_measured", // E3 is optional, never a prerequisite for E0-E2.
  "grounding_certification" // An engineering model cannot certify an installation.
]);
const REQUIRED_CONTROL_IDS = Object.freeze([
  "new_core_result_provenance",
  "catalog_variant_audit",
  "mathematical_output_provenance",
  "reproducible_randomness"
]);
const REQUIRED_CI_EVIDENCE = Object.freeze([
  "typed_core",
  "independent_numerical",
  "published_reference",
  "chronological_e2",
  "browser_integration",
  "reproducible_bundle"
]);

function assertManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.requirements) ||
      !manifest.releaseGates || typeof manifest.releaseGates !== "object") {
    throw new TypeError("Expected a coverage manifest with requirements and releaseGates");
  }
  const ids = manifest.requirements.map(r => r.id);
  if (new Set(ids).size !== ids.length) throw new TypeError("Duplicate coverage requirement ID");
  if (manifest.requirements.some(r => !r.id || !["implemented", "partial", "blocked"].includes(r.status)))
    throw new TypeError("Invalid coverage requirement");
  const known = new Set(ids);
  for (const id of REQUIRED_CONTROL_IDS) {
    if (!known.has(id)) throw new TypeError("Missing mandatory control: " + id);
  }
}

function assessReadiness(manifest, ciEvidence = {}) {
  assertManifest(manifest);
  const byId = new Map(manifest.requirements.map(r => [r.id, r]));
  const essential = manifest.requirements
    .filter(r => r.category === "engineering_math" && !EXCLUDED_FROM_MATHEMATICAL_RELEASE.has(r.id))
    .map(r => r.id)
    .concat(REQUIRED_CONTROL_IDS);
  const unresolved = essential.filter(id => byId.get(id).status !== "implemented");
  const unattested = REQUIRED_CI_EVIDENCE.filter(id => ciEvidence[id] !== true);
  const coreReady = unresolved.length === 0 && unattested.length === 0;

  const plannerUnresolved = ["household_load_planner"]
    .filter(id => byId.get(id)?.status !== "implemented");
  const plannerReady = coreReady && plannerUnresolved.length === 0;
  const optimizerUnresolved = ["system_optimizer", "ranking_completeness", "price_cost_audit"]
    .filter(id => byId.get(id)?.status !== "implemented");
  const optimizerReady = plannerReady && optimizerUnresolved.length === 0;

  return Object.freeze({
    coreReady, plannerReady, optimizerReady,
    unresolvedCoreRequirements: Object.freeze(unresolved),
    missingCiEvidence: Object.freeze(unattested),
    unresolvedPlannerRequirements: Object.freeze(plannerUnresolved),
    unresolvedOptimizerRequirements: Object.freeze(optimizerUnresolved),
    optionalNotGating: Object.freeze([...EXCLUDED_FROM_MATHEMATICAL_RELEASE]),
    interpretation: "Necessary source/coverage + externally attested CI conditions; not installation certification or field-calibrated prediction"
  });
}

function assertNoUnsupportedActivation(manifest, ciEvidence = {}) {
  const v = assessReadiness(manifest, ciEvidence);
  const flags = manifest.releaseGates;
  if (flags.nextCoreCanReplaceLiveEngine && !v.coreReady)
    throw new Error("Live engine enabled without E0-E2 requirements and CI evidence");
  if (flags.householdPlannerEnabled && !v.plannerReady)
    throw new Error("Planner enabled without engineering and planner evidence");
  if (flags.optimizerEnabled && !v.optimizerReady)
    throw new Error("Optimizer enabled without engineering, planner and optimizer evidence");
  return v;
}
module.exports = {
  EXCLUDED_FROM_MATHEMATICAL_RELEASE, REQUIRED_CONTROL_IDS,
  REQUIRED_CI_EVIDENCE, assessReadiness, assertNoUnsupportedActivation
};

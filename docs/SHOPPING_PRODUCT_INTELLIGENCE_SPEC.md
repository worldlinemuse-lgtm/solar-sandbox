# Solar Sandbox — Product Intelligence, Shopping, and Recommendation Architecture
Status: ENGINEERING SPECIFICATION / NOT YET IMPLEMENTED
Date: 2026-11-07
Owner: Solar Sandbox product engineering
Related: docs/ENGINEERING_EXECUTION_PLAN.md and validation/next-core/coverage.json

## 1. Core product requirement

Solar Sandbox is simultaneously (A) a mathematically defensible PV/storage energy simulator and (B) a real-world buying and system-design assistant. Neither is a decorative feature of the other. A recommendation is valuable only when it refers to an identifiable, purchasable, appropriately compatible product with an honest price and clear performance/uncertainty evidence.

The product must answer separate questions:
1. **Identity:** What exact model/variant/revision is this? Does the item actually exist?
2. **Spec truth:** What does its manufacturer publish, and under what test conditions?
3. **Physical feasibility:** Can these exact variants work together in the proposed topology? What remains not verified for installation?
4. **Prediction:** What outputs should this particular system produce under explicitly stated scenarios, within the supported model domain?
5. **Commerce:** Which merchant is offering which exact SKU/pack, at what price, quantity, time, destination, and shipping conditions?
6. **Purchase completeness:** What else must be purchased, installed or inspected before the proposed assembly can be usable?
7. **Comparison:** Given a specified household goal and budget, which options are feasible, available, transparently priced, and better under a stated objective?

Failure in an early layer must not be repaired by fabricated data in a later layer. Do not claim live offers from cached examples. Do not claim a simulator-supported arrangement is installation certified.

## 2. Source-of-truth decomposition

The current legacy source/sim.js embeds component identity, specification, URLs and prices together (including dates October 30–31, 2026). That is a valid historical fixture but an inadequate live shopping database.

Separate four independently versioned stores:

### 2.1 Canonical ProductIdentity
Fields: internal product ID; manufacturer; manufacturer part number (MPN); full model/variant; electrical region (e.g., 120 V US versus 230 V EU); exact connector/port revision; product type; lifecycle state; image and manual URL; last manufacturer-verification time; manufacturer evidence IDs; revision history and aliases.

Do NOT merge products based only on approximate names ("150/70", "100 Ah LiFePO4", "5 kVA MultiPlus"). Distinguish model revision, firmware-dependent functionality, input voltage, terminal style, chemistry, low-temp BMS/heating option, connector and regional variants. EAN/UPC/GTIN and seller SKU are useful cross-references, NOT interchangeable with MPN.

### 2.2 EngineeringSpec and evidence-per-claim
Fields: product ID and spec revision; manufacturer datasheet/manual revision; property -> numeric quantity + unit + test conditions + limits + source URL + document timestamp + extraction/verification date + evidence hash + evidence class + review state.

Critical claims require separate evidence: electrical ratings W vs VA; continuous/peak/duration; output waveform and split-phase; PV STC Voc/Isc/Vmp/Imp and temperature coefficients; MPPT startup/run, per-input Isc, efficiency envelope and battery voltage; battery Ah/Wh, charge/discharge current, BMS and temperature limits, max series/parallel, warranty cycles under specified test conditions; generator running/peak W, AC output interface, fuel anchors; wire insulation, gauge, ampacity and ambient limits; fuse/DC interrupt ratings and terminals.

Confidence labels must distinguish:
- manufacturer_published_exact_variant
- independent_test_same_variant
- mathematically_derived
- manufacturer_family_only
- third_party_unverified
- scenario_assumption
- unknown_or_conflicting

A manufacturer's marketing claim without test conditions is not automatically a usable engineering model. Conflicting source documents create an explicit hold/review queue rather than a silent overwrite.

### 2.3 MerchantOffer (mutable commerce data, NEVER governing physics)
Fields: offer ID; product ID; merchant legal/site name; retailer SKU; exact product-page URL; currency; unit price; pack contents and quantity; minimum order quantity; condition (new/refurbished/used); regional shipping eligibility; stock state; stock source/status; quotation timestamp; verification method; quoted shipping or unknown; taxes or unknown; discount/coupon eligibility; expiration; seller return/warranty restrictions; source URL and evidence/response fingerprint.

Statuses: verified_current_at_time, previously_verified_expired, retailer_estimate, user_owned_purchase, user_entered_unverified, out_of_stock, unavailable, quote_required, unknown. All timestamps must be shown. A listing that cannot be matched to the exact manufacturer variant cannot silently enter the cheapest-feasible comparison.

**Current offer is a claim with a freshness window, not a permanent property of a product.** Availability may vary by zip code, delivery method and quantity. Only assert stock when the seller or authorized commerce source provides it for the relevant destination/quantity. If it is not available, say "availability unverified."

### 2.4 SystemPart/BOM/Compatibility
Required component counts, variant constraints, electrical port and rail compatibility, supported connectivities, protection, mounting and labor/permitting unknowns. Each BOM item references a canonical ProductIdentity, a feasible model configuration and optionally a concrete MerchantOffer. Keep physics BOM feasible even when offers are missing; shopping status becomes "not fully quoted" rather than forcing invented prices.

## 3. Four independent statuses in shopper-facing output

Never collapse these into one vague "verified" check:
1. **Specification:** exact sourced / partially sourced / conflicting / unknown.
2. **Electrical compatibility:** modeled feasible / known incompatible / incomplete verification / not evaluated.
3. **Price:** time-stamped quoted / historical / estimated / unknown.
4. **Availability:** observed in stock at time/region / out of stock / seller quote / unverified.

Represent simulation evidence separately: validated model in supported domain / bounded engineering estimate / exploratory assumption / indeterminate. Display installation compliance separately as "not certified" unless separately established by authorized professionals.

## 4. Source ingestion and commerce refresh architecture

The present product is a deterministic single-file GitHub Pages/PWA application. It cannot truthfully promise automatic live inventory checks from static JavaScript alone. Many retailers restrict scraping, do not allow arbitrary cross-origin browser requests, or give location-dependent offers.

Implement a two-lane architecture:
- **Offline lane:** deterministic, versioned product/specification snapshot and last-known offer snapshots, bundled or stored as additional versioned application data; clear "last verified" indicators and stale/unknown flags. All engineering calculations work offline; no offer is described as live just because it is bundled.
- **Online lane:** optional user-invoked refresh, using lawful merchant APIs/feeds/approved partners or a supported commerce service with stable identity matching. Do not invent a retailer connection or assume scraping/CORS support. The refresh writes a time-stamped offer cache; invalid responses never overwrite the previous verified artifact without an audit trail.

Each refresh pipeline must: discover merchant -> fetch authorized offer -> match exact variant -> normalize pack/currency/tax/condition -> validate plausibility -> record timestamp/provenance -> keep conflicting offers separate -> mark expiration based on source policy -> present. A canceled request, failed source, 404 or mismatch is "unverified/unavailable" and must not be shown as "current."

Review terms, attribution, pricing/currency regions, data access and any commercial/affiliate relationship before integrating retailer sources. An affiliate link, if later introduced, cannot influence safety or evidence rankings without conspicuous disclosure and separation from objectives.

## 5. Landed total cost, not only sum of visible hardware prices

Compute prices as constrained offers, quantity and packs:
- Exact required pieces and required purchase pack count per seller.
- Owned inventory counted as owned at stated quantity, NOT as a recurring current purchase price. For existing four LONGi panels, four may be marked owned, whereas fifth+ need a separate verified new quote or remain unpriced.
- Cash required now = incremental required items after owned inventory + eligible shipping/freight + applicable sales tax + required balance-of-system supplies + installation/inspection/permit estimates where relevant. Separate paid historical cost from additional cash needed.
- Include known necessary components beyond main modules: MPPT, battery and inverter; wiring and returns, correctly rated connectors/combiner, disconnects, fuses/breakers with DC interrupt rating, grounding/bonding analysis, distribution, mounts, weatherproof enclosures, monitoring and transfer equipment; flag unknown scope/certification.
- Distinguish optional accessories and mandatory dependencies.
- Do not treat a manufacturer product-family listing as a live seller offer.
- Where tax, freight, labor or installation constraints are not determined, report a **partial priced subtotal and missing line items**. Never label it total turnkey cost or imply the total is a reliable lower bound without proving all listed nonnegative obligations.

Pack optimization must use availability, order constraints, merchant eligibility, offer expiry, returns, compatible variants, and offer quantity. Use exact currency arithmetic (decimal/integer cents, not uncontrolled floating-point totals). Multi-offer solver should not combine incompatible region/condition SKUs.

Cost efficiency metrics:
- $/rated W for PV; $/usable stored kWh under declared reserve/efficiency assumptions; delivered $/critical-load Wh for scenarios; $/autonomy day with stated weather/load scenario and model revision.
- A low $/W is not equivalent to a best overall system. Reliability, safety, shipping, warranty, usable energy, and installation availability can dominate.
- Dates, availability, and pricing coverage accompany every metric.

## 6. Compatibility as a product knowledge graph

Build on source/next-core/math/topology.ts, but distinguish structural checks from validated installation/code design.

Typed parts/ports/edges should encode: rated voltage windows, phase, frequency, current/short-circuit ratings, maximum series/parallel, communication interfaces if required, connection mating type, temperature limits, cable terminal limits, physical envelope and mounting constraints, DC disconnect/protection requirements, and installation jurisdiction unknowns.

A feasibility predicate returns:
- FAIL: exact hard violation (e.g., controller max Voc exceeded at required design cold extreme, 48 V-only battery attached to 24 V bank, unsupported AC split-phase).
- INDETERMINATE: missing exact model or needed protection specification, no terminal data, unknown current rating, no proven behavior.
- PASS_MODELLED: all **modeled** constraints satisfied, with explicit residual installation checks and no code certification.

Citations should appear beside individual warnings rather than as a generic sources list.

## 7. Shopper interaction and decision workflow

Start with goal and constraints, NOT a brand-driven catalog:
1. Buyer specifies use case: backup for essentials, home off-grid, RV/portable power, upgrading owned panels, hobby system, budget, target loads and required output voltage/region.
2. App shows a short list of applicable **real** product variants. Unknown variants must be labeled and cannot silently replace verified products.
3. App builds physically compatible candidate assemblies using existing equipment/owned inventory.
4. Model computes performance only for the subset with supported physics; unsupported candidates can still be shown as unmodeled products but not assigned fabricated autonomy hours.
5. Merchant layer attaches exact current/expired/unknown offers and estimates cash required including missing items.
6. Compare candidates on declared objectives: feasibility, cost-now, modeled reliability, warranty, portability, upgrade path, vendor availability; present nondominated options and the rationale for rejection.
7. Show "Why this product", "What doesn't fit", "What is missing", "Source/spec verified on", and "Buy at seller" links. Do not claim in-stock or completed checkout from an ordinary link.
8. Save/export a reproducible dated shopping list and compatible design snapshot with provenance IDs; warn before stale-data-driven purchase.

Shopping discovery/catalog/price transparency can ship **before** a fully validated home-run dispatch engine as long as predictions stay honestly restricted. A full physical-performance ranking and optimizer must wait for E0-E2 validated domain-specific solver evidence.

## 8. Evidence-gated shopper recommendation classes

**Informational listing:** exact identity sufficient; unverified attributes visibly marked; no performance assertion.
**Price comparison:** exact offer-to-variant match, current price and pack count, dated quotation, availability disclosed; incomplete offers shown separately.
**Compatibility-aware shortlist:** product claims and hard constraints verified; unknown code/hardware items acknowledged; no "safe to install" guarantee.
**Physically modeled recommendation:** feasibility plus model-domain match and E0/E1/E2 tests for relevant components and chronology.
**Automatic optimizer recommendation:** all of the above, complete objective and constraints, independent re-simulation of each proposed optimum and exact cost/source coverage. Unknowns may produce exploratory candidates only.

Avoid a single overall "confidence percentage" unless a calibrated empirical basis exists; expose which evidence tiers are missing instead.

## 9. Implementation packages and dependencies

### SHOP-00 — Existing catalog audit (start immediately; parallel with physics WP0/WP1)
Inspect source/sim.js arrays PANELS, MPPTS, INVS, BATTS, existing costLines/costSums/buyCost/renderCost and wiringReport/checks; trace each item to exact manufacturer MPN, hardware revision, specification evidence, merchant offer, price timestamp and stock source. Emit machine-readable findings with severity and cause. Flag ambiguous model names, VA/W mislabeled, unresolved family links, historical price as current, owned-versus-new price leakage and missing BOM parts.

Exit: every currently displayed catalog item has a mapped identity or "unverified variant" exception; every catalog price has dated type and known limitations; no inventory/stock claim without a source.

### SHOP-01 — Normalize schema without breaking current UI
Extract a versioned canonical product identity/spec catalog and separate offers from source/sim.js; add adapters to current UI selectors and tests for backward compatibility. Keep existing source/build.py reproducibility and snapshot hashes. Include fixture variants of exact LONGi, Victron, Honda and batteries already present.

Exit: simulation parameters come from canonical spec rather than retailer offers; merchant prices never change physics; exact variant cross-matches pass/fail deterministically.

### SHOP-02 — Source and freshness validator
Implement per-property provenance checks, source revision hashes, conflicting-source review, seller offer timestamp, optional refresh and honest stale flags. Never use unverified live claims when offline.

Exit: expired/missing offers cannot be "currently confirmed"; ambiguous variants block purchase-ready recommendations; offline snapshots remain usable with visible dates.

### SHOP-03 — BOM and landed cost engine
Refactor buyCost/pack optimization for verified offers, owned inventory, real pack constraints and location-dependent availability. Track mandatory, optional and unpriced BOS/wiring/installation items separately; use exact currency arithmetic.

Exit: brute-force-reference packing cases, multiple-retailer variants, taxes/shipping missing cases, partial totals and owned-panel boundary tests pass. A fifth LONGi panel never inherits the owned price without explicit evidence.

### SHOP-04 — Hard compatibility and selection
Join product graphs with electrical topology and installation uncertainty; implement pass/fail/indeterminate, part substitution and required accessory derivation. Ensure failure cannot be suppressed by price savings or ranking heuristics.

Exit: exact incompatible cases fail; unknown terminal/protection ratings remain indeterminate; recommendations show rejected alternatives and reason.

### SHOP-05 — Buyer experience and honest comparisons
Build browse/search/filter, exact model detail, shopping list, dated seller links, side-by-side ratings and cost/performance comparison. Keep offline support, accessibly distinguish evidence and stale-state statuses.

Exit: a buyer can understand model identity, why it fits, what must still be bought, what is estimated, why it costs that much, and what is unsupported without reading source code.

### SHOP-06 — Integrated design optimizer
When E0–E2 supports relevant configurations, join validated physical solver with commercial candidates, landed costs, and constraints. Re-run every recommended candidate through solver and verify cheapest feasible alternatives on small exhaustive test fixtures.

Exit: credible system sizing and tradeoffs; explicit objective and Pareto choices; reproducible sources and tested results.

The shopping workstream is a **parallel dependency track**, not something deferred entirely until final product hardening. Engineering identity, product facts and current costs must be ready before the optimizer.

## 10. Test and falsification matrix

Cases the code must fail/reject/label honestly:
- Same brand and power name, different model/revision or regional AC output.
- A 5000 VA nameplate mapped incorrectly to 5000 W continuous.
- Variant with self-heating battery advertised when listing references an ordinary nonheated 100 Ah model.
- Merchant product-family link with no exact MPN or wrong pack quantity.
- Current price shown from an offer that expired or was last verified weeks ago.
- In-stock claim without destination/quantity-specific observation.
- Owned four panels priced correctly, but the fifth is unpriced or separately sourced.
- Cheapest item fails cold-voltage, surge, phase, fuse interrupt or terminal constraints.
- Reused seller coupon restricted to first order; incompatible shipping region.
- Missing freight/tax/BOS/labor, but UI must not call subtotal turnkey price.
- Unknown spec/datasheet conflict: incompatible decisions are not hidden by optimistic defaults.
- Product listing remains available offline with explicit stale state; no silent "live" badge.
- Total-cost pack algorithm checked against independent brute-force enumerator, including overbuy/discount logic.
- Ranking changes only when relevant prices, goals, model evidence or constraints change; affiliate/merchant promotion does not bypass feasibility.

Quantitative criteria must be appropriate to the claim: exact cent arithmetic for subtotal, deterministic MPN match under explicit normalization policy, 100% passing hard constraint tests on supported fixture set, source-verified product property completeness per advertised listing class. Product specs and offers need separate freshness rules; datasheet ratings are not necessarily stale because a product is older, whereas merchant stock changes frequently.

## 11. Required deliverables and gate accountability

Per catalog refresh: canonical product revision and fingerprint; offer snapshot with date, currency, SKU, source; comparison report; detected conflicts; explicit freshness failures.

Per shopping recommendation: exact selected products with MPN, quantities and variant; proof of modeled fit or an indeterminate flag; evidence-backed simulator prediction if supported; dated offers/availability; partial vs full cost breakdown; owned inventory accounted separately; complete missing-items list; alternative candidates and reasons; constraints and model versions.

For every release, produce:
- Product variant verified coverage and exceptions
- Offer freshness/stock coverage
- Mandatory BOM coverage and unknown costs
- E0/E1/E2 modeled scenario coverage
- Explicit warning where code compliance/install inspection cannot be asserted
- CI evidence and reproducible artifact manifest

Do not mark shopper readiness based solely on physics tests, nor mark mathematical validity based solely on product-listing data.

## 12. First actions approved by current findings

1. SHOP-00 catalog and link/source audit; identify model ID vs merchant SKU and offer status. Read exact arrays and costLines in source/sim.js, make coverage list, separately check manufacturer manuals and merchant listings.
2. SHOP-01 product/offers schema with independent fixture tests and no UI change.
3. SHOP-02 freshness/owned inventory logic and shopping UI messaging, before any claim of current availability.
4. SHOP-03 landed-cost/BOM completeness.
5. SHOP-04 product compatibility integration.

Existing documented issues confirmed by source reading:
- Source/sim.js declares main hardware prices checked Oct 30, 2026 and balance-of-system Oct 31, 2026; "confirmed" today is historical validation, not live proof.
- Its current cost text explicitly excludes tax and shipping and lists unpriced missing items.
- LONGi owned price for 4 panels extrapolates to additional units at the same price as a labeled guess.
- Several retailer links and exact MPNs remain unverified as current purchasable offers.
- Coverage file records catalog_variant_audit and price_cost_audit as partial.

### Boundary of this specification
This document changes engineering priorities and data contracts; it does NOT itself implement merchant updates, live availability, checkout, an accurate total purchasing price, or electrical certification. Those remain separate code changes requiring tests.

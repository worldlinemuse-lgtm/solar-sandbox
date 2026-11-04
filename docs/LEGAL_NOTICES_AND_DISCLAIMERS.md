# Solar Sandbox — Comprehensive Legal Notices and Disclaimers

**Draft version:** 2026-11-04  
**Intended scope:** Public informational notices for the standalone/offline Solar Sandbox simulation application.  
**Status:** Prepared for factual and legal review; not a declaration of compliance, an approved engineering design, an executed contract, or a guarantee against liability. Material rights and operator details remain under review.

> **Safety notice — read before relying on results:** Solar Sandbox is an educational and planning simulation, **not** an electrical installation plan, engineering certification, product-safety approval, inspection, or guarantee that electricity will be available when needed. A solar array, battery bank, inverter, generator or house electrical connection can cause **fire, electric shock, arc flash, toxic exposure, property damage, serious injury or death** if improperly selected, installed, maintained or operated. Do not backfeed a home electrical system or utility lines. For any actual installation or modification, use the applicable manufacturer instructions, required listed transfer/interconnection equipment, permits and inspections, and a suitably qualified licensed electrical professional.

## 1. Scope and purpose

Solar Sandbox provides illustrative calculations and interactive simulations using selected hardware characteristics, user inputs, historical/model-derived weather and mathematical assumptions. It is offered as an informational aid. It does not provide individually supervised professional engineering, electrical contracting, architectural, structural, fire-safety, legal, insurance, investment or procurement services. Descriptions of equipment or configurations are not a professional recommendation, warranty, quotation or representation of suitability for any particular premises, jurisdiction or use.

An output labeled “within spec,” “table math,” “compatible,” “pass,” “estimate” or similar reflects **only the explicitly implemented tests and supplied assumptions**. Such labels do not establish compliance with the National Electrical Code (NEC), UL/CSA/IEEE product or system requirements, utility rules, building permits, local requirements, or current manufacturer installation instructions. Neither an output nor a successful automated test constitutes an approval by a licensed engineer, inspector, authority having jurisdiction or manufacturer.

## 2. Physical safety, installation and grid interconnection

Solar photovoltaic equipment, DC and AC electrical systems and generators present significant hazards, including lethal voltage, hazardous fault currents and stored energy even while equipment appears disconnected. Potential risks include shock, burns, arc flash, explosion, battery thermal runaway, fire, carbon monoxide exposure from combustion equipment, chemical exposure, overheating, structural failure, utility backfeed, damage to grid or neighboring electrical systems, and other hazards.

**The simulator does not approve installations or verify the full safety of wiring, overcurrent protection, disconnects, grounding and bonding, neutral arrangements, equipment listings, conductor termination ratings, rapid shutdown, anti-islanding, generator transfer mechanisms, enclosures, ventilation, combustion exhaust, or structural and wind/snow loading.** Some of those conditions are not modeled at all. A mathematically valid circuit diagram can still be dangerous or noncompliant.

Do not connect a generator or inverter to building circuits via improvised plugs, extension-cord backfeeding, or any arrangement that could energize utility wiring. Actual integration with premises wiring must follow applicable rules and listed transfer or interconnection equipment installed and inspected as required. The user must verify actual compatibility, safety, protection, permit and utility requirements with appropriate qualified professionals and governing authorities.

## 3. Output uncertainty and non-guaranteed performance

All simulations are models. Predictions can be wrong because of incomplete or outdated catalog data, unmeasured component properties, weather-model error, incorrect time alignment, user inputs, assumptions, unexpected equipment behavior, failures, load transients, software defects or calculation limitations. Solar irradiance, temperature, snow, terrain shade, panel orientation, real component efficiency, charging profiles, inverter startup and surge, battery management-system cutoffs, aging, and generator performance may vary materially from the modeled values.

The application must not be relied upon to guarantee uptime, autonomous power duration, battery life, solar yield, equipment longevity, emergency resilience, service-availability probabilities, financial returns, operating cost, payback period, product compatibility or expected physical performance. An estimate of “unserved load” or modeled blackout time is not a promise of real-world availability.

## 4. Historical weather and probabilistic interpretation

Typical-year inputs and the archived historical winters are based on identified third-party weather products, including PVWatts/NSRDB and NASA POWER. Such data are model-derived or gridded estimates, not measurements of a particular roof or yard. They are affected by source location, spatial resolution, time convention, revisions, estimation methods and other uncertainties. Some imported historical NASA POWER request and clock-provenance details remain unverified.

A frequency observed across the 25 modeled winter histories is **not** automatically the probability of failure in a future winter, nor a formal statistical forecast. Simulated outcomes apply only to the stated equipment, schedule, inputs and assumptions; results from different revisions should not be treated as directly comparable without matching configurations.

## 5. Product identifiers, technical specifications and brands

Names, model numbers and trademarks—including those of LONGi, Victron Energy, Renogy, Battle Born Batteries, LiTime, Honda, Blue Sea Systems, PVsyst, HP, Starlink and other referenced entities—are used to factually identify equipment, suppliers or technical references. **Solar Sandbox is independent and is not affiliated with, sponsored by, endorsed by, certified by, approved by or an authorized representative of the named parties.** Their names, trademarks, service marks and other protected branding remain the property of the respective owners.

A specification, product listing, price, comparison, test or hyperlink does not mean the manufacturer inspected or approved this application, its outputs, the selected product combination or an installation. Any statements about brand-specific products should be understood as independently prepared summaries of cited facts, not official manufacturer guidance.

Manufacturer data can change with product revision, firmware, market, date, temperature and installation context. Prices and stock are time-sensitive and may be stale, incomplete, estimated or user supplied; they are not binding offers. Before purchase or installation, confirm the exact product identifier, current documentation, warranty, certification, availability, price, suitability and vendor credibility from primary sources.

## 6. Government agencies, research organizations and data providers

NASA POWER, PVWatts, NSRDB, and associated research laboratories are credited as relevant original sources of weather or reference material. Names are included to describe source provenance only. **No U.S. government department, NASA program, national laboratory, standards body, research organization or data provider sponsors, endorses, certifies or approves Solar Sandbox.** The application does not claim official NASA imagery, insignia or a government seal as its own.

External providers retain any intellectual property, branding and use restrictions applicable to their resources. Public accessibility, publication, citation and linking do not by themselves establish permission to copy or commercially redistribute any copyrighted third-party expression, recording, program, graphic, licensed dataset or protected mark.

## 7. Copyright, intellectual property and third-party content

Original app elements are subject to whatever ownership and rights are actually established by authorship, applicable law or documented grants; this notice does not claim exclusive ownership over third-party materials or public-domain information. Product facts, independently written summaries and mathematical relationships are distinguished from copyrightable photographs, drawings, audiovisual content, software, manuals, promotional copy and other original expression.

Third-party material remains the property of its respective rights holder and is subject to applicable permissions or licenses. Names, credits, links or an independence notice are **not substitutes** for permission where required. The project's asset-provenance review is documented in [Brand and Content Rights](BRAND_AND_CONTENT_RIGHTS.md). Important questions remain open regarding the embedded voice recording and some redistributed weather-product terms; the inclusion of notices **does not resolve** those issues.

Do not infer permission to reproduce, distribute, sublicense or commercialize a third party's original creative work from its inclusion or citation. Infringement concerns should be directed to the project operator once verified contact details are published; a notice-and-takedown process must be implemented and documented if applicable.

## 8. Third-party websites, sellers and links

External website and seller links are provided for reference and convenience. A link does not represent sponsorship, endorsement, authentication of the seller, warranty of its offerings, continued availability, endorsement of its safety claims, or verification of transactions. Sites may change independently, require separate terms, use tracking technologies and have their own privacy policies. Users should independently confirm supplier legitimacy and product identity before making purchases.

Any paid placement, affiliate relationship, sponsorship or other material financial connection must be disclosed **where relevant to the product link or endorsement**, clearly and conspicuously. This notice does not assert that any such relationship currently exists.

## 9. User inputs, downloaded reports and local storage

The current standalone application can save configurations and simulation state in browser local storage, cache application files for offline access, and export user-selected designs and reports as downloadable files. Stored or exported data may be overwritten, deleted, modified, made incompatible by updates, lost through device/browser failure, or exposed to others who can access the device or files. Users should protect and back up important information and must not rely on the application as a secure archive or sole record of an engineering decision.

This document is **not a privacy policy** and makes no representation that the hosting service collects no logs or personal information. Site hosting, user accounts, analytics, payments, third-party services and future app features must be separately inventoried; applicable privacy notices and controls must reflect what actually occurs. Do not upload passwords, private account credentials, sensitive personal data or confidential infrastructure information into a future feature unless its data-handling terms have been verified.

## 10. Equipment, legal and regulatory changes

Product and code requirements can change after publication. User location matters: national, state, local, utility, fire, building, zoning, environmental and licensing rules may apply. No website result supersedes those requirements. Users are responsible for consulting currently applicable official material and obtaining necessary professional services, approvals and inspections before building or energizing a physical system.

## 11. Availability, maintenance, errors and modifications

The application may be changed, corrected, interrupted, unavailable, removed or superseded without any guarantee of uninterrupted operation or compatibility with saved data. Software updates and fixes may alter calculations, assumptions or exported results. The developer may not be able to respond to every report or maintain every product listing. Information is provided for its stated revision and may become outdated.

## 12. No promise of fitness, warranties or guaranteed results

**To the fullest extent permitted by applicable law**, Solar Sandbox and its informational outputs are provided **“as is” and “as available,”** without a promise of accuracy, completeness, uninterrupted availability, merchantability, suitability for a particular purpose, non-infringement, or performance, and without a guarantee that an engineering proposal or equipment combination is safe or legally compliant. This disclosure is subject to any warranties, guarantees and consumer rights that cannot lawfully be excluded. It must not be used to contradict express promises elsewhere on the site, advertisements or purchase materials.

A disclaimer cannot retroactively remove existing obligations, disclaim a third-party's rights, or make misleading factual claims lawful.

## 13. Risk allocation and limitations of liability

Users should independently validate outputs before acting. **To the maximum extent permitted by applicable law**, the operator seeks to exclude liability for indirect, incidental, special, consequential, exemplary or punitive losses related to use of the informational application, including lost profits, lost data, interruption, equipment damage or business disruption. Any such exclusion is **subject to controlling law, non-waivable rights and the specific facts of a claim**. This notice alone may not establish a binding contractual limitation.

No notice is intended to exclude or restrict liability to the extent doing so is unlawful, including any non-waivable statutory rights or liability that cannot validly be waived for injury or other harm. Meaningful contractual limitations, caps, indemnification or dispute-resolution procedures require separate, appropriately presented **Terms of Use**, a known operator identity and enforceable user assent; they must not be invented by a standalone disclaimer.

## 14. No third-party warranties or grants of rights

The operator cannot waive rights on behalf of a manufacturer, licensor, seller, governmental entity or data publisher. Third parties' own written terms, warranties, licenses and legal rights control their respective products, services and content. References to a third party do not transfer its warranty obligations or licenses to Solar Sandbox, and no third-party endorsement or safety certification is represented.

## 15. Material disclosures and updates

This document should accompany, **not replace**, shorter, clear notices placed immediately beside claims that could mislead users—especially compatibility, safety, forecast confidence, cost and promotional links. An obscure footer or long legal section does not cure an inaccurate statement elsewhere. Material changes to the app, external services, operator, revenue model or data handling require review and, where legally necessary, updated disclosures and consent.

## 16. Preservation of statutory protections

All disclaimers and limitations apply only where lawful. Nothing in these notices waives rights that cannot legally be waived, misstates mandatory rights, makes unauthorized content lawful, or creates an affiliation that does not exist. Any invalid provision is intended to be applied only to the legally permitted extent without expanding other restrictions.

---

## Implementation checklist (not part of a user agreement)

- Display a concise **independent-brand and electrical-safety notice near the top** of the live UI and provide the complete notice in an accessible, clearly labeled, keyboard-friendly disclosure.
- Keep the complete notice in the offline HTML bundle, not behind an online-only URL.
- Keep specific, adjacent warning text where the app reports **compatibility, ampacity/fuse ratings, forecast confidence, equipment costs or purchasing links**.
- Confirm creator identity, jurisdiction, ownership, IP permissions and commercial model before drafting binding contractual Terms of Use.
- Add an actual and verifiable Privacy Policy if personal data is collected by the operator or its vendors; do not copy boilerplate that misrepresents technical behavior.
- Separate any sponsorship/affiliate disclosure and place it next to affected recommendations **if** a paid relationship exists.
- Never claim the legal notices, internal tests or manufacturer data confer certification, insurance or complete immunity from liability.
- Have a U.S. attorney familiar with online products, intellectual property and electrical-product liability assess enforceability and applicability before public commercial launch.

### Selected primary legal/regulatory guidance

- FTC — Advertising FAQ (clear and conspicuous disclosures): https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business
- FTC — Marketing Your Mobile App: https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start
- U.S. Copyright Office — what copyright protects: https://copyright.gov/help/faq/faq-protect.html
- NASA — brand center and restrictions: https://www.nasa.gov/nasa-brand-center/
- NASA — Science Data Licenses: https://science.data.nasa.gov/about/license
- PVWatts — model use and attribution disclaimer: https://pvwatts.nlr.gov/pvwatts.php
- FTC — Endorsement material connections: https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking
- FTC — COPPA rule, if children's data is involved: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions

*Draft status and uncertainty are intentional: this is an evidence-based attempt to disclose material risks, not an assertion that the product or its third-party materials are legally cleared.*

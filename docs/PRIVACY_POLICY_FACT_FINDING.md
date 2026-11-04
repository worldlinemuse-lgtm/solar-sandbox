# Solar Sandbox — Privacy / Data-Handling Verification Before Public Policy

**Status:** Fact-finding checklist only; **not** a published representation that a privacy policy is complete or legally compliant.

## What is directly supported by current code inspection (2026-11-04)

- `source/sim.js` calls browser `localStorage.setItem` / `getItem` to save and restore designs and simulator states.
- Exports generate local JSON downloads using `Blob` and `URL.createObjectURL`.
- `sw.js` caches static app assets and same-origin requests within the project's path for offline operation.
- The GitHub Pages site is publicly hosted; any request/log data processed by the hosting provider is **not** established by an absence of analytics calls in app code.
- `source/sim.js` contains no observed direct `fetch(` / `XMLHttpRequest` / `sendBeacon` network telemetry call in the inspected revision; this does **not** prove there is no processing through site hosting, browser platforms, new code, third-party links or future services.
- The app contains links to third-party reference, manufacturer and seller websites whose separate practices may apply when opened.

## Required additional verification

- [ ] Confirm the legal identity and contact of the privacy controller/operator.
- [ ] Verify all hosting-layer logs and subprocessors, relevant data categories, uses, retention and geographical transfers (including GitHub Pages).
- [ ] Inventory whether any analytics, monitoring, advertising, embedded media, fonts, maps, payments, affiliate tracking, cookies, accounts, support forms or API connections currently exist or will be added.
- [ ] Document browser storage/cookie purposes, deletion methods, and offline cache behavior without claiming to control browser/vendor logs.
- [ ] Establish policy jurisdiction(s), applicable consumer access/deletion/opt-out rights and age restrictions. Avoid falsely claiming COPPA compliance merely by displaying an age statement.
- [ ] Ensure users have meaningful access to the policy and clear notices at collection points if legally required.
- [ ] Implement appropriate privacy/security safeguards for any collected data; do not rely only on contractual statements.
- [ ] Review accessibility, advertising and consumer rights separately from the privacy policy.

Do not publish a generic “we collect no personal data,” “we never share data,” or “all data stays on device” statement without verifying the hosting and service architecture.

### Regulatory sources

- FTC mobile app marketing/privacy guidance: https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start
- FTC COPPA guide: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- California Civil Code § 1798.100 (where applicable to a qualifying business): https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.100.&lawCode=CIV

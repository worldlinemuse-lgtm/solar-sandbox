# Solar Sandbox navigation development checkpoint

Task: replace the giant single page with task-specific navigation, preserving simulator functions and adding browser regressions.

Draft implementation on this branch: source/workspace-nav.js is loaded from source/template.html through source/build.py. Generated index.html was rebuilt by validation workflow. Navigation is UI-only and the production main branch is unaffected.

Known work remaining: check all CI tests at latest generated commit, inspect screenshots and keyboard behavior, partition System Builder into focused subareas, and verify price source links and all existing save/import actions. No claim of release readiness yet.

2026-11-07: Corrected Build-section boundary so moving the BOM leaves the Design Checks heading and section in the Builder. The earlier browser test found absent builder navigation; that failure is now explicitly tracked. The generated bundle was rebuilt by Actions; rerun the tests against the generated artifact and do not merge until green.


## 2026-11-07 follow-through checkpoint
The source-to-index.html regeneration finished successfully at GitHub Actions run 42418483438, generating commit b7c5311684c4635d15832b820ef113361944a21a. This checkpoint commit intentionally changes documentation only so all tests run at a commit that already includes its matching generated website; bots' auto-build commits do not themselves run the main CI because that workflow excludes bot actors.

Work on UI branch now includes:
- task-based Overview/System Builder/Loads/Scenarios/Results/Shop & Compare/Sources & Help navigation;
- six real Builder submenus reusing (not cloning) existing fields and handlers;
- a responsive desktop navigation rail, visible tablet/mobile menu grid, and keyboard arrow/Home/End support;
- dated prices and manufacturer references relocated to Shop; separate Sources & Help; collapsible explanatory introduction;
- browser test suites updated to navigate hidden advanced controls as real users must, preserving save/load, mission, weather, generator and app-state flows.

Risks still held open: complete CI on matching bundle, per-viewport overflow/overlap results, accessibility semantics, and full 25-winter regression. PR #17 remains draft until proven.


## 2026-11-07 screenshot-driven revision
Browser screenshots identified three meaningful UX defects: wrong controls in System Builder categories, global inverter/disconnect controls leaking into Shop and documentation, and unreadable diagram/technical disclosure styles. Corrected source/workspace-nav.js, and captured browser screenshots at 390x844, 768x1024 and 1280x800 through CI artifacts.

Precise root cause of misplaced battery/site controls in the first revision: the builder section DOM had been detached for reparenting; document.getElementById() cannot resolve nodes in detached trees. Fixed by querying the detached section object directly, then reattaching section DOM. Strengthened tests to assert that the battery selector, shade and cold settings appear in the correct section and that unrelated controls are hidden.

Rebuild workflow run 42419590159 passed and committed generated index at 0a7a94c6. This docs-only follow-up starts CI against that matching final generated artifact. PR remains draft; no live production claim until the latest CI and screenshots have been reviewed.

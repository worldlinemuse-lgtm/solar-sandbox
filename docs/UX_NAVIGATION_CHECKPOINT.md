# Solar Sandbox navigation development checkpoint

Task: replace the giant single page with task-specific navigation, preserving simulator functions and adding browser regressions.

Draft implementation on this branch: source/workspace-nav.js is loaded from source/template.html through source/build.py. Generated index.html was rebuilt by validation workflow. Navigation is UI-only and the production main branch is unaffected.

Known work remaining: check all CI tests at latest generated commit, inspect screenshots and keyboard behavior, partition System Builder into focused subareas, and verify price source links and all existing save/import actions. No claim of release readiness yet.

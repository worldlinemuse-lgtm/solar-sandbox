# Historical and aging analysis: input-integrity contract

## Correctness problem

Historical stress tests and battery-aging estimates execute asynchronously in chunks. Previously these computations checked only `S.cfg` for changes. Appliance schedules (`S.loads`) could change mid-run without invalidating the result, so the UI could present measurements that did not describe the current household load.

The aging estimate had the same gap both during the simulated typical year and in its subsequent 25-winter calculations. Independent calculations could also overlap and disrupt model state.

## Implemented controls

- Snapshot the system configuration and appliance definitions and verify both at **every asynchronous chunk boundary**.
- Stop and discard partial results on any input change, including changes during battery aging.
- Reject a second concurrent analysis (while still allowing the aging routine's own managed winter runs).
- Clear obsolete result panels after design/appliance changes; display an explicit message to rerun analysis.
- Protect the historical-results button against accidentally stopping the internal winter analysis of an ongoing aging run.

`tests/test_batch_input_isolation.py` checks the failure and concurrency paths using the actual browser-driven application. It mutates an appliance between two compute chunks, verifies no stale result survives, checks simultaneous runs, and checks that prior result panels are invalidated.

**Scope:** These fixes protect result/input integrity. They do not independently verify simulation physics. Site-specific solar measurements, BMS and inverter measurements, AC motor-start behavior, generator operations, and equipment compatibility remain necessary before relying on a proposed household backup design. See issue #4 and the simulation-correctness milestone.


## Simulation-preview determinism

A display refresh must not consume the pseudo-random event stream. Previously, displaying a winter midnight while the optional random-snow game mode was enabled could call `Math.random()` despite rolling the simulated state back. That made subsequent snow events depend on UI refreshes. The step's random-snow branch now runs only during actual simulated time, and `tests/test_integrity.py` asserts that two previews consume zero random samples while a real minute consumes one.

**Remaining limitation:** normal game-mode snowfall still uses an unseeded `Math.random()` stream. Replay of that optional game mode is not deterministic across browser sessions. The historical and aging validation tests disable random game events.

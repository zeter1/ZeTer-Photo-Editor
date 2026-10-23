# 003T/3b — Operation-boundary Linux CPU evidence in native PSD16/PSB32 UI

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md), Stage 003/6 OPEN.
**Dependencies:** [003T/3a](003t3a-cpu-pid-census.md) DONE in [PR #323](https://github.com/zeter1/ZeTer-Photo-Editor/pull/323), exact PR-head [CI #39921027655](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39921027655) and exact merged-code main [CI #39921787753](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39921787753) SUCCESS.

## Objective
Apply the proven conservative PID+starttime CPU tick parser, complete CDP census checks and strict independent receipt validation to **actual editor** PSD16 and PSB32 native tiled Fill/cancel/retry UI operation boundaries, rather than only an isolated temporary CPU Worker control.

## Criteria of acceptance
1. Real independent fresh Chromium file:// sessions for each native 16/32-bit document with operation UI timestamps, complete CDP process list and Linux /proc utime/stime/starttime windows at beginning and end of Fill and of cancelled/retried work. Missing OS reads or CDP permissions remain unknown.
2. Keep **separate** CPU-tick overlap for matching PID incarnations only; assert neither uninterrupted child coverage, CPU total/peak, RSS peak, Worker→PID nor operation-exclusive resource use.
3. A strict serialized JSON/artifact verifier detects missing boundaries, forged tick differences, changed PID incarnations, impossible phase order, falsely asserted complete coverage, invalid 16/32-bit format or unsafe native outputs.
4. Actual PSD16 and PSB32 selection-only native bytes, alpha/outside untouched, cancellation/no stale Worker delivery, Undo/Redo exact fidelity, .zpe where affected; no new full-frame memory copy or runtime dependency.
5. Node tests, genuine Chromium file:// CI on both native depths, PR exact-final-head CI, merge and exact-main CI. Capture results/links in task/NEXT.md, task/README.md and parent 003T.

## Scope limitation
003T/3a is a genuine **temporary Worker CPU control**, not yet evidence of actual editor-operation CPU. Operation windows in 003T/3b remain sampled, non-atomic OS/CDP reads. No true peak or Worker-to-OS-PID proof absent exclusive whole-operation process membership. Dedicated cgroup permission remains blocked in prior runner control. P0 independent Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) is BLOCKED.

## Current work
TODO; next concrete implementation. No branch, PR or test result for 003T/3b yet.


## 2026-10-23 implementation pass (candidate, CI not yet observed)
Branch: [test/003t3b-native-cpu-boundaries-20261023](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t3b-native-cpu-boundaries-20261023).
- Added optional read-only real Linux Chromium CDP + /proc CPU censuses at six genuine native UI operation milestones: before first Fill, first Worker in flight, after Escape cancellation, before second Fill, retry Worker in flight, after native completion. Both PSD16 and PSB32 retain original exact-byte / alpha / outside / History / Undo / Redo assertions.
- Added standalone strict CPU-boundary receipt parser with per-PID incarnation tick comparisons and SHA-256 binding to the existing separately validated native cancellation receipt. Rejects false totals, peaks, Worker PID mappings, reordered samples, malformed windows and changed receipt content.
- CDP absence is explicitly unknown (not zero); /proc denial remains entirely unknown. Snapshot windows are not exclusive or continuous and cannot establish true operation CPU/peak/Worker PID.
- Enabled real fresh file:// browser observations and independent two-format JSON verification in existing dense-cancel CI job. Added negative Node tests.
- Code files: tools/browser-linux-cpu-observation.mjs, tools/browser-smoke.mjs, tools/browser-near-cap-ui-smoke.mjs, tools/browser-operation-cpu-evidence.mjs, tools/verify-browser-operation-cpu-evidence.mjs, tests/browser-operation-cpu-evidence.test.mjs, .github/workflows/ci.yml.
- CI/PR/merge: pending. Next: inspect exact head CI and both JSON receipts, fix any failures, confirm source/format/native fidelity, merge only on green CI, verify exact merged main; then update task queue. This is IN PROGRESS, not DONE.

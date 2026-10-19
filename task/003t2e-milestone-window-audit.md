# 003T/2e — explicit high-depth Chromium milestone read-window evidence

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md), Stage [003](003-tiled-content-aware.md).
**Dependency:** 003T/2d-3, [PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294), where a real GitHub runner reported `cgroup-create-permission-denied`; dedicated operation-private cgroup, true peak and Worker→OS PID remain unsupported.
**Branch:** [test/003t2e-milestone-window-audit-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2e-milestone-window-audit-20261019).

## Goal and bounded scope

Capture the **actual time windows** of explicit CDP/OS memory readings on real Chromium `file://` high-depth PSD16/PSB32 UI operations. Preserve observed/missing PID membership, Linux incarnation, Worker targets, optional private-memory and RSS at each milestone. Do not infer coverage between milestones, peak RAM, process exits or a Worker-to-PID join. Existing periodic sample aggregate and native 16/32-bit Worker paths remain unchanged.

## Implemented on branch

- `tools/browser-milestone-window-audit.mjs`: derive a compact bounded-to-milestones observation audit with start/end offsets, independent observed/missing identity flags, explicitly unknown intervals, `trueOperationPeakKnown:false`, `workerPidMapping:'unknown'`. Reject unsupported fields, fake peak/PID, inconsistent counts, read overlap and missing initial/final boundaries.
- `tools/browser-renderer-heap-sampler.mjs`: emit milestone window audit from genuine sampled observations, alongside the existing sampling-timing envelope.
- `tools/browser-operation-timeline.mjs` and `tools/browser-operation-artifact.mjs`: retain the audit in PSD16/PSB32 operation receipts and require/verify it for real quality-bearing Chromium operation artifacts.
- `tools/browser-real-photo-memory-evidence.mjs`: validate audit when available; legacy synthetic fixtures are not silently promoted to true operation evidence.
- `tests/browser-milestone-window-audit.test.mjs`: positive sample and adversarial JSON tests.
- Existing sampler and artifact tests: confirm actual stage read-window wiring and fail-closed forged receipts.

## Verification

- Standalone module tests executed locally (Node v22): **2 PASS / 0 FAIL** on the authored module/test files. The complete repository cannot be cloned in this environment (`github.com` DNS lookup fails).
- Full `npm run check`, `file://` browser smoke, PR CI, merge and exact-main CI: **PENDING**. Do not claim full acceptance until those exact runs pass.
- The previous real runner gate [PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294) independently found non-privileged cgroup delegation **BLOCKED**. That is not a memory-performance result.


## 2026-10-19 — PR #295 CI regression and bounded fix

- [PR #295](https://github.com/zeter1/ZeTer-Photo-Editor/pull/295) initial [CI #39281144547](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39281144547) **FAIL** at `npm run check`: existing `tests/browser-worker-target-census.test.mjs` scenario 028 passes a generic invalid `after recovery/reload` label. The existing target census explicitly records this as **unobserved** `invalid-phase`; the new audit initially rejected the report at `stop()` instead.
- `tools/browser-milestone-window-audit.mjs` now emits the same fail-closed `invalid-phase` sentinel for malformed generic labels while refusing `workerTargetsObserved:true` with this sentinel. It still rejects overlapping windows and forged peak/Worker→PID claims.
- Regression assertions added to `tests/browser-worker-target-census.test.mjs` and `tests/browser-milestone-window-audit.test.mjs`. Fix commits: [`05b47c9`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/05b47c9d0ae9a214cda536d810e48e4fe5499589), [`94e0ffb`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/94e0ffb07057b449998a29442e8fbe7a2f714bbd), [`d4b6821`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/d4b682181703795079748df5a3a0c2e7e8ff60fb).
- **CI on these fixes, merge and exact-main: PENDING readback.** Local complete checkout remains inaccessible. This section records code publication, not successful acceptance. Keep 003T/2e **IN PROGRESS** until successful exact-head CI, real Chromium receipts and merge/main checks are verified.

## Acceptance criteria

- [x] Explicit milestone observation window / missing identity data derived from real report structure.
- [x] Reject forged peak/PID, invalid read-window chronology and counters in the artifact validator.
- [x] Local standalone Node unit regressions passed.
- [ ] New PR full CI passes including real `file://` PSD16/PSB32 cancel/retry and JSON artifact verification.
- [ ] Merge after checks, verify exact merged-main CI, record URLs and SHA.
- [ ] Extend to independent process-incarnation **control** and genuine operation boundary/gap correspondence; maintain unknown if not independently observable.

## Limitations and next

This is an **observational instrumentation** pass, not true operation RSS peak; periodic reads may happen between explicit milestone observations and are not presumed to bridge unknown gaps. No process-specific Worker PID or Photoshop-authored PSB32 proof. Next bounded 003T milestone: independently establish whether sampled high-depth operation intervals can be cross-checked against a separate PID/incarnation control with no interval extrapolation. P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED.

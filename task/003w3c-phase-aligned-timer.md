# 003W/3c — Phase-aligned timer evidence and bounded selection-scan responsiveness

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003W/3](003w3-dense-scan-responsiveness.md), Stage 003/6. **Dependencies:** 003W/3a [PR #320](https://github.com/zeter1/ZeTer-Photo-Editor/pull/320) and 003W/3b [PR #321](https://github.com/zeter1/ZeTer-Photo-Editor/pull/321) DONE with exact-main CI.

## Why next

Genuine Chromium `file://` repeated 1450×1400 source scan is ~303–329 ms for both 576-pixel sparse and 1,973,400-pixel dense selections; even refused 2,018,665 selection requires a full ~313–356 ms scan. Observed timer delays reach ~35–61 ms, but un-timestamped timer pulses do not prove they occurred during the selection scan, and wall time is not CPU time. Existing 2,000,000-pixel cap and high-depth native guarantees must not be relaxed.

## Acceptance criteria

1. Correlate every opt-in 8 ms timer sample with monotonic `selection-start`, `selection-end`, `worker-run-start` and actual `Worker.postMessage` when applicable; over-cap refusal must have only scan start/end and no Worker. Capture bounded samples including truncation, missing-pulse and clock-validity semantics; preserve production callback fail-closed behavior and `file://` startup.
2. Strict independent JSON validator + negative Node tests for missing/forged phase attribution, impossible sample chronology, failed cap refusal, false CPU/RSS/Worker→PID claims and incorrect native format/depth.
3. Repeat real Chromium PSD16 and PSB32 dense, sparse and >2M refusal on matched 1450×1400 geometry, multiple independently launched profiles per format. Record per-phase main-thread pulse delay range, sample coverage and uncertainty; do not claim stable percentiles from two runs.
4. If a reproducible *scan-attributable* user-visible delay is found, implement and prove a bounded targeted scan/yield/chunk improvement with before/after matched genuine-browser measurements. Retain 2M refusal, no stale Worker result, cancellation, alpha/outside native bytes, Undo/Redo and `.zpe` fidelity. If no attributable stall, record evidence supporting no optimization and document limits.
5. Pass local Node tests when possible, exact PR-head CI, independent real `file://` PSD16/PSB32 browser receipts, merged PR and exact merged-code main CI. Record links and remaining constraints in parent task, `task/NEXT.md` and `task/README.md`.

## Known blockers

- Stage 003 and 003W/3 stay OPEN pending this phase-aligned attribution and bounded performance decision.
- 003T operation-specific process RSS/CPU peak and Worker→OS PID proof remain OPEN; timer/renderer heap is not a substitute.
- P0 independent Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED. This task does not claim full Photoshop compatibility.

## Prior receipts

- [PR-head comparative CI #39911848664 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39911848664)
- [Exact merged-code main CI #39912308613 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39912308613)
- [PR #321 merged](https://github.com/zeter1/ZeTer-Photo-Editor/pull/321) at [9fd2c496](https://github.com/zeter1/ZeTer-Photo-Editor/commit/9fd2c496db2055bccf580b547865baac70d4fcfe)


## 2026-10-23 — 003W/3c phase-aligned instrumentation PR candidate

- **Current status:** IN PROGRESS; no PR-head/exact-main success claimed until observed. Branch: `test/003w3c-phase-aligned-timer-20261023`.
- **Implemented:** opt-in timestamped bounded 8 ms timer samples per selected `selection-start`/`selection-end` phase, with explicit v2 receipt and unchanged v1 compatibility. Over-cap refusal stops collecting after a brief post-scan grace period without a Worker handoff.
- **Strict tests:** independent v2 receipt verifier rejects forged phase sequence, sample chronology/interval mismatch, invalid depth/count, false RSS/CPU/PID claims; missing pulses remain unknown and full 256-sample truncation is explicit.
- **Browser CI proposal:** real separate `file://` PSD16/PSB32 dense, sparse and >2M refusal in two runs per class/format; check native before/after + alpha/outside/Undo/Redo in existing genuine UI suite, save and gate v2 JSON in each job. v1 comparison retained unchanged.
- **Changed:** `tools/browser-selection-freeze-observer.mjs`, new `tools/browser-selection-phase-alignment.mjs`, `tools/browser-near-cap-ui-smoke.mjs`, new `tools/verify-browser-phase-aligned-evidence.mjs`, new `tests/browser-selection-phase-alignment.test.mjs`, `.github/workflows/ci.yml`.
- **Outstanding:** observe actual Chromium/Node PR CI; inspect genuinely attributable timer gaps and decide whether bounded production optimization is justified. Do not assert speedup or completion yet. Parent 003W/3, 003W, 003T and Stage 003 remain OPEN; Photoshop-authored PSB32 002B/2c remains BLOCKED.

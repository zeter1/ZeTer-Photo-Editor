# 003W/3c — Phase-aligned timer evidence and bounded selection-scan responsiveness

**Priority:** P1. **Status:** DONE. **Parent:** [003W/3](003w3-dense-scan-responsiveness.md), Stage 003/6. **Dependencies:** 003W/3a [PR #320](https://github.com/zeter1/ZeTer-Photo-Editor/pull/320) and 003W/3b [PR #321](https://github.com/zeter1/ZeTer-Photo-Editor/pull/321) DONE with exact-main CI.

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

## 2026-10-23 — 003W/3c accepted: phase-aligned real Chromium decision

**Status: DONE.** [PR #322](https://github.com/zeter1/ZeTer-Photo-Editor/pull/322) merged as [main 33bfc649](https://github.com/zeter1/ZeTer-Photo-Editor/commit/33bfc649f837af007d2fd3b7ff96b1244c87de27). Exact final PR-head [CI #39915300707 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39915300707) and exact merged-code [main CI #39915691507 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39915691507): all 10 jobs passed in both. Initial [PR CI #39915087677](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39915087677) had one real legacy v1 JSON schema regression in browser smoke; [fix f08cee21](https://github.com/zeter1/ZeTer-Photo-Editor/commit/f08cee21c716456054c5c367c150767336d4f066) restored strict v1-compatible snapshots, then all gates passed.

**Genuine measurements:** Independent file:// Chromium PSD16 / PSB32 UI runs (1450×1400 source), two runs per class/format. Each row reports scan WALL milliseconds, then maximum ADDITIONAL 8ms timer delay for intervals entirely inside the scan, then maximum delay for intervals merely crossing/touching the scan. Boundary overlap is not causal proof of scan blocking.

| Native format and selection | Scan wall 1/2 (ms) | Inside-scan extra drift 1/2 (ms) | Crossing extra drift 1/2 (ms) |
| --- | ---: | ---: | ---: |
| PSD16 dense, 1,973,400 selected, Worker | 331.4 / 332.2 | 1.8 / 1.8 | 38.3 / 35.3 |
| PSB32 dense, 1,973,400 selected, Worker | 332.3 / 338.2 | 1.2 / 1.3 | 54.9 / 62.2 |
| PSD16 sparse, 576 selected, Worker | 317.9 / 311.7 | 2.4 / 1.0 | 41.0 / 35.6 |
| PSB32 sparse, 576 selected, Worker | 315.3 / 318.3 | 1.7 / 1.1 | 57.3 / 63.8 |
| PSD16 refusal, 2,018,665 selected, NO Worker | 338.0 / 322.1 | 6.3 / 1.2 | 64.5 / 62.0 |
| PSB32 refusal, 2,018,665 selected, NO Worker | 335.7 / 330.8 | 7.1 / 2.2 | 79.6 / 81.8 |

**Decision:** No reproducible scan-contained user-visible event-loop stall in the recorded samples, despite larger boundary-straddling timer gaps. With existing cooperative 32,768-pixel scan chunk/yield semantics, speculative runtime optimization is NOT justified. Production pixel algorithm unchanged; preserve 2M cap, native alpha/outside bytes, exact Undo/Redo, Worker owner/cancel, save compatibility and direct file://. Negative Node tests, phase chronology, missing/truncated samples, genuine native browser and no-Worker refusal passed via exact PR/main CI. These are samples, not complete tracing or CPU time; two runs do not justify percentiles, true isolated operation peak RSS, or Worker-to-OS PID assertions. Local checkout tests not run in connector-only execution; actual CI includes npm run check and genuine Chromium.

**Changed code:** tools/browser-selection-freeze-observer.mjs, tools/browser-selection-phase-alignment.mjs (new), tools/browser-near-cap-ui-smoke.mjs, tools/verify-browser-phase-aligned-evidence.mjs (new), tests/browser-selection-phase-alignment.test.mjs (new), .github/workflows/ci.yml, task tracking.

**Remaining:** Parent 003W/3 DONE, parent 003W and Stage 003 remain OPEN pending broader 003T CPU/RSS/Worker→PID evidence. Independent Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED. Next existing [003T](003t-operation-memory-evidence.md), with explicit honest observability checks. This documentation-only acceptance commit itself has no exact-head CI claim until independently run.

# 003W — real browser selection-freeze responsiveness and memory evidence

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003 tiled Content-Aware](003-tiled-content-aware.md), Stage 6.
**Dependencies:** [003U](003u-bounded-ui-selection-freeze.md) typed index freeze DONE, [003V](003v-ui-selection-scan-cancellation.md) mid-chunk cancellation accepted on exact-main.

## Objective and acceptance criteria

Move from small synthetic Node cancellation proofs to actual Chromium `file://` UI responsiveness observations for the native tile/Worker selection freeze. Baseline and optimize only if measurements show a reproducible bottleneck.

1. Use real UI PSD16 and PSB32 document sessions and broad dense/sparse selections, including near 2,000,000 selected-pixel Worker budget and out-of-limit refusal.
2. Record actual main-thread event-loop delay distribution and selection-freeze CPU/wall latency, bounded heap/RSS observations, and explicit gaps. Do not claim an operation-exclusive peak or verified Worker→OS PID without independent evidence.
3. Assert cancelled/owner-changed freeze never dispatches a Worker job or mutates native source/preview/history; successful native Worker paths preserve Undo/Redo, alpha, untouched bytes and source immutability.
4. Preserve local no-server `file://`, no new network/runtime dependency, existing bounded typed indices and data safety contracts. Introduce a production optimization only after showing baseline and verifying non-regression.
5. Record reproducible artifacts and strict verifier, `npm run check`, real browser CI, PR merge and exact-main results. Do not mark DONE on simulation alone.

## 2026-10-20 queue

- Created as follow-up to [003V](003v-ui-selection-scan-cancellation.md).
- **Current state TODO:** no implementation, measurements or claims of completion yet.
- P0 independently verified Photoshop-authored PSB32 source provenance remains [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.

## 2026-10-20 — real browser timing harness (IN PROGRESS)

- **Implementation branch:** [test/003w-browser-selection-observation-20261020](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w-browser-selection-observation-20261020).
- **Scope:** the actual existing `file://` Chromium `rgb16large` PSD16 and `rgb32psblarge` PSB32 UI sessions, native tiled Worker Fill, mid-kernel owner-cancel/retry, exact native tile-byte Undo/Redo and memory sampler. The test observer is attached around the real Edit menu command and native `Worker.postMessage`; the payload is not changed.
- **New measurements:** monotonic renderer `performance.now()` menu-to-Worker handoff boundaries for first/cancel/retry; bounded 8 ms main-thread timer pulse intervals (max 256 per action, gaps explicit), optional sampled renderer heap snapshots, typed selection length/bytes, and retained CDP/Linux observational memory reports. These intervals include command overhead: not isolated scan CPU time, operation peak, PID association, or continuous event-loop coverage.
- **Files:** `tools/browser-selection-freeze-observer.mjs`, `tools/browser-large-psd16-smoke.mjs`, `tools/browser-operation-artifact.mjs`, `tests/browser-selection-freeze-observer.test.mjs`, `task/README.md`, `task/NEXT.md`, this task file.
- **Fail-closed checks:** strict receipt shape and chronological handoffs, typed-length agreement, cap/geometry, raw bounded pulse intervals, missed-pulse unknown, rejection of synthetic peak/PID claims and duplicate Worker handoff. Existing production fill kernel and generated bundle remain unchanged.
- **Acceptance state:** source edits committed; `npm run check`, real Chromium `file://` PR CI, JSON artifact verify, PR merge and exact-main CI **PENDING** until observed. Do not infer performance thresholds without runner data.
- **Outstanding:** broad dense/sparse UI selections near the 2,000,000 pixel bound; no-dispatch mid-freeze UI-owner cancellation; comparative baseline and possible optimization **if** reproducible latency is observed. Stage 003/003T OPEN; 002B/2c Photoshop-authored PSB32 provenance BLOCKED.
- **Next actionable step:** verify PR CI, fix observed issues; then add near-cap broad selection responsiveness and cancellation in genuine browser sessions, with bounded sampling and native byte/history assertions. Do not mark 003W DONE until all its original criteria pass.

## 2026-10-20 — initial genuine Chromium receipt (still IN PROGRESS)

- Initial PR-head `1e6828f` [CI #39434420916 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39434420916): `npm run check`, generated build diff hygiene, real Chromium `file://` PSD16/PSB32 + mid-kernel cancel/retry, native word-level Undo/Redo and [strict operation JSON verifier](../tools/verify-browser-operation-artifacts.mjs) PASSED. These are actual job log observations, not invented performance targets.
- **PSD16 real UI, 576 selected pixels:** first/cancel/retry menu→Worker handoff `191.8 / 183.6 / 213.3 ms`; sampled max 8ms-timer drift `32.4 / 25.9 / 21.3 ms`, observed p95 drift `2.4 / 4.7 / 5.4 ms`.
- **PSB32 real UI, 576 selected pixels:** first/cancel/retry handoff `226.5 / 199.7 / 218.4 ms`; sampled max drift `42.5 / 30.5 / 40.6 ms`, observed p95 drift `5.5 / 7.5 / 3.9 ms`.
- Observed renderer heap `91,700,000` bytes at the two test-only boundaries (Chromium-reported rounded values), NOT a peak, native Worker memory, process RSS or continuous sample. The inherited CDP/Linux sampler retains its separate observational gaps and limits. Both cases are generated by ZeTer, **not** independently Photoshop-authored PSB32.
- The 576-pixel case proves test-harness wiring and baseline measurement, **not** broad near-2M dense/sparse responsiveness. Baseline comparison and production optimization remain open. This task stays IN PROGRESS regardless of the PR's bounded measurement result.
- The doc changes in this commit require a **new final exact PR-head CI**, then merge and exact-main CI; earlier green run alone is not final-head acceptance.

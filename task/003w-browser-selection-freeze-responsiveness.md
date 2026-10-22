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

## 2026-10-20 — 003W/1 bounded measurement ACCEPTED; whole 003W remains IN PROGRESS

- [PR #305](https://github.com/zeter1/ZeTer-Photo-Editor/pull/305) merged into [main `b67203ff`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/b67203ff4b82ae7c1b2acd2f676c8a9fc40b4ccc).
- Exact final head `1ac643d5`: [CI #39435060082 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39435060082). Exact merged-code main `b67203ff`: [CI #39435572019 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39435572019), including `npm run check`, real Chromium `file://` PSD16/PSB32 native-byte/Undo/Redo/mid-kernel cancellation and strict artifact verification. There were no test failures on those exact runs.
- Genuine browser observations and measurement limitations are recorded in the preceding section. No production Fill behavior was modified by 003W/1.
- **Remaining P1 003W/2 IN PROGRESS:** extend to broad dense/sparse UI selections approaching 2,000,000 pixels, including correct safe refusal above cap; prove a real owner-cancel in selection freeze dispatches zero Worker jobs, preserves source/native pixels, preview and History; retain sampled gap/latency/heap/RSS metadata with strict validation. Compare against 003W/1 rather than inventing thresholds. Then finish the whole 003W acceptance only after new PR+main CI.
- **Still unresolved:** 003/003T memory peak and Worker→PID; P0 Photoshop-authored PSB32 provenance BLOCKED; no unsupported Photoshop parity claim.


## 2026-10-20 — 003W/2a broad real-browser pre-Worker cancellation (IN PROGRESS)

- Branch [test/003w2a-large-selection-predispatch-cancel-20261020](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w2a-large-selection-predispatch-cancel-20261020), based on main `3c415617`.
- Extend existing real `file://` Chromium PSD16 and PSB32 native tiled sessions after successful Worker/cancel/retry/Undo/Redo: actual overlay marquee geometry from (20,20) to (1005,1005) on 1025² canvas, bounding box 970,225 pixels. This is **not** a census of permitted UI selection indices.
- Enqueue a real `window` Escape keydown before the controller's first cooperative 0ms yield; require handled owner cancellation (default prevented and cancellation status), unchanged Worker job count, exact saved native tile-byte match to pre-cancel committed success, unchanged preview sample and exact History rows after cancellation. Includes a settling observation to reject late stale handoff.
- New `preDispatchCancellation` receipt within PSD16/PSB32 saved operation artifacts, strict verifier with bounded geometry, no illicit Worker dispatch, immutable source/preview/history and no additional peak/PID fields; negative unit tests for malformed claims. Existing sampled memory limitations remain.
- No production image kernel or generated browser bundle change. **PR-head CI / full browser / exact merged-main NOT VERIFIED at implementation checkpoint.** Do not call 003W DONE.
- **Next P1 003W/2b:** dense/sparse **actual** selection near the full 2,000,000-pixel Worker cap (and out-of-limit refusal), direct selection-freeze latency comparison, evidence gaps, native integrity on any successful path. Whole Stage 003/003T and Photoshop-authored PSB32 provenance remain unresolved.

## 2026-10-22 — 003W/2a accepted; 003W/2b-1 actual near-cap typed selection (IN PROGRESS)

- The preceding **003W/2a** [PR #306](https://github.com/zeter1/ZeTer-Photo-Editor/pull/306) was merged into [main `e2245d7b`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/e2245d7bd7e78260743974bf0b21951267d80407); exact-merged-main [CI #39441621631 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39441621631). It proves real PSD16/PSB32 broad marquee Escape cancellation before Worker dispatch, but not near-2M successful Worker throughput. Prior paragraph's pending state is historical.
- **Current 003W/2b-1, P1** on [branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w2b-near-cap-selection-counts-20261022): use real production `prepareTiledInpaintWithWorker` and serialized tiled RGBA16/RGBA32 source of **1450×1400 = 2,030,000 pixels**. Tests count real `isAllowed` calls and capture detached `Uint32Array`: exactly 2,000,000 selected (8,000,000 bytes) for partial PSD16 dense geometry; four exact sparse PSB32 indices; 2,000,001 selected PSB32 indices rejected without Worker dispatch or native-source modification.
- **Files:** `tests/tiled-inpaint-ui-near-cap-selection.test.mjs`, this task file, `task/NEXT.md`, `task/README.md`. Dependency: accepted 003U/003V/003W/2a. **Criteria for bounded 2b-1:** true near-cap typed counts, sparse count, fail-closed over-cap, exact unchanged original tile payloads, `npm run check`, PR-head CI, merge, exact-main CI.
- **Measurement limitations:** Worker stub returns an unchanged but structurally valid result, so these tests cover **selection freeze + result validation only**, not a real native inpainting computation, browser responsiveness, Undo/Redo, independent memory peak, or Worker PID. They complement rather than replace 003W/2a real Chromium integration.
- **State at initial implementation:** new tests committed, CI/PR/merge/exact-main NOT YET VERIFIED. No production bundle or runtime modification. No percent-complete claim.
- **NEXT after 2b-1:** **003W/2b-2**, real Chromium `file://` PSD16/PSB32 successful large dense/sparse Worker selection and >2M UI refusal with precise frozen index counts, sampled main-thread timing and explicit evidence gaps, real changed native bytes and Undo/Redo integrity; decide optimizations from measured baseline. Whole 003W remains IN PROGRESS; parent Stage 003/003T open, P0 002B/2c independent Photoshop-authored PSB32 provenance BLOCKED.

## 2026-10-22 — 003W/2b-1 accepted; 003W/2b-2 next (P1)

- **003W/2b-1 DONE:** [PR #307](https://github.com/zeter1/ZeTer-Photo-Editor/pull/307) merged into [main `0e2998af`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/0e2998af1d967106e9d2fd864fbc6a46c4cc3a98). Final PR-head `95b988c4` [CI #39735033708 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39735033708); exact merged-code main `0e2998af` [CI #39735427955 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39735427955). Node, generated parity, genuine Chromium `file://` smoke and pipeline checks passed.
- `tests/tiled-inpaint-ui-near-cap-selection.test.mjs` scans 2,030,000 actual pixels of serialized RGBA16/RGBA32 **synthetic native buffers** with production `prepareTiledInpaintWithWorker`: 2M dense frozen Uint32 indices (8M bytes), four sparse, >2M fail-closed refusal with no Worker dispatch and unchanged tile payloads. The test callback intentionally returns a structurally valid unchanged result: **not real near-cap Worker painting, PSD/PSB import, browser latency, isolated RAM peak, or Worker PID**.
- **NEXT 003W/2b-2 TODO, P1:** genuine Chromium `file://` near-2M dense/sparse successful PSD16/PSB32 native Worker Fill; >2M selection refusal; exact frozen counts, event-loop and memory sample gaps, native bytes, preview and Undo/Redo, strict persisted browser evidence. Keep parent 003W/003T/Stage 003 OPEN and independently Photoshop-authored PSB32 provenance 002B/2c BLOCKED.

## 2026-10-22 — current bounded 003W/2b-2a (IN PROGRESS)

- [Implementation and acceptance log](003w2b2a-browser-near-cap-ui.md): dedicated genuine Chromium file:// 1450×1400 ZeTer-authored PSD16 and PSB32 UI import with sparse actual Worker Fill, selected-count and exact native tile/alpha Undo/Redo evidence; partial >2M marquee rejection with no Worker/preview/History mutation; sampled event-loop and renderer heap limits explicitly marked as gaps/unknown. Independent isolated CI and strict saved JSON negative tests.
- [Working branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w2b2-real-near-cap-browser-20261022). **Tests/PR CI/merge/exact-main results pending**, no accepted real performance or near-cap dense success claims yet.
- Next after bounded 2b-2a: **003W/2b-2b**, successfully compute dense nearly 2M pixels through real Chromium PSD16/PSB32 production Worker with immutable native byte/Undo/Redo, event-loop/heap gaps and cancellation/resource evidence. Whole 003W/003T/Stage 003 OPEN; Photoshop-authored PSB32 provenance BLOCKED.

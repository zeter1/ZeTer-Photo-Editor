# 003W/2b-2e — Real dense Worker owner close and replacement

**Priority:** P1. **Status:** DONE (2026-10-22; real browser, PR CI, merge and exact-main verified).
**Parent:** [003W browser selection responsiveness](003w-browser-selection-freeze-responsiveness.md) / Stage 6.
**Dependencies:** [003W/2b-2d](003w2b2d-dense-owner-switch.md) DONE, [003W/2b-2c](003w2b2c-dense-worker-cancellation.md) DONE. Prior session/owner and dense-success scenarios exist; do not repeat their 576-pixel or same-document-only tests.

## Objective

Verify that closing the original owner tab while a real 1.9M–2M native PSD16/PSB32 production Blob Worker is **in flight** releases the pending transaction and cannot mutate any surviving/replacement document, render preview or History. Separately verify a rejected dirty-document close does **not** accidentally cancel or corrupt the active owner.

## Acceptance criteria

1. Fresh independent Chromium `file://` runs for ZeTer-generated native 1450×1400 PSD16 and PSB32 and a distinct second tab. Capture native tile bytes, alpha, visual preview, history and Undo availability for both.
2. Real overlay marquee + Edit menu dispatches 1.9M–2M frozen `Uint32Array` indices to real production Blob Worker; observe 0 replies at close initiation. Neither synthetic Worker mock nor bounding box alone qualifies.
3. Click the first tab's real close UI while the worker is in-flight. Prove actual tab count/owner changed, first Worker terminated before replying, persistence lease released, no ghost tab/reply/history after bounded settling and exact surviving document native bytes/alpha/preview/history. Test rejected dirty confirmation independently; it should not count as successful close.
4. Perform genuine new dense selected-only Worker Fill in surviving document, unchanged outside pixels and alpha; exact Undo/Redo; original cancelled Worker cannot publish late. Where technically meaningful test fresh-owner replacement/import and no stale authoring cross-over.
5. Add fail-closed per-format JSON receipts and negative validator tests with sampled 8ms timer and observational heap plus explicit unknown gaps. Keep 2M cap, 180s deadline; no isolated operation RAM/CPU or PID attribution.
6. Run `npm run check`, artifact parity, independent PSD16/PSB32 Chromium CI, real-photo, exact PR-head CI, merge only on green, then exact merged-code main CI and main real-photo. Record actual links and next task.

## Initial guide

Reuse `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-dense-owner-evidence.mjs`, `src/workspace/session-controller.js` close/cancel guard and separate smoke mode; do not conflate tab switch with tab removal. Keep original task [003W/2b-2d](003w2b2d-dense-owner-switch.md) DONE for its verified tab-switch scope. Stage 003/003W/003T OPEN and independent Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.

## Pass 2026-10-22 — in-flight dirty close test implementation

- Branch: [test/003w2b2e-dense-owner-close-20261022](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w2b2e-dense-owner-close-20261022).
- Implemented a distinct genuine Chromium `file://` UI scenario in `tools/browser-near-cap-ui-smoke.mjs`: two independently imported high-depth tabs, ~1.97M typed indices posted to production Blob Worker, rejected native dirty-close confirmation with unchanged running Worker, confirmed UI owner removal and Worker termination before reply, 1.25 s stale-result settling, exact surviving native bytes/alpha/preview/History, genuine selected-only dense successor, exact .zpe Undo/Redo and no ghost tab.
- Added strict per-format receipts `tools/browser-dense-close-evidence.mjs`, verifier and adversarial tests, `ZPE_DENSE_CLOSE_BROWSER_ONLY` smoke mode and independent GitHub Actions job. No production source changes.
- **CI / acceptance:** NOT YET VERIFIED at this checkpoint; no synthetic assertion can stand in for actual Chromium execution. Node `npm run check`, generated artifact parity, exact PR-head PSD16 + PSB32, real-photo, merge and exact-main must pass before DONE.
- **Risk:** dirty-close confirmation might differ by browser or import state; inspect real CI before accepting. No operation-isolated CPU/RSS peak or Worker PID attribution; Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains independently BLOCKED.
- Next: open PR, inspect real CI logs and strict receipts, repair failures, merge only if green, independently check exact-main.


## Acceptance — 2026-10-22, verified exact merged code

- [PR #312](https://github.com/zeter1/ZeTer-Photo-Editor/pull/312) merged as [main `0eb33f2968426146dccd0688de8a78ee5da8bb68`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/0eb33f2968426146dccd0688de8a78ee5da8bb68).
- Exact PR-head `d17235b5ab94e978a2eaf826cd6b13cd484ea2a7`: [CI #39775157739 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39775157739) and [real-photo #39775157799 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39775157799).
- Exact merged-code main: [CI #39776133973 attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39776133973) and [real-photo #39776133980 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39776133980). Initial main CI attempt 1 failed *before* application smoke during Chromium DevTools endpoint launch timeout; reran only failed `verify` job, which then passed. Do not count attempt 1 as green.
- Dedicated actual `file://` Chromium `dense-close-browser` PSD16 and PSB32 jobs and strict independent receipt validator PASS on both PR-head and exact merged code. 1.9M–2M frozen native indices reach genuine Blob Worker in-flight; dirty close refusal preserves owner/Worker, confirmed tab close removes owner and terminates Worker before reply, survivor unchanged native/preview/History after bounded settling, second dense Worker succeeds with selected-only color changes, alpha unchanged and exact Undo/Redo; no stale replies or ghost owner. Actual JS heap/timer are observational samples, not a peak/continuous timeline.
- `npm run check` (CI build/Node suite 1447 passed) and generated browser artifact parity PASS; no local checkout tests were run. Production source and format schema unchanged. Real photographs covered by separately passing real-photo workflow; close-specific source fixtures are ZeTer-authored and **not independently Photoshop-authored PSB32**.
- Files: `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-smoke.mjs`, `tools/browser-dense-close-evidence.mjs`, `tools/verify-browser-dense-close-evidence.mjs`, `tests/browser-dense-close-evidence.test.mjs`, `.github/workflows/ci.yml`, `task/README.md`, `task/NEXT.md`, this task file.
- **Acceptance state: DONE** for the bounded 003W/2b-2e close scenario. Parent 003W, 003T and Stage 003 remain IN PROGRESS. Worker→PID and operation-exclusive RAM/CPU peak are unknown; P0 Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED.
- **Next P1 [003W/2b-2f](003w2b2f-dense-owner-replacement.md):** actual in-flight document replacement (not tab close/switch) with dirty preflight rejection, native data and History isolation, real dense new-owner retry and fail-closed dual-format Chromium evidence.

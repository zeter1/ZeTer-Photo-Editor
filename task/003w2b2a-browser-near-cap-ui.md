# 003W/2b-2a — Genuine >2M browser source, sparse success and over-cap refusal

**Priority:** P1. **Status:** IN PROGRESS (2026-10-22, awaiting CI).
**Parent:** [003W](003w-browser-selection-freeze-responsiveness.md) / 003W/2b-2 / Stage 6.
**Dependencies:** 003W/1, 003W/2a, 003W/2b-1 DONE; real Chromium file:// and native tile Worker available.

## Goal and bounded acceptance

On genuine Chromium file://, import ZeTer-generated native tiled **PSD16** and **PSB32** documents with **1450×1400 = 2,030,000 pixels** through the real File input, rather than inferring Worker correctness from the test-double 2b-1 Node run.

1. One real small/sparse marquee must reach the production Blob Worker. Record the actual typed selectedIndices length and bytes, not only a guessed rectangular bounding box. Prove selected-only native color mutation with independent saved .zpe tile-byte oracle, unchanged alpha, exact Undo/Redo.
2. A subsequent >2M partial real overlay marquee must be rejected with the actual 2,000,000-pixel safety-limit status, **zero additional Worker jobs**, unchanged native tile bytes, preview and History.
3. Persist strict PSD16/PSB32 receipts containing bounded 8 ms renderer-timer pulses, observed refusal wall latency, heap snapshots or explicit nulls, and explicit unknown Worker→PID, CPU and operation-peak claims. Reject forged fields or unsupported proof.
4. Run focused Node receipt-negative tests, full npm check and an independent fresh-profile Chromium file:// job per source bit-depth. Require PR CI, merge and exact-main CI before marking DONE.

## Implementation in this passage

- tools/browser-high-depth-fixtures.mjs: generates two >2M geometry 16/32-bit PSD/PSB inputs using ZeTer encoder; not independently Photoshop-authored.
- tools/browser-near-cap-ui-smoke.mjs: real import, native snapshot through File > Save Project, overlay/mouse marquee, production Worker census, selected-only native/alpha oracle, Undo/Redo, large partial selection refusal, bounded renderer sampling and saved evidence.
- tools/browser-near-cap-evidence.mjs and tools/verify-browser-near-cap-evidence.mjs: strict persisted fail-closed receipts.
- tests/browser-near-cap-evidence.test.mjs: negative receipt mutation cases.
- tools/browser-smoke.mjs: isolated opt-in, leaves ordinary smoke path unchanged.
- .github/workflows/ci.yml: separate fresh-profile real-browser job.
- task/NEXT.md, task/README.md, task/003w-browser-selection-freeze-responsiveness.md, this file: continuity.

## Execution and verification

At initial commit: Node tests NOT YET RUN locally: GitHub DNS unavailable, no repository checkout. PR CI PENDING, real-browser generated artifacts PENDING, merge PENDING, exact-main CI PENDING. Do not claim working scenarios solely from committed code.

CI gates: npm run check, generated bundle diff hygiene, separate near-cap-browser PSD16 and PSB32 independent file:// smoke, persisted evidence verification, no browser runtime errors, and diff hygiene. Record actual CI URLs, observed counts/timings, and repair failures before accepting.

## Explicit scope boundary / next task

**003W/2b-2b — TODO P1:** true successful **dense ~2M frozen selected indices** plus actual inpainting Worker completion in Chromium file://, native word and Undo/Redo exactness, cancellation/resource/latency measurements; optimize only from observed bottlenecks. Sparse success and >cap refusal are not that proof. Full 003W, 003T and Stage 003 remain IN PROGRESS; isolated operation memory peak, verified Worker→OS PID, and Photoshop-authored PSB32 provenance ([002B/2c](002b2c-photoshop-psb32-provenance.md)) remain unresolved / BLOCKED where applicable.

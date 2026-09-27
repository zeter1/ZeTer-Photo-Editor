# Task 034 — Owner-bound Canvas8 raster persistence after PNG encoding

## Purpose

Close the next verified stale-owner window in the shared Canvas8 raster persistence path without broadening this pass into a full paint/retouch redesign.

Current evidence on `main`:

- `src/painting/controller.js::persistPaintLayer()` captures `brushLayerId` and `brushCanvas`, then awaits `canvasToDataURL(canvas, 'image/png')`.
- After that await it resolves the publication target through mutable `currentDocument().layers.find(item => item.id === layerId)`.
- A document/tab replacement while PNG encoding is pending can therefore make late work consult a different active document; a same-ID layer in a replacement document is especially dangerous.
- Canvas8 callers include one-shot raster commands in `src/painting/command-controller.js` and paint/retouch stroke finalization in `src/painting/gesture-controller.js`.

This task is intentionally **Canvas8-only**. Native high-depth persistence has related async ownership questions, but it should be inspected and queued separately unless a minimal shared primitive is strictly required for correctness.

## Required design

1. Inspect the current painting controller, command controller, gesture controller, their direct tests, async-document regressions, architecture docs, and canonical build graph before changing code.
2. Make Canvas8 persistence explicitly owner-bound:
   - carry the originating document authority into persistence;
   - carry enough exact target identity to reject a replaced layer even when IDs match;
   - do not choose a publication target by rereading mutable global/current document state after PNG serialization.
3. Revalidate authority immediately after `await canvasToDataURL(...)` and before the first persisted layer write.
4. Same-ID document or layer replacement must be stale; object identity or an equivalently strict identity contract must prevent redirected publication.
5. A stale persistence result must produce:
   - no `dataUrl` / high-depth metadata write;
   - no history/dirty publication by the caller;
   - no success status;
   - no mutation of a newly active/replacement document.
6. Keep the existing shared `paintPersisting` exclusion; do not add a Canvas8-private busy flag.
7. Preserve normal Canvas8 behavior, selection clipping, layer geometry, cache invalidation, Russian status/toast text and history labels unless a proven bug requires a bounded change.
8. Keep `src/painting/controller.js` the shared raster-edit state owner. Update `painting/command-controller.js` and `painting/gesture-controller.js` only as needed to hand off owner/target authority; do not refactor the whole stroke lifecycle in this pass.
9. Inspect whether `brushLayerId` alone can wrongly reuse a buffer across document replacement. If this is required to make persistence safe, add the smallest owner-aware buffer identity fix and direct regression; otherwise record a separate next task rather than expanding scope.
10. Do not weaken source-contract tests or recreate compatibility globals when extraction/wiring moves. Retarget test harness dependencies to the canonical owner.

## Regression tests

At minimum cover:

- delayed `canvasToDataURL` + active-document switch;
- delayed serialization + same-ID replacement document;
- same-ID replacement layer within the originating owner;
- normal successful persistence;
- serialization failure / cleanup behavior;
- caller history and success status are suppressed for stale persistence;
- shared busy guard remains released through caller `finally`;
- the nearest command and paint-gesture tests prove explicit owner/target handoff;
- architecture/source guard prevents mutable-current-document publication from returning after the await.

Prefer controllable deferred Promises over timing-based tests.

## Documentation

If the resulting contract is broader than the Gradient-specific spec, add the smallest targeted painting/raster-persistence specification and link it from:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/development/AI_WORKFLOW.md`
- `docs/testing/TEST_MATRIX.md`

Do not duplicate implementation prose across all files; use progressive disclosure and route future agents to the canonical owner/spec/tests.

## Verification

Required before completion:

1. targeted direct controller/caller regressions;
2. adjacent async-document, painting-command and painting-gesture tests;
3. `npm run check`;
4. canonical generated-artifact parity;
5. `npm run test:browser`;
6. `git diff --check`;
7. focused final diff review;
8. exact PR-head CI green;
9. squash/merge only the verified head;
10. merged-`main` CI green.

Delete this task only after implementation is merged and the exact merged-`main` CI is green. Then create exactly one evidence-based next task.

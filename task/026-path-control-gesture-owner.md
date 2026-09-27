# Task 026 — extract existing Bézier path-control gesture transaction owner

## Goal

Move the **interactive editing transaction for existing Bézier anchors/handles** out of `src/main.js` behind one narrow, directly testable owner while preserving the current Pen/path UX for:

- shape paths;
- vector masks;
- saved document paths.

This task is only the existing `path-control` drag lifecycle:

`begin/captured target+baseline → live pointer preview → finish/history OR cancel rollback`.

Do **not** merge this with new-path `penDraft` / `pen-handle` creation.

## Why now / fresh evidence

Post-task-025 inspection of merged main `691fb9390de779575f7d9e1cefa27d02e7e91c0b` found the next bounded transaction seam still owned directly by the composition root:

- `beginPathControlDrag()` in `src/main.js` captures node state and creates `drag.kind === 'path-control'`;
- `onOverlayPointerMove()` re-resolves through current global `doc`, converts document coordinates to layer-local coordinates, mutates anchors/handles, handles Alt symmetry breaking, and decides the movement threshold;
- `onOverlayPointerUp()` separately chooses six source/control-specific history labels;
- `restorePathControlDrag()` separately re-resolves through current global `doc` and restores the baseline;
- both pointer cancel and Escape call that rollback path;
- existing source tests in `tests/advanced-tools-v120.test.mjs` and `tests/vector-masks.test.mjs` still pin this implementation to `src/main.js`.

There is also a correctness smell worth regression-locking: the current move branch can mutate a node even when `distance <= 1 / zoom`, set `moved=false`, and then finish with **zero history**, leaving sub-threshold geometry changed without an Undo entry. The refactor must make preview/no-op/history semantics explicit instead of carrying this ambiguity forward.

## Scope

1. Inspect all existing path-control flows before changing code:
   - shape path target resolution;
   - vector-mask subpath target resolution;
   - saved document-path target resolution;
   - anchor drag;
   - handleIn / handleOut drag;
   - Shift+anchor drag promotion to `handleOut`;
   - Alt symmetry breaking;
   - zoom-dependent movement threshold;
   - final history publication;
   - pointercancel and Escape rollback;
   - effective recursive layer locking;
   - document/session switching guards during active edit.
2. Prefer a focused owner such as `src/interaction/path-control-gesture-controller.js` if inspection confirms the boundary.
3. Capture the exact originating document object and a stable target locator at begin:
   - layer-backed target: stable layer ID plus exact layer identity;
   - saved document path: stable saved-path ID when available instead of trusting only a mutable array index;
   - capture exact subpath/node identity (or an equally strong generation/identity guard) so a same-index/same-ID replacement is not silently edited.
4. Re-resolve and revalidate the exact target before each update/finalize/cancel. Never redirect writes to the current/replacement document, path, layer, subpath, or node.
5. Preserve canonical coordinate semantics:
   - layer-backed path controls use `documentPointToLayerPixel()`;
   - saved document paths remain in document coordinates;
   - anchor movement preserves relative handle offsets;
   - handle drag preserves current smooth-mirroring behavior;
   - Alt+handle drag breaks symmetry and produces the current corner behavior;
   - Shift+anchor drag keeps the current `handleOut` gesture behavior.
6. Make threshold/no-op policy explicit:
   - movement inside the current `1 / zoom` threshold must not leave persisted geometry without history;
   - a gesture that finishes semantically at its baseline publishes zero history;
   - a real change publishes exactly one history entry.
7. Preserve the existing source/control history labels exactly:
   - shape path: `Переместить Bézier-узел` / `Изменить Bézier-ручку`;
   - vector mask: `Переместить узел векторной маски` / `Изменить ручку векторной маски`;
   - saved document path: `Переместить узел сохранённого контура` / `Изменить ручку сохранённого контура`.
8. Make pointercancel and Escape use the same controller rollback primitive.
9. Keep hit-testing, selected-path discovery, control drawing, cursor/status text and DOM Pointer Events capture in their existing presentation/composition boundaries.
10. Update build graph, AI routing/docs, test matrix and `CHANGELOG.md`.

## Non-scope

- Do not refactor creation of new paths (`penDraft`, `pen-handle`, `beginPenPoint()`, `finishPenPath()`) in this pass.
- Do not redesign path hit-testing/control visuals/cursors.
- Do not refactor saved-path CRUD in `src/ui/paths-controller.js`.
- Do not change vector-mask serialization, PSD semantics or project schema.
- Do not redesign the synchronous Alt+click “convert anchor to corner” command unless a tiny shared helper is required to avoid duplication; keep the drag transaction bounded.
- Do not create a generic all-vector/all-pointer framework.
- Do not change Pointer Events registration/capture in `src/interaction/pointer-lifecycle-router.js`.

## Inspect first

At minimum:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `src/main.js`
- `src/interaction/pointer-lifecycle-router.js`
- `src/ui/paths-controller.js`
- `src/core/state.js`
- `tests/advanced-tools-v120.test.mjs`
- `tests/vector-masks.test.mjs`
- `tests/paths-controller.test.mjs`
- `tests/pointer-release-tools.test.mjs`
- architecture/source-ownership tests;
- workspace/session tests that cover pending document edits.

Search for every `path-control`, `restorePathControlDrag`, `pathTargetPoints`, and all six history labels before deciding the final seam.

## Required regressions

Direct public-controller tests should cover at minimum:

1. Shape-path anchor live move updates anchor and translates both handles from the captured baseline.
2. Shape-path handle drag mirrors the opposite handle and marks the node smooth.
3. Alt+handle drag breaks symmetry and keeps the opposite handle unchanged according to current UX.
4. Shift+anchor begin keeps the existing `handleOut` gesture semantics.
5. Vector-mask target resolves against the originating exact layer/subpath/node.
6. Saved document-path target resolves by stable path identity, not merely the current array index.
7. Zoom-dependent threshold: sub-threshold release leaves baseline geometry and zero history.
8. Real shape anchor change publishes exactly one `Переместить Bézier-узел`.
9. Real shape handle change publishes exactly one `Изменить Bézier-ручку`.
10. Vector-mask anchor/handle labels remain exact.
11. Saved-path anchor/handle labels remain exact.
12. Return-to-baseline semantic no-op publishes zero history.
13. Pointercancel restores the exact captured baseline.
14. Escape delegates to the same cancel primitive.
15. Stale document before update/finalize/cancel causes no redirected write/history.
16. Same-ID layer replacement is rejected.
17. Replaced saved path/subpath/node at the same index is rejected.
18. Missing target is rejected.
19. Layer becomes recursively locked mid-gesture → no further write/history.
20. Architecture/source guard proves `src/main.js` delegates path-control mutation/finish/rollback and old source tests are retargeted rather than weakened.

## Behavioral / safety contracts

### Exact owner and target

The transaction belongs to the document object, target container and node captured at begin time. Stable IDs help re-resolution, but IDs alone are not permission to mutate a replacement object.

### Preview versus history

Live preview may mutate the exact captured node in place, but history is published only by successful finalization. No pointermove may create history.

### No uncommitted micro-mutation

The current `1 / zoom` drag threshold must not permit a changed node to survive while history remains unchanged. Either keep/restore baseline for a no-op or publish a real semantic change; never leave a hidden third state.

### Cancellation

Rollback may restore only the exact active owner/target. A stale/replaced target is rejected rather than receiving the captured baseline.

### Boundary discipline

The gesture owner owns transaction semantics, not DOM listeners, path list UI, hit-testing visuals, saved-path CRUD, PSD serialization or new-path drafting.

## Verification

Use the current project gates:

1. focused new path-control gesture-controller tests;
2. retargeted `tests/advanced-tools-v120.test.mjs`;
3. retargeted `tests/vector-masks.test.mjs`;
4. relevant paths/pointer/workspace regressions;
5. architecture/source guard;
6. full `npm run check`;
7. generated `src/app.bundle.js` / `index.html` / `version.json` parity;
8. Chromium `file://` browser smoke;
9. `git diff --check`;
10. exact PR-head CI green;
11. guarded merge;
12. exact merged-main push CI green.

## Done gate

Only after the exact merged-main SHA is green:

- delete this task;
- inspect fresh main;
- create exactly one next bounded task;
- verify any queue-housekeeping main commit with its own exact push CI.

## Risks / handoff notes

- Do not “fix” stale-target safety by relying on the UI currently blocking tab switching during pending edits; keep the transaction correct on its own boundary.
- Do not replace existing source tests with weaker assertions. Retarget behavioral invariants to direct controller tests plus a small structural delegation guard.
- Avoid coupling the gesture controller to global `doc`, `drag`, DOM elements or path-panel state.
- Preserve the distinction between editing an existing path-control and drafting a brand-new Pen path.

# Task 025 — extract interactive Move / Resize / Rotate gesture transaction owner

## Goal

Move the **interactive selected-layer transform gesture transaction** out of `src/main.js` behind one narrow, directly testable owner while preserving the existing Move / Resize / Rotate UX exactly.

This task is about the live gesture transaction only:

`begin/captured baseline → pointer updates/live preview → final release/history OR cancel rollback`.

Do **not** mix it with discrete transform commands that already belong to `src/layers/transform-command-controller.js`.

## Why now / fresh evidence

Post-task-024 inspection of merged main `e554c0e2c593472a4f530164ac044bd32b209304` found the largest remaining transform-policy cluster still owned directly by the composition root:

- `onOverlayPointerDown()` builds Move / Resize / Rotate drag baselines in `src/main.js`;
- `onOverlayPointerMove()` directly mutates layer `x/y/scaleX/scaleY/rotation`;
- Move additionally owns Shift axis lock + Smart Snap application and guide publication;
- Resize calls canonical `resizeLayerFromPoint()` but writes the candidate directly;
- Rotate calls canonical `rotationFromDrag()` but writes the candidate directly;
- `onOverlayPointerUp()` separately decides whether to publish `Перемещение слоя`, `Изменить размер слоя`, or `Повернуть слой`;
- `onOverlayPointerCancel()` separately restores each gesture baseline;
- release-point correctness is already protected by `tests/pointer-release-tools.test.mjs`;
- `tests/editor-interactions.test.mjs` still source-checks Shift/Alt resize behavior in `main.js`.

The existing `src/layers/transform-command-controller.js` owns **discrete** nudge / center / align / fit-to-canvas commands. It must not become a mixed live-pointer state machine unless inspection proves that doing so is cleaner than a separate interaction owner.

## Scope

1. Inspect all current Move / Resize / Rotate pointer paths before changing code:
   - pointer down baselines;
   - live pointer update;
   - final release point application;
   - commit/no-op decision;
   - pointer cancel rollback;
   - Smart Snap + guide lifecycle;
   - cursor/property-panel/render/overlay side effects;
   - document/session switching and lock behavior during an active gesture.
2. Prefer a focused owner such as `src/interaction/layer-transform-gesture-controller.js` if current boundaries confirm the live gesture lifecycle is distinct from discrete transform commands.
3. Capture the exact originating document + stable layer ID when a transform gesture begins.
4. Re-resolve the exact target on every update/finalize/cancel; never silently mutate a replacement/current document just because global `doc` changed.
5. Preserve canonical transform math:
   - Move: current Shift axis-lock and Smart Snap semantics;
   - Resize: `resizeLayerFromPoint()`, min-size `Math.max(2, 6 / zoom)`, Shift aspect lock, Alt from-center;
   - Rotate: `rotationFromDrag()`, current center/start semantics, Shift 15° snapping.
6. Preserve the “release without final pointermove” contract: final pointer position must still be applied before finalization.
7. Make finish/no-op/history policy explicit:
   - real Move → exactly one `Перемещение слоя`;
   - real Resize → exactly one `Изменить размер слоя`;
   - real Rotate → exactly one `Повернуть слой`;
   - no semantic transform → zero history;
   - stale/missing/locked target → zero persisted write/history.
8. Make cancel rollback atomic against the captured owner/target and baseline. Cancellation must not restore geometry into a different/replacement document or layer.
9. Keep DOM event registration/capture in `src/interaction/pointer-lifecycle-router.js`; keep composition/tool selection/status wiring in `src/main.js`.
10. Update canonical AI routing/docs + build graph + `CHANGELOG.md`.

## Non-scope

- Do not change discrete `nudge / center / align / fitToCanvas` behavior in `src/layers/transform-command-controller.js` except a tiny shared pure helper if review proves it eliminates real duplication without merging owners.
- Do not refactor Crop, selection, paint, line, shape, gradient, Pen/path-control or pan gestures.
- Do not redesign transform handles, cursors, Smart Snap visuals, property panels, zoom or viewport behavior.
- Do not change persisted document/layer schema.
- Do not create a generic “all pointer gestures” framework.
- Do not change transform labels or user-facing keyboard/modifier semantics.

## Inspect first

At minimum:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `src/main.js`
- `src/interaction/pointer-lifecycle-router.js`
- `src/layers/transform-command-controller.js`
- `src/core/geometry.js`
- `src/core/state.js`
- `tests/pointer-release-tools.test.mjs`
- `tests/editor-interactions.test.mjs`
- `tests/layer-transform-command-controller.test.mjs`
- workspace/session tests that cover document switching.

Also search for all direct writes of `x/y/scaleX/scaleY/rotation` and the three history labels before deciding the final boundary.

## Behavioral / safety contracts

### Owner identity

A live gesture belongs to the exact document object captured at begin time plus a stable layer ID.

If the current document becomes another object before update/finalize/cancel, the gesture must not mutate that new document. Structural equality is not identity.

### Lock / target revalidation

Do not rely only on the lock state captured on pointer down. Re-resolve the layer and effective recursive lock policy before mutation/final publication.

### Preview versus history

Live pointer preview may mutate the captured target in place exactly as today, but publication remains a separate explicit finish step.

A preview update is not a history commit.

### Semantic no-op

Move already tracks a small epsilon. Extend no-op reasoning carefully to Resize / Rotate so click/degenerate release cannot fabricate Undo merely because a pointer branch ran. Preserve user-visible behavior; use tiny float tolerance only where mathematically appropriate.

### Cancellation

Cancel must restore only the baseline captured by that same gesture owner/target. Stale/missing/replaced owner must be rejected rather than writing the baseline into unrelated state.

### UI side effects

Rendering, transform-property refresh, overlay drawing, Smart Guides and cursor changes are runtime/presentation capabilities. Pass narrow ports; do not move DOM ownership into the gesture transaction module.

## Suggested shape

Prefer a small explicit API after inspection, for example:

```js
createLayerTransformGestureController({
  state: { getDocument },
  geometry: { resizeLayerFromPoint, rotationFromDrag, snapLayerMove },
  transaction: { commit },
  runtime: {
    render,
    refreshTransformProperties,
    drawOverlay,
    setSmartGuides,
    clearSmartGuides,
    visibleSnapTargetRects,
  },
})
```

Possible methods:

```js
beginMove(owner, layerId, pointer, options)
beginResize(owner, layerId, handle, pointer, options)
beginRotate(owner, layerId, pointer, options)
update(gesture, pointer, modifiers)
finish(gesture, pointer, modifiers)
cancel(gesture)
```

This is intent, not a mandatory interface. Keep the smallest interface supported by the actual code.

## Required regressions

Direct public-controller tests should cover at minimum:

1. Move live update and exactly-one finish commit.
2. Move Shift axis lock.
3. Move Smart Snap candidate + guide port behavior without moving Snap math into UI glue.
4. Resize Shift aspect lock and Alt from-center inputs reach canonical geometry.
5. Rotate Shift 15° snap input reaches canonical geometry.
6. Final release position is applied even when no final pointermove occurred.
7. Semantic no-op finish publishes zero history.
8. Cancel restores Move baseline.
9. Cancel restores Resize baseline.
10. Cancel restores Rotate baseline.
11. Stale document before update → no write.
12. Stale document before finish → no history.
13. Structurally equal replacement document → rejected.
14. Missing/replaced target layer → rejected.
15. Layer becomes recursively locked mid-gesture → no further write/history.
16. Cancel after document switch does not restore into the new document.
17. Architecture/source guard proves `main.js` delegates and no longer directly owns the three mutation/commit/cancel branches.
18. Existing pointer-release and editor-interaction contracts are retargeted to the canonical owner instead of weakened/deleted.

## Verification

Use the current project gates:

1. focused new gesture-controller tests;
2. `tests/pointer-release-tools.test.mjs`;
3. `tests/editor-interactions.test.mjs`;
4. `tests/layer-transform-command-controller.test.mjs`;
5. pointer lifecycle + workspace/session regressions;
6. architecture/source guard;
7. full `npm run check`;
8. generated `src/app.bundle.js` / `index.html` / `version.json` parity;
9. Chromium `file://` browser smoke;
10. `git diff --check`;
11. exact current PR-head CI green;
12. guarded merge;
13. exact merged-main push CI green.

## Done gate

Only after the exact merged-main SHA is green:

- delete this task;
- inspect fresh main;
- create exactly one next bounded task;
- if queue housekeeping is a separate main commit, verify its exact push CI too.

## Risks / handoff notes

- The main correctness risk is accidentally treating preview mutation as a normal discrete command and creating history on every pointermove. Do not.
- The second risk is restoring/finishing through global `doc` after a document switch. Capture owner identity at begin.
- The third risk is breaking release-without-final-move behavior while moving finalization. Preserve it explicitly in tests.
- Smart Guides are presentation state; keep their lifecycle narrow and do not turn the controller into a workspace/UI monolith.
- Do not weaken old VM/source tests merely because source moved. Retarget invariants to the new public seam + one structural wiring guard.

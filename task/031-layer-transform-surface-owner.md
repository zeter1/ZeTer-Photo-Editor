# 031 — Extract selected-layer transform surface owner

## Goal

Move the **read-only selected-layer Move / Resize / Rotate surface** out of the large `src/main.js` composition root into one focused interaction owner.

Task 023/024-style transform work already established separate owners for discrete transform commands and the interactive transform transaction. The remaining read-only canvas surface is still split across `drawOverlay()`, cursor helpers and the Move pointer-down branch. This pass should make that surface as explicit and searchable as the existing Bézier surface owner, without moving transform mutation/history back together with presentation.

## Why now / evidence

Fresh `main` after task 030 / PR #56 is approximately 2.9k lines. The largest function is still `drawOverlay()`, and the selected-layer transform surface alone spans several responsibilities in `src/main.js`:

- selected-layer frame drawing is embedded near the end of `drawOverlay()`;
- `interactiveRotationHandlePoint(layer)` computes the zoom-aware, canvas-clamped rotate control;
- `cursorForHandle(handle, layer)` maps layer rotation to resize cursors;
- `updateMoveCursor(point)` duplicates visibility/lock/handle rules used by pointer-down;
- the Move branch of `onOverlayPointerDown()` independently redoes rotate-handle and resize-handle hit tests;
- `topLayerAt(point)` chooses the topmost editable transform target;
- direct transform mutation itself is already owned by `src/interaction/layer-transform-gesture-controller.js`.

This is a coherent **read-only discovery / hit / draw / cursor** boundary. Keeping it in `main.js` now creates policy duplication around the already-extracted transaction owner.

## Source of truth / inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `src/main.js` around:
   - `drawOverlay()`;
   - `isTransformableLayer()`;
   - `topLayerAt()`;
   - `interactiveRotationHandlePoint()`;
   - `cursorForHandle()`;
   - `updateMoveCursor()`;
   - the Move branch in `onOverlayPointerDown()`.
6. `src/interaction/layer-transform-gesture-controller.js`
7. `src/layers/transform-command-controller.js`
8. transform geometry in `src/core/geometry.js` (`layerFrame`, `frameBounds`, `rotationHandlePoint`, `hitLayerHandle`, `pointInLayer`)
9. lock/visibility semantics in `src/core/state.js`
10. source-sliced/VM tests before changing caller dependencies:
    - `tests/pointer-release-tools.test.mjs`;
    - `tests/editor-interactions.test.mjs`;
    - `tests/advanced-tools-v120.test.mjs`;
    - `tests/architecture-layout.test.mjs`;
    - any other `runInNewContext`, `vm`, `eval`, `slice/indexOf` or regex/source guards touching Move pointer-down, cursor or overlay code.

Current code, runtime behavior, GitHub and CI override this task if they diverge.

## Preferred boundary

Prefer one small owner such as:

`src/interaction/layer-transform-surface-controller.js`

if inspection confirms the name and dependency shape.

The owner may cover the **read-only surface only**:

- transformable-layer eligibility for the canvas transform surface;
- exact selected/display-layer resolution needed for frame presentation;
- topmost visible + unlocked transformable layer discovery for Move targeting;
- zoom-aware selected-layer frame drawing;
- locked/unlocked and Move/non-Move presentation policy;
- resize handles and rotation control presentation;
- canvas-clamped interactive rotation-handle point;
- selected control hit classification such as rotate vs resize + handle identity;
- rotated resize cursor mapping;
- idle Move cursor classification;
- layer name-badge geometry/presentation.

Use narrow explicit state/runtime/geometry ports. Prefer semantic results (for example control hit/cursor intent) over hidden DOM writes where practical.

`src/main.js` should remain the composition root that:

- routes pointer events;
- chooses whether the Move tool branch runs;
- changes selected layer identity when a body target is chosen;
- starts `layerTransformGestures.beginMove/beginResize/beginRotate`;
- applies the returned cursor to the overlay if the surface itself is kept DOM-free;
- preserves overlay draw ordering relative to crop/selection/Pen/brush/guides.

## Behavioral contracts to preserve

### Frame visibility and style

- A selected visible transformable layer is highlighted **even outside Move mode**.
- Adjustment layers remain non-transformable for this surface.
- Hidden selected layers render no transform frame.
- Locked selected layers remain visibly outlined outside/inside Move mode but expose no interactive resize/rotate controls.
- Existing accent policy remains:
  - locked → `#aeb6c4`;
  - unlocked Move mode → `#69a0ff`;
  - unlocked non-Move selection → `#5ee7ff`.
- The black backing stroke and current zoom-scaled line widths/dashes remain unchanged.
- Outside Move mode, corner dots remain presentation-only.
- In Move mode on an unlocked layer, resize handles + rotate handle remain visible.

### Geometry / zoom

- Frame geometry continues to use canonical `layerFrame(layer)` / `frameBounds(layer)`.
- Rotation handle continues to start from `rotationHandlePoint(layer, 30 / zoom)`.
- Rotation-handle display/hit point remains clamped into the document using the current zoom-aware inset policy.
- Rotation hit tolerance remains `10 / zoom`.
- Resize-handle hit tolerance remains `10 / zoom`.
- Label font/padding/height/bounds stay zoom-stable and its badge remains clamped inside the document.
- Layer name fallback remains exact `Слой`.

### Cursor / hit / target discovery

- Rotated resize cursors preserve the current 45-degree bucket mapping.
- Idle Move cursor precedence remains:
  1. unlocked selected layer rotate control → `grab`;
  2. unlocked selected layer resize handle → rotated resize cursor;
  3. pointer inside unlocked visible selected layer → `move`;
  4. otherwise → `default`.
- Move pointer-down precedence remains:
  1. rotate selected unlocked visible transformable layer;
  2. resize selected unlocked visible transformable layer;
  3. if selected layer cannot receive body move at the point, choose the **topmost** visible + unlocked transformable layer under the point;
  4. begin move for that target.
- Layer z-order targeting continues to inspect the document layers in reverse.
- Recursive lock semantics must continue to use canonical `isLayerLocked(owner, layer)`; do not downgrade to `layer.locked`.

### Ownership

- Surface owner must publish **no document mutation and no history**.
- Interactive mutation/history/cancel/no-op policy stays in `layer-transform-gesture-controller.js`.
- Discrete nudge/center/align/fit stays in `layers/transform-command-controller.js`.
- Smart Snap geometry/history stays with the gesture owner; drawing smart-guide lines may remain in `main.js` unless inspection proves a smaller independent read-only owner.
- Generic pointer capture remains in `pointer-lifecycle-router.js`.
- Text-edit preview ownership remains in `text-edit-controller.js`; the surface may receive the display layer through a read-only port rather than importing text edit policy.

## Non-scope

Do **not** combine this pass with:

- changing Move/Resize/Rotate interaction behavior;
- transform transaction/history refactor;
- discrete transform command refactor;
- Smart Snap algorithm redesign;
- crop/selection/Pen/brush/clone-guide overlay extraction;
- a full `drawOverlay()` renderer rewrite;
- text-edit transaction redesign;
- layer-panel selection/drag-and-drop changes;
- generic pointer capture changes;
- unrelated Properties-panel refactoring.

Do not create a giant all-overlay controller. This task is only the selected-layer transform surface.

## Planned extraction

1. Inventory every selected-layer transform-surface read in `drawOverlay`, Move hover cursor and Move pointer-down.
2. Inventory source-sliced/VM tests **before** changing those callers and explicitly update their harness dependencies if needed.
3. Define one read-only surface API, preferably separating:
   - `draw(ctx)`;
   - selected-control hit test / target discovery;
   - idle Move cursor intent.
4. Consolidate rotate-handle projection and resize-cursor policy so hover and pointer-down cannot drift.
5. Make pointer-down consume semantic surface results and delegate actual mutation to `layerTransformGestures`.
6. Keep draw ordering identical.
7. Add the owner to `tools/build-bundle.mjs`.
8. Update AI routing docs so future agents inspect:
   - transform read-only target/hit/draw/cursor → new surface owner;
   - interactive transform transaction → `layer-transform-gesture-controller.js`;
   - discrete transform commands → `layers/transform-command-controller.js`;
   - pointer dispatch → `main.js`.
9. Regenerate browser artifacts canonically.

Prefer a minimal diff.

## Targeted tests

Add direct tests for at least:

- transformable vs adjustment eligibility;
- selected visible layer frame outside Move mode;
- locked selected-layer presentation with no interactive controls;
- unlocked Move handles/rotation control;
- rotate handle projection/clamping at canvas edges;
- `10 / zoom` rotate-hit boundary;
- `10 / zoom` resize-hit delegation;
- rotated resize cursor mapping;
- idle cursor precedence;
- topmost target discovery with hidden/locked/adjustment exclusions and recursive group locks;
- label fallback/placement contract where testable without brittle pixel snapshots;
- no state/history side effects from read-only surface methods;
- composition-root wiring delegates draw/hit/cursor instead of recreating their policy;
- pointer-down still starts the canonical gesture owner with exact layer/handle/center data.

Retarget the current `advanced-tools-v120` source assertion for selected-layer highlighting to the canonical surface owner. Scope architecture/source guards to this boundary instead of globally banning geometry helpers that may be valid elsewhere.

## Required verification

- direct layer-transform-surface tests;
- existing layer-transform gesture/command tests;
- affected pointer/editor-interaction/advanced/architecture regressions;
- `npm run check`;
- canonical generated `src/app.bundle.js` / `index.html` / `version.json` parity;
- `npm run test:browser`;
- `git diff --check`;
- PR CI green on latest head SHA;
- after merge, main push CI green.

## Done gate

Only after merge + green main CI:

- delete this task file;
- create exactly one next bounded task from fresh `main` evidence;
- do not assume the next hotspot before re-inspecting current code.

## Risks / handoff notes

Primary risk: accidentally mixing **read-only surface policy** with the existing transform transaction. The new owner should never commit history or mutate transform geometry.

Second risk: frame drawing currently accepts `textEditController.previewLayer(doc) || selected()`. Preserve that presentation behavior through an explicit read-only port; do not silently switch to selected-only rendering.

Third risk: cursor and pointer-down currently duplicate the same rotate/resize hit rules. The extraction should intentionally collapse that duplication into one semantic hit policy, while preserving exact precedence/tolerances.

Fourth risk: pointer tests use source slicing / `node:vm`. Any delegated dependency required by a sliced function must be supplied explicitly by the test harness rather than hidden behind a production fallback.

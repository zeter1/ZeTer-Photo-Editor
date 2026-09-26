# Task 014 — Extract selection-driven Vector Mask controller

## Goal

Move the cohesive selection → Vector Mask command/policy seam out of `src/main.js` into one canonical selection owner, preferably `src/selection/vector-mask-controller.js`, while preserving Pen direct-edit geometry, Saved Paths ownership and PSD/PSB vector-mask codec boundaries.

This is intentionally a small synchronous refactor + code-quality pass after Task 013. Do **not** combine it with the whole Pen tool, Saved Paths, raster masks, Properties, layer-list rendering or PSD import/export extraction.

## Confirmed starting point — 2026-09-26

- Task 013 is merged on `main` as `d244d133930d8d2fe7fac25f450b974dd5ec4384` via PR #38.
- Exact merged-main CI run `36259376904` / run #252 passed:
  - `npm run check`;
  - generated `src/app.bundle.js` parity;
  - real Chromium `file://` smoke;
  - `git diff --check`.
- Task 013 moved selection → raster layer-mask / Select & Mask ownership to `src/selection/mask-controller.js`.
- `src/main.js` is now about 3,525 lines / 193k characters.
- The next cohesive selection-owned cluster still in `src/main.js` is:
  - `selectionVectorMaskDocumentNodes()`;
  - `selectionVectorMaskSubpath()`;
  - `applySelectionToVectorMask()`;
  - `editSelectedVectorMask()`;
  - `toggleSelectedVectorMask()`;
  - `invertSelectedVectorMask()`;
  - `removeSelectedVectorMask()`.
- The same commands are routed from layer/context/menu entries, so leaving the implementation in the composition root still makes fresh AI/Codex sessions search a large runtime file before understanding Vector Mask behavior.
- `editSelectedVectorMask()` currently assigns `vectorMaskEditLayerId = layer.id` both before and after `setTool('pen')`. Inspection confirms `setTool('pen')` does **not** clear that state; the duplicate assignment is therefore redundant. Remove the duplication only as part of the extracted, regression-covered edit command rather than as an unrelated drive-by change.

## Architectural problem

Raster masks now have a clear selection owner, Saved Paths have `src/ui/paths-controller.js`, but selection-driven Vector Mask creation and mask lifecycle commands remain embedded in the global runtime next to unrelated layer/group commands.

That makes ownership ambiguous:

- selection shape → vector geometry policy lives in `main.js`;
- Saved Path → vector mask publication lives in `paths-controller.js`;
- Pen direct-edit state/geometry lives in `main.js`;
- persisted Vector Mask schema lives in `src/core/state.js`;
- PSD/PSB import/export conversion lives in the runtime/format/document boundary.

The goal is **not** to merge those owners. The goal is to give only the selection-driven Vector Mask transaction one explicit owner.

## Required owner

Create `src/selection/vector-mask-controller.js` (or an equivalently narrow name only if inspection proves a better boundary) that owns:

- selection shape → document-space Vector Mask nodes;
- exact rectangle conversion;
- exact ellipse cubic Bézier approximation using the existing `0.5522847498307936` kappa;
- lasso/polygon/other supported shape conversion through the existing bounded `selectionPathPoints(shape, 72)` bridge;
- document-space → layer-local node/handle localization;
- canonical boolean operation normalization:
  - `replace`;
  - `add`;
  - `subtract`;
  - `intersect`;
  - `exclude`;
- create/replace Vector Mask from selection;
- append boolean subpaths to an existing Vector Mask;
- 128-subpath guard;
- enable/toggle/invert/remove selected Vector Mask commands;
- entering Vector Mask Pen edit through a narrow injected edit port;
- existing status/toast/history labels for those commands.

Prefer direct imports for stable pure/domain primitives and grouped injected ports for live runtime state/UI/edit-mode effects.

## Preserve exactly

Unless a regression proves a real bug and the intentional fix is documented, preserve:

1. “select a layer”, “create a selection”, “locked layer/group” and “selection too small” guards/messages;
2. rectangle nodes in current clockwise order;
3. ellipse anchor/handle orientation and exact kappa constant;
4. lasso/polygon conversion through 72 sampled path points;
5. document→layer coordinate conversion for anchors and Bézier handles;
6. node `kind` normalization to `smooth` / `corner`;
7. boolean operation allow-list and fallback to `add`;
8. `replace` creates `createVectorMask({ enabled:true, invert:false, subpaths:[subpath] })`;
9. appending a subpath re-enables the Vector Mask;
10. existing 128-subpath limit, status message and warn toast;
11. exact history labels for replace/add/subtract/intersect/exclude;
12. exact mask-count status after successful publication;
13. toggle/invert/remove history semantics;
14. remove clears active Vector Mask Pen edit target when it belongs to that layer;
15. entering edit switches to Pen mode and redraws overlay;
16. current layer/group lock semantics;
17. adjustment-layer behavior remains whatever current runtime/core geometry supports — do not add a new rejection without a failing behavioral regression;
18. `layerMaskSummary()` remains cross-feature runtime/UI policy for raster + vector + Smart Filter masks.

## Required boundary with Pen editing

The new controller must **not** become the owner of Pen geometry or persistent Pen edit state.

Keep in runtime / current Pen owner:

- `vectorMaskEditLayerId` storage;
- `penDraft`;
- `selectedEditablePathTargets()`;
- `pathTargetPoints()`;
- hit testing;
- anchor/handle drag begin/move/cancel/restore;
- overlay drawing of editable points;
- pointer/keyboard routing.

Expose only narrow edit ports, for example:

- `beginVectorMaskEdit(layerId)` — set the runtime edit target, switch to Pen, redraw;
- `clearVectorMaskEdit(layerId?)` — clear the runtime target when appropriate;
- optionally a narrow predicate/getter only if tests prove it is needed.

Do not leak mutable Pen state into the controller.

## Keep outside this owner

Do **not** move:

- raster layer-mask / Select & Mask orchestration: `src/selection/mask-controller.js`;
- selection gesture/draft lifecycle: `src/selection/gesture-controller.js`;
- Saved Paths selection/CRUD/apply transaction: `src/ui/paths-controller.js`;
- persisted `createVectorMask()` schema/sanitization: `src/core/state.js`;
- Pen direct-edit geometry and pointer lifecycle;
- `importPsdVectorMask()` / `exportPsdVectorMask()`;
- PSD/PSB binary codec: `src/formats/psd.js`;
- PSD export preparation: `src/document/psd-export-controller.js`;
- cross-feature `layerMaskSummary()`;
- menu/layer-list ownership beyond replacing command callbacks with the controller API.

Saved Paths and selection-driven Vector Masks may both publish `layer.vectorMask`, but they remain different user workflows and should not be merged into one oversized controller.

## Code-review target

While extracting, explicitly review the current edit transition:

```js
vectorMaskEditLayerId = layer.id;
setTool('pen');
vectorMaskEditLayerId = layer.id;
```

Current `setTool('pen')` preserves `vectorMaskEditLayerId`, so this is duplicate state publication. Replace it with one explicit runtime edit-port operation and a regression that proves Pen mode receives the correct exact layer ID.

Do not make unrelated Pen refactors in this task.

## Tests required

Add direct controller tests rather than VM-slicing `src/main.js` where practical:

1. rectangle selection converts to the same four document-space nodes;
2. ellipse conversion preserves exact anchors, handles and smooth-node semantics;
3. lasso/polygon conversion uses the supplied bounded path-point bridge;
4. anchors and handles localize through the supplied document→layer transform;
5. invalid boolean operation normalizes to `add`;
6. valid `replace` publishes one Vector Mask and one exact history commit;
7. `add`, `subtract`, `intersect`, `exclude` append the correct subpath operation and exact commit label;
8. appending re-enables a disabled mask;
9. 128-subpath limit performs no mutation/history and surfaces the existing warning;
10. no-layer / no-selection / locked / too-small guards perform no mutation/history;
11. edit command calls the narrow Pen edit port exactly once with the exact layer identity and preserves guard messages;
12. toggle/invert/remove preserve current state transitions and history labels;
13. removing the active edited Vector Mask asks the runtime edit port to clear that target;
14. source/architecture guard proves the listed selection-driven Vector Mask helpers no longer live in `src/main.js`;
15. source/architecture guard proves Pen geometry/edit state and PSD import/export functions **remain outside** the new controller;
16. `tests/vector-masks.test.mjs` Stage 10 ownership contracts follow the new canonical owner, while Stage 10c Pen geometry contracts stay on the runtime boundary;
17. existing Saved Paths, PSD export/import, layer-lock, selection and browser regressions stay green.

## Documentation / AI navigation

Update only routing/boundary material that materially reduces future AI/Codex search:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Make the four adjacent owners explicit:

- selection gestures → `selection/gesture-controller.js`;
- selection raster masks → `selection/mask-controller.js`;
- selection Vector Mask commands → new `selection/vector-mask-controller.js`;
- Saved Paths → `ui/paths-controller.js`;
- Pen geometry/edit runtime and PSD codec remain separate.

## Required verification

1. focused direct Vector Mask controller tests;
2. existing `tests/vector-masks.test.mjs`;
3. Saved Paths regressions;
4. PSD vector-mask/export regressions;
5. relevant layer-lock/selection architecture tests;
6. `npm run check`;
7. generated `src/app.bundle.js` parity;
8. `npm run test:browser`;
9. `git diff --check`;
10. exact PR-head Actions green;
11. squash merge guarded by expected head SHA;
12. exact merged-main push CI green.

## Done gate

Delete this task only after the implementation is merged and the exact merged `main` SHA has green CI. Then inspect the new repository state and create exactly one next bounded task.

## Handoff note

Keep this pass synchronous and narrow. The value is ownership clarity and AI navigation, not a Pen redesign. The strongest result is a directly testable selection→Vector Mask command owner, a smaller composition root, no duplicate geometry/schema/PSD logic, and unchanged user-visible Vector Mask behavior.

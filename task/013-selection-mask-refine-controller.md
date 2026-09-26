# Task 013 — Extract selection-driven raster mask / Select & Mask owner

## Goal

Move the cohesive selection → raster mask / Select & Mask orchestration out of `src/main.js` into one canonical selection owner, preferably `src/selection/mask-controller.js`, and fix the stale async publication hole in the final refine transaction.

This is a bounded refactor + reliability pass. Do **not** combine it with Vector Mask/Pen extraction, the whole Properties inspector, Smart Filter ownership or a redesign of Select & Mask.

## Confirmed starting point — 2026-09-26

- Task 012 is merged on `main`: shared Text typography/font UI policy now belongs to `src/ui/text-settings-controller.js`.
- Exact Task 012 merge checkpoint: `68183da01bc5b1fb810089d595adc7ed745e1148`.
- Exact merged-main CI run: `36257588782` — `npm run check`, generated-bundle parity, real Chromium `file://` smoke and `git diff --check` all passed.
- `src/main.js` is now about 3,692 lines / 203k characters.
- The next cohesive runtime cluster is selection-driven raster masks / Select & Mask:
  - `selectionRefineSourceRgba()`;
  - `selectionMaskDataUrl()`;
  - `addSelectedLayerMask()`;
  - `selectionRefineOptionsFromValues()`;
  - `buildSelectionRefinePreviewSource()`;
  - `attachSelectionRefinePreview()`;
  - `refineSelectionToLayerMask()`;
  - `removeSelectedLayerMask()`.
- `selectionMaskDataUrl()` is also a shared preparation primitive used by `src/ui/smart-filter-controller.js` through a narrow selection port.

## Root reliability problem

The current final Select & Mask transaction captures `layer`, then `await selectionMaskDataUrl(layer, options)`, then writes `layer.mask` and calls the global `commit()` without revalidating the originating document, exact selected layer or lock state.

With edge detection enabled, mask preparation can await `selectionRefineSourceRgba()` / `renderLayer()`. A document/tab switch, layer-selection change or lock change during that await can therefore publish a prepared mask into stale layer state while history/status are associated with the newly active runtime context.

Treat this as a real async ownership bug, not merely code movement.

The live preview path also only checks `modal.isConnected` after async source preparation. The extracted owner should keep preview work bound to the modal + originating document/layer so stale results cannot replace a newer/foreign preview.

## Required owner

Create one canonical selection-mask controller with a narrow API. The exact names may improve after inspection, but aim for responsibilities like:

- selection-shape → raster mask generation for regular and adjustment layers;
- bounded refine/edge-detection preparation;
- Select & Mask options normalization;
- non-destructive preview-source preparation and preview lifecycle/cleanup;
- add “show all” / add from current selection;
- final refined layer-mask Apply transaction;
- remove raster layer mask;
- reusable `selectionMaskDataUrl(layer, options)` API consumed by Smart Filter mask creation;
- exact owner revalidation after every awaited boundary before any layer mutation/history publication.

Prefer direct imports for stable pure/domain helpers and narrow injected ports for live document/selection/render/DOM/modal/history capabilities.

## Preserve exactly

Unless a regression proves an existing bug and the intentional fix is documented, preserve:

1. “select a layer”, “create a selection”, “locked layer/group”, “mask already exists” guards/messages;
2. adjustment-layer mask coordinates use document dimensions; normal layers use layer-local dimensions;
3. selection polygon/path semantics and current transform handling;
4. `checkedCanvasSize()` guard;
5. 12 MP refined-mask limit;
6. edge-radius 0–12 bound and 48,000,000 radius×pixel work guard;
7. current smooth/shift/radius/strength/smart-radius/feather/contrast/invert normalization;
8. current preview modes: mask / overlay / black / white;
9. preview remains non-destructive and history-free;
10. existing CSS/modal labels/default values;
11. valid Add Mask history labels and status messages;
12. valid refined Apply commits exactly one history step with the current label;
13. Smart Filter selection-mask preparation remains prepare-before-publish and continues to perform its own target revalidation;
14. layer lock semantics and high-depth/adjustment rendering behavior;
15. preview/listener/animation-frame cleanup when modal closes.

## Required async transaction contract

For every operation that can cross an await before mutation:

- capture the originating document + exact target layer identity before preparation;
- prepare pixels/data without mutating persisted state;
- after the await, re-read the active document/selected target and lock state;
- publish only if the exact owner is still valid;
- stale/closed/locked publication must create **no** mask mutation and **no** history entry;
- preview publication must additionally prove that the same modal/preview generation is still current;
- do not “fix” the race with broad `try/catch`, disabled tests or silent suppression.

## Keep outside this owner

Do **not** move:

- canonical selection gesture state/types: `src/selection/gesture-controller.js` + runtime selection-shape bridge;
- `refineMaskAlpha()`, edge-aware pixel math or preview compositor: `src/core/pixels.js`;
- persisted layer-mask schema / `createLayerMask()`: `src/core/state.js`;
- Vector Mask selection conversion, boolean subpaths, Pen edit state or PSD vector-mask import/export;
- Smart Filter stack/mask mutation ownership: `src/ui/smart-filter-controller.js`;
- generic modal shell: `src/ui/modal-controller.js`;
- global document/session/history ownership.

`layerMaskSummary()` currently summarizes raster + vector + Smart Filter masks together; leave that cross-feature summary in runtime unless inspection finds a cleaner non-duplicating boundary.

## Tests required

Add direct owner regressions instead of VM-slicing the old `src/main.js` implementation where practical:

1. option normalization/clamps, including preview scale conversion;
2. regular-layer versus adjustment-layer mask dimensions/coordinate bridge;
3. 12 MP and edge-work safety bounds;
4. valid add-from-selection publishes one mask + one expected history commit;
5. stale document switch during async mask preparation publishes nothing;
6. selected layer changes during await publishes nothing;
7. target becomes locked during await publishes nothing;
8. valid refined Apply publishes exactly once;
9. stale/closed preview source cannot update a modal owned by another document/layer;
10. preview cleanup cancels frame/listeners and cannot retain stale modal state;
11. Smart Filter still consumes the canonical shared `selectionMaskDataUrl` bridge and its existing stale-document mask regression stays green;
12. architecture/source guard proves the listed raster-mask/refine helpers no longer live in `src/main.js`;
13. existing `tests/selection-refine.test.mjs` source contracts follow the canonical owner rather than assuming implementation in `main.js`;
14. existing Smart Filter, selection, layer-mask, render and async-context regressions stay green.

A regression reproducing the stale final Apply bug is mandatory before considering the task complete.

## Review checklist

- no persisted mutation before async preparation completes;
- revalidation happens **after** each awaited boundary, not only before it;
- exact document + exact layer identity + lock state are checked;
- Smart Filter does not gain a duplicate rasterizer;
- selection controller does not become a second document/selection-state owner;
- Vector Mask/Pen/PSD semantics stay out of this pass;
- no broad error suppression;
- no new flat-bundle top-level collision;
- generated bundle remains derived from the canonical source graph;
- `src/main.js` becomes smaller and more composition-oriented.

## Documentation / AI navigation

Update only navigation/boundary material that helps a fresh AI/Codex session find the owner quickly:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Make the shared rasterizer relationship explicit: selection-mask preparation belongs to the new selection owner; Smart Filter owns Smart Filter mutation, raster layer-mask UI owns its transaction, and vector-mask semantics remain separate.

## Required verification

1. direct selection-mask controller regressions, including the stale async final-Apply bug;
2. existing `tests/selection-refine.test.mjs`, Smart Filter and async-context regressions;
3. `npm run check`;
4. generated `src/app.bundle.js` parity;
5. `npm run test:browser`;
6. `git diff --check`;
7. exact PR-head CI green;
8. squash merge guarded by expected head SHA;
9. exact merged-main push CI green.

## Done gate

Delete this task only after implementation is merged and the exact merged `main` SHA has green CI. Then inspect the new repository state and create exactly one next bounded task.

## Handoff note

The highest-value behavior to protect is not visual polish; it is async ownership. Final Select & Mask Apply currently prepares data against one layer but can publish after the runtime context has moved. Fix that transaction boundary while extracting the owner, and keep the same evidence-first workflow used by Tasks 011–012.

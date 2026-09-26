# Task 009 — Smart Filter UI/controller seam

## Goal

Extract the remaining cohesive Smart Filter UI/orchestration policy from `src/main.js` into a dedicated owner, preferably `src/ui/smart-filter-controller.js` unless inspection proves a clearer boundary.

This pass is a refactor/reliability pass, not a Smart Filter feature expansion. Preserve current behavior and keep the renderer/state codec boundaries unchanged.

## Why this is next

After Task 008, `src/main.js` is still about 238k characters. One of the clearest remaining cohesive seams is Smart Filters:

- property-panel markup: `smartFilterMaskMarkup()`, `smartFilterStackMarkup()` (~3.7k chars);
- commands + mask transaction + DOM bindings + modal lifecycle from `smartFilterTarget()` through `openSmartFilterDialog()` (~12.4k chars).

Fresh AI currently has to jump between two distant regions of `main.js` to understand one feature.

## Inspect first

- `src/main.js`
  - `smartFilterMaskMarkup()`
  - `smartFilterStackMarkup()`
  - `smartFilterTarget()`
  - `smartFilterDefaultName()`
  - `moveSmartFilter()`
  - `toggleSmartFilter()`
  - `removeSmartFilter()`
  - `clearSmartFilters()`
  - `setSmartFilterMask()`
  - `toggleSmartFilterMask()`
  - `invertSmartFilterMask()`
  - `removeSmartFilterMask()`
  - `updateSmartFilterMaskSetting()`
  - `bindSmartFilterControls()`
  - `openSmartFilterDialog()`
- `src/core/state.js` — Smart Filter schema, sanitizers, limits, `createSmartFilter()`, `createSmartFilterMask()`
- `src/core/render.js` — ordered Smart Filter rendering + mask composition
- `src/ui/tool-config.js` — `RASTER_EFFECT_CONTROLS`
- `tests/smart-filters.test.mjs`
- Smart Object / async-context tests that touch document switching
- `docs/architecture/CODEMAP.md`, `docs/architecture/BOUNDARIES.md`, `docs/testing/TEST_MATRIX.md`
- `tools/build-bundle.mjs` and generated-bundle naming constraints

## Scope

1. Create one canonical Smart Filter UI/controller owner.
2. Move Smart Filter stack/mask markup, mutation commands, control bindings and edit-modal lifecycle out of `src/main.js`.
3. Keep Smart Filter schema/sanitization/limits in `src/core/state.js`.
4. Keep pixel rendering/composition in `src/core/render.js`.
5. Prefer direct imports for stable pure/domain dependencies. Inject runtime/host capabilities such as current document/selection, history commit, render/dirty publication, selection-mask rasterization, modal root/document and status/toast bridges.
6. Preserve the current async mask prepare-before-publish guard: when `selectionMaskDataUrl()` awaits, a document switch must prevent publication into the new/old wrong owner.
7. Keep shared helpers outside the new owner when they serve broader features. In particular, do not move `selectionMaskDataUrl()` if layer masks still use it; pass it as a narrow port.
8. Migrate source-contract assertions from `main.js` to the new canonical owner and add one architecture guard preventing Smart Filter policy from drifting back into `main.js`.
9. Update AI routing docs, test matrix, CHANGELOG and deterministic `src/app.bundle.js`.

## Preserve exactly

- Smart Filters only operate on unlocked Smart Object layers.
- maximum stack limit remains the canonical `MAX_SMART_FILTERS` behavior (currently 24 in UI);
- order semantics: lower list entries render first, upper entries receive their result;
- enable/disable, reorder, remove and clear commit labels/behavior;
- removing the last filter clears `smartFilterMask`;
- mask modes: show-all or raster from current selection;
- selection-required and pending-edit guards/messages;
- mask `enabled`, `invert`, `density` [0..1], `feather` [0..250];
- live density/feather preview marks dirty/renders while the final change creates history;
- modal live preview, Reset, Cancel/Escape rollback, Apply-only-if-changed, focus restoration and filter-name length;
- live modal edits must resolve target by the originating document + layer/filter identity, not implicit current selection;
- document switch during async mask preparation must publish nothing.

## Direct regression tests

Add `tests/smart-filter-controller.test.mjs` (or equivalent direct owner test) covering at minimum:

1. reorder/toggle/remove/clear happy paths and invalid/locked targets;
2. last-filter removal clears the Smart Filter mask;
3. mask show-all creation;
4. mask-from-selection preparation and publication;
5. document switch while selection mask is awaiting -> no mutation/history commit;
6. toggle/invert/remove mask;
7. density/feather clamp plus live-preview-vs-final-commit semantics;
8. max-filter guard;
9. cancel/escape restores the original stack and Apply commits only a real change, if the modal can be exercised cleanly with the existing test harness;
10. architecture/source guard: `main.js` wires the owner but no longer defines the extracted Smart Filter functions; renderer/state mechanisms remain in their canonical files.

Do not replace direct behavior regressions with only string assertions. DOM-heavy modal behavior may use browser smoke as the final integration oracle, but non-DOM mutation/async policy must be directly tested.

## Review checklist

- semantic-drift scan for defaults, clamp bounds, commit timing, mutation order, reference identity and fallback/status strings;
- no broad `try/catch` or suppression added to make extraction green;
- no duplicate owner left in `main.js`;
- no Smart Filter renderer moved into UI controller;
- no generated bundle edited as an independent source of truth;
- because the file:// builder flattens modules into one IIFE, new top-level constants/state must use collision-safe names or otherwise preserve bundle scope compatibility.

## Required verification

1. smallest direct Smart Filter controller tests;
2. existing `tests/smart-filters.test.mjs` + relevant Smart Object/async-context regressions;
3. `npm run check`;
4. generated bundle parity;
5. `npm run test:browser`;
6. exact PR-head CI green;
7. squash merge with expected head SHA;
8. exact merged-main push CI green.

Delete this task only after the merged `main` SHA has green CI. Then inspect the current repository again and create exactly one next bounded task.

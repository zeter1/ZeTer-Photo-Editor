# 017 — Canonical Layer Properties command owner

## Goal

Extract the **mutation / transaction policy** behind the Layer Properties and Color & Effects inspector out of the remaining `src/main.js` composition root into one narrow canonical owner, tentatively:

`src/layers/property-command-controller.js`

This pass is intentionally **not** the full Properties DOM-renderer extraction. The immediate goal is to stop generic layer-property mutations from being spread across `applyProperty()`, reset helpers, HDR-preview callbacks and direct blend/opacity handlers, while preserving current UI markup.

## Why now / current evidence

Task 016 is complete on main: primitive layer/group commands now have a canonical owner and exact-owner/no-op guards.

A fresh post-merge scan of current `src/main.js` shows the next cohesive policy seam:

- `applyProperty(path, raw, input, shouldCommit)` still owns generic inspector mutation, validation, live render and history publication;
- `resetSelectedLayerEffects()` independently mutates filter state;
- `updateHighDepthPreviewSetting()`, `resetHighDepthPreview()` and `bindHighDepthPreviewControls(root, layer)` keep HDR-preview mutation policy in runtime;
- global blend/opacity controls still mutate the selected layer directly instead of reusing one property transaction owner;
- `bindHighDepthPreviewControls(root, layer)` captures a mutable layer object. Re-check this carefully: after a document/tab switch, a stale retained control callback must not be able to mutate that old layer or publish history through the new active document.

Current live source has priority over this plan. Re-run INSPECT → DIAGNOSE before changing code.

## Scope

Create one controller responsible for **generic layer property mutation + publication**:

1. exact active-document + exact layer-id re-resolution before every mutation;
2. generic scalar/string property changes currently handled by `applyProperty`;
3. filter/effect slider mutation and reset-to-default;
4. geometry clamps for width/height/x/y/scale/rotation, including existing raster canvas-size safety;
5. text-property normalization currently routed through `textSettingsController` validation methods;
6. shape stroke-width / color-style scalar properties already handled by the generic path;
7. blend-mode and layer-opacity mutations used by the persistent Layers controls;
8. HDR/high-depth preview `toneMap` + `displayExposure` update/reset;
9. live-preview vs committed mutation semantics;
10. no-op detection before dirty/history publication;
11. exact Russian history/status labels unless a real regression requires a documented correction.

The controller should import stable pure/domain helpers directly. Live application capabilities should arrive through grouped narrow ports such as:

- `state.getDocument()`;
- transaction `commit`, `markDirty`;
- render `render`, `drawOverlay`;
- UI `setStatus`, `toast`;
- text-settings validation/options only where runtime policy is genuinely needed.

Do not inject the whole runtime object.

## Non-scope

Do **not** combine this pass with:

- full `updateProperties()` DOM/markup extraction;
- Adjustment Layer parameter ownership (`updateAdjustmentProperty`, curve/levels controls);
- CMYK/ICC profile policy owned by `src/ui/color-management-controller.js`;
- custom/local-font discovery/cache/file-reading owned by `src/ui/text-settings-controller.js`;
- Text add/edit modal transaction owned by `src/ui/text-edit-controller.js`;
- Layer Blending Options / Styles dialog owned by `src/ui/layer-blending-controller.js`;
- Smart Filter stack/mask UI;
- transform pointer gestures / move-tool DnD;
- PSD/PSB metadata planning or codec work.

If the renderer needs a tiny adapter to call the new controller, keep it thin rather than pulling markup into this pass.

## Inspect first

Before writing:

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. this task
4. current `src/main.js` around:
   - `updateLayerControls`
   - `bindPropertyInputs`
   - `resetSelectedLayerEffects`
   - `updateHighDepthPreviewSetting`
   - `resetHighDepthPreview`
   - `bindHighDepthPreviewControls`
   - `applyProperty`
   - bottom-level `els.blend` / `els.layerOpacity` event wiring
5. `src/core/state.js`, `src/core/render.js`, `src/ui/text-settings-controller.js` only for contracts actually used;
6. tests/source-contracts that mention `applyProperty`, Properties fields, filters, HDR preview, blend or opacity;
7. `tools/build-bundle.mjs` and current Actions workflow before writes.

## Behavioral contracts

Preserve or improve these invariants:

1. **Exact owner:** stale DOM callbacks from a previous tab/document cannot mutate an old layer or commit against the new document.
2. **Exact target:** if the original layer id disappears/replaces, the command is a no-op.
3. **Effective lock:** own/group/ancestor lock blocks every persisted property mutation.
4. **No-op history:** setting an already-equal value publishes zero history entries and does not create synthetic dirty state.
5. **Live preview:** range/input preview may render without history; final change publishes at most one real commit.
6. **Invalid numeric input:** refresh/reject behavior remains user-visible and does not mutate state.
7. **Raster dimensions:** canvas-size safety runs before width/height publication.
8. **Text validation:** weight/style/alignment/font-family constraints remain canonical; font bytes/registry stay outside.
9. **Filter safety:** sanitize + clamp ranges exactly once; reset only commits when at least one value changes.
10. **HDR preview:** tone map / exposure normalization is bounded, reset is no-op when already default, and stale callbacks publish nothing.
11. **Blend/opacity parity:** persistent controls and Properties routes use the same command owner instead of separate direct mutation code.
12. **Render/history order:** failed validation or stale/locked/no-op commands do not render as successful persisted changes or commit history.

## Targeted tests

Add a direct controller suite. Cover at least:

1. real generic property change commits once;
2. same generic value = zero commit/dirty;
3. stale document = no mutation;
4. missing/replaced layer id = no mutation;
5. effective ancestor lock blocks mutation;
6. invalid numeric value rejects without mutation/history;
7. width/height clamp + unsafe raster canvas size rejection;
8. x/y/scale/rotation clamps/normalization;
9. valid/invalid text enum normalization;
10. filter live input renders without commit;
11. filter final change commits once;
12. filter reset real change vs already-default no-op;
13. blend mode real change vs no-op;
14. opacity live preview + final commit without duplicate history;
15. HDR tone-map/exposure real change;
16. HDR reset no-op vs changed;
17. stale captured HDR control callback after tab switch publishes nothing;
18. source-contract test proves `main.js` only wires/binds these mutations;
19. architecture guard pins the new canonical owner and build graph.

Retarget stale source-location tests rather than weakening the behavior they protect.

## Documentation / AI navigation

With the implementation update:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md`

Document the split:

- Properties DOM/feature markup remains runtime/UI composition for this pass;
- generic layer-property mutation/history policy = new controller;
- schema/sanitization/pure helpers remain core;
- specialized Text/Color/Adjustment/Blending/Smart Filter owners remain separate.

## Generated bundle

Add the new module to `tools/build-bundle.mjs` in dependency-safe order and regenerate through the canonical build only.

The classic bundle flattens module scope: use unique top-level names and make every ESM dependency explicit. A green bundle smoke does not replace direct module tests.

## Verification

Use this order:

1. new direct property-command controller tests;
2. relevant filter/effects/HDR/property regressions;
3. text settings / high-depth / layer tests touched by the seam;
4. architecture/source-contract tests;
5. full `npm run check`;
6. generated bundle parity;
7. `npm run test:browser`;
8. `git diff --check`;
9. exact PR-head CI;
10. guarded squash merge;
11. exact merged-main CI.

If CI fails after ownership moves, classify first: product regression vs stale source-location oracle vs build-graph/module-hygiene error.

## Done gate

Delete this file only after the implementation is merged and the exact merged `main` SHA has green CI.

Then inspect live `main` and create exactly one next bounded task.

## Risks / handoff notes

- The stale HDR callback is a **hypothesis from current wiring**, not a declared bug until reproduced/confirmed by a regression test.
- Do not move the 12k+ Properties renderer wholesale merely to reduce `main.js`; first create the semantic mutation seam so later UI extraction can be smaller and safer.
- Do not replace validation with generic try/catch or history suppression. Preserve root-cause visibility and explicit rejection paths.
- Prefer one small self-contained PR with direct behavior tests over a broad Properties/transform/UI rewrite.

# Task 010 — Layer blending / styles UI controller seam

## Goal

Extract the cohesive layer Blending Options / Layer Styles UI orchestration from `src/main.js` into a dedicated owner, preferably `src/ui/layer-blending-controller.js`, without changing visible behavior or layer-style/render semantics.

This pass is a structural/refactoring pass with direct regressions. Do not mix unrelated inspector, selection, group-style or renderer changes into it.

## Why now / evidence

After Task 009, `src/main.js` is still about 223k characters. The next well-bounded UI seam is the layer blending dialog:

- `openBlendingOptions()` is roughly 8.8k characters on its own;
- related transient preview state/helpers (`blendingPreview`, `blendingPreviewCrop`, `syncBlendingPreviewCanvas`) are split across distant parts of `main.js`;
- the feature already has a clear domain boundary: layer blend mode + opacity + `layer.styles` draft/preview/apply lifecycle;
- renderer/state schema already have separate owners, so this is a good controller extraction rather than a domain rewrite.

Current code and tests are source of truth. Re-inspect before editing.

## Inspect first

Read bounded regions only:

- `src/main.js`
  - `blendingPreview` state and every occurrence;
  - `blendingPreviewCrop()`;
  - `syncBlendingPreviewCanvas()`;
  - `openBlendingOptions()`;
  - render path(s) that call preview sync;
  - menu/context-menu callers;
  - `updateLayerControls()`, `commit()`, `blockPendingDocumentEdit()`, modal drag/focus bridges used by the dialog.
- `src/core/layer-styles.js` — canonical style schema/sanitization/field metadata.
- `src/core/geometry.js` — frame/crop geometry helpers.
- `src/core/render.js` — layer-style rendering; do not move renderer mechanics into UI.
- existing layer-style/blending tests and `tools/browser-smoke.mjs`.
- `tools/build-bundle.mjs`.
- `AGENTS.md`, `docs/architecture/CODEMAP.md`, `docs/architecture/BOUNDARIES.md`, `docs/testing/TEST_MATRIX.md`.

## Planned owner

Create one canonical controller with explicit ownership of:

- Blending Options modal construction and DOM bindings;
- draft blend mode / opacity / layer-style editing;
- Preview checkbox semantics and transient preview cleanup;
- crop calculation / preview-canvas synchronization if these remain cohesive with the modal;
- stale layer/document validation for preview/apply/cancel;
- Apply / Cancel / Escape / backdrop lifecycle and focus restoration.

Prefer stable direct imports for pure/domain helpers such as layer-style sanitization/metadata and geometry. Inject effectful/live runtime capabilities: current document, rendered canvas, history commit, transient-change serial/preview invalidation, render/update-controls, modal root/document/window/ResizeObserver, draggable-modal bridge, status/toast as needed.

The controller should own its transient preview state instead of leaving a second mutable `blendingPreview` owner in `src/main.js`.

## Explicit non-scope

Do **not**:

- move `LAYER_STYLE_FIELDS`, `createLayerStyles()` or `sanitizeLayerStyles()` out of `src/core/layer-styles.js`;
- move pixel/render implementation out of `src/core/render.js`;
- redesign Layer Styles UI or add new effects;
- refactor the whole properties inspector;
- change group blending semantics;
- weaken lock/pending-edit/history guards;
- hand-edit generated bundle logic independently of the canonical build graph.

## Behavioral contracts to preserve

Preserve exactly unless a direct regression proves an existing bug and the fix is intentionally documented:

1. locked layers and pending document edits cannot open the dialog;
2. dialog draft starts from current blend mode, opacity and sanitized layer styles;
3. live preview may temporarily assign draft/original values, update layer controls, advance the transient document-change serial and render, but must not create history commits;
4. Preview off restores original values while the dialog remains open;
5. the originating document + exact layer identity + lock state are revalidated before each publication/finalization;
6. Cancel, Escape and backdrop close restore the original values;
7. Apply commits `Параметры наложения слоя` only when a real change exists;
8. Apply with no effective change restores/keeps the original state without an unnecessary history entry;
9. style enable toggles, general opacity/fill opacity, numeric/color/pattern fields, range labels/units and blend-mode options keep current semantics;
10. transient preview canvas crop, DPR cap, scaling and source-copy behavior remain visually equivalent;
11. ResizeObserver and modal preview cleanup cannot leave stale preview state after close;
12. focus restoration and status messages remain equivalent;
13. a document/layer switch while the dialog is open must not publish stale draft state.

## Targeted tests

Add a direct owner test (for example `tests/layer-blending-controller.test.mjs`) that covers as much policy as possible without requiring the whole app:

- crop bounds / clamp behavior;
- locked/pending-open guards;
- draft/original preview assignment semantics;
- preview on/off does not commit history;
- real Apply commits once; no-op Apply does not;
- Cancel/Escape/backdrop rollback;
- stale document/layer identity prevents publication;
- cleanup clears controller-owned preview state / observer;
- source/architecture guard: `src/main.js` wires the controller but no longer defines the extracted blending functions/state.

If full DOM lifecycle is awkward with the current harness, first isolate testable transaction/model helpers inside the same owner and use the real Chromium smoke as the integration oracle. Do not replace non-DOM policy with only string assertions.

Run the existing layer-style/render regressions that cover this feature.

## Review checklist

- semantic-drift scan for optional defaults, null-vs-default styles, fill-opacity behavior, percent↔0..1 conversion, commit timing, status strings and cleanup order;
- no broad catch/suppression added;
- one transient preview owner only;
- no renderer/schema duplication in UI;
- no new top-level bundle-name collision after file:// module flattening;
- generated artifact stays derived;
- `src/main.js` becomes smaller and composition-oriented rather than gaining adapter noise.

## Documentation / AI navigation

Update the routing docs so a fresh AI/Codex session can jump directly to the blending owner without reading `src/main.js` broadly:

- `AGENTS.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

## Required verification

1. smallest direct layer-blending controller tests;
2. relevant existing layer-style/render tests;
3. `npm run check`;
4. generated bundle parity;
5. `npm run test:browser`;
6. exact PR-head CI green;
7. squash merge guarded by expected head SHA;
8. exact merged-main push CI green.

## Done gate

Delete this task only after the implementation is merged and the exact merged `main` SHA has green CI. Then inspect the new repository state and create exactly one next bounded task.

## Risk / handoff note

The important hidden coupling is that the main render lifecycle currently calls the preview-canvas synchronizer. Preserve that integration through a narrow controller method rather than exposing controller-owned mutable preview state back to `main.js`.

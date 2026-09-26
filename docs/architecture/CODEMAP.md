# Code map

## Runtime entry

### `index.html`
DOM skeleton, menus, toolbar, panels, dialogs and version meta. Runtime uses generated `src/app.bundle.js`.

### `src/main.js`
Application orchestrator: UI events, generic pointer/keyboard gesture lifecycle, tool routing, history/transaction coordination and save/export flows. Raster edit buffers/persistence, plus extracted session, clipboard, import, menu/modal/toolbar and retouch mechanics, are delegated to their canonical owners.

**AI rule:** do not read the whole file first. Search for the command/tool/function involved, then inspect a bounded window and its tests.

## UI boundary — `src/ui/`

### `tool-config.js`
Pure immutable-ish configuration: tool labels/help, control metadata, storage keys and sets describing tool capabilities. No DOM reads, no document mutation.

### `tool-layout.js`
Pure toolbar order/grid-slot helpers. Safe to unit-test without browser state.

### `toolbar-controller.js`
Owns toolbar drag/drop, persisted order, drop-slot rendering and rich accessible tooltips. It deliberately does not own `currentTool`; tool selection stays in `src/main.js`.

### `menu-controller.js`
Owns generic top-menu/context-menu mechanics: rendering menu items, enabled state evaluation, popup positioning, focus restoration, keyboard navigation, outside-click close and async action error surfacing. Domain command lists and editor mutations stay in `src/main.js`.

### `modal-controller.js`
Owns generic modal/dialog mechanics: field rendering, numeric normalization, async submit lifecycle, focus restoration, backdrop/Escape close, draggable text-modal shell, info dialogs and recovery-choice dialog. Text preview rendering and editor mutations remain callbacks owned by `src/main.js`.

Future UI extractions should land here when they can be expressed as pure config/helpers or narrow controllers rather than adding more unrelated responsibility to `src/main.js`.

## Painting boundary — `src/painting/`

### `controller.js`
Owns reusable raster-edit state shared by brush/eraser/fill/line and retouch routing: Canvas8 buffer/context/layer identity, native high-depth/CMYK working buffer, preview invalidation/frame throttling, render overrides, raster materialization and publication back to the layer.

It deliberately does **not** own `currentTool`, pointer gesture state (`beginPaint → paintTo → endPaint`), selection semantics, history commits or the application-wide pending-edit guard. Those remain orchestration concerns in `src/main.js`; pixel math remains in `src/core/pixels.js` and `src/core/pixel-buffer.js`.

## Retouch boundary — `src/retouch/`

### `controller.js`
Owns destructive retouch mechanics for Canvas8 and native typed RGB/CMYK paths: clone/heal source + immutable per-stroke snapshots, smudge, blur, dodge/burn, private scratch canvases and high-depth retouch dispatch.

It does **not** own document/history/pointer gesture state or the shared raster edit buffer. Runtime orchestration remains in `src/main.js`; shared paint state/persistence lives in `src/painting/controller.js`; pixel math remains in `src/core/pixels.js` and `src/core/pixel-buffer.js`.

## Document boundary — `src/document/`

### `import-controller.js`
Owns incoming-file classification and image import orchestration: image/project detection, decode-and-validate-before-mutate transaction, empty-document sizing, anchor placement and routing to PSD/project callbacks. It does not own PSD parsing or project persistence; those remain separate runtime/format concerns.

## Selection boundary — `src/selection/`

### `clipboard-controller.js`
Owns selection copy/cut/paste orchestration: selected-vs-merged PNG preparation, browser Clipboard API, native paste payload handling, shortcut fallback timers/generation and tab-switch guards. It does not own document mutation internals: clearing/rasterization callbacks remain in `src/main.js` and core pixel modules.

## Workspace boundary — `src/workspace/`

### `session-controller.js`
Owns document-tab/session lifecycle: session IDs and names, per-tab history/zoom/dirty/selection snapshots, tab rendering/actions, switching, close/rename/duplicate, and the parent-tab guard for open Smart Object content tabs.

It does **not** own raster/document internals. `src/main.js` supplies the live runtime state bridge and application callbacks; `src/core/state.js` remains the document model owner.

## Core — `src/core/`

- `state.js` — document/layer/group/smart-object models, sanitization and invariants.
- `render.js` — Canvas 2D render/composite/export bridge.
- `pixel-buffer.js` — typed RGB/CMYK 8/16/32-bit model and native destructive/composite primitives.
- `pixels.js` — RGBA8 pixel operations and masks.
- `color-management.js` — ICC parsing/transforms, CMYK preview/edit/proof policies.
- `color.js` — color helpers.
- `adjustments.js` — adjustment model sanitization/equality.
- `layer-styles.js` — layer style model/render helpers.
- `geometry.js` — selection/layer geometry and transforms.
- `history.js` — history stack.
- `io.js` — browser file/data-url/download helpers.
- `recovery.js` — recovery persistence.
- `pixel-worker.js` — bounded worker path for heavy pixel operations.

## Formats — `src/formats/`

### `psd.js`
PSD/PSB codec and Photoshop-compatibility boundary: parsing, writing, native metadata preservation/rewrite, high-depth/CMYK channels, text/shape/adjustment/smart-object structures.

Legacy `src/adapters/psd.js` only re-exports this module.

## Generated artifact

### `src/app.bundle.js`
Generated by `tools/build-bundle.mjs`. Required because the app must work directly under `file://`. Never hand-edit.

## Tests

Unit/contract tests live in `tests/*.test.mjs`; compatibility fixtures live under `tests/fixtures/`. Start from [../testing/TEST_MATRIX.md](../testing/TEST_MATRIX.md), not by opening every test.

## Tooling

- `tools/build-bundle.mjs` — explicit ordered browser bundle graph.
- `tools/browser-smoke.mjs` — real Chromium `file://` smoke through DevTools.
- other tools — fixture/corpus helpers.

## Documentation ownership

- `docs/PROJECT.md` — short start page.
- this file — code ownership.
- `BOUNDARIES.md` — dependency rules/invariants.
- `../development/AI_WORKFLOW.md` — work protocol.
- `../reference/PROJECT_HISTORY.md` — deep historical notes; consult only when a stage-specific compatibility detail is needed.

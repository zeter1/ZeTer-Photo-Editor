# Code map

## Runtime entry

### `index.html`
DOM skeleton, menus, toolbar, panels, dialogs and version meta. Runtime uses generated `src/app.bundle.js`.

### `src/main.js`
Application orchestrator: tool-specific pointer/keyboard dispatch, tool selection, history/transaction coordination and save/export flows. Generic overlay pointer capture/active-pointer lifecycle is delegated to `src/interaction/pointer-lifecycle-router.js`. Selection gesture mechanics are delegated to `src/selection/gesture-controller.js`. Paint-stroke lifecycle, one-shot raster commands, destructive selection raster mutations and raster edit buffers/persistence, plus extracted session, clipboard, import, menu/modal/toolbar/workspace-layout/saved-Paths and retouch mechanics, are delegated to their canonical owners.

**AI rule:** do not read the whole file first. Search for the command/tool/function involved, then inspect a bounded window and its tests.

## Interaction boundary — `src/interaction/`

### `pointer-lifecycle-router.js`
Owns the generic overlay Pointer Events lifecycle: one active pointer at a time, capture/release, routing of idle hover vs active-pointer movement, matching up/cancel, and fail-safe cancellation when `lostpointercapture` arrives unexpectedly.

It deliberately does **not** know tool names or mutate layers, selections, paths, crop geometry or paint buffers. Those domain branches remain in `src/main.js` and the dedicated selection/painting controllers.

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

### `workspace-layout-controller.js`
Owns editor-shell layout state that is independent of document contents: persisted sidebar collapse IDs, legacy collapse-state migration, accessible panel toggle state and canvas-mode visibility with viewport-center preservation. It receives DOM/runtime geometry through narrow ports and does not own document/layer/history/tool state.

### `paths-controller.js`
Owns Saved Paths UI/state orchestration: selected path index, bounded Photoshop path-resource allocation, save/rename/duplicate/delete actions, accessible list/keyboard/context-menu wiring and applying a saved path as a vector mask through grouped explicit ports. The document model remains in core, Pen direct-edit geometry/transient edit index remains in `src/main.js`, and PSD/PSB binary semantics remain in `src/formats/psd.js`.

### `color-management-controller.js`
Owns document-facing CMYK/ICC orchestration: preview/edit transform caches and invalidation, color-policy/profile transactions, asynchronous native-CMYK preview rebuild with active-document rollback, ICC profile load/remove actions and properties-panel control bindings. It receives state/color/pixel/IO/render/UI capabilities through explicit ports.

It deliberately does **not** own ICC parser/transform math (`src/core/color-management.js`), PixelBuffer math, the canonical document schema, or PSD/PSB binary resources (`src/formats/psd.js`). `src/main.js` keeps only narrow bridges needed by painting and PSD import preview.

Future UI extractions should land here when they can be expressed as pure config/helpers or narrow controllers rather than adding more unrelated responsibility to `src/main.js`.

## Painting boundary — `src/painting/`

### `controller.js`
Owns reusable raster-edit state shared by brush/eraser/fill/line and retouch routing: Canvas8 buffer/context/layer identity, native high-depth/CMYK working buffer, preview invalidation/frame throttling, render overrides, raster materialization and publication back to the layer.

It deliberately does **not** own tool choice, stroke routing, selection semantics, history commits or the application-wide pending-edit guard.

### `command-controller.js`
Owns bounded one-shot raster commands: flood fill, raster line and clearing pixels on the current raster layer inside the active selection. Canvas8 and native RGB/CMYK high-depth paths share the same injected target, selection, tool, transaction and UI ports.

It deliberately does **not** own global pointer events, selection-shape state, history storage or the application-wide pending-edit flag. Multi-layer selection clearing used by merged Clipboard cut belongs to `src/selection/raster-mutation-controller.js` rather than this current-layer command controller.

### `gesture-controller.js`
Owns the bounded lifecycle of one brush/eraser/retouch stroke: choose existing/new raster target, choose native high-depth/CMYK vs Canvas8 path, initialize per-stroke retouch state, route movement segments and persist on end. Dependencies are grouped ports (`state`, `target`, `selection`, `tools`, `nativePaint`, `ui`) instead of a long flat callback list.

It deliberately does **not** own global pointer events/capture, `currentTool`, document/session identity, selection/history state or the global pending-edit flag. Generic capture/active-pointer ownership lives in `src/interaction/pointer-lifecycle-router.js`; tool-specific routing and the other application state remain in `src/main.js`; storage/persistence stays in `src/painting/controller.js`; pixel math stays in core.

## Retouch boundary — `src/retouch/`

### `controller.js`
Owns destructive retouch mechanics for Canvas8 and native typed RGB/CMYK paths: clone/heal source + immutable per-stroke snapshots, smudge, blur, dodge/burn, private scratch canvases and high-depth retouch dispatch.

It does **not** own document/history/global pointer state or the shared raster edit buffer. Per-stroke routing lives in `src/painting/gesture-controller.js`; global event/transaction orchestration remains in `src/main.js`; shared paint state/persistence lives in `src/painting/controller.js`; pixel math remains in core.

## Document boundary — `src/document/`

### `smart-object-controller.js`
Owns generic Smart Object content lifecycle: convert selected layer, linked-copy/unlink, nested-content depth and source bounds, content-tab open/deduplication, save propagation to shared instances, parent/content stale-context guards, dirty/history/recovery publication and preview-cache invalidation.

Stable document/geometry helpers are direct dependencies. Browser preview rendering, workspace session bridges and Photoshop native embedded-resource rewrite are explicit narrow ports. Photoshop PSD/PSB serialization/resource bytes deliberately stay outside this controller so generic ZPE Smart Object behavior remains directly Node-testable.

### `psd-smart-object-resource.js`
Owns Photoshop-specific embedded Smart Object resource policy: PNG preview payload extraction, PSD/PSB re-encoding through prepared export data, bounded linked-layer block rewrite, explicit publish of prepared `liFD` blocks and per-target native baseline/fingerprint refresh.

Stable binary primitives stay in `src/formats/psd.js`; fingerprint/opaque-block decoding primitives stay in `psd-native-metadata-plans.js`. The owner receives PSD export preparation and the shared opaque-block-to-state bridge as narrow ports. Rewrite preparation does not mutate the parent document; the generic Smart Object controller revalidates content/parent identity after every await and only then calls the publish/update ports.

### `import-controller.js`
Owns incoming-file classification and image import orchestration: image/project detection, decode-and-validate-before-mutate transaction, empty-document sizing, anchor placement and routing to PSD/project callbacks. It does not own PSD parsing or project persistence; those remain separate runtime/format concerns.

### `psd-import-controller.js`
Owns the import transaction from a PSD/PSB file to a canonical ZPE document after codec decode: size guard, decoded layer/group/path mapping, native high-depth/CMYK preservation, ICC preview policy, temporary-buffer budgeting, stale document/session checks and publish coordination. Stable core transforms are direct dependencies; binary decode, browser raster encoding, runtime publication and Photoshop semantics are explicit narrow ports.

### `psd-import-semantics.js`
Owns Photoshop-specific import interpretation below that transaction: solid-shape eligibility and native baselines, TySh text metadata snapshots, adjustment metadata baselines, Smart Object metadata/fingerprints and editable embedded PNG/JPEG/WebP/GIF/BMP/PSD/PSB content mapping. It imports stable core/domain transforms directly. Effectful codec/browser work plus shared vector-mask localization, opaque-resource conversion and Smart Object fingerprint primitives are explicit ports, so this owner stays directly testable without taking session/history/publication ownership or depending on the export-plan module.

### `psd-native-metadata-plans.js`
Owns Photoshop-native export compatibility decisions and bounded metadata rewrites for editable Text/TySh, solid vector Shape, Adjustment and Smart Object records. It imports public rewrite primitives from `src/formats/psd.js`, shared sanitizers from core and contains no browser/UI orchestration.

The planner also owns persisted opaque-block decoding plus Smart Object preview/embedded fingerprints used to prove native passthrough is still safe. Unsupported or stale metadata returns an explicit ineligible plan; raster fallback remains the export controller's responsibility.

### `psd-export-controller.js`
Owns document-to-PSD/PSB writer preparation: export bounds, group ancestry, native high-depth/CMYK eligibility, raster/native layer payloads, merged composite selection and bounded export warnings. Photoshop semantic plans are direct dependencies from `psd-native-metadata-plans.js`; browser rendering and the generic vector-mask bridge remain explicit ports so native preparation stays directly Node-testable. Binary PSD/PSB parsing/writing stays in `src/formats/psd.js`.

## Selection boundary — `src/selection/`

### `gesture-controller.js`
Owns transient selection gesture mechanics: active marquee type, rectangle/ellipse/free-lasso drag lifecycle, polygon draft completion/cancellation, magnetic-edge sampling/drafts and their overlay drawing. It receives canonical selection shape, rendered-canvas and UI operations through explicit ports and deliberately does not install global DOM listeners.

Generic pointer capture/active-pointer routing lives in `src/interaction/pointer-lifecycle-router.js`; tool/keyboard dispatch and canonical selection shape/session state remain in `src/main.js`; geometry math remains in `src/core/geometry.js`.

### `clipboard-controller.js`
Owns selection copy/cut/paste orchestration: selected-vs-merged PNG preparation, browser Clipboard API, native paste payload handling, shortcut fallback timers/generation and tab-switch guards. It does not own document mutation internals: destructive clearing is delegated to the raster-mutation controller.

### `raster-mutation-controller.js`
Owns destructive selection-to-layer orchestration: merged cut across visible unlocked pixel layers, prepare-all-before-mutate staging, native high-depth clear publication, non-raster pixel-edit rasterization and the selected-layer rasterize command with document/session stale guards. It does not own selection shape/pointer state or Clipboard APIs.

## Workspace boundary — `src/workspace/`

### `session-controller.js`
Owns document-tab/session lifecycle: session IDs and names, per-tab history/zoom/dirty/selection snapshots, tab rendering/actions, switching, close/rename/duplicate, and the parent-tab guard for open Smart Object content tabs.

It does **not** own raster/document internals. `src/main.js` supplies the live runtime state bridge and application callbacks; `src/core/state.js` remains the document model owner.

### `recovery-controller.js`
Owns workspace recovery orchestration: reload-stable per-window identity, debounce/cancellation, serialized writes/discard, dirty-tab snapshot collection, startup recovery selection and safe publication into document sessions.

It deliberately does **not** implement IndexedDB or project schemas. `src/core/recovery.js` owns record normalization/storage, while `src/main.js` only wires explicit storage/project/session/runtime/UI ports. Ownership is enforced in the controller too: a recovery record belonging to another live editor window cannot be discarded merely because UI returns an invalid action.

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
- `recovery.js` — low-level IndexedDB recovery record normalization/read/write/clear adapter; no session/UI orchestration.
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

# Architecture boundaries

These rules keep the project understandable and prevent the large app controller from absorbing every new concern.

## Allowed direction

```text
index.html / styles
        ↓
src/main.js  ─────→  src/ui/*
    │  ├──────→  src/workspace/*
    │  ├──────→  src/interaction/*
    │  ├──────→  src/selection/*
    │  ├──────→  src/document/*
    │  ├──────→  src/painting/* ───→ src/core/*
    │  └──────→  src/retouch/*  ───→ src/core/*
    ↓
src/core/*  ←────  src/formats/*
        ↓
browser primitives (Canvas, Worker, storage, File APIs)
```

## Rules

### Document replacement lifecycle
- `src/document/new-document-controller.js` is the canonical owner for File → New / Ctrl+N replacement orchestration and the shared dirty-confirm predicate consumed by other document-open owners.
- New Document must run pending-edit guard before confirmation, repeat it on submit, call canonical `createDocument` before any publication, then publish in this order: replace the history binding with fresh `HistoryStack(80)` → `setDocument(..., { resetHistory:true, label:'Новый документ' })` → mark clean → queue immediate recovery → fit viewport.
- Factory/validation failure must keep the modal open and publish only the existing error toast/status; it must not replace history/document/session, alter dirty state, queue recovery or fit the viewport.
- The controller receives narrow ports. It must not read global `els`, duplicate canvas validation/limits, absorb generic modal DOM, or become a generic document-dialog framework. `src/main.js` owns only composition and dispatch.

### Interaction
- `src/interaction/pointer-lifecycle-router.js` owns only generic overlay Pointer Events lifecycle: one active pointer, capture/release, active-pointer filtering and `pointerup` / `pointercancel` / `lostpointercapture` termination.
- It must not branch on editor tool names or own drag/domain state. Selected-layer transform read-only discovery/hit/draw/cursor semantics live in `src/interaction/layer-transform-surface-controller.js`; Move/Resize/Rotate transaction semantics live in `src/interaction/layer-transform-gesture-controller.js`; existing Bézier read-only surface semantics live in `src/interaction/path-control-surface-controller.js`; one-shot existing-anchor corner conversion semantics live in `src/interaction/path-control-command-controller.js`; existing Bézier anchor/handle drag semantics live in `src/interaction/path-control-gesture-controller.js`; transient new-path draft/handle semantics live in `src/interaction/pen-draft-gesture-controller.js`; final new-path persisted publication lives in `src/interaction/pen-path-command-controller.js`; pointer/tool routing stays in `src/main.js`, while paint/selection/crop semantics stay with their domain owners.
- Pointer ownership must be cleared even when a release/cancel callback fails; an unexpected `lostpointercapture` must enter the same domain cancellation path rather than leave a stuck gesture.
- `src/interaction/layer-transform-surface-controller.js` is the single read-only owner of selected-layer transform presentation/targeting: transformable + visible + recursive-lock policy, selected rotate/resize control classification, reverse-z Move target discovery, zoom-aware frame/handles/rotation/name badge and rotated idle cursor intent. It may return semantic move/resize/rotate intent but must not mutate document geometry, publish history, own Smart Snap, pointer capture or DOM cursor writes; text-edit preview is supplied through an explicit display-layer port.
- `src/interaction/layer-transform-gesture-controller.js` is the single owner of an interactive selected-layer Move/Resize/Rotate transaction: capture originating document + stable layer ID + object identity + baseline, re-resolve that exact target and recursive lock on every update/finalize/cancel, mutate only live-preview geometry, and publish at most one history entry at successful finalization. Surface discovery/hit/draw/cursor policy belongs to `layer-transform-surface-controller.js`.
- `src/interaction/path-control-surface-controller.js` is the single owner of the read-only existing-Bézier edit surface: choose Saved Path edit targets before the selected layer; discover matching Vector Mask or Shape targets without hiding locked controls; project layer-local controls to document space; reject recursively locked targets only at hit/edit selection; preserve handle-before-anchor priority and `8 / zoom` hit radius; trace open/closed cubic paths; draw source/lock-specific controls with zoom-stable metrics; and own idle Pen pointer/crosshair feedback. It may clear only the invalid transient Saved Path edit index and must not mutate persisted path geometry or publish history.
- This surface owner must not own pointer capture, drag baselines/history, Alt-click corner mutation/history, new `penDraft`/`pen-handle` creation, Saved Paths CRUD, Vector Mask lifecycle or PSD/PSB serialization. It may expose exact live-target resolution as a read-only identity port; the one-shot corner command consumes that port in `path-control-command-controller.js`.
- `src/interaction/path-control-command-controller.js` is the single owner of the one-shot Alt-click existing-anchor → corner persisted command: require anchor+Alt intent; revalidate the active document; resolve the exact live target through the surface identity port; recheck recursive lock state immediately before mutation; clear both handles and set `kind='corner'`; preserve source-specific history labels; and suppress history while keeping the exact existing status for an already-corner/no-handles semantic no-op. Rejected stale/missing/locked targets must not mutate or publish history.
- This command owner must not discover/draw controls, own drag state, install pointer listeners, create new Pen paths, or absorb Saved Paths / Vector Mask lifecycle commands.
- `src/interaction/path-control-gesture-controller.js` is the single owner of an existing Bézier anchor/handle drag transaction: capture the originating document, stable Saved Path ID where available, exact layer/path/subpath/node identities and baseline; re-resolve the exact target and recursive layer lock on every update/finalize/cancel; treat the zoom threshold as a mutation boundary by restoring sub-threshold previews; preserve final-release geometry; publish exactly one of the six established history labels only for a semantic change; and use the same rollback primitive for pointer-cancel and Escape.
- Smart Snap/Shift/Ctrl, Resize Shift/Alt + zoom-aware minimum size and Rotate Shift 15° must reuse `src/core/geometry.js`; semantic return-to-baseline/unchanged transforms publish zero history. Cancel/Escape/lost-capture may restore only the captured exact active target and never a same-ID replacement or another document.
- This gesture owner must not install pointer listeners/capture, rediscover/hit-test/render existing controls, own DOM panels, or absorb synchronous nudge/center/align/fit commands. Existing control discovery/projection/hit/render/cursor policy belongs to `path-control-surface-controller.js`; pointer/tool dispatch remains in `src/main.js`; generic capture and discrete layer transforms stay with `pointer-lifecycle-router.js` and `src/layers/transform-command-controller.js`.

- `src/interaction/pen-draft-gesture-controller.js` is the single owner of transient creation for a brand-new Pen path: controller-local points/hover, immutable snapshots, `4 / zoom` finish intent, `1 / zoom` per-point handle threshold, mirrored smooth vs Alt-independent corner handles, final-release coordinate application, exact release status classification and exact transient-node/full-draft cancellation.
- `src/interaction/pen-path-command-controller.js` is the single owner of persisted publication for a consumed new-Pen draft: exact active-document guard + pre-write revalidation, handle-inclusive bounds, layer-local node projection, canonical Shape-path options, zero-history no-op rejection and exactly one history publication for a real path. It must not own transient draft/DOM/pointer state.
- A Pen-draft gesture is bound to the exact draft object + node identity. Reset/replacement makes stale gesture objects non-authoritative; pointercancel/Escape may remove only the captured transient node. The controller owns no persisted document mutation, layer creation or history. `src/main.js` consumes a cloned point list and remains the owner of bounds/localization/Shape publication until that separate command boundary is extracted.

### UI
- `src/ui/layers-panel-controller.js` owns only Layers tree/panel DOM and panel-local interaction state. It may import stable lock/visibility queries from core, but layer/group mutations/history/feature commands enter through explicit runtime ports.
- A rendered Layers-row callback must prove its originating document is still active before selecting, renaming, deleting, opening feature UI or publishing a drag/drop action. Drag identity is controller-local and every drop/end/destroy path clears decorations + identity.
- Relative layer DnD must reject locked source **and locked target**; nested effective lock/visibility presentation uses canonical recursive core queries rather than duplicating ancestor logic.
- `src/layers/command-controller.js` is the single semantic owner for primitive layer/group commands used by panel/menu/button/keyboard paths. Every exact command first proves the originating document is still active and resolves the target by ID; modal Apply repeats that proof before mutation.
- `src/layers/transform-command-controller.js` is the single semantic owner for synchronous selected-layer nudge/center/align/fit commands. It must re-resolve the stable target ID in the active document, use `isLayerLocked()` for recursive effective locks, reject Adjustment layers, use core frame/alignment helpers instead of duplicating geometry, and commit only after a semantic transform. Pointer transform gestures belong to `src/interaction/layer-transform-gesture-controller.js`, and Properties preview transactions belong to `src/layers/property-command-controller.js`; neither must migrate into this owner.
- Effective lock checks are recursive through `src/core/state.js`; failed/stale/no-op commands publish no history. The controller may call stable core mutations directly, but it must not own Layers DOM/DnD state, feature-heavy Smart Object/mask/blending menus, or history storage.
- `src/layers/property-command-controller.js` is the single semantic owner for generic Layer Properties / Color & Effects / discrete Image-menu filter resets / persistent layer opacity+blend / HDR display-preview mutations. Rendered controls and discrete commands pass the originating document + stable layer ID; every write re-resolves that exact target and re-checks effective lock state.
- Live `input` preview may mutate the exact live layer and render without history, but it must remember the pre-preview baseline and increment only the transient change serial. The final `change` publishes at most one real commit against that baseline; reverting to the original value, stale callbacks, invalid input and same-value writes publish no history/dirty state. Discrete filter resets sanitize through core state, clear relevant preview baselines and commit only when canonical persisted state actually changes.
- Properties markup remains in `src/main.js`; stable schema/sanitizers/clamps stay in `src/core/state.js`; Text option/capability policy stays in `src/ui/text-settings-controller.js`. Do not move Adjustment Layer parameter ownership, Smart Filter UI, Layer Blending Options or Text add/edit modal state into the generic property owner.
- `src/layers/adjustment-command-controller.js` is the single owner of persisted Adjustment scalar/Levels/Curves/clipping command validation and history. Bindings keep markup/formatting in `src/main.js` but pass originating document + stable layer ID; the owner re-resolves the exact target, uses recursive core lock policy, validates allowed paths/Curves syntax before mutation, canonicalizes through `src/core/adjustments.js`, and commits only semantic changes. `commit()` is the sole dirty/history publication; do not pre-call `markDirty(true)`. Photoshop-native Adjustment metadata remains untouched here and stays owned by PSD document/format boundaries.
- `src/ui/color-correction-controller.js` is the single owner of the Color Correction modal transaction: originating document + stable layer ID/identity, controller-local draft/original snapshots, bounded live preview, Reset, Apply/Cancel/Escape/backdrop finalization and idempotent focus/DOM cleanup.
- Color Correction preview may mutate only the exact active raster target and never writes history. Apply revalidates active owner, exact target and recursive effective lock before one commit; stale/locked finalization may roll the transient preview back in the originating document but must not render/commit into another active session. Control metadata stays in `src/ui/tool-config.js`, filter defaults/ranges/sanitization in `src/core/state.js`, and pixel math in `src/core/render.js`.
- `src/ui/tool-config.js`: pure configuration only.
- `src/ui/tool-layout.js`: pure layout/order math only.
- `src/ui/workspace-layout-controller.js` owns only editor-shell layout state: sidebar collapse persistence/migration plus canvas-mode chrome visibility and viewport-center preservation.
- The layout controller receives DOM/runtime geometry through explicit ports and must not own document/layer/history/tool state; do not recreate `collapsedPanelIds`, `panelsVisible` or its layout functions in `src/main.js`.
- `src/ui/paths-controller.js` owns Saved Paths selected-index state, bounded ID/name allocation, CRUD, panel/context-menu/keyboard wiring and apply-as-vector-mask orchestration. It receives live state/vector/edit/UI dependencies through grouped explicit ports.
- Saved Paths controller must not become a second PSD codec or path-interaction owner: resource serialization stays in `src/formats/psd.js`; existing target discovery/projection/hit-testing/control drawing/cursor feedback stays in `src/interaction/path-control-surface-controller.js`; existing anchor/handle drag transaction stays in `src/interaction/path-control-gesture-controller.js`; transient new Pen drafting lives in `src/interaction/pen-draft-gesture-controller.js`; transient `documentPathEditIndex` identity stays in `src/main.js`, while final new-path publication belongs to `src/interaction/pen-path-command-controller.js`. Do not recreate Saved Paths CRUD/render state in `src/main.js`.
- `src/ui/color-management-controller.js` owns document-level CMYK/ICC orchestration: preview/edit transform caches, invalidation, policy/profile transaction + rollback, native-CMYK preview rebuild and properties-panel bindings. Dependencies arrive through explicit state/color/pixel/IO/render/UI ports.
- ICC parser/transform math stays in `src/core/color-management.js`, document schema/sanitization in `src/core/state.js`, and PSD/PSB binary semantics in `src/formats/psd.js`. Do not recreate color-management caches or profile UI actions in `src/main.js`.
- Color-management async preview publication must verify that the initiating document is still active before replacing layer previews; stale/failing rebuilds roll policy/profile state back and invalidate transform caches before returning/throwing.
- `src/ui/smart-filter-controller.js` owns Smart Filter stack/mask markup, mutation commands, properties-panel bindings and edit-modal orchestration. It receives live document/selection/history/render/DOM capabilities through narrow ports.
- Smart Filter schema/sanitization/`MAX_SMART_FILTERS` stay in `src/core/state.js`; ordered pixel filtering and mask composition stay in `src/core/render.js`; the shared selection-mask rasterizer belongs to `src/selection/mask-controller.js`. Smart Filter consumes that rasterizer through a narrow port but keeps its own target/history publication transaction. Do not recreate Smart Filter policy functions in `src/main.js`.
- Async Smart Filter mask creation must prepare the selection raster first, then re-resolve the originating document + layer identity immediately before publication; a document switch publishes neither mask nor history.
- `src/ui/layer-blending-controller.js` owns Blending Options / Layer Styles modal construction, draft/live-preview transaction state, preview-canvas crop/sync and observer cleanup. Layer Style schema/sanitization/rendering remain in `src/core/layer-styles.js` / `src/core/render.js`.
- Blending preview writes are transient and history-free. Apply may commit only after revalidating the originating document + exact layer identity + lock state; Cancel, stale Apply, Escape or backdrop close must restore the original layer values. The controller must not expose mutable preview state back to `src/main.js`.
- `src/ui/text-edit-controller.js` owns Text add/edit transaction state, async latest-wins live preview, preview-canvas synchronization and modal-owned cleanup. Persisted text schema/render-only projection stay in `src/core/state.js`; text rendering/font loading stay in `src/core/render.js`; PSD Text semantics stay in the document/format owners.
- Text preview publication must revalidate the originating document and exact edit-layer identity after async settings/font resolution. Apply additionally revalidates the active modal, exact selected layer and lock state. `src/ui/modal-controller.js` remains feature-neutral: per-modal lifecycle uses generic `onMount`/`onClose` hooks rather than Text-specific callback injection.
- `src/ui/text-settings-controller.js` owns shared Text typography/font UI policy: canonical option sets, private local-font registry, `queryLocalFonts()` discovery/filter/sort/cap, custom-font read cache/validation, modal fields and form normalization. It may call stable IO/render helpers but must not own persisted layer schema or duplicate renderer FontFace caching.
- Text Properties may consume settings-controller methods, but its markup/binding stays in `src/main.js` and generic mutation/history publication goes through `src/layers/property-command-controller.js`. Any awaited custom-font publication must revalidate the originating document and exact selected layer identity before delegating; the property owner repeats exact-target + effective-lock validation before mutation/commit.
- DOM mutation and application state orchestration stay in `src/main.js` until extracted behind a narrow controller API. Generic overlay pointer lifecycle is the explicit exception owned by `src/interaction/pointer-lifecycle-router.js`.
- UI modules must not become alternate owners of document/layer domain state.

### Workspace
- `src/workspace/session-controller.js` owns document-tab/session lifecycle and per-session UI/runtime snapshots.
- `src/workspace/viewport-controller.js` is the single owner of canvas zoom/fit command policy: 0.1…16 clamp, near-equal no-op, active-session zoom sync, canvas/overlay refresh, pointer-anchored deferred scroll correction and the 90 px fit-to-view policy. See `VIEWPORT_NAVIGATION.md`.
- Keyboard/menu/wheel dispatch and pan gesture state stay in `src/main.js`; canvas-mode panel visibility/center preservation stays in `src/ui/workspace-layout-controller.js`. Do not merge these three ownership domains into a generic workspace state bag.
- `src/workspace/recovery-controller.js` owns recovery orchestration state: window identity, debounce/generation, serialized persistence queue, unreadable-sibling carry-forward and restore/discard policy.
- `src/core/recovery.js` stays a low-level IndexedDB/record adapter; it must not gain session/tab/UI ownership.
- Recovery controller receives storage/project/session/runtime/UI dependencies through explicit ports. Do not recreate recovery timers, write promises or window keys in `src/main.js`.
- Multi-window ownership is a controller invariant: foreign recovery entries may be inspected/restored, while deletion is rejected by default and is allowed only through the explicit user-confirmed project-manager path (`allowForeign:true`).
- Async recovery writes/discard must remain serialized; unreadable sibling records must not be silently lost when valid siblings are restored. Leaving recovery for a disk/new project must rotate a reserved current-window key before new autosave publication can occur.


### Native project persistence
- `src/document/project-controller.js` owns native `.zpe` open/save orchestration. Open is preflight → exact document/session/history/change-serial snapshot → async read/parse/sanitize → exact revalidation → second pending-edit guard → one publication path. See `docs/architecture/NATIVE_PROJECT_IO.md`.
- Read/parse/sanitize failure or stale ownership publishes no document/history/dirty/recovery/view mutation. Successful open installs sanitized state, resets history, marks clean, queues immediate recovery and fits once.
- Save routes Smart Object child sessions to their existing owner; regular `.zpe` download refreshes recovery but does not mark the document clean.
- Schema stays in `src/core/state.js`, browser IO in `src/core/io.js`, Smart Object persistence in `src/document/smart-object-controller.js`.

### Document import
- `src/document/import-controller.js` classifies incoming files and mutates the active document only after every image is decoded/validated.
- Async image import re-checks originating document/session before the first mutation.
- It only routes `.zpe` to the project controller and PSD/PSB to the PSD owner; it must not absorb either persistence/parser policy.

### Document resize
- `src/ui/document-resize-controller.js` is the single owner of Image Size / Canvas Size dialog orchestration: exact field/anchor schema, originating-document capture at open, repeated pending-edit guard at submit, delegation to the command owner and INVALID/REJECTED presentation. It owns no persisted geometry.
- `src/document/resize-command-controller.js` is the single semantic owner for persisted Image Size / Canvas Size commands. Apply must pass the exact owner captured by the UI controller; a different current document is a rejected stale command with no mutation, cleanup or history.
- All resize math that can fail must be staged before the first persisted write: Image Size uses canonical `checkedCanvasSize()` + `imageResizeTransforms()`; Canvas Size builds every shifted layer position and validates `MAX_LAYER_POSITION` before mutation. Invalid or semantic no-op requests publish nothing.
- Successful resize clears caller-owned geometry transient state and publishes exactly one history entry, then fits the same active document. Generic modal DOM lifecycle stays in `src/ui/modal-controller.js`; menu dispatch stays in `src/main.js`; Crop, pointer gestures, zoom/viewport policy and reusable document limits remain separate owners.

### Document crop
- `src/interaction/crop-gesture-controller.js` is the single owner of transient Crop draft/gesture state, exact originating-document gesture identity, the pointer 10×10 acceptance gate, session-safe immutable draft snapshot/restore and crop overlay/grid drawing. It must not mutate persisted document geometry or publish history. See `docs/architecture/CROP_INTERACTION.md`.
- `src/document/crop-command-controller.js` is the single semantic owner for persisted Crop geometry mutation/history. The crop gesture owner supplies the exact originating document; Crop-to-Selection captures the current document before delegation. Exact object identity is authoritative.
- Crop normalizes the existing rounded geometry only after finite/positive validation, proves the resulting canvas size is safe, stages every final layer `x/y` and rejects non-finite or `MAX_LAYER_POSITION` overflow before touching persisted state. The owner is revalidated immediately before the first write.
- A full-bounds crop is a persisted semantic no-op: zero history/dirty publication, while the existing successful-command transient completion (crop draft + selection + brush buffer cleanup and viewport fit) still runs once. Invalid/stale paths perform neither mutation nor transient cleanup.
- Generic pointer capture remains in `pointer-lifecycle-router.js`; tool/keyboard routing and Crop-to-Selection's separate 1×1 gate remain in `src/main.js`. Active pointer gestures are never restored from session snapshots. Do not merge Crop, Resize and Background into a generic document-geometry/property framework without a demonstrated shared contract.

### Document background
- `src/ui/document-background-controller.js` owns modal schema/options, exact open-time owner capture, open-time sampling of the current primary color and REJECTED presentation. Its ports are explicit; it must not read global `els` or re-resolve the active document on delayed Apply.
- `src/document/background-command-controller.js` is the single semantic owner for persisted Document Background mutation/history. The UI owner passes the originating document object to the command; object identity, not structural equality, is authoritative.
- Apply must revalidate `state.getDocument() === owner` immediately before writing. A tab/document switch or replacement object rejects the stale command without touching either document or publishing history.
- Same-value background is a semantic no-op. A real value change preserves existing accepted UI values and publishes exactly one `Фон документа` history entry. Schema/default and rendering stay in core owners. Background intentionally has no pending-edit guard; do not copy Resize policy or merge Background, Resize and Crop into a generic document-property owner without a demonstrated shared contract.

### Selection
- `src/selection/gesture-controller.js` owns transient selection interaction state: marquee type, rectangle/ellipse/free-lasso drag transitions, polygon/magnetic drafts, magnetic edge sampling and draft overlay drawing. It receives geometry, canonical selection shape and UI/runtime access through grouped ports.
- The gesture controller must not install global pointer/keyboard listeners, own document/session/history state, or become the canonical owner of persisted selection shape. Generic overlay pointer capture/ownership is routed by `src/interaction/pointer-lifecycle-router.js`; tool/keyboard dispatch and session snapshots stay in `src/main.js`.
- `src/selection/clipboard-copy-cut-controller.js` owns Selection Copy/Cut rendering, OS Clipboard write and latest-command continuation; `src/selection/clipboard-controller.js` owns Paste/native-paste/fallback generation and composes the stable public facade. The two generation domains stay independent. Destructive document mutation remains an explicit callback into `src/selection/raster-mutation-controller.js` or the current-layer painting command controller. See `SELECTION_CLIPBOARD.md`.
- `src/selection/raster-mutation-controller.js` owns merged-cut clearing across visible unlocked pixel layers, the reusable non-adjustment layer rasterization primitive and the selected-layer rasterize command. Its merged batch captures one full cloned selection-shape snapshot before target discovery, and target intersection, native high-depth predicates and Canvas clipping must all consume that same snapshot even if the live selection changes while preparation awaits. The batch stages all async preparation before mutation, then atomically re-checks exact document/session authority, every exact source-layer object and effective lock state before the first write. Same-ID replacement, removal or late effective lock of any target aborts the whole batch; publication uses exact validated slots, never ID-only lookup. The newer live selection is never restored or overwritten by completion of the older batch.
- `src/selection/mask-controller.js` owns selection → raster layer-mask / Select & Mask orchestration: layer/document coordinate bridging, bounded refine preparation, shared `selectionMaskDataUrl()`, add/remove mask commands, non-destructive modal preview and final Apply.
- Any awaited layer-mask publication must follow prepare → revalidate → publish: the originating document, exact selected layer and current lock state are checked immediately after the await before mutation/history. Preview must additionally prove the same modal generation is current; stale/closed/foreign preview work attaches no listeners and publishes no pixels.
- Raster-mask schema stays in `src/core/state.js`; refine/edge/compositor math stays in `src/core/pixels.js`; Smart Filter mutation stays in `src/ui/smart-filter-controller.js`; Vector Mask semantics remain separate.
- `src/selection/vector-mask-controller.js` owns only selection → Vector Mask geometry/boolean publication and selected-mask lifecycle commands. It may import stable geometry/state primitives directly and receives live selection/runtime/UI effects through grouped ports.
- Vector Mask Pen edit identity and Saved Path edit identity remain in `src/main.js`; existing target discovery/projection/hit-testing/control drawing/cursor feedback belongs to `src/interaction/path-control-surface-controller.js`, one-shot Alt-click corner conversion belongs to `src/interaction/path-control-command-controller.js`, while the existing anchor/handle drag transaction belongs to `src/interaction/path-control-gesture-controller.js`. Transient new Pen drafting lives in `src/interaction/pen-draft-gesture-controller.js`; final new-path publication belongs to `src/interaction/pen-path-command-controller.js`; Saved Paths CRUD ownership remains in `src/ui/paths-controller.js`; PSD/PSB vector-mask import/export conversion stays outside the selection controller. Entering Vector Mask edit must clear a competing Saved Path edit target before publishing the Vector Mask target.
- Selection modules must not own the canonical layer/document model or silently bypass lock/high-depth/Undo semantics; they receive live state through explicit ports and mutate only through the guarded transaction boundary.
- Async Clipboard Copy/Cut in `clipboard-copy-cut-controller.js` must capture exact document/session, full cloned selection geometry and (for selected-layer mode) the exact layer object before the first await. Rendering and later Cut consume that same frozen intent; stale work must not mutate replacement targets or clear/force newer selection/tool state.
- Overlapping Copy/Cut commands use a generation local to `clipboard-copy-cut-controller.js`; Paste uses a separate generation local to `clipboard-controller.js`. Each new Copy/Cut invocation supersedes older post-await continuation even when exact document/session/layer/selection identities are unchanged. After render/write awaits, an older generation publishes no later Cut, success/error status, toast or transient cleanup. Destructive merged/current-layer ports receive an optional caller continuation predicate and propagate it to the final Canvas/native-high-depth publication boundary, so ownership lost during rasterization/encoding aborts before pixel/history publication. An OS Clipboard write already in flight cannot be retroactively cancelled, so editor-state authority—not guessed OS completion order—is the protected contract.
- Downstream merged/current-layer clear commands may accept caller-owned document/session/target/selection snapshots from a higher async boundary, but keep independent exact-object publication guards; supplied selection geometry must never be replaced by newer live state or ID-only authority.

### Painting
- `src/painting/controller.js` is the single owner of reusable raster edit buffers. Canvas8 authority is exact active document + exact layer + exact Canvas; native high-depth/CMYK authority is exact active document + exact layer + exact typed working buffer. Matching IDs are never sufficient. `persistPaintLayer(owner, layer)`, `persistHighDepthMutation(owner, layer, buffer)` and `persistNativeHighDepthPaintLayer(owner, layer)` revalidate their exact publication authority after async PNG/preview encoding and before the first persisted write. See `RASTER_PERSISTENCE.md`.
- `src/painting/command-controller.js` owns bounded one-shot raster mutations: fill, raster line and selection clear on the current raster layer. It receives document/target/selection/tool/transaction/UI state through grouped explicit ports; native RGB/CMYK branches must publish through the exact-owner `persistHighDepthMutation()` seam and suppress history/success on stale results.
- The command controller must not install DOM listeners, own selection-shape/history state or replace the application-wide pending-edit guard. Multi-layer clearing used by merged Clipboard cut is owned by `src/selection/raster-mutation-controller.js` because it may rasterize heterogeneous layers.
- `src/painting/gradient-command-controller.js` is the single owner of persisted Gradient raster-layer publication. The Gradient drag in `src/main.js` captures the exact originating document object; preview stays in `src/main.js`. The command must use the shared runtime persistence guard, prepare with captured owner dimensions, prove exact owner identity before consuming live selection state, revalidate `state.getDocument() === owner` immediately after PNG serialization, and only then perform the first persisted write/history publication. Same-ID replacement is stale; stale work publishes nothing and may never be redirected to the active document. See `GRADIENT_COMMAND.md`.
- `src/painting/gradient-command-controller.js` must not own pointer capture, preview drawing, selection-shape storage, history storage or a Gradient-private busy flag. The shared guard is always released in `finally`, including stale/error outcomes.
- `src/painting/gesture-controller.js` owns one paint stroke lifecycle (`begin → move → end`) for brush/eraser and retouch routing. Every Canvas8 or native high-depth/CMYK drag captures the exact originating document and exact layer object; preparation, native paint callbacks, move and end use those captured objects rather than re-resolving a same-ID target from mutable active state. It receives the current tool and caller-owned pointer validity per gesture instead of reading global runtime state.
- The gesture controller talks to document/selection/tool/UI/runtime state through grouped explicit ports. It must not install global DOM listeners, own `currentTool`, own selection/history state or replace the application-wide pending-edit guard.
- `src/interaction/pointer-lifecycle-router.js` owns global overlay capture/release and active-pointer routing; `src/main.js` owns tool-specific dispatch plus shared transaction/history boundaries. Runtime delegates stroke mechanics to `paintGesture`, one-shot current-layer mutations to `rasterCommands`, persisted Gradient publication to `gradientCommands`, and destructive multi-layer selection/rasterization orchestration to `selectionRasterMutations`.
- Do not recreate `brushCanvas`, `brushCtx`, high-depth paint state, `beginPaint/paintTo/endPaint` or fill/line/current-layer selection-clear implementations in `src/main.js`.

### Retouch
- `src/retouch/controller.js` owns clone/heal/smudge/blur/dodge/burn mechanics and only their private scratch/snapshot state.
- The controller may depend on core geometry/pixel primitives, but must not become a second owner of document, layer, selection, history, shared painting state or pointer gesture state.
- Generic raster edit storage/persistence belongs to `src/painting/controller.js`; per-stroke retouch routing belongs to `src/painting/gesture-controller.js`; global pointer/transaction coordination remains in `src/main.js`.
- High-depth/CMYK retouch must stay on typed-buffer primitives; do not silently route it through Canvas8.

### Core
- Core modules should not know about menu labels, DOM selectors or CSS classes.
- Pixel/color/render code owns math and data transforms, not dialogs or toasts.
- State sanitization remains the gate for persisted/untrusted project structures.

### Document / Smart Object content lifecycle
- `src/document/smart-object-controller.js` owns generic Smart Object convert/open/save/link/unlink orchestration, nested-content depth/source-bounds rules, shared-source propagation and content-tab stale-context protection.
- It may import stable core state/geometry/style helpers directly. Browser preview rendering, workspace/session bridges, history/recovery publication hooks and Photoshop-native resource rewrite enter as explicit ports.
- Photoshop embedded PSD/PSB/PNG serialization, linked-resource byte rewrite and native metadata fingerprint updates must not migrate into the generic lifecycle controller.
- Async convert/save must revalidate the originating document/session/content before publishing, and shared-source counts must be computed against the parent owner rather than whichever content tab becomes active.

### Document / PSD Smart Object resource rewrite
- `src/document/psd-smart-object-resource.js` owns Photoshop-specific embedded PNG/PSD/PSB payload serialization, bounded `liFD` linked-resource rewrite preparation, explicit publication of prepared linked blocks and per-target baseline/fingerprint metadata refresh.
- Low-level PSD/PSB encoding and linked-record byte surgery remain in `src/formats/psd.js`; document-to-writer preparation remains in `src/document/psd-export-controller.js`; shared fingerprints/opaque-block decoding remain in `psd-native-metadata-plans.js`.
- Resource preparation must not mutate `parentDoc` or target layers. Only `smart-object-controller.js`, after stale content/parent revalidation, may call the resource owner's publish/update ports.
- Preserve the embedded asset/profile/linked-block bounds and writer safety limits. Unsupported formats, missing baselines, changed embedded dimensions and missing matching UUIDs must remain explicit safe fallback reasons.

### Document / PSD import mapping
- `src/document/psd-import-controller.js` owns PSD/PSB file guard + decode orchestration + decoded-payload mapping + stale-context validation + publish coordination.
- It may depend directly on stable core state/pixel/color contracts. Binary decode is injected from `src/formats/psd.js`; DOM/canvas data-URL encoding, Photoshop import semantics and runtime mutation are ports.
- `src/document/psd-import-semantics.js` owns Photoshop Text/Shape/Adjustment/Smart Object import metadata interpretation and editable embedded-asset mapping. It may import stable core/domain transforms directly; codec/browser effects and shared cross-feature vector-mask / opaque-resource conversions plus Smart Object fingerprint helpers remain explicit ports.
- Import semantics must not publish documents, own session/history state, rewrite export metadata, or become a second PSD binary codec. Shared vector-mask localization and opaque-resource state conversion stay with their broader runtime/resource owners until a separate cohesive seam exists.
- The import controller must not absorb export preparation, PSD byte parsing/writing, workspace/session ownership or generic file routing. Do not recreate `openPsd()` in `src/main.js`.

### Document / PSD native metadata planning
- `src/document/psd-native-metadata-plans.js` owns export eligibility and bounded rewrite planning for Photoshop Text/TySh, solid Shape, Adjustment and Smart Object metadata.
- It may depend on stable core sanitizers/geometry and public rewrite primitives from `src/formats/psd.js`; it must not parse/write the PSD container, render Canvas pixels or mutate editor state.
- Unsafe, changed or unsupported native metadata must return an explicit ineligible plan so the export controller can surface an honest raster/composite fallback.

### Document export orchestration
- `src/document/export-controller.js` owns the Export modal schema, repeated pending-edit preflight, one detached submit-time document snapshot, format routing and completion/error publication.
- Rendering, PSD preparation, PSD/PSB codecs and low-level IO remain explicit ports. After snapshot capture the owner must not read mutable live document state again.
- Browser download is the publication boundary: render/prepare/encode failure must produce no partial download. Keep PSD preparation in `psd-export-controller.js` and binary layout in `formats/psd.js`.
- Detailed contract: `DOCUMENT_EXPORT.md`.

### Document / PSD export preparation
- `src/document/psd-export-controller.js` owns document-to-writer preparation only: bounds, group mapping, native-vs-raster eligibility, prepared layer payloads, merged composite choice and export warnings.
- Native Photoshop metadata plans are direct dependencies from `psd-native-metadata-plans.js`. Browser rendering and the shared generic vector-mask exporter remain explicit ports.
- Do not move PSD binary layout or codec responsibilities into the controller, and do not let `src/main.js` regain the extracted preparation helpers or native metadata-plan implementations.

### Formats
- `src/formats/psd.js` may depend on core data contracts such as PixelBuffer.
- Core modules must not depend on PSD-specific binary layout.
- Photoshop-specific byte preservation/rewrite belongs in the format boundary.
- `src/adapters/psd.js` is a compatibility shim only.

### Generated files
- `src/app.bundle.js` has no independent logic ownership.
- Source changes must be made in canonical modules and regenerated.
- CI's generated-bundle diff is an architecture check, not noise to suppress.

### Compatibility shims
- Legacy paths may re-export canonical modules while migrations settle.
- Do not add implementation, state or tests that target shim internals.
- New imports use canonical paths.

## Extraction rule for src/main.js

Extract only when a section has a clear owner and API. Prefer this sequence:
1. pure constants/config;
2. pure helpers;
3. controller with explicit dependencies/callbacks;
4. stateful subsystem only after regression coverage exists.

Do not move code merely to reduce line count if it increases hidden coupling.

## Change checklist

Before moving a boundary:
- locate direct imports and source-contract tests;
- preserve `file://` bundle order;
- keep compatibility only where it prevents avoidable breakage;
- add/adjust a regression test for the new boundary;
- run `npm run check` and `npm run test:browser` when runtime/bootstrap paths changed.

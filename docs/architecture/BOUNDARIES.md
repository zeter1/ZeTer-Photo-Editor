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

### Interaction
- `src/interaction/pointer-lifecycle-router.js` owns only generic overlay Pointer Events lifecycle: one active pointer, capture/release, active-pointer filtering and `pointerup` / `pointercancel` / `lostpointercapture` termination.
- It must not branch on editor tool names or own drag/domain state. Move/transform/paint/path/selection/crop semantics stay in `src/main.js` or their domain controllers.
- Pointer ownership must be cleared even when a release/cancel callback fails; an unexpected `lostpointercapture` must enter the same domain cancellation path rather than leave a stuck gesture.

### UI
- `src/ui/tool-config.js`: pure configuration only.
- `src/ui/tool-layout.js`: pure layout/order math only.
- `src/ui/workspace-layout-controller.js` owns only editor-shell layout state: sidebar collapse persistence/migration plus canvas-mode chrome visibility and viewport-center preservation.
- The layout controller receives DOM/runtime geometry through explicit ports and must not own document/layer/history/tool state; do not recreate `collapsedPanelIds`, `panelsVisible` or its layout functions in `src/main.js`.
- DOM mutation and application state orchestration stay in `src/main.js` until extracted behind a narrow controller API. Generic overlay pointer lifecycle is the explicit exception owned by `src/interaction/pointer-lifecycle-router.js`.
- UI modules must not become alternate owners of document/layer domain state.

### Workspace
- `src/workspace/session-controller.js` owns document-tab/session lifecycle and per-session UI/runtime snapshots.
- `src/workspace/recovery-controller.js` owns recovery orchestration state: window identity, debounce/generation, serialized persistence queue, unreadable-sibling carry-forward and restore/discard policy.
- `src/core/recovery.js` stays a low-level IndexedDB/record adapter; it must not gain session/tab/UI ownership.
- Recovery controller receives storage/project/session/runtime/UI dependencies through explicit ports. Do not recreate recovery timers, write promises or window keys in `src/main.js`.
- Multi-window ownership is a controller invariant, not only a modal affordance: foreign recovery entries may be inspected/restored but not deleted by this window.
- Async recovery writes/discard must remain serialized; unreadable sibling records must not be silently lost when valid siblings are restored.


### Document import
- `src/document/import-controller.js` may classify incoming files and mutate the active document only after every image is decoded/validated.
- Async import must re-check originating document/session before the first mutation.
- PSD parsing stays in `src/formats/psd.js`; project open/save stays outside the import controller until extracted behind its own boundary.

### Selection
- `src/selection/gesture-controller.js` owns transient selection interaction state: marquee type, rectangle/ellipse/free-lasso drag transitions, polygon/magnetic drafts, magnetic edge sampling and draft overlay drawing. It receives geometry, canonical selection shape and UI/runtime access through grouped ports.
- The gesture controller must not install global pointer/keyboard listeners, own document/session/history state, or become the canonical owner of persisted selection shape. Generic overlay pointer capture/ownership is routed by `src/interaction/pointer-lifecycle-router.js`; tool/keyboard dispatch and session snapshots stay in `src/main.js`.
- `src/selection/clipboard-controller.js` may orchestrate browser Clipboard APIs and call render helpers, but destructive document mutation remains an explicit callback into `src/selection/raster-mutation-controller.js` or the current-layer painting command controller.
- `src/selection/raster-mutation-controller.js` owns merged-cut clearing across visible unlocked pixel layers, the reusable non-adjustment layer rasterization primitive and the selected-layer rasterize command. It must stage async preparation before mutation and re-check document/session identity before publishing results.
- Selection modules must not own the canonical layer/document model or silently bypass lock/high-depth/Undo semantics; they receive live state through explicit ports and mutate only through the guarded transaction boundary.
- Async clipboard and raster-mutation operations must stay bound to the document/session that initiated them.

### Painting
- `src/painting/controller.js` is the single owner of reusable raster edit buffers: Canvas/context/layer identity, native high-depth/CMYK working state, paint-preview scheduling/override and raster publication.
- `src/painting/command-controller.js` owns bounded one-shot raster mutations: fill, raster line and selection clear on the current raster layer. It receives document/target/selection/tool/transaction/UI state through grouped explicit ports and preserves Canvas8 plus native RGB/CMYK high-depth paths.
- The command controller must not install DOM listeners, own selection-shape/history state or replace the application-wide pending-edit guard. Multi-layer clearing used by merged Clipboard cut is owned by `src/selection/raster-mutation-controller.js` because it may rasterize heterogeneous layers.
- `src/painting/gesture-controller.js` owns one paint stroke lifecycle (`begin → move → end`) for brush/eraser and retouch routing. It receives the current tool and caller-owned pointer validity per gesture instead of reading global runtime state.
- The gesture controller talks to document/selection/tool/UI/runtime state through grouped explicit ports. It must not install global DOM listeners, own `currentTool`, own selection/history state or replace the application-wide pending-edit guard.
- `src/interaction/pointer-lifecycle-router.js` owns global overlay capture/release and active-pointer routing; `src/main.js` owns tool-specific dispatch plus shared transaction/history boundaries. Runtime delegates stroke mechanics to `paintGesture`, one-shot current-layer mutations to `rasterCommands` and destructive multi-layer selection/rasterization orchestration to `selectionRasterMutations`.
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

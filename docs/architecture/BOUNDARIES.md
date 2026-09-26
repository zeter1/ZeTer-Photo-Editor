# Architecture boundaries

These rules keep the project understandable and prevent the large app controller from absorbing every new concern.

## Allowed direction

```text
index.html / styles
        ↓
src/main.js  ─────→  src/ui/*
    │  ├──────→  src/selection/*
    │  ├──────→  src/document/*
    │  └──────→  src/retouch/*  ───→ src/core/*
    ↓
src/core/*  ←────  src/formats/*
        ↓
browser primitives (Canvas, Worker, storage, File APIs)
```

## Rules

### UI
- `src/ui/tool-config.js`: pure configuration only.
- `src/ui/tool-layout.js`: pure layout/order math only.
- DOM mutation, global event wiring and application state orchestration stay in `src/main.js` until extracted behind a narrow controller API.
- UI modules must not become alternate owners of document/layer domain state.

### Document import
- `src/document/import-controller.js` may classify incoming files and mutate the active document only after every image is decoded/validated.
- Async import must re-check originating document/session before the first mutation.
- PSD parsing stays in `src/formats/psd.js`; project open/save stays outside the import controller until extracted behind its own boundary.

### Selection
- `src/selection/clipboard-controller.js` may orchestrate browser Clipboard APIs and call render helpers, but document mutation remains explicit callbacks.
- Selection modules must not own layer/document state or silently bypass lock/high-depth/Undo semantics.
- Async clipboard operations must stay bound to the document/session that initiated them.

### Retouch
- `src/retouch/controller.js` owns clone/heal/smudge/blur/dodge/burn mechanics and only their private scratch/snapshot state.
- The controller may depend on core geometry/pixel primitives, but must not become a second owner of document, layer, selection, history or pointer gesture state.
- Generic brush/eraser/fill/line preparation and mutation transaction guards stay in `src/main.js` until a separate painting boundary is extracted.
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

# Viewport navigation — zoom and fit-to-view contract

## Purpose

This is the narrow specification for canvas zoom and fit-to-view behavior. Read it before changing zoom math, pointer-anchored zoom, fit commands, or per-session zoom persistence. Do not read all of `src/main.js` first.

## Canonical owners

| Concern | Owner |
|---|---|
| Zoom clamp, semantic no-op, per-session sync, viewport refresh | `src/workspace/viewport-controller.js` |
| Pointer-anchored zoom scroll correction | `src/workspace/viewport-controller.js` |
| Fit-to-view calculation + scroll reset | `src/workspace/viewport-controller.js` |
| Keyboard / wheel / View-menu dispatch | `src/main.js` |
| Canvas-mode panel visibility + center preservation | `src/ui/workspace-layout-controller.js` |
| Per-tab snapshot/load lifecycle | `src/workspace/session-controller.js` |
| Pure fit/clamp math | `src/core/geometry.js` |
| Pan gesture state | `src/main.js` + pointer lifecycle routing |

## Behavioral contract

1. Canonical zoom range is **0.1 … 16** (10% … 1600%).
2. Requests within `1e-6` of current zoom are semantic no-ops: no resize, overlay redraw, status publication, or deferred scroll correction.
3. Every real zoom updates both live runtime zoom and the active session's stored `zoom`, when a session exists.
4. Every real zoom refreshes canvas sizing and overlay geometry exactly once.
5. Normal zoom publishes `Масштаб N%`; callers may request a silent zoom.
6. Pointer-anchored zoom captures the document point under the client pointer **before** changing zoom.
7. Anchoring correction stays behind a one-shot `requestAnimationFrame` boundary. The callback reads the post-layout overlay rectangle and current live zoom before changing `scrollLeft` / `scrollTop`.
8. Fit-to-view uses current viewport size, current document dimensions and the existing **90 px** padding policy through `fitZoom(..., 90)`.
9. Fit-to-view resets viewport scroll origin even when the computed zoom is already current.
10. Session restore stays owned by `session-controller.js`; the viewport owner only synchronizes a real zoom command into the active session.
11. Pan / Space / middle-mouse state and canvas-mode panel toggling are separate owners and must not migrate here.
12. The generated `file://` bundle loads the viewport owner before `src/main.js`.

## Pointer-anchored sequence

```text
wheel/tool dispatch in main
        ↓
clientPointToCanvas(clientX, clientY)
        ↓
publish clamped zoom + session zoom
        ↓
resize canvas CSS + redraw overlay
        ↓
requestAnimationFrame(one shot)
        ↓
read new overlay rect + current zoom
        ↓
correct viewport scroll so the captured canvas point stays under the pointer
```

The animation-frame seam is temporal behavior, not cosmetic implementation detail. Removing it changes which layout geometry the correction observes.

## Test oracle

Use `tests/workspace-viewport-controller.test.mjs` for zoom math and temporal behavior. Keep only event-dispatch/source-routing assertions in `tests/workspace-navigation-v17.test.mjs`.

Required regressions: min/max clamp; near-equal no-op; active-session sync; silent status; no-session runtime; deferred pointer anchoring + no-op anchoring; fit padding + scroll reset; architecture/build ownership; real `file://` browser smoke.

## AI change procedure

1. Read this file and the exact controller/test.
2. Inspect only the relevant dispatch caller in `src/main.js`.
3. Preserve the owner split above; do not create a generic workspace state bag.
4. Change controller + direct behavior test first.
5. Retarget source guards rather than duplicating implementation back into `main.js`.
6. Run generated-artifact parity and real browser smoke before claiming safety.

# Canvas8 raster persistence ownership

This document is the canonical contract for the reusable **Canvas8** paint buffer and its asynchronous publication in `src/painting/controller.js`.

Read it when changing fill/line, brush/eraser/retouch Canvas8 strokes, clone-source preparation, paint preview overrides, or any code that calls `ensureRasterBuffer()` / `persistPaintLayer()`.

> Scope: Canvas8 only. Native high-depth/CMYK paint persistence has a separate lifecycle and must not be assumed to have the guarantees described here unless its own code/tests prove them.

## Ownership model

A prepared Canvas8 buffer belongs to three exact objects:

1. the originating document object;
2. the exact raster layer object inside that document;
3. the exact Canvas object prepared for that owner/target pair.

IDs are metadata, not authority. A different document or layer object with the same ID is a replacement and must not inherit the old buffer or a late async result.

`src/painting/controller.js` is the single owner of this reusable buffer identity. Callers pass authority in; they do not reimplement the cache.

## Preparation contract

`ensureRasterBuffer(owner, layer)` follows **validate → prepare locally → await if needed → revalidate → publish buffer**.

- `owner` must still be the active document by exact object identity.
- `layer` must still be the exact layer object contained in `owner.layers`, must be raster, and must remain editable.
- Cache reuse requires the same owner object, same layer object and compatible Canvas dimensions. Matching IDs are insufficient.
- If loading an existing raster source crosses an async boundary, preparation stays in a local candidate Canvas. Shared `brushCanvas` / target identity is updated only after exact-owner/target revalidation.
- A stale preparation returns no buffer and must not replace the shared Canvas8 cache.
- A Canvas8 preview override is exposed only while its exact owner/target is still current, so same-ID document replacement cannot display a stale paint buffer.

This is the reusable cache rule: **cache identity must be at least as strict as mutation authority**.

## Persistence contract

`persistPaintLayer(owner, layer)` follows **capture buffer → validate → encode → revalidate owner + target + buffer → publish**.

Before PNG encoding it verifies that the shared buffer belongs to exactly `owner` and `layer`. Immediately after `await canvasToDataURL(...)`, before the first persisted write, it revalidates:

- active document identity is still `owner`;
- `owner.layers` still contains the exact `layer` object;
- the shared Canvas8 buffer is still the exact captured Canvas;
- the buffer owner/target metadata still points to the same exact objects;
- the target remains an editable raster layer.

Only then may it replace `layer.dataUrl`, clear high-depth metadata for the Canvas8 result, and invalidate the old image cache.

A document switch, same-ID document replacement, same-ID layer replacement, buffer replacement, removal or lock change is stale. Stale persistence returns without mutating either the origin or the newly active/replacement target.

Encoding failures are real failures and remain observable to the caller; do not suppress them as stale no-ops.

## Caller contract

Canvas8 callers must capture the owner and exact layer before their asynchronous work and pass both explicitly:

- `src/painting/command-controller.js`: fill, raster line and current-layer selection clear;
- `src/painting/gesture-controller.js`: Canvas8 brush/eraser/retouch stroke lifecycle;
- `src/main.js::setCloneSource()`: Canvas8 clone/heal source preparation.

For paint gestures, drag state carries the exact owner and layer. Movement must not re-resolve the layer from a mutable current document by ID.

The application-wide raster persistence guard remains outside `src/painting/controller.js`. Command/gesture callers acquire it and release it in `finally`. A stale persistence result publishes no history entry and no success status.

Selection clipping and tool semantics remain owned by their existing boundaries; owner-bound persistence does not become a second selection or history owner.

## Failure / no-op matrix

| Case | Canvas mutation | Persisted layer write | History/success |
| --- | --- | --- | --- |
| exact owner + exact layer + exact buffer | allowed | one publish | caller may publish once |
| active document changed | local old Canvas may exist | none | none |
| same-ID replacement document | none redirected | none | none |
| same-ID replacement layer | none redirected | none | none |
| shared Canvas replaced while encoding | replacement is untouched | none from stale encoder | none |
| PNG encoding throws | no persisted write | none | caller error path |
| shared busy guard already held | command does not start | none | none |

## Regression oracles

The nearest tests are:

- `tests/painting-controller.test.mjs`: exact cache identity, normal publish, document switch, same-ID document/layer replacement and encoding failure;
- `tests/painting-command-controller.test.mjs`: explicit owner/target handoff plus stale result suppressing history/success;
- `tests/painting-gesture-controller.test.mjs`: drag owner/target identity, stale movement rejection and stale end suppression;
- `tests/architecture-layout.test.mjs`: source-level ownership guard;
- canonical `npm run check` + `npm run test:browser`: integration, generated bundle and file:// startup.

Prefer deferred or deterministic Promise boundaries over timing-based sleeps for future stale-result regressions.

## Non-goals

This contract does not redesign retouch math, selection clipping, history storage, global pointer capture or native high-depth persistence.

If native high-depth persistence still selects its target from mutable current state across an `await`, fix that as a separate bounded task with its own exact-owner tests rather than silently broadening a Canvas8 pass.

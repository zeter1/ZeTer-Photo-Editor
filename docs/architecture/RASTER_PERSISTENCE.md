# Raster persistence ownership

This document is the canonical contract for reusable **Canvas8** and native **16/32-bit RGB / CMYK** paint state plus their asynchronous publication in `src/painting/controller.js`.

Read it when changing fill/line, brush/eraser/retouch strokes, clone-source preparation, paint preview overrides, or code that calls `ensureRasterBuffer()`, `persistPaintLayer()`, `ensureNativeHighDepthPaintBuffer()`, `persistHighDepthMutation()` or `persistNativeHighDepthPaintLayer()`.

> Scope: current-layer painting/commands and their shared raster-edit cache. Multi-layer Clipboard cut / selection clearing owns a separate batch transaction in `src/selection/raster-mutation-controller.js`; it may reuse low-level high-depth preparation/apply helpers but must prove its own owner/target publication safety.

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

## Native high-depth / CMYK contract

Native working state uses the same authority rule but has a different payload. The cache belongs to the exact originating document object, exact raster-layer object, exact typed `PixelBuffer` and its preview Canvas. A matching `document.id` or `layer.id` is never enough.

`ensureNativeHighDepthPaintBuffer(owner, layer)` may reuse native state only when the exact owner and layer are still current and editable. Publishing a new native cache stores both object identities alongside the layer ID; preview overrides are exposed only while `isNativeHighDepthPaintTarget(owner, layer)` still proves that identity.

There are two native publication seams:

- `persistHighDepthMutation(owner, layer, buffer)` is used by one-shot line/fill/current-layer-clear commands. It validates the exact target, serializes the typed source and awaits PNG preview encoding, revalidates the exact owner/layer immediately after the await, then atomically applies `highDepthSource`, `highDepthPreview` and `dataUrl`.
- `persistNativeHighDepthPaintLayer(owner, layer)` is used by paint gestures. In addition to owner/layer revalidation it captures the exact cached working buffer and proves that the cache was not replaced while preview encoding was pending.

A stale native result returns `false`; callers must publish no history entry and no success status. Encoding errors remain errors and the gesture error path clears the native working state so an unsaved stroke cannot leak into a later gesture.

`prepareHighDepthMutation()` and `applyHighDepthMutation()` are lower-level mechanisms, not an implicit async-safety contract. A batch owner that uses them directly must stage work locally and revalidate every publication target before mutation.

This yields one reusable rule for both raster modes: **the authority proven after the last await must be at least as strict as the authority that created the working buffer**.


## Multi-layer selection batch contract

`src/selection/raster-mutation-controller.js::clearAcrossVisibleLayers()` owns a separate destructive batch transaction for merged Clipboard cut / multi-layer selection clearing. It may reuse low-level Canvas/high-depth preparation helpers, but it must establish publication authority for the **whole target set** itself.

The batch follows **capture target set → prepare all → await → revalidate all → publish all**:

1. capture the originating document object, active session and every exact source-layer object selected for the batch;
2. finish rasterization, PNG encoding and native high-depth mutation preparation without persisted writes;
3. after the final await and immediately before the first persisted write, revalidate the exact document/session plus every exact source-layer object with object identity and current effective lock state;
4. derive publication slots from the exact source objects (for example `owner.layers.indexOf(sourceLayer)`), never from `layer.id`;
5. if any target was removed, replaced — including by a same-ID object — or became effectively locked, reject the entire batch: apply no prepared high-depth mutation, replace no rasterized layer and publish no history/success result;
6. once the full plan is validated, publish synchronously with no intervening await. A raster source is mutated only through its exact captured object; a rasterized non-raster source replaces only its exact validated slot.

This is an all-or-none authority gate over publication, not a generic rollback framework. Preparation errors remain real errors; the shared raster-persistence guard is still released in `finally`.

## Caller contract

Raster callers must capture the owner and exact layer before asynchronous work and pass both explicitly:

- `src/painting/command-controller.js`: fill, raster line and current-layer selection clear; native branches publish through `persistHighDepthMutation(owner, layer, buffer)`;
- `src/painting/gesture-controller.js`: Canvas8 and native brush/eraser/retouch stroke lifecycle; native end passes the drag's exact owner/layer to `persistNativeHighDepthPaintLayer()`;
- `src/main.js::setCloneSource()`: Canvas8 clone/heal source preparation.

For paint gestures, drag state carries the exact owner and layer. Movement and end must not re-resolve a layer from a mutable current document by ID. Native paint callbacks receive the captured owner too, so typed edits cannot validate cache authority by layer ID alone.

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
- `tests/selection-raster-mutation-controller.test.mjs`: merged-batch success, same-ID replacement/removal/effective-lock rejection, high-depth all-or-none publication and preparation-failure cleanup;
- `tests/architecture-layout.test.mjs`: source-level ownership guards, including rejection of ID-only merged-batch publication;
- canonical `npm run check` + `npm run test:browser`: integration, generated bundle and file:// startup.

Prefer deferred or deterministic Promise boundaries over timing-based sleeps for future stale-result regressions.

## Non-goals

This contract does not redesign retouch math, selection clipping, history storage, global pointer capture, PSD/PSB import/export or the multi-layer selection batch transaction.

Do not broaden the shared raster controller into those owners. If another async raster publisher uses `prepareHighDepthMutation()` / `applyHighDepthMutation()` directly, review that caller's own exact-target revalidation and give it a bounded regression task instead of assuming this current-layer contract covers it.

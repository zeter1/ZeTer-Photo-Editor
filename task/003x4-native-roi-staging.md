# 003X/4 — bounded native ROI staging and temporary encoding allocations

**ID:** 003X/4. **Priority:** P1. **Status:** TODO. **Parent:** 003X / Stage 6 IN PROGRESS.
**Dependencies:** 003X/1 private tile ownership DONE, 003X/2 resident cache DONE, 003X/3 encoded dirty overlay reservation DONE after verified exact merged-main CI.
**Independent blocker:** Photoshop-authored PSB32 provenance 002B/2c remains P0 BLOCKED; synthetic / application-generated PSB is not Adobe provenance.

## Problem / scope

003X/3 bounds retained encoded dirty tile data-URL reservations (default: full validated native source capacity; a stricter `maxEncodedDirtyBytes` can fail closed), but that reservation is **not** peak memory usage. A native ROI read may materialize a large contiguous typed region, a cooperative write may stage multiple full tile arrays, encoders allocate temporary canonical bytes + binary and Base64 strings, and the immutable source, History, Worker buffers and browser all remain additional owners. Distinguish these allocations and avoid claiming browser or OS peak memory from an owned-array budget.

## Implementation and acceptance criteria

1. Audit `src/core/pixel-buffer.js` native v2 `readRegionSteps`, `writeRegionSteps`, `publishStaged`, dirty writeback in `makeRoom`, and `serializeSteps` for identifiable simultaneously held temporary typed arrays / encoded intermediates. Include existing callers in painting/retouch; record exact owner, shape and bytes and one measurable over-allocation.
2. Implement one bounded production improvement to ROI staging or encoded writeback transients without altering the v1/v2 project schema. Introduce explicit limits/preflight where necessary; ensure no implicit 8-bit quantization, clamping of float HDR, or loss of alpha.
3. Preserve committed dirty data and original native source atomically across multi-tile failures, stale cooperative writers and cancellation. A failed/cancelled write must not produce partial History, preview or modified serialized project.
4. Deterministically test RGB16 and CMYKA32 Float32 exact bytes including alpha, tile edges, sparse and dense edits, read/visit/ROI serialization, cancellation, injected allocation/encoder failure and configured byte ceiling. Assert actual allocations/properties owned by the modified path, not an invented OS peak.
5. Regenerate the offline bundle/Worker parity; run the full Linux `npm run check`, genuine Chromium `file://` PSD16/PSB32 edit + Undo/Redo/.zpe native readbacks, actual PR final-head core and real-photo CI, merge only green, then exact merged-main CI.
6. Update `task/003x-native-tile-ownership.md`, this card, `task/NEXT.md` and `task/README.md` with changed files, direct evidence, commits and CI URLs. Do not mark parent 003X or Stage 6 DONE based solely on this slice.

**Not claimed:** true operation-exclusive OS RAM peak; Worker-to-OS PID mapping; full virtual tiled raster migration; independently Photoshop-authored PSB32 acceptance.

## Status

TODO — no implementation for 003X/4 yet. The first pass should inspect the exact native ROI and writeback ownership boundaries, select a demonstrably helpful bounded production fix, and test the real edit consumer.


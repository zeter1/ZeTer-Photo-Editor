# 003X/4 — bounded native ROI staging and temporary encoding allocations

**ID:** 003X/4. **Priority:** P1. **Status:** DONE (bounded native ROI staging increment, final CI verified). **Parent:** 003X / Stage 6 IN PROGRESS.
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

IN PROGRESS — implementation candidate is ready for real PR CI; do not mark this slice DONE before browser/CI/merge gates.


## 003X/4 candidate, 2026-10-26 — bounded ROI reads and private ROI write staging

**Production allocation audit:** `readRegionSteps` allocated one contiguous typed ROI of `width * height * targetChannels * bytesPerSample` before visiting any tile. `writeRegionSteps` held one private `target.data.slice()` for **each changed tile** until `publishStaged`, but unlike `visit` it did **not** check `maxVisitBytes`; the previously declared visit budget could be exceeded by a multi-tile ROI. The resident LRU, encoded dirty overlays and snapshots are additional owners. `makeRoom` / `publishStaged` can hold canonical bytes and encoded data URLs during writeback; those temporaries and browser/OS peak are **not bounded by this patch**.

**Code:** `src/core/pixel-buffer.js` now provides optional `maxRegionBytes` (default: existing validated `maxBytes`, preserving genuine dense operations). Both synchronous and cooperative ROI reads reject before allocating or loading any tile if contiguous native ROI exceeds that limit. `writeRegion` refuses oversized input regions before mutation, and limits the total private changed tile copies to `maxVisitBytes` **before** the next `TypedArray.slice()`. Each native tile is charged its actual typed byte length. Failure at tile N leaves the earlier staged copies unpublished; the existing atomic `publishStaged` and revision/cancellation checks remain in place. Optional strict ceilings are API-level; **no .zpe schema, 8-bit conversion or float clamping** introduced.

**Tests:** `tests/native-roi-staging-budget.test.mjs` adds six Node regressions: RGB16 and CMYKA32 Float32 native/alpha Undo and .zpe JSON precision, exact second-tile allocation avoidance (monitored native `TypedArray.slice`), configured read and write ROI preflight with no lazy load, and mid-32,768-pixel cooperative cancellation after private staging with safe retry. Local Windows focused **6/6 PASS**, baseline tile ownership **10/10 PASS**. `npm run check` built offline assets (hash `095365a0e82df0e5`) and executed 1,538 Node tests: **1,523 PASS, 10 SKIP, 5 FAIL** in pre-existing Linux-only `/proc`/cgroup fixtures when run on Windows. The only conclusion is that Windows all-platform check is not green; Linux CI is mandatory.

**Changed files:** `src/core/pixel-buffer.js`, `tests/native-roi-staging-budget.test.mjs`, rebuilt `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json`, `task/003x4-native-roi-staging.md`, `task/003x-native-tile-ownership.md`, `task/NEXT.md`, `task/README.md`.

**Unverified gates:** authentic `file://` Chromium PSD16/PSB32 with full native readback, final-head Linux core CI and separate real-photo CI, merge/exact-main CI. Do not claim a global temporary encoding budget, true OS RAM peak, Worker OS PID ownership or Photoshop-authored PSB32 provenance. Encoder/allocation failure atomicity still relies on the existing `publishStaged` tests; broader temporary encoding ownership remains the next scope after this bounded increment.

**Next if green:** open 003X/5 P1 for the canonical tile encoding transient (`canonicalTileBytes` plus binary/Base64 intermediates) with source-level allocation accounting, bounded batch/eviction conversion, failure injection, native precision and real file:// regression; keep parent 003X and Stage 6 IN PROGRESS.

## 003X/4 final bounded acceptance (2026-10-26)

**003X/4 bounded DONE (2026-10-26):** [PR #344](https://github.com/zeter1/ZeTer-Photo-Editor/pull/344) merged to [main 92cd61e9f](https://github.com/zeter1/ZeTer-Photo-Editor/commit/92cd61e9fe4f39b10ddb1f70e75168cbf0dfa400), final PR-head [Linux core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40349386666) SUCCESS 12/12 and [real-photo PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40349387436) SUCCESS; exact merged-code [main core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40350178186) SUCCESS 12/12 and [main real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40350178197) SUCCESS. Six new native ROI tests (RGB16, CMYKA32 Float32 and alpha, exact Undo/.zpe, configured read/write budget, refusal before second private tile clone, cooperative cancellation/retry), Windows native Chrome `file://` smoke SUCCESS; local Windows all-platform 1523 PASS / 10 SKIP / 5 Linux-only cgroup tests FAIL. Native ROI allocation/preflight and `maxVisitBytes` accumulated private write staging bounded, but encoding temporary bytes/strings, History, Worker and OS peak NOT globally bounded. Parent 003X/Stage 6 IN PROGRESS, independent Adobe-authored PSB32 002B/2c BLOCKED. NEXT **003X/5 P1 TODO:** [bound canonical native tile encoding transients](003x5-native-encoding-transients.md) with exact high-depth native/failure/browser checks.

**Remaining:** task [003X/5](003x5-native-encoding-transients.md) temporary encoding owners; does not close 003X or Stage 6. No operation-exclusive OS peak or Adobe-authored PSB32 claim.

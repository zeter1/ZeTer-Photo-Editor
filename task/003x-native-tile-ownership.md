# 003X — bounded native pixel tile ownership and writeback (Stage 6)

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003 tiled Content-Aware](003-tiled-content-aware.md) / Stage 6 IN PROGRESS.
**Dependencies:** existing typed pixel buffers, [003U](003u-bounded-ui-selection-freeze.md) DONE, [003V](003v-ui-selection-scan-cancellation.md) DONE, [003T/4b-2](003t4b-retention-observer-control.md) bounded DONE.
**Blocker unrelated:** external independent Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) P0 BLOCKED.

## Goal
Deliver one bounded **production-code** native tile ownership/read/write contract, incrementally, without rewriting the document model or treating the successful ~2M-pixel Content-Aware Worker as a global tiled-raster architecture. A bounded high-depth editing path must avoid an unnecessary full-document native pixel-buffer copy while preserving exact source precision, History and file://.

## Next implementation pass and acceptance
1. Inspect current layer/document buffers, native precision and high-depth render/edit flows in src, plus existing tests. Identify one specific reproducible full-image buffer allocation/copy in the real production path. Do not assume that tiled rendering or allocation is absent without examining code.
2. Add a small, typed native tile adapter or equivalent minimal change to the established abstraction, with explicit ownership/byte budget, stable tile coordinates, safe bounds and copy-on-write semantics. Avoid new dependencies, required server or risky global migration.
3. Route **one existing real editing consumer** to the bounded contract; preserve existing .zpe load/save, PSD/PSB import/export, raster/mask/selection, Undo/Redo, Worker cancellation, alpha and exact native RGB16 and RGB/CMYKA32 data. Preserve unmodified native data through round-trip. Unsupported cases must fail closed rather than silently quantize to 8-bit.
4. Add deterministic tests for tile boundaries, partial edge tiles, mixed-format bit depths, source mutation/ownership, cancellation/stale async replies, undo exact bytes, and memory ceilings; assert the chosen full-document copy is eliminated from this path rather than only measuring allocations.
5. Exercise genuine Chromium file:// PSD16 and PSB32 high-depth operations and project native readbacks, `npm run check`, generated artifact parity, PR final-head CI, merge and exact merged-code main CI.
6. Record exact files, tests and measured evidence in this card, README and NEXT; leave this task TODO until actual code and native gates are verified. Do not claim global tiling, operation-exclusive peak RAM, proven Worker OS PID or Adobe-authored PSB32 support without evidence.

## Baseline / rationale (2026-10-23)
[003T/4b-2 PR #336](https://github.com/zeter1/ZeTer-Photo-Editor/pull/336) passed authentic replicated fresh PSD16/PSB32 native treatment and observer controls, final PR-head [CI #39966160193](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39966160193) (12/12), and exact main [CI #39966840082](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39966840082) (12/12) after [main 4030bfc9](https://github.com/zeter1/ZeTer-Photo-Editor/commit/4030bfc9e9dbfef288447ad318ab9cb070c28202). Whole-browser sampled RSS showed both positive and negative control changes and PID membership gaps; **no reproducible causal native leak was established**, so unowned Worker/cache changes are not justified. Move to targeted production-level tiling improvements with source-level profiling and exact native regressions.

## 003X/1 candidate — native copy ownership and transactional tile writeback (2026-10-23)

**Priority:** P1. **Status:** IN PROGRESS (candidate, awaiting actual PR-head CI). **Parent:** 003X / 003 / Stage 6 IN PROGRESS.

### Verified source-level issue and bounded implementation
- `src/painting/controller.js:editableHighDepthBuffer` decoded a complete immutable high-depth serialized source into new typed data and immediately called `clonePixelBuffer(decoded)`, allocating a **second full-sized native plane** for legacy v1 brush/line/fill editing; alpha-bearing sources suffered the same redundant clone with `pixelBufferWithStraightAlpha`. No such second native full-plane is required: deserialization owns freshly allocated typed memory by contract.
- `src/core/pixel-buffer.js:deserializeEditablePixelBufferSource` now explicitly hands the first private decoded plane to editing, promoting RGB/CMYK alpha only when absent. Painting uses this single-owner bridge. No source serialization, PSD/PSB binary precision, or .zpe schema change.
- Existing v2 `createSerializedPixelBufferTileWorkingSet().visit` now stages **only intersecting native tile copies**; `zero`/invalid delta, throwing visitor, unsafe count or `maxVisitBytes` overflow cannot partially dirty or publish earlier tiles. Dirty/preview flags and buffers publish together after successful visitor completion. The optional `maxVisitBytes` is a per-visit private staging byte ceiling; it is **not** a measured OS RAM cap or global tiled architecture.
- `tests/native-tile-ownership.test.mjs`: legacy RGB16/CMYKA32 exact ownership/alpha, COW partial-edge tiles, unchanged tile payload identity, exceptions/budget rollback, .zpe JSON bytes, source integrity, deterministic cancellation and undo snapshot checks. The implementation retains existing read/write cooperative APIs and non-server `file://` design.
- Deterministic generated `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json` were synchronized; computed previous-build hash matches existing `7f668698a38dee3b`, initial candidate build `0579c17f4af87f64` (superseded by `1426dc1a8596387d`).

### Changed files
`src/core/pixel-buffer.js`, `src/painting/controller.js`, `tests/native-tile-ownership.test.mjs`, generated four browser files above, `task/003x-native-tile-ownership.md`, `task/NEXT.md`, `task/README.md`.

### Acceptance still required
- Actual test outcome (`npm run check`, generated parity, genuine Chromium `file://` PSD16 and PSB32 native editing, Undo/Redo, .zpe native readback, worker cancel), final-head PR CI and exact-main CI are **PENDING** until observed. No local checkout/tests: runtime has no DNS to github.com, so use GitHub CI evidence.
- This pass does not prove a strict small resident cache cap, global tiled raster, operation-exclusive RAM peak or Photoshop-authored PSB32. The original source must not be mutated and unsupported depth conversion must fail closed.
- **NEXT 003X/2 P1:** once first candidate CI is green, verify authentic high-depth browser artifacts against this precise branch, inspect tile-retention limits and implement an explicit bounded lazy tile residency/eviction or an equivalent demonstrated production improvement; keep same task until complete 003X acceptance. The independent Photoshop-authored PSB32 `002B/2c` remains P0 BLOCKED.


## 003X/1 bounded acceptance — code merged (2026-10-23)

**Bounded status: DONE.** Overall **003X: IN PROGRESS**; this is not a global tiled raster migration or end-to-end native memory bound.

### GitHub / reproducible evidence
- Implementation [PR #338](https://github.com/zeter1/ZeTer-Photo-Editor/pull/338), exact final source head [fecf85e7](https://github.com/zeter1/ZeTer-Photo-Editor/commit/fecf85e71201e393b1b90ca5956809f0333f1bc9), accepted as [main squash commit 74ea5b2f](https://github.com/zeter1/ZeTer-Photo-Editor/commit/74ea5b2fca70c87202a4e8ea6959ab2f8fc0f21a).
- [Exact final PR-head core CI #39972459772](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39972459772): **SUCCESS, 12/12 jobs**, 1,518/1,518 Node tests, including six new `003X` ownership/partial edge/memory/rollback/.zpe/cancel tests. Generated browser bundle + offline Worker source parity, real Chromium `file://` native PSD16/PSB32, Fill/Cancel/Undo/Redo, replacement/owner isolation all green.
- [Exact PR-head real-photo #39972459649](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39972459649): **SUCCESS**, genuine real-photo Chromium Worker scenarios.
- [Exact merged-code main CI #39973544797](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39973544797): **SUCCESS, 12/12 jobs** for `74ea5b2fca70c87202a4e8ea6959ab2f8fc0f21a`.
- Independent merged-code [main real-photo #39973544737](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39973544737) **SUCCESS** for exact merged-code main (separate from the core 12/12 result).
- Initial candidate head had 1,517/1,518 tests (one existing static `decoded.model` CMYK assertion); fixed, 1,518/1,518 on final. No skipped guard or disabled test.
- Source-level removal: original `deserializePixelBufferSource` already returns an independently allocated typed plane. `editableHighDepthBuffer` no longer performs a redundant second full-plane `clonePixelBuffer` for RGB/CMYK when alpha already present. The decoded bytes remain exact. No measured operation peak RAM claimed.
- `createSerializedPixelBufferTileWorkingSet.visit` copies only intersecting tiles privately before commit; invalid/zero delta, exceptions, over-budget fail without partial dirty buffers or preview flags. The `maxVisitBytes` cap bounds **simultaneously staged changed tile arrays** per visit, not all decoded/cache/UI RAM; loaded cache remains uncapped. No additional dependency or server requirement.
- Canonical new build hash **`1426dc1a8596387d`**; old baseline **`7f668698a38dee3b`** independently matched before replacement. The earlier candidate checkpoint hash `0579c17f4af87f64` was superseded by CMYK guard compatibility fix.

### Next precise stage — 003X/2 P1 TODO
**Goal:** bound native lazy tile cache residency and writeback in one real consumer, not just transactional staging bytes. Inspect `loaded`, `dirty`, `previewDirty` lifetime in the existing `createSerializedPixelBufferTileWorkingSet`, prove current cache amplification on repeated sparse edits, provide safe eviction/reload of clean tiles and a bounded policy for dirty state or explicit fail-closed if not feasible. Verify full RGB16/CMYKA32 exact native samples, float HDR, alpha, unchanged serialized tile identity, cancellation/worker races, history Undo/Redo and save/reopen `.zpe`, strict memory-byte tests, browser PSD16/PSB32 `file://`, exact PR+main CI. The pending independently Photoshop-authored PSB32 `002B/2c` remains P0 BLOCKED. Never claim OS operation peak, Worker→PID ownership, or global tiled architecture.

## 003X/2 candidate — bounded native resident tile cache (2026-10-26)

**Status:** IN PROGRESS, not accepted until genuine Linux PR and main CI. **Branch:** [feat/003x2-bounded-native-tile-cache-20261026](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/003x2-bounded-native-tile-cache-20261026).

- In `createSerializedPixelBufferTileWorkingSet`, native typed tiles now use an LRU resident byte ceiling (`maxResidentBytes`; default max(16 MiB, largest native tile), clamped to `maxBytes`). Cache can discard clean tiles and write dirty bytes into private canonical little-endian Base64 tile overlays before typed eviction. It re-decodes dirty overlays without 8-bit conversion, supports alpha promotion and retains original .zpe/PSD tile objects for untouched tiles.
- Resident budget is **only the loaded typed-array cache**, not a global memory cap. Dirty serialized overlays can accumulate up to edited document size; ROI staging, preview, immutable source strings, History, Worker, browser and OS RAM are **outside** that budget. No measured operation-exclusive peak or Worker PID attribution.
- Cooperative ROI writes reject a stale commit if a newer tile edit committed during a yield. Previously completed dirty changes survive cancellation, subsequent reads, repeated evictions and native serialization; cache invalidates stale encoded representations when changes commit.
- `tests/native-tile-ownership.test.mjs`: three new tests (four per-model cases) for repeated dirty eviction/reload, preview, exact native RGB16 and CMYKA32, alpha channel promotion, clean eviction, caps, .zpe/Undo and a real asynchronous stale-writer interleaving.
- On Windows local checkout, `node --test tests/native-tile-ownership.test.mjs tests/pixel-buffer.test.mjs tests/high-depth-editing.test.mjs tests/high-depth-persistence.test.mjs tests/high-depth-retouch.test.mjs tests/history-native-byte-budget.test.mjs` returned **50/50 PASS**. `npm.cmd run check` rebuilt deterministic artifacts but the all-platform test suite failed on Linux-only `/proc` / cgroup tests in Windows. This is not a green `npm run check` result.
- Exact genuine Chromium `file://` native PSD16/PSB32 evidence, Linux `npm run check`, PR final-head CI, merge and exact merged-main CI must still be observed. Keep this parent IN PROGRESS and move NEXT only after the gated checks.

Changed: `src/core/pixel-buffer.js`, `tests/native-tile-ownership.test.mjs`, generated `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json`, `task/003x-native-tile-ownership.md`, `task/NEXT.md`, `task/README.md`.

## 003X/2 implementation merged — PR CI checkpoint (2026-10-26)

**Priority:** P1. **Bounded implementation status:** code **MERGED** (native typed cache + exact dirty writeback); overall **003X IN PROGRESS**; exact merged-main CI **PENDING** at this checkpoint. **Dependencies:** 003X/1 DONE, typed native PixelBuffer, browser file://. Adobe-authored PSB32 P0 provenance blocker remains.

- [PR #340](https://github.com/zeter1/ZeTer-Photo-Editor/pull/340) final head [bc956840](https://github.com/zeter1/ZeTer-Photo-Editor/commit/bc95684068e843e4bc4f665785d66d199778606b) squash-merged as [main 8bd8b6cb](https://github.com/zeter1/ZeTer-Photo-Editor/commit/8bd8b6cb39cba773e581f57b188828ad5270c84e). Final head matched successful PR CI; no blocking reviews.
- Genuine Linux [PR core CI #40307773294](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40307773294) **SUCCESS 12/12**, **1522/1522 Node**, generated bundle/Worker parity; real Chromium file:// PSD16 and PSB32 dense owner/cancel and native/History/Worker receipt verifiers passed. [PR real-photo #40307773309](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40307773309) **SUCCESS**. Earlier local Windows 50/50 focused PASS, but the complete Windows npm check failed on Linux-only /proc and cgroup fixtures.
- Exact merged-code [main CI #40311410168](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40311410168) and [main real-photo #40311409879](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40311409879) were **IN PROGRESS** at this checkpoint; do not infer green until observed. Documentation checkpoint PR will have distinct CI.
- Production change: src/core/pixel-buffer.js; regression: tests/native-tile-ownership.test.mjs; regenerated offline src/app.bundle.js, src/core/tiled-inpaint-worker-source.js, index.html, version.json; updated task/NEXT.md, task/README.md, this task card. No added runtime server/dependency or .zpe schema change.
- Working scope: LRU byte bound for loaded typed tiles; lossless canonical little-endian Base64 dirty tile writeback before eviction and exact reload; clean eviction and dirty preview; RGB16, CMYKA32 float32, alpha promotion; unchanged original tiles; cooperative stale-writer refusal. NOT a byte cap on encoded dirty overlays, ROI staging, source, History, Worker, or OS operation-exclusive peaks. Photoshop-authored PSB32 remains independent BLOCKED.

### Next 003X/3 — P1 TODO: encoded dirty overlay byte budget and atomic refusal

**Goal:** explicitly account for and bound the encoded dirty writeback overlay growth as sparse native tiles are edited, retaining offline file:// usability. Do not describe the loaded-typed cache limit as a global RAM bound.

**Acceptance:** (1) characterize owner-specific overlay allocations, exact native byte and Base64 counts; (2) implement an explicit configurable memory budget or proven bounded writeback storage, refuse oversized edits before losing committed data, with transaction-safe multi-tile commit or fail-closed preflight; (3) preserve exact RGB16/CMYKA32 float32 samples, alpha, original unchanged native tiles, Undo/Redo and saved/reopened .zpe; (4) test sparse repeated edits, cache eviction/reload, throwing encoding, cancellation, stale async writes, budget exhaustion; (5) regenerate browser/Worker assets, run Linux npm run check and genuine Chromium file:// PSD16/PSB32 verification, final-head PR CI, merge and exact merged-code main CI; (6) update NEXT/README/task. Keep this new subtask **TODO** until all checks and production changes are verified.

### 003X/2 final merged-code acceptance (2026-10-26)

**Bounded 003X/2: DONE.** [Exact merged-code core main CI #40311410168](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40311410168) **SUCCESS (12/12 jobs)** and [separate main real-photo CI #40311409879](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40311409879) **SUCCESS**, both for exact squash-merge source head [8bd8b6cb](https://github.com/zeter1/ZeTer-Photo-Editor/commit/8bd8b6cb39cba773e581f57b188828ad5270c84e); PR final-head evidence documented above. This closes only native loaded-typed LRU residency, lossless dirty tile eviction/reload and stale cooperative writer refusal, not parent 003X. Next **003X/3 P1 TODO** encoded overlay byte budget and fail-closed atomic refusal; Stage 6 remains IN PROGRESS. Documentation-only acceptance PR CI and merged-main CI remain separate gates.

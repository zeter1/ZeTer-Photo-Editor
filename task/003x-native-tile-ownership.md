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
- Deterministic generated `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json` were synchronized; computed previous-build hash matches existing `7f668698a38dee3b`, candidate new build `0579c17f4af87f64`.

### Changed files
`src/core/pixel-buffer.js`, `src/painting/controller.js`, `tests/native-tile-ownership.test.mjs`, generated four browser files above, `task/003x-native-tile-ownership.md`, `task/NEXT.md`, `task/README.md`.

### Acceptance still required
- Actual test outcome (`npm run check`, generated parity, genuine Chromium `file://` PSD16 and PSB32 native editing, Undo/Redo, .zpe native readback, worker cancel), final-head PR CI and exact-main CI are **PENDING** until observed. No local checkout/tests: runtime has no DNS to github.com, so use GitHub CI evidence.
- This pass does not prove a strict small resident cache cap, global tiled raster, operation-exclusive RAM peak or Photoshop-authored PSB32. The original source must not be mutated and unsupported depth conversion must fail closed.
- **NEXT 003X/2 P1:** once first candidate CI is green, verify authentic high-depth browser artifacts against this precise branch, inspect tile-retention limits and implement an explicit bounded lazy tile residency/eviction or an equivalent demonstrated production improvement; keep same task until complete 003X acceptance. The independent Photoshop-authored PSB32 `002B/2c` remains P0 BLOCKED.


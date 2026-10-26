# 003X/5 — bound canonical native tile encoding transient ownership

**ID:** 003X/5. **Priority:** P1. **Status:** TODO. **Parent:** 003X / Stage 6 IN PROGRESS.
**Dependencies:** 003X/1, /2, /3, /4 bounded DONE; preserving native v2 source, exact RGB16/CMYKA32 Float32 and cancellation.
**Independent blocker:** Photoshop-authored PSB32 provenance 002B/2c P0 BLOCKED.

## Target problem
`src/core/pixel-buffer.js`: `canonicalTileBytes` allocates a private canonical Uint8Array; `bytesToDataUrl` and its underlying conversion may retain intermediate byte/binary and Base64 strings simultaneously with encoded tile overlays and resident typed arrays. `makeRoom`, `publishStaged` and `serializeSteps` are consumers. Existing `maxEncodedDirtyBytes` constrains retained URL reservations, not temporary encoder output; `maxVisitBytes` constrains only owned staged typed tile copies. Avoid invented browser/OS peak claims.

## Concrete acceptance
1. Trace the canonical tile encoder and each caller, document exact synchronous lifetime, private bytes and possible amplification. Demonstrate one real over-allocation or atomic failure hazard, distinguish transient raw bytes, JS strings, retained URL and persistent source.
2. Implement a minimal robust production change (e.g. chunking/streaming bounded Base64 conversion, preflight byte limits, fewer simultaneous copies) preserving canonical LE sample bytes, Float32 bit patterns, alpha, tile edge and v1/v2 `.zpe` compatibility. No 8-bit conversions or artificial no-op stubs.
3. Preserve multi-tile atomicity on failure in `makeRoom` / `publishStaged` / serialization; old committed dirty tiles/preview/Undo stay identical after injected encoder/allocation refusal and cancellation/stale race.
4. Deterministic tests instrument actual canonical bytes and conversion path on large RGB16 and CMYKA32 Float32, sparse/dense, alpha, high-depth .zpe/Undo/Redo; include configured ceiling and induced failure after earlier staged tile.
5. Regenerate offline bundle and Worker; execute Linux `npm run check`, actual Chromium `file://` synthetic PSD16/PSB32 native Worker + Undo/Redo/.zpe, PR final-head core 12/12 and separate real-photo CI; merge only green and record exact-main CI.
6. Update `task/003x-native-tile-ownership.md`, this file, `task/NEXT.md`, `task/README.md` and set next actionable task. Do not claim global memory peak, proven Worker PID, complete tiled architecture or independent Photoshop-authored PSB32 provenance.

## Baseline
**003X/4 bounded DONE (2026-10-26):** [PR #344](https://github.com/zeter1/ZeTer-Photo-Editor/pull/344) merged to [main 92cd61e9f](https://github.com/zeter1/ZeTer-Photo-Editor/commit/92cd61e9fe4f39b10ddb1f70e75168cbf0dfa400), final PR-head [Linux core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40349386666) SUCCESS 12/12 and [real-photo PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40349387436) SUCCESS; exact merged-code [main core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40350178186) SUCCESS 12/12 and [main real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/40350178197) SUCCESS. Six new native ROI tests (RGB16, CMYKA32 Float32 and alpha, exact Undo/.zpe, configured read/write budget, refusal before second private tile clone, cooperative cancellation/retry), Windows native Chrome `file://` smoke SUCCESS; local Windows all-platform 1523 PASS / 10 SKIP / 5 Linux-only cgroup tests FAIL. Native ROI allocation/preflight and `maxVisitBytes` accumulated private write staging bounded, but encoding temporary bytes/strings, History, Worker and OS peak NOT globally bounded. Parent 003X/Stage 6 IN PROGRESS, independent Adobe-authored PSB32 002B/2c BLOCKED. NEXT **003X/5 P1 TODO:** [bound canonical native tile encoding transients](003x5-native-encoding-transients.md) with exact high-depth native/failure/browser checks.

**Status:** TODO, no implementation yet. Parent 003X and Stage 6 remain IN PROGRESS.

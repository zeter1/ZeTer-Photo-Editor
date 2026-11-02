# 003X/6c — bounded retained Base64 / Data URL transient ownership

**ID:** 003X/6c. **Priority:** P1. **Status:** TODO; 003X/6b exact-main acceptance DONE. **Parent:** 003X/6, Stage 6 IN PROGRESS.

**Dependencies:** 003X/6a production DONE; 003X/6b PR [#351](https://github.com/zeter1/ZeTer-Photo-Editor/pull/351) merged as [7e9f8b65](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7e9f8b65530e44a025d53a9bcb2d89fe12cda36b), exact-main core #41387921346 SUCCESS 12/12 and separate real-photo #41387921307 SUCCESS for merged SHA. 002B/2c independent Photoshop-authored PSB32 provenance remains BLOCKED.

## Problem / goal

`bytesToDataUrl` in `src/core/io.js` temporarily retains an array of Base64 chunks, a joined Base64 string and a `data:` URL string; the memory lifetime of the joined copy and the persisted string are not yet measured or globally bounded. Native tiled source serialization, dirty LRU multi-victim encoding and .zpe/History/Worker consumers may retain simultaneous copies even though source raw bytes and encoded dirty tile reservations have independent limits. Target a specific demonstrated owner, **not** a speculative whole-process RAM ceiling.

## Acceptance criteria

1. Trace all real source-to-consumer paths for `bytesToDataUrl`, `dataUrlToBytes`, `canonicalTileBytes`, `serializePixelBufferSource`, `serializeTiledPixelBufferSource`, `createSerializedPixelBufferTileWorkingSet` and .zpe save/restore. Differentiate retained JS strings, one-shot raw bytes, typed cache, unchanged serialized sources, History snapshots and Worker data.
2. Reproduce at least one concrete, measurable retained transient amplification or failure involving both RGB16 and CMYKA32 Float32 native data; use independent raw-byte or bit-pattern oracles including sNaN, -0 and alpha. Include sparse, edge and dense tiles; explicitly bound any inference from synthetic fixtures.
3. Make a minimal **production** fix or explicit configurable preflight for the proven owner; preserve dense-document defaults, file://, PSD/PSB and .zpe v1/v2 formats. Fail closed without allocating the identified excess when an explicit limit is exceeded. Avoid adding dependencies or claiming an impossible streaming API.
4. Prove all-or-nothing on second/later dirty tile encoder failure, byte-budget refusal, stale cooperative writer and cancellation; original dirty tiles, resident LRU order, revision, Undo/Redo and saved/reopened native bytes must remain correct.
5. Regenerate deterministic `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json`. Run targeted Node tests, Linux `npm run check`, genuine Chromium `file://` PSD16/PSB32 import-edit-Undo/Redo-.zpe and independent real-photo workflow. Distinguish local, PR-head and **exact merged-main** CI.
6. Update `task/NEXT.md`, `task/README.md`, this task and parent `task/003x-native-tile-ownership.md`; create production PR, merge only with green CI and no blocking review, verify exact-main. If causal owner cannot be measured, record bounded inconclusive evidence and continue narrower instead of claiming memory is fixed.

## Known nonclaims

No global transient/data-URL memory bound, OS RSS/Worker PID peak, History ownership ceiling or genuine Photoshop-authored PSB32 provenance is established by PR #351. The full Data URL string is necessarily materialized by the existing serialization interface; do not present reduced intermediate copies as zero-memory encoding.

## Next action

After exact-main CI for `7e9f8b65` is verified: measure the simultaneous Base64 chunk-array, `join` and final URL lifetime for one actual native tiled/legacy serialization path, then implement the smallest safe improvement and independent failure tests.

**003X/6b prerequisite verified:** final-head core #41386830817 and real-photo #41386830807 SUCCESS, exact merged-main core #41387921346 and real-photo #41387921307 SUCCESS. Start 003X/6c directly; do not repeat 003X/6b.

## 2026-11-02 — production candidate: explicit URL-string character preflight

**Status: IN PROGRESS.** Branch: [feat/003x6c-url-budget-20261102](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/003x6c-url-budget-20261102). PR/CI/merge/exact-main gates **PENDING** at this checkpoint; not accepted as DONE.

- **Concrete reproduction and owned measurement:** For any tile of `n` canonical raw bytes, a persisted URL retains `data:<mime>;base64,` prefix plus exactly `4*ceil(n/3)` ASCII characters. Every v2 tile has its *own* prefix and padding. On RGB16/CMYKA32 Float32 (including sparse/partial edge and dense tiles), observed `source.tiles.map(t => t.dataUrl.length)` is the exact aggregate output-string character count, strictly above native raw byte count; the test checks a separate lengths oracle. These are **character counts**, not engine-dependent simultaneous heap copies or process RSS.
- **Production fix:** `src/core/io.js` adds `encodedDataUrlChars` and optional `bytesToDataUrl(..., {maxDataUrlChars})`; below-limit rejection occurs before any Base64 chunks or `btoa` call. `src/core/pixel-buffer.js` accepts optional `maxDataUrlChars` for v1, v2 and adaptive serializer, and preflights **all v2 tiles**, including prefixes and padding, before allocating the first canonical raw tile byte array. Invalid limits and overflow fail closed with RangeError, without mutating original native data. Defaults are unchanged for large dense documents. Existing `.zpe` v1/v2 schema and PSD/PSB codec unchanged.
- **Native correctness tests:** `tests/003x6c-retained-url-budget.test.mjs` includes RGB16/CMYKA32 Float32 alpha, sNaN payload, signed zero and right/bottom edge raw-byte oracles; exact-bound acceptance and one-character-under-budget refusal before any encoder; v1/adaptive/v2 native JSON save/reopen byte parity and preserved dirty working-set/Undo source. Existing `tests/io-bounded-base64.test.mjs` second-victim dirty LRU failure, cooperative stale/abort and History regressions must also pass under Linux CI.
- **Build:** all four generated browser/Worker/index/version files synchronized. The old generated bundle hash was independently reconstructed and matched `1aebbbb625c20b5b`; updated deterministic hash is `ff48d19c3649dca9`.
- **Known nonclaims:** No measured V8/Chromium string-memory peak, retained History/Worker copies, global Base64 transient RSS ceiling or Adobe-authored PSB32 provenance. Explicit `maxDataUrlChars` bounds *output URL characters only* when supplied; default remains uncapped for backward compatibility. `join` and template/string materialization still exist. A later stage must measure simultaneous heap lifetime/owners if a global transient claim is desired.

**NEXT:** obtain successful final PR-head core CI (Linux tests, deterministic build, true Chromium `file://` PSD16/PSB32) and independent real-photo CI; only then merge, verify exact merged-main core and real-photo and mark this bounded change DONE. Keep Stage 6/003X open and 002B/2c blocked.

# 003X/6c — bounded retained Base64 / Data URL transient ownership

**ID:** 003X/6c. **Priority:** P1. **Status:** TODO after 003X/6b exact-main acceptance. **Parent:** 003X/6, Stage 6 IN PROGRESS.

**Dependencies:** 003X/6a production DONE; 003X/6b PR [#351](https://github.com/zeter1/ZeTer-Photo-Editor/pull/351) merged as [7e9f8b65](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7e9f8b65530e44a025d53a9bcb2d89fe12cda36b), exact-main CI still awaiting readback at this checkpoint. 002B/2c independent Photoshop-authored PSB32 provenance remains BLOCKED.

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

# 003X/6c-4 — native decoded typed-buffer ownership (Stage 6)

**Date:** 2026-11-03. **Priority:** P1. **Status:** BOUNDED DONE (final PR-head and exact merged-main CI accepted). **Dependencies:** 003X/6c-1/2/3 DONE (previous production PR #357). **Parent:** 003X/6c and Stage 6 remain IN PROGRESS. Independent Photoshop-authored PSB32 proof 002B/2c BLOCKED.

## Problem and measured baseline

Actual production `dataUrlToBytes` in `src/core/io.js` returns a private newly allocated `Uint8Array(rawBytes)` for native .zpe v1/v2. `decodeCanonicalSamples` in `src/core/pixel-buffer.js` formerly allocated a second equally sized `Uint16Array(samples)` / `Float32Array(samples)` and copied all byte values into the second array even on aligned little-endian hosts. A constructor-intercepting regression against the baseline failed as expected for BOTH v1 and v2: one duplicate full typed-sample plane for legacy v1 and six duplicate full tile planes on the 131x99 / tileSize 65 v2 fixture. On these independent native fixture sizes, the avoided sample-plane allocation is 103752 bytes for RGB16 v1 or 259380 bytes for CMYKA32 Float32 v1, plus one corresponding tile-byte plane per visited v2 tile. This is constructor-backed allocation accounting, not a measured process RSS, GC lifetime or global JS heap peak.

## Production scope

On aligned little-endian hosts, `decodeCanonicalSamples` now returns `new Uint16Array(bytes.buffer, bytes.byteOffset, samples)` or `new Float32Array(...)` without allocating/copying an extra sample plane. Each `dataUrlToBytes` invocation still owns independent decoded bytes: no alias of the original project URL, other decoded pixels, or other tile. The canonical raw Float32 bit patterns are viewed directly (not converted via JS Number), including signaling NaN, -0 and alpha. Existing allocation/copy/byte-swap fallback for unaligned or big-endian is unchanged; RGBA8 untouched. No new dependency, network requirement, .zpe schema, PSD/PSB format or default budget change. History, Worker and output source strings remain distinct owners and are NOT globally capped.

## Changed files

- `src/core/pixel-buffer.js`: private decoded native byte plane reused by an aligned typed view.
- `tests/003x6c4-decoded-buffer-ownership.test.mjs`: independent constructor/allocation red-before/green-after, raw backing bit oracle, v1/v2 sparse/edge/dense, source and editable isolation, late atob failure, cooperative cancellation/retry.
- Generated offline browser/Worker `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json`, deterministic build manifest `57156beeb6c99262`.
- `CHANGELOG.md`, `task/README.md`, `task/NEXT.md`, `task/003x-native-tile-ownership.md`, `task/003x6c-native-url-string-ownership.md`, and this record.

## Checks / known failures

- New tests before patch: 1 PASS / 2 FAIL, explicitly catching second v1 and per-tile v2 high-depth allocations.
- After patch: focused 11/11 PASS (new 3 and previous Base64/budget 8); raw RGB16 and CMYKA32 Float32 sNaN, negative-zero, alpha, v1/v2 JSON save/reopen, v2 tile boundaries, cancellation, late decode failure and unmodified source.
- Windows `npm run check`: 1548 PASS / 10 SKIP / 5 FAIL, existing Linux-only `/proc` and cgroup fixture expectations do not apply on Windows; 1563 total. This does **not** count as a passing cross-platform full suite. Generated build `57156beeb6c99262`.
- Real Windows Chromium `npm run test:browser`: exit 0, genuine `file://`; native PSD16/PSB32 import, Worker cancellation/stale job, Undo/Redo, project save/reopen, large native fixtures. Synthetic ZeTer PSD/PSB fixtures are not independent Adobe Photoshop provenance.
- **Final PR-head `54dc1b0994a27cca0cef875063692d52beb4ebab`:** [PR #359](https://github.com/zeter1/ZeTer-Photo-Editor/pull/359), Linux [core #41598105567](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41598105567) **SUCCESS 12/12**, separate [real-photo #41598105550](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41598105550) **SUCCESS**; no blocking reviews/threads, mergeable true. Squash-MERGED as [main `2bea78bc8e1e0d0d10e276ff4287b1fa7ddcb3dc`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/2bea78bc8e1e0d0d10e276ff4287b1fa7ddcb3dc).
- **Exact merged-main `2bea78bc`:** separate Linux [core #41598920812](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41598920812) **SUCCESS 12/12**, independent [real-photo #41598920785](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41598920785) **SUCCESS** on the exact merged SHA. Distinct from local Windows and PR-head checks.

## Acceptance / future task

003X/6c-4 is **BOUNDED DONE**, accepted on exact merged-main via independent core and real-photo CI. The removed duplicate backing arrays are a concrete bounded production improvement; global resident History snapshots, Worker owner cardinality, JS heap/OS RSS and true peaks remain unmeasured. **NEXT 003X/6c-5 P1 TODO** — trace actual simultaneous retained History and Worker pixel-plane owners and reproduce one measurable surplus/budget failure with exact RGB16/CMYKA32 Float32 source, cancel/stale/Undo/Redo/.zpe and native browser tests; implement one atomic ownership/budget fix if proven, with same independent CI gates. Keep 003X and Stage 6 IN PROGRESS and 002B/2c BLOCKED.

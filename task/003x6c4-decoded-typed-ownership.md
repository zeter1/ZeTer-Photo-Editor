# 003X/6c-4 — native decoded typed-buffer ownership (Stage 6)

**Date:** 2026-11-03. **Priority:** P1. **Status:** IN PROGRESS until final PR-head core+real-photo CI, merge and exact-main verification. **Dependencies:** 003X/6c-1/2/3 DONE (last production PR #357, main b733293 handoff). **Parent:** 003X/6c and Stage 6 IN PROGRESS. Independent Photoshop-authored PSB32 proof 002B/2c BLOCKED.

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
- PR-head Linux core and independent real-photo CI: **PENDING**; merge and exact-main CI: **PENDING**. Do not mark this bounded pass DONE before these gates.

## Acceptance / future task

Accept 003X/6c-4 only after CI + merge + exact-main checks. The removed duplicate backing arrays are a concrete bounded production improvement; global resident History snapshots, Worker owner cardinality, JS heap/OS RSS and true peaks remain unmeasured. **Next after acceptance: 003X/6c-5 P1 TODO** — trace actual simultaneous retained History and Worker pixel-plane owners and reproduce one measurable surplus/budget failure with exact RGB16/CMYKA32 Float32 source, cancel/stale/Undo/Redo/.zpe and native browser tests; implement one atomic ownership/budget fix if proven, with same independent CI gates. Keep 003X and Stage 6 IN PROGRESS and 002B/2c BLOCKED.

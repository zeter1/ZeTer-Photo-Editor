# 003X/6c-7 — immutable native History snapshot ownership

**Priority:** P1. **Status:** TODO, after 003X/6c-6 bounded acceptance. **Dependencies:** 003X/6c-6 PR #363 exact-main CI, Stage 6/parent 003X remain IN PROGRESS. **Independent blocker:** 002B/2c genuinely Adobe Photoshop-authored PSB32 provenance remains BLOCKED.

## Observed production path
`src/core/state.js:snapshotDocument` serializes the entire current document as a JSON string. `src/main.js:commit` pushes this string into `src/core/history.js:HistoryStack`, which keeps immutable strings subject to item/estimated byte limits. Every complete snapshot therefore contains native source Data URL strings even when a small native tile changed; unchanged native strings are serialized again into each snapshot. The prior 003X/6c-6 measured a single 131×99/tile32 independent pre-edit History JSON source of **140,957 characters** (RGB16) or **348,490 characters** (CMYKA32 Float32), besides UI source URLs of **139,352** or **346,856** characters. These are retained character counts, NOT heap/RSS or whole-process peak.

## Objective
Determine *actual simultaneous* retained source/History string owners over multiple edits, with exact before/after deltas, then eliminate one proven redundant allocation or add one safe opt-in budget without dropping Undo points unexpectedly or changing default dense import behavior. Do not assume V8 substring/string interning or structured clone memory usage.

## Acceptance
1. Capture production-path History reset/push/undo/redo with RGB16 and CMYKA32 Float32, native sNaN alpha payload, -0, edge/sparse/dense tiles; report separate original UI URLs, every retained snapshot string, and any temporary serialization owners.
2. Prove an independently reproducible red-before/green-after failure or measurable excess. Implement the smallest atomic change with exact bounds and explicit opt-in where appropriate; no format changes unless independently documented.
3. Preserve stable export/import `.zpe` v1/v2, PSD16/PSB32 native source bytes, History branches/jump/limit/eviction, failed later snapshot, stale owner, cancellation, mutation isolation and recovery.
4. Rebuild deterministic offline `file://` assets only if runtime sources change; run focused Node tests, genuine Chrome/Chromium `file://` smoke, Linux core CI (12 jobs) and independent real-photo PR checks. Merge only green; verify exact merged-main independently.
5. Record measurements and remaining known unknowns in this task, `task/NEXT.md`, `task/README.md`, parent ownership history and `CHANGELOG.md`.

## Limitations
The 003X/6c-6 opt-in Worker input URL-character bound and 003X/6c-5 changed-tile-only Worker response are independent of History retention. Do not assert a global JS heap/RSS, per-Worker PID peak, memory cap, or Adobe-authoring provenance. Parent 003X/Stage 6 remain IN PROGRESS.

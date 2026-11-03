# 003X/6c-6 — quantify Worker input clone and History source ownership

**Priority:** P1. **Status:** TODO. **Dependencies:** 003X/6c-5 DONE ([PR #361](https://github.com/zeter1/ZeTer-Photo-Editor/pull/361)); Stage 6 / parent 003X IN PROGRESS. **Independent blocker:** 002B/2c genuine Photoshop-authored PSB32 fixture BLOCKED.

## Goal
Measure live retained native Data URL owners before Worker dispatch and immutable History snapshots independently. Select one actual duplicated source or avoidable temporary ownership, implement a minimal bounded atomic fix, and preserve high-depth bit-exactness, cancellation, stale/owner switch and .zpe compatibility. Do not extrapolate JSON character counts to V8 heap, OS RSS or Worker PID.

## Acceptance criteria
1. Reproduce one measured production-path input-side / History duplication with labeled owners and a before/after comparison using actual RGB16 and CMYKA32 Float32 tiled data (include sNaN payload, negative zero and alpha).
2. Implement a specific safe ownership or opt-in budget improvement. Validate failure-before-mutation, late error, cancellation, stale-session takeover, Undo/Redo, .zpe v1/v2 and unchanged file:// startup.
3. Run focused independent tests; run canonical generated-artifact build if runtime sources change, local Node checks and real Chrome/Chromium file:// smoke; distinguish Windows Linux-only fixture failures.
4. Create reviewable PR and verify the final PR-head Linux core workflow and independent real-photo workflow; merge only successful compatible changes; confirm exact merged-main core and real-photo workflows.
5. Record file paths, measurements, tests, CI links, PR/commit/merge state, unresolved ownership, and subsequent task in this file, task/NEXT.md and task/README.md.

## Known baseline (from 6c-5)
Changed-tile-only Worker replies avoid cloning unchanged native URLs back to UI, but the Worker input still receives a full source and History snapshots can retain a complete serialized project. 131×99/tile32 one-tile JSON reply: RGB16 141014 → 11072 characters; CMYKA32 Float32 348547 → 27456. This is a message size proxy, not process memory evidence.

## Current work
**TODO — no 6c-6 production change or new local test claimed by this handoff.** Start by examining src/painting/tiled-inpaint-dispatch.js, src/core/tiled-inpaint-worker-client.js, src/core/history.js and existing native retention tests; use actual bounded buffers and complete cancellation contracts.

## Next
003X/6c-6 P1 IN PROGRESS when evidence and implementation work begin. Preserve parent Stage 6 IN PROGRESS and independent 002B/2c BLOCKED.

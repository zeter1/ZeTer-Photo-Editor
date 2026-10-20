# 003V — bounded mid-chunk cancellation for UI tiled selection scan

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003 tiled Content-Aware](003-tiled-content-aware.md), Stage 6.
**Dependencies:** accepted [003U](003u-bounded-ui-selection-freeze.md) typed index storage; existing Worker/native ownership and cancellation contracts.

## Problem and acceptance

The UI selection freeze calls `isCancelled()` at chunk boundaries, but a large permitted `scanChunkPixels` (up to 262,144) can perform hundreds of thousands of synchronous `isAllowed` calls before observing cancellation triggered *inside* a callback/session owner. No Worker or history mutation must be published after an observed cancellation.

- Check cancellation every 64 pixels during each synchronous chunk; keep the existing pre-chunk, post-yield and pre-dispatch guards.
- Preserve typed bounded ascending selection indices, full/empty no-op, Worker-only-unavailable frozen fallback, native-byte source integrity and fail-closed malformed Worker result.
- Test reentrant cancellation during a maximal-sized chunk: at most 64 predicate evaluations after the chunk starts, zero yield, zero Worker dispatch and unchanged CMYKA Float32 source bytes.
- Run `npm run check` and real Chromium `file://` PSD16/PSB32 Worker/cancel/retry/Undo/Redo CI. Do not mark DONE until PR-head CI, merge and exact-code-main CI evidence is recorded.

## Implementation checkpoint — 2026-10-20

- **Branch:** [fix/003v-ui-selection-scan-cancel-20261020](https://github.com/zeter1/ZeTer-Photo-Editor/tree/fix/003v-ui-selection-scan-cancel-20261020).
- **Code:** `src/painting/tiled-inpaint-dispatch.js` bounds the synchronous selection scan to at most 64 predicates between cancellation checks even with maximum `scanChunkPixels`; existing cooperative yields remain unchanged.
- **Regression:** `tests/tiled-inpaint-ui-selection-freeze.test.mjs` adds a real native CMYKA Float32 cancellation/zero-dispatch/unchanged-source assertion.
- **Generated artifacts:** `src/app.bundle.js`, `index.html`, `version.json` synchronized to the exact source via the standard FNV build ID.
- **Local testing:** UNAVAILABLE — repository checkout blocked by container GitHub DNS; PR CI and browser checks required. **PR CI, merge, exact-main:** PENDING.
- **Remaining:** obtain/test actual PR CI, fix failures, merge if clean, verify exact-main and update this card and the pointers to the next bounded production Stage 003 task. Whole 003 and 003T open; 002B/2c blocked by external Photoshop-authored PSB32 provenance.

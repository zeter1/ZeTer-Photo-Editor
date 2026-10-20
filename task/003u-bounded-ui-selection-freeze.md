# 003U — bounded UI-side selection index freezing for tiled native inpaint

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003 tiled Content-Aware](003-tiled-content-aware.md), Stage 6.
**Dependencies:** accepted [003T/2g](003t2g-transient-proc-gap-recovery.md) diagnostics, current Worker/native source budget/owner/cancel contracts.

## Confirmed source bottleneck (2026-10-20)

`src/painting/tiled-inpaint-dispatch.js` currently freezes every permitted selection index into an unbounded JavaScript number `indices = []` (up to `maxFillPixels`, default 2,000,000), then copies it again via `Uint32Array.from(indices)` for Worker delivery. The two representations coexist at the end of the scan, increasing the UI-side temporary memory footprint even though the Worker input already uses a typed array. The source has existing cooperative scan cancellation, no-op handling for empty/full selections, immutable selection freeze, constrained source budget and Worker-unavailable fallback; preserve these behaviors.

## Next pass: implementation

1. Replace the intermediate number-array and final full copy with **bounded, checked typed storage** (e.g. geometrically grown Uint32Array capped by `maxFillPixels`) and an exact-sized frozen Worker input. Avoid allocating `maxFillPixels` up front for a tiny sparse selection.
2. Preserve exact ascending index order, full-selection no-op even when it exceeds the fill cap, empty no-op, over-budget refusal before predicate work, cancellation before/after each cooperative yield, immutable snapshot for Worker and fallback, and fail-closed malformed Worker replies. Never silently fall back on compute/protocol failure.
3. Bound the transient allocation count/bytes; reject unsafe `maxFillPixels`/geometry where necessary without regressing the current validated public contract. No dependence on a server: genuine `file://` Worker path remains supported.
4. Add focused tests for sparse, near-budget dense, full, over-limit, cancellation/yield, mutation of live selection after freeze, Worker-unavailable path, and unchanged native 16/32-bit RGB/CMYK pixels. Test that no transient JS `Array` of all selected pixel indices is built.
5. Execute `npm run check`, real Chromium `file://` PSD16 and PSB32 Worker + cancel/retry/Undo/Redo/native-byte checks; green PR CI, merge and exact-code-main CI. Update `task/README.md`, `task/NEXT.md` and this task with actual evidence.

## Limits

This is a memory-allocation improvement, **not** proof of a global virtual tiled engine, lossless Photoshop PSB32 compatibility, an isolated operation peak, or Worker→PID attribution. Whole Stage 003 remains open. P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) is blocked on genuine independently verified Photoshop-authored PSB32 provenance.

## 2026-10-20 implementation checkpoint — IN PROGRESS

- Branch: [perf/003u-bounded-ui-selection-freeze-20261020](https://github.com/zeter1/ZeTer-Photo-Editor/tree/perf/003u-bounded-ui-selection-freeze-20261020).
- Code: `src/painting/tiled-inpaint-dispatch.js` rejects unsafe Worker-side selection cap and geometry before scanning, uses a `Uint32Array` with capped geometric growth and exact-length frozen `Uint32Array` at handoff. Keeps full/empty no-op, indexed order, over-cap refusal, source/native-byte contract, cancellation, Worker-unavailable fallback, and fail-closed protocol errors.
- Test: `tests/tiled-inpaint-ui-selection-freeze.test.mjs`: sparse high-depth RGB16, near-budget CMYKA32, no-op full/empty, unsafe cap and partial over-limit, cooperative cancellation, mutable live selection during unavailable Worker fallback, static no-JS-index-array guard.
- **Node locally unavailable:** no full repo checkout under container GitHub DNS restrictions. **PR-head CI, real Chromium `file://` PSD16/PSB32 native-byte/Undo/Redo, merge, and exact-main acceptance PENDING.** Do not mark DONE until verified.
- Next: accept/fix real CI, merge only after green and no conflicts, verify exact-main; then queue another bounded Stage 003 issue while retaining unresolved 003T memory attribution and blocked 002B/2c Photoshop PSB32 provenance.

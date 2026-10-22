# 003W/2b-2f — Real dense Worker original document replacement

**Priority:** P1. **Status:** TODO (2026-10-22).
**Parent:** [003W Chromium selection-freeze responsiveness](003w-browser-selection-freeze-responsiveness.md), Stage 6.
**Dependencies:** [003W/2b-2e owner close](003w2b2e-dense-owner-close.md) DONE, [003W/2b-2d switch](003w2b2d-dense-owner-switch.md) DONE, [003W/2b-2c Escape cancel](003w2b2c-dense-worker-cancellation.md) DONE.

## Objective

Cover a distinct user-authorized **replace the content of the active document** path while a native tiled dense production Blob Worker is in flight. Closing a tab or activating another tab is already tested; replacement via File → New and, where practical, approved PSD/PSB import owns a different document generation, history, and stale-result path. Rejecting dirty-document replacement must not revoke the active owner's Worker.

## Acceptance criteria

1. Fresh independent Chromium `file://` PSD16 and PSB32 input 1450×1400, ZeTer-generated native high-depth tiled payloads with exact old native bytes/alpha, rendered pixel and History oracles; no mock Worker or forced completion.
2. Real marquee/Edit menu dispatch with 1.9M–2M frozen `Uint32Array` indices to real Worker. During 0-reply in-flight window, exercise UI dirty-replacement confirmation **denied**; original document/worker/lease remain intact. Then exercise **accepted** replacement and prove old Worker terminated before reply, original document disposed/replaced with genuinely different document identity and dimensions, and no leaked writes/History.
3. After bounded settle verify replacement document pixel/native/preview/History exact; no old result, including after a fresh selected-only Worker edit and exact Undo/Redo where that route remains supported. Do not silently treat a newly allocated blank Canvas8 document as a high-depth native retry: explicitly import another valid native PSD/PSB when needed.
4. Capture independent per-format strict JSON receipts, true worker dispatch/terminate counters, bounded 8ms timer intervals and sampled heap; reject missing/forged evidence and leave operation-exclusive CPU/RSS peak and Worker→PID as **unknown**.
5. `npm run check`, artifact parity, genuine PSD16/PSB32 Chromium `file://` CI, real-photo PR CI, exact PR-head green; PR merge and exact merged-code-main CI and main real-photo green. Add tests for fail-closed dirty denial and real accepted replacement, not mere tab switching.

## Notes and current limits

Start from `tools/browser-near-cap-ui-smoke.mjs`, `src/document/new-document-controller.js`, `src/document/psd-import-controller.js`, and `src/workspace/session-controller.js`; reuse strict evidence patterns without duplicating DONE 003W/2b-2e. Preserve safety cap 2,000,000 and Worker timeout 180s. Keep `file://` and .zpe Undo/Redo. Parent 003W/003T/Stage 003 OPEN; independently Photoshop-authored PSB32 P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED by provenance.

## Current checkpoint

- **TODO / unimplemented:** No verified replacement-specific native Chromium acceptance yet.
- **Next action:** implement separate actual UI File→New denial/acceptance and subsequent high-depth native import/retry, strict per-format verification and CI. If production replacement fails to revoke stale Worker, add bounded correction and tests before acceptance.

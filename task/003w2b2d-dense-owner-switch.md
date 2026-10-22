# 003W/2b-2d — Real dense Worker cross-document ownership

**Priority:** P1. **Status:** TODO (2026-10-22).
**Parent:** [003W browser responsiveness](003w-browser-selection-freeze-responsiveness.md) / Stage 6.
**Dependencies:** [003W/2b-2c](003w2b2c-dense-worker-cancellation.md) DONE and genuine dense success [003W/2b-2b](003w2b2b-dense-worker-success.md) DONE. Prior smaller owner/session regressions 014–017 are already merged; do not repeat them.

## Objective

Prove that a genuine 1.9M–2M selected-index production Chromium Blob Worker cannot publish stale native pixels or History into either document when its tab/session owner changes while the Worker is still processing. This is NOT the same-document selection replacement and real Escape already proven by 003W/2b-2c.

## Criteria for DONE

1. Import a true ZeTer-generated native PSD16/PSB32 1450x1400 image in independent fresh Chromium file:// processes and a distinct second document/tab. Save exact native tile-byte baselines, previews and History for BOTH documents.
2. Use the real overlay marquee/UI Edit menu to send 1.9M–2M actual frozen Uint32 selected indices to the production Blob Worker. Prove dispatch and zero completed replies before owner switch; do not use a Worker mock or bounding box alone.
3. Switch active tab/document after dispatch and before reply; where possible separately close/replace the original owner. Confirm cancellation/termination and reject stale results after a bounded settling interval. Check native bytes, alpha, preview, Undo availability and History for BOTH documents.
4. Retry in the surviving active document using a genuinely new Worker. Require single authorized successor, selected-only native color changes, unchanged alpha/outside pixels, exact Undo/Redo and no late older reply.
5. Add strict independent PSD16 and PSB32 artifact evidence, negative validator cases, bounded 8ms renderer heartbeat/observational heap with unknown gaps. Do not invent isolated operation memory/CPU peaks or OS Worker PID mapping; keep 2M safety and 180s timeout.
6. Run npm run check, generated parity, two real Chromium CI cases, existing real-photo regression, PR-head CI and exact merged-code main CI. Mark DONE only after all actual results are known.

## Initial implementation guide

Reuse tools/browser-near-cap-ui-smoke.mjs, existing real 014–017 tab-owner tests and the 003W/2b-2c cancellation receipt, without duplicating their 576-pixel scenarios. Begin by identifying how to make a second independently editable high-depth tab and capturing both native source baselines. Keep whole 003W/003T/Stage 003 OPEN; independently Photoshop-authored PSB32 provenance 002B/2c remains BLOCKED.

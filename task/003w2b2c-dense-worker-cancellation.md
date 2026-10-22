# 003W/2b-2c — Genuine dense in-flight Worker cancellation and native retry

**Priority:** P1. **Status:** TODO (2026-10-22).
**Parent:** [003W real browser responsiveness](003w-browser-selection-freeze-responsiveness.md) / Stage 6.
**Dependencies:** [003W/2b-2b](003w2b2b-dense-worker-success.md) DONE, [003W/2b-2a](003w2b2a-browser-near-cap-ui.md) DONE.

## Goal

Prove bounded, safe *in-flight* cancellation while a genuine production Chromium `file://` Blob Worker is processing a **dense near-2,000,000 frozen selected-pixel** PSD16/PSB32 native operation, not merely cancel before dispatch or on a 576-pixel selection. Preserve existing native alpha/bytes, project History and cancellation ownership.

## Acceptance criteria

1. Import fresh ZeTer-generated 1450×1400 PSD16 and PSB32 native tiled documents in separate Chromium `file://` sessions. Select 1.9M–2M actual indices through the normal UI; assert production Worker `postMessage` receives the exact Uint32 count and byte length, not a test double or just a bounding box.
2. After **actual Worker dispatch** and before its successful reply, send a real user Escape/owner cancellation. Prove cancellation reached the UI owner, Worker was terminated or invalidated and no cancelled/late result can commit even if a newer document/selection supersedes it.
3. After a bounded settling interval, compare exact saved original native source tile bytes, selected and unselected alpha, preview samples, project History and Undo availability against the pre-cancel snapshot; require no partial publication or stale result.
4. Run a fresh genuine subsequent Worker Fill after cancellation, not a synthetic reply. Assert single new job ownership, successful selected-only color changes, unchanged alpha/outside bytes, exact Undo/Redo, and no leaked earlier result.
5. Persist independent strict PSD16 and PSB32 per-format evidence with actual dispatch/cancel/retry timings, capped sampled renderer 8ms event-loop intervals, explicit sample gaps and optional heap boundary observations. Reject fabricated operation-exclusive RSS/CPU peaks or Worker→OS PID claims. Maintain unchanged 2M index safety and 180s production timeout.
6. Add negative validator/unit tests, run `npm run check`, generated bundle parity and independent actual Chromium CI per format, then PR-head CI, merge and exact merged-code main CI. Do not mark DONE until all evidence verified.

## Constraints and known gaps

- Existing 003W/2b-2b PSD16/PSB32 dense success ~4.26s/~3.69s **includes UI overhead**. Earlier pre-dispatch owner cancellation 003W/2a and smaller 576-pixel cancellation do NOT satisfy this new acceptance.
- Real-photo/Photoshop-origin parity, continuous event-loop responsiveness, isolated per-Worker PID, operation peak CPU/RAM and independently Photoshop-authored PSB32 remain unknown or blocked. Prefer bounded safe validation and measured bottleneck remediation, not safety-limit increases.
- Avoid duplicate existing 003T cancellation suites; focus specifically on 1.9M–2M real Chromium UI Worker in-flight/owner changes.

## Files likely involved

`tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-smoke.mjs`, `tools/browser-dense-near-cap-evidence.mjs`, strict verifier and negative tests, `.github/workflows/ci.yml`, `task/NEXT.md` and `task/README.md`.

**Next action:** implement a separate fresh-profile dense in-flight cancellation and retry test mode with explicit Worker-dispatch census and strict native/History snapshots; keep parent 003W/003T/Stage 003 open.

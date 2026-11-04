# 003W/2b-2f — Real dense Worker original document replacement

**Priority:** P1. **Status:** DONE (2026-10-22; merged PR #313 and exact-main CI/real-photo verified).
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

## Проходка 2026-10-22 — production fix + independent native Chromium tests (IN PROGRESS)

- Branch: [fix/003w2b2f-new-document-worker-replacement-20261022](https://github.com/zeter1/ZeTer-Photo-Editor/tree/fix/003w2b2f-new-document-worker-replacement-20261022).
- Production root cause: File → New and modal submit used the generic `blockPendingDocumentEdit` guard, which rejects ALL in-flight paint leases, including explicitly cancellable content-aware Fill. Consequently, user-authorized replacement could not run while a native Worker was active.
- Fix: `src/painting/command-controller.js` exposes whether the in-flight Fill is cancellable; `src/main.js` supplies guarded callable bridges (never while another pointer/drag is held); `src/document/new-document-controller.js` permits the dialog without terminating the old Worker, rechecks owner/session and dirty epoch, validates the new document and only then cancels the original Worker before resetting History. All other active raster operations remain blocked. Existing 2M cap/180s deadline are unchanged.
- Regression: `tests/new-document-controller.test.mjs` covers denied dirty confirmation, prepublication-only cancellation, factory failure, stale session/document, failed cancellation and noncancellable operations.
- New independent actual `file://` Chromium `ZPE_DENSE_REPLACE_BROWSER_ONLY` mode for PSD16 and PSB32 with 1.9M–2M real frozen Uint32 selection, no old reply, denied confirmation preserving owner, accepted File New (37×29 blank state), 1.25s stale-result settling, fresh PSD/PSB native import and second genuine dense Worker Fill, byte-exact Undo/Redo and selected-only alpha/History. `tools/browser-dense-replace-evidence.mjs` enforces strict per-format evidence; separate CI job uploads artifacts.
- Deterministic generated browser bundle, index application-build and version.json stamp updated consistently. No new dependencies.
- **Verification:** GitHub PR-head CI and real Chromium receipts required before DONE. Local checkout/browser unavailable in this environment because GitHub DNS cannot be resolved. Until final exact PR-head CI and exact merged-main CI succeed, do not claim this task complete or merged.
- **Known limitations:** JS heap/timer sampled, not operation-only RSS/CPU peak; Worker→OS PID unknown; ZeTer-generated fixtures do not establish independently Photoshop-authored PSB32 provenance. Parent 003W/003T/Stage 003 OPEN; 002B/2c BLOCKED.

## Next gate

1. Open the branch PR. Inspect exact PR-head `CI` (`npm run check`, generated artifacts, both Chromium native replace runs and strict JSON receipts) and independent `real-photo` workflow.
2. Correct any observed failures with a new verified commit. Only if all required gates pass, merge normally and verify exact merged-code `main` CI and real-photo.
3. Once accepted, advance `task/NEXT.md` to the next prioritized unfinished 003W/003T verification or independent P0 corpus task. Avoid declaring native operation-exclusive peak/Photoshop PSB32 provenance.

## Final acceptance — 2026-10-22 (merged code, strict PR/main gates)

- [PR #313](https://github.com/zeter1/ZeTer-Photo-Editor/pull/313) **MERGED** as [main `5723af2dba78a19b9379e9bfc0ef98ca7a88f702`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/5723af2dba78a19b9379e9bfc0ef98ca7a88f702). Exact PR-head `1b9fde1e5258589ff6fea29b8e3cf5076c331ba6` [CI #39788015792 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39788015792) and [real-photo #39788015607 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39788015607).
- On exact merged code: [main CI #39789194104 attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39789194104), [main real-photo #39789194001 attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39789194001). Attempt 1 for each main workflow FAILED due Chromium DevTools endpoint startup timeout **before** the failed application's smoke; only failed jobs were rerun, do not count attempt 1 as success.
- Genuine independent `file://` PSD16 and PSB32: actual 1,973,400 frozen selection indices (7,893,600 Uint32 bytes) posted to real Blob Worker; denied dirty File → New preserves original owner and Worker. Accepted File → New terminates first Worker before reply, resets to distinct 37×29 blank document with no old native source/history; after bounded settle no old late reply, content or History leakage. A separate real new high-depth PSD/PSB reimport and second genuine dense Worker changes only selected native colors; alpha unaffected and exact Undo/Redo/History hold.
- Strict per-format receipts validated; `npm run check`, generated browser bundle/index/manifest parity, dedicated native tests and independent real-photo all green on PR and exact merged main. Production cancellation bridge only unlocks a cancellable in-flight Fill after user confirmation, fresh factory validation and owner check; other active operations remain blocked.
- **003W/2b-2f DONE** for File → New user-authorized replacement only, *not* a claim for approved in-flight PSD/PSB file import. No isolated CPU or RSS operation peak, Worker→PID mapping or independent Photoshop-authored PSB32 provenance. Parent 003W/003T/Stage 003 remain OPEN; independent Photoshop PSB32 P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.
- **NEXT P1 [003W/2b-2g](003w2b2g-dense-import-replacement.md) TODO:** separate real in-flight authorized PSD/PSB file import replacement, dirty denial, genuine native new-owner retry and stale-transaction isolation.


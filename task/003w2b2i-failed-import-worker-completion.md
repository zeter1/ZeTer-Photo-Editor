# 003W/2b-2i — Real failed PSD/PSB File Open with original dense Worker completing normally

**Priority:** P1. **Status:** DONE. **Parent:** 003W/Stage 003. **Dependency:** [003W/2b-2h](003w2b2h-failed-native-import-recovery.md) DONE; exact PR and main checks verified in [PR #317](https://github.com/zeter1/ZeTer-Photo-Editor/pull/317).

## Goal

Test the *other* permitted failure-recovery branch after an actual malformed/unsupported PSD16/PSB32 File → Open: **do not cancel** the original near-2M high-depth Content-Aware Fill Worker. It must finish safely on the original document with no ghost replacement or cross-owner writes. This complements 003W/2b-2h, which explicitly cancels the original Worker after the failed import.

## Acceptance criteria

1. In independent genuine Chromium `file://` PSD16 and PSB32 tests, open ZeTer-generated native high-depth documents; preserve frozen dense selection counts (~1.97M, ≤2,000,000) and source exact native bytes/preview/History. Do not claim independent Photoshop-authored provenance.
2. Dispatch the **real** Blob Worker; while in flight, execute actual File → Open using an approved malformed Photoshop-format File through the public menu/file input. Confirm an actual decoder failure, not a mock/faked reply.
3. Deliberately **do not send Escape or other cancellation**. The original Worker must naturally complete and persist only into its original owner, with selected-only color mutation, unchanged alpha/outside-selection native bytes, exactly one History entry, exact Undo/Redo and no ghost tab. A late import failure must not overwrite successful Worker publication or create a replacement.
4. Retry a distinct valid high-depth PSD16/PSB32 File Open after the completion; verify new owner bytes/preview/History, then a real dense Worker retry on the new owner with byte-exact Undo/Redo. The old Worker must never publish into the new owner.
5. Independent fail-closed dual-format receipts + validator-negative Node tests; observational timer/JS-heap limitations stated (no operation-only CPU/RSS peak, verified Worker→PID, or Photoshop provenance). Isolated CI; PR-head tests, genuine-photo checks, merge and exact-main verification before DONE. Keep file:// compatibility, bounded memory, 180-second stage limits.

## 2026-10-22 — Working branch checkpoint (not yet accepted)

- Branch: [test/003w2b2i-natural-failed-import-worker-20261022](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w2b2i-natural-failed-import-worker-20261022).
- Added independent genuine Chromium `file://` PSD16 and PSB32 modes: real malformed File Open during first ~1.97M selected native Worker, **no Escape**, natural old-owner completion, selected-only/alpha/History + exact Undo/Redo, distinct native File Open, fresh dense Worker with exact native Undo/Redo and no ghost tab.
- Added strict dual-format JSON receipts and fail-closed Node negative tests; isolated CI job. Production runtime/bundle unchanged.
- **Not DONE:** Node/Chromium runs and exact PR-head CI not yet observed. Last pre-existing `main` CI [#39822249513](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39822249513) failed to start Chromium DevTools in two unrelated jobs; other jobs, including `verify`, passed. Treat as infrastructure flake, not proof of regression or success. Inspect new PR results before merging.
- Keep P0 independent Photoshop-authored PSB32 provenance and operation-exclusive CPU/RSS / exact Worker PID **unresolved**.

## Starting points

`tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-dense-failed-import-evidence.mjs`, `tools/browser-smoke.mjs`, `src/document/psd-import-controller.js`, `.github/workflows/ci.yml`.

**Known limitations:** independent Photoshop-authored PSB32 P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED; 003T operation-only RSS/CPU peak and exact Worker→PID mapping unresolved. Do not declare parent 003W or Stage 003 DONE.

## 2026-10-22 — ACCEPTED: PR #319 and exact-main CI

**Status: DONE.** [PR #319](https://github.com/zeter1/ZeTer-Photo-Editor/pull/319) merged as [main 0055c6fc](https://github.com/zeter1/ZeTer-Photo-Editor/commit/0055c6fc9b89b342c50463c3ae5c4fb7e8f40d6f).
- Exact PR-head `ea156af2be8a6798ce4593961172a4604b4378f6`: [CI #39825876388 attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39825876388) and [real-photo #39825876228 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39825876228).
- Exact merged code `0055c6fc9b89b342c50463c3ae5c4fb7e8f40d6f`: [main CI #39826583805 attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39826583805) and [real-photo #39826583766 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39826583766). Initial PR/main attempts hit unrelated Chromium DevTools startup timeouts before tests; only failed jobs reran successfully. Neither initial attempt is called green.
- Independent real Chromium `file://` ZeTer-authored PSD16 and PSB32 generated 1,973,400 original frozen native indices each (7,893,600 bytes). A real 12-byte malformed Photoshop File Open failed during first Worker, without Worker cancellation, owner change, ghost tab, or source/History damage.
- Original Worker naturally completed (PSD16 observed 4,505 ms, PSB32 3,773 ms from harness boundaries), selected-only native colors changed; alpha, outside bytes and one History entry passed; exact Undo/Redo passed. Next File Open of different genuine high-depth native source and second real dense Worker also passed exact alpha/selection/History/Undo/Redo (PSD16 retry 4,087 ms; PSB32 retry 4,882 ms). These times are end-to-end observations, not isolated CPU.
- Strict independent dual-format receipts and negative validator Node tests passed. Production runtime and generated bundle unchanged; project `file://` is preserved. P0 Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED. 003W, 003T, Stage 003 still OPEN: operation-only RSS/CPU peak, exact Worker→PID and continuous freeze sampling unproven.
- **Next [003W/3](003w3-dense-scan-responsiveness.md):** measured comparative near-cap selection-freeze responsiveness; optimize only a measured reproducible bottleneck.


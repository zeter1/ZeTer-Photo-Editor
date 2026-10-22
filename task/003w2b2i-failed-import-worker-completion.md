# 003W/2b-2i — Real failed PSD/PSB File Open with original dense Worker completing normally

**Priority:** P1. **Status:** TODO. **Parent:** 003W/Stage 003. **Dependency:** [003W/2b-2h](003w2b2h-failed-native-import-recovery.md) DONE; exact PR and main checks verified in [PR #317](https://github.com/zeter1/ZeTer-Photo-Editor/pull/317).

## Goal

Test the *other* permitted failure-recovery branch after an actual malformed/unsupported PSD16/PSB32 File → Open: **do not cancel** the original near-2M high-depth Content-Aware Fill Worker. It must finish safely on the original document with no ghost replacement or cross-owner writes. This complements 003W/2b-2h, which explicitly cancels the original Worker after the failed import.

## Acceptance criteria

1. In independent genuine Chromium `file://` PSD16 and PSB32 tests, open ZeTer-generated native high-depth documents; preserve frozen dense selection counts (~1.97M, ≤2,000,000) and source exact native bytes/preview/History. Do not claim independent Photoshop-authored provenance.
2. Dispatch the **real** Blob Worker; while in flight, execute actual File → Open using an approved malformed Photoshop-format File through the public menu/file input. Confirm an actual decoder failure, not a mock/faked reply.
3. Deliberately **do not send Escape or other cancellation**. The original Worker must naturally complete and persist only into its original owner, with selected-only color mutation, unchanged alpha/outside-selection native bytes, exactly one History entry, exact Undo/Redo and no ghost tab. A late import failure must not overwrite successful Worker publication or create a replacement.
4. Retry a distinct valid high-depth PSD16/PSB32 File Open after the completion; verify new owner bytes/preview/History, then a real dense Worker retry on the new owner with byte-exact Undo/Redo. The old Worker must never publish into the new owner.
5. Independent fail-closed dual-format receipts + validator-negative Node tests; observational timer/JS-heap limitations stated (no operation-only CPU/RSS peak, verified Worker→PID, or Photoshop provenance). Isolated CI; PR-head tests, genuine-photo checks, merge and exact-main verification before DONE. Keep file:// compatibility, bounded memory, 180-second stage limits.

## Starting points

`tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-dense-failed-import-evidence.mjs`, `tools/browser-smoke.mjs`, `src/document/psd-import-controller.js`, `.github/workflows/ci.yml`.

**Known limitations:** independent Photoshop-authored PSB32 P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED; 003T operation-only RSS/CPU peak and exact Worker→PID mapping unresolved. Do not declare parent 003W or Stage 003 DONE.

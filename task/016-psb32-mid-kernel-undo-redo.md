# 016 / 010D-C — PSB32 Float32 mid-kernel active switch + exact native Undo/Redo

**Status: implementation on PR branch; gate pending.** Source: [NEXT](NEXT.md), [015](015-active-session-worker-cancel.md), Stage 003 [003](003-tiled-content-aware.md). This is NOT a licensed Photoshop-authored fixture.

## Goal / evidence

010D-B established a real Chromium `file://` PSD16 active tab switch after the original high-depth Worker wrote its first pixel. Browser PSB32 Float32 was tested for *post-compute delayed reply* in 009, but not while the CPU kernel was still busy. The prior active-session smoke also checked only 16-bit preview/History after a successful replacement Fill: it did not assert native Undo/Redo word-for-word.

## Scope

- [x] Reuse existing isolated browser `verifyBrowserUiLockMidKernel` harness for `rgb16large` and `rgb32psblarge` (ZeTer-generated 1025² PSD16 / PSB32); fresh reload before each run, no production code or source mutation.
- [x] Probe *after* a real native in-Worker pixel write, terminate on real second-tab click, and assert both sessions' visible History/metadata survive the stale continuation.
- [x] Via the public File → Save Project JSON export, verify native v2 `rawBytes`, channel depth, unchanged donor sample, selected defect sample values **and their exact little-endian Uint16/Uint32 words**.
- [x] After successor real Worker Fill, assert unchanged original words after cancellation, changed defect words on successful Fill, native Undo restores the original words/tile structure, native Redo restores the committed words, then switch tabs once more and check no cross-session publication.
- [x] Capture sampled browser memory and timing labeled **samples**, never claim true peak RSS, independent Adobe parity or two high-depth source documents.
- [x] Update `tools/browser-smoke.mjs` so PSD16 and PSB32 scenarios both execute in CI.
- [ ] PR CI success (Node + generated parity + real Chromium `file://` + informational profiles + diff hygiene).
- [ ] Merge to `main` and verify **exact main commit** push CI success.

## Non-scope / limits

The second tab in this scenario is a separate ordinary 1200×800 document, **not another native PSB32**. The exact word-level oracle applies to imported high-depth first tab before/after cancellation, Undo, Redo and round-trip; second tab is compared via public title/layers/History/size. No production behavior, version or bundle change is required. There is no independent Photoshop-authored high-depth reference or true browser peak-memory measurement.

## Planned next tasks

1. **P0 / 002**: independently Photoshop-authored licensed RGB16/CMYK32 PSD/PSB corpus, provenance and SHA-256; full Adobe reference compositing comparison.
2. **P1 / 010E**: complex connected/dense ROI strip/segment planner, bounded worst-case work and memory with RGB16/Float32 CMYKA byte parity and cancellation.
3. **P1 / 010D-D**: second imported native PSB32 live session with independently different pixels/History; active mid-kernel switch directly into a concurrent high-depth second Worker job, independent exact-bit session oracles.
4. **P1**: sampled and instrumented process/Worker high-water-mark methodology; no peak guarantees from CDP snapshots.

## Invariants / handoff

- Never accept a prior pending Fill's `finally` to release a new session lease.
- Source payload tiles are immutable; cancelled jobs publish **zero** native bytes and zero History edits.
- New phase must load a fresh generated Worker supplier before injecting **test-only** probe and restore Worker monkey-patches afterward.
- Keep Stage 002 and Stage 003 open pending their own completion gates.

# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** — nested clipped adjustment over translucent backdrop; next: chained raster/adjustment clipping and non-source-over base blend.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** — bounded candidate 1.47.21 implemented locally; remote PR-head checks/merge pending. Parent Adobe Photoshop parity NOT DONE.
> **EXACT BASE MAIN (2026-11-23):** `ef6070090907b45904da6bda81f793f73f298ffd`, queue update after merged #401 and #402. Last main [CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45186923745); prior post-merge real-photo [success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45186730512); cancelled older core run is NOT PASS.
> **LATEST BOUNDED IMPLEMENTATION:** clipped adjustment inside nested Pass Through masked folder now modifies its translucent base instead of already-flattened parent backdrop; delta uses premultiplied alpha and preserves underlying destination alpha. Real Chromium `file://` exact RGBA [0,170,255,192] fully open, [0,102,255,160] half, [0,0,255,128] closed; real Group Properties toggle, Undo/Redo, native .zpe save/reopen PASS. Node focused RGB/alpha negative and PSD/PSB native group/clipping/adjustment structure PASS.
> **NEXT REMOTE ACTION:** publish candidate on `feat/psd-nested-translucent-20261123` and run required Linux CI on exact PR head; verify code review and required checks, merge only if gates PASS, then exact-main independent core/real-photo readback. Do not mark merged until confirmed.
> **NEXT IMPLEMENTATION ACTION AFTER GATES:** introduce a RED fixture with a 50%-alpha clipping base, a clipped raster overlay (multiply/screen), then a clipped adjustment in a nested masked Pass Through group over a semitransparent backdrop; correct clip-stack semantics without backdrop modification or flattening. Assert exact RGBA/Undo/Redo/.zpe plus PSD/PSB native editable structure.
> **BLOCKED EXTERNAL ACCEPTANCE:** licensed Photoshop-authored PSD/PSB pixel golden, knockout, broader blend parity/large-project memory; camera DNG external oracle unrelated and independently blocked. **Do not claim Adobe parity.**

## Короткая очередь

1. **P1 IN PROGRESS — Stage 17a:** integrate 1.47.21 when PR-head gates pass; next chained clipped raster/adjustment in nested groups over translucent backdrop.
2. **P1 BLOCKED — CAP-RAW-CAMERA-ORACLE:** licensed camera-original DNG + independent RAW ground truth.
3. **P2 IN PROGRESS:** Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks — select independent vertical slice only after higher-priority work.

[Stage 17a journal](002-psd-folder-group-mask.md) · [capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

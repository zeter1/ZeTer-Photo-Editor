# NEXT — единая очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / bounded v1.47.24 cumulative Levels→Invert + native Posterize/Threshold.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** — local implementation + targeted acceptance PASS; remote acceptance not yet confirmed. Parent full Photoshop parity remains IN PROGRESS.
> **BASE MAIN SHA:** `c7007f4c07afe669be4961bf1749667f8a0616f6` (#406 merged Paths visibility fix; [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45223048593), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45223048729)).
> **ACTIVE PR:** branch `feat/psd-levels-invert-20261124`; PR publication/CI readback pending.
> **LAST VERIFIED:** 2026-11-24 local RED 2→GREEN 2 native post/thrs eligibility; 26/26 focused Node PASS, actual Chromium file:// 16 native PSD/PSB UI roundtrips PASS (4 prior, 8 Levels→Invert, 4 Posterize/Threshold). Independent scalar RGBA ±2 byte quantization, group/raster masks, editable native layer order/parameters, History Undo/Redo and .zpe Save/reopen. Prior #405 merge-main core FAIL on 5d95ef0 is not relabeled; latest exact-main #406 both workflows SUCCESS.
> **REMAINING ACCEPTANCE:** new candidate exact PR-head core + independent workflow; inspect diff/reviews/branch requirements, merge only when all gates pass, verify exact merged-main CI. Licensed Photoshop-authored pixel golden and advanced knockout remain open.
> **NEXT IMPLEMENTATION ACTION:** after v1.47.24 PR acceptance, reproduce and fix non-source-over clipping-base blend (Multiply/Screen base over opaque and translucent backdrop, then clipped adjustment) against independent premultiplied RGBA; verify native PSD/PSB editable structure, Undo/Redo and .zpe.
> **BLOCKERS:** licensed Adobe-authored PSD/PSB pixel golden for independent parity, advanced knockout reference; genuine camera DNG+LibRaw independent reference for separate RAW task.

## Короткая очередь

1. P1 v1.47.24 remote acceptance: exact PR-head CI and independent real-photo workflow, review and guarded merge.
2. P1 Stage 17a — non-source-over clipping-base blend with clipped adjustment in nested groups.
3. P1 CAP-RAW-CAMERA-ORACLE — BLOCKED: original licensed camera DNG + LibRaw/RawTherapee reference.
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks — next independent unblocked user-visible slice.

[Stage 17a journal](002-psd-folder-group-mask.md) · [Capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.26 isolated Multiply/Screen folder clipping base.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - local implementation and Chromium acceptance PASS; remote gates pending.
> **BASE MAIN SHA:** 801c03ae29e5fc6d79e0d117604a17fe38bd4f5a (#408 MERGED; exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45337366392) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45337366360) queued at readback).
> **ACTIVE PR:** [#408 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/408) exact head e6ea12246b91437b6eaf9a4b5ac494ae0af01b8a, [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45336787362), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45336787309); v1.47.26 branch feat/psd-group-clipping-base-20261124, publication pending at authoring.
> **LAST VERIFIED:** v1.47.26 RED expected [6,44,204,160] vs [0,89,204,160], GREEN actual [6,45,204,160]; six new Chromium file:// cases, 12 new / 40 total native editable PSD/PSB UI roundtrips exit 0, group/raster mask and opacity, History Undo/Redo, .zpe save/reopen, independent scalar RGBA +/-2. Build 000cb167c5165790; focused Node 20/20; Windows full check 1811 / 1796 PASS / 10 SKIP / 5 known Linux-only cgroup FAIL.
> **REMAINING ACCEPTANCE:** #408 exact merged-main workflows; v1.47.26 exact PR-head core + independent, guarded merge and exact merged-main CI. Independent Adobe-authored group clipping parity and advanced knockout remain unaccepted.
> **NEXT IMPLEMENTATION ACTION:** after remote gates, extend source-stack blending to supported Overlay/Hard Light raster and isolated folder clipping bases, first reproduce with independently computed premultiplied RGBA over opaque/translucent backgrounds, then verify native PSD/PSB roundtrip and Undo/Redo/.zpe.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden and knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 verify #408 exact merged-main and v1.47.26 PR-head/merged-main acceptance.
2. P1 Stage 17a - Overlay/Hard Light clipping bases (raster and isolated folder) with clipped adjustment, bounded independent scalar oracle.
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.25 clipping-base Multiply/Screen.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - local code + Chromium acceptance PASS; remote acceptance pending.
> **BASE MAIN SHA:** b80bb643e9104339913751e3578acf01d0ac8300 (#407 MERGED; exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45336494040) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45336494127) PENDING at readback).
> **ACTIVE PR:** [#407 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/407) v1.47.24 exact head 5a4181a377975c065d9902a62be9b8fc5f9ada1b [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45335771338) + [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45335771357); v1.47.25 branch feat/psd-clipping-base-blend-20261124 (publication pending at authoring).
> **LAST VERIFIED:** v1.47.25 Chromium file:// RED exit 1 on old code -> GREEN exit 0, 6 new base-mode/backdrop cases, 12 new/28 total editable PSD/PSB roundtrips with group and raster masks, scalar RGBA +/-2, History Undo/Redo and .zpe save/reopen; build PASS; focused Node 24/24 PASS; Windows npm run check 1811 tests / 1796 PASS / 10 SKIP / 5 known Linux-only cgroup FAIL; diff check PASS.
> **REMAINING ACCEPTANCE:** exact #407 merged-main CI and v1.47.25 PR-head core + independent workflows, guarded merge and exact merged-main CI; independent Adobe-authored parity and advanced knockout not accepted.
> **NEXT IMPLEMENTATION ACTION:** after remote gates, reproduce and fix isolated non-normal folder as clipping base with subsequent clipped adjustment, independent premultiplied RGBA on translucent/opaque backdrop and partial folder opacity/mask; verify editable native PSD/PSB, Undo/Redo and .zpe.
> **BLOCKERS:** licensed Photoshop-authored golden/advanced knockout reference, genuine camera DNG+LibRaw independent reference.

## Short queue

1. P1 verify #407 exact-main CI, then v1.47.25 PR-head and merged-main acceptance.
2. P1 Stage 17a - non-normal isolated group as clipping base with clipped adjustment.
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

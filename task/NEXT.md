# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.28 Darken/Lighten raster and isolated folder clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - local production code, targeted and full dedicated Chromium PASS; remote candidate gates pending.
> **BASE MAIN SHA:** 0cfe486b5df92f570e29e1acf3d765bd96efb81c (#410 MERGED; exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45339921642), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45339921631) pending at readback).
> **ACTIVE PR:** [#410 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/410) head e778218a307deb3c586a46cf935760c3b891fc1e, [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45339057940) and [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45339057939); v1.47.28 branch feat/psd-darken-lighten-clipping-base-20261124, publication at authoring.
> **LAST VERIFIED:** v1.47.28 RED expected [51,189,183,160] vs [13,196,182,160]; GREEN first pixel [51,188,182,160]; targeted and full dedicated Chromium exit 0, 12 new raster/folder x Darken/Lighten x alpha 0/128/255, 24 new / 88 total editable native PSD/PSB UI roundtrips, independent scalar premultiplied RGBA +/-2, mask/opacity, History Undo/Redo and .zpe; build 369f205141483866; focused Node 25/25 PASS; Windows full check 1811 / 1796 PASS / 10 SKIP / 5 known Linux-only cgroup FAIL.
> **REMAINING ACCEPTANCE:** #410 exact merged-main CI; v1.47.28 exact PR-head core + independent, guarded merge and exact merged-main CI. Adobe-authored group clipping parity and advanced knockout unaccepted.
> **NEXT IMPLEMENTATION ACTION:** after v1.47.28 remote gates, Stage 17a Difference/Exclusion raster and isolated folder clipping bases with cumulative clipped raster/Levels/Invert; independent abs/difference and exclusion scalar premultiplied RGBA, alpha 0/128/255, masks/opacity, native PSD/PSB, History and .zpe.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 verify #410 exact-main acceptance, then v1.47.28 Darken/Lighten PR-head and merged-main gates.
2. P1 Stage 17a - Difference/Exclusion clipping bases (raster and isolated folder).
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

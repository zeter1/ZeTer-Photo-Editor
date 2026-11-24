# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.27 Overlay/Hard Light raster and folder clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - local production implementation and Chromium acceptance PASS; remote acceptance pending.
> **BASE MAIN SHA:** d7ce091e2ecc7fb54f694daa61ad31f3a299c2ad ([#409 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/409), exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45338659014) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45338659091) in progress at readback).
> **ACTIVE PR:** #409 exact head 5b6b8b8be64669219c14b9c2972208c3a924b901 [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45337695075) + [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45337695080); v1.47.27 branch feat/psd-contrast-clipping-base-20261124, publication pending at authoring.
> **LAST VERIFIED:** v1.47.27 RED expected [48,200,201,160] vs [26,217,218,160], GREEN [48,199,201,160]; 12 new cases (raster/folder x Overlay/Hard Light x alpha 0/128/255), 24 new/64 total editable native PSD/PSB UI roundtrips, independent scalar RGBA +/-2, mask/opacity, History Undo/Redo and .zpe reopen; full dedicated browser exit 0, build daaf28f4e04d1fe9, focused Node 25/25 PASS; Windows full check 1811 tests / 1796 PASS / 10 SKIP / 5 known Linux-only cgroup FAIL.
> **REMAINING ACCEPTANCE:** #409 exact-main CI; v1.47.27 PR-head core + independent CI, guarded merge and exact merged-main CI; Adobe-authored group clipping parity and advanced knockout remain unaccepted.
> **NEXT IMPLEMENTATION ACTION:** after remote gates, Stage 17a Darken/Lighten raster and isolated folder clipping bases with cumulative clipped raster/Levels/Invert; independent min/max blend scalar premultiplied RGBA on mixed backdrop alpha 0/128/255, partial masks/opacity, native editable PSD/PSB UI, History and .zpe.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 verify #409 exact-main CI, then v1.47.27 PR-head and merged-main acceptance.
2. P1 Stage 17a - Darken/Lighten clipping bases (raster and isolated folder).
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

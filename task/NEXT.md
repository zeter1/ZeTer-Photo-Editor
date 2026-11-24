# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.29 Difference/Exclusion raster and isolated folder clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - production implementation, focused Node and full dedicated Chromium PASS; remote acceptance pending.
> **BASE MAIN SHA:** 0cfe486b5df92f570e29e1acf3d765bd96efb81c (#410 MERGED; exact-main core [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45339921642), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45339921631) pending at readback).
> **ACTIVE PR:** [#411](https://github.com/zeter1/ZeTer-Photo-Editor/pull/411) head b5945db3d850cfbf12d745396730ee115ed63e27, [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45340074563), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45340074771) pending at readback; v1.47.29 branch feat/psd-difference-exclusion-clipping-base-20261124 based on #411 tree.
> **LAST VERIFIED:** RED expected [51,161,176,160] vs [38,233,226,160], GREEN [51,161,175,160]; build 07791979a015ed83; 12 new raster/folder x mode x alpha cases, 24 new / 112 total native editable PSD/PSB UI roundtrips, independent scalar RGBA +/-2, partial masks/opacity, History Undo/Redo and .zpe; focused Node 25/25 PASS. Windows full check exit 1: 1811 tests, 1796 PASS / 10 SKIP / 5 known Linux-only cgroup FAIL (same two suites as predecessor).
> **REMAINING ACCEPTANCE:** #410 independent exact-main CI; #411 independent exact-head CI, guarded merge and exact-main CI; v1.47.29 exact PR-head core + independent and guarded merge / exact-main CI. Adobe-authored parity and advanced knockout unaccepted.
> **NEXT IMPLEMENTATION ACTION:** after predecessor gates, publish/rebase v1.47.29 against accepted main; then Soft Light clipping bases using an independent piecewise scalar oracle, raster/folder, mixed backdrop alpha 0/128/255, partial masks/opacity, native PSD/PSB, History and .zpe.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 finish #410 exact-main and #411 head/main gates; publish and accept v1.47.29 Difference/Exclusion.
2. P1 Stage 17a - Soft Light clipping bases (raster and isolated folder).
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

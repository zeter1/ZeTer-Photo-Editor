# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.29 Exclusion Linux exact-pixel regression (#412).
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - #412 core FAIL; v1.47.30 Soft Light local bounded candidate verified, dependent on #412.
> **BASE MAIN SHA:** f19acac380fda7e753bba441b799b0ba6926bed3 (#411 MERGED; [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45340962101), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45340962140)).
> **ACTIVE PR:** [#412](https://github.com/zeter1/ZeTer-Photo-Editor/pull/412) head 7b4cd3fad894c530632c27d8a606997ae8de1cd8; [core FAIL](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45341076229), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45341076234). Soft Light [#413 DRAFT](https://github.com/zeter1/ZeTer-Photo-Editor/pull/413) is stacked on #412; remote workflows NOT RUN at readback.
> **LAST VERIFIED:** v1.47.30 real Chromium RED expected [142,92,201,160] vs [112,120,220,160], GREEN [142,92,201,160]; 6 new raster/folder x alpha 0/128/255 cases, 12 new / 124 total editable native PSD/PSB UI roundtrips; scalar piecewise Soft Light RGB and alpha +/-2, masks/opacity, History and .zpe. Build 1d030a35e0bf5cbb; focused Node 25/25 PASS; Windows full check 1811 / 1796 PASS / 10 SKIP / 5 known Linux-only cgroup FAIL.
> **REMAINING ACCEPTANCE:** #412 Exclusion folder alpha 128, x3 blue expected 188 actual 185 (strict +/-2 failed), investigate quantization vs production composition; no tolerance relaxation. Verify exact PR-head core and independent and merged-main before integration of Soft Light; then exact Soft Light PR-head/merged-main gates. Adobe-authored parity and advanced knockout unaccepted.
> **NEXT IMPLEMENTATION ACTION:** reproduce #412 Linux Exclusion isolated-folder case, isolate first divergent alpha/RGB stage with an independent scalar reference, correct the actual cause and keep strict +/-2. Then integrate and retest Soft Light without redoing its verified local work.
> **BLOCKERS:** #412 Linux core FAIL; licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 fix #412 Exclusion Linux exact-pixel discrepancy and complete both #412 remote gates.
2. P1 integrate v1.47.30 Soft Light candidate, exact core/independent PR and main gates.
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

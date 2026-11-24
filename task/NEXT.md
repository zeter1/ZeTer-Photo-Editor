# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.32 RGB8 Color non-separable mode.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #414 MERGED, #415 implemented and locally accepted; Linux gates pending.
> **BASE MAIN SHA:** a3a5a5804b8b3d00e80c72e93699e7c4ef61fb04 (#414 MERGED; exact-main CI in progress).
> **ACTIVE PR:** [#415](https://github.com/zeter1/ZeTer-Photo-Editor/pull/415), base main.
> **LAST VERIFIED:** 2026-11-24: [#415](https://github.com/zeter1/ZeTer-Photo-Editor/pull/415) direct Color/Normal UI acceptance RED→GREEN: Normal isolated-folder alpha128 x3 blue expected 221 vs actual 218 (strict ±2 failed); compose the isolated Normal clipping stack once on its source matte with tiled straight RGBA, no tolerance relaxation. Targeted Chromium exit 0; full dedicated genuine Windows Chromium file:// 160 native editable PSD/PSB export/reimport paths PASS (61.88 s, exit 0), 4 explicit layer/folder × backdrop-alpha 128/255 mode-control changes + History Undo/Redo PASS, Color six cases and ZPE PASS. Latest build `4e64fd3c7de5a54e`, focused Color Node 4/4 PASS on final build, 35/35 earlier same feature kernel. Full npm check NOT RUN. Runtime/test/build blobs match final local files. Exact-head Linux core/independent CI required. #414 exact-main core and independent in progress at readback (45349938069/45349938057). Adobe-authored oracle and native high-depth Color remain unaccepted.
> **REMAINING ACCEPTANCE:** #414 exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45349938069) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45349938057); #415 exact new head core/independent, checks/review/mergeability, guarded merge and exact-main CI. Native RGB16/32 and CMYK Color unsupported and fails closed; Adobe-authored oracle still blocked.
> **NEXT IMPLEMENTATION ACTION:** Accept #415 exact-head and merged-main gates; implement Hue as the next non-separable RGB8 blend mode (source hue, backdrop saturation/luminance) with state/UI, native PSD/PSB hue key, raster/folder and clipped adjustment paths, independent oracle, Undo/Redo, ZPE and native high-depth fail-closed.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference.

## Short queue

1. P1 #414 exact-main acceptance; #415 Color exact-head and merged-main gates.
2. P1 Hue, then Saturation/Luminosity.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

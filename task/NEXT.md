# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / Hue v1.47.33 acceptance → Saturation v1.47.34 stacked acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #415 MERGED; #416 Hue OPEN on main; Saturation implemented and locally tested, not main.
> **BASE MAIN SHA:** eeacad5e9475b56dcabf0ca3bf84ca4d289c7d2d.
> **ACTIVE PR:** [#416 Hue](https://github.com/zeter1/ZeTer-Photo-Editor/pull/416); Saturation branch `feat/psd-saturation-blend-20261124` stacked on Hue.
> **LAST VERIFIED:** 2026-11-24 — **v1.47.34 Saturation bounded RGB8 candidate IN PROGRESS.** Source saturation with backdrop hue/luma (SetLum(SetSat(Cb, Sat(Cs)), Lum(Cb))), raster/group state and UI, clipping stack and adjustment compositors, native editable PSD/PSB `sat `; explicit native RGB16/32/CMYK rejection, preserving document and ZPE. Fresh Windows Node RED 0/3 → GREEN; focused 14/14 PASS incl. Hue, Color, Difference/Exclusion, final version 1/1 PASS. Build `bba27fc7b1fe5b77`. Real Chromium file:// targeted 12/12 native editable roundtrips PASS (11.60 s); full dedicated 184 native editable roundtrips, 12 direct layer/folder mode switches plus Undo/Redo, masks and .zpe PASS (75.48 s). Full npm check NOT RUN in this pass. All 16 changed source/test/build/public-version blobs match exact local SHA after LF normalization and deterministic rebuild. Synthetic, not Adobe-authored. #415 merged main `eeacad5e9475b56dcabf0ca3bf84ca4d289c7d2d`, exact-main workflows pending at readback; #416 Hue retargeted to main, exact head `b60811da92f0056c1693985ce2a411b2181bace4` core and independent in progress. Saturation is stacked on Hue and requires fresh remote gates after integration. Parent CAP remains IN PROGRESS.
> **REMAINING ACCEPTANCE:** #416 [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353437111) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353437206), review/check gate, merge and exact-main CI; reconcile Saturation with accepted main, retarget stacked PR, verify exact-head Linux core/independent, guarded merge and exact-main CI. Adobe-authored oracle remains BLOCKED.
> **NEXT IMPLEMENTATION ACTION:** Accept existing Hue and Saturation in dependency order without duplicate implementations; next independent new mode Luminosity (source luma, backdrop hue/saturation), preserve RGB8 regressions and native high-depth fail-closed.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native RGB16/32/CMYK non-separable math unimplemented.

## Short queue

1. P1 Hue #416 exact-head and exact-main gates.
2. P1 Saturation stacked candidate gates.
3. P1 Luminosity.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

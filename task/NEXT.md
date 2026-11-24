# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / native RGB16 Saturation v1.47.38 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS ? Hue #420 MERGED; Saturation candidate implemented.
> **BASE MAIN SHA:** 7875de6ce4b85e6ee5003b670bd5e75bd1f42f9d.
> **ACTIVE CANDIDATE:** [feat/psd-rgb16-saturation-20261124](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/psd-rgb16-saturation-20261124).
> **LAST VERIFIED MAIN:** Color #419 `b43c14ccd8742fba94b16f18500956860c66061d`, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45361855008), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45361855131).
> **LAST VERIFIED:** 2026-11-24 ? Stage 17a / native RGB16 Saturation v1.47.38 CANDIDATE. Color #419 ACCEPTED: main `b43c14ccd8742fba94b16f18500956860c66061d`, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45361855008), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45361855131). Hue [#420](https://github.com/zeter1/ZeTer-Photo-Editor/pull/420) MERGED at `7875de6ce4b85e6ee5003b670bd5e75bd1f42f9d`, tree equals verified head `8e725520c479b4f55558c9763e846daa5e21bb76`, 13/13 checks, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45362770339), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45362770445); separate exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45365927271) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45365927422) pending at readback. Saturation implements SetLum(SetSat(Cb,Sat(Cs)),Lum(Cb)) for flat encoded sRGB16 raster layers, straight alpha/opacity/raster mask/gamut, mixed Color/Hue/Saturation, no 8-bit fallback. RED 2/6 -> GREEN 6/6, focused 26/26 + version 1/1 PASS, deterministic build `674fd0e3010dab2a`, targeted real Chromium file:// PSD and PSB exact composite and editable native words, dropdown, Undo/Redo, .zpe save/reopen PASS. Full dedicated Chromium: 202 PSD/PSB native editable roundtrips PASS, exit 0. Windows full npm run check FAIL: 1845 total / 1830 PASS / 10 SKIP / 5 FAIL (existing Linux-specific cgroup/proc tests only); Linux CI remains mandatory. Synthetic oracle, not Adobe-authored. Unsupported groups/adjustments/clipping/vector masks/transforms/mixed precision/ICC/Float32/CMYK remain fail-closed. Parent CAP IN PROGRESS.
> **REMAINING ACCEPTANCE:** Verify Hue exact-main core/independent, candidate exact-head core/independent and all review/protection/check gates. Merge only after PASS; verify separate exact-main CI.
> **NEXT IMPLEMENTATION ACTION:** After Saturation acceptance implement native RGB16 Luminosity (SetLum(Cb,Lum(Cs))) for eligible flat raster layers; independent Uint16 oracle including achromatic/gamut and alpha/masks, exact native PSD/PSB words, UI History and .zpe, preserve fail-closed unsupported paths.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; native RGB16 Luminosity, Float32/CMYK non-separable math, groups/adjustments/clipping still unaccepted.

## Short queue

1. P1 Hue v1.47.37 exact-main acceptance.
2. P1 Saturation v1.47.38 exact-head and exact-main acceptance.
3. P1 Native RGB16 Luminosity bounded flat raster.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Recovery serialization #115/#124 (old PR conflicts; reproduce on current main before porting), Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

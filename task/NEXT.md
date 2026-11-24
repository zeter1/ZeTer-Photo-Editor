# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / native RGB16 Hue v1.47.37 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — RGB16 Color #419 MERGED; RGB16 Hue candidate implemented, remote acceptance pending.
> **BASE MAIN SHA:** b43c14ccd8742fba94b16f18500956860c66061d.
> **ACTIVE CANDIDATE:** [feat/psd-rgb16-hue-20261124](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/psd-rgb16-hue-20261124).
> **LAST VERIFIED MAIN:** Luminosity #418 main `b6184d24036f1f056930f97d14f881bc09a41634` [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45357774253), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45357774109).
> **LAST VERIFIED:** 2026-11-24 — **Stage 17a / native RGB16 Hue v1.47.37 candidate IN PROGRESS.** RGB16 Color [#419](https://github.com/zeter1/ZeTer-Photo-Editor/pull/419) merged at `b43c14ccd8742fba94b16f18500956860c66061d` (tree identical to PR head `3e5612564e0103ff1a5976381e9d12c1915ad694`, 13/13 checks, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45357998946), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45357998954)); exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45361855008) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45361855131) in progress at readback. New bounded native sRGB16 Hue = SetLum(SetSat(Cs, Sat(Cb)), Lum(Cb)); shared Color math, straight alpha, opacity, raster mask, flat native raster layers only; mixed Color/Hue supported. Fail closed for unsupported groups, adjustments, clipping, vector masks, mixed precision, ICC, Float32 and CMYK. RED 1/4 (3 expected failures) -> GREEN 6/6 native Hue, final focused 18/18 incl. version; build `e45e0a7af40d4bde`. Targeted live Chromium file:// actual Hue selector, Undo/Redo, .zpe save/reopen, PSD/PSB exact merged and editable native words PASS; full dedicated Chromium 200 native roundtrips PASS (75.12s). Windows full check FAIL 1839 total / 1824 PASS / 10 SKIP / 5 Linux-only cgroup/proc FAIL on sequential repeat; prior concurrent ROI profile failure passes isolated 2/2 and sequential rerun. Synthetic, not Adobe-authored. 13 source/test/generated/version/README blobs matched exact local tested SHA. [Candidate branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/psd-rgb16-hue-20261124). Parent CAP IN PROGRESS; no merge until previous exact-main and candidate exact-head gates pass.
> **REMAINING ACCEPTANCE:** Read #419 merged-main exact SHA core/independent results; verify Hue candidate exact-head core and independent CI, all required checks and review/protection gates. Fix real failures; merge only after PASS, then separately verify exact merged-main CI. Windows full check FAIL, not PASS.
> **NEXT IMPLEMENTATION ACTION:** After Hue acceptance implement native RGB16 Saturation for eligible flat raster layers (shared SetLum/SetSat, independent Uint16 oracle including achromatic/gamut boundaries, exact native PSD/PSB words, UI History and .zpe); keep unsupported topology and precision fail-closed. Then Luminosity.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native RGB16 Saturation/Luminosity, Float32/CMYK non-separable math and group/adjustment/clipping support remain unaccepted.

## Short queue

1. P1 RGB16 Color v1.47.36 exact-main acceptance.
2. P1 RGB16 Hue v1.47.37 exact-head and exact-main acceptance.
3. P1 Native RGB16 Saturation then Luminosity bounded flat raster.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / native RGB16 Luminosity v1.47.39 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - Saturation #421 MERGED; Luminosity implemented, acceptance pending.
> **BASE MAIN SHA:** 89af68eb8c356bc67cf4899bd4a01d428f066b6f.
> **ACTIVE CANDIDATE:** feat/psd-rgb16-luminosity-20261124.
> **LAST VERIFIED MAIN:** Hue #420 `7875de6ce4b85e6ee5003b670bd5e75bd1f42f9d` [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45365927271), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45365927422).
> **LAST VERIFIED:** 2026-11-24 - **Stage 17a / native RGB16 Luminosity v1.47.39 candidate IN PROGRESS.** Saturation [#421](https://github.com/zeter1/ZeTer-Photo-Editor/pull/421) merged at `89af68eb8c356bc67cf4899bd4a01d428f066b6f`, tree identical to verified head `a2dee871d1430041e0c32753d21b51c831e8681e`, 13/13 checks ([core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45366467033), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45366467061)). Separate exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45367670316) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45367670673) pending at readback. New native RGB16 Luminosity = SetLum(Cb,Lum(Cs)); all four non-separable modes coexist for flat encoded sRGB16 raster layers; exact Uint16 composite/layer words in PSD/PSB, alpha, opacity, masks, gamut and neutral edges. RED 2/6 -> GREEN 6/6; focused 36/36 + version 1/1 PASS; build `c74739356e89dd1e`; targeted Chromium file:// actual dropdown, preview, History, ZPE reopen, PSD and PSB exact words and editable reimport PASS. Full Windows npm run check FAIL: 1851 total / 1836 PASS / 10 SKIP / 5 FAIL (existing Linux-only proc/cgroup tests); Linux CI mandatory. Full dedicated Chromium file://: 204 native PSD/PSB roundtrips PASS (76.08s, exit 0). Synthetic oracle, not Adobe-authored; unsupported groups, adjustments, clipping, vector masks, transforms, mixed precision, ICC, Float32 and CMYK fail closed. Parent CAP IN PROGRESS.
> **REMAINING ACCEPTANCE:** Verify Saturation exact-main core/independent, Luminosity exact-head core/independent, all review/protection/check gates; merge only after PASS, then verify separate exact-main CI.
> **NEXT IMPLEMENTATION ACTION:** After Luminosity acceptance, reproduce native RGB16 isolated raster group composition with mixed non-separable blend and group opacity/mask. Select a bounded independently testable topology, no precision downgrade; keep clipping/adjustment/ICC/Float32/CMYK fail-closed until separately verified. Prioritize any current P0 or failing CI first.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; Float32/CMYK non-separable math, native groups/adjustments/clipping unaccepted.

## Short queue

1. P1 Saturation v1.47.38 exact-main acceptance.
2. P1 Luminosity v1.47.39 exact-head and exact-main acceptance.
3. P1 Bounded native RGB16 isolated raster group non-separable composition.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Recovery serialization #115/#124 (old PR conflicts; reproduce on current main before porting), Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

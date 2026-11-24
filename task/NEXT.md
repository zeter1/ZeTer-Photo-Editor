# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / bounded native RGB16 isolated Normal group v1.47.40.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - Luminosity #422 MERGED; isolated group candidate implemented.
> **BASE MAIN SHA:** 14fc1e7daa7ec842d867929d2a2cc8f684effe3a.
> **ACTIVE CANDIDATE:** feat/psd-rgb16-isolated-group-20261124 (v1.47.40).
> **LAST VERIFIED MAIN:** Saturation #421 `89af68eb8c356bc67cf4899bd4a01d428f066b6f` [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45367670316), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45367670673).
> **LAST VERIFIED:** Luminosity [#422](https://github.com/zeter1/ZeTer-Photo-Editor/pull/422) MERGED at `14fc1e7daa7ec842d867929d2a2cc8f684effe3a`, identical tree `8e4f6ac68718ddcf171bac8eb68656695760eb93` to head `9df50c90fb0dde760025c2f4d45519a206e8a040`, 13/13 [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45368594941), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45368594993). Exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45371666623) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45371667034) in progress at readback. New v1.47.40 candidate: single root Normal isolated group with contiguous RGB16 sRGB raster children, one or more non-separable modes (Color/Hue/Saturation/Luminosity), group opacity and prepared raster mask applied once. Native Uint16 composite and editable PSD/PSB channels; bounded surfaces; unsupported nested/pass-through/non-Normal group, interleaving, clipping, adjustment, vector mask, transforms, mixed precision, ICC/Float32/CMYK remain fail-closed in the non-separable path. RED 1/3 -> GREEN 3/3; 25/25 initial focused, 5/5 group tests + version PASS; build `e97b063ab0706481`; real Chromium file:// PSD/PSB exact merged and editable native words, dropdown, Undo/Redo, .zpe save/reopen PASS. Windows full npm run check FAIL (1856 tests / 1841 PASS / 10 SKIP / 5 existing Linux-only proc/cgroup FAIL; version regression fixed and rerun). Synthetic, not Adobe-authored.
> **REMAINING ACCEPTANCE:** Verify #422 exact-main core/independent; candidate exact-head core/independent, full dedicated Chromium and all review/protection/check gates; merge only after PASS then separate exact-main CI. Do not claim full Windows PASS or Adobe provenance.
> **NEXT IMPLEMENTATION ACTION:** After acceptance, extend bounded native RGB16 composition to isolated group blend modes (Color/Hue/Saturation/Luminosity on the group against the parent backdrop) with independent exact native words, opacity/mask, UI/History/.zpe and PSD/PSB roundtrip; do not expand nested/pass-through/clipping/adjustment until independently verified.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; native non-Normal group/nesting/clipping/adjustments/Float32/CMYK not accepted.

## Short queue

1. P1 Luminosity v1.47.39 exact-main acceptance.
2. P1 Isolated Normal RGB16 group v1.47.40 exact-head and exact-main acceptance.
3. P1 Native RGB16 non-separable blend on isolated group against parent backdrop.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Recovery serialization #115/#124 (old PR conflicts; reproduce on current main before porting), Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / native RGB16 Color v1.47.36 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — Luminosity #418 MERGED; RGB16 Color candidate.
> **BASE MAIN SHA:** b6184d24036f1f056930f97d14f881bc09a41634.
> **ACTIVE PR:** [#419 Native RGB16 Color](https://github.com/zeter1/ZeTer-Photo-Editor/pull/419).
> **LAST VERIFIED:** 2026-11-24 — **Stage 17a / bounded native RGB16 Color v1.47.36 IN PROGRESS.** Luminosity #418 exact head `68644597ff4ac3ee60e981eae83972a82750ad5a` [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45356258557), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45356258622), 13/13 checks, protected=false, rulesets empty, no unresolved reviews. MERGED at main `b6184d24036f1f056930f97d14f881bc09a41634`, tree identical to tested head; [exact-main core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45357774253) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45357774109) IN PROGRESS. Saturation exact-main [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45355907087), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45355907082). New 1.47.36 native encoded sRGB16 Color: flat raster native SetLum, gamut clipping and straight alpha, layer opacity, raster mask; reject unsupported groups/adjustment/clipping/vector masks/mixed sources/Float32/CMYK/ICC, and reject typed composite failure rather than Canvas8 fallback. Existing UI Color dropdown, History Undo/Redo, .zpe preservation, native editable PSD/PSB roundtrip and exact big-endian merged plane words verified. RED 1/4 (3 failures) → GREEN 4/4, final focused 59/59 incl. version, deterministic build `1316667161393a2e`, targeted real Chromium file:// PSD and PSB PASS; full dedicated 198 editable native export/reimport paths PASS (65.05s, exit 0). Full Windows npm check NOT RUN; synthetic, not Adobe-authored. All 12 modified source/test/generated/version/README blob SHAs independently matched exact local files; changelog history preserved from remote. [Branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/psd-rgb16-color-20261124); fresh remote checks and merge acceptance pending. Parent CAP IN PROGRESS.
> **REMAINING ACCEPTANCE:** Luminosity exact-main core/independent; RGB16 Color fresh exact PR-head core/independent, all checks and diff/review/protection gates; merge then exact-main CI. Full Windows check NOT RUN. No Adobe-authored parity claim.
> **NEXT IMPLEMENTATION ACTION:** Accept the bounded RGB16 Color candidate; fix any real failures. After acceptance extend native sRGB16 non-separable Hue to eligible flat raster layers with independent Uint16 oracle, exact native PSD/PSB words, UI History and .zpe; keep unsupported paths fail-closed.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native RGB16 Hue/Saturation/Luminosity, Float32/CMYK non-separable math and group/adjustment/clipping support remain unaccepted.

## Short queue

1. P1 Native RGB16 Color v1.47.36 exact-head and exact-main acceptance.
2. P1 Native RGB16 Hue bounded flat raster (then Saturation/Luminosity).
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

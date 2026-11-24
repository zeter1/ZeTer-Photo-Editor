# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / Saturation v1.47.34 acceptance → Luminosity v1.47.35 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — Hue #416 MERGED; Saturation #417 OPEN on main; Luminosity stacked candidate.
> **BASE MAIN SHA:** a0f1b488a96f68fbc30242b7460216ffb7cf040d.
> **ACTIVE PR:** [#417 Saturation](https://github.com/zeter1/ZeTer-Photo-Editor/pull/417); stacked Luminosity branch `feat/psd-luminosity-blend-20261124`.
> **LAST VERIFIED:** 2026-11-24 — **v1.47.35 Luminosity bounded RGB8 candidate IN PROGRESS.** SetLum(Cb, Lum(Cs)), actual layer/group controls and clipping/adjustment composition, native PSD/PSB `lum `; RGB16/32/CMYK fail closed. Windows fresh RED 0/3 → GREEN, focused 17/17 PASS, version 1/1 PASS; build `d6f439c79f3198a9`, real Chromium file:// six raster/folder × alpha 0/128/255 cases, 12 editable native PSD/PSB export/reimports, 4 mode-control changes, masks, History Undo/Redo, .zpe PASS. Full dedicated/full npm check NOT RUN in this pass; synthetic, not Adobe-authored. All 16 runtime/test/build/public-version blob SHAs matched the tested local files. Stacked on #417 `d17b891f86114c5944f078ee504822b6a4cd0aa1`, [core IN PROGRESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354828671), [independent IN PROGRESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354828649). Hue #416 main `a0f1b488a96f68fbc30242b7460216ffb7cf040d` [core IN PROGRESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354421590), [independent IN PROGRESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354421602). Parent CAP IN PROGRESS.
> **REMAINING ACCEPTANCE:** Hue exact-main gates; Saturation exact-head checks, review/merge, exact-main CI; reconcile Luminosity with accepted main without force, retarget and run fresh core + independent gates; merge and exact-main CI. Full dedicated Luminosity browser regression and full Linux check required.
> **NEXT IMPLEMENTATION ACTION:** Finish #417 and Luminosity in dependency order, then choose next unimplemented professional feature per matrix; high-depth non-separable remains unaccepted.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native RGB16/32/CMYK non-separable math unimplemented.

## Short queue

1. P1 Saturation #417 exact-head and exact-main gates.
2. P1 Luminosity stacked candidate exact-head and exact-main gates.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

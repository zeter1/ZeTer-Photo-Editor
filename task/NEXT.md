# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.32 native RGB8 Color non-separable mode.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #414 MERGED exact head gates PASS; v1.47.32 implemented, further UI and Linux acceptance needed.
> **BASE MAIN SHA:** a3a5a5804b8b3d00e80c72e93699e7c4ef61fb04 (#414 MERGED; exact-main CI pending).
> **ACTIVE PR:** Color candidate branch `feat/psd-color-blend-20261124`; draft PR to main, head CI not yet accepted.
> **LAST VERIFIED:** 2026-11-24: [#414 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/414) exact PR head `0cf81ccb27ddebb27f6e84c862c247a0f43976fb`, 13/13 checks, [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45348821001), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45348821037); squash main `a3a5a5804b8b3d00e80c72e93699e7c4ef61fb04` tree exactly equals the tested head. Exact-main CI pending readback. **v1.47.32 Color candidate IN PROGRESS**: native RGB8 non-separable Color across state/UI, raster and folder clipping stacks, adjustment and clipped raster compositors; editable PSD/PSB `colr`; reject native RGB16/32 or CMYK export before downconversion, preserve document. Initial 3 RED; 35/35 focused Node PASS, build `5f03e37ad8614c70`, genuine Chromium file:// 6 synthetic raster/folder alpha 0/128/255 cases, 12 editable PSD/PSB UI export/reimport paths, mask History and ZPE PASS. All 15 runtime/test/build blobs match local candidate. Full suite and direct Color mode selection UI regression NOT RUN; exact-head Linux CI and independent workflow required. Not Adobe-authored.
> **REMAINING ACCEPTANCE:** Exact-main core and independent CI for #414; Color direct mode-selection UI regression (layer select and Group Properties, Normal -> Color -> Undo/Redo), full native clipped suite, exact PR-head core and independent workflow, merge gates and exact-main verification. Native RGB16/32 and CMYK Color unsupported and fails closed.
> **NEXT IMPLEMENTATION ACTION:** Complete Color direct mode-selection UI regression and full dedicated suite, verify exact-head CI and merge gates; then Hue/Saturation/Luminosity.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference.

## Short queue

1. P1 #414 exact-main acceptance; v1.47.32 Color UI + Linux acceptance.
2. P1 Hue/Saturation/Luminosity.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

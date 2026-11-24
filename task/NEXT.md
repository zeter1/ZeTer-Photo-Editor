# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.31 Color Dodge / Color Burn clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #413 merged, exact-main CI running; #414 local targeted Chrome and Node PASS, remote gates pending.
> **BASE MAIN SHA:** fd88c6cef05d0c94f4d25ec5559a8f7ad8a996e6 (#413 MERGED).
> **ACTIVE PR:** [#414 DRAFT](https://github.com/zeter1/ZeTer-Photo-Editor/pull/414), stacked on merged #413; not yet retargeted.
> **LAST VERIFIED:** 2026-11-24: #413 Soft Light MERGED into main `fd88c6cef05d0c94f4d25ec5559a8f7ad8a996e6`; merged tree `2ffeead4c6baa15ea66fde2af8cd46531d6c5b94` equals tested head `5e7fca96b931e38cbba3bcb8a56e09a29518b893`. All 13 exact-head checks PASS ([core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45346527395), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45346527341)); exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45347436833) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45347436841) IN PROGRESS at readback. #414 remains stacked DRAFT, no remote CI yet. Fresh Windows `node --test tests/clipping-base-composite.test.mjs` 4/4 PASS, `ZPE_DODGE_BURN_CLIPPING_BASE_ONLY=1 npm run test:browser:psd-clipped-raster` exit 0 (18.41 s): 12 scalar raster/folder cases at backdrop alpha 0/128/255, 12 PSD + 12 PSB native editable UI roundtrips, masks, History Undo/Redo and .zpe PASS. Local source, browser fixture and built bundle blob SHAs match #414 head `b15fdb6f5c3322e0cba336a2cf796919683e3f7c`. Full Windows check NOT RUN in this pass. Synthetic, not Adobe-authored. Parent CAP remains IN PROGRESS.
> **REMAINING ACCEPTANCE:** wait for exact #413 merged-main core + independent PASS; reconcile #414 onto main without force push, retarget and repeat exact-head core and independent CI, review/check gates, merge and verify exact-main CI.
> **NEXT IMPLEMENTATION ACTION:** finish #414 acceptance without duplicating the implementation; after bounded acceptance, select next unsupported professional blend mode (Color/Hue/Saturation/Luminosity require state/UI/codec + pixel oracle, not just adding a renderer string), or prioritized data-preservation regression if independently confirmed.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference.

## Short queue

1. P1 #414 Color Dodge/Burn acceptance on current main.
2. P1 native non-separable blend mode vertical slice (begin with Color; validate state/UI, native PSD/PSB, 8-bit pixels, Undo/Redo, .zpe; preserve high-depth fail-closed behavior).
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.31 Color Dodge / Color Burn clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #413 exact-main core and independent PASS; #414 implementation exists, exact-head Linux acceptance required.
> **BASE MAIN SHA:** fd88c6cef05d0c94f4d25ec5559a8f7ad8a996e6 (#413 MERGED).
> **ACTIVE PR:** [#414 OPEN / ready](https://github.com/zeter1/ZeTer-Photo-Editor/pull/414), targets main; mergeable at readback.
> **LAST VERIFIED:** 2026-11-24: #413 bounded Soft Light accepted: exact main `fd88c6cef05d0c94f4d25ec5559a8f7ad8a996e6` [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45347436833), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45347436841). Main tree exactly equals #413 head `5e7fca96b931e38cbba3bcb8a56e09a29518b893` tree. #414 candidate `f65691963e97fbd55eea430e37e59d211d694879` reviewed against that identical tree; reconcile main as a second parent (no force), retain runtime/test/build blobs, retarget to main and request exact-head core/independent gates. Prior Windows test results are historical, not a fresh run. Parent CAP IN PROGRESS; Adobe-authored oracle BLOCKED.
> **REMAINING ACCEPTANCE:** Fresh Windows verification (2026-11-24): six runtime/test/build blob hashes (`src/core/render.js`, browser smoke, bundle, package, version, index) match reconciled PR head `4704ef7a4f31fbef783743e65b5bfc25962d075c`; `node --test tests/clipping-base-composite.test.mjs` 4/4 PASS (prior Difference/Exclusion precision regression); `ZPE_DODGE_BURN_CLIPPING_BASE_ONLY=1 npm run test:browser:psd-clipped-raster` exited 0 (10.75 s), all 12 live raster/folder × mode × backdrop-alpha cases and 24 native editable PSD/PSB UI roundtrips PASS, masks, History, .zpe. Dodge folder alpha 128 x0 [59,202,207,160]; Burn [45,185,193,160]. Full Windows check NOT RUN. PR #414 now targets main, ready, mergeable, zero behind; no workflows/checks observed on the reconciliation head. Publish this evidence on the retargeted branch to request synchronize-event CI; do not merge without both exact-head gates. Exact-head core and independent workflows, review/check gates, guarded merge, exact merged-main CI remain required.
> **NEXT IMPLEMENTATION ACTION:** accept #414; then implement native non-separable Color blend mode across state/UI, PSD/PSB codec and raster/folder clipping rendering, with independent 8-bit RGBA oracle, Undo/Redo, .zpe and high-depth fail-closed preservation.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference.

## Short queue

1. P1 #414 Color Dodge/Burn exact-head acceptance on current main.
2. P1 native non-separable Color blend mode vertical slice; Hue/Saturation/Luminosity follow.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

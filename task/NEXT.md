# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.31 Color Dodge / Color Burn clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #413 exact-main core and independent PASS; #414 implementation exists, exact-head Linux acceptance required.
> **BASE MAIN SHA:** fd88c6cef05d0c94f4d25ec5559a8f7ad8a996e6 (#413 MERGED).
> **ACTIVE PR:** [#414 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/414) — reconcile and retarget to main; no merge before exact-head gates.
> **LAST VERIFIED:** 2026-11-24: #413 bounded Soft Light accepted: exact main `fd88c6cef05d0c94f4d25ec5559a8f7ad8a996e6` [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45347436833), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45347436841). Main tree exactly equals #413 head `5e7fca96b931e38cbba3bcb8a56e09a29518b893` tree. #414 candidate `f65691963e97fbd55eea430e37e59d211d694879` reviewed against that identical tree; reconcile main as a second parent (no force), retain runtime/test/build blobs, retarget to main and request exact-head core/independent gates. Prior Windows test results are historical, not a fresh run. Parent CAP IN PROGRESS; Adobe-authored oracle BLOCKED.
> **REMAINING ACCEPTANCE:** fresh local targeted checks where available, exact #414 head core/independent workflows, review/check gates, guarded merge and exact merged-main CI. Existing Windows evidence: focused Node 24/24, dedicated Chromium exit 0 including 12 new scalar cases and 24 editable native PSD/PSB UI roundtrips, History and .zpe; full Windows check NOT RUN for v1.47.31. Synthetic, not Adobe-authored.
> **NEXT IMPLEMENTATION ACTION:** accept #414; then implement native non-separable Color blend mode across state/UI, PSD/PSB codec and raster/folder clipping rendering, with independent 8-bit RGBA oracle, Undo/Redo, .zpe and high-depth fail-closed preservation.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference.

## Short queue

1. P1 #414 Color Dodge/Burn exact-head acceptance on current main.
2. P1 native non-separable Color blend mode vertical slice; Hue/Saturation/Luminosity follow.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

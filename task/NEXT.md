# NEXT — единая очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY**.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS**; bounded v1.47.22 clipped raster + clipped adjustment increment locally verified, parent Photoshop compositing parity NOT DONE.
> **BASE MAIN SHA:** `fae0d28b7a8d64b93639d27b3d5ee94ff0f58c48` (post-#403 documentation queue commit).
> **ACTIVE PR:** [#404 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/404), branch `feat/psd-clipped-raster-adjustment-20261123`; PR-head core [CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45203823772) and [independent real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45203823897) currently PENDING, not PASS.
> **LAST VERIFIED:** Windows Node focused 16/16 PASS, real Chromium `file://` Multiply/Screen exact RGBA + Group Properties/Undo/Redo/.zpe save/reopen PASS; existing isolated and nested alpha Chromium smoke PASS. PR-head Linux CI PENDING / independent workflow NOT RUN; exact-main CI for v1.47.22 NOT RUN. Previous main `fae0d28` core CI [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45196596659).
> **REMAINING ACCEPTANCE:** PR head core and independent CI, merge and exact-main evidence. Browser PSD/PSB export/reopen of combined nested masked clipped raster + adjustment; varied raster mask coverage and advanced knockout. Licensed Photoshop-authored pixel oracle not available.
> **NEXT IMPLEMENTATION ACTION:** finish v1.47.22 remote PR / CI gates, then add actual UI-native PSD/PSB export and reimport for nested masked Pass Through + clipped raster Multiply/Screen (partial raster mask) → clipped Levels/Invert; compare pixel RGBA and decoded editable group/raster/adjustment structure; preserve .zpe compatibility.
> **BLOCKERS:** licensed Adobe-authored PSD/PSB pixel golden for independent parity, advanced knockout reference; genuine camera DNG+LibRaw independent reference for a separate RAW task. Neither blocks next synthetic/browser vertical slice.

## Короткая очередь

1. **P1 Stage 17a — IN PROGRESS:** close v1.47.22 exact-head remote gates; next native PSD/PSB browser UI roundtrip and partial clipped-raster mask/composition.
2. **P1 CAP-RAW-CAMERA-ORACLE — BLOCKED:** original licensed camera DNG and independent LibRaw/RawTherapee reference.
3. **P2:** Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks — next independent unblocked user-visible slice after Stage 17a bounded acceptance.

[Stage 17a journal](002-psd-folder-group-mask.md) · [Capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

# NEXT — единая очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY**.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** (parent CAP); bounded v1.47.22 #404 and v1.47.23 #405 DONE & MERGED. Full Photoshop pixel parity NOT DONE. A separate Paths-panel visibility hotfix is locally verified.
> **BASE MAIN SHA:** `5d95ef04012dcdaf01669c7d8c644ba9f467301e` (#405 native PSD/PSB Invert merge-main; exact-main core/independent CI in progress at time of UI hotfix authoring).
> **ACTIVE PR:** [#405 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/405) with exact PR-head core and independent workflows SUCCESS (independent attempt 2). Paths visibility hotfix branch `fix/paths-panel-unclipped-20261123`, PR/CI pending publication.
> **LAST VERIFIED:** v1.47.23 [#405](https://github.com/zeter1/ZeTer-Photo-Editor/pull/405) native editable PSD/PSB × Multiply/Screen→Invert 4/4 real Chromium UI paths PASS and focused Node 25/25 PASS; [PR-head core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45214804706) and [independent SUCCESS on attempt 2](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45214804663). Merge-main workflows #45220879684/#45220879665 require independent readback. Paths hotfix: real Chromium RED 234px fixed card/253px content → GREEN four viewport sizes 1280×768, 960×490, 900×700, 720×500; 12 newly-created Saved Paths scroll independently without clipping Operation; existing Path node-edit and Pen boolean browser workflows PASS. Linux PR-head CI for hotfix NOT RUN until publication.
> **REMAINING ACCEPTANCE:** v1.47.23 covers real PSD/PSB native UI roundtrip for synthetic nested masked Pass Through + partially masked clipped raster Multiply/Screen → clipped Invert on translucent blue. Still NOT VERIFIED: exact native **two-adjustment** Levels→Invert chain over transparent/colored backdrops; independently licensed Photoshop-authored pixel golden, advanced knockout.
> **NEXT IMPLEMENTATION ACTION:** implement and browser-verify a *cumulative* clipped Levels → clipped Invert chain after partially masked Multiply/Screen raster in nested Pass Through, exporting/reimporting genuine editable PSD **and** PSB (no flatten) on both transparent and opaque colored backdrops. Assert independent exact RGBA, both editable adjustment records and partial group/raster masks, History Undo/Redo and .zpe Save/reopen; extend existing dedicated `test:browser:psd-clipped-raster` CI gate.
> **BLOCKERS:** licensed Adobe-authored PSD/PSB pixel golden for independent parity, advanced knockout reference; genuine camera DNG+LibRaw independent reference for a separate RAW task. Neither blocks next synthetic/browser vertical slice.

## Короткая очередь

1. **P1 Stage 17a — IN PROGRESS:** v1.47.22 #404 and v1.47.23 #405 MERGED, PR-head core/independent CI SUCCESS. Next cumulative two-adjustment Levels→Invert chain over transparent/opaque backdrops.
2. **P1 UI CAP-PATHS-PANEL-LAYOUT — LOCAL PASS; GitHub hotfix pending:** remove fixed 234px Paths card height and cap inner Saved Paths list; controls «Подпуть» and «Операция» no longer clipped; four real Chromium viewport sizes + 12-path scroll PASS. Branch `fix/paths-panel-unclipped-20261123`.
3. **P1 CAP-RAW-CAMERA-ORACLE — BLOCKED:** original licensed camera DNG and independent LibRaw/RawTherapee reference.
4. **P2:** Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks — next independent unblocked user-visible slice after Stage 17a bounded acceptance.

[Stage 17a journal](002-psd-folder-group-mask.md) · [Capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

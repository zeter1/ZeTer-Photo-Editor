# NEXT — единая очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY**.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** (parent CAP); bounded v1.47.22 clipped raster + adjustment increment DONE & MERGED via #404. Full Photoshop pixel parity NOT DONE.
> **BASE MAIN SHA:** `5aaed6c84202996c265e790faec8ef0976803cf5` (last feature integration #404; before documentation-only readback sync).
> **ACTIVE PR:** none for next vertical slice; [#404 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/404), feature squash commit `5aaed6c84202996c265e790faec8ef0976803cf5`.
> **LAST VERIFIED:** Windows focused Node 16/16 PASS, full Chromium file:// PASS (including exact Multiply/Screen RGBA, Group Properties/Undo-Redo/.zpe save-reopen), Windows full Node 1808: 1793 PASS / 10 SKIP / 5 inherited Linux-only cgroup FAIL; exact PR-head `b35733c895fa29e458d45261099ffb9b74148925` [Linux core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45203929595), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45203929657). Exact code merge-main `5aaed6c84202996c265e790faec8ef0976803cf5` [core CI SUCCESS attempt 2](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45205632371) (attempt 1 failed existing 003T Chromium cgroup hold timeout), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45205632328). Documentation-only sync commit may start separate new CI.
> **REMAINING ACCEPTANCE:** UI-native PSD and PSB export/reimport for this exact nested masked clipped raster + clipped adjustment chain, partial per-overlay raster mask coverage, accurate compositing on transparent/colored backdrops; independently licensed Photoshop-authored pixel golden and advanced knockout are NOT VERIFIED.
> **NEXT IMPLEMENTATION ACTION:** add actual UI-native PSD and PSB export/reimport for nested masked Pass Through + clipped raster Multiply/Screen with partial raster mask → clipped Levels/Invert over semitransparent backdrop. Assert independent exact RGBA 100/50/0% group coverage, native editable group/mask/raster/adjustment records (no flatten), correct History Undo/Redo and .zpe save/reopen. Add dedicated CI gate and retain existing v1.47.22 regressions.
> **BLOCKERS:** licensed Adobe-authored PSD/PSB pixel golden for independent parity, advanced knockout reference; genuine camera DNG+LibRaw independent reference for a separate RAW task. Neither blocks next synthetic/browser vertical slice.

## Короткая очередь

1. **P1 Stage 17a — IN PROGRESS:** v1.47.22 #404 MERGED with CI PASS; next native PSD/PSB browser UI roundtrip and partial clipped-raster-mask/clipped-adjustment composition.
2. **P1 CAP-RAW-CAMERA-ORACLE — BLOCKED:** original licensed camera DNG and independent LibRaw/RawTherapee reference.
3. **P2:** Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks — next independent unblocked user-visible slice after Stage 17a bounded acceptance.

[Stage 17a journal](002-psd-folder-group-mask.md) · [Capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

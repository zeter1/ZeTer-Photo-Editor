# NEXT — единая очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY**.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** (parent CAP); bounded v1.47.22 #404 DONE & MERGED; new v1.47.23 native UI roundtrip and editable Invert verified locally. Full Photoshop pixel parity NOT DONE.
> **BASE MAIN SHA:** `ccdce114a455d90e2974d7f87749b4b9f5d25980` (exact main after #404 documentation readback; core CI SUCCESS #45207654316).
> **ACTIVE PR:** new branch `feat/psd-ui-roundtrip-masked-clipping-20261123` for v1.47.23; remote PR/CI NOT RUN until publication. Previous [#404 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/404).
> **LAST VERIFIED:** new v1.47.23 focused Node Invert/PSD clipping 14/14 PASS and real Chromium file:// native UI PSD+PSB × Multiply/Screen 4/4 paths PASS with partial overlay mask, exact 4×2 RGBA, native editable groups/Invert, Group Properties/History Undo-Redo/.zpe reopen. Prior main `ccdce114` [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45207654316); #404 [PR-head core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45203929595), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45203929657), [code merge-main core SUCCESS attempt 2](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45205632371), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45205632328). New PR-head and exact-merge-main CI must be checked independently.
> **REMAINING ACCEPTANCE:** v1.47.23 covers real PSD/PSB native UI roundtrip for synthetic nested masked Pass Through + partially masked clipped raster Multiply/Screen → clipped Invert on translucent blue. Still NOT VERIFIED: exact native **two-adjustment** Levels→Invert chain over transparent/colored backdrops; independently licensed Photoshop-authored pixel golden, advanced knockout.
> **NEXT IMPLEMENTATION ACTION:** implement and browser-verify a *cumulative* clipped Levels → clipped Invert chain after partially masked Multiply/Screen raster in nested Pass Through, exporting/reimporting genuine editable PSD **and** PSB (no flatten) on both transparent and opaque colored backdrops. Assert independent exact RGBA, both editable adjustment records and partial group/raster masks, History Undo/Redo and .zpe Save/reopen; extend existing dedicated `test:browser:psd-clipped-raster` CI gate.
> **BLOCKERS:** licensed Adobe-authored PSD/PSB pixel golden for independent parity, advanced knockout reference; genuine camera DNG+LibRaw independent reference for a separate RAW task. Neither blocks next synthetic/browser vertical slice.

## Короткая очередь

1. **P1 Stage 17a — IN PROGRESS:** v1.47.22 #404 MERGED with CI PASS; v1.47.23 local browser-native PSD/PSB × Multiply/Screen/Invert with partial overlay mask PASS, publication/PR-head CI pending. Next two-adjustment Levels→Invert across transparent/opaque backgrounds.
2. **P1 CAP-RAW-CAMERA-ORACLE — BLOCKED:** original licensed camera DNG and independent LibRaw/RawTherapee reference.
3. **P2:** Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks — next independent unblocked user-visible slice after Stage 17a bounded acceptance.

[Stage 17a journal](002-psd-folder-group-mask.md) · [Capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

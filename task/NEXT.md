# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** — nested clipped adjustments / translucent backdrop.
> **PRIORITY:** P1; **STATUS:** **IN PROGRESS** (bounded v1.47.21 candidate, not merged).
> **ACTIVE PR:** [#403 — nested clipped adjustments](https://github.com/zeter1/ZeTer-Photo-Editor/pull/403); branch `feat/psd-nested-translucent-20261123`, exact base main `ef6070090907b45904da6bda81f793f73f298ffd`. Do not repeat #401/#402 (already MERGED).
> **IMPLEMENTED:** clipped Invert runs against its translucent clipping base, not the flattened backdrop; premultiplied RGB delta preserves parent alpha. Consecutive clipped adjustments maintain cumulative adjusted base colors with unchanged clipping alpha. Nested masked Pass Through over semitransparent backdrop and group opacity covered by exact RGBA Chromium.
> **LOCAL GREEN:** new translucent nested Chrome file:// `[0,170,255,192]`, `[0,102,255,160]`, `[0,0,255,128]`; Group Properties mask, Undo/Redo and native .zpe reopen PASS. Existing real Chrome Levels → Curves clipped stack PASS after correcting isolated half-opacity gray expected 64 (previous 96 reflected old incorrect compositing). PSD/PSB native editable records verified by codec tests. Windows full browser PASS before the stacking fix; targeted browser both PASS after fix. Windows full Node 1800 / 1785 PASS / 10 SKIP / 5 pre-existing Linux-only harness FAIL before follow-up.
> **REMOTE GATE:** first PR head `7d980e63d83b674c671c7a2f8187ec54f9dcad3c` Linux `verify` FAILED at `Adjustment stack / nested groups / clipping...` (not ignored). Reproduced locally and fixed cumulative adjustment stack; dedicated translucent nested browser smoke added as CI step. Publish corrected follow-up head, require exact-head core CI + independent real-photo SUCCESS before merge; re-read resulting main SHA and queues. Do NOT claim first head green.
> **NEXT IMPLEMENTATION AFTER GATES:** RED→GREEN 50%-alpha clipping base + **clipped raster overlay** in Multiply/Screen + subsequent clipped adjustment, nested masked Pass Through over semitransparent background. Preserve clipping-base alpha, stack order, parent backdrop, and editable PSD/PSB records. Real RGBA, mask/History and .zpe re-open. Do not merely re-profile.
> **BLOCKED INDEPENDENT ACCEPTANCE:** licensed Photoshop-authored pixel golden, knockout and complex blend parity; unrelated genuine camera DNG/LibRaw oracle blocked. No claim of full Adobe parity.

## Короткая очередь

1. **P1 Stage 17a IN PROGRESS:** gate + integrate [#403](https://github.com/zeter1/ZeTer-Photo-Editor/pull/403); then clipped **raster** + adjusted chain.
2. **P1 CAP-RAW-CAMERA-ORACLE BLOCKED:** licensed camera original DNG and independent LibRaw/RawTherapee reference.
3. **P2:** Tiled Worker, ICC and vector mask professional slices only after higher-priority unblocked work.

[Stage17a journal](002-psd-folder-group-mask.md) · [capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

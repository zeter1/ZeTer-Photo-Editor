# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.30 Soft Light raster and isolated folder clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - #412 merged-main core/independent PASS; #413 ready, exact new head CI required.
> **BASE MAIN SHA:** 72e49f9f8b244aded1ffa5ff435cc8664691ef8c (#412 merged; core and independent PASS).
> **ACTIVE PR:** [#413 OPEN / ready](https://github.com/zeter1/ZeTer-Photo-Editor/pull/413), retargeted to main.
> **LAST VERIFIED:** #412 MERGED into main `72e49f9f8b244aded1ffa5ff435cc8664691ef8c` (squash tree identical to exact tested head `edb1dfd30332b1666efc72494fee9afb64312478`); all 13 PR-head checks SUCCESS ([core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45343740305), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45343740464)). Exact merged-main core and independent SUCCESS (runs 45344816968 / 45344816918). #413 v1.47.30 candidate `9c8bb6e9210189b5a6605bba9e9e2c031b81aeae`: eight runtime/test/build blob SHAs match local commit `6168589515576432f6ee4abb5e5905f8e542453d`; fresh Windows Node precision 4/4 PASS and targeted real Chromium file:// Soft Light 6 raster/folder x alpha cases, 12 editable native PSD/PSB export/reimport paths, masks, History and .zpe PASS (exit 0). Prior full dedicated 124 roundtrips PASS; prior full Windows check FAIL (1800 PASS / 10 SKIP / 5 Linux-only cgroup FAIL). No runtime changes in this handoff. Synthetic, not Adobe-authored.
> **REMAINING ACCEPTANCE:** exact new PR-head core/independent CI, required checks/review and mergeability; guarded merge and exact merged-main CI. Adobe-authored oracle and knockout remain open.
> **NEXT IMPLEMENTATION ACTION:** accept #413 exact-head gates; independently develop Color Dodge / Color Burn with raster/folder alpha 0/128/255, editable PSD/PSB, History and .zpe.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 #412 exact-main acceptance; #413 Soft Light retarget, exact-head and merged-main gates.
2. P1 Color Dodge / Color Burn clipping bases (raster and isolated folders).
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

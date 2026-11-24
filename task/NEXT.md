# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.30 Soft Light raster and isolated folder clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - #412 MERGED, exact merged-main gates PENDING/PENDING; #413 local targeted PASS, remote gates not accepted.
> **BASE MAIN SHA:** 72e49f9f8b244aded1ffa5ff435cc8664691ef8c (#412 MERGED; [core PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45344816968), [independent PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45344816918)).
> **ACTIVE PR:** [#413 DRAFT](https://github.com/zeter1/ZeTer-Photo-Editor/pull/413), prior tested head 9c8bb6e9210189b5a6605bba9e9e2c031b81aeae; this handoff reconciles exact merged-main ancestry with unchanged runtime blobs.
> **LAST VERIFIED:** #412 MERGED into main `72e49f9f8b244aded1ffa5ff435cc8664691ef8c` (squash tree identical to exact tested head `edb1dfd30332b1666efc72494fee9afb64312478`); all 13 PR-head checks SUCCESS ([core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45343740305), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45343740464)). Exact merged-main [core PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45344816968), [independent PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45344816918) at readback. #413 v1.47.30 candidate `9c8bb6e9210189b5a6605bba9e9e2c031b81aeae`: eight runtime/test/build blob SHAs match local commit `6168589515576432f6ee4abb5e5905f8e542453d`; fresh Windows Node precision 4/4 PASS and targeted real Chromium file:// Soft Light 6 raster/folder x alpha cases, 12 editable native PSD/PSB export/reimport paths, masks, History and .zpe PASS (exit 0). Prior full dedicated 124 roundtrips PASS; prior full Windows check FAIL (1800 PASS / 10 SKIP / 5 Linux-only cgroup FAIL). No runtime changes in this handoff. Synthetic, not Adobe-authored.
> **REMAINING ACCEPTANCE:** confirm #412 exact merged-main both workflows SUCCESS; retarget #413 to main, mark ready, verify diff and all exact-head core/independent checks; guarded merge and exact merged-main CI. Adobe-authored group clipping parity and advanced knockout not accepted.
> **NEXT IMPLEMENTATION ACTION:** finish existing #413 gates, then extend clipping-base source-stack to Color Dodge / Color Burn with independent scalar boundary and mixed-alpha RGBA oracle, native PSD/PSB UI roundtrip, masks, History and .zpe; no tolerance relaxation.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 #412 exact-main acceptance; #413 Soft Light retarget, exact-head and merged-main gates.
2. P1 Color Dodge / Color Burn clipping bases (raster and isolated folders).
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

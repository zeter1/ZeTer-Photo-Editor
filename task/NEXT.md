# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** / v1.47.29 Difference/Exclusion clipping-base precision.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - #412 exact-head gates running; #413 integrated with precision fix, dedicated Chromium PASS, remains draft.
> **BASE MAIN SHA:** f19acac380fda7e753bba441b799b0ba6926bed3 (#411 MERGED; [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45340962101), [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45340962140)).
> **ACTIVE PR:** [#412](https://github.com/zeter1/ZeTer-Photo-Editor/pull/412); dependent [#413 DRAFT](https://github.com/zeter1/ZeTer-Photo-Editor/pull/413).
> **LAST VERIFIED:** Linux core on old head `7b4cd3fad894c530632c27d8a606997ae8de1cd8` [FAIL](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45341076229) (Exclusion folder, alpha 128, x3 blue expected 188, actual 185); [independent SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45341076234). Corrected raster and isolated folder final blend uses tiled straight RGBA source-over with Difference/Exclusion, no tolerance change. Windows actual x3 [61,171,188,160], targeted and full dedicated Chromium PASS (24/112 native editable PSD/PSB roundtrips, History, .zpe), 4 new Node RED→GREEN, 23/23 focused PASS, build df2b499a58c712be. New head Linux core + independent acceptance pending; full Windows check FAIL: 1815 tests / 1800 PASS / 10 SKIP / 5 known Linux-only cgroup failures (same two suites as before). Local code commit ea20f81; staged diff hygiene PASS after removing trailing test blank line. Synthetic, not Adobe-authored. #413 remains stacked draft.
> **INTEGRATED DEPENDENT EVIDENCE:** Integrated v1.47.30 on the exact #412 precision head edb1dfd30332b1666efc72494fee9afb64312478: build 6f5ed8c3df7ce0ce, four precision unit tests PASS, full dedicated Windows Chromium file:// exit 0 (124 native editable PSD/PSB UI roundtrips including Soft Light and Difference/Exclusion; masks, History, .zpe, unchanged +/-2 oracle). Full Windows check running at authoring; Linux PR-head and merged-main gates NOT ACCEPTED. Synthetic, not Adobe-authored.
> **REMAINING ACCEPTANCE:** verify new #412 exact-head core and independent CI, review/merge gates, exact merged-main CI. Do not merge on old checks. #413 reconciliation implemented on #412 head; retarget to main after predecessor gates and verify integrated exact-head CI.
> **NEXT IMPLEMENTATION ACTION:** finish #412 Linux exact-head acceptance (original failing Exclusion pixel must pass ±2 unchanged); then retarget integrated Soft Light #413 to accepted main and run exact gates.
> **BLOCKERS:** licensed Photoshop-authored group clipping golden/knockout reference; genuine camera DNG + LibRaw independent reference.

## Short queue

1. P1 #412 precision fix acceptance, guarded merge and exact-main CI.
2. P1 #413 Soft Light - integrated on #412 precision head; verify exact merged-main ancestry and both remote workflows.
3. P1 CAP-RAW-CAMERA-ORACLE - BLOCKED (licensed original DNG + LibRaw reference).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

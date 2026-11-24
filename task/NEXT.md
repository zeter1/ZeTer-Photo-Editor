# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / Color v1.47.32 acceptance → Hue v1.47.33 stacked integration.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #415 Color OPEN; Hue implemented and locally tested on dependent branch, not main.
> **BASE MAIN SHA:** a3a5a5804b8b3d00e80c72e93699e7c4ef61fb04 (#414 MERGED, exact-main core + independent PASS).
> **ACTIVE PR:** [#415 Color](https://github.com/zeter1/ZeTer-Photo-Editor/pull/415), dependency; [Hue branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/psd-hue-blend-20261124) stacked on exact Color head.
> **LAST VERIFIED:** 2026-11-24 — **v1.47.33 Hue, bounded RGB8 implementation, IN PROGRESS (stacked candidate, not main).** Source hue + backdrop saturation/luma via non-separable SetSat/SetLum; state, raster/group UI, isolated clipping stacks, clipped raster/adjustment and native PSD/PSB `hue ` key; native RGB16/32/CMYK fails closed. Node RED 3/3 → GREEN, focused 11/11 including Color and Difference/Exclusion regressions, version 1/1 PASS. Build `7f0537eb9b3d8049`. Real Windows Chromium file:// targeted 6 alpha/owner cases + 12 PSD/PSB editable roundtrips, then full dedicated suite 172 editable roundtrips, 8 direct layer/folder mode switches + Undo/Redo (4 Hue + 4 Color), mask and .zpe save/reopen, exit 0 (64.27s). Windows full check 1822 tests: 1807 PASS / 10 SKIP / 5 FAIL (Linux-only cgroup/proc); overall FAIL. All 16 changed source/test/build/public-version blobs reconstructed from exact Color parent and verified equal to local Git blob SHA. #415 Color gate pending on `f960d582a869ff08b22445e47fbe7515256300b6`, initial head verify FAIL only due CHANGELOG marker. #414 main core and independent PASS. Branch metadata protected=false; rulesets empty. Hue CI NOT RUN; stacked PR needs retarget to main after #415 accepted. Adobe-authored reference and native high-depth Hue remain unaccepted.
> **REMAINING ACCEPTANCE:** Color fresh [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45351179185) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45351178498) on f960d582; guarded merge + exact main CI. Reconcile Hue with accepted main without force, verify runtime blob equality, retarget stacked PR, fresh exact-head Linux core and independent, guarded merge + exact-main CI.
> **NEXT IMPLEMENTATION ACTION:** Complete #415 acceptance first, then accept the existing Hue implementation, no duplicate. Next new mode: Saturation (source saturation, backdrop hue/luma), then Luminosity; preserve Color/Hue regression and native high-depth fail-closed.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native RGB16/32/CMYK non-separable math not implemented.

## Short queue

1. P1 Color #415 exact-head and main gates, then existing Hue stacked candidate.
2. P1 Saturation, then Luminosity.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

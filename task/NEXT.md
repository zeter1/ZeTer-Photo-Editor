# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / bounded native RGB16 Multiply and Screen v1.47.43.
> **PRIORITY:** P1 HIGH native precision.
> **STATUS:** IN PROGRESS - functional candidate implemented; local targeted and full dedicated browser PASS; remote acceptance pending.
> **BASE MAIN SHA:** 0c7aef4c5fc490a52144b4bb803937cb22f3d020 (tree c5466653609626036c63c8ca438330ee74d693f2).
> **ACTIVE CANDIDATE:** [feat/psd-rgb16-isolated-multiply-screen-20261124](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/psd-rgb16-isolated-multiply-screen-20261124); candidate branch/PR, not main.
> **LAST VERIFIED MAIN:** [#424](https://github.com/zeter1/ZeTer-Photo-Editor/pull/424) MERGED, 093f961ad67341feb673ec661cd0b15423b551ee, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45377600104), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45377600481).
> **RECOVERY MERGED:** [#124](https://github.com/zeter1/ZeTer-Photo-Editor/pull/124), head 4bafde2edaf8a2d9377fa1d6c9c09f973b452908, 13/13 checks, [core PASS attempt 2](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45377953912), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45377953886), exact merge tree identical to head. Separate merged-main CI pending readback; close #115 only after exact-main acceptance. Preparation failure fault-injected, previous snapshot preserved; no gate weakened.
> **IMPLEMENTATION:** Native sRGB16 Multiply/Screen root isolated folder, bounded contiguous raster children; opacity, straight alpha, prepared raster mask applied once. Exact editable layer/folder and PSD/PSB merged words. Explicit rejection of unsupported native precision/topology, not Canvas8 fallback.
> **EVIDENCE:** RED 8/10 -> GREEN; 55/55 focused incl. recovery/version PASS; build 5990f57711063b89. Chromium file:// both group mode sets, preview, Properties, History, .zpe, exact PSD/PSB and editable reimport PASS; full dedicated browser PASS exit 0. Windows full check FAIL 5 existing Linux-only proc/cgroup tests (1866 total / 1851 PASS / 10 SKIP).
> **REMAINING ACCEPTANCE:** Recovery exact-main core/independent; candidate exact-head core/independent, review/protection and merge gates, then exact-main CI. Do not mark accepted until verified; rollback by ordinary revert.
> **NEXT ACTION:** Read candidate PR exact-head core and independent checks, and recovery exact-main CI; fix persistent failures without weakening tests. Close #115 after recovery exact-main PASS. Merge candidate only when required gates pass, then verify exact-main separately.
> **NEXT IMPLEMENTATION ACTION:** After bounded Multiply/Screen accepted, extend the same typed isolated-group path to Overlay/Hard Light with independent exact-word oracle (partial alpha, mask, reversed source/backdrop branch, negative topology), actual group Properties/History/.zpe/PSD/PSB roundtrip.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; nested/pass-through/clipping/adjustments/Float32/CMYK remain outside this bounded native contract.

## Short queue

1. P1 HIGH verify #124 exact merged-main core and independent, close #115 if PASS.
2. P1 Bounded RGB16 Multiply/Screen folder candidate exact head/main acceptance.
3. P1 Overlay/Hard Light native isolated RGB16 group.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

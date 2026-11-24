# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / native RGB16 group modes v1.47.41.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — bounded implementation, local focused and targeted browser PASS; acceptance pending.
> **BASE MAIN SHA:** 42b0afe49a69a444b5e008da7d9a48801620a20d.
> **ACTIVE CANDIDATE:** feat/psd-rgb16-group-modes-20261124 (v1.47.41).
> **LAST VERIFIED MAIN:** [PR #423](https://github.com/zeter1/ZeTer-Photo-Editor/pull/423) MERGED: exact main 42b0afe49a69a444b5e008da7d9a48801620a20d, tree 7ff5a220bcac5228f36da507ee69116dcb9a0b67; [main core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45373971603), [main independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45373971594), [head core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45372462430), [head independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45372462342).
> **IMPLEMENTATION:** Single root isolated group, contiguous encoded sRGB16 native raster children, group Color/Hue/Saturation/Luminosity against parent backdrop; opacity, prepared mask and straight alpha applied once. Nested/pass-through/unsupported group blends, clipping, adjustment, vector mask, transforms, mixed precision, ICC/Float32/CMYK remain fail-closed for non-separable export. Synthetic native oracle, not Adobe-authored.
> **EVIDENCE:** RED 5/6 -> GREEN 6/6, expanded native RGB16 and version suite 31/31 PASS; build f67082805a7f916e. Targeted Chromium file://: all four group Properties modes, pixels, Undo/Redo, .zpe save/reopen, PSD/PSB exact merged words and editable group/layers PASS. PSB after PSD reimport explicitly uses 128/255 folder opacity. Full dedicated Chromium regression PASS (exit 0); Windows full check: 1859 total, 1844 PASS / 10 SKIP / 5 FAIL (existing Linux cgroup/proc checks); GitHub candidate CI NOT RUN.
> **NEXT ACTION:** Publish exact candidate tree via GitHub PR, verify exact head core/independent + review/protection gates; only then merge and verify exact-main workflows.
> **NEXT IMPLEMENTATION ACTION:** Check independent recovery candidate/PR #124 against actual main (serialization failure, preserve previous snapshot) before any new P1 work; do not duplicate local concurrent recovery work. After acceptance, extend native RGB16 isolated groups to supported separable group blend modes with independent exact-word alpha/mask/topology tests.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; native nesting/pass-through/clipping/adjustments/Float32/CMYK not accepted.

## Short queue

1. P1 Accept isolated RGB16 non-separable group modes v1.47.41 on exact head/main.
2. P0/P1 Recovery serialization failure (#124 / separate local candidate; reconcile actual PR, baseline and preserve prior snapshot).
3. P1 Bounded native RGB16 isolated separable group modes.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

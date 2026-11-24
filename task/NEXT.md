# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / five remaining bounded separable RGB16 folder modes v1.47.45.
> **PRIORITY:** P1 HIGH native precision.
> **STATUS:** IN PROGRESS — #427 candidate reconciled with accepted main; fresh exact-head acceptance required.
> **LAST VERIFIED MAIN:** [#426](https://github.com/zeter1/ZeTer-Photo-Editor/pull/426) ACCEPTED at f5354164bbcc239f10d3987f09efd229b42e4b6e, tree 8c3b13e6d7da99ac8f00bc3ff83c6cac7b49824c; [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45396060659), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45396060528).
> **BASE MAIN SHA:** f5354164bbcc239f10d3987f09efd229b42e4b6e (tree identical to original #426 head).
> **ACTIVE CANDIDATE:** [#427](https://github.com/zeter1/ZeTer-Photo-Editor/pull/427), feat/psd-rgb16-isolated-five-separable-20261124; original tested runtime tree 6c6ca9211a1a92e7b317f65779752dbd96ac2b1f. Only queue/journal metadata changed during integration.
> **IMPLEMENTATION:** Darken/Lighten/Difference/Exclusion/Soft Light routed through shared typed compositor in the same bounded single root isolated contiguous encoded sRGB16 raster folder. Exact merged PSD/PSB words and editable native layers/groups; straight alpha, opacity and prepared raster mask once. Unsupported topology/precision fails closed.
> **EVIDENCE:** RED 14/17 -> GREEN 17/17; build d3f13fff0b7d3776. Targeted Chromium file:// four mode sets, actual Properties/preview, History, .zpe, exact PSD/PSB Soft Light composite and editable reimport PASS exit 0; word-domain synthetic oracle covers all five modes. Windows npm run check FAIL: 1872 total / 1857 PASS / 10 SKIP / 5 existing Linux-only proc/cgroup FAIL; no gate weakened. Full dedicated Chromium PASS exit 0 (78.42s).
> **NEXT ACTION:** Fresh exact-head core + independent CI for #427 against main; verify all checks, reviews and current head/base, guarded merge, separate exact-main CI. Main branch readback: protected=false, protection.enabled=false; rulesets empty. Never merge red/pending.
> **NEXT IMPLEMENTATION ACTION:** Existing [#428](https://github.com/zeter1/ZeTer-Photo-Editor/pull/428) Color Dodge/Burn candidate, head 566ec2ce9c0ebcd81f739c29e9811359c9a805a0, depends on #427. After #427 exact-main acceptance, reconcile without force and retarget #428; fresh exact-head gates. Do not duplicate its implementation.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; nested/pass-through/clipping/adjustments/ICC/Float32/CMYK outside bounded native contract.

## Short queue

1. P1 #427 exact-head/main acceptance on accepted #426 main.
2. P1 #428 forward integration and exact-head/main acceptance; no duplicate implementation.
3. P1 Native RGB16 Normal-only isolated raster folder: local v1.47.47 candidate, not published; original #428 base tree ab3476adf3987475ec66de36e4a13a50c684b5bf. Reproduced Canvas8 fallback without special blend trigger (RED 0/1); eligible native routing GREEN 20/20, adjacent precision/version 14/14, build 5dcfd7485de2c0cd. Browser and wide gates remain required. Integrate after #428 acceptance; preserve existing explicit fallback outside eligible scope.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

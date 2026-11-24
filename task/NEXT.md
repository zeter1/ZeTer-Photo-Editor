# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / five remaining bounded separable RGB16 folder modes v1.47.45.
> **PRIORITY:** P1 HIGH native precision.
> **STATUS:** IN PROGRESS - dependent candidate, not accepted.
> **LAST VERIFIED MAIN:** [#425](https://github.com/zeter1/ZeTer-Photo-Editor/pull/425) MERGED d2e449cd6e834e9c922a46ce806e6949e31f29f4, tree fbb50b671382b655b67172b0435ff747acdba85d; [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45391479624), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45391479743). Recovery #124 accepted, [#115 CLOSED](https://github.com/zeter1/ZeTer-Photo-Editor/issues/115).
> **PREDECESSOR:** [#426](https://github.com/zeter1/ZeTer-Photo-Editor/pull/426) OPEN Overlay/Hard Light, base d2e449cd6e834e9c922a46ce806e6949e31f29f4, head c17314f7e5aef027651a46e1adf2ca27bf62ef96, tree 8c3b13e6d7da99ac8f00bc3ff83c6cac7b49824c; [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45392483434) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45392483196) PENDING at readback. Classic branch protection read 403; no merge until gates known and satisfied.
> **ACTIVE CANDIDATE:** feat/psd-rgb16-isolated-five-separable-20261124, dependent base #426 exact head above (not main).
> **IMPLEMENTATION:** Darken/Lighten/Difference/Exclusion/Soft Light routed through shared typed compositor in the same bounded single root isolated contiguous encoded sRGB16 raster folder. Exact merged PSD/PSB words and editable native layers/groups; straight alpha, opacity and prepared raster mask once. Unsupported topology/precision fails closed.
> **EVIDENCE:** RED 14/17 -> GREEN 17/17; build d3f13fff0b7d3776. Targeted Chromium file:// four mode sets, actual Properties/preview, History, .zpe, exact PSD/PSB Soft Light composite and editable reimport PASS exit 0; word-domain synthetic oracle covers all five modes. Windows npm run check FAIL: 1872 total / 1857 PASS / 10 SKIP / 5 existing Linux-only proc/cgroup FAIL; no gate weakened. Full dedicated Chromium PASS exit 0 (78.42s).
> **NEXT ACTION:** Verify #426 exact-head core/independent and review/protection gates, merge only when satisfied, then verify exact-main. Rebase/forward-port dependent candidate onto accepted main without overwriting concurrent work; fresh exact-head core/independent, required checks and guarded merge, exact-main verification. Never merge the dependent candidate into unaccepted predecessor.
> **NEXT IMPLEMENTATION ACTION:** Color Dodge/Burn bounded native RGB16 folder; explicitly verify existing compositor endpoint precedence (black backdrop/white source, white backdrop/black source), clipping and denominators against an independent reference before enabling; partial alpha, prepared mask, topology/precision refusal, Group Properties/History/.zpe/PSD/PSB raw words. Split only for demonstrated risk.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; nested/pass-through/clipping/adjustments/ICC/Float32/CMYK outside bounded native contract.

## Short queue

1. P1 #426 exact head/main acceptance; verify branch protection and review gates.
2. P1 Five separable modes dependent candidate exact head/main acceptance after #426.
3. P1 Color Dodge/Burn independent endpoint validation and bounded native folder support.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

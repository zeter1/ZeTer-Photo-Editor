# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / bounded native RGB16 isolated Normal group v1.47.40.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — #422 accepted; #423 implemented, exact-head CI pending at readback.
> **BASE MAIN SHA:** 14fc1e7daa7ec842d867929d2a2cc8f684effe3a.
> **LAST VERIFIED MAIN:** Luminosity #422 [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45371666623), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45371667034).
> **ACTIVE CANDIDATE:** [#423](https://github.com/zeter1/ZeTer-Photo-Editor/pull/423), head 8b2ba864accf91d22a5ac305f4b9a75d9c00859e. Local dedicated Chromium 206 cases PASS as recorded by candidate; exact-head [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45372462430) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45372462342) pending at readback. Do not merge until all gates pass, then verify exact merged-main CI.
> **INDEPENDENT CANDIDATE:** issue #115 / [existing PR #124](https://github.com/zeter1/ZeTer-Photo-Editor/pull/124), v1.47.41 recovery preparation, exact main tree 8e4f6ac68718ddcf171bac8eb68656695760eb93. RED 0/4 -> GREEN 29/29 recovery tests; build a5c4858e9bcc5813; Windows full check 1855 total / 1840 PASS / 10 SKIP / 5 Linux proc/cgroup FAIL. Browser and exact-head Linux gates required; no weakened gates. Fault injection confirms the previous snapshot survives a failed preparation and late write outcomes do not unlock retry; not a natural malformed UI document reproduction. Reconcile shared version/bundle/task files after #423, regenerate and retest. No duplicate PR; update #124 preserving history.
> **NEXT IMPLEMENTATION ACTION:** After #423 acceptance and recovery integration, extend bounded native RGB16 composition to isolated group blend modes (Color/Hue/Saturation/Luminosity against parent backdrop) with independent exact native words, opacity/mask, UI/History/.zpe and PSD/PSB roundtrip. Keep unsupported nesting/pass-through/clipping/adjustments fail closed.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; native non-Normal group/nesting/clipping/adjustments/Float32/CMYK not accepted.

## Short queue

1. P1 Isolated Normal RGB16 group #423 exact-head and exact-main acceptance.
2. P2 (HIGH data safety) Recovery #115/#124: reconcile with accepted main, run mandatory gates and accept.
3. P1 Native RGB16 non-separable blend on isolated group against parent backdrop.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

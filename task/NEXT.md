# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / Saturation v1.47.34 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — Hue #416 MERGED, Saturation #417 candidate.
> **BASE MAIN SHA:** a0f1b488a96f68fbc30242b7460216ffb7cf040d.
> **ACTIVE PR:** [#417 Saturation](https://github.com/zeter1/ZeTer-Photo-Editor/pull/417).
> **LAST VERIFIED:** 2026-11-24 — #415 exact-main [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353319761) and [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353319695). #416 exact head b60811da92f0056c1693985ce2a411b2181bace4 13/13 checks PASS ([core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353437111), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353437206)); squash main tree identical. Exact new main core [IN PROGRESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354421590) and independent [IN PROGRESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354421602). Saturation original head 76bcc27f3309e2a17c5729ebfefb488d661c48ce: prior local focused 14/14, version 1/1, dedicated Chromium 184 editable PSD/PSB roundtrips PASS; full check NOT RUN. Runtime tree retained; #417 retargeted to main and ready, clean, zero conflicts. No checks yet observed on the reconciled head. This queue update requests synchronize CI. New independent Luminosity local 1.47.35: RED 0/3 → GREEN, 17/17 focused, version 1/1, build d6f439c79f3198a9, targeted real file:// 12 native editable roundtrips and four direct mode changes/History/.zpe PASS; full suite NOT RUN. Not yet published.
> **REMAINING ACCEPTANCE:** Verify Hue exact-main core + independent, #417 exact reconciled head core/independent and checks/review, merge then exact-main CI.
> **NEXT IMPLEMENTATION ACTION:** Complete #417 and implement RGB8 Luminosity (source luma, backdrop hue/saturation) with UI, native PSD/PSB lum key, clipping and adjustment compositors, undo/redo, ZPE, independent RGBA oracle, native high-depth fail-closed.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; RGB16/32/CMYK non-separable math unimplemented.

## Short queue

1. P1 Saturation #417 exact-head and exact-main gates.
2. P1 Luminosity.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

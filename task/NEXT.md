# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / Hue v1.47.33 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — Color #415 MERGED; Hue #416 OPEN, ready, exact-head gates required.
> **BASE MAIN SHA:** eeacad5e9475b56dcabf0ca3bf84ca4d289c7d2d.
> **ACTIVE PR:** [#416 Hue](https://github.com/zeter1/ZeTer-Photo-Editor/pull/416).
> **LAST VERIFIED:** 2026-11-24 — #415 Color MERGED (exact head `f960d582a869ff08b22445e47fbe7515256300b6`, 13/13 checks PASS, [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45351179185), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45351178498)). Exact main `eeacad5e9475b56dcabf0ca3bf84ca4d289c7d2d` tree identical to tested Color head; [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353319761) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45353319695) queued at readback. #416 Hue reconciled with accepted main without force, unchanged tested Hue tree `98496e26068bf3d79184dd2a8dd92daf0b94e1b6`, retargeted to main, ready and mergeable. Exact new head gates required; prior Windows tests historical. Parent CAP IN PROGRESS.
> **REMAINING ACCEPTANCE:** Fresh exact-head Linux core and independent workflow, guarded merge and exact-main CI. Prior local Hue focused Node 11/11, version 1/1 and dedicated Chromium 172 native editable roundtrips PASS; full Windows check FAIL (1807 PASS / 10 SKIP / 5 Linux-only cgroup FAIL). Synthetic, not Adobe-authored.
> **NEXT IMPLEMENTATION ACTION:** Accept #416 without duplicate implementation. Implement independent RGB8 Saturation vertical slice (source saturation, backdrop hue/luma) and then Luminosity, preserving Color/Hue regression and native high-depth fail-closed.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native RGB16/32/CMYK non-separable math unimplemented.

## Short queue

1. P1 Hue #416 exact-head and main gates.
2. P1 Saturation, then Luminosity.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

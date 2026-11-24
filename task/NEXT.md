# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / bounded native RGB16 Overlay and Hard Light v1.47.44.
> **PRIORITY:** P1 HIGH native precision.
> **STATUS:** IN PROGRESS — functional candidate; RED→GREEN, targeted and full dedicated Chromium PASS; remote acceptance pending.
> **BASE MAIN SHA:** d2e449cd6e834e9c922a46ce806e6949e31f29f4 (tree fbb50b671382b655b67172b0435ff747acdba85d).
> **LAST VERIFIED MAIN:** #124 MERGED 0c7aef4c5fc490a52144b4bb803937cb22f3d020, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45389420787), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45389421025). Issue [#115 CLOSED](https://github.com/zeter1/ZeTer-Photo-Editor/issues/115).
> **MERGED CANDIDATE:** [#425](https://github.com/zeter1/ZeTer-Photo-Editor/pull/425) v1.47.43, head b593ab108ceb352a5246286c763a97e1d29c50dd, 13/13 checks, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45389832066), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45389832045). Squash merged as d2e449cd6e834e9c922a46ce806e6949e31f29f4, tree equal to verified head; separate [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45391479624) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45391479743) pending at readback.
> **ACTIVE CANDIDATE:** feat/psd-rgb16-isolated-overlay-hardlight-20261124, base above; not main.
> **IMPLEMENTATION:** One root isolated contiguous RGB16 encoded sRGB raster folder; Overlay branches on parent backdrop, Hard Light on finished folder source. Shared typed compositor, straight alpha, opacity and prepared raster mask once. Native PSD/PSB editable group/layer and exact merged words. Explicit fail-closed outside bounded topology/precision; no Canvas8 fallback for these requested native folder modes.
> **EVIDENCE:** RED 11/14 → GREEN 14/14; focused 58/58 including recovery/version; build 7ee854ac29f8e3f0. Live Chromium file:// actual Group Properties, preview, Undo/Redo, .zpe, PSD/PSB exact merged words and editable reimport PASS (three mode sets); synthetic independent arithmetic, not Adobe-authored parity. Full dedicated Chromium exit 0 (68.03s). Windows npm run check FAIL: 1869 total / 1854 PASS / 10 SKIP / 5 existing Linux-only proc/cgroup FAIL; no gate weakened.
> **NEXT ACTION:** Verify separate #425 exact-main core and independent; new candidate exact-head core/independent and all review/protection gates, then guarded merge and separate exact-main verification. Never merge red/pending. Ordinary revert if needed.
> **NEXT IMPLEMENTATION ACTION:** Extend bounded native RGB16 isolated folder support to remaining typed separable modes (Darken/Lighten, Difference/Exclusion, Soft Light, Color Dodge/Burn), with independently verified branches and endpoint cases, partial alpha, mask, negative topology, Group Properties/History/.zpe and PSD/PSB roundtrip; split only if evidence or risk requires.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; nested/pass-through/clipping/adjustments/Float32/CMYK outside bounded native contract.

## Short queue

1. P1 #425 exact merged-main core and independent.
2. P1 Overlay/Hard Light candidate exact head/main acceptance.
3. P1 Remaining bounded native RGB16 isolated separable folder modes.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

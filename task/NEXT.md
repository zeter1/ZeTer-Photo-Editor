# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** — next: nested adjustment/clipping + translucent backdrop parity.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** — v1.47.20 masked Pass Through increment **MERGED in #402**; parent Photoshop-authored parity NOT DONE.
> **LATEST IMPLEMENTATION MAIN (2026-11-23):** `f36321d1a0ca6f02c98726a12841b920eed49ea3`, #401 and #402 **MERGED**. #402 exact final PR-head `75b0ce3b8d3c3c8931117c7868716d1d6b9d360a` [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45185645762) + [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45185645656). Post-merge exact-main [core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45186730498) and [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45186730512) initially IN PROGRESS; check completion separately.
> **LAST INTEGRATED:** [#402 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/402), merge `f36321d1a0ca6f02c98726a12841b920eed49ea3`. **ACTIVE CODE PR:** none for the next adjustment/clipping increment; do not repeat #401/#402.
> **LAST VERIFIED (2026-11-23):** baseline Chromium `file://` oracle RED timeout; after implementation GREEN: masked pass-through Multiply over blue pixel [0,0,0,255] fully open / [0,0,127,255] half / [0,0,255,255] closed. Real Group Properties disable, Undo/Redo, File > Save Project and native `.zpe` reopen PASS; full Windows browser suite PASS. Windows `npm run check` 1795 total / 1780 PASS / 10 SKIP / 5 Linux-only harness FAIL. PSD/PSB structure retained. Synthetic pixel oracle, not Photoshop-authored.
> **REMAINING ACCEPTANCE:** independent Photoshop-authored PSD/PSB raster pixel golden (licensed provenance), nested adjustment/clipping, alpha/translucent backdrop and knockout semantics, large-project memory behavior, and exact post-merge main CI result. Do not claim full Adobe parity.
> **NEXT IMPLEMENTATION ACTION:** independently exercise masked Pass Through with nested adjustment layer + clipping chain and a transparent/partially-transparent backdrop using known RGBA oracle; correct any unsupported group coverage handling without flattening. Then verify PSD/PSB native export/reopen + Undo/Redo + `.zpe` and independently authored Photoshop reference when licensed fixture becomes available.
> **BLOCKERS:** genuine licensed Photoshop-authored PSD/PSB pixel reference unavailable; CAP-RAW-CAMERA-ORACLE needs genuine licensed camera DNG and independent LibRaw/RawTherapee renderer. Neither blocks independent implementation.

## Короткая очередь

1. **P1 IN PROGRESS — Stage 17a:** nested clipped/adjustment masked Pass Through and transparent alpha semantics, real Chromium and format round-trips; Photoshop-authored oracle external BLOCKED.
2. **P1 BLOCKED — CAP-RAW-CAMERA-ORACLE:** licensed camera-original DNG + independent RAW ground truth.
3. **P2 IN PROGRESS — Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks:** choose independent professional vertical slice by [matrix](CAPABILITY_MATRIX.md).

[Stage 17a journal](002-psd-folder-group-mask.md) · [capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

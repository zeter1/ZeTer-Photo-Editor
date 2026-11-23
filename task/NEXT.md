# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** — masked Pass Through group, backdrop-aware rendering.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** — bounded v1.47.20 implementation LOCAL PASS; parent Photoshop parity NOT DONE.
> **BASE MAIN SHA:** `3a9b025dac3e590d69cd0437effefedaa0e8374b` — #401 MERGED (native Photoshop folder masks). Main CI attempt 1 FAIL on known Chromium Worker 003T/2b-2 flake, attempt 2 running at time of drafting; independent real-photo CI PASS. Recheck actual status before acceptance.
> **ACTIVE PR:** `feat/psd-masked-pass-through-backdrop-20261123` — publish and link PR on GitHub when gated checks complete.
> **LAST VERIFIED (2026-11-23):** baseline Chromium `file://` new oracle RED timeout; after implementation GREEN: masked pass-through Multiply over blue pixel [0,0,0,255] fully open / [0,0,127,255] half / [0,0,255,255] closed. Real Group Properties disable, Undo/Redo, File > Save Project and native `.zpe` reopen PASS. Prior group mask and PSD/PSB structure retained. Synthetic pixel oracle; not Photoshop-authored.
> **REMAINING ACCEPTANCE:** exact PR-head Linux core CI and independent real-photo workflow; Photoshop-authored PSD/PSB raster pixel golden (licensed provenance), nested adjustment/clipping, alpha/translucent backdrop and knockout semantics, comprehensive large-project memory behavior. Do not claim full Adobe parity.
> **NEXT IMPLEMENTATION ACTION:** independently exercise masked Pass Through with nested adjustment layer + clipping chain and a transparent/partially-transparent backdrop using known RGBA oracle; correct any unsupported group coverage handling without flattening. Then verify PSD/PSB native export/reopen + Undo/Redo + `.zpe` and independently authored Photoshop reference when licensed fixture becomes available.
> **BLOCKERS:** genuine licensed Photoshop-authored PSD/PSB pixel reference unavailable; CAP-RAW-CAMERA-ORACLE needs genuine licensed camera DNG and independent LibRaw/RawTherapee renderer. Neither blocks independent implementation.

## Короткая очередь

1. **P1 IN PROGRESS — Stage 17a:** nested clipped/adjustment masked Pass Through and transparent alpha semantics, real Chromium and format round-trips; Photoshop-authored oracle external BLOCKED.
2. **P1 BLOCKED — CAP-RAW-CAMERA-ORACLE:** licensed camera-original DNG + independent RAW ground truth.
3. **P2 IN PROGRESS — Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks:** choose independent professional vertical slice by [matrix](CAPABILITY_MATRIX.md).

[Stage 17a journal](002-psd-folder-group-mask.md) · [capability matrix](CAPABILITY_MATRIX.md) · [task map](README.md).

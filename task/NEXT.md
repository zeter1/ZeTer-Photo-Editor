# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY**, P1 IN PROGRESS.
> **BASE main (2026-11-23):** `b9f5503be135f0750ff64337959f86adb98e0e78`; PSD isolated raster clipping **PR #400 MERGED** (exact PR-head CI + independent workflow PASS).
> **CURRENT IMPLEMENTATION:** v1.47.19 candidate, branch `feat/psd-group-raster-mask-20261123`. Photoshop PSD/PSB *folder marker (-2)* raster mask: parse native per-group channel/bounds, nested groups and mask disabled, internal group mask schema, import (including embedded PSD), isolated group Canvas compositing and .zpe, real group Properties mask enable/disable with History Undo/Redo, export native PSD/PSB channels without layer flattening. This is distinct from child-layer masks.
> **TESTS:** Synthetic PSD/PSB native codec RED 2 -> GREEN 2, .zpe sanitizer RED -> GREEN; extended nested/bounds/disabled PSD+PSB 2/2; 41/41 related Node checks; real Chromium file:// 4x2 exact RGBA inside [255,127,127,255], outside [255,255,255,255], Properties toggle, Undo/Redo, saved .zpe and real re-open PASS. Synthetic code-generated fixtures **are NOT Photoshop-authored goldens**. Exact PR-head Linux and independent workflow acceptance is separate.
> **KNOWN LIMITATION:** masked pass-through currently uses isolated source-over approximation; backdrop-sensitive adjustment blending, knockout, mixed nested clipping chains and Photoshop-authored pixel parity are **NOT ACCEPTED**. Legacy group masks remain null.
> **NEXT EXACT IMPLEMENTATION ACTION:** obtain licensed *independently Photoshop-authored* PSD/PSB with isolated group folder raster mask, pass-through masked folder, nested adjustment and clipping; compare Photoshop-rendered RGBA pixel golden to ZeTer; implement correct pass-through masked group backdrop-aware compositing (no flattening) and verify PSD/PSB import/export + Undo/Redo/.zpe in real Chromium; add versioned fixture provenance and negative tests.
> **SECONDARY BLOCKER:** CAP-RAW-CAMERA-ORACLE — requires licensed camera-authored Bayer DNG and independent LibRaw/RawTherapee oracle; not a blocker for Stage 17a.

## Приоритетная очередь

1. **P1 IN PROGRESS — CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY:** finish Photoshop-authored external parity and masked pass-through / nested clipping semantics. Folder mask implementation alone is not the parent DONE criterion.
2. **P1 BLOCKED — CAP-RAW-CAMERA-ORACLE:** genuine camera Bayer DNG + independent rendered pixel oracle.
3. **P2 IN PROGRESS:** Stage 6 tiled Worker, Stage 8 ICC, Stage 2 vector masks — see [матрица](CAPABILITY_MATRIX.md).

[Stage 17a предыдущий срез](002-psd-isolated-clipping.md) · [Новый журнал folder mask](002-psd-folder-group-mask.md) · [матрица](CAPABILITY_MATRIX.md) · [карта задач](README.md).

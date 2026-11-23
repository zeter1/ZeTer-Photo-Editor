# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-DEFAULT-CROP** — обработка DefaultCropOrigin/Size для несжатых Bayer DNG.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (локальные Node/Chromium PASS; НЕ в main).
> **BASE MAIN SHA:** `6a0a2d12ab8f279491eb7357e98d1ad7eab207da` — #397 merged 2026-11-23; exact-main core and independent real-photo CI are being rechecked.
> **ACTIVE PR:** [#397 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) at `6a0a2d12ab8f279491eb7357e98d1ad7eab207da`, [#398 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398) retargeted to `main` with code already implemented; this task-doc synchronization triggers current PR-head Linux CI.
> **LAST VERIFIED:** 2026-11-16 · Windows `ZeTer-Photo-Editor-raw` · v1.46.21 candidate.
> **LOCAL EVIDENCE:** full Windows `npm run check`: **1672 PASS / 10 SKIP / 5 FAIL** (все 5 — Linux-only `/proc`/cgroup tests на Windows), `git diff --check` PASS; 26/26 focused Node PASS (включая RED→GREEN fail-closed неизвестных TIFF type/count для crop/scale) (`dng-default-crop`, `dng`, `dng-color`, `dng-import-controller`); `npm run build` PASS; **Chromium `npm run test:browser:raw-dng` PASS**: FileInput → fractional crop+ColorMatrix+Orientation → пиксели, Properties, Undo/Redo, `.zpe` reopen/native bytes; PNG/PSD/PSB rendered raster в регрессии. Linux PR-head для нового кода ещё не подтверждён.
> **REMAINING ACCEPTANCE:** #397 has merged. Validate latest #398 head's Linux core and independent real-photo CI, review final diff, merge if gates pass, then exact-main checks. Following #398, reconcile the already implemented local RAW stack (SOF3, packed Bayer, ForwardMatrix, highlights/shadows, demosaic, presets, linear contrast) in one clean PR; do not rewrite it. Independent camera-authored LibRaw corpus remains BLOCKED.
> **NEXT IMPLEMENTATION ACTION:** complete #398 exact-head CI/review/merge, then publish the verified local RAW stack through GitHub with its own exact-head CI and preserve upstream contact documentation. No duplicate ColorMatrix/DefaultCrop implementation.
> **BLOCKERS:** real-photo CI source acquisition currently has an external Commons response failure (not a RAW test result); investigate and rerun without waiving hash/provenance checks. Camera-authored license/oracle remains unavailable.

## Короткая очередь

1. **CAP-RAW-DNG-DEFAULT-CROP:** IN PROGRESS — [#398 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398), code published; CI NOT RUN до retarget `main`, затем review/integration.
2. **CAP-RAW-DNG-STACK-RECONCILIATION:** P1 IN PROGRESS — local verified RAW SOF3/packed/ForwardMatrix/demosaic/presets/contrast stack, not yet published; use a separate GitHub PR after #398.
3. **CAP-RAW-CAMERA-ORACLE:** BLOCKED — provenance и независимые LibRaw/RawTherapee pixel comparisons.
4. **CAP-BEZ-MASK-PSD-UI:** BLOCKED external Adobe-authored corpus; ранее принятые bounded не повторять.
5. **Stage 6 / 003X/6c-9, ICC/ForwardMatrix, HDR:** IN PROGRESS / TODO по [матрице](CAPABILITY_MATRIX.md).

[DefaultCrop journal](002-raw-dng-default-crop.md) · [ColorMatrix journal](002-raw-dng-camera-color.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md).

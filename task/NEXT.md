# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-DEFAULT-CROP** — обработка DefaultCropOrigin/Size для несжатых Bayer DNG.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (локальные Node/Chromium PASS; НЕ в main).
> **BASE MAIN SHA:** `a81bec7cafabff90b685c41fe4b8242dc8fa1566` (main на 2026-11-16).
> **ACTIVE PR:** [#397 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) — предшествующий CAP-RAW-DNG-CAMERA-COLOR, exact head `bf6dd6628e2934dc39965fb8cf9058919d2dc9af`; [core PR CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733301), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733325). Новый DefaultCrop пока только в локальной ветке `feat/raw-dng-default-crop-20261116` поверх head #397, отдельного PR нет.
> **LAST VERIFIED:** 2026-11-16 · Windows `ZeTer-Photo-Editor-raw` · v1.46.21 candidate.
> **LOCAL EVIDENCE:** full Windows `npm run check`: **1672 PASS / 10 SKIP / 5 FAIL** (все 5 — Linux-only `/proc`/cgroup tests на Windows), `git diff --check` PASS; 26/26 focused Node PASS (включая RED→GREEN fail-closed неизвестных TIFF type/count для crop/scale) (`dng-default-crop`, `dng`, `dng-color`, `dng-import-controller`); `npm run build` PASS; **Chromium `npm run test:browser:raw-dng` PASS**: FileInput → fractional crop+ColorMatrix+Orientation → пиксели, Properties, Undo/Redo, `.zpe` reopen/native bytes; PNG/PSD/PSB rendered raster в регрессии. Linux PR-head для нового кода ещё не подтверждён.
> **REMAINING ACCEPTANCE:** полный Node gate, generated parity, Linux core + independent real-photo CI нового SHA; review, merge, exact-main по разрешённому workflow. Camera-authored DNG и независимый LibRaw/RawTherapee pixel oracle — BLOCKED (external evidence).
> **NEXT IMPLEMENTATION ACTION:** проверить PR-head Linux core и independent real-photo CI для нового SHA, провести review и интеграцию через разрешённый workflow; после приёмки перейти к **CAP-RAW-DNG-LOSSLESS-JPEG** (DNG compression=7 и ресурсные лимиты).
> **BLOCKERS:** #397 открыт; нет licensed camera-authored исходника / independent golden pixels. Неединичный DefaultScale, ICC/ForwardMatrix и сжатие пока не поддерживаются.

## Короткая очередь

1. **CAP-RAW-DNG-DEFAULT-CROP:** IN PROGRESS — реализован локально; pending CI/integration.
2. **CAP-RAW-DNG-LOSSLESS-JPEG:** P1 TODO — безопасная JPEG lossless декомпрессия DNG.
3. **CAP-RAW-CAMERA-ORACLE:** BLOCKED — provenance и независимые LibRaw/RawTherapee pixel comparisons.
4. **CAP-BEZ-MASK-PSD-UI:** BLOCKED external Adobe-authored corpus; ранее принятые bounded не повторять.
5. **Stage 6 / 003X/6c-9, ICC/ForwardMatrix, HDR:** IN PROGRESS / TODO по [матрице](CAPABILITY_MATRIX.md).

[DefaultCrop journal](002-raw-dng-default-crop.md) · [ColorMatrix journal](002-raw-dng-camera-color.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md).

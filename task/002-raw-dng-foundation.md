# CAP-RAW-DNG-FOUNDATION — первый ограниченный RAW workflow

**Дата:** 2026-11-16 · **Приоритет:** P1 · **Статус:** IN PROGRESS (bounded работающий срез; независимая camera-authored acceptance не завершена). **Версия:** 1.46.18. **Базовый main:** `7ab905fb5640d0e99b14c25c198cc6ff5207deb3` (#393 merged). **Ветка:** `feat/raw-dng-foundation-20261116`.

## Цель и реализованное

- Не имитировать импорт RAW просмотром встроенного JPEG; парсить реальные бинарные classic TIFF/IFD tag records DNG и CFA полосы непосредственно в browser `file://`.
- `src/formats/dng.js`: classic II/MM TIFF, проверка DNGVersion и Bayer PhotometricInterpretation, bounded IFD/SubIFD/tag/strip offsets, limits 48 MiB / 16 MP, 8/16-bit uncompressed single-plane CFA strips, 2×2 CFA RGGB/BGGR/GRBG/GBRG, BlackLevel/WhiteLevel/AsShotNeutral, bilinear demosaic в RGBA8, exposure ±5 EV и WB R/B 0.25–4. Compression/packed/unsupported fail-closed.
- `src/document/import-controller.js` + `src/main.js`: обычный `.dng` File Open/import → отдельная DNG read/decode ветка; оригинальный файл в `rawDng.dataUrl`, отображаемая проявка в `layer.dataUrl` как PNG, контролы Properties exposure/red/blue WB/reset; optimistic exact owner, selected layer, session, lock guards на повторную проявку; commit в History.
- `src/core/state.js`: `rawDng` sanitization/persistence; original sensor dimensions не подменяются размерами трансформированного raster. `.zpe` хранит и оригинальные байты, и текущие настройки, и PNG preview; PNG/PSD/PSB export содержит проявленный raster, а не native RAW.
- `index.html`, `tools/build-bundle.mjs`, `package.json`, `tools/browser-smoke.mjs` и `.github/workflows/ci.yml`: интерфейс и file:// E2E включены в сборку и PR core Linux CI.

## Доказательства (локальная Windows QA)

- `node --test tests/dng.test.mjs tests/dng-import-controller.test.mjs`: 8 PASS / 0 FAIL. Test binary fixture — синтетический валидный TIFF/DNG IFD с actual strip data, включая endian, 16-bit, неверный compression, обрыв strips, invalid version/CFA, source immutability, stale-session/atomic reject, `.zpe` sanitize, source dims after raster transform.
- `npm run test:browser:raw-dng`: настоящий Chrome/Chromium `file://` input `camera-sensor.dng`, RGBA pixel oracle на Canvas, exposure и WB меняют пиксели, History Undo/Redo, Ctrl+S `.zpe` JSON, исходные DNG bytes byte-for-byte unchanged, reopening in input, real PNG signature и PSD/PSB экспортные байты разобраны нативным decoder — PASS. Synthetic TIFF fixture, **не** camera-authored файл. Photoshop authored GUI не проверен.
- Генерируемый bundle и index manifest обновлены через `npm run build`; локальная проверка `git diff --check`, Node syntax/регрессии по результатам финальной проходки.
- CI PR-head и exact-main: **NOT VERIFIED до завершения GitHub workflow**, ссылки будут обновляться только по readback.

## Ограничения, риски, следующая задача

- Цветовая трактовка — приближённый отображаемый sRGB bilinear из camera CFA без Adobe ColorMatrix1/2, forward-matrix, ICC, orientation/ActiveArea crop и tone mapping; не заявлять color-accuracy, highlight/shadow controls или поддержку всех DNG. Не поддерживаются JPEG-compressed/packed/sparse/нестандартные CFA и нет независимой сравнимой camera-authored reference.
- При raster-scale/resize original DNG сохраняется как provenance, но повторную проявку блокирует mismatch dimensions; это защищает от молчаливой подмены композиции.
- **Точная следующая задача P1:** получить свободно лицензированный camera-authored uncompressed Bayer DNG, подтвердить его происхождение/лицензию, сравнить канал RAW и проявленный результат с LibRaw/RawTherapee на известном кадре, добавить поддержку camera ColorMatrix в linear domain с контролируемым gamut conversion, orientation/ActiveArea, измеримые пиксельные reference assertions и полноценный file:// real-camera E2E. После неё — отдельно lossless-JPEG DNG.

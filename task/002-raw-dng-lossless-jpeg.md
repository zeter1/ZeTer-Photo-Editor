# CAP-RAW-DNG-LOSSLESS-JPEG-SOF3 — одноканальное сжатие RAW Compression=7 (bounded v1.46.24)

**Дата:** 2026-11-19. **Stage:** 9 / **P1**. **Статус:** IN PROGRESS — локальная реализация и Windows acceptance подтверждены; не опубликовано, GitHub Linux PR-head CI NOT RUN. **Ветка:** `feat/raw-dng-jpeg-lossless-sof3-20261119` от `bbe66b6` (LinearizationTable), предшественники DefaultScale `dd4456d`, [#398](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398), [#397](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397). Текущий main `ddd90d3be9c20092b043a3ea4761795177f7a94c`.

## Реальная функция

- `src/formats/dng-lossless-jpeg.js`: bounded decoder ISO lossless JPEG **SOF3**, одноканальная CFA-плоскость, DHT Huffman DC, предикторы 1–7, Pt, category 0–16 и signed difference, entropy byte stuffing, EOI, precision 8–16; строгие SOI/SOF3/SOS, размеры, таблицы и маркеры. Multi-component, sliced frames/restart intervals и неизвестные JPEG-режимы отвергаются, а не декодируются приблизительно.
- `src/formats/dng.js`: TIFF classic II/MM `Compression=7` с 8/10/12/14/16-bit CFA strips и неизменный путь `Compression=1`; декодированные образцы до LUT/BlackLevel/дебайеризации, ActiveArea/DefaultCrop/DefaultScale, ColorMatrix, WB/exposure и sRGB. Исходные compressed DNG bytes не мутируются. Сохраняются pixel/strip лимиты.
- `src/document/import-controller.js`, `src/core/state.js`, `src/main.js`: обычный RAW FileInput UI, `.zpe` исходный источник и `compression=7` provenance (старые `.zpe` получают 1), Properties отличает lossless JPEG. Expose/white balance через существующий no-loss re-develop, History, Undo/Redo. PNG/PSD/PSB содержат только **проявленный raster**, RAW не объявляется нативно редактируемым в PSD.
- `tools/build-bundle.mjs`: явное включение нового модуля в offline `file://` bundle. Реальный Chrome обнаружил RED при пропущенной сборке (`decodeDngLosslessJpeg is not defined`); добавление модуля дало GREEN.

## Файлы и проверка

Изменённые код/интеграция: `src/formats/dng-lossless-jpeg.js`, `src/formats/dng.js`, `src/document/import-controller.js`, `src/core/state.js`, `src/main.js`, `tools/build-bundle.mjs`; generated `src/app.bundle.js`, `index.html`, `version.json`, `package.json`. Тесты: `tests/fixtures/dng-lossless-jpeg-fixture.mjs`, `tests/dng-lossless-jpeg.test.mjs`, `tests/dng.test.mjs`, `tests/dng-import-controller.test.mjs`, `tools/browser-raw-dng-check.mjs`. Документы: `README.md`, `CHANGELOG.md`, `docs/testing/TEST_MATRIX.md`, `task/NEXT.md`, `task/README.md`, `task/CAPABILITY_MATRIX.md`, этот журнал.

- **PASS 43/43 focused Node**: `node --test tests/dng-lossless-jpeg.test.mjs tests/dng-linearization.test.mjs tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs`. Synthetic SOF3 reference encoder vs real TIFF compressed path, II/MM, 8/10/12/14/16-bit, 7 predictors, Pt=2, LUT/BlackLevel, fractional geometry, exposure, fail-closed JPEG/IFD/entropy.
- **PASS** `npm run build` + реальный `npm run test:browser:raw-dng`: Chrome `file://` File input → decoded pixel oracle → RAW Properties → .zpe save/reopen with byte-identical source, exposure change, History Undo/Redo; предыдущий ColorMatrix/DefaultCrop/DefaultScale/LUT и PNG/PSD/PSB raster regression PASS.
- **Windows check NOT PASS:** `npm run check`: 1704 tests, **1689 PASS / 10 SKIP / 5 FAIL**, ровно 5 Windows-incompatible Linux-only cgroup/`/proc` tests (003T/2d-2/3). Не выдавать его за PASS.
- `git diff --check` и `tests/version-consistency.test.mjs` — проверять после финальной сборки/коммита.
- **Remote:** PR #397 exact head core+independent real-photo SUCCESS, review 0; PR #398 stacked OPEN, head CI NOT RUN. SOF3 PR/CI NOT RUN, exact-main для этой функции NOT RUN.

## Неподтверждённые возможности и дальнейший план

Синтетический TIFF/DNG и собственный encoder — **не** real camera-authored corpus, не независимый pixel oracle. SOF3 single-component без JPEG restart/slices/multi-component, DNG tiling/packed uncompressed требуются отдельно. Нет независимых LibRaw/RawTherapee camera reference pixels и точности ColorMatrix/ICC/ForwardMatrix; Stage 9 IN PROGRESS. Следующая **интеграционная задача:** при отдельном разрешении завершить #397 → #398 → DefaultScale → LinearizationTable → нынешний SOF3 с ревью, требуемыми Linux core+real-photo CI и exact-main. Следующая **самостоятельная функция:** `CAP-RAW-DNG-JPEG-MULTICOMPONENT` — multi-component/restart/sliced DNG с настоящим структурным и pixel acceptance, затем независимый camera oracle.

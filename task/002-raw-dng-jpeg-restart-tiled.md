# CAP-RAW-DNG-JPEG-RESTART-TILED — SOF3 DRI/RSTn + TIFF tiles (v1.46.26)

**Дата:** 2026-11-19. **Stage 9/P1.** Локальная test-only ветка `feat/raw-dng-jpeg-restart-20261119` в `G:\МОЯ Веб-разработка\ZeTer Photo Editor\ZeTer-Photo-Editor-raw-next`, основана на `4d787b4` (SOF3 multi v1.46.25). Нового GitHub PR нет; изменения **не** в main.

## Реальная функциональная реализация

- `src/formats/dng-lossless-jpeg.js`: JPEG DRI (0xFFDD) с положительным MCU restart interval; проверка RST0…RST7 в ожидаемом порядке на точной границе интервала; byte alignment и padding bits, предиктор первого MCU после RST возвращается в исходное состояние. Отвергаются повторный/нулевой/повреждённый DRI, пропущенные/подменённые RST, неожиданные entropy markers, лишние данные. Ранее принятые SOF3 1/2/4 components, 1×1 sampling, предикторы 1–7 и point transform сохранены.
- `src/formats/dng.js`: TIFF TileWidth 322, TileLength 323, TileOffsets 324, TileByteCounts 325; взаимоисключение JPEG tile layout и strip layout, строгая проверка arity/type/count/offset/byte bounds и максимума 1024 частей. Каждый SOF3 tile декодируется в полную rectangular sample-grid; неполные правые/нижние края отрезаются при копировании в точную sensor-phase Bayer сетку, затем идут существующие LinearizationTable → BlackLevel/WhiteLevel → демозаика → DefaultCrop/Scale → ColorMatrix → sRGB. Uncompressed strips не изменяются.
- `tests/fixtures/dng-lossless-jpeg-fixture.mjs`: synthetic DRI/RSTn encoder и генерирование tiled DNG, включая big/little endian, edge padding и signed -32768 category 16. Это НЕ camera-authored DNG и НЕ независимый JPEG codec reference.
- `tools/browser-raw-dng-check.mjs`: реальный Chrome `file://` file input compressed tiled DNG с RSTn; точная проверка PNG-layer RGBA против Node oracle, .zpe exact original compressed bytes, reopen, exposure/History Undo/Redo и прежний PNG/PSD/PSB raster regression.

## Проверки и граница доказательства

- RED: до изменения production decoder **3/4** restart тестов падали на DRI; до tiled decoder **4/4** tiled тестов падали на StripOffsets. После правки новые и старые JPEG suite: **17/17 PASS**.
- GREEN: `node --test tests/dng-lossless-jpeg-restart.test.mjs tests/dng-lossless-jpeg-tiled.test.mjs tests/dng-lossless-jpeg.test.mjs tests/dng-linearization.test.mjs tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs` — **54/54 PASS**. Проверены II/MM, 8/12/16 бит, SOF3 1/2/4 компонента, повторный restart цикл RST0–RST7, edge tile stitching и повреждённые TIFF/JPEG.
- `npm run build` PASS; `npm run test:browser:raw-dng` **PASS** (Chromium `file://`, FileInput→RGBA pixel oracle, .zpe save/reopen, exposure/History Undo/Redo, PNG/PSD/PSB rendered raster regression); первая попытка нового Browser E2E FAIL из-за ошибочного ожидания изменения геометрии существующего холста, изменён fixture на 4×4 с реальным неполным нижним tile и последний прогон PASS. Не скрывать первоначальный FAIL.
- `npm run check` Windows: **1700 PASS / 10 SKIP / 5 FAIL**, все пять — Linux-only `/proc`/cgroup 003T/2d-2/3, общий Windows check НЕ PASS. GitHub core Linux CI и independent real-photo для нового кода **NOT RUN**; exact merged-main NOT RUN.

## GitHub и критерии завершения

- Проверенный `main` `ddd90d3be9c20092b043a3ea4761795177f7a94c`; [exact-main core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43923939475) относится к **старому main**, не к новой реализации. Independent exact-main NOT RUN.
- [#397 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) head `bf6dd6628e2934dc39965fb8cf9058919d2dc9af`, [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733301) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733325), reviews 0. [#398 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398), head `05c48eb8398aea57b0470fcaacf50801503c1fa3`, stacked, CI NOT RUN из-за base filter. DefaultScale, LUT, SOF3 single/multi только локально.
- **Не принято:** camera-authored licensed DNG + independent LibRaw/RawTherapee pixel thresholds, другие TIFF/JPEG методы, tiled uncompressed, JPEG slices, multi-scan, subsampling, full ICC/ForwardMatrix camera profile. Stage 9 IN PROGRESS, camera-accurate НЕ заявлено.
- Перед отметкой DONE нужны разрешённая GitHub интеграция предшественников, PR этой ветки, Linux core + independent real-photo exact-head CI, review, merge и exact-main CI; доступное локальное действие — код/тесты/коммит. GitHub push/merge требует отдельного прямого разрешения в `zeter-github-workflow` skill.

**Следующая задача:** `CAP-RAW-DNG-JPEG-SLICES-MULTISCAN`: bounded DNG slice/frame geometry и multi-scan JPEG SOF3 с негативными cases, pixel-based external oracle, native `.zpe` + Chrome `file://`, re-develop Undo/Redo. Приоритет GitHub acceptance текущей цепочки сохраняется.

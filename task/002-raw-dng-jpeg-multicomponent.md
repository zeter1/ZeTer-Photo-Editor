# CAP-RAW-DNG-JPEG-MULTICOMPONENT — bounded SOF3 2/4 interleaved CFA (v1.46.25)

**Дата:** 2026-11-19. **Stage 9 P1**, только локальная ветка `feat/raw-dng-jpeg-multicomponent-20261119` (тестовая папка `G:\МОЯ Веб-разработка\ZeTer Photo Editor\ZeTer-Photo-Editor-raw-next`). База: SOF3 single-component `01d8825` с локальными DefaultScale/LUT, открытые необходимые GitHub PR [#397](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) и [#398](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398). **Не в main, никакой CI для этого нового среза пока не запускался**.

## Изменение поведения

- `src/formats/dng-lossless-jpeg.js`: разбор SOF3 с **1, 2 либо 4 компонентами**, уникальными ID и 1×1 sampling; SOS с сохранением порядка компонентов, отдельными per-component Huffman DC tables и предикторами (1–7), point transform; раскладка потока в **row-wise interleaved** TIFF CFA, `frameWidth * componentCount === stripWidth`, без изменения исходных compressed bytes.
- **Fail-closed:** неправильный count/ID/selector/sampling/размеры SOF3, неизвестный JPEG, restart/sliced/multi-scan/tiled кадр отклоняются; старый однокомпонентный SOF3 и uncompressed путь не изменены.
- Существующий RAW FileInput → ColorMatrix/DefaultCrop/Scale/LUT/BlackLevel → RGBA; `.zpe` хранит исходный DNG и compression 7, меняется только preview при WB/exposure, History/Undo/Redo. PNG/PSD/PSB дают проявленный raster, не обещают native RAW в PSD.

## Проверки

- **RED→GREEN:** новые 3 теста сначала падали на отказе old SOF3 decoder, затем **9/9 SOF3 Node PASS**.
- **46/46 RAW focused PASS**: `node --test tests/dng-lossless-jpeg.test.mjs tests/dng-linearization.test.mjs tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs`. 2/4-компонентная геометрия, II/MM и 8/10/12/14/16 bit, 7 предикторов, Pt=2, повреждённые headers/SOS; synthetic reference encoder не независимый camera pixel oracle.
- **Chrome `file://` PASS**: `npm run test:browser:raw-dng`, настоящий file-input 4-component SOF3, PNG layer RGBA vs Node DNG oracle, `.zpe` exact compressed bytes+geometry, save/reopen, exposure/History/Undo/Redo, прежний single-component/Crop/Scale/LUT/PSD/PSB regression.
- **Build PASS**: `npm run build`. **Windows `npm run check`: 1707 tests, 1692 PASS / 10 SKIP / 5 FAIL**, все пять Linux-only `/proc`/cgroup (003T/2d-2/3); общий check **FAIL**. `node --test` RAW six suites + version-consistency: **47/47 PASS**. `git diff --check`: PASS. Заключительный Chrome прогон после исправления race в проверке reopen: PASS; exact local commit SHA фиксируется после приёмки.
- **Remote:** #397 exact-head core и independent SUCCESS, reviews 0; #398 stacked OPEN без Linux CI; новая ветка PR NOT CREATED, Linux CI NOT RUN, merged-main NOT VERIFIED.

## Границы и следующая задача

Срез поддерживает лишь ровную 1×1 компонентную интерливинг-раскладку для CFA (1/2/4), не универсальное соответствие JPEG-frame и TIFF dimensions, не 3-компонентные layouts и не форматы с restart-interval, slices, отдельными scans, JPEG tiles. Нет настоящего camera-authored DNG/независимого LibRaw-эталона или сведений о профилях камер. Stage 9 **IN PROGRESS**.

**Следующая точная задача:** сначала разрешённая GitHub интеграция #397 → #398 → DefaultScale → LinearizationTable → SOF3 single → нынешний multi с core/real-photo CI; следующий самостоятельный feature slice `CAP-RAW-DNG-JPEG-RESTART-TILED` с pixels/Chrome/.zpe/Undo/Redo и fail-closed некорректными маркерами.

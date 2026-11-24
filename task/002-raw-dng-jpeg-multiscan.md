# CAP-RAW-DNG-JPEG-MULTISCAN — отдельные SOF3 SOS-сканы CFA (v1.47.0)

**Дата:** 2026-11-20. **Stage 9 / P1 / IN PROGRESS.** Отдельный локальный функциональный срез, не опубликован в `main`. Рабочая ветка `feat/raw-dng-sof3-multiscan-20261120`, worktree `G:\МОЯ Веб-разработка\ZeTer Photo Editor\ZeTer-Photo-Editor-raw-next`, исходный commit `970457a` (сжатый CFA с DRI/RSTn и TIFF tiles). Новый код наследует локальные предыдущие RAW-коммиты и не заменяет открытые #397/#398.

## Реальная функциональность

- `src/formats/dng-lossless-jpeg.js`: вместо единственного полного SOS декодер читает один interleaved SOS (предыдущий режим) **или** все отдельные SOS по одному компоненту frame (2 либо 4 компонента). Порядок сканов может отличаться от порядка SOF3 frame IDs; декодер адресует каждый сенсорный sample точным индексом в исходной CFA-сетке, не смешивает каналы.
- Каждый SOS имеет собственный Huffman DC selector, predictor 1–7 и point transform. Проверяются frame precision, размеры, 1×1 sampling, SOF3/SOS IDs, restart boundaries и RST0–RST7; predictor сбрасывается на первом MCU после restart. Пропущенные/повторные/неизвестные компоненты, смешанный формат SOS, незавершённый entropy scan и лишние данные после EOI приводят к явному отказу.
- `src/formats/dng.js` сохраняет прежний pipeline: TIFF compressed strips/tiles → сенсорные значения Bayer → LinearizationTable → Black/WhiteLevel → демозаика/DefaultCrop/DefaultScale → ColorMatrix → display RGB. Ни исходный DNG, ни его `.zpe` provenance не заменяются PNG. Exposure/WB, History/Undo/Redo работают с новым сжатым входом.
- `tests/fixtures/dng-lossless-jpeg-fixture.mjs`: детерминированная генерация полного набора SOS с отдельными entropy stream и необязательным порядком компонента; это **синтетический** fixture, не независимый decoder/camera oracle.

## Проверяемые критерии и результаты

1. **RED→GREEN:** новые `tests/dng-lossless-jpeg-multiscan.test.mjs` — 4 bounded набора: 2/4 компонента, 8/12/16 бит, predictor 1/4/7, DRI (0/1/5/13), point transform, произвольный scan order, exact sensor pixels и II/MM TIFF strips/edge tiles. Негативные кейсы: отсутствующий/повторный/неизвестный SOS, неверный DC selector, смешанный режим и лишний EOI payload.
2. **Node:** 9 профильных RAW suites, **58/58 PASS**, включая 21/21 focused JPEG suites после исправления регрессии диагностики EOI.
3. **Windows/Chrome:** `npm run build` и `npm run test:browser:raw-dng` **PASS**; реальный Chromium через `file://`, FileInput четырёх независимых SOS с tiled CFA и DRI/RSTn; RGBA всего изображения совпадает с Node oracle; `.zpe` сохраняет исходные байты и успешно открывается; экспозиция создаёт реальный raster/History change, Undo/Redo сохраняются; прежние PNG/PSD/PSB rendered-raster регрессии PASS.
4. **Ограничения:** полный `npm run check` на Windows не PASS из-за существующих Linux-only `/proc`/cgroup тестов; итог повторного запуска после версии 1.47.0: **1719 tests, 1704 PASS / 10 SKIP / 5 FAIL**, все пять — Linux-only `/proc`/cgroup. `tests/version-consistency.test.mjs` отдельно PASS (1/1); версия в `package.json`, `index.html`, `version.json`, `CHANGELOG.md` согласована. Общий Windows check — **FAIL**, без маскировки. Linux core и независимый real-photo workflow для новой ветки **NOT RUN**, PR **не создан**, merge в `main` **не выполнен**. Не выдавать synthetic TIFF за внешнее независимое camera-authored golden.
5. Поддержаны только полностью interleaved SOS либо все отдельные non-interleaved SOS (по одному на компонент). Частично интерливинговые 2+2, sliced camera JPEG, subsampling и camera-authored LibRaw/RawTherapee эталоны не поддержаны; не утверждать общую совместимость со всеми DNG.

## Зависимости GitHub и следующая задача

Актуальный исходный `main`: `ddd90d3be9c20092b043a3ea4761795177f7a94c`, версия 1.46.19. [PR #397](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) открыт, exact-head CI SUCCESS; [PR #398](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398) открыт поверх #397, exact-head Linux CI ещё не запускался из-за base filter. Последующие DefaultScale, LinearizationTable, SOF3 single/multi, restart/tiled и новая multi-SOS функциональность находятся в локальной цепочке. Сливать только по разрешённому порядку и после exact-head CI/review. Локальный навык `G:\Мои навыки\zeter-github-workflow\SKILL.md` требует отдельного прямого разрешения на push/merge; в этой проходке оно не получено.

**Следующее независимое изменение:** `CAP-RAW-DNG-JPEG-PARTIAL-SCANS` — поддержка двух SOS-групп по 2 из 4 компонентов с корректными MCU, predictor, Huffman и DRI/RSTn, реальными пикселями/Chrome `file://`/.zpe/Undo/Redo и строго отрицательными случаями. Slices и внешняя цветовая калибровка остаются отдельными ограничениями.

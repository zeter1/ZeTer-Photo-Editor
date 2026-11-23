# CAP-RAW-DNG-TONAL-CONTROLS-PORT — bounded local v1.47.7 (2026-11-20)

**Stage 9 · Priority P1 · bounded implementation DONE LOCALLY; remote integration IN PROGRESS.** Кодовый локальный коммит: `f1ea7a83abefb4da73d8d3426242061582c33a31` (19 файлов, 296 добавлений, 48 удалений; НЕ опубликован на GitHub). Ветка: `feat/raw-dng-tonal-controls-port-20261120`; база: локальный `a25a147babf91014b1cc2986c8030aa0646ede0f` (ForwardMatrix порт v1.47.6). Исходная уже готовая реализация: `3f1d0adc8ac5434e47ba57a776fdea1b68671a86` из параллельной локальной ветки. Эта проходка переносит её в актуальную сенсорную цепочку; не заявляется первичным изобретением функции.

## Реальная реализация и совместимость

- `src/formats/dng-color.js`: `applyDngTonalControls` — цветосохраняющее масштабирование линейного RGB по относительной яркости Y. Shadows: Y·(1−Y)², Highlights: Y²·(1−Y), коэффициенты −1..1, чёрный/белый и neutral zero сохраняются; это не reconstruction clipped sensor data.
- `src/formats/dng.js`: проверка конечных параметров в [−1,1], обработка после camera calibration и Exposure, до sRGB transfer. Сохранены native TIFF/JPEG RAW bytes, sensor Bayer phase, LUT, BlackLevel/Delta, packed Bayer, lossless SOF3 scans, DefaultCrop/Scale, orientation и WB.
- `src/main.js`: RAW Properties «Света»/«Тени», reset, прежние owner/layer/session/lock/generation guards и History commit. `src/core/state.js`: `.zpe` содержит два числовых поля, legacy получает 0/0, неприемлемые значения fail closed.
- `tests/dng-tonal-controls.test.mjs` (5 новых), `tests/dng-color.test.mjs`, `tests/dng-import-controller.test.mjs` и `tools/browser-raw-dng-check.mjs`: настоящие пиксельные, provenance, Undo/Redo и сохранение/переоткрытие тесты.
- `package.json`, `README.md`, `index.html`, `version.json`, `src/app.bundle.js` — локальная версия 1.47.7 и canonical сборка, без стороннего backend.

## Проверки и границы доказательств

- **RED до production patch:** `node --test tests/dng-tonal-controls.test.mjs` → SyntaxError: отсутствует экспорт `applyDngTonalControls`. **GREEN после:** 50/50 focused Node PASS (tone/color/import/ForwardMatrix/BlackLevel/packed/SOF3/core).
- **LOCAL PASS:** `npm run build`, настоящий `npm run test:browser:raw-dng` в Chromium `file://`: DNG FileInput → RGBA пиксели по независимому Node fixture oracle → Shadows/Highlights → History Undo/Redo/reset → `.zpe` save/reopen; исходные DNG bytes точны; другие RAW и PNG/PSD/PSB rendered-raster regressions PASS.
- **LOCAL WINDOWS FULL CHECK:** `npm run check` **FAIL: 1753 tests / 1738 PASS / 10 SKIP / 5 FAIL** — 5 Linux-only `/proc`/cgroup тестов. Итоговый лог: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-tonal-port-final.log`. Общий check **НЕ PASS**. `node --test tests/version-consistency.test.mjs` PASS (1/1), `git diff --check` PASS и повторный Chrome RAW PASS после обновления version/build.
- **PR HEAD CI:** NOT RUN для этой локальной ветки. **PR:** NOT OPEN для локального v1.47.7. **EXACT-MAIN CI:** SUCCESS только для remote `ddd90d3`, не свидетельство о новом коде. **INDEPENDENT WORKFLOW:** NOT RUN для v1.47.7; #397 core+real-photo SUCCESS, #398 branch filtered.
- **LIMITATIONS/BLOCKED:** синтетические TIFF/CFA fixtures не являются camera-authored; нет лицензированного DNG с LibRaw/RawTherapee эталоном и pixel error thresholds. Dual-illuminant / ForwardMatrix approximate, PSD/PSB rendered raster не доказывает Adobe parity. UI-функция принята локально, Stage 9 остаётся IN PROGRESS.

## Точная следующая задача

**CAP-RAW-DNG-STACK-RECONCILIATION:** провести review и разрешённый merge #397, retarget + Linux CI + review #398, затем без дублирования представить единый PR с local v1.47.7 и принять exact-head core/real-photo, merge и exact-main. Не использовать force push, не обходить ручные разрешения на публикацию. [NEXT](NEXT.md) · [Матрица](CAPABILITY_MATRIX.md).

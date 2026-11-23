# CAP-RAW-DNG-BASELINE-EXPOSURE-OFFSET — Stage 9 / v1.47.10 (2026-11-20)

**Priority P1; bounded implementation DONE LOCALLY; integration IN PROGRESS.**
Локальная ветка `feat/raw-dng-baseline-offset-20261120` от `1e4005f14b023a9760ead1a9550d28f61dd6fb7e` (RAW v1.47.9).
Удалённый `main` на момент проверки: `ddd90d3be9c20092b043a3ea4761795177f7a94c` (core CI SUCCESS run 43923939475).

## Реализованная функция

- `src/formats/dng.js`: реальный DNG/TIFF тег `BaselineExposureOffset` 51109, `SRATIONAL[1]`, II/MM; встроенный профиль из IFD0 или CFA IFD, с проверкой конфликтующих дубликатов. Отсутствие тега — строго 0 EV.
- Reject вместо неверного preview при type/count, неизвестном TIFF типе/размере, нулевом знаменателе, невалидном указателе, NaN/несовместимых значениях и EV вне ±16. В `developDng` повторная проверка source, чтобы испорченная структура не дала неконтролируемый render.
- Scene-linear экспозиция теперь `2 ** (BaselineExposure + BaselineExposureOffset + manual Exposure)` до Highlights/Shadows и sRGB OETF; положительная/отрицательная профильная поправка **не меняет** пользовательское значение Exposure и Undo/Redo.
- `src/document/import-controller.js`: исходный DNG и отдельный provenance `baselineExposureOffset` на native RAW слое. `src/core/state.js`: whitelist/sanitize при `.zpe`, default 0 для старого проекта, reject malformed metadata. `src/main.js`: отдельная RAW Properties строка с EV встроенного профиля.
- `tests/fixtures/dng-fixture.mjs`: SRATIONAL 51109 II/MM. Новый `tests/dng-baseline-exposure-offset.test.mjs` и браузерное интеграционное расширение `tools/browser-raw-dng-check.mjs`, без подмены профессионального camera oracle.
- Версия 1.47.10 и generated `src/app.bundle.js` (через `npm run build`), `index.html` / manifest при необходимости.

## Функциональная приёмка

- **RED:** до production-патча новые 5/5 тестов падали на отсутствующем разборе/проявке/provenance.
- **GREEN:** `node --test tests/dng-baseline-exposure-offset.test.mjs tests/dng-baseline-exposure.test.mjs tests/dng-asshot-white-xy.test.mjs tests/dng-color.test.mjs` — 19/19 PASS.
- **PASS:** `npm run build`, `node --check tools/browser-raw-dng-check.mjs`, `node --test tests/version-consistency.test.mjs` (1/1).
- **PASS:** `npm run test:browser:raw-dng`, Chromium `file://`, реальный FileInput для DNG с profile offset, full RGBA по пиксельному oracle, separate RAW Properties, пользовательская Exposure/History Undo/Redo и full RGBA restore, `.zpe` save/reopen c byte-identical native DNG. Старые SOF3/multiscan, BlackLevel, ColorMatrix/ForwardMatrix, PNG/PSD/PSB rendered-raster regressions также PASS.
- Полный Windows `npm run check`: отдельная фиксация после завершения прогона. Не путать с Linux-only `/proc`/cgroup ожиданиями; не заявлять overall PASS при любом FAIL.
- Linux core PR-head, independent real-photo PR-head, code review и exact merged-main CI **NOT RUN** для локального нового кода; отдельный PR пока **не создан**.

## Ограничения и следующая задача

Функция ограничена **встроенным** profile offset в DNG; внешние `.dcp`, выбор ExtraCameraProfiles, независимая camera-authored DNG/LibRaw цветовая и экспозиционная точность НЕ подтверждены. Synthetic TIFF fixture и собственный PNG/PSD/PSB round-trip не являются внешним oracle. Родительский RAW pipeline **IN PROGRESS**.

**Далее: CAP-RAW-DNG-STACK-RECONCILIATION** — завершить разрешённую GitHub интеграцию без дублирования: review/CI/merge #397, затем #398 retarget → Linux core+independent workflow/review/merge; после этого создать один чистый PR на актуальном `main` с невошедшей локальной RAW-цепочкой v1.47.10, провести exact-head Linux CI/review и exact-main проверки. При запрете удалённых записей — сохранять локальный код и журнал, не обходить настройки.

[Очередь](NEXT.md) · [матрица](CAPABILITY_MATRIX.md) · [предыдущий срез](002-raw-dng-asshot-white-xy.md).

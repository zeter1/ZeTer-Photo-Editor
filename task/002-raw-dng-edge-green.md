# CAP-RAW-DNG-EDGE-GREEN — bounded локальная реализация v1.47.11

**2026-11-20 · Stage 9 · P1 · статус: IN PROGRESS (bounded код + UI + локальная проверка DONE, GitHub integration/independent camera acceptance NOT RUN).**

**Source baseline:** local branch `feat/raw-dng-baseline-offset-20261120` at `7f46e10eaf60192e5b10983a5188167f1f92be58` (до этой правки), не current main. Current GitHub main `ddd90d3be9c20092b043a3ea4761795177f7a94c`; #397/#398 открыты. Новая локальная функция не в main/PR.

## Мотивация и критерии

Исходный RAW reader для каналов без собственного CFA отсчёта усреднял соседей независимо от направления контрастной границы. На вертикальном контрастном step граница в G на R/B-site размывалась. Принят ограниченный оптимизационный критерий: новый **выбираемый** режим должен интерполировать G вдоль менее контрастной оси, сохранять default bilinear и старые .zpe пиксели, располагаться до дробного crop, масштабирования, Camera→sRGB и тональной обработки. Реальный FileInput/Inspector/History/Undo/Redo/.zpe + native DNG byte identity обязателен.

## Изменения (реальный production)

- `src/formats/dng.js`: режим `edge-aware-green` интерполирует G на R/B-site по горизонтали и вертикали, сравнивая градиент соседних G и поправку по паре 2-шаговых отсчётов того же CFA цвета. На невозможной периферии (halo шириной 2 px) используется неизменённая bilinear интерполяция; на равных градиентах среднее. Строго валидируется enum, новые массивы RAW не дублируются, native DNG буфер не мутируется. Остальные R/B missing samples остаются bilinear — **не полная демозаика**.
- `src/main.js`: RAW Properties `<select>` с bilinear/направленным зелёным, полная re-develop из исходных байтов, History/Undo/Redo/reset, stale owner/session/layer/lock checks и атомарная замена готового preview; не добавлена декоративная кнопка.
- `src/core/state.js`: `.zpe` v1/v2 whitelist для опционального `development.demosaic`; старый проект без поля остаётся bilinear; недопустимые значения fail-closed. `src/document/import-controller.js` не изменён: старый import получает default bilinear.
- Тесты: `tests/dng-edge-aware-green.test.mjs` (II/MM, 4 CFA phase patterns, gradient pixel oracle, immutable source, strict invalid input, project serialization); `tools/browser-raw-demosaic-check.mjs` + invocation в `tools/browser-raw-dng-check.mjs` (actual Chrome `file://`).
- Generated: `src/app.bundle.js`, `index.html`, `version.json` canonical `npm run build`; `package.json`, `README.md`, `CHANGELOG.md` до 1.47.11. Обновлены `task/NEXT.md`, `task/README.md`, матрица.

## Приёмка на Windows

- **RED BEFORE GREEN:** новый Node test `0/2 PASS`, ожидаемый pixel/strict-validation fail, без имитации алгоритма.
- **GREEN:** `node --test tests/dng-edge-aware-green.test.mjs tests/dng-tonal-controls.test.mjs tests/dng.test.mjs tests/dng-color.test.mjs` — **19/19 PASS**.
- **PASS:** `npm run build`; **PASS:** `npm run test:browser:raw-dng` настоящий Chromium `file://`: DNG FileInput → user selects mode → exact RGBA against decoder, source bytes, .zpe save/reopen, History Undo/Redo + Reset. Существующие SOF3/multiscan/packed/calibration/tonal/PNG/PSD/PSB rendered raster smoke без новых ошибок.
- **Overall FAIL (только Windows):** `npm run check` — **1768 tests, 1753 PASS, 10 SKIP, 5 FAIL** в Linux-only `browser-cgroup-delegation-probe` (4) и `browser-chromium-cgroup-control` (1) при отсутствии /proc/cgroup. Log: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-edge-green-final.log`. Это не полный PASS; исправленная version marker проверка `1/1 PASS`.
- **PR-head Linux CI:** NOT RUN для v1.47.11. **Independent real-photo:** NOT RUN для v1.47.11. **Exact-main CI:** ранее SUCCESS только `ddd90d3` (без этих локальных изменений). **Review/merge:** PR NONE для v1.47.11.

## Границы и следующая задача

Синтетический TIFF Bayer pixel oracle — не оригинал камеры и не внешняя проверка качества. Нет субъективной слепой оценки, texture/color zipper/perceptual comparison, DNG SDK/LibRaw pixel parity или полного edge-aware R/B demosaic. Старые PSD/PSB-экспорты остаются только rendered raster, RAW не становится редактируемым PSD smart object.

**NEXT:** в первую очередь закончить **CAP-RAW-DNG-STACK-RECONCILIATION**: review + разрешённый merge #397, затем retarget и проверки #398, затем clean PR с оставшейся локальной RAW веткой до v1.47.11 и проверка PR-head/exact-main CI. Не публиковать и не сливать при отсутствии отдельного permission/review.

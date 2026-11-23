# CAP-RAW-DNG-DISPLAY-CLIPPING — локальная v1.47.13

**2026-11-23 · Stage 9 · P1 · IN PROGRESS (код локально принят, remote gates не пройдены).**

## Контекст и зависимости
- Точный удалённый main: `ddd90d3be9c20092b043a3ea4761795177f7a94c`, [CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43923939475) только на нём.
- [#397](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) ColorMatrix OPEN, final head `bf6dd662`, 13/13 PR-head core + real-photo checks SUCCESS, 0 reviews. [#398](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398) DefaultCrop OPEN, head `05c48eb`, stacked на #397, CI НЕ запускался.
- Локальный чистый RAW merge `35bead7` и task `9becf71` в worktree `ZeTer-Photo-Editor-raw-integrated` использованы как база. Прежние RAW parser/ColorMatrix/DefaultScale/Highlights/Shadows/demosaic уже готовы и не переписывались.
- Новый текущий локальный branch `feat/raw-display-clipping-20261123` на основе `9becf71`; GitHub remote branch/PR пока НЕ СОЗДАНЫ. Весь Stage 9 IN PROGRESS.

## Реальный срез
- `src/formats/dng-clipping-warning.js`: overlay-классификация 8-bit RGBA, **≥254 хотя бы одного канала** → magenta (света), **≤1 всех каналов** → cyan (тени); игнорирует alpha <128. Счётчики раздельно, непрозрачность не меняется.
- `src/main.js`: RAW Properties checkbox; после `renderDocument` помечается исключительно **видимый** `editorCanvas`. Render buffer, dataUrl исходного preview, DNG bytes и экспорт не изменены. Нет History-события/изменений в .zpe от переключения. Render-error безопасен; для >8 Мп обработка отключена во избежание дополнительного RGBA readback.
- `tools/build-bundle.mjs` регистрирует новый модуль для запуска из `file://`; generated `src/app.bundle.js` и `version.json` обновляются штатной сборкой.
- `tests/dng-clipping-warning.test.mjs` и расширение `tools/browser-raw-dng-check.mjs`: настоящие display пиксели, History неизменна, .zpe сохраняет PNG without overlay, отключение подсветки возвращает исходный пиксель.
- Это **не проверка sensor clipping и не highlight recovery**; документируются только границы выходного RGB. Camera-authored DNG и независимые LibRaw/RawTherapee reference pixels отсутствуют.

## Проверки
- До добавления реализации Node: **RED** (ERR_MODULE_NOT_FOUND); после добавления: новые 3/3 PASS.
- Targeted Node `tests/dng-clipping-warning.test.mjs` + ColorMatrix + tonal: **14/14 PASS**; `npm run build` PASS, `node --check src/main.js`, `node --check tools/browser-raw-dng-check.mjs`, `git diff --check` PASS.
- Реальный Chromium `npm run test:browser:raw-dng` через `file://`: **PASS**, включая новый UI clipping toggle и существующие RAW CFA/SOF3/History/Undo/Redo/.zpe/PNG/PSD/PSB scenarios.
- Полный Windows `npm run check`: **FAIL — 1773 tests / 1758 PASS / 10 SKIP / 5 FAIL**. Все пять ошибок — Linux-specific `/proc`/cgroup tests (`browser-cgroup-delegation-probe`, `browser-chromium-cgroup-control`). Лог `..\raw-display-clipping-20261123-check.log`. **Не считать весь check PASS.**
- Широкий Windows `npm run test:browser`: **FAIL** на `BrowserSmokeError: Timed out waiting for red object brush preview` после Worker probe; тот же сбой ранее воспроизводился на чистом baseline #398 (`raw-398-baseline-browser.log`). Корень проблемы UNKNOWN, утверждений о причинности нового RAW overlay нет. Лог `..\raw-display-clipping-20261123-browser-full.log`.
- `node --test tests/dng*.test.mjs`: **112/112 PASS**; version consistency **1/1 PASS** после исправления заголовка CHANGELOG; `npm run test:browser:raw-dng`: **PASS** после версионной пересборки, включая PNG export с включённой подсветкой. Linux exact-head CI для текущей локальной ветки: **NOT RUN**.

## Следующая задача и acceptance
**CAP-RAW-DNG-STACK-RECONCILIATION (P1)**: получить отдельное прямое разрешение на GitHub push/merge (требование локального навыка); review и merge #397 после точных проверок; retarget #398 к main, запустить Linux core + independent real-photo на его head, review и merge; затем опубликовать зависимый локальный RAW-стек `35bead7` и clip срез через осмысленные PR, выполнить CI и exact-main. Никакого force push, bypass checks, fake camera oracle.
**Независимая реализация после gates:** UI/Worker large-image RAW clipping без 8 Мп лимита с ограниченным tiled readback; либо Stage 8 ICC acceptance по матрице, не повторяя существующие RAW функции.

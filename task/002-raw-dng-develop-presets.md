# CAP-RAW-DNG-DEVELOP-PRESETS — локальный срез 1.47.15

**Дата:** 2026-11-23. **База:** чистый local `857f7a3` v1.47.14 stacked после #398. **Ветка:** `feat/raw-development-presets-20261123`. Только локальный код, НЕ main/PR.

## Реализация

- `src/formats/dng-presets.js`: `localStorage` библиотека JSON schema=1; Exposure [-5,5], WB R/B [0.25,4], Highlights/Shadows [-1,1], демозаика (bilinear, edge-aware-green, edge-aware-rgb). NaN/Infinity/неизвестные режимы отклоняются, выходящие за bounds конечные значения ограничиваются; имена 1..48 символов; до 16 пресетов. Native DNG bytes/bitmap в библиотеку НЕ записываются. Отказ хранения / повреждённый JSON не блокирует редактор.
- `src/main.js`: RAW Properties Save/Select/Apply/Delete. Сохранение использует подтверждённое `rawDng.development`. Применение повторно вызывает `inspectDng → developDng → PNG preview` с прежними session/layer/lock/generation guards и **одним** History commit. Undo/Redo работают с RAW состоянием, `.zpe` хранит исходный DNG и применённые RAW настройки, но не глобальную библиотеку рецептов.
- `tools/build-bundle.mjs` включает новый модуль, `tools/browser-raw-dng-check.mjs` проверяет настоящий Chromium `file://` save→reset→apply→Undo/Redo→.zpe reopen→delete, точные PNG RGBA/незатронутый DNG и существующие RAW/PSD/PSB регрессии.

## Проверки и ограничения

- Unit `tests/dng-presets.test.mjs` **3/3 PASS**, совместно с `tests/dng-tonal-controls.test.mjs` 8/8 PASS; `npm run build` и `git diff --check` PASS до обновления docs/version; RAW browser Chromium `file://` **PASS** после исправления UI выбора пресета после rerender (первый прогон FAIL именно тестового сценария). Повторный Windows `npm run check`: **1780 total / 1765 PASS / 10 SKIP / 5 FAIL**, все 5 прежние Linux-only `/proc`/cgroup; нет новых regression FAIL. **Полный Windows Chromium `npm run test:browser` PASS exit 0** (большая регрессия PSD16/PSB32/native Worker/IndexedDB). Это не Linux CI и не Photoshop-authored oracle.
- Synthetic TIFF/CFA и собственный pixel oracle не подтверждают точность независимой camera authored DNG/LibRaw; в browsers с disabled storage запись рецепта не поддерживается, выводится error. PSD/PSB — только rendered RGB raster, не DNG.
- [#397](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) OPEN, head `bf6dd662`, 13/13 checks core+independent SUCCESS, reviews 0; [#398](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398) OPEN stacked head `05c48eb`, 0 checks/reviews; main `ddd90d3` exact core CI SUCCESS. Linux CI нового локального кода NOT RUN.

## Далее

После отдельного разрешения и gates завершить #397 → #398 → локальный RAW integration PR. Независимая следующая реализация при закрытых remote gates — schema-validated JSON export/import библиотеки пресетов без экспорта raw bytes. [NEXT](NEXT.md) · [матрица](CAPABILITY_MATRIX.md).

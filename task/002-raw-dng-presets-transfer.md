# CAP-RAW-DNG-PRESET-EXPORT-IMPORT — 1.47.16 (LOCAL)

**Дата:** 2026-11-23. **Ветка:** `feat/raw-development-presets-20261123` поверх локального 1.47.15 (`9eeb987`), stacked над #398. **Статус:** bounded implementation LOCAL, remote gate IN PROGRESS; НЕ main/PR.

## Реальная функция

- `src/formats/dng-presets.js`: переносимый файл `ZeTer-RAW-presets.json` с идентификатором `zeter-raw-development-presets` и `schema:1`. Не включает DNG/dataUrl/слои/bitmap; только имя и пять RAW коэффициентов плюс enum демозаики.
- `parseRawPresetFile` fail-closed: JSON ≤24000 байт, 1–16 имен, уникальность без учёта регистра, точная нормализация, whitelist top-level/entry/development, finite числовые диапазоны без незаметного clamp на импорте, допустимый demosaic enum.
- `importRawPresetFile` строит новую библиотеку в памяти, по имени заменяет совпадения и сохраняет остальные; ограничения проверяются до единственной атомарной записи localStorage. Ошибка/переполнение/нет storage оставляют предыдущие записи без изменения.
- В RAW Properties кнопки «Экспорт JSON» и «Импорт JSON», реальный Blob download и `<input type=file>`. Перед изменением показывается количество пресетов и замен, отмена безопасна. UI не изменяет слой/History при импорте или экспорте; применение рецепта использует ранее протестированный re-develop с History, Undo/Redo и .zpe source provenance.

## Проверка

- **RED:** тестовый модуль `tests/dng-presets-transfer.test.mjs` не импортировался до реализации (отсутствовал RAW_PRESET_FILE_FORMAT).
- **GREEN:** 3/3 transfer теста + 3/3 базовых preset теста PASS, malformed/duplicate/oversize/extraneous data/quota/limit, collision merge/cross-browser memory store.
- `npm run build`, `node --check src/app.bundle.js`, `node --check tools/browser-raw-dng-check.mjs` PASS.
- **Chromium `file://` RAW E2E PASS:** реальный UI экспорт Blob JSON, удаление localStorage пресета, импорт через File input, отклонение modified payload, отмена пользователем, повторная RAW-проявка в canvas с точными synthetic RGBA пикселями и одним History commit. Существующие RAW/.zpe/PNG/PSD/PSB регрессии также проверены.
- Финальный полный Windows `npm run check`: **1783 tests / 1768 PASS / 10 SKIP / 5 FAIL** — все 5 прежних Linux-only `/proc`/cgroup probes, без новых ошибок после исправления README версии. `tests/version-consistency.test.mjs` PASS; `git diff --check` PASS. Повторный ориентированный RAW Chromium после cancel-import проверки **PASS exit 0**. Широкий Windows Chromium `npm run test:browser` **PASS exit 0**, включая PSD16/PSB32, Worker, IndexedDB, мультисессии; Linux PR-head CI для локального кода NOT RUN, independent camera-authored DNG/LibRaw comparison BLOCKED.

## После этой реализации

Функцию **не повторять**: оставить bounded результат как LOCAL до безопасной интеграции. Точное следующее действие — review/merge #397 при отдельном разрешении, затем retarget+CI/review #398, после этого clean PR для локальной цепочки RAW до 1.47.16 и exact-main CI. [NEXT](NEXT.md) · [матрица](CAPABILITY_MATRIX.md).

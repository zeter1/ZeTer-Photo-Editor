# 002B/2a — Photoshop-published PSD16/PSD32 Chromium native-layer parity

**Приоритет:** P0, часть открытого 002B/2. **Статус:** IN PROGRESS. **Дата:** 2026-10-19.

## Цель

Существующий 002B/1 сравнивает Adobe Photoshop-published native embedded merged composite через Node, но **не проверяет настоящий публичный** Chromium `file://` File → Open PSD/PSB → File → Save Project. Этот подэтап проверяет сохранность редактируемых native raster layer bytes для трёх SHA-pinned независимых PSD16/PSD32. Это не Photoshop-authored PSB32.

## Изменения

- Новый `tools/browser-photocraft-import.mjs` использует существующий headless Chromium/CDP harness и настоящий `#fileInput`, без вызова приватного состояния редактора.
- После импорта ждёт публичного статуса, размера холста и панели слоёв; нажимает публичное меню Save Project; независимо проверяет metadata и перекрытие/полноту v1/v2 native pixel serialization. Сопоставляет полные SHA-256 каждого 16/32-bit raster layer с `decodePsd` оригинального Adobe-published Photoshop PSD в Node. Входные bytes сами проверяются против независимого SHA-256.
- Добавлены отрицательные тесты receipt tampering/неподдерживаемого PixelBuffer; `ci.yml` передаёт уже скачанный SHA-pinned корпус в реальный браузерный smoke. Production, bundle и версия не менялись.
- `PSD32 != PSB32`. Проверка native-layer codec/transport **не означает Photoshop reference render, correct Levels/Curves compositing, GPU/ICC, full editing/Undo-Redo, Photoshop file authorship certification**.

## Критерии закрытия

1. PR CI `npm run check` и настоящая Chromium `file://` матрица из **трёх** independently pinned Photoshop PSD cases зелёные без skip.
2. PR merge, exact-main CI success на merged SHA.
3. Сохранность SHA-256 native source для каждого raster layer, imported Layers panel и читаемого .zpe подтверждены в CI.

**Осталось для 002B/2:** независимый Photoshop-authored PSB32 с лицензией, origin/authoring, immutable SHA-256 + verified composite; общий PSD16+PSB32 audit → Worker → браузерная History/Undo/Redo/коррекции и внешние reference renders. Пока PSB32 отсутствует, весь 002B/2 и 002 остаются открытыми.

## Текущая проверка

PR, CI, merge и exact-main ещё не подтверждены. Локальный `npm run check` недоступен без checkout: GitHub DNS в окружении отсутствует. Не закрывать подэтап до зелёных checks.

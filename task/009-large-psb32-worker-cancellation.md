# 009 — Stage 003: PSB32/CMYK Worker and cancellation

**Статус:** реализация предложена в ветке `test/stage003-large-psb32-worker-cancel-20261011`, ожидает PR CI, review, merge и exact-main CI; **НЕ завершена**. 008 закрыта, 002 и 003 открыты.

## Цель
Проверить настоящий Chromium file:// UI import >8 MiB (не микрофикстура) PSB Float32 и/или CMYKA32 → native v2 → Content-Aware Fill Worker → preview → Undo/Redo. Отдельно проверить отмену во время реально pending Worker и отсутствие частичной публикации.

## План / критерии
- [x] Детерминированная ZeTer-generated PSB32 RGB Float32 1025×1025 (>8 MiB, <48 MiB) с нормальными/повреждёнными native pixels; это НЕ Adobe golden.
- [x] Node decode + adaptive tiled source v2; sample oracle и точные little-endian Float32 биты на трёх координатах.
- [x] Код теста Chromium file://: #fileInput + Save Project v2 sample parity + реальный Worker + одна Fill History запись + preview/Undo/Redo. Реальный browser CI пока не подтверждён.
- [x] Код теста race: после настоящего ответа Worker удерживается только доставка результата, UI блокирует живой слой, isCurrent/poll завершает Worker; после доставки stale reply проверяются отсутствие второго Fill, сохранность preview и native source. Это проверка **pending reply** (не CPU-bound termination или mid-kernel cancellation).
- [x] Stage markers и sampled renderer/process memory; значения информативны, **не** full native/Worker RSS peak.
- [ ] PR CI и точный merge-SHA main CI успешны; документация 009 и NEXT синхронизирована.

## Другие открытые gates
- Stage 003: dense ROI adaptive strip/segment grouping, aggregate budgeting, гарантии Worker/cooperative parity и точной mid-stage cancellation.
- Stage 002 P0: лицензированный сторонний Photoshop-authored high-depth PSD/PSB, pin SHA-256 + independent reference renders.
- CMYK/ICC soft-proof parity, RAW/DNG, ML/GPU и сложные Photoshop interoperability особенности пока не считать закрытыми.

Правило: завершённость = код + тесты + PR + merge + exact-main CI, а не факт наличия тестового файла.

## Подготовленная реализация 009 (ожидает CI)

- `tools/browser-high-depth-fixtures.mjs` — `rgb32psblarge`, ZeTer-generated RGB Float32 PSB32 (1025×1025×4×4 = 16 810 000 native bytes), общий bounded fixture factory.
- `tests/browser-high-depth-fixtures.test.mjs` — PSB decode, три sample-point LE bit-oracle, v2 serializer и budget.
- `tools/browser-large-psd16-smoke.mjs` — тот же production UI smoke обобщён для PSD16 и PSB32; в PSB-ветке заморожен ответ **реально выполненного** Worker, затем UI layer lock, termination и source/history/preview safety. Сама kernel cancellation **не моделируется**.
- `tools/browser-smoke.mjs` — запускает оба сценария при `npm run test:browser`.
- Необходимо: дождаться CI, исправить найденные regression, review/merge, проверить exact-main CI SHA. Не объявлять 009 завершённой заранее.

## Дальнейшие проходки

1. Реальная mid-kernel cancellation на широком dense/connected ROI, без head-of-line sync stalls; контроль aggregate ROI budget и Worker/cooperative byte parity.
2. Независимые лицензированные Photoshop-authored PSD16/PSB32 (Stage 002) с URL/лицензией/SHA-256 + cross-app reference.
3. Реальная Worker/Chromium peak memory (sampled CDP не является пиком), CMYK/ICC fidelity и RAW pipeline.

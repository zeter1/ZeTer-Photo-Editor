# 003X/6c-7 — immutable native History snapshot ownership

**Приоритет:** P1. **Статус:** BOUNDED DONE (PR #365 принят, exact-main core 12/12 и independent real-photo SUCCESS). **Зависимости:** 003X/6c-6 DONE: PR #363, exact-main Linux core 12/12 и отдельный real-photo SUCCESS. **Независимая блокировка:** 002B/2c: проверяемое Adobe Photoshop-authored PSB32 остаётся BLOCKED.

## Цель и критерии приёмки

- На реальном пути `snapshotDocument -> HistoryStack.reset/push -> undo/redo/jump` измерить **отдельно** исходные URL документа и суммарные URL внутри **каждой** сохранённой JSON-строки History.
- Не эвристически оценивать heap, а локализовать реально повторяемые URL и ввести безопасный **опциональный** лимит их удержания, не меняя существующий default и формат `.zpe`.
- Сохранить нативные биты RGB16 / CMYKA32 Float32, including signaling NaN payload, negative zero, alpha, edge/sparse/dense tiles, порядок истории, ветвления, Reset/clear и существующий byte-budget.
- Показать red-before / green-after, выполнить Node/browser CI, финальное принятие PR и exact-main только после проверок.

## Наблюдения: точные владельцы и счётчики

В `src/core/state.js` `snapshotDocument` использует `JSON.stringify(doc)`; каждое изменение имени или одного тайла создаёт **новый полный JSON-снимок**, и каждый неизменённый native Data URL записан заново. `HistoryStack` хранил эти полные immutable строки в `entries[].snapshot`; документ UI отдельно хранит исходные URL в `highDepthSource`. Нельзя утверждать, что JS-движок непременно дублирует физическую память: ниже **только длины сохранённых значений строк**. Во время `JSON.stringify` также существует временное формируемое JSON-значение, но его реальный heap peak не измерялся.

Измерение тестом `tests/003x6c7-history-native-retention.test.mjs`: 131 × 99 пикселей, тайл 32, три последовательных snapshots `A/B/C` (B сохраняет прежний source, C меняет один пиксель). Первые две истории сохраняют те же URL байт-в-байт.

| Метрика, символы | RGB16 | CMYKA32 Float32 |
| --- | ---: | ---: |
| Источник UI / URL native tiles (каждый уникальный документ) | 139 352 | 346 856 |
| JSON History A | 142 052 | 349 585 |
| JSON History B | 142 055 | 349 588 |
| JSON History C | 142 056 | 349 589 |
| Native URLs в трёх retained History entries без opt-in | 418 056 | 1 040 568 |
| Native URLs с явным лимитом в две копии | 278 704 | 693 712 |
| Удалённый из History native URL объём (по символам, **не** RAM) | 139 352 | 346 856 |

Дополнительно отдельно измерены тайлы 65 и 256 (sparse/edge/dense), точные результаты выводятся диагностикой теста. Все URL исходного документа, оставшихся snapshots и сериализуемого `.zpe` остаются байт-точными; отмена, возврат, переход и создание новой ветки не меняют содержимое источника.

## Реализация

1. `src/core/history.js`: новый **явно включаемый** параметр третьего аргумента `new HistoryStack(limit, byteLimit, { maxRetainedNativeDataUrlChars })`; по умолчанию `null`, действуют только прежние byte/count limits.
2. `retainedNativeDataUrlChars()` измеряет суммарное число символов `data:application/x-zeter-pixel-buffer[(-tile)];base64,...` внутри всех сохранённых снимков. Линейное сканирование исходного JSON без создания больших Base64-срезов и декодирования пикселей; результаты неизменяемых строк кэшируются по entry, изменяемые object snapshots пересчитываются.
3. При opt-in превышении лимита `push` удаляет **только старые** entries по существующему правилу вытеснения. **Последняя/текущая запись никогда не удаляется**, даже если одна превышает лимит. Ветви Undo/Redo, byte-limit и count-limit сохраняют прежние semantics; невалидные значения параметра отклоняются.
4. `tests/003x6c7-history-native-retention.test.mjs`: production snapshot/restore, native v1/v2 `.zpe` bit oracle, tile sizes 32/65/256, отказ сериализации до commit, ветвление/jump/clear/reset, нулевой бюджет, Unicode, stale object mutation и отсутствие эвакуации без opt-in.
5. Browser `file://` bundle синхронизируется стандартным `npm run build`; нативные PSD/PSB кодеки не изменяются. Никаких новых обязательных зависимостей.

## Тесты и выпуск

- **Red-before:** 0/3 нового теста на `main` (отсутствует `retainedNativeDataUrlChars`, opt-in неизвестен).
- **Green focused:** новый suite + существующие `history-native-byte-budget` / `history-retention-contract`: 10/10 PASS, 131×99 16/32-bit сохранены.
- **Локальный Windows `npm run check`:** 1 557 PASS, 10 SKIP, 5 FAIL (известные Linux-only `/proc` / cgroup fixture тесты); остальные тесты прошли. **Настоящий Chrome `file://` smoke:** PASS (exit 0), включая native PSD16/PSB32 Worker, отмену, Undo/Redo и IndexedDB recovery. **Детерминированный build:** `ca5e3daaeb698e28` (повторная сборка совпадает). Linux PR-head 12-job core CI, independent real-photo, merge и exact-main **успешно подтверждены** (ссылки ниже).
- **GitHub:** [PR #365](https://github.com/zeter1/ZeTer-Photo-Editor/pull/365), final head `14ddced`: [core #41623127166](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41623127166) **12/12**, [real-photo #41623127060](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41623127060) **SUCCESS**; squash-merged [main `f44d35b`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/f44d35b7cb22364c23e8702de0e1a447a2943312). Exact merged-main [core #41623966381](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41623966381) **12/12** and independent [real-photo #41623966385](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41623966385) **SUCCESS**. No blocking reviews.

## Ограничения и дальнейшая работа

Бюджет выражен в **символах URL внутри сохранённых immutable JSON**. Это не лимит общей памяти, не доказательство того, какие строки deduplicated в V8, не предельный peak во время сериализации и не потолок памяти Worker или OS RSS. При opt-in старые Undo entries намеренно вытесняются по бюджету (ровно как при прежнем byte-limit); при слишком маленьком лимите остаётся только текущая запись. Маска, recovery и PSD/PSB сериализация не меняются. Итоговый opt-in не включён глобально, чтобы не потерять старые Undo-позиции пользователя без явного решения.

**Следующее P1:** [003X/6c-8 — shared History native URL owner / non-destructive snapshot delta](003x6c8-history-snapshot-sharing.md): измерить удерживаемые значения при полном `snapshotDocument`, оценить обратимо разделяемые immutable URL между snapshots без внезапного вытеснения Undo, доказать устойчивость к eviction/jump/cancellation и exact native bytes; не заявлять heap/RSS без измерения. Parent 003X / Stage 6 остаются IN PROGRESS.

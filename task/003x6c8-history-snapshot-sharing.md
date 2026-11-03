# 003X/6c-8 — shared immutable native URL owner in History

**Приоритет:** P1. **Статус:** IN PROGRESS (код и Windows-проверки готовы; PR, Linux CI и exact-main ещё ожидаются). **Зависимости:** 003X/6c-7 opt-in History URL character budget; parent 003X/Stage 6 IN PROGRESS. **Отдельная блокировка:** реальное Adobe-authored PSB32 002B/2c BLOCKED.

## Цель

Найти и уменьшить *реально повторённые* native Data URL payloads между полноценными `snapshotDocument`/History состояниями, сохраняя столько же Undo-позиций без ручного opt-in eviction. Исследовать обратимую сегментацию / copy-on-write immutable snapshots; проверить идентичность точных JSON результатов, а не только визуальное превью. Избегать недоказанных предположений о V8 interning или физической RAM.

## Критерии готовности

1. Red-before/green-after и независимые измерения всех retained объектов: UI native source, сериализационная JSON-строка, несколько History snapshots, возможные сегменты/части и временные декодированные строки.
2. Proof of exact History Undo/Redo/jump, branching, count/byte budget eviction, failed later serialization, reset/clear, stale owner / cancel и workspace sessions; ни одно редактируемое состояние не должно изменяться из-за sharing.
3. Доказать байт-в-байт сохранение `.zpe` v1/v2 и PSD16/PSB32 native sources: sNaN, signed zero, alpha и edge/sparse/dense.
4. Минимальный, обратно-совместимый интерфейс; старые external `HistoryStack.entries[].snapshot` и generic object snapshots не ломать. Если безопасный выигрыш пока не доказан — не включать sharing по умолчанию.
5. Node regressions, настоящий Chrome/Chromium `file://`, сборка/parity, Linux core 12 jobs и независимый real-photo PR CI; merge только после зелёных проверок, затем exact-main. Обновить `task/NEXT.md`, `task/README.md`, эту задачу, parent и `CHANGELOG.md`.

## Текущая граница

003X/6c-7 дал отдельный opt-in cap на **количество символов** native URL в удерживаемых History JSON, а не уменьшение объёма единственного snapshot или измерение heap/RSS. Этот этап не закрывает все memory/transient/Worker вопросы. Начинать с актуального main/PR и не повторять завершённый 6c-7.

## Проходка 2026-11-03 — кандидат реализации; PR/CI/merge ещё не приняты

Цель: хранить идентичный native v1/v2 Data URL в нескольких immutable JSON-снимках только одним байтовым owner, не теряя Undo-позиций и исходный JSON. При чтении entries[].snapshot точная строка восстанавливается из отдельных сегментов; external setter сохраняется. Generic HistoryStack без opt-in не меняется.

Изменённые файлы: src/core/history.js, src/main.js, src/workspace/session-controller.js, tests/003x6c8-history-shared-native-urls.test.mjs; rebuild src/app.bundle.js, index.html, version.json; task/NEXT.md, task/README.md, task/003x6c8-history-snapshot-sharing.md, task/003x6c9-history-sharing-profile.md, task/003x-native-tile-ownership.md, CHANGELOG.md.

131×99 tile32: RGB16 — UI native URLs 139352 chars, JSON snapshots 142052/142051/142053 chars; History logical native URLs 418056 chars across three Undo points; unique pooled History native URL bytes 139352. CMYKA32 Float32 — UI URLs 346856 chars, JSON snapshots 349585/349584/349586 chars; History logical native URL chars 1040568, pooled native URL bytes 346856. Distinct tile URLs; payload exactly checked (sNaN, -0, alpha). These are not complete JavaScript heap/RSS, and exclude UI source, non-native UTF-16 segments and temporary reconstructed strings.

Red-before: 0/2 new tests. Green: 4/4 focused new tests; legacy History 12/12 before adding fourth benchmark; first Windows npm run check: 1560 PASS, 10 SKIP, five known Windows-incompatible Linux /proc/cgroup fixtures FAIL. Real Chrome file:// browser-smoke exit 0; genuine Worker cancel/Undo/Redo/multi-session and ZeTer-authored PSD16/PSB32 synthetic format tests, not independent Adobe-authoring evidence. Deterministic source build 33644886f38cd40f. CI on final PR-head, separate real-photo workflow, merge and exact-main PENDING.

Safeguards: collision-checked byte equality, reference counts and deletion on branch/count/byte-budget/cap/reset/clear; failed allocation does not erase redo. Old logical byte and URL char budgets unchanged; generic object snapshots stay mutable. Unresolved: measured total heap/GC/latency/Worker ownership and large-document performance; tracked as 003X/6c-9. Parent Stage 6 IN PROGRESS, independent Photoshop-authored PSB32 002B/2c BLOCKED.

Status remains IN PROGRESS until green GitHub PR-head Linux core 12 jobs plus independent real-photo, successful merge and exact-main gates.

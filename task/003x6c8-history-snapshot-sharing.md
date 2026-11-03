# 003X/6c-8 — shared immutable native URL owner in History

**Приоритет:** P1. **Статус:** TODO (после bounded acceptance 003X/6c-7). **Зависимости:** 003X/6c-7 opt-in History URL character budget; parent 003X/Stage 6 IN PROGRESS. **Отдельная блокировка:** реальное Adobe-authored PSB32 002B/2c BLOCKED.

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

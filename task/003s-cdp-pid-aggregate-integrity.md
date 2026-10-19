# 003S — CDP PID integrity before Chromium memory aggregation

**Приоритет:** P1, Stage 003. **Статус:** IN PROGRESS (2026-10-19).
**Зависимости:** 003R DONE, 024/025/026/027/028/031 memory evidence реализованы.
**Базовая ветка:** `main` at `0fb513ba3792009155e5e5c6f6e6c5203824d731`.
**Ветка:** [fix/stage003-cdp-pid-integrity-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/fix/stage003-cdp-pid-integrity-20261019).

## Обнаруженная ошибка

В `tools/browser-renderer-heap-sampler.mjs` CDP `SystemInfo.getProcessInfo`
проверял duplicate/invalid PID **только** для census процесса. При этом
`privateMemory` суммировался даже у записей без PID, с повторным PID
или с нецелым/нулевым PID. Итоговый `sampledMaxPrivateBytes` мог быть
арифметически верным, но относиться к невалидному набору процессов.
Отдельный RSS sampler уже требовал complete PID set; два независимых
RAM-счётчика необоснованно расходились в правилах допуска.

## Цель и критерии приёмки

- [x] Reject CDP snapshot with absent, unsafe/zero/fractional or duplicate PID
  **before** privateMemory, RSS и PID lifecycle aggregation.
- [x] Не отключать независимые renderer JSHeap / Worker target census на плохом
  process snapshot.
- [x] Missing/invalid final PID set не получает устаревшие `endPrivateBytes`,
  `endAggregateRssBytes`, не симулирует exit/Worker→PID.
- [x] Прежняя независимость: при **валидных** PID отсутствие
  `privateMemory` не блокирует реальный Linux RSS.
- [x] Regression tests: four classes poisoned PID and valid baseline →
  duplicate PID at finish, no RSS reads for bad set.
- [ ] `npm run check`, Chromium `file://` PSD16/PSB32, artifact verification
  и generated parity реально прошли на PR CI.
- [ ] PR review/merge и exact-main CI на конкретном SHA.

## Изменённые файлы

- `tools/browser-renderer-heap-sampler.mjs` — single fail-closed PID gate
  for **all** process-wide metrics, no misleading privateMemory sum.
- `tests/browser-renderer-heap-sampler.test.mjs` — референсные CDP snapshots
  с явными PID; negative regression for duplicate/missing/noninteger PID
  and stale finish memory.
- `task/003s-cdp-pid-aggregate-integrity.md`, `task/003-tiled-content-aware.md`,
  `task/NEXT.md`, `task/README.md` — карта этапа и проверяемая история.

## Границы и результаты проверок

На момент первоначального коммита локальный полный checkout недоступен
(контейнер не разрешает DNS github.com). Не считать корректность логики
прохождением `npm run check` до реальных результатов GitHub Actions.
Изменения относятся только к диагностическому test harness, не к runtime,
`.zpe`, PSD/PSB codec, native bytes или версии редактора.
`privateMemory`, VmRSS и VmHWM всё ещё **sampled/process-lifetime**;
никакого доказательства exact operation RSS peak или Worker target→Linux PID.
Недостоверные process counters теперь явно `unavailable`, а не 0.

**PR/CI:** pending; дополнить ссылками и exact statuses после проверки.

## Что осталось и следующая работа

1. Проверить PR CI, Chromium `file://` и артефакты; устранить нарушения,
   затем (при разрешённом зелёном gate) merge и exact-main verification.
2. **P1 / [003](003-tiled-content-aware.md)**: методика operation memory
   evidence для реальных high-depth browser операций; отдельно документированная
   PID attribution, если CDP действительно даёт проверяемое соответствие;
   иначе `workerPidMapping:'unknown'`.
3. **P0 / [002B/2c](002b2c-photoshop-psb32-provenance.md)** BLOCKED:
   нужен законный Photoshop-authored PSB32 + provenance/reference goldens.

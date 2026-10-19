# 003T — operation high-depth memory evidence, provenance and coverage

**Приоритет:** P1. **Статус:** TODO. **Этап:** 003 (не закрыт).
**Зависимости:** [003S](003s-cdp-pid-aggregate-integrity.md), [025](025-browser-worker-target-census.md), [024](024-browser-operation-memory.md), [026](026-browser-memory-sample-coverage.md), [037C-3c](037c3c-final-acceptance.md).
**Причина:** sampled CDP `privateMemory` и Linux `VmRSS/VmHWM` — не true operation RAM peak; `Target.getTargets`/ `SystemInfo.getProcessInfo` не доказали target→OS PID.

## Цель

Получить более достоверные **реальные** Chrome `file://` high-depth PSD16/PSB32 memory receipts, не выдавая наблюдаемые samples или process-lifetime HWM за точный operation peak.

## Критерии готовности

- [ ] Выбрать и описать применимый для Chromium CI способ наблюдения памяти
  с точными границами: какой процесс/контейнер, какой момент операции,
  sampling gaps, создание/завершение processes и переиспользование PID.
- [ ] Если возможно доказательно измерить operation peak — привязать замер
  к изолированной операции и проверить метод независимой контрольной нагрузкой.
  Иначе сохранить `unknown`, `sampledMax` и явную причину недоказанности.
- [ ] Любое Worker→PID связывание — **только** документированный проверенный
  join CDP/OS identity (PID + process starttime), без timing-эвристики,
  совпадения количества targets/процессов или URL/title утечек.
- [ ] Настоящие Chromium `file://` PSD16 и PSB32 с memory evidence на
  больших high-depth tiled операциях: UI Fill, cancel/retry, Undo/Redo,
  сохранение native 16/32-bit пикселей, без избыточных full-frame копий.
- [ ] Отрицательные тесты: пропущенные start/finish snapshots, краткоживущие
  processes/targets, частичная /proc доступность, reused PID, невозможность
  доказать true peak. Проверить fail-closed JSON evidence/artifact parser.
- [ ] Пройти `npm run check`, browser smoke, реальный memory/artifact CI
  и после PR merge — exact-main CI; все ссылки/статусы записать в task.

## Ограничения

P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) — BLOCKED без лицензированного Photoshop-authored PSB32 + provenance/reference render.
Проверка memory не подтверждает Adobe-authoring или совместимость с Photoshop.
Не подменять число кратковременных выборок точным RSS peak, sum VmHWM
и не изобретать Worker-specific RSS.

# 025 — browser CDP Worker target census (010E-B4 / 024B3)

**Статус (2026-10-14):** код и регрессии подготовлены в `feat/025-browser-worker-target-census`; merge/PR CI и exact-main CI пока **не подтверждены**. Это только диагностический подпроход Stage 003.

## Цель и границы

Существующие `SystemInfo.getProcessInfo` и Linux `/proc/<pid>/stat` дают снимки **процессов**, но не доказательства, какой процесс выполняет конкретный редакторский Web Worker. Новый независимый `Target.getTargets` census собирает только `targetId` и `type` для `worker`, `shared_worker`, `service_worker` (без локальных `url`/`title`). Целевой `targetId` — не PID; только одновременные снимки двух API **не устанавливают** соответствие между ними.

### Сделано в коде (требует CI gate)

- [x] `tools/browser-worker-target-census.mjs`: атомарная валидация snapshots, счётчики появлений/пропаж, типы, last-seen и `provenWorkerTerminationCount:null`; никакой автоматической атрибуции PID.
- [x] `tools/browser-renderer-heap-sampler.mjs`: отдельный polling browser-level `Target.getTargets`, не ломает renderer heap/privateMemory/Linux RSS при отказе Target domain, не делает повторные вызовы после отказа.
- [x] `tools/browser-operation-timeline.mjs`: `memory.workerTargets` переносится в настоящий Chromium `file://` operation JSON (PSD16/PSB32). `tools/browser-operation-artifact.mjs` отклоняет ложный `workerPidMapping`.
- [x] `tests/browser-worker-target-census.test.mjs`: unit checks target churn, duplicate/reused IDs, no title/url leakage, independent CDP failure.
- [ ] `npm run check`, реальный Chromium `file://` worker smoke, Node artifacts, CI на ветке/PR, merge, exact-main CI.

## Чего НЕ доказали

- В `Target.getTargets` нет достоверного поля `pid`, а `SystemInfo.getProcessInfo` не возвращает `targetId`. Простое сопоставление времени, порядка или единственного нового процесса — **эвристика**, её нельзя превращать в mapping.
- Отсутствие target в следующем опросе не доказывает завершение Worker. JS heap, CDP privateMemory, Linux VmRSS и VmHWM являются различными метриками. Нет точного operation-wide RAM peak или Worker-specific RSS.
- Chrome мог не показать краткоживущий Worker между polls; отсутствие `Target.getTargets` должно значить `unavailable`, а не пустой census.

## Следующая проходка (после CI)

1. **P0 / [002](002-psd-compatibility-corpus.md):** независимо Adobe Photoshop-authored и лицензированные RGB16 PSD + CMYK32 PSB, проверенный provenance/source URL/license/SHA-256 и сравнительный внешний render oracle. Не генерировать фиктивные Golden из ZeTer.
2. **P1 / 025B:** исследовать *официально документированный* и тестируемый CDP способ `targetId`→OS `pid` для конкретной версии Chromium; при отсутствии оставить `unknown`. При наличии — проверять PID+starttime, повторное назначение и failures, избегать выводов по совпадению момента появления.
3. **P1 / 024C:** измерить browser process lifecycle и ограничения `/proc` при настоящем PSD16/PSB32 cancel→retry в CI, отдельно результаты per-process и aggregate; проверять отказ, если API закрыто. Не объявлять sampled max настоящим peak.
4. **P2:** отдельные внешние PSD round-trip semantic/render fixtures (groups/masks/adjustments/text) с явным списком неподдержанного.

**Правило завершения:** чекбокс CI не отмечать до зелёного PR + merged + зелёного exact-main SHA. 002/003 в целом остаются открытыми.

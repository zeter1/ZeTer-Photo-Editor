# 023 / 010E-B3B — общий лимит операций планирования oversized native ROI

**Статус:** слито в `main` через [PR #204](https://github.com/zeter1/ZeTer-Photo-Editor/pull/204), squash `732ef976040f539974ea1d267c2e3f573d6970db`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161611345), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161771493) (2026-10-11). Stage 002/003 **не закрыты**.

## Мотивация

После 022 кооперативный планировщик делает checkpoint каждые 32 768 посещений, но несколько попыток fallback для одной сильно фрагментированной маски могут снова и снова проходить всю selection. Нужно ограничить **сумму**, а не только один проход.

## Сделано в этой проходке

- [x] Общий предел 4 194 304 учётных операций для oversized ROI: обход выбранных индексов, tile-group probes, membership, strip/layout passes, сбор frozen donor bitmap и region masks.
- [x] Адаптивные горизонтальные runs / connected run bands используют тот же budget-counter. Перед обоими ограниченными сортировками резервируется детерминированная стоимость `16 * selectedIndices.length`, дополнительно учитываются обходы runs, adjacency probes и составление индексов.
- [x] При превышении лимита выбрасывается `RangeError` **до** вызова `readRegion`; существующий private/atomic publication contract остаётся неизменным.
- [x] Добавлена native регрессия near-solid 640×640 RGB16/CMYKA32: deterministic refusal у sync / cooperative / Node Worker, без мутации исходных tile payloads. Отдельно проверяется cancellation внутри планирования.
- [x] Gate: Node tests, generated artifacts parity, Chromium `file://` smoke, informational profiles и diff hygiene — все success в PR и на точном кодовом коммите `main`.

## Границы и риски

- Это **visit/probe бюджет**, а не SLA по времени, JavaScript sort сравнения — консервативно ограничены суммой `16*n` и жёстким пределом 65 536 элементов; алгоритм сортировки движка не инструментирован.
- Маски, которым нужно больше планирования, теперь будут **детерминированно отклоняться**, даже если старый планировщик мог в конце подобрать ROI. Безопасность предпочтительнее неограниченной работы UI.
- Для малых / single-ROI случаев новый лимит не применяется; точность пикселей и выбранная эвристика при прохождении лимита не меняются.
- Тестовые источники генерируются самим ZeTer; они **не** являются независимо подготовленными Adobe Photoshop goldens.

## Дальше

1. **[010E-B4 (P1)](024-browser-operation-memory.md):** методика operation-wide browser memory/HWM: cross-process renderer/Worker/PID correlation, duration планирование→publish, browser file://; не путать sampled RSS и настоящий peak.
2. **002 (P0):** получить лицензированный Photoshop-authored PSD16/PSB32 CMYK32 + эталонный render, SHA-256, provenance/разрешение использования.
3. **003 (P1):** более широкие real-world ROI и UX восстановления после budget refusal, сравнительный quality/performance benchmark.

# 037C-3c — финальная приёмка genuine-photo native Worker, memory и fail-closed

**Приоритет:** P1. **Статус: TODO (следующая проходка после 037C-3b-3 DONE, 2026-10-18).**

## Цель

Свести уже проверенные на настоящих pinned-photo PSD16/PSB32 (Chromium `file://`) наблюдения по native tile Worker, независимым ROI/quality, отменам, повторным операциям, memory evidence, public Save Project и отказам malformed-result/maxBytes в одну проверяемую **final acceptance matrix**, а не выдавать факт зелёного unit-test за закрытие всего графического редактора.

## Принципы приёмки

- Источник — независимо frozen/hash-pinned CC0 real photo, независимые PSD16/PSB32 native byte SHA-256; не подменять source синтетическим fixture для browser evidence.
- На каждый сценарий — изолированная Chromium session, фиксированная версия, run index, PDF/PSD метаданные, отдельный машиночитаемый receipt и независимый offline validator. Чётко различать байтовую целостность native v2 и 8-bit preview.
- Не заявлять наблюдение пика памяти там, где есть лишь sampled RSS/heap. Не считать недоступные OS counters нулями.
- Проверять public Undo/Redo/History, документные вкладки, отпускание lease, late Worker replies, failed private preview и success-after-cancel.
- Проверить bounded native source budget, fail-closed до selection/Worker, valid retry на обеих bit depths и сохранность соседних вкладок.
- В конце: unit suite, `npm run check`, browser smoke, full real-photo workflow; PR → review → merge → exact-main checks; только тогда отмечать **037C-3c DONE**.

## Следующая проходка — действия

1. Инвентаризировать already-accepted receipts задач 037C-1/2, 037C-3a (6 real Worker и sampled memory), 037C-3b-2a, /2b-1, /2b-2/3a/3b и 037C-3b-3 (malformed alpha/count/outside/NaN/Inf и photo maxBytes/retry). Сопоставить с frozen source/image SHA-256 и отказами.
2. Добавить версионированный **acceptance-ledger** JSON, детерминированный offline validator и negative-tamper/missing-coverage suite: каждый required run должен иметь provenance, format, source SHA, output/native bytes, UI mutation policy, CI evidence.
3. Провести перекрёстную сверку: success ROI/quality и Undo/Redo с native сохранением после reopen; mid-kernel/preview Escape, close/tab switch, late result discard, successor Worker, malformed rejection, memory cap refusal and retry.
4. Прогнать полные unit/Chromium tests и CI; сохранить ссылки на PR, commit и exact-main run. Если ledger выявляет реальный пробел — реализовать конкретный missing scenario, не занижать критерии.
5. Лишь после двух green exact-main checks закрыть 037C-3c и перенести очередь к отдельно незакрытым требованиям.

## Доказательства предыдущей закрытой /3b-3

- [PR #265](https://github.com/zeter1/ZeTer-Photo-Editor/pull/265) → [main 57e03278](https://github.com/zeter1/ZeTer-Photo-Editor/commit/57e03278b695f1b6e1729c3c28958164f8ba50e4).
- [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39144583678) + [PR genuine-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39144583692) — success.
- [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39145086168) + [exact-main genuine-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39145086160) — success.

## Вне области 037C-3c (по-прежнему OPEN)

P0 002 Adobe-authored PSD/PSB compatibility goldens; Stage 003 global tiled memory/performance; colour-calibrated ICC/CMYK; external Photoshop import/export parity; полноценные RAW и HDR workflows. Эти большие направления не закрываются самим 037C-3c ledger.

## Чеклист

- [ ] Полный inventory реальных photo и Worker/quality receipts с frozen source provenance.
- [ ] Independent validator + negative tamper/missing-run tests, подтверждённая полная coverage.
- [ ] Доказанные отдельные success / cancel / failure / retry / native persistence paths.
- [ ] Sampled-memory evidence не подменено peak RAM/VRAM утверждениями.
- [ ] PR CI / genuine-photo CI + exact-main CI / genuine-photo CI green и ссылки в `task`.

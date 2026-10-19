# 037C-3c — финальная приёмка genuine-photo native Worker, memory и fail-closed

**Приоритет:** P1. **Статус: IN PROGRESS (2026-10-19; validation / CI / exact-main still pending).**

## Проходка 2026-10-19 — код приёмки и CI-gate (ещё не DONE)

- **ID / приоритет:** 037C-3c / P1; зависимости: закрытые 037C-1/2/3a/3b-2a/2b/3b-3, independently reviewed photo hash pins. Публичное поведение приложения не меняется.
- **Сделано в ветке:** `tests/fixtures/real-photo/acceptance-plan.json` фиксирует SHA-256 оригинального CC0 фото, обеих PSD16/PSB32 файлов и полный обязательный список 14 сценариев. `tools/verify-browser-real-photo-acceptance.mjs` повторно прогоняет оригинальные strict validators над 42 ожидаемыми receipts (6 import, 6 Worker, 6 memory и 24 failure/race/retry), сверяет каждый уже сохранённый suite-summary без доверия к одному итоговому JSON и создаёт детерминированный SHA-256 checksum ledger с SHA каждого receipt/summary. `tests/browser-real-photo-acceptance.test.mjs` проверяет подмену pins/списка/summary и отсутствие артефактов. `.github/workflows/real-photo-intake.yml` запускает ledger только **после** всей матрицы и выгружает evidence artifact.
- **Границы:** checksum не является цифровой подписью/доказательством происхождения вне GitHub Actions. CI run ID/SHA — контекст выполнения, а не свидетельство успешного завершения. Sampled JS heap, CDP и RSS не объявляются memory peak. Фото создано из настоящего CC0, но PSD/PSB не Adobe-authored. Внешняя Adobe parity / calibrated ICC / global virtual tiles не доказаны.
- **Тесты и CI:** локальный clone/npm check/browser E2E недоступен в этой среде из-за отсутствия DNS/GitHub network для контейнера. Новые тесты и полная Chromium матрица должны получить реальные результаты в PR CI, затем точном main; не отмечать DONE до этого.
- **Изменённые файлы:** `tools/verify-browser-real-photo-acceptance.mjs`, `tests/browser-real-photo-acceptance.test.mjs`, `tests/fixtures/real-photo/acceptance-plan.json`, `.github/workflows/real-photo-intake.yml`, `task/README.md`, `task/NEXT.md`, данный отчёт. Runtime, generated bundle и версия не меняются.
- **Ошибки / блокеры:** наличие и валидность 42 receipts ещё не подтверждены новой CI матрицей; при реальном fail необходимо исправить root cause. Старые открытые PR #108–#126 не связаны с этим кодом.
- **Следующая конкретная задача:** получить PR CI + genuine-photo CI success для точно этого commit, исправить failures, слить разрешённым процессом, проверить CI и photo exact-main **на SHA merge**; после этого закрыть 037C-3c. Далее перейти к [002](002-psd-compatibility-corpus.md) (P0 Adobe-authored PSD/PSB corpus), сохраняя [003](003-tiled-content-aware.md) OPEN.

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

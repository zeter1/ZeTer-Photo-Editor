# 037C-3b-3/2b-2 — genuine-photo malformed Float32 / outside-ROI / maxBytes

**Приоритет:** P1. **Статус: IN PROGRESS.** **Зависимость:** 037C-3b-3/2a и /2b-1 DONE. Родитель: [037C-3b-3](037c3b-3-native-result-memory-cap.md), всё ещё OPEN.

## Цель

На настоящих независимо frozen pinned-photo PSD16/PSB32 в Chromium `file://`, не на синтетических source, получить реальный Worker результат в публичном Content-Aware Fill для 8288px ROI и проверить оставшиеся fail-closed сценарии до публикации результата.

## Последовательность работы

1. На PSB32 Float32 после genuine Worker finish и до UI validation тестовым транспортом заменить цветовой `Float32` сэмпл выбранного пикселя на `NaN` и отдельно `Infinity`; source/tiles от Worker до injection не менять. Публичная ошибка, ноль preview/Fill History, bit-exact native v2 с public Save Project, соседняя вкладка неизменна.
2. На PSD16/PSB32 сдвинуть один цветовой байт **внутри изменённого тайла, но строго за пределами выбранного ROI** при правдоподобных counters; убедиться в точном отказе, без превращения теста в synthetic Worker.
3. В production boundary реального photo layer перед вызовом Worker установить `maxBytes` на 1 ниже `rawBytes`. Публично инициировать Fill: проверка отказа **до** selection sampling и Worker dispatch, тот же native source/history; затем убрать ограничение и успешно повторить Fill. Не подменять native PSD/PSB источник.
4. Создать отдельные версионированные receipts, проверку independently pinned SHA-256, offline verifier и negative tamper suite. Избегать self-asserted успеха.
5. Проверить `npm run check`, браузерные тесты и genuine-photo CI; PR → review → merge → exact-main CI. Только после этого отметить /2b-2 DONE. Затем оценить, полностью ли закрыта 037C-3b-3, и перейти к 037C-3c final acceptance.

## Границы

Это ещё не Adobe-authored PSD/PSB corpus или Photoshop compatibility, calibrated ICC/CMYK, Stage 003 global tiled memory, RAW/HDR completeness. Ничего из этого не отмечать готовым без проверки.

## Приёмка

- [ ] Реальные pinned-файлы, два формата и независимые Chromium session receipts.
- [ ] Non-finite Float32 + вне ROI fail-closed, публичный status и отсутствие изменений History.
- [ ] Реальный maxBytes before Worker отказ и успешный retry.
- [ ] Byte-exact native v2 + frozen SHA-256 + negative tamper suite.
- [ ] PR CI + genuine-photo CI + exact-main CI successful, ссылки сохранены.

## Проходка 2026-10-18 — подготовлены новые проверки (частично)

- Код: `tools/browser-real-photo-switch-failure.mjs`, `tools/browser-smoke.mjs`; strict offline verifier `tools/verify-browser-real-photo-malformed-extra-artifacts.mjs`; негативные тесты `tests/browser-real-photo-malformed-extra.test.mjs`; opt-in workflow `.github/workflows/real-photo-intake.yml`.
- На genuine pinned PSD16/PSB32 добавлены Chromium `file://` запуски после настоящего native Worker. PSB32 NaN/Infinity, PSD16+PSB32 изменённый цвет вне ROI; public error, полные Save Project v2/native bytes, отсутствие preview/History и side-tab mutation проверяются в harness. Не synthetic Worker.
- Ветка: `feat/037c3b3-photo-nonfinite-outside-roi`; локальный Chromium с pinned assets недоступен. PR/genuine-photo/exact-main CI результатов пока нет: **НЕ считать критерии приёмки закрытыми**.
- Осталось: `maxBytes < rawBytes` отказ на реальном импортированном фото до selection sampling/Worker и успешный retry; затем подтвердить 4 browser cases, CI, PR, merge/exact-main и только тогда DONE. Следом 037C-3c.

## 037C-3b-3/2b-2 — результаты слитой матрицы, 2026-10-18

**Статус: IN PROGRESS, maxBytes refusal+retry ещё TODO.** Частичное подтверждение реальными фото не закрывает весь идентификатор задачи.

- [PR #264](https://github.com/zeter1/ZeTer-Photo-Editor/pull/264) **merged** → [main 7194141](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7194141d3b9e6440e211525dcc2ff3ffa8fed667).
- [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39135873883); [PR genuine-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39135873896), четыре изолированных Chromium `file://` сценария на реальных frozen PSD16/PSB32.
- [Exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39136335763); [exact-main genuine-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39136335830) на том же кодовом коммите 7194141.
- Первый PR genuine-photo запуск [39135495538](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39135495538) отказал только по `EEXIST` для двух PSB32 baseline snapshot в общей директории; исправлена изоляция путей, следующие PR/main прогоны успешно прошли.
- Подтверждены post-native-Worker Float32 NaN/Infinity и changed color вне выделения, public invalid error, 0 preview writes/new Fill History, без изменений исходных native v2 tiles/History соседней вкладки, independent verified SHA-256 receipts, negative tamper tests.
- **Остаётся:** production-boundary maxBytes below real imported source rawBytes **до** selection scan/Worker + публичный отказ/точные native snapshots, затем снять лимит и успешно применить Fill в обоих форматах. Только после этой проверки и PR/exact-main CI закрыть 037C-3b-3/2b-2 и перейти к 037C-3c final acceptance.


## Проходка 2026-10-18 — native memory-cap + real photo public retry (ожидает CI)

**Статус: IN PROGRESS**, исходный PR #264 ранее подтвердил четыре malformed-extra сценария; текущая ветка добавляет последнюю часть /2b-2 без изменения frozen native PSD/PSB исходников.

- Production: `src/painting/tiled-inpaint-dispatch.js` — явный `RangeError` с публичным сообщением при `rawBytes > maxBytes`, до любого selection predicate или Worker; одинаково для Worker и cooperative случая; невозможен прежний `null` → случайный high-depth fallback.
- Unit: `tests/tiled-inpaint-ui-dispatch.test.mjs` — `rawBytes-1` и 0 не сканируют ROI и не отправляют job; повтор с `rawBytes` выполняет настоящий native tile algorithm и не мутирует source.
- Browser: `tools/browser-real-photo-switch-failure.mjs`, `tools/browser-smoke.mjs` — отдельные pinned PSD16/PSB32 `file://` сессии с публичным Duplicate Layer до `budget < rawBytes`, public отказ без Worker и native/History утечки, Delete Layer, затем настоящий Worker и public .zpe readback подтверждают сохранённые native tile bytes и Fill History.
- Offline: `tools/verify-browser-real-photo-memory-cap-artifacts.mjs`, `tests/browser-real-photo-memory-cap.test.mjs` — строго два независимых frozen SHA-256 receipts, валидаторы и negative tamper/missing-file tests.
- CI: `.github/workflows/real-photo-intake.yml` — две независимые Chromium сессии, сбор подписанных по именам файлов receipts и offline verifier.
- **Ограничение доказательств:** в этом окружении отсутствуют локальная копия полного репозитория и pinned-photo bundle; `npm run check` и настоящий Chromium запуск локально не подтверждены. Дождаться реального PR CI, genuine-photo CI, merge и exact-main CI, записать URL и результат. До этого НЕ помечать критерии /2b-2 как DONE.
- **Следующая:** после принятия зелёных CI и закрытия /2b-2 — задача 037C-3c final acceptance для матриц Worker/Undo/Redo/quality/memory/fail-closed и лишь затем остальной roadmap.

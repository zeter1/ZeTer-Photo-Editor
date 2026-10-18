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

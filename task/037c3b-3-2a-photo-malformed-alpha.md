# 037C-3b-3/2a — реальный PSD16/PSB32 Worker: испорченный selected alpha

**Статус: реализация предложена в ветке `test/037c3b3-real-photo-malformed-alpha`; CI/Chromium ещё НЕ подтверждены.** Это часть [037C-3b-3](037c3b-3-native-result-memory-cap.md), не закрытие /2 и не полная приёмка 037C.

## Реализовано в этой проходке

- При сохранении настоящего pinned-photo PSD16/PSB32 импорта (через публичный file input и Save Project) UI формирует 8288px connected ROI через 10 публичных polygon-click + Enter.
- Настоящий native Worker вычисляет результат на неподменённом source; тестовый transport wrapper (только Chromium test session) заменяет **один байт selected alpha** в возвращённой native v2 tile **после реального ответа Worker, до UI validation**. Это не подмена всего Worker, не synthetic fixture, не полноценный Photoshop-authored образец.
- Проверяем публичное сообщение `invalid Worker result`, что Worker закончил и был terminate; нет приватных preview tile writes, нет новых Fill History, полные native v2 source tiles совпадают до/после публичного Save Project, другая вкладка сохранила History.
- Для обоих форматов свой свежий Chromium `file://` сеанс, строго совпадающий с pinned source/file/native SHA-256 из `reviewed-*`; отдельные receipts с offline verifier и отрицательными unit tamper тестами.
- В opt-in `real-photo-intake.yml` добавлены отдельный шаг и artifact; запуск pipeline должен подтвердить сценарий.

## Приёмка /2a (пока OPEN)

1. [ ] `npm run check` и обычный Chromium smoke на PR.
2. [ ] CI photo step PSD16 и PSB32 для genuine Worker malformed alpha: **2/2** успешных независимых запусков и offline verifier.
3. [ ] Если обнаружены browser/CI regressions — исправить, повторить все тесты.
4. [ ] Merge и **exact-main** CI + genuine-photo CI успешны, записать номера workflow runs в эту карточку. Только затем пометить /2a закрытой.

## Следующая /2b — ещё НЕ реализовано

- Native Worker malformed counters / non-finite Float32 / outside-ROI / mixed unavailable-through-UI, без публикации native tiles/History на реальном photo PSD16/PSB32.
- Производственный `maxBytes < rawBytes` отказ реального imported photo layer **до** selection scan/Worker dispatch, проверка public status, frozen source/history, после отказа успешный реальный повторный Fill. Не путать с синтетическими unit tests из /1.
- Строгая независимая receipt matrix и CI. После закрытия /2 — 037C-3c final acceptance и затем P0 002, Stage 003, ICC/CMYK, RAW.

**Граница доказательств:** здесь нет measured process peak RAM, Adobe-authored PSD parity, GPU/AI ускорения или полной Photoshop compatibility.

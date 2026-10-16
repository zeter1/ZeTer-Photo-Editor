# 037C-2 — настоящая фотография: Chromium Worker / 8288 ROI / native Undo / Redo / reopen

**Статус: IN REVIEW / CI НЕ ПОДТВЕРЖДЁН (2026-10-16).** Не закрывать 037C-2, пока реальный PR CI на exactly committed code не выполнит 6 отдельных Chromium сессий и пока не будет независимого просмотра receipts. Основа 037C-1: [план](037c-real-photo-chromium-worker-acceptance.md).

## Что изменено в этой попытке

- Новый opt-in флаг `ZPE_REAL_PHOTO_BROWSER_WORKER=1` запускает **после** независимого 037C-1 baseline тот же публичный UI: polygon 10 точек → Content-Aware Fill → Save Project → Undo → Redo → .zpe reopen.
- Не читаем внутреннюю модель редактора: сериализованные native-тайлы читаются из публичного File → Save Project, запрос Worker перехватывается только на границе `Worker.prototype.postMessage`; frozen indices обязаны совпасть со строго заданным 8288 connected ROI.
- Подлинный CC0 JPEG → pinned Pillow `decoded.rgba` → admitted native clean RGB16/Float32 reference `createPinnedPhotoNativeFixture`. В Node перед приёмкой сверяется **замороженный** clean SHA-256, перед сравнением импорт проверен against pinned damaged SHA-256; clean 8288 ROI transport передаётся в Chromium отдельно от редактора.
- Внимательно сверять native words (а не 8-bit Canvas preview) до/после, неизменность alpha и outside-selection, MAE/RMSE against pixel-varying actual photo clean,Undo = исходные тайлы, Redo и reopen = заполненные тайлы.
- Два новых набора негативных Node-тестов: подмена/перестановка ROI, NaN, alpha/outside mutation, no improvement, forged quality/worker/timings/depth/clean pin, отсутствие шести независимых sessions, fabricated peak RAM.
- CI `real-photo-intake.yml` повторно получает genuine pinned JPEG и сохраняет 6 baseline + 6 Worker JSON receipts, валидирует полностью совпадающие clean/defect pins. Выходные артефакты имеют срок хранения 7 суток, PSD/PSB по-прежнему не кладутся в Git.

## Что обязательно проверить в этой проходке

- [ ] PR `npm run check` green, без flaky browser/assertion.
- [ ] Genuine-photo CI: 3× PSD16 + 3× PSB32 свежих `file://` Chromium, **все** Worker receipts valid.
- [ ] Отдельно открыть CI receipts: Worker действительно вызван, 8288 индексов точные; selected MAE/RMSE против clean уменьшились; exact native Undo/Redo/reopen.
- [ ] Merge PR + exact-main оба green (общий CI и genuine-photo CI) и сохранить ссылки в `task/NEXT.md` / `task/README.md`. До этого OPEN.

## Следующие после подтверждения 037C-2

1. **037C-3**: CDP renderer heap / Worker/process RSS с honest missingness; не выдавать сэмплы за peak; отмена, закрытие вкладки, stale-owner, malformed file, memory-cap, late result. **Любой неверный peak = failure**, не 0.
2. **037C acceptance**: независимые CI exact-main links; при необходимости устранить UI race и перепроверить свежие runs.
3. **P0 002** Photoshop-authored golden PSD corpus и **Stage 003** bounded memory/tiled engine. Полная compatibility, calibrated ICC/CMYK/RAW и настоящая 16/32-bit capture по-прежнему не подтверждены.

**Ограничения:** фото-derived 16/32-bit — слова, сконструированные из 8-bit JPEG, а не высокоточное сенсорное фото; это **не Photoshop compatibility**. Эта проходка не измеряет process peak RSS, не проверяет cancellation/error matrix и не завершает список возможностей со скриншота.

# 037C-3b-2b/3b-2a — genuine-photo success-first Worker → publish → Escape

**P1. Статус: код в PR-подготовке; CI / exact-main пока не подтверждены.** /3b-2b (cancel-first → следующий успешный Worker) OPEN.

## Граница проверки
- Независимый Chromium file:// импорт pinned photo-derived PSD16 и PSB32, frozen source/native SHA, selection polygon 8288 px.
- Реальный native Worker возвращает 8288 filled; тест удерживает только cooperative preview yield после минимум двух private tile writes, без fake-result и без изменений production bundle.
- Release preview ДО Escape. Через публичный Save Project доказываем изменение минимум двух полных v2 native tile payloads относительно исходного документа; History содержит ровно один новый Fill.
- Публичный Escape CDP keydown/keyup ПОСЛЕ успешной публикации; повторный public Save Project доказывает byte equality с сохранённым результатом, History и вторая вкладка не меняются.
- Отдельные psd16/psb32 receipts, строгий offline verifier (exact filenames, independent sessions, pins/claims) и negative tests.

## Файлы
- tools/browser-real-photo-switch-failure.mjs — режим completedPreviewSuccess и валидация.
- tools/browser-smoke.mjs — независимый opt-in ZPE_REAL_PHOTO_BROWSER_COMPLETED_PREVIEW_SUCCESS.
- tools/verify-browser-real-photo-completed-preview-success-artifacts.mjs.
- tests/browser-real-photo-completed-preview-success.test.mjs.
- .github/workflows/real-photo-intake.yml — два CI Chromium процесса и выгрузка JSON доказательств.

## Evidence gate
- [ ] npm run check + npm run test:browser на exact PR head.
- [ ] genuine photo PSD16/PSB32 file:// CI + validated receipts.
- [ ] PR merge + exact-main normal CI и genuine-photo CI success, ссылки здесь и в NEXT.

Тестовая задержка preview не доказывает отсутствие других race; Photoshop-authored parity и пиковую память этот этап не подтверждает.

## Далее OPEN
1. **/3b-2b:** cancel-first → successor Worker generation успешно коммитит, injected late first reply не перезаписывает второй результат; полные native v2 snapshots и History в PSD16/PSB32.
2. **037C-3b-3:** malformed native result / maxBytes отказ, fail-closed public UI.
3. **037C-3c:** заключительная 037C приемка.
4. **P0 002**, **Stage 003**, ICC/CMYK калибровка, RAW/HDR, Photoshop-wide compatibility — по скриншоту всё ещё OPEN.

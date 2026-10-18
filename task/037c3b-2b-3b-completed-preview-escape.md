# 037C-3b-2b/3b — настоящий completed Worker → async preview → Escape

**Приоритет P1. Статус /3b-1: реализация в PR; CI и exact-main ожидают проверки; 037C OPEN.**

## /3b-1: cancel-first
- Независимый pinned photo-derived PSD16 и PSB32 Chromium file://, публичный import + Save Project, 8288 polygon ROI.
- Получить подлинный успешный результат native Worker, 8288 filled, не mock и не mid-kernel pause; Worker штатно terminated до Escape.
- Тестовым изменением на отдельной странице перехватить первый cooperative preview yield после не менее двух приватных tile writes. Production bundle и Worker supplier не менять.
- Публичный CDP Escape во время preview, затем возобновить callback: полная native v2 source byte equality, отсутствие Fill в History, вторая вкладка неизменна.
- Проверить отдельные строго именованные receipts, hashes frozen pins, offline verifier и negative tests.

## Для проверки, не считать уже выполненным
- [ ] npm run check, npm run test:browser (точный PR SHA).
- [ ] Два genuine photo Chromium file:// completed-preview Escape; fail-closed verifier, artifacts.
- [ ] PR merge и два exact-main CI; только тогда закрыть /3b-1, обновить ссылки в task.

## Далее OPEN
1. /3b-2 genuine PSD16/PSB32 generation restart cancel-first -> второй Worker success без stale overwrite; success-first -> одна публикация и Escape не откатывает завершённое. Полный native readback/History.
2. 037C-3b-3 genuine malformed native worker / maxBytes refusal, fail-closed public UI, receipts.
3. 037C-3c final acceptance: photo quality/memory/failure matrix, PR + exact-main gates.
4. P0 002 Photoshop-authored corpus; Stage 003 full tiling; ICC/CMYK, RAW/HDR и остальной roadmap скриншота.

**Нельзя утверждать:** Photoshop compatibility, memory peak, Adobe-authored parity, complete 037C. Тестовое удержание preview само по себе не доказательство без зелёного real photo CI.

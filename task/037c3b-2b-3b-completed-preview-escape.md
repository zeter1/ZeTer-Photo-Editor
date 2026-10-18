# 037C-3b-2b/3b — настоящий completed Worker → async preview → Escape

**Приоритет P1. Статус /3b-1: ЗАКРЫТА 2026-10-18 ([PR #257](https://github.com/zeter1/ZeTer-Photo-Editor/pull/257) → [main 04ca338](https://github.com/zeter1/ZeTer-Photo-Editor/commit/04ca33876b3e8a1a4752d5e6e1acf97d705d319b)); /3b-2 и полная 037C остаются OPEN.**

## /3b-1: cancel-first
- Независимый pinned photo-derived PSD16 и PSB32 Chromium file://, публичный import + Save Project, 8288 polygon ROI.
- Получить подлинный успешный результат native Worker, 8288 filled, не mock и не mid-kernel pause; Worker штатно terminated до Escape.
- Тестовым изменением на отдельной странице перехватить первый cooperative preview yield после не менее двух приватных tile writes. Production bundle и Worker supplier не менять.
- Публичный CDP Escape во время preview, затем возобновить callback: полная native v2 source byte equality, отсутствие Fill в History, вторая вкладка неизменна.
- Проверить отдельные строго именованные receipts, hashes frozen pins, offline verifier и negative tests.

## Подтверждённые проверки на точном коде
- [x] npm run check, npm run test:browser (точный PR SHA): [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39122450799).
- [x] Два genuine photo Chromium file:// completed-preview Escape; fail-closed verifier, artifacts: [PR genuine-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39122450793).
- [x] PR merge; [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39122768696), [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39122768707). /3b-1 закрыта.

## Далее OPEN
1. **/3b-2a ЗАКРЫТА:** success-first real PSD16/PSB32 Worker → native publish → public Escape, полные native v2 tiles и History проверены на [PR #259](https://github.com/zeter1/ZeTer-Photo-Editor/pull/259) и [exact-main](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39124473357). [Отчёт](037c3b-2b-3b-2a-photo-success-first.md). **/3b-2b OPEN:** cancel-first и следующий успешный Worker, старое поколение не перезаписывает новое, byte-exact readback/History.
2. 037C-3b-3 genuine malformed native worker / maxBytes refusal, fail-closed public UI, receipts.
3. 037C-3c final acceptance: photo quality/memory/failure matrix, PR + exact-main gates.
4. P0 002 Photoshop-authored corpus; Stage 003 full tiling; ICC/CMYK, RAW/HDR и остальной roadmap скриншота.

**Граница доказательств:** Photoshop compatibility, memory peak, Adobe-authored parity, complete 037C. Тестовое удержание preview само по себе не доказательство без зелёного real photo CI.

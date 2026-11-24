# 037C-3b-3/2b-1 — реальный PSD16/PSB32 Worker: неправильный changed counter

**Приоритет:** P1. **Зависимость:** 037C-3b-3/2a DONE (#262). **Статус: DONE (2026-10-18)**, PR слит и exact-main CI подтверждён.

## Реализовано в коде проходки
- Test-only transport intercept после завершения настоящего Worker (не synthetic payload); он изменяет только `changed` на `changed - 1` при сохранении native tile bytes.
- Отдельный opt-in Chromium `file://` для двух независимых genuine pinned photo-derived PSD16/PSB32; 8288px полигон, публичный Fill и Save Project.
- Отдельные strict receipts с source/native frozen SHA-256, 0 preview/Fill History writes, equality всех native v2 tiles и отсутствием влияния на другую вкладку; offline tamper unit tests.
- Включена самостоятельная матрица в `.github/workflows/real-photo-intake.yml`.

## Критерии закрытия
- [x] npm run check / browser smoke.
- [x] PR CI и genuine-photo CI PSD16+PSB32 success.
- [x] Merge PR и exact-main CI (общий+photo) success.
- [x] Ссылки на PR/коммиты/CI записаны; только тогда DONE.

## Остаётся
037C-3b-3/2b-2: реальные non-finite Float32, outside-ROI и public UI maxBytes refusal перед Worker с retry; затем 037C-3c final acceptance. P0 002 и Stage 003 OPEN. Photo-derived fixtures не доказывают Adobe/Photoshop parity.

## Подтверждённые ссылки и проверки

[PR #263](https://github.com/zeter1/ZeTer-Photo-Editor/pull/263) → [main 410acedf](https://github.com/zeter1/ZeTer-Photo-Editor/commit/410acedf5649a7d52e84650b4978d51dfe3958af); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133594716), [PR genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133594742), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133988525), [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133988451).

- `npm run check`, Node regression suite, generated bundle parity и Chromium `file://` smoke — success в PR/main CI.
- Genuine-photo PSD16/PSB32 isolated 8288px public ROI + real Worker corrupted `changed` и публичный отказ — success на PR и exact-main; 2 разных pinned-format receipts с независимым sha+native v2 oracle.
- Branch: [test/037c3b3-photo-counter-failclosed](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/037c3b3-photo-counter-failclosed); первоначальный [commit 70fda5a](https://github.com/zeter1/ZeTer-Photo-Editor/commit/70fda5a5c6a14fd9c662d71a2e5851e1fbf03b41).

Подэтап DONE. Следующий — [037C-3b-3/2b-2](037c3b-3-2b-2-photo-float-roi-maxbytes.md) TODO.

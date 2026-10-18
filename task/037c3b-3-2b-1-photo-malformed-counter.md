# 037C-3b-3/2b-1 — реальный PSD16/PSB32 Worker: неправильный changed counter

**Приоритет:** P1. **Зависимость:** 037C-3b-3/2a DONE (#262). **Статус: IN PROGRESS**, ожидаются PR и CI.

## Реализовано в коде проходки
- Test-only transport intercept после завершения настоящего Worker (не synthetic payload); он изменяет только `changed` на `changed - 1` при сохранении native tile bytes.
- Отдельный opt-in Chromium `file://` для двух независимых genuine pinned photo-derived PSD16/PSB32; 8288px полигон, публичный Fill и Save Project.
- Отдельные strict receipts с source/native frozen SHA-256, 0 preview/Fill History writes, equality всех native v2 tiles и отсутствием влияния на другую вкладку; offline tamper unit tests.
- Включена самостоятельная матрица в `.github/workflows/real-photo-intake.yml`.

## Критерии закрытия
- [ ] npm run check / browser smoke.
- [ ] PR CI и genuine-photo CI PSD16+PSB32 success.
- [ ] Merge PR и exact-main CI (общий+photo) success.
- [ ] Ссылки на PR/коммиты/CI записаны; только тогда DONE.

## Остаётся
037C-3b-3/2b-2: реальные non-finite Float32, outside-ROI и public UI maxBytes refusal перед Worker с retry; затем 037C-3c final acceptance. P0 002 и Stage 003 OPEN. Photo-derived fixtures не доказывают Adobe/Photoshop parity.

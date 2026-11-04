# 037C-3b-2b/3b-2b — genuine-photo cancel-first → successor native Worker

**P1. Статус: ЗАКРЫТА (2026-10-18).** [PR #260](https://github.com/zeter1/ZeTer-Photo-Editor/pull/260) → [main d31e8ea](https://github.com/zeter1/ZeTer-Photo-Editor/commit/d31e8eacecdc8f3189b28cac9157f019accc6606). Предыдущий /3b-2a success-first уже закрыт; эта проходка проверяет обратный временной порядок, а не повторяет его.

## Контракт
- Для PSD16 и PSB32 запускать по отдельному Chromium `file://` профилю на независимо закреплённом фото-файле и проверенных native byte pins.
- Через UI создать 8288-pixel polygon selection, перехватить **реальный completed Worker** после native результата и минимум двух приватных tile preview writes.
- Нажать публичный Escape, отпустить held preview; полная native v2 baseline byte equality, нет Fill в History.
- Запустить второй Fill через UI. Вторая Worker job до dispatch намеренно удерживается только тестовым перехватчиком: запоздалый ответ **первого** Worker не должен публиковать результат или History.
- Отпустить second native job в настоящий Worker, дождаться реального завершения и изменения ≥2 полных native tile. Проверить один Fill в History.
- Повторно доставить запоздалое сообщение от первого Worker после второго commit; native v2 bytes и History должны остаться byte-exact второму commit, история другой вкладки — без изменений.
- Отдельные JSON receipts на два формата, offline verifier с exact filenames/independent run pins и negative tests.

## Изменения
- `tools/browser-real-photo-switch-failure.mjs` — isolated successor-mode тестовый перехват, две очередные операции, строгий validator.
- `tools/browser-smoke.mjs` — `ZPE_REAL_PHOTO_BROWSER_CANCEL_SUCCESSOR=1`.
- `tools/verify-browser-real-photo-cancel-successor-artifacts.mjs`, `tests/browser-real-photo-cancel-successor.test.mjs`.
- `.github/workflows/real-photo-intake.yml` — двухформатная genuine-photo Chromium приёмка и артефакты.

## Evidence и следующие задачи
- [x] npm run check + npm run test:browser на PR SHA — [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39125440641).
- [x] Genuine-photo PR CI: 2 независимых Chromium `file://` receipts, offline verifier — [PR photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39125440511).
- [x] Merge → [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39125761716) и [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39125761836).
- Далее **037C-3b-3**: malformed native result, maxBytes отказ и public UI fail-closed; **037C-3c**: финальная приемка всего 037C.
- **P0 002**, **Stage 003**, ICC/CMYK calibration, RAW/HDR и Photoshop-wide parity остаются OPEN. Не заявлять полную Photoshop compatibility или измерение peak RAM.

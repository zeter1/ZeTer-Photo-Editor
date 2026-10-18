# 037C-3b-2b/3 — явная отмена Fill и защита поколения до публикации

**Приоритет:** P1. **Статус: кодовый подэтап СЛИТ (2026-10-18) / genuine-photo публичный Escape и полная 037C остаются OPEN.** [PR #254](https://github.com/zeter1/ZeTer-Photo-Editor/pull/254) → [main c1fd910](https://github.com/zeter1/ZeTer-Photo-Editor/commit/c1fd910f1384b77a01b6b585073bca1909816c2a); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39118807311), [PR genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39118807337), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39119079885), [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39119079887).

## Сделано в этом инкременте

- Escape в редакторе отзывает ожидающую Content-Aware Fill через существующий raster command; сохранены приоритет контуров/жестов, Escape внутри модальных окон, обычное снятие выделения без Fill.
- `src/painting/command-controller.js` передаёт `isContinuationCurrent` как identity/generation guard владельцу native tiled mutation.
- `src/painting/controller.js` проверяет этот guard до Worker, после Worker и после асинхронной сборки preview, непосредственно перед native source/dataUrl mutation. Отмена при уже завершившемся Worker теперь не должна записать тайлы/preview или History.
- `tests/content-aware-cancel-generation.test.mjs` проверяет cancellation, late reply, повторный запуск с новым lease и History, completion-before-preview race и успешную новую операцию, плюс расположение Escape handler.

## Граница доказательств

Тестовые native 16-bit tiles **синтетические**, а ответ Worker моделирует byte-exact protocol-valid mutation для окна между Worker completion и preview. Это не настоящая photo-derived Chromium PSD16/PSB32 E2E и не доказательство actual mid-kernel Escape. Оба PR-гейта и оба exact-main гейта успешны на кодовом коммите. При этом публичный photo-derived Escape на настоящих PSD16/PSB32 и настоящий completion-before-preview race ещё НЕ проверены, поэтому 037C-3b-2b/3 и вся 037C остаются OPEN.

## Следующие задачи — брать из этой папки

1. **037C-3b-2b/3a (код/CI подготовлены, приёмка OPEN):** [отдельная проходка](037c3b-2b-3a-photo-escape-mid-kernel.md) — genuine pinned PSD16+PSB32 Chromium `file://`, actual native first-write, публичный Escape, native snapshot/History, injected late-result и строгие receipts. Проверить фактический PR/exact-main CI, затем отдельно selection и object-removal progress.
2. **037C-3b-2b/3b (OPEN):** genuine photo stale-command-generation и completed Worker result → slow preview → Escape, включая success-first / cancel-first, exact native hashes/History; не подменять реальный Worker protocol mock-ом.
3. **037C-3b-3 (OPEN):** malformed native result / maxBytes memory refusal; fail-closed UI без публикации.
4. **037C-3c (OPEN):** полный CI gate PR → merge → exact-main, и только после этого закрытие 037C. P0 [002](002-psd-compatibility-corpus.md), [003](003-tiled-content-aware.md), ICC/CMYK/RAW всё ещё открыты.

## Проверки этой проходки

- [x] GitHub PR `npm run check`, Chromium smoke, `git diff --check` успешны на точном commit в PR #254.
- [x] PR и exact-main CI/фото-проверки успешны, ссылки занесены сюда и в `task/NEXT.md`.
- [ ] Genuine-photo Chromium failure matrix отдельно подтверждена: пока нет, не отмечать как готовую.

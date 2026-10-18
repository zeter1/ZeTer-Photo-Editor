# 037C-3b-2b/3 — явная отмена Fill и защита поколения до публикации

**Приоритет:** P1. **Статус: код в PR, CI и реальные фото-гейты OPEN (2026-10-18).** Это не закрытие всей 037C.

## Сделано в этом инкременте

- Escape в редакторе отзывает ожидающую Content-Aware Fill через существующий raster command; сохранены приоритет контуров/жестов, Escape внутри модальных окон, обычное снятие выделения без Fill.
- `src/painting/command-controller.js` передаёт `isContinuationCurrent` как identity/generation guard владельцу native tiled mutation.
- `src/painting/controller.js` проверяет этот guard до Worker, после Worker и после асинхронной сборки preview, непосредственно перед native source/dataUrl mutation. Отмена при уже завершившемся Worker теперь не должна записать тайлы/preview или History.
- `tests/content-aware-cancel-generation.test.mjs` проверяет cancellation, late reply, повторный запуск с новым lease и History, completion-before-preview race и успешную новую операцию, плюс расположение Escape handler.

## Граница доказательств

Тестовые native 16-bit tiles **синтетические**, а ответ Worker моделирует byte-exact protocol-valid mutation для окна между Worker completion и preview. Это не настоящая photo-derived Chromium PSD16/PSB32 E2E и не доказательство actual mid-kernel Escape. До зелёного CI и фото-браузерной проходки задача 037C-3b-2b/3 остаётся OPEN.

## Следующие задачи — брать из этой папки

1. **037C-3b-2b/3a (OPEN):** genuine pinned PSD16 и PSB32 в отдельных Chromium `file://`; actual native first-write, публичный Escape, snapshot исходных native tiles/History через File → Save Project, late result, негативные receipts. Проверить выделение и object-removal progress.
2. **037C-3b-2b/3b (OPEN):** genuine photo stale-command-generation и completed Worker result → slow preview → Escape, включая success-first / cancel-first, exact native hashes/History; не подменять реальный Worker protocol mock-ом.
3. **037C-3b-3 (OPEN):** malformed native result / maxBytes memory refusal; fail-closed UI без публикации.
4. **037C-3c (OPEN):** полный CI gate PR → merge → exact-main, и только после этого закрытие 037C. P0 [002](002-psd-compatibility-corpus.md), [003](003-tiled-content-aware.md), ICC/CMYK/RAW всё ещё открыты.

## Проверки этой проходки

- [ ] GitHub PR `npm run check`, Chromium smoke, `git diff --check` успешны на точном commit.
- [ ] Ссылки на CI и результаты занесены сюда и в `task/NEXT.md`.
- [ ] Genuine-photo Chromium failure matrix отдельно подтверждена: пока нет, не отмечать как готовую.

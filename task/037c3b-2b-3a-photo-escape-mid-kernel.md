# 037C-3b-2b/3a — настоящий PSD16/PSB32, публичная отмена Escape после native write

**Приоритет:** P1. **Статус: ЗАКРЫТА (2026-10-18)** — [PR #256](https://github.com/zeter1/ZeTer-Photo-Editor/pull/256) → [main 3bb9b50](https://github.com/zeter1/ZeTer-Photo-Editor/commit/3bb9b509a0c4c9d641592563865137e4735414d3); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120399943), [PR genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120399916), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120673676), [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120673650). Полная 037C OPEN.

## Граница проходки

Проверяем **действительную публичную клавишу Escape**, пока реальный photo-derived PSD16 / PSB32 Worker находится внутри inpaint kernel **после первой native записи**, а не удержанный до начала выполнения Worker. Два независимых Chromium `file://` процесса импортируют pinned документы через UI и работают с 8288-пиксельным ROI, как в проверенном 037C-2.

В тестовой копии Worker supplier установлен post-write probe из `tools/browser-inpaint-mid-kernel-smoke.mjs` (производственный Worker не меняется). После probe отправляется CDP `Input.dispatchKeyEvent` (keyDown+keyUp) с настоящим Escape через UI handler. Затем проверяются:

- status «Контент-заливка отменена», ровно одна native Worker request/termination после первого pixel write, без успешного Worker reply до отмены;
- искусственный late-result на уже остановленный Worker при **активном исходном документе** (важнее, чем при switched/closed tab);
- два независимых `File → Save Project` с **полным byte-exact v2 native tiled snapshot**, отсутствие Content-Aware Fill в исходной History, отсутствие изменений History другой вкладки;
- отдельные `real-photo-psd16-mid-kernel-escape-run-1.json` и `real-photo-psb32-mid-kernel-escape-run-1.json`; строгий offline verifier отклоняет неполную пару, незаслуженную claim flags/пины, подделку результатов и дубли сессий.

Инструментирование гарантирует только native kernel first-write + принудительную остановку Worker во время тестовой задержки. Поздний reply **искусственный**; это **не** реальный completed Worker → slow preview race, **не** проверка качества Photoshop и **не** peak RAM.

## Файлы проходки

- `tools/browser-real-photo-switch-failure.mjs` — новый режим `escapeCancel`, строгая схема receipt и независимая пара.
- `tools/browser-smoke.mjs` — взаимоисключающий `ZPE_REAL_PHOTO_BROWSER_MID_KERNEL_ESCAPE=1`.
- `tests/browser-real-photo-mid-kernel-escape.test.mjs` — положительная пара форматов, отрицательные поля.
- `tools/verify-browser-real-photo-mid-kernel-escape-artifacts.mjs` — verification exact filenames/artifacts.
- `.github/workflows/real-photo-intake.yml` — opt-in фактический Chromium per-format CI + upload.

## Проверка

- [x] Node `npm run check` и базовый `npm run test:browser` на exact PR head: [CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120399943).
- [x] Genuine-photo workflow: реальные PSD16 и PSB32, обе public Escape receipts подтверждены и загружены: [PR photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120399916).
- [x] PR #256 слит как `3bb9b50`; [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120673676), [exact-code main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39120673650).
- [x] Ссылки и статусы перенесены в `task/README.md`, `task/NEXT.md` и эту запись. Полный 037C и completed Worker/preview race остаются OPEN.

Локально полный checkout репозитория был недоступен из среды из-за DNS `github.com`. Проверки подтверждены ссылками на GitHub Actions для точных PR и main code SHA.

## Очередь после этой проходки

1. **037C-3b-2b/3b (OPEN):** genuine photo stale-generation и completion-before-preview/slow-preview → Escape race, success-first vs cancel-first, точный native readback/History. Это отдельный сценарий: текущий mid-kernel worker не успел завершиться.
2. **037C-3b-3 (OPEN):** malformed native output и максимальный `maxBytes`/memory-budget отказ Worker, observable fail-closed UI и точные receipts.
3. **037C-3c (OPEN):** заключительная 037C приемка (photo quality ×3/format, memory observation, failure matrix, PR+main exact gate). Не забывать **P0 002** Adobe-authored PSD corpus и **Stage 003** всеобщую tiled memory-модель.
4. Следующие возможности скриншота: RGB/CMYK ICC calibration, RAW, полноценная HDR-подсистема, продвинутые Refine Edge / Content-Aware и более широкая Photoshop compatibility — отдельный roadmap, без claim завершения.

# 033 / 024D2 — native synthetic-quality oracle для Chromium PSD16/PSB32 (Stage 003)

**Статус:** **слито в `main`** (2026-10-14): [PR #217](https://github.com/zeter1/ZeTer-Photo-Editor/pull/217) → squash `685d178`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38542625807), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38543002186). Это test-only расширение настоящего UI + Worker сценария; production codec/editor/render не меняется. Общие Stage 002/003 остаются **открытыми**.

## Цель

Существовавший native-byte oracle проверял, что запись остаётся строго в выделении, но не устанавливал, улучшилось ли изображение. На ZeTer-generated больших PSD16/PSB32 каждый исходный пиксель, кроме известного дефекта 5×5, равен заранее известному native constant background. Это ограниченный, но **независимый от inpaint-алгоритма** synthetic reference, по которому можно рассчитать качественные native MAE/RMSE.

## Работа этой проходки

- [x] tools/browser-synthetic-native-quality.mjs: извлечение точных Uint16/Float32 little-endian слов из сериализованных v2 тайлов только для 5×5 дефекта; строгая валидация координат, base64, полноты тайлов, nonfinite Float32 и reference; MAE/RMSE и max absolute error. Без преобразования в 8-bit preview.
- [x] tools/browser-large-psd16-smoke.mjs: реальный Chromium file:// UI PSD16/PSB32, тот же Worker, native project save после первой Fill/Redo, после mid-kernel отмены, retry/Undo/Redo; проверка улучшения относительно исходного synthetic reference и exact возврата Undo/Redo.
- [x] tools/browser-operation-timeline.mjs / tools/browser-operation-artifact.mjs: версия quality evidence, запись рядом с timings и sampled memory в существующие JSON, проверки подмены/пропусков на writer и CI-reader. Не путать информационные RSS/CDP с истинным Worker memory peak.
- [x] tests/browser-synthetic-native-quality.test.mjs, tests/browser-operation-artifact.test.mjs: native Uint16/Float32 и adversarial JSON regression.
- [x] `npm run check`, настоящий Chromium `file://` PSD16/PSB32 с проверкой JSON, профили, diff hygiene, merge и exact-main CI — [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38542625807) / [main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38543002186).

## Что подтверждается / не подтверждается

Это восстановление простого искусственного 5×5 дефекта на известном **постоянном** фоне при 16/32-битной точности (native MAE/RMSE), плюс сохранность исходных байтов по уже существующему oracle. **Не Photoshop golden, не оценка естественной текстуры, не PSNR для неограниченных HDR Floats, не комплексная wide connected ROI quality и не настоящий пик Worker RAM.** JSON с замерами сам по себе не доказывает source-pixel evidence без работы real browser harness.

## Следующие проходки

1. **P0 [002](002-psd-compatibility-corpus.md):** легально доступные независимо Photoshop-authored RGB16 PSD + CMYK32 PSB, SHA256, лицензия, reference composite/preview и проверка импорта/экспорта через настоящий файл.
2. **P1 [003](003-tiled-content-aware.md):** расширить known-reference real-browser тест на крупные сложные connected ROI (не только 5×5), сравнить измеряемое качество, latency, sampled RSS между несколькими фиксированными конфигурациями; фиксировать ограничения метода.
3. **P1 [025](025-browser-worker-target-census.md):** target→PID только через подтверждённый документированный метод; иначе unknown. Не заявлять real peak RSS/exits.
4. **P2:** внешний PSD/PSB round-trip для masks/groups/adjustments/text/blend, а также Color/RAW/HDR этапы из общей дорожной карты.

**Done gate:** Node + Chromium CI, quality JSON verifier, PR проверка, merge и CI точного main SHA — до этого не помечать проходку полностью закрытой.

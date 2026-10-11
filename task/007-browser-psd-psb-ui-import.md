# 007 — Stage 003: браузерный PSD16/PSB32 UI import + native sample smoke (2026-10-11)

## Граница проходки

Проверить настоящий путь `file://` Chromium `#fileInput` → `PSD/PSB codec` → `document import` → сохранение native PixelBuffer source → canvas preview. До этой проходки реальный UI Worker + Undo/Redo проверялся на `synthetic .zpe RGB16`, а раздельный `PSD16/PSB32 → Worker` — только через Node, без браузерного открытия Photoshop-файла.

## Выполнено в ветке / ожидает CI и merge

- [x] Добавлен генератор маленьких детерминированных PSD 16-bit и PSB Float32 с отдельными повреждёнными пикселями (`tools/browser-high-depth-fixtures.mjs`). **Оба файла созданы writer-ом ZeTer**, не Photoshop.
- [x] Node-тест проверяет PSD/PSB заголовки, decoder, sample arrays и точные нормальные/повреждённые native samples.
- [x] Chromium `file://` smoke через реальный `#fileInput`: проверяет импорт слоя, ожидание статуса, показ повреждённого пикселя в canvas, тип `Uint16Array/Float32Array`, rawBytes, `zpe-pixel-buffer-source-v1` и точную native sample parity через независимый этап сериализации/десериализации state.
- [ ] PR CI `npm run check` + `npm run test:browser`, ревью и merge; затем зелёный CI **точного main SHA**. Не считать проходку завершённой до этого.

## Что этот тест НЕ закрывает

- Размер 8×8 намеренно находится ниже tiled threshold 8 MiB. Импорт проходит через v1 PixelBuffer; существующий `.zpe` сценарий тестирует реальный UI tiled Worker, preview и Undo/Redo **отдельно**, но не сквозную связь PSD/PSB → large native v2 Worker → Undo/Redo.
- Фикстуры НЕ являются независимыми Adobe Photoshop-authored goldens и не демонстрируют Photoshop pixel parity.
- У браузерного прогона нет измерения memory peak; CDP sampler из предыдущей проходки даёт лишь sampled memory.
- Нет гарантий для плотных больших выделений, отмены на каждом read/kernel/write этапе, сложных adjustment/blend/clipping Photoshop-структур.

## Следующие задачи

1. После зелёного PR CI выполнить merge и проверить точный `main` SHA; лишь затем отметить 007 `done`.
2. Stage 003: bounded large PSD16/PSB32 fixture выше 8 MiB threshold → настоящая v2 tiled source, Worker dispatch, preview, Undo/Redo и cancellation; тестировать sample memory/latency и отсутствие частичной публикации.
3. Stage 003: adaptive dense ROI strips/segments вместо перезаписи незавершённых возможностей и без ослабления source immutability, global frozen donors, aggregate caps.
4. Stage 002 P0: лицензированные **независимо Photoshop-authored** RGB/CMYK PSD16 и PSB32, pin SHA-256, license/provenance и внешние Adobe pixel references.

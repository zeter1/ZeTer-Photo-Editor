# 007 — Stage 003: браузерный PSD16/PSB32 UI import + native sample smoke (2026-10-11)

## Граница проходки

Проверить настоящий путь `file://` Chromium `#fileInput` → `PSD/PSB codec` → `document import` → сохранение native PixelBuffer source → canvas preview. До этой проходки реальный UI Worker + Undo/Redo проверялся на `synthetic .zpe RGB16`, а раздельный `PSD16/PSB32 → Worker` — только через Node, без браузерного открытия Photoshop-файла.

## Завершено в main — PR #187 и зелёный exact-main CI

- [x] Добавлен генератор маленьких детерминированных PSD 16-bit и PSB Float32 с отдельными повреждёнными пикселями (`tools/browser-high-depth-fixtures.mjs`). **Оба файла созданы writer-ом ZeTer**, не Photoshop.
- [x] Node-тест проверяет PSD/PSB заголовки, decoder, sample arrays и точные нормальные/повреждённые native samples.
- [x] Chromium `file://` smoke через реальный `#fileInput`: проверяет импорт, canvas preview, затем настоящий File → Save Project. Из полученного `.zpe` Blob декодирует точные little-endian 16/Float32 samples и проверяет `rawBytes`, `sampleType`, `zpe-pixel-buffer-source-v1`; Node-тест отдельно подтверждает `Uint16Array/Float32Array` после `decodePsd`.
- [x] [PR #187](https://github.com/zeter1/ZeTer-Photo-Editor/pull/187): [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137491812) — 1151 Node-тест, generated artifacts parity, `file://` Chromium (оба импорта), профили и diff hygiene; squash merge `c3fd57a807e941676f6b8b50b240a93537829bad`; [CI точного main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137556394).

## Что этот тест НЕ закрывает

- Размер 8×8 намеренно находится ниже tiled threshold 8 MiB. Импорт проходит через v1 PixelBuffer; существующий `.zpe` сценарий тестирует реальный UI tiled Worker, preview и Undo/Redo **отдельно**, но не сквозную связь PSD/PSB → large native v2 Worker → Undo/Redo.
- Фикстуры НЕ являются независимыми Adobe Photoshop-authored goldens и не демонстрируют Photoshop pixel parity.
- У браузерного прогона нет измерения memory peak; CDP sampler из предыдущей проходки даёт лишь sampled memory.
- Нет гарантий для плотных больших выделений, отмены на каждом read/kernel/write этапе, сложных adjustment/blend/clipping Photoshop-структур.

## Следующие задачи

1. [x] PR CI, merge и exact-main CI для 007 подтверждены; не путать с завершением Stage 003.
2. Stage 003: bounded large PSD16/PSB32 fixture выше 8 MiB threshold → настоящая v2 tiled source, Worker dispatch, preview, Undo/Redo и cancellation; тестировать sample memory/latency и отсутствие частичной публикации.
3. Stage 003: adaptive dense ROI strips/segments вместо перезаписи незавершённых возможностей и без ослабления source immutability, global frozen donors, aggregate caps.
4. Stage 002 P0: лицензированные **независимо Photoshop-authored** RGB/CMYK PSD16 и PSB32, pin SHA-256, license/provenance и внешние Adobe pixel references.

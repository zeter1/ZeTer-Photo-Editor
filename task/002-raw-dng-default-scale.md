# CAP-RAW-DNG-DEFAULT-SCALE — 1.46.22 (локальный bounded increment)

**Дата:** 2026-11-16. **Stage 9 / P1.** **Отправная точка:** PR #398 head `05c48eb8398aea57b0470fcaacf50801503c1fa3` (stacked поверх PR #397 `bf6dd662`); текущий main `a81bec7`. **Ветка:** `feat/raw-next-20261116` в отдельном worktree Windows, ещё не опубликована в GitHub. Родитель RAW IN PROGRESS, никаких camera-authored parity claims.

## Пользовательская функция

- `src/formats/dng.js`: DNG tag 50718, проверка RATIONAL[2], диапазон scale 1/8..8 и лимиты выходного кадра (каждая ось не более 12000, всего не более 16 миллионов пикселей). DefaultCrop по-прежнему в sensor-space, CFA phase не изменяется; выходные размеры `round(cropSize × DefaultScale)` до TIFF Orientation 1–8. Новый размер применяется к реальным RGBA, а не к CSS.
- Ресэмплирование билинейное: demosaic original Bayer → sample fractional **linear camera RGB** в выходной grid → ColorMatrix/white balance/exposure → sRGB OETF → Orientation. Crop/Scale валидируются до чтения strips и публикации изображения.
- `src/document/import-controller.js`: RAW provenance defaultScale; `src/core/state.js`: нормализация и сериализация `.zpe` без потери raw bytes/истории (у старых .zpe scale по умолчанию 1×1); `src/main.js`: Properties явно показывает DefaultScale и sensor vs rendered geometry.
- Сжатые DNG compression=7, packed CFA, BestQualityScale и camera-grade fidelity остаются неподдерживаемыми, PSD/PSB экспортируют лишь проявленный raster.

## Проверки

- До patch: **RED 3/10** `tests/dng-default-crop.test.mjs`: unsupported non-unit DefaultScale, отсутствие metadata.
- После patch: **PASS 29/29** `node --test tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs`; II/MM, pixel gamma oracle, x upscale/y downsample, orientation6, bad type/zero denominator/bounds, .zpe source and backward-compatible missing defaultScale.
- `npm run build`: PASS. `npm run test:browser:raw-dng`: **PASS** настоящий Chromium с `file://`, File input → scale/crop/ColorMatrix preview RGBA → Properties → History Undo/Redo → .zpe save/reopen → RAW re-develop; PNG/PSD/PSB rendered raster regression.
- Полный Windows `npm run check`: **1675 PASS / 10 SKIP / 5 FAIL** (пять Linux-only `/proc`/cgroup, не общий PASS). `tests/version-consistency.test.mjs` PASS, generated browser build/version parity PASS, `git diff --check` PASS.
- **Linux PR-head CI для 1.46.22 NOT RUN**: новый код ещё только в локальном worktree; #398 current stacked base не main и чеков нет. **Independent camera-authored LibRaw pixel oracle NOT AVAILABLE**; синтетический TIFF не доказательство калиброванной камерной совместимости.

## Следующая приёмка

После разрешённой интеграции #397→#398 и точной проверки CI: опубликовать этот отдельный bounded PR с clean base, запустить full Linux core/independent real-photo/Chromium `file://` с actual final head и провести review; затем merge и exact-main CI. Следующий независимый функциональный шаг: `CAP-RAW-DNG-LOSSLESS-JPEG`.

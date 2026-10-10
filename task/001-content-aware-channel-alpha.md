# 001 — Content-Aware Fill: CMYK4 и straight alpha

- **Goal:** корректно восстановить цвет прозрачной границы и учитывать K при PatchMatch native CMYK4.
- **Why now / evidence:** 4 канала без модели ошибочно считались RGBA: K игнорировался в оценке текстуры; straight-alpha цвета с alpha=0 участвовали в boundary averaging.
- **Scope:** `src/core/inpaint.js`, мост `inpaintPixelBuffer`, регрессии, спецификация; **non-scope:** UI, изменение лимитов 8/2/0.25 MP, tiled/worker engine, PSD codec.
- **Inspect first:** `docs/architecture/CONTENT_AWARE_FILL.md`, `src/core/inpaint.js`, `src/core/pixel-buffer.js`.
- **Behavioral contracts:** immutable donors; selection snapshot; untouched pixels outside selection; native 8/16/32-bit and RGB/CMYK; deterministic refinement, current safety budgets.
- **Planned fix:** явное положение alpha-канала по native модели, усреднение straight цвета с premultiplied donor alpha, все четыре CMYK-чернила при подборе текстуры.
- **Targeted tests:** RGBA8 transparent-red/opaque-blue, Float32 CMYKA, Uint16 CMYK4 K-only repeating stripes.
- **Required verification:** `npm run check`, `npm run test:browser`, `git diff --check`, generated-artifact parity, CI.
- **Done gate:** PR merged, push CI `main` green; затем удалить файл task.
- **Risks / handoff:** PixelBuffer `alphaMode` — доверенный канал; прямой 4-channel RGBA-вызов сохраняет default. PatchMatch exact donor copy не менять.
- **Status:** реализация в ветке `fix/content-aware-channel-alpha-20261010`; ожидает проверку и merge.

# 003 — Tiled Content-Aware Fill

- **Goal:** уменьшить peak RAM для Content-Aware Fill на tiled high-depth sources, не материализуя целиком PixelBuffer.
- **Why now / evidence:** `docs/architecture/TILED_RASTER.md` явно фиксирует Content-Aware как оставшуюся contiguous/global boundary.
- **Scope:** bounded region/tile working set and regression at tile boundaries; **non-scope:** full virtual memory, RAW/LibRaw, GPU/AI.
- **Inspect first:** `docs/architecture/TILED_RASTER.md`, `src/core/pixel-buffer.js`, `src/painting/command-controller.js`, `src/core/inpaint.js`.
- **Behavioral contracts:** frozen selection, immutable donors, exact-owner publication, history/locks, native precision and safe memory budget.
- **Planned work:** проект seam, затем детерминированный cross-tile algorithm with workload profiling, separate from Stage 001.
- **Targeted tests:** cross-tile halos/donors, interruption, Float32 CMYK, guard against unintended full-plane decode.
- **Required verification:** `npm run check`, `npm run test:browser`, memory measurements.
- **Done gate:** independent PR merged with green `main` push CI.
- **Risks / handoff:** global connectivity cannot be naively limited to one tile; preserve the fallback.

## Проходка 2026-10-10 — bounded tiled ROI (PR, до merge не закрывать)

- Реализовано: `inpaintTiledPixelBufferSource()` — полный scan frozen local predicate без materialize samples, один cross-tile ROI + 24 px halo, прежний typed kernel, запись changed tiles; новый owner `persistTiledHighDepthInpaint()` контролирует exact document/layer/source before and after preview await.
- Покрытие: `tests/tiled-raster-source.test.mjs` (Float32 CMYKA seam, unchanged payloads, 8 MP-ROI budget, full selection/no donor, predicate abort), `tests/painting-command-controller.test.mjs` (never contiguous fallback, single history, stale result).
- **Существенная граница:** source scan синхронный (worker позже); halo меняет донора в сравнении с global refinement, ROI > 8 МП безопасно отклоняется; large high-depth previews всё ещё RGBA8 full surface.
- **Не выполнено до CI:** измерение реальных peak RAM/latency на 8–48 MiB PSD/PSB sources и ручная проверка в браузере; не заявлять full virtual memory или полную эквивалентность global inpaint.
- **Следующая отдельная проходка:** worker-owned ROI jobs/cancellation и performance profiling, затем стратегия disconnected/wide masks вне 8 MP ROI.
- Done gate по-прежнему: PR merge + green main push CI и измерения; не удалять задачу заранее.

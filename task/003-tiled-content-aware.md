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

## Проходка 2026-10-10 — bounded tiled ROI (слито, main CI green)

- Реализовано: `inpaintTiledPixelBufferSource()` — полный scan frozen local predicate без materialize samples, один cross-tile ROI + 24 px halo, прежний typed kernel, запись changed tiles; новый owner `persistTiledHighDepthInpaint()` контролирует exact document/layer/source before and after preview await.
- Покрытие: `tests/tiled-raster-source.test.mjs` (Float32 CMYKA seam, unchanged payloads, 8 MP-ROI budget, full selection/no donor, predicate abort), `tests/painting-command-controller.test.mjs` (never contiguous fallback, single history, stale result).
- **Существенная граница:** source scan синхронный (worker позже); halo меняет донора в сравнении с global refinement, ROI > 8 МП безопасно отклоняется; large high-depth previews всё ещё RGBA8 full surface.
- **Фактическая проверка:** [PR #134](https://github.com/zeter1/ZeTer-Photo-Editor/pull/134) слит squash commit `b5cf0f5fee1d098e5da90df911fec58cdad2cd46`; [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38047407522) и [exact main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38047465391), включая Node tests, bundle parity, Chromium file:// smoke и diff hygiene. **Не выполнено:** измерение реальных peak RAM/latency на 8–48 MiB PSD/PSB sources и отдельный ручной UI сценарий.
- **Следующая отдельная проходка:** worker-owned ROI jobs/cancellation и performance profiling, затем стратегия disconnected/wide masks вне 8 MP ROI.
- ROI-подэтап прошёл merge + green main CI. Общую задачу `003` не удалять: perf-профилирование, worker cancellation и стратегия wide/disconnected масок ещё открыты.

## Проходка 2026-10-10 — one-shot frozen selection snapshot ([PR #136](https://github.com/zeter1/ZeTer-Photo-Editor/pull/136))

- Исправлено в `inpaintTiledPixelBufferSource`: `isAllowed(x,y)` вызывается **один раз на координату** во время global scan, а не повторно при построении ROI-mask. Выбранные позиции фиксируются в bounded списке (не более `maxFillPixels`); после проверки лимитов создаётся локальная `Uint8Array(ROI area)`. Внутренний inpaint читает только её.
- Регрессии: бросаем исключение при повторном вызове selection predicate на координате; проверяем изменение одного damaged pixel без порчи остальных tiles, полный no-donor selection при малом лимите, safety rejection.
- Не изменено: max 8 МП ROI / 2 МП fill, immutable donor, один bounded ROI, exact-owner transaction, алгоритм синтеза; worker/cancellation и disconnected/wide masks остаются отдельными будущими этапами.
- Gate: `npm run check`, `npm run test:browser`, bundle parity, review, PR merge + exact main push green. PR CI: [success, Node 1034 tests + bundle parity + file:// smoke + diff hygiene](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048074508). Main push CI требует отдельного подтверждения после merge.


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

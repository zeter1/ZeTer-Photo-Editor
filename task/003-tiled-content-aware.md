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
- Gate: `npm run check`, `npm run test:browser`, bundle parity, review, PR merge + exact main push green. PR CI: [success, Node 1034 tests + bundle parity + file:// smoke + diff hygiene](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048074508). [main push CI successful](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048171147), exact squash SHA `ebd08b02797e1a6752df2a735af90b9a10220764` (`event=push`, `head_branch=main`). Подэтап one-shot frozen selection закрыт после merge+green; общая задача 003 остаётся открытой из-за profiling, worker/cancellation и wide/disconnected masks.


## Проходка 2026-10-10 — разрозненные ROI ([PR #138](https://github.com/zeter1/ZeTer-Photo-Editor/pull/138), слито)

- **Goal:** заполнить два удалённых островка на одном high-depth tiled источнике, не отклоняя их из-за большого общего bounding rectangle.
- **Scope:** при oversized global ROI делить выделение по занятым tile cells; halo-rectangles объединяются транзитивно, независимые области обрабатываются с прежними immutable донорами, а результат публикуется только после подготовки всех регионов.
- **Safety:** один frozen scan, не более 256 occupied cells, total ROI area <= `maxLayerPixels`, global `maxFillPixels`; если нет доноров или ROI не проходит бюджет — нет частичных изменений.
- **Регрессии:** `tests/tiled-inpaint-disconnected.test.mjs` — distant Float32 CMYKA, нетронутые payloads, total budget и близкие halos.
- **Verification:** `npm run check` (1037 tests), generated bundle parity, `npm run test:browser` (`file://`), diff hygiene; оба CI прошли.
- **Open:** profiling реального peak RAM/latency, worker/cancellation, широкие связные маски. Общую 003 задачу не удалять.

**Итог подэтапа:** [PR #138](https://github.com/zeter1/ZeTer-Photo-Editor/pull/138) слит squash-коммитом `e7188ac9ec021e8dd23fdf769430e1f5d5febb0b`. [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38049643830) **success** и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38049694526) **success** (`event=push`, `head_branch=main`, точный SHA). Подэтап завершён; **вся 003 по-прежнему открыта**: RAM/latency profiling, worker/cancellation, wide connected masks.

## Проходка 2026-10-10 — воспроизводимый benchmark memory/latency ([PR #139](https://github.com/zeter1/ZeTer-Photo-Editor/pull/139), PR CI green)

- **Подэтап:** standalone `tools/profile-tiled-inpaint.mjs` измеряет native CMYKA Float32 tiled Content-Aware Fill для raw payload 8/24/48 MiB в отдельных процессах Node; JSON содержит размеры, loaded/changed tiles, время fixture/inpaint и RSS/arrayBuffers/high-water до/после.
- **Контроль поведения:** обработка одного повреждённого пикселя на tile seam, ровно один изменённый tile, остальные dataUrl byte-for-byte неизменны; ошибки и выход за 48 MiB fail closed.
- **Автоматизация:** Node regression на малом 1 MiB source; полный informational run 8/24/48 MiB в GitHub CI, без заведомо нестабильных threshold assertions.
- **Ограничения:** process-wide HWM не является точным peak памяти отдельно inpaint; benchmark synthetic, не проверяет реальный PSD/PSB decode/UI preview и не переносит вычисления в Worker.
- **Gate:** считать доказательством профиля только сохранённые логи успешного PR CI + exact main push CI. [PR CI #38051881786](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38051881786) — **success**, включая 8/24/48 MiB benchmark. Exact main push CI ещё ожидается. Worker/cancellation и wide connected masks **остаются открыты**; общую задачу 003 не удалять.

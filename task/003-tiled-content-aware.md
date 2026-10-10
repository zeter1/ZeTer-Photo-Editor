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

## Проходка 2026-10-10 — воспроизводимый benchmark memory/latency ([PR #139](https://github.com/zeter1/ZeTer-Photo-Editor/pull/139), merged + green main CI)

- **Подэтап:** standalone `tools/profile-tiled-inpaint.mjs` измеряет native CMYKA Float32 tiled Content-Aware Fill для raw payload 8/24/48 MiB в отдельных процессах Node; JSON содержит размеры, loaded/changed tiles, время fixture/inpaint и RSS/arrayBuffers/high-water до/после.
- **Контроль поведения:** обработка одного повреждённого пикселя на tile seam, ровно один изменённый tile, остальные dataUrl byte-for-byte неизменны; ошибки и выход за 48 MiB fail closed.
- **Автоматизация:** Node regression на малом 1 MiB source; полный informational run 8/24/48 MiB в GitHub CI, без заведомо нестабильных threshold assertions.
- **Ограничения:** process-wide HWM не является точным peak памяти отдельно inpaint; benchmark synthetic, не проверяет реальный PSD/PSB decode/UI preview и не переносит вычисления в Worker.
- **Gate:** считать доказательством профиля только сохранённые логи успешного PR CI + exact main push CI. [PR CI #38051881786](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38051881786) — **success**, включая 8/24/48 MiB benchmark. [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38052035982) на exact SHA `11932992f3213447b8cae9c183eaf80cb2ec6f06` (`event=push`, `head_branch=main`). Базовый инструментальный benchmark-подэтап закрыт; реальный PSD/PSB source decode, peak inpaint RSS, worker cancellation, wide connected masks и browser responsiveness остаются открыты. Worker/cancellation и wide connected masks **остаются открыты**; общую задачу 003 не удалять.

## Проходка 2026-10-10 — cooperative selection scan ([PR #141](https://github.com/zeter1/ZeTer-Photo-Editor/pull/141), merged + green main CI)

- **Цель:** уменьшить задержку реакции UI на смену документа во время long tiled Content-Aware Fill selection scan, не меняя форму выделения, kernel или диапазон доноров.
- **Изменения:** `inpaintTiledPixelBufferSourceCooperative()` работает chunked (по умолчанию 32 768 координат) с macrotask yield и `isCancelled`; общая execution path с синхронным API обрабатывает уже замороженные индексы. `persistTiledHighDepthInpaint()` передаёт exact-target/source guard и прекращает устаревшую задачу до ROI decode.
- **Регрессии:** `tests/tiled-inpaint-cooperative.test.mjs` (CMYKA Float32 deterministic sync parity, one-time predicate, abort до decode, смена документа во время yield).
- **Проверка/gate:** `npm run check` (1042 Node tests), `npm run test:browser` (`file://`), bundle parity и diff hygiene прошли. [PR CI #38053077787](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38053077787) — success; [exact main push CI #38053128507](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38053128507) — success (`event=push`, `head_branch=main`, exact SHA `74d2e14c0901c4088322c5fc3bb982f1528fe5d4`). Подэтап cooperative scan закрыт.
- **Не решено:** сам синтез/serialization остаётся synchronous на main thread; Worker + true mid-kernel cancellation, широкий связный ROI и реальный PSD/PSB/UI memory baseline — отдельные задачи. **003 остаётся открытой.**

## Проходка 2026-10-10 — external PSD/PSB decode → tiled inpaint profiling ([PR #143](https://github.com/zeter1/ZeTer-Photo-Editor/pull/143), merged + main CI green)

- **Подэтап:** `tools/profile-real-psd-inpaint.mjs` читает реальные MIT fixtures `psd-tools-4x4-8bit-cmyk.psd` и `psd-tools-group.psb` из существующего pinned corpus. Измеряет отдельно codec decode, serialization в v2 tiles и синхронный one-pixel inpaint; каждый файл обрабатывается в отдельном Node-процессе (`--expose-gc`). Сверяет SHA-256 и размер bytes с provenance manifest; проверяет сохранение native CMYKA для PSD, группы PSB, число загруженных/изменённых tiles, immutability исходных bytes и то, что только выбранный пиксель может меняться.
- **Регрессия:** `tests/tiled-inpaint-external-psd-psb.test.mjs` проверяет машиночитаемый output и отказ на несуществующих fixture names; дополнительный external CMYK PSD sync/cooperative parity и external PSB cancellation ещё до ROI decode. CI выводит независимый informational baseline, без жёстких таймингов/RSS порогов.
- **Ограничения:** оба внешних fixture — небольшие **8-bit** files; process-wide HWM ≠ peak одной операции; PSD проходит native raster слоя, а PSB — merged composite (не UI layer raster command). Это *не* большой 16/32-bit source, не browser RAM/preview и не Worker-kernel benchmark. Требуются отдельные реальные heavy high-depth PSD/PSB + UI measurements.
- **Gate выполнен для этого подэтапа:** `npm run check` (1046 Node tests), generated-bundle parity, `npm run test:browser` (`file://`), оба informational profiles и diff hygiene прошли. [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054015772) **success**; [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054094819) **success** (`event=push`, `head_branch=main`, SHA `36236c0c17584bf46669fc93a32bc90a7bec10b5`). Малые external 8-bit PSB/composite и CMYK PSD regressions завершены, но вся 003 **остаётся открытой**: большие high-depth fixture + browser memory profile, Worker и wide connected masks.

## Проходка 2026-10-10 — изолированный Worker compute/protocol probe ([PR #145](https://github.com/zeter1/ZeTer-Photo-Editor/pull/145), merged + main CI green)

- Добавлены `src/core/tiled-inpaint-worker-protocol.js`, `tools/tiled-inpaint-worker-thread.mjs` и `tests/tiled-inpaint-worker-protocol.test.mjs`. Это исполняемая Node `worker_threads` проверка передачи frozen `Uint32Array` selected indices через structured clone и вычисления существующим tiled kernel вне главного потока.
- Gate: byte/semantic sync parity для удалённых CMYKA Float32 островков, неизменность исходных tiles, строгая проверка индексов, последующие успешные jobs после ошибки и прекращение idle worker без публикации.
- **Ограничение:** `runTiledInpaintWorkerJob` пока не входит в canonical browser bundle и не вызывается UI. Нет `file://` Web Worker handoff, exact-owner result publication, mid-kernel cooperative cancellation или memory benchmark большого реального PSD/PSB. `worker.terminate()` в тесте проверяется только до отправки задания, не внутри работающего kernel.
- **Далее:** реализовать browser-compatible `file://` worker bootstrap, generation/owner cancellation и bounded memory/latency profile; не считать Stage 003 закрытой по факту Node-прототипа. **Gate Node POC закрыт:** [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054919946), [exact main push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054978347) (`event=push`, `head_branch=main`, SHA `9c63a0e50516c34bd91d98dba88bfc27eee19040`). Вся задача 003 остаётся **открытой**: browser `file://` Worker, mid-kernel cancellation, wide connected ROI и heavy high-depth real PSD/PSB UI profile.

## Проходка 2026-10-10 — isolated Worker lifecycle/cancellation client ([PR #147](https://github.com/zeter1/ZeTer-Photo-Editor/pull/147), merged + main CI green)

- **Реализовано и слито:** `src/core/tiled-inpaint-worker-client.js` — одно активное задание, `isCurrent` до dispatch/при ответе, `cancel()`/supersession через `worker.terminate()`, исключение поздних ответов; typed error propagation и удаление event listeners. Работает с Node `worker_threads` и browser-shaped event API, но в runtime приложение **не подключён**.
- **Regression scope:** `tests/tiled-inpaint-worker-client.test.mjs` — реальный Node Worker Float32 CMYKA parity, отмена до ready, новый job поверх старого, недействительный владелец на ответе, malformed reply, ошибки и восстановление новых заданий. Исходные tiles неизменны.
- **Next actual implementation:** `file://`-совместимый browser Worker bootstrap с безопасным fallback, интеграция в `persistTiledHighDepthInpaint()` с exact document/layer/source guards и cancellation при каждой смене владельца; затем memory budget/transfer и реальный browser perf. Отдельно wide connected masks и реальный heavy PSD/PSB high-depth benchmark.
- **Gate:** [PR CI #38055816486](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38055816486) успешно прошёл полный `npm run check`, browser `file://` smoke, profiler и diff hygiene; [exact main push CI #38055884171](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38055884171) — `success`, squash SHA `13a894c2551b35b8488e5f921a80c5c469ff4e56`. Подэтап завершён.
- **Not done:** этот клиент не запускает Compute в браузерном UI и не доказывает полную interruptibility без `terminate()`. **003 остаётся открытой** до полноценной интеграции, профиля больших PSD/PSB и wide connected ROI.


## Проходка 2026-10-10 — защита Worker lifecycle от синхронных событий при подписке ([PR #148](https://github.com/zeter1/ZeTer-Photo-Editor/pull/148), слито, main CI green)

- **Дефект:** browser-shaped Worker/test-double может синхронно отправить `ready` и результат, выбросить `error` или исключение из `addEventListener` до присвоения `active`/`detach`. Ранее завершённый job мог остаться активным, а подписки — висеть на завершённом Worker.
- **Исправление:** создать `active` и `detach` до регистрации обработчиков; завершать при ошибке подписки; после регистрации дополнительно очищать обработчики, если callback уже завершил job. Обычный асинхронный Node/browser event contract и отмена через `terminate()` сохранены.
- **Регрессия:** browser-shaped synchronous ready→reply, synchronous startup error и partial listener-registration exception; после завершения нет активного job, все handlers сняты, возможен следующий job.
- **Граница:** Worker всё ещё не подключён к `file://` runtime; не сделаны browser bootstrap, owner-aware UI publication, browser memory profiling, wide connected ROI. Весь пункт 003 **остаётся открытым**.

- **Verified gate:** PR CI [#38056357279](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38056357279) — success; exact `main` push CI [#38056411335](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38056411335) — success на squash SHA `b68aaaa29cdbc13e66e184e153e9aab804857757`. Этот lifecycle подэтап завершён, вся 003 остаётся открытой.


## Проходка 2026-10-10 — fail-closed Worker `messageerror` и invalid factory cleanup (PR pending)

- **Обнаружено:** браузерный Worker при ошибке structured-clone deserialization испускает `messageerror`, а не `error`. Клиент не завершал Promise, не освобождал Worker и блокировал ожидающий job. Node-shaped `messageerror` также не обрабатывался.
- **Исправление:** `src/core/tiled-inpaint-worker-client.js` завершает активный job typed Error, очищает listeners и вызывает `terminate()` как до `ready`, так и после dispatch. Invalid factory return с доступным `terminate` освобождается до reject; асинхронный reject terminate не порождает unhandled rejection.
- **Проверка:** регрессии браузерного/Node-shaped `messageerror`, late reply, восстановления следующего job, утечки обработчиков и defective factory в `tests/tiled-inpaint-worker-client.test.mjs`. Запустить `npm run check` и browser smoke CI; PR + main push gates отметить только после подтверждения.
- **Граница:** всё ещё **не** file:// Worker bootstrap, не UI integration, не true mid-kernel cancellation, не широкий связный ROI или heavy real high-depth PSD/PSB UI memory profiling; вся 003 остаётся открытой.

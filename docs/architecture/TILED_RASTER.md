# Tiled high-depth raster source — Stage 17d

Stage 17d продолжает Stage 17a–17c: большие native RGB/CMYK 8/16/32-bit PixelBuffer sources остаются backward-compatible tiled persistence, Brush/Eraser используют stroke-scoped working set, а native Clone/Heal/Blur/Smudge/Dodge/Burn больше не обязаны материализовывать полный high-depth plane на старте штриха.

## Владельцы

- `src/core/pixel-buffer.js`: v1/v2 source format, strict grid validation, per-tile encode/decode, adaptive serialization, one-shot `mutateSerializedPixelBufferTiles()`, stroke-scoped `createSerializedPixelBufferTileWorkingSet()` и bounded `readRegion()/writeRegion()`.
- `src/core/render.js`: RGB v2 document preview декодирует по одному tile; `OffscreenCanvas` используется как staging surface, когда доступен.
- `src/painting/controller.js`: exact-owner native paint cache, tile working set, dirty-tile live preview, persistence и Canvas8 compatibility boundary.
- `src/painting/gesture-controller.js`: все native paint/retouch tools opt-in в tiled v2 working set; v1 sources остаются на contiguous compatibility path.
- `src/retouch/controller.js`: bounded retouch-region planning, halo reads, immutable lazy Clone/Heal snapshot и dispatch RGB/CMYK math.
- `src/painting/command-controller.js`: Line/current-layer Clear используют one-shot tiled mutation bridge.
- `src/selection/raster-mutation-controller.js`: merged visible-layer clear готовит tiled mutations до общей atomic publication.
- `src/document/psd-import-controller.js`: после decode sources от 8 MiB сохраняются как v2 tiles.

## V2 storage contract

`kind = zpe-pixel-buffer-source-v2`; row-major grid; default tile 256×256; edge tiles имеют реальный меньший размер. Каждый tile хранит bounded base64 payload. Grid полон и упорядочен; сумма `tile.rawBytes` равна `source.rawBytes`. Действуют 48 MiB precision budget и лимит 8192 tiles. Legacy v1 остаётся читаемым.

## Stroke working set

При начале native stroke по v2 source controller валидирует exact owner/layer и byte budget, создаёт пустой mutable working set, строит display canvas последовательным tile decode и затем загружает только tiles, пересекающиеся с текущей операцией. Dirty и preview-dirty sets независимы. На commit dirty tiles сериализуются, untouched payloads остаются byte-for-byte, после чего exact owner/target проверяется повторно.

Это stroke-scoped cache, а не disk-backed virtual memory. Очень длинный штрих всё ещё может постепенно загрузить весь source; локальный штрих больше не создаёт полный 16/32-bit plane заранее.

Eraser без alpha логически повышает RGB→RGBA / CMYK→CMYKA. Touched tiles получают alpha при загрузке; на commit остальные tiles последовательно decode→alpha→encode без одновременного full-plane buffer. Новый byte budget проверяется до начала stroke.

## Region / halo retouch contract

`readRegion(bounds)` собирает только запрошенный прямоугольник из пересекающихся tiles и не помечает их dirty. `writeRegion(region)` сравнивает samples, пишет обратно только реально изменившиеся pixels и отмечает только соответствующие tiles.

- Dodge/Burn читают brush footprint; stroke coverage адресуется глобальными pixel coordinates, поэтому overlap semantics не зависят от границ tiles.
- Blur читает brush footprint + kernel halo, поэтому neighborhood math видит соседние samples по обе стороны tile boundary.
- Smudge читает union destination footprint и смещённого source footprint + bilinear halo.
- Clone/Heal используют mutable destination working set и отдельный lazy snapshot working set, созданный из исходного serialized source в начале stroke. Heal дополнительно включает source/target neighborhood halo.

Clone/Heal snapshot не переиспользует уже изменённые mutable tiles: последующие dab-ы читают исходное содержимое stroke, как и прежний full-buffer snapshot, но без обязательного полного копирования source.

## Preview contract

Full RGBA8 display canvas пока остаётся нужен browser compositor и не является canonical precision source. During stroke layer filters применяются в tile preview, а renderer получает `skipAdjustments`, чтобы не применять их дважды. Persisted `layer.dataUrl` перестраивается из canonical tiled source без layer filters.

## Оставшиеся contiguous/global boundaries

- PSD/PSB binary decoder materializes bounded channel planes до tiled handoff.
- Flood Fill по-прежнему требует global cross-tile connectivity и использует contiguous PixelBuffer.
- Content-Aware Fill на tiled v2 native sources сканирует frozen selection один раз по каждому пикселю без full-plane decode, сохраняет только выбранные индексы в списке не длиннее maxFillPixels, затем строит локальную Uint8Array маску для bounded ROI с 24 px donor halo и публикует только изменённые tiles через exact-source guard. После расчёта ROI selection predicate повторно не вызывается. Это сохраняет cross-tile neighborhood внутри ROI; удалённые доноры вне halo не участвуют в PatchMatch-style search (не полная эквивалентность full-plane алгоритму). ROI свыше 8 МП и выделения свыше 2 МП отклоняются без записи. Полный RGBA8 preview после обработки остаётся global boundary.
- Если browser Worker недоступен, tiled Content-Aware Fill использует `inpaintTiledPixelBufferSourceFromIndices()` с однократно зафиксированным на UI потоке выделением; legacy/test вызовы без Worker по-прежнему используют `inpaintTiledPixelBufferSourceCooperative()`: синхронный `inpaintTiledPixelBufferSource()` сохранён для детерминированных контрактов/профилей, обе ветки используют общую frozen ROI execution path. UI-сценарий делает настоящий macrotask yield каждые 32 768 координат, а владелец `persistTiledHighDepthInpaint()` проверяет exact doc/layer/source/lock до расчёта, между блоками сканирования и после preview. При отмене не выделяются и не декодируются рабочие ROI tiles, не создаются history/preview и не публикуются источники. Geometry predicate вызывается один раз на координату. **Worker в UI:** основной bounded ROI decode/inpaint/serialize вызывается в file://-совместимом classic Blob Worker с fallback при недоступном bootstrap. Scan geometry и полный RGBA8 preview остаются main-thread границами; fallback выполняет синхронный kernel. Worker compute errors не вызывают fallback, exact-owner revalidation перед publish обязательна; браузерный клиент проверяет `isCurrent()` каждые 50 мс только в период жизни Worker и вызывает `terminate()` при устаревании владельца без ожидания ответа; таймер освобождается при любом завершении. Это не прерывает уже начатый синхронный fallback/preview; browser profiling всё ещё открыт.
- Часть export/color-management paths материализует contiguous PixelBuffer.
- Canvas compositor требует full RGBA8 display surface.
- Нет IndexedDB/file-backed eviction store, worker-owned editing tiles, GPU renderer или RAW/DNG decode.

Следующая безопасная проходка: проверить реальную Worker latency/RAM и proactive terminate при изменении владельца, затем перенести cross-tile Flood Fill / широкие связанные маски на bounded streaming/tiled algorithms. После этого — lazy backing store/eviction; только затем имеет смысл пересматривать 512 MiB PSD/PSB input gate.

## Профилирование tiled Content-Aware Fill (Stage 003)

Запуск: `node tools/profile-tiled-inpaint.mjs` (8, 24, 48 MiB) или `node tools/profile-tiled-inpaint.mjs --sizes 1,8`. Каждый размер запускается в **новом дочернем Node-процессе с `--expose-gc`**, поэтому RSS одного сценария не загрязняет следующий. Детерминированный synthetic fixture: native Float32 CMYKA, 256 px tiles, одно повреждённое непрозрачное значение на границе тайла. Инструмент проверяет, что изменён ровно один tile, и сохраняет JSON с версиями Node/OS, точным raw byte size, числом загруженных tiles, временем подготовки и временем вызова `inpaintTiledPixelBufferSource`.

Поля `before`/`after` показывают `rss`, `heapUsed`, `arrayBuffers` и `process.resourceUsage().maxRSS`. `observedProcessHighWaterGrowthMiB` — **разница process-wide high-water marks**, а не точный peak RAM самой операции: максимумы включают создание fixture и сериализацию, краткоживущие аллокации могут не отражаться в конечном RSS. `fixtureMs` не смешивается с `inpaintMs`. Тайминги/память — информационные измерения без flaky CI performance gate. CI печатает baseline на Linux/Node 24. Это *не* benchmark PSD/PSB disk decode, Canvas preview, main-thread latency или Worker cancellation; эти проверки остаются отдельными этапами.

### Первый baseline — 2026-10-10

[PR #139, CI Linux x64 / Node v24.21.0](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38051881786) (в каждом случае один выбранный пиксель, loadedTiles=2, changedTiles=1; время только функции):

| Native source | `inpaintMs` | Process-wide HWM RSS |
| --- | ---: | ---: |
| 8 MiB (~8.0 фактически) | 113.92 мс | 188.18 MiB |
| 24 MiB (~24.0 фактически) | 133.50 мс | 328.00 MiB |
| 48 MiB (~48.0 фактически) | 186.92 мс | 426.89 MiB |

Значения — не performance SLA и не peak RSS изолированного inpaint. Задача Worker/cancellation, широкий связный ROI и браузерный memory profile остаются открытыми.

## Профиль на независимых PSD/PSB bytes (Stage 003)

`node tools/profile-real-psd-inpaint.mjs` декодирует pinned external psd-tools CMYK PSD v1 (native 8-bit CMYKA raster) и layered PSB v2 (merged RGB raster), проверяя manifest SHA-256. Каждый fixture запускается отдельным `--expose-gc` child process; отдельные `decodeMs`, `serializeMs`, `inpaintMs` и RSS snapshots `before`, `afterDecode`, `afterTiles`, `afterInpaint` показывают затраты реального codec→tile→ROI пути. Стандартный вывод — JSON для отслеживания в CI; без нестабильных числовых порогов.

Это маленький **8-bit** upstream corpus, а не замена synthetic 8/24/48 MiB high-depth baseline: process-wide `maxRSS` не является isolated peak tiled inpaint; PSB использует merged composite и не меряет layer UI preview/Workers. Для real 16/32-bit PSD/PSB UI/RAM и wide-selection performance остаются отдельные задачи. `tests/tiled-inpaint-external-psd-psb.test.mjs` дополнительно проверяет external CMYK cooperative parity и отмену frozen external PSB selection до ROI tile reads.

## Проверка

- `tests/tiled-raster-source.test.mjs`: region read/write без ложного dirty.
- `tests/retouch-controller.test.mjs`: tiled Dodge, cross-tile Blur halo и immutable lazy Clone snapshot.
- `tests/painting-gesture-controller.test.mjs`: native retouch opt-in в tiled v2 path.
- полный gate: `npm run check`, generated bundle parity и `npm run test:browser` через CI.

## Worker compute contract — Node proof stage (2026-10-10)

`src/core/tiled-inpaint-worker-protocol.js` принимает detached tiled source и snapshot выбранных индексов (`Array` / `Uint32Array`), валидирует геометрию и индексы, строит frozen predicate и повторно использует канонический synchronous `inpaintTiledPixelBufferSource`. `tools/tiled-inpaint-worker-thread.mjs` исполняет этот контракт в Node `worker_threads` через structured clone; отрицательные задания возвращают `{ok:false,error}`, не уничтожая процесс Worker. Тест покрывает distant CMYKA Float32 и сравнивает `source` с синхронным эталоном.

Для detached Worker selection membership теперь используется битовая карта из одного бита на пиксель (до 2 MiB при общем лимите native source 48 MiB), а не `Set` из JS-чисел. Индексы из `Array`/`Uint32Array` проверяются на границы и дубликаты до запуска kernel; malformed geometry выше предельного числа RGB8-пикселей отклоняется до аллокации bitmap. В detached Worker добавлен `inpaintTiledPixelBufferSourceFromIndices()`: список валидируется через битовую карту (до 2 MiB) и передаётся в frozen ROI kernel напрямую, **без повторного полного scan** `width × height`. В обычном UI geometry predicate всё ещё вычисляется однократно по всем координатам, Worker ещё не подключён к пользовательской заливке. Parity с синхронным ROI и входной immutable source проверяется отдельно.

Это только portable compute/protocol seam: модуль **не** включён в `tools/build-bundle.mjs`, браузер не создаёт Worker, `file://` constraints не решены. Перед production integration нужны worker lifecycle, transfer/memory budget, exact-owner generation, real cancellation во время expensive ROI execution и browser smoke.

## Classic Blob Worker bootstrap — isolated Stage 003 (2026-10-10)

`tools/build-tiled-inpaint-worker.mjs` creates a deterministic, self-contained classic Worker source from `src/core/io.js`, `src/core/inpaint.js`, `src/core/pixel-buffer.js` and `src/core/tiled-inpaint-worker-protocol.js`. The generated `src/core/tiled-inpaint-worker-source.js` is a **classic script supplier**, not an importable Worker script: loading it from `file://` stores the source string in `globalThis.__zpeTiledInpaintWorkerSource`. The caller constructs a same-origin `Blob` URL and starts `new Worker(url)`, then revokes the URL after Worker creation/termination. The Worker itself never calls `fetch`, `importScripts` or dynamic imports, so it does not depend on `file://` resource fetching from inside the Worker. Error/result messages use the same `{ready:true}` / `{id,ok,result|error}` protocol as the Node thread.

`npm run build` regenerates both the regular app bundle and the **independent Worker supplier**. `tests/tiled-inpaint-browser-bootstrap.test.mjs` checks generated source parity and runs the detached CMYKA calculation against the synchronous reference. `tools/browser-smoke.mjs` explicitly loads this supplier and executes a real 8-bit RGB tile job in Chromium opened via `file://`; the browser smoke verifies changed tile data, not just a trivial Worker echo.

**Production boundary:** The normal page does **not** load this supplier and its Content-Aware Fill button is **not yet Worker-backed**. This isolated build/test step does not implement owner-aware cancellation, fallback for blocked Blob Workers, transfer budgeting or large-PSD/PSB browser profiling. The next pass must wire this source through a documented runtime loader and the existing job controller without introducing a hidden mutable global or breaking file:// startup.

## Worker lifecycle seam — isolated Stage 003 (2026-10-10)

`src/core/tiled-inpaint-worker-client.js` owns **one active isolated job** at a time using an injected `createWorker` factory. It speaks the existing `{ready:true}` → `{id,...job}` → `{id,ok,result|error}` protocol. Both Node `worker_threads` and browser-style Worker event APIs are supported; a new job supersedes the old worker, and `cancel()` detaches listeners, terminates the worker and resolves the obsolete job as `{cancelled:true}`. It also checks an injected `isCurrent()` predicate before dispatch and before accepting a reply. Errors and invalid replies reject, never publish partial data. The result is still detached; only the **calling document owner** can commit to a layer/history.

**Граница:** это не UI wiring и не `file://` browser Worker bootstrap. Ошибки десериализации сообщений (`messageerror`) у browser и Node-shaped Worker завершают job с очисткой обработчиков/`terminate()`, а partially valid Worker из фабрики освобождается перед отказом, если у него есть `terminate()`. Это fail-closed обработка транспорта, а не retry/fallback выполнения. `isCurrent` не отслеживается автоматически во время синхронного kernel: владелец должен вызывать `cancel()` при смене документа/слоя/исходного source. Именно `terminate()`, а не cooperative check внутри kernel, обеспечивает принудительный останов. Для production ещё нужны гарантии lifetime/identity при каждом UI change и browser fallback при заблокированных `file://` Workers. Проверка: `tests/tiled-inpaint-worker-client.test.mjs` (real Node Worker, fake browser events, stale/superseded/error states).

# task — очередь небольших инженерных проходок

## Проходка Stage 003 — быстрый abort ожидания browser Worker bootstrap (2026-10-10)

- Обнаружен промежуток отмены **до** создания `Worker`: `cancel()` или новый вызов `run()` раньше оставляли предыдущее ожидание single-flight `file://` supplier до скриптового `onload` / timeout (до 5 секунд). Теперь stale bootstrap promise завершается сразу, loader для следующей операции сохраняется, compute errors по-прежнему fail closed.
- Регрессии: `tests/tiled-inpaint-browser-worker.test.mjs` — cancel/supersede до `onload`, отсутствие дубля `script`, отсутствие создания устаревшего Worker, штатный запуск следующего задания; обновлены browser bundle и cache manifest. Подэтап закрыт: [PR #163](https://github.com/zeter1/ZeTer-Photo-Editor/pull/163) слит (squash `ef2b820d940dc32bd6e0a325d96f0bc9ed60644b`), [PR CI #38066925074](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38066925074) и [точный `main` push CI #38066973642](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38066973642) завершились **success**.
- **Следующая задача:** отдельно добыть независимые Photoshop-authored 16/32-bit PSD/PSB fixtures с SHA-256 и лицензированным provenance, провести file:// decode → tiled UI Worker → preview и memory/latency profile. После этого — широкий connected ROI и реальное прерывание fallback/preview. Основные `002` и `003` **ещё не закрыты**.



## Подэтап Stage 003 — упорядочивание CDP memory snapshots (2026-10-10)

- Устранена гонка между таймером, явными контрольными точками и финальным `stop()` в `tools/browser-renderer-heap-sampler.mjs`: CDP-замеры выполняются строго в порядке постановки, а отказ отдельного маркера не блокирует очередь. Новые регрессии проверяют перекрывающиеся poll/marker/stop и восстановление после ошибки.
- Это точность **тестового профилирования**, не измерение истинного peak RSS/Worker heap. **Подэтап закрыт:** [PR #162](https://github.com/zeter1/ZeTer-Photo-Editor/pull/162) слит, squash `7fce7decd0b2133aa3bf990abcd2ee5ce7677d25`; [PR CI #38065721850](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065721850) и [точный main push CI #38065777660](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065777660) — **success**.
- **Следующая проходка:** независимые Photoshop-authored 16/32-bit PSD/PSB с pinned SHA-256; browser decode → tiled UI Worker → preview/Undo и информационный memory/latency профиль; затем широкий связный ROI, прерывание fallback/preview. Общие задачи **002 и 003** остаются открытыми.


## Закрытый подэтап — Stage 003: процессная память Chromium (2026-10-10)

- К CDP renderer heap profiler добавляется независимый браузерный `SystemInfo.getProcessInfo`: информационная сумма `privateMemory` по **полному** списку процессов с baseline/sampled max/end. При отсутствии поддерживаемого поля результат будет явным `unavailable`, а не придуманным RAM-значением. Это тестовая инфраструктура, без изменения поведения приложения или версии. [PR #161](https://github.com/zeter1/ZeTer-Photo-Editor/pull/161) слит; [PR CI #38065177692](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065177692) и [main CI #38065240683](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065240683) **success**. Подробности в [003](003-tiled-content-aware.md).
- **Следующая проходка:** реальные external Photoshop-authored 16/32-bit PSD/PSB с pinned hashes, browser Worker/process memory и pixel/preview invariants; широкий connected ROI и interruptible fallback. Нынешний synthetic 8×8 `.zpe` не доказывает обработку больших PSD/PSB. Открыты задачи **002 и 003**.


## Текущий подэтап Stage 003 — sampled browser renderer JS heap (2026-10-10)

- К 16-bit `file://` UI Worker regression добавлен CDP sampler для renderer JS heap: baseline, sampled maximum, отметки после import/preview, Worker/preview и Undo/Redo, информационное elapsed time. Unit-тесты проверяют числа и отказ/cleanup. Подробнее — [003](003-tiled-content-aware.md).
- **Не путать с готовым 16/32-bit PSD/PSB профилем:** тестовый .zpe synthetic RGB16, heap метрика не включает сам Worker/RSS/native/GPU, выборочная максимальная точка не равна истинному peak. Нет допущения о поддержке тяжёлых Photoshop-файлов по одному этому измерению.
- **Следующая проходка:** pinned реальные external Photoshop-authored 16/32-bit PSD/PSB (decode → native tiles → UI Worker → preview) с hashes и browser process/Worker high-water memory; далее широкий connected ROI и interruptible fallback/preview. Обе задачи `003` и `002` остаются открытыми.

## Последний закрытый подэтап — Stage 003: отмена stale Worker (2026-10-10)

- **Слито в `main`:** [PR #158](https://github.com/zeter1/ZeTer-Photo-Editor/pull/158), squash `7d782443c36032e558794d58fa4f712196537b62`. Bounded polling `isCurrent` (50 мс) работает только во время активного browser Worker; при смене слоя/source/lock выполняется `terminate()` без ожидания Worker-ответа. Node regression проверяет timer cleanup, reentrant polling и restart. [PR CI #38063616039](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38063616039) **success**, [точный `main` push CI #38063682771](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38063682771) **success**. Подэтап закрыт; задача 003 остаётся открытой.
- **Следующая проходка:** browser peak memory/latency real 16/32-bit PSD/PSB (decode → tiled fill → preview) с независимыми fixture hashes и отсутствием CI time threshold. Затем wide connected ROI и отмена синхронного fallback/preview. Целиком `003` остаётся открытой.

## Последний закрытый подэтап — Stage 003: end-to-end UI Content-Aware Fill (2026-10-10)

- Цель проходки: реальный `file://` импорт native `.zpe` с 16-bit RGB tiled источником, прямоугольное выделение через pointer, Edit → Content-Aware Fill, наблюдение реального `Worker.postMessage`, изменение пикселя, **одна** History-запись, Undo/Redo.
- Охват: `tools/browser-smoke.mjs` (только regression, без изменения production runtime и SemVer). 16-bit RGB: 9 восстановленных пикселей на 4 tiles, 1 Worker job, 1 History commit, Undo/Redo. [PR #156](https://github.com/zeter1/ZeTer-Photo-Editor/pull/156) merged (squash `e2e8778a03c532c5aa2e89f71989f2fad31bd5c3`), [PR CI #38062298829](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38062298829) **success**, [exact main push CI #38062372137](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38062372137) **success**.
- **Следующая проходка по 003:** browser-side peak RAM/latency для настоящих 16/32-bit PSD/PSB (декодирование → tiled command → preview) с измерениями baseline/peak, контроль неизменённых tiles, без неустойчивых CI time thresholds. Затем отдельными проходками: wide connected ROI и отмена при остальных live-owner invalidations.
- **После 003:** продолжить [002 — PSD compatibility corpus](002-psd-compatibility-corpus.md) и сверку импорта/экспорта Photoshop. Канонический открытый план: [003](003-tiled-content-aware.md). Обе задачи **не завершены**, пока не удалять.

Эта папка — versioned handoff между короткими ChatGPT/Codex проходками. Она помогает продолжать рефакторинг без повторного чтения всего репозитория.

## Правила

1. Одна будущая задача = один `.md` файл. Имя начинается с приоритета: `001-`, `002-`, …
2. В новой проходке сначала прочитай `AGENTS.md` → `docs/PROJECT.md` → этот README → **только одну** верхнюю релевантную задачу.
3. Task-файл хранит intent/acceptance, но не является source of truth. Текущий код, GitHub, логи, тесты и CI имеют приоритет.
4. Перед изменением всё равно делай INSPECT → DIAGNOSE; не исполняй старый план механически.
5. Одна проходка должна оставаться bounded: один связный owner/root cause, его tests/docs и verification. Не смешивай независимые feature/fix/refactor.
6. Для code change обновляй `CHANGELOG.md`; для production/runtime change с изменением пользовательского поведения одновременно делай SemVer bump по `docs/development/CHANGELOG_GUIDE.md`; `package.json` — источник версии, а `index.html`/`version.json` синхронизируются canonical build. Generated `src/app.bundle.js` вручную не редактировать.
7. После PR: дождись CI, разберись с первым failed step по логам, исправь root cause, затем merge. После merge проверь main CI.
8. **Завершённую задачу удалить из `task/` только после merge + green main CI.** README остаётся.
9. Если задача стала неактуальной из-за нового кода/решения, удали или перепиши её отдельным docs-only изменением; не сохраняй stale queue.
10. Не читай все task-файлы «для контекста»: это снова тратит токены и ухудшает фокус.
11. Перед extraction функции/owner-а проверь не только production callers, но и тесты, которые вырезают/eval-ят source (`runInNewContext`, `vm`, `eval`, `slice/indexOf`, regex/source guards): их explicit harness dependencies нужно обновлять в той же проходке, не маскируя CI runtime-fallback'ами.
12. После удаления/переноса helper/predicate сделай repository-wide reference closure: проверь не только прямые вызовы, но и lazy/runtime callbacks (menu enable predicates, keyboard/context actions, deferred handlers). Source/unit tests могут не выполнить такой путь; canonical browser/runtime smoke обязателен перед merge для UI extraction.
13. Если проходка выявила устойчивую спецификацию/паттерн/инвариант, который следующей AI-сессии дорого заново выводить из кода, обнови или создай узкий документ и свяжи его с `AGENTS.md` / `PROJECT.md` / картой архитектуры. Не плодить дублирующие «простыни»: progressive disclosure важнее количества документации.
14. Для post-merge verification не ограничивайся helper-ом, который может фильтровать только `pull_request` runs. Если exact merge-SHA push run не виден, используй provider-native GET коллекции `actions/runs?head_sha=<merge-sha>` через GitHub fetch и проверь `event=push`, `head_branch=main`, exact `head_sha` и `conclusion=success`; при failure переходи к jobs/logs.
15. При добавлении модуля в canonical `file://` bundle помни, что `tools/build-bundle.mjs` снимает ESM-обёртку и конкатенирует classic-script chunks. Если новый модуль использует импортированные `const`/`let` во время module evaluation, его source-order обязан идти после owner-а этих bindings; добавь architecture guard на порядок, а не полагайся только на корректность ESM imports.

## Последний закрытый подэтап — Stage 003 browser adapter regression (2026-10-10)

- Проверка production browser adapter `createBrowserTiledInpaintWorkerController` в реальном Chromium `file://`: script loader, tile compute, отсутствие изменения donors, terminate активного Worker, restart. Реализуется как browser smoke regression без изменения user-facing runtime или версии. [PR #155](https://github.com/zeter1/ZeTer-Photo-Editor/pull/155) merged, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38061159764) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38061213305) **success** на squash `631dcac7a4b2cf60ccd2846bd58349aec7ff867a`; подробнее — [003](003-tiled-content-aware.md).
- Не путать controller-level проверку с ещё не выполненным UI end-to-end и real high-depth PSD/PSB peak-memory profiling. `003` остаётся в очереди. Смена документа / вкладки уже вызывает `rasterEdit.reset()` в `src/main.js`, а та — `tiledInpaintWorker.cancel()`; повторно этот код не писать без воспроизводимого бага.

## Последний закрытый подэтап — Stage 003 UI Worker handoff (2026-10-10)

- В `main` реализован dispatch tiled Content-Aware Fill из `src/painting/controller.js` через `src/painting/tiled-inpaint-dispatch.js` с lazy `file://` Worker, one-pass frozen selection, guarded cancellation и fallback на те же indices при `unavailable`.
- **Verified gate:** [PR #154](https://github.com/zeter1/ZeTer-Photo-Editor/pull/154) merged squash `bf76922ff21455a2c16ed6c2872da22deffc28f0`; [PR CI #38060575417](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38060575417) and [exact `main` push CI #38060648765](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38060648765) passed Node tests, generated bundle parity, file:// Chromium smoke and profilers. Runtime version **1.45.0**. Подэтап закрыт; задача **003 остаётся открытой**. Следующие отдельные шаги — profiling real high-depth PSD/PSB в браузере, latency/RAM, wide connected ROI и proactive terminate при смене контекста без ожидания Worker event.

## Последний закрытый подэтап — Stage 003 browser Worker loader (2026-10-10)

- Добавлен независимый browser adapter `src/core/tiled-inpaint-browser-worker.js` для generated `file://` classic Worker supplier: lazy single-flight load, bounded timeout, Blob Worker bootstrap, безопасные `unavailable` / `cancelled` outcomes и generation guards. Регрессии — `tests/tiled-inpaint-browser-worker.test.mjs`.
- **Не считать UI Worker integration выполненной:** `src/painting/controller.js` ещё вызывает cooperative main-thread path. Следующий кандидат — реальное подключение frozen selection indices → Worker с fallback и тестом браузерной транзакции. После этого RAM/latency профили, широкий связный ROI. [PR #153](https://github.com/zeter1/ZeTer-Photo-Editor/pull/153) слит на squash `de10a1dba24ab05017de264a383fa4f674b46e7a`, [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059806464) + [exact main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059867375). `003` остаётся открытой.

## Последний закрытый подэтап — frozen-index fastpath Worker (2026-10-10)

- **003 / frozen-index compute:** Worker передаёт валидированные selected indices непосредственно в ROI kernel без повторного полного прохода по `width × height`. [PR #152](https://github.com/zeter1/ZeTer-Photo-Editor/pull/152) слит (squash `08933fcf603aa7847d422d7c6138cc1f2f96c02c`); [PR CI #38059123293](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059123293) и [exact main push CI #38059186053](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059186053) **success**, включая Node tests, генерируемые файлы и Chromium file:// smoke. **003 остаётся открытой:** следующий приоритет — browser UI Worker dispatch/loader/fallback, exact-owner cancellation и большой реальный PSD/PSB browser-memory профиль. Подробности — [003-tiled-content-aware.md](003-tiled-content-aware.md).

## Предыдущий закрытый подэтап (2026-10-10) — file:// classic Blob Worker compute

- **003 / browser Worker bootstrap** — самодостаточный classic Worker из канонических модулей выполняет реальную tiled-заливку в Chromium через Blob при открытом `file://`, без Worker-side network/import. Generated supplier актуализирует обычная сборка; parity и CMYKA тестируются отдельно. [PR #151](https://github.com/zeter1/ZeTer-Photo-Editor/pull/151) слит, [PR CI #38058334339](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38058334339) и [exact main push CI #38058388873](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38058388873) — success на squash `ccf4e4865fb9840fb5b34a0926185dd8316acd2f`. **В основном UI ещё не включено.** Следующая задача: runtime loader/fallback + exact-owner lifecycle/cancellation и real heavy PSD/PSB UI profile. Общая 003 остаётся открытой.

## Предыдущий закрытый подэтап (2026-10-10) — Worker selection bitmap

- **003 / Worker bitmap** — в detached compute вместо `Set` используется bitmap максимум 2 MiB; проверены CMYKA parity, дубликаты/индексы и malformed geometry. [PR #150](https://github.com/zeter1/ZeTer-Photo-Editor/pull/150) слит, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38057597657) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38057640261) зелёные на squash `04650b6087154aeff7d8a5e4e87e70c2cb35fa43`. Полный scan остаётся; далее browser `file://` Worker bootstrap + fallback, exact-owner UI integration, mid-kernel cancellation и проверка тяжёлых PSD/PSB. Задача 003 **не закрыта**.

## Предыдущий закрытый подэтап (2026-10-10)

- **003 / Worker `messageerror` fail-closed** — browser/Node Worker transport теперь отклоняет неисправное сообщение и освобождает обработчики/Worker, некорректный результат фабрики не оставляет живой поток. [PR #149](https://github.com/zeter1/ZeTer-Photo-Editor/pull/149) слит; [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38056934228) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38057003202) зелёные, squash `964b41aab9633feb4bc1b0bfb4056d6267ac46f4`. Далее browser `file://` Worker bootstrap/fallback + exact-owner UI integration. Общая задача 003 остаётся **открытой**.

## Ранее закрытый подэтап (2026-10-10)

- **003 / Worker lifecycle reentrant startup** — исправлены синхронные `ready`/`error`/registration exceptions, ранее оставлявшие обработчики либо «активную» уже завершённую задачу. [PR #148](https://github.com/zeter1/ZeTer-Photo-Editor/pull/148) слит; [PR CI #38056357279](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38056357279) и [exact main push CI #38056411335](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38056411335) успешны, SHA `b68aaaa29cdbc13e66e184e153e9aab804857757`. Следующая проходка: browser `file://` Worker bootstrap/fallback + UI integration с exact owner/cancellation; подробности — [003-tiled-content-aware.md](003-tiled-content-aware.md).

## Приоритеты по плану на скриншотах

- [002 — PSD/PSB compatibility corpus](002-psd-compatibility-corpus.md) — в работе: generated nested masks/groups/adjustments corpus; pinned external PSD/PSB merged-preview RLE oracle реализован и слит ([#130](https://github.com/zeter1/ZeTer-Photo-Editor/pull/130), зелёный main CI). Далее — Adobe/reference rendering semantics и cross-group mask fixtures. Не удалять до merge + green main CI.
  - Слитый подэтап 002: независимый raw-wire oracle PSD/PSB mask channels и `lsct` boundaries ([PR #132](https://github.com/zeter1/ZeTer-Photo-Editor/pull/132), [зелёный main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38046682118)). **Следующий шаг:** Adobe/reference compositing и независимые Photoshop-authored cross-group masks/adjustment fixtures; весь пункт 002 ещё открыт.
- [003 — tiled Content-Aware Fill](003-tiled-content-aware.md) — ROI-подэтап [PR #134](https://github.com/zeter1/ZeTer-Photo-Editor/pull/134) слит, [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38047465391). **Задача остаётся открытой:** профилирование RAM/latency, worker/cancellation и широкие/разрозненные выделения. Подэтап single-evaluation frozen selection — [PR #136](https://github.com/zeter1/ZeTer-Photo-Editor/pull/136) merged, [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048127653) + [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048171147). **003 остаётся открытой:** profiling, worker/cancellation, wide/disconnected masks.

Подэтап Worker lifecycle/cancellation для 003 **слит** ([PR #147](https://github.com/zeter1/ZeTer-Photo-Editor/pull/147), [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38055816486), [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38055884171), exact squash `13a894c2551b35b8488e5f921a80c5c469ff4e56`). `src/core/tiled-inpaint-worker-client.js` и регрессия `tests/tiled-inpaint-worker-client.test.mjs` проверяют cancellation/late reply/owner guard и реальный Node Worker; это **не UI/file:// integration**. Следующий приоритет — браузерный Worker bootstrap с fallback и exact-owner publication. Общая 003 открыта.

Очередь отражает незакрытые направления; реализацию не дублировать с параллельными PR. Следующую задачу брать только после сверки с кодом и статусами CI.

## Минимальный шаблон задачи

- Goal
- Why now / evidence
- Scope / non-scope
- Inspect first
- Behavioral contracts to preserve
- Planned extraction/fix
- Targeted tests
- Required verification
- Done gate
- Risks / handoff notes

Практика основана на repository-local execution plans и progressive disclosure: OpenAI Harness Engineering (2026-02-11) и принципе Google Small CLs — одна self-contained change с related tests.

### Подэтап 003 — 2026-10-10 ([PR #138](https://github.com/zeter1/ZeTer-Photo-Editor/pull/138), слито)

- Реализована tiled Content-Aware Fill для удалённых halo-disjoint островков ([PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38049643830), [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38049694526), squash `e7188ac9ec021e8dd23fdf769430e1f5d5febb0b`). Остались memory/latency profiling, worker/cancellation и широкие связные маски. **003 не закрывать**.

### Подэтап 003 — профиль 8/24/48 MiB (2026-10-10, [PR #139](https://github.com/zeter1/ZeTer-Photo-Editor/pull/139))

- Добавлен воспроизводимый `tools/profile-tiled-inpaint.mjs` с isolated process RSS/latency и regression test. Полный запуск прикреплён к CI как **информационное измерение**, без числового pass/fail порога. См. [003](003-tiled-content-aware.md) и `docs/architecture/TILED_RASTER.md`.
- [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38051881786); [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38052035982); merge PR #139 squash `11932992f3213447b8cae9c183eaf80cb2ec6f06`. Benchmark-подэтап завершён после PR+main CI, но реальный PSD/PSB/UI profile остаётся незакрытым. Worker/cancellation, wide connected masks и реальный PSD/PSB + UI memory profile остаются в очереди. **003 открыта**.

### Подэтап 003 — cooperative scan (2026-10-10, [PR #141](https://github.com/zeter1/ZeTer-Photo-Editor/pull/141), слито)

- Реализуется chunked, cancellable scan frozen selection с exact-owner abort в `src/core/pixel-buffer.js` / `src/painting/controller.js`, регрессии в `tests/tiled-inpaint-cooperative.test.mjs`. [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38053077787), [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38053128507), exact merge SHA `74d2e14c0901c4088322c5fc3bb982f1528fe5d4`; scan-подэтап закрыт, но **не удалять 003**. Следующие проходки: Worker execution/kernel cancellation, wide connected selection и реальные PSD/PSB UI memory profiles.

### Подэтап 003 — external PSD/PSB decode/profile (2026-10-10, [PR #143](https://github.com/zeter1/ZeTer-Photo-Editor/pull/143), merged + main CI green)

- Добавлен отдельный informational benchmark реальных upstream PSD CMYK и layered PSB (`tools/profile-real-psd-inpaint.mjs`) со сверкой исходных SHA-256, раздельными стадиями decode→tiles→inpaint и process-wide RSS. Тест проверяет sync/cooperative parity и отмену ещё до ROI decode на *внешнем* корпусе. Это тестово-измерительная проходка без production logic / version bump.
- **Gate внешних 8-bit PSD/PSB fixtures закрыт:** [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054015772), [exact main push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054094819), squash SHA `36236c0c17584bf46669fc93a32bc90a7bec10b5`; 1046 Node tests + browser/file:// smoke. **Открыто:** большие реальные 16/32-bit PSD/PSB + browser UI profile, worker-owned kernel/true cancellation и широкий связный ROI. **003 не удалять**.

### Подэтап 003 — Worker protocol probe (2026-10-10, [PR #145](https://github.com/zeter1/ZeTer-Photo-Editor/pull/145), слито)

- Создан узкий Node `worker_threads` proof-of-contract для frozen selection → tiled inpaint compute → structured-clone result с sync parity и отрицательными тестами. Это **не** браузерная Worker-интеграция и **не** mid-kernel cancellation. Подробности в [003](003-tiled-content-aware.md). [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054919946) и [exact main push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054978347) для squash `9c63a0e50516c34bd91d98dba88bfc27eee19040`. Никаких выводов о `file://` Worker или об устранении main-thread latency пока не делать; **003 открыта**.

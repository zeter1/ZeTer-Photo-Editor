> **003T/2b-1 implementation merged (2026-10-19):** [PR #283](https://github.com/zeter1/ZeTer-Photo-Editor/pull/283) → [main 73839c6](https://github.com/zeter1/ZeTer-Photo-Editor/commit/73839c6b76db181af523a7eb03216a4007ed55bf); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39252673346) including full `npm run check`, genuine Chromium `file://` PSD16/PSB32 browser smoke and JSON artifact verification. Main [exact SHA CI #39253156164](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39253156164) is **PENDING** at writing; recheck before marking substep DONE. NEXT P1 [003T/2b-2](003t-operation-memory-evidence.md) — independent controlled real Chromium Worker/target, short-lived PID/proc gaps, honest sampled limits. Operation peak and Worker→PID **unknown**; P0 002B/2c BLOCKED; Stage 003 OPEN.

> **CURRENT 003T/2b-1 IN PROGRESS (2026-10-19):** [003T](003t-operation-memory-evidence.md) now guards real-shaped Linux RSS/CDP PID membership, per-incarnation starttime, RSS aggregate and individual VmHWM consistency **before** accepting observational RSS. New independent real Linux child process + synthetic corrupt-/proc regressions added in [`tests/browser-rss-sample-identity.test.mjs`](../tests/browser-rss-sample-identity.test.mjs). **PR CI, merge, exact-main PENDING**; not marked DONE. **NEXT 003T/2b-2:** independent real Chromium `file://` Worker/target lifetime control with sampled windows, short-lived process gaps, fail-closed artifact evidence and successful CI. No proven operation peak or Worker→PID; P0 002B/2c BLOCKED; Stage 003 OPEN.

## 2026-10-19 — 003T/1 and 003T/2a merged; next 003T/2b independent memory control

[003T/1 PR #280](https://github.com/zeter1/ZeTer-Photo-Editor/pull/280) merged as `1140b886` with exact-main [core success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249020260) + [genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249020566). [003T/2a PR #281](https://github.com/zeter1/ZeTer-Photo-Editor/pull/281) merged as `a18c828`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249834322), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39250278990). No production Fill implementation was changed: diagnostics now distinguish admitted timer polls from missed ticks during both in-flight and queued explicit milestones. 003T remains IN PROGRESS; next [003T/2b](003t-operation-memory-evidence.md) must use independent Chromium memory workload/observation quality gates, without claiming true peak or Worker PID. Stage 003 OPEN.

## 2026-10-19 — 003T/2a: timer polls blocked by active or queued memory milestones (IN PROGRESS)

В diagnostic CDP sampler `snapshot()` теперь учитывает запущенные **и поставленные в очередь** обязательные snapshots. Пока хоть один такой read ожидает или выполняется, timer tick помечается `pollsSkippedBusy`, а не создаёт поздний периодический отсчёт. Отрицательная регрессия охватывает очередь milestone и последующее освобождение после ошибочного read. Изменение не затрагивает production Fill/Worker и не превращает samples в true operation peak; PID→Worker всё ещё `unknown`. [003T](003t-operation-memory-evidence.md) и Stage 003 OPEN. Предыдущий 003T/1 PR #280 merged `1140b886`; exact-main CI и новый PR пока проверяются.

## 2026-10-19 — 003T/1: instrumentation интервалов реального browser memory sampler (IN PROGRESS)

Новый P1 подэтап [003T](003t-operation-memory-evidence.md): `browser-renderer-heap-sampler` различает requested interval и фактически пропущенные polls, продолжительность каждого async CDP→/proc чтения и паузы между чтениями. Инструментация входит в реальные PSD16/PSB32 memory artifacts и verifier, который не допускает forged true peak/Worker PID. Тесты добавлены, но PR CI и exact-main **не проверены**; Chromium read windows **не являются непрерывным измерением или истинным operation peak**. Stage 003 остаётся открытым; следующий 003T/2 — реальные CI наблюдения/independent control. P0 002B/2c без Adobe Photoshop PSB32 остаётся BLOCKED.

> **003S DONE (2026-10-19):** [PR #278](https://github.com/zeter1/ZeTer-Photo-Editor/pull/278) merged [main 4ea1f59](https://github.com/zeter1/ZeTer-Photo-Editor/commit/4ea1f59e6179f882d0c249dd4a6d0f49aae5e2ec); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39240146195) and [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39240633050). Некорректные CDP PID больше не допускаются к aggregate privateMemory или Linux RSS; сохраняется независимость renderer/Worker census, новые negative regressions. **NEXT P1 [003T](003t-operation-memory-evidence.md) TODO:** real high-depth browser operation memory peak methodology, observation coverage, documented Worker→PID proof or `unknown`. **P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED** pending licensed Photoshop-authored PSB32. Whole Stage 003 remains OPEN. [Card](003s-cdp-pid-aggregate-integrity.md).

> **003R DONE (2026-10-19):** [reentrant Worker handoff](003r-worker-reentrant-ownership.md) merged [PR #276](https://github.com/zeter1/ZeTer-Photo-Editor/pull/276), main `56da5c8`; PR core + photo checks and exact-main primary CI successful. Subsequent Stage 003 P1: operation peak memory evidence and Worker→PID attribution, never infer from sampled HWM alone. Whole Stage 003 remains OPEN. [Exact-main real-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39236490639).

> **036C ЗАКРЫТА (2026-10-14):** реальные Chromium file:// PSD16/PSB32 wide ROI получают шесть timed CDP/Linux observations в versioned JSON, независимый CI verifier и negative evidence tests. [PR #222](https://github.com/zeter1/ZeTer-Photo-Editor/pull/222) → [27dbb27](https://github.com/zeter1/ZeTer-Photo-Editor/commit/27dbb2718ea0078dbbfffe09870494d8d90480bc), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38580054433), [exact main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38580574257). **Не доказаны** true operation RSS peak, Worker→PID и Photoshop-authored parity. Далее P1 [037](037-real-photo-connected-roi-benchmark.md), P0 [002](002-psd-compatibility-corpus.md). Общая Stage 003 открыта.

> **036B закрыта (2026-10-14):** [PR #221](https://github.com/zeter1/ZeTer-Photo-Editor/pull/221) → [`7fbc9117`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7fbc9117f617c4495ac0d0c20151145a177eb165); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38576559275), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38577167032). Настоящий Chromium file:// PSD16/PSB32: UI polygon 8288, native Worker, публичный Save Project original/Fill/Undo/Redo и exact unchanged outside/alpha; MAE RGB16 32333.333→0, Float32 1.4583→0 (ZeTer synthetic). Следующая [036C](036-browser-connected-roi-quality.md) — operation JSON/RSS/CDP sampling + validator. Adobe corpus [002](002-psd-compatibility-corpus.md) и общий Stage 003 по-прежнему открыты.

> **036A (2026-10-14, слито; exact-code main CI success):** добавлен test-only native oracle для wide connected ROI 8288 и проверки полного byte/Undo/Redo/sampling evidence; реальные Chromium UI, operation JSON, PR/exact-main CI остаются очередью [036](036-browser-connected-roi-quality.md). [PR #220](https://github.com/zeter1/ZeTer-Photo-Editor/pull/220) → `94633e9`, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38566438939) и [main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38566790704) success. Это не завершает Stage 003 и не подменяет внешние Adobe fixtures [002](002-psd-compatibility-corpus.md).

## 2026-10-14 — 035: Chromium recovery startup race закрыта

- [035](035-browser-recovery-modal-flake.md): три настоящих Chromium `file://` reload с задержанным IndexedDB; startup barrier `appReady=true` до 010D native Fill. [PR #219](https://github.com/zeter1/ZeTer-Photo-Editor/pull/219) → `66f41e6`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38563696598), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38564063538). Это надёжность тестового smoke, не качество Inpaint.
- **Далее [036](036-browser-connected-roi-quality.md):** настоящий wide connected ROI + quality/latency/RSS evidence и [002](002-psd-compatibility-corpus.md) licensed external Adobe Photoshop golden. Stage 003 остаётся открытой.

## 2026-10-14 — 024D3: Native synthetic connected ROI MAE/RMSE (слито, CI success)

- [034](034-complex-roi-native-quality.md): реальный **Node** Worker профиль сложного связного RGB16/CMYKA32 ROI теперь публикует независимые от inpaint-ядра baseline/repaired MAE/RMSE и гарантирует нетронутые native samples вне selection/alpha. Для 8288 выбранных пикселей сравнивает с заведомо чистым ZeTer-generated постоянным фоном. Существующие byte parity/отмена остаются в силе. [PR #218](https://github.com/zeter1/ZeTer-Photo-Editor/pull/218) слит (`8208ab9`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545340603), [main CI rerun success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383).
- **Открыто:** wide connected ROI в **Chromium `file://`**, внешний Adobe Photoshop-authored golden, memory peak и real-image quality. Stage 003 не закрыта. Отдельный [035](035-browser-recovery-modal-flake.md) — гонка startup recovery prompt в 010D browser smoke.

## 2026-10-14 — 024D2: native known-reference quality в реальном браузере (слито, exact-code main CI success)

- [033](033-browser-synthetic-native-quality.md): расширение настоящего Chromium `file://` PSD16/PSB32 UI Worker + cancel/retry/Undo/Redo. Сравнение по native 16/32-bit MAE/RMSE с известным ZeTer-generated фоном на дефекте 5×5, CI JSON fail-closed проверки точности. Погрешность на синтетике ещё не доказывает качества на реальных фотографиях. [PR #217](https://github.com/zeter1/ZeTer-Photo-Editor/pull/217) → `685d178`, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38542625807), [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38543002186) — success.
- **Остаётся:** licensed Adobe-authored external corpus [002](002-psd-compatibility-corpus.md), браузерные wide connected ROI comparisons и реальный operation peak RAM (сейчас только sampled), полноценные Photoshop compatibility tests; Stage 003 открыта.

## 2026-10-14 — 024D1: native selected-pixel byte oracle (слито, exact-code main CI success)

- [032](032-browser-native-selection-integrity.md): новый test-only oracle проверяет изменённые native 16/32-bit bytes в реальном Chromium `file://` PSD16/PSB32 UI Worker против **фактических** frozen selection indices, а не приблизительного rect; проверка для первого Fill/Redo и cancelled-retry/Undo/Redo; новые негативные Node regressions на вневыделенные изменения. [PR #216](https://github.com/zeter1/ZeTer-Photo-Editor/pull/216) merged `f3d1336`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538156947) и [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538532002).
- Внешние Adobe-authored high-depth goldens отсутствуют; это не независимый Photoshop-пиксельный эталон. Real browser peak RAM и качество на широком connected ROI по-прежнему открыты; Stage 003 **не закрыта**.

## 2026-10-11 — 010E-B3B: общий предел работы планировщика (слито, exact-main CI success)

- [023](023-planner-total-budget.md): общая учётная граница 4 194 304 visits/probes на full oversized ROI planning, включая резерв на bounded run sorting. Отказ до tile read при превышении, native RGB16/CMYKA32 sync/cooperative/Worker/cancellation регрессии. [PR #204](https://github.com/zeter1/ZeTer-Photo-Editor/pull/204), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161611345), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161771493). Stage 003 по-прежнему открыта: browser HWM/latency и внешняя Adobe quality parity ещё не доказаны.

## 2026-10-11 — 010E-A: complex connected ROI native diagnostic (слито, CI success)

- [018](018-complex-roi-profile.md): two dense islands + connected diagonal, >256 changed tiles, RGB16/CMYKA32 Node Worker native byte parity, atomic ROI budget/cancel, process RSS observations. [PR #199](https://github.com/zeter1/ZeTer-Photo-Editor/pull/199), squash `b8e82e6`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38153857359), [CI точного кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38154037812). Это baseline для следующего adaptive planner, не Photoshop-authored cross-app golden или browser HWM. Stage 003 остаётся открыта.

## 2026-10-11 — 010D-D: две раздельные native PSB32 UI-сессии (слито, CI success)

- [017](017-dual-native-psb32-session-isolation.md): две разные ZeTer-generated 1025² PSB32 Float32 v2 с отдельными native words; mid-kernel cancellation, второй и первый Worker, точный Undo/Redo и история обеих вкладок. [PR #198](https://github.com/zeter1/ZeTer-Photo-Editor/pull/198), squash `24d0edb7`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152587196), [CI кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152760057).
- **Не закрыто:** P0 [002](002-psd-compatibility-corpus.md) external Adobe golden, P1 010E complex dense ROI и browser peak memory методология. Stage 003 пока открыта.

## 2026-10-11 — P1: >256 occupied tile bounded fallback (слито, CI success)

- [006](006-many-tile-bounded-fragments.md): убран искусственный 256-cell отказ в large sparse selection, при этом старый group-merge ограничен 256 cells для контроля алгоритмической сложности; более широкий случай обрабатывается ограниченными независимыми cells.
- Global frozen donor-exclusion, aggregate ROI budget, private atomic writes и cooperative cancel сохранены. Новые RGB16 / Float32 CMYKA регрессии на 512 tiles, а также Worker parity / cap / cancel.
- **Gate:** [PR #186](https://github.com/zeter1/ZeTer-Photo-Editor/pull/186) слит (`6204003f26f43b3babfa370508565f6ea86225e9`), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136465952) и [точный main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136526958) — **success**.
- **Ещё не завершено:** adaptive dense segmentation, file:// PSD16/PSB32 end-to-end, браузерный peak memory, Adobe authored high-depth corpus и cross-app pixel parity.

## 2026-10-11 — P1: bounded connected ROI with frozen donor bitmap (слито, CI success)

- Реализован резервный план halo-overlapping фрагментов по занятым tile cells для разреженных широких связных выделений, которым раньше не хватало бюджета global bounding ROI. Выбранные original pixels глобально исключены из доноров и PatchMatch-контекста, даже после заполнения соседних private ROI.
- `tests/tiled-inpaint-connected-roi.test.mjs`: Uint16 RGB диагональ, native sync/Node Worker/cooperative parity, bounded area refusal, cancellation без публикации, проверка запрета соседнего source donor.
- **Gate:** [PR #185](https://github.com/zeter1/ZeTer-Photo-Editor/pull/185) merged (squash `1d18f525d62b03eb6734b883e94a8cc5642ca6a1`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135146345), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135223279).
- **Ограничения:** <=256 занятых tile cells, 8 MP aggregate ROI cap, no Photoshop-authored external high-depth pixel golden, no browser PSD/PSB Worker/preview/Undo/RAM end-to-end. Stage 003 и 002 **не закрыты**. Очередь: [NEXT.md](NEXT.md).

## 2026-10-11 — P1: synthetic RGB16/CMYKA32 native Worker byte/memory diagnostic (слито, CI success)

- Добавлены `tools/profile-native-worker-integrity.mjs`, отдельный regression `tests/native-worker-byte-integrity-profile.test.mjs`, CI informational 8 MiB и [короткий checklist](004-native-worker-byte-integrity-profile.md).
- Два native режима, one-shot frozen scan, Worker round-trip и synchronous oracle сравнивают точные native tile payloads и immutable input; каждый профиль изолирован отдельным процессом и пишет JSON snapshots времени/памяти без ложных peak/speed thresholds.
- **Gate пройден:** [PR #184](https://github.com/zeter1/ZeTer-Photo-Editor/pull/184) слит в `main` (`28ec5de2dbdd38e2782a8d5bc864a9dbdc0db5d2`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38133313481) и [точный `main` CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38133376298) — **success** (Node, Chromium `file://`, generated parity, 8 MiB diagnostics, diff hygiene). **Не закрыто:** широкий connected ROI, настоящий Chromium `file://` PSD16/PSB32 → Worker → Undo/Redo и независимые Adobe Photoshop high-depth files/reference render. Это Node synthetic diagnostic, НЕ Photoshop pixel parity.

## 2026-10-11 — P1: native source + Worker changed-pixel byte integrity ([PR #183](https://github.com/zeter1/ZeTer-Photo-Editor/pull/183), merged)

- **Исправлено:** `sanitizeSerializedPixelBufferSource` проверяет canonical Base64 (exact required padding и нулевые unused bits) для v1 и v2; detached Worker reply сравнивается с immutable input на уровне исходных little-endian bytes пикселей, в том числе в выбранном tile. Изменённый пиксель должен быть в frozen selection; `changed` равен настоящему числу changed pixels. Поддельные counts / unexpected donor mutation / pad-bit alias отвергаются до History/preview.
- **Memory contract:** 1 bit per document pixel (до 2 MiB selection bitmap при 48 MiB source); только changed tiles декодируются, одновременно две byte arrays одного tile. Никакой 8-bit preview в integrity oracle.
- **Тесты:** RGB16 и CMYKA32 unselected neighbor byte tamper в выбранном tile, forged counts, same-bytes noncanonical Base64 в detached reply и persisted v1/v2 source; ранее существовавшие Worker parity/cancellation тесты не изменены.
- **Gate:** PR CI [success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38129441200), точный main CI [success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38129498774), squash SHA `884896cf6630083d5760a595c137157e1df7d874`. Node tests, browser `file://` smoke, bundle parity, profilers, diff hygiene прошли.
- **Что не закрыто:** Stage 003 wide connected ROI; real licensed Adobe PSD16/PSB32 + high-depth cross-app oracle; browser peak RAM/Undo/Redo + performance byte validation; RAW/DNG, CMYK soft proof и полная Photoshop compatibility — отдельные gates.

## 2026-10-11 — P1: fail-closed result integrity при UI Worker handoff (слито, CI success)

- src/painting/tiled-inpaint-dispatch.js сверяет detached reply с frozen selectedIndices и канонической native tile topology: counters, depth/model/alpha/profile, координаты и точный подсчёт изменённых tile payloads. Изменять tile без выделенных пикселей запрещено. Некорректный reply не попадает в preview, не запускает fallback и не публикует историю.
- Тест: negative matrix повреждённых Worker replies и сохранность исходного CMYKA Float32 source. Обработка корректного результата покрывается существующим parity test.
- **Gate выполнен:** [PR #181](https://github.com/zeter1/ZeTer-Photo-Editor/pull/181) слит в main (`2e434a74193fcc2d3af3ab8c4886fc1eea83fef8`). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38127890689), [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38127939781) — success: Node, browser file://, generated artifacts, profiles, diff hygiene.
- **Ограничение:** нет дорогостоящего сравнения всех изменённых пикселей внутри выбранного tile; нет Adobe pixel golden. **Следующая проходка:** wide connected ROI без большого global bbox (раздельные immutable donors, atomic commit, precision parity и cancel). Отдельный P0: лицензированные Photoshop-authored PSD16/PSB32 и UI memory/Undo. Обе общие задачи остаются открытыми.

# 003 — Tiled Content-Aware Fill

## 2026-10-11 — P1: source-safe native tiled preview publication (слито, CI success)

- **Gate выполнен:** [PR #180](https://github.com/zeter1/ZeTer-Photo-Editor/pull/180) слит в `main` (squash `c36d64e7d5680233e118e9228c483d6ea4503050`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38126514754) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38126567513) — **success**: Node, generated bundle parity, Chromium `file://`, информативные профили и diff hygiene. Общие задачи 002/003 остаются открытыми.


- `persistTiledHighDepthMutation` now aborts if another edit replaces the source on the same layer during an asynchronous preview. During cooperative tile conversion, it exits before encoding; after PNG completion it revalidates source before publish.
- Added three independent regressions for replacement during tile processing, replacement in PNG encode, and caller continuation revocation. Tests use synthetic native tiles, not Photoshop-authored files.
- **Open:** connected oversized ROI, actual licensed Adobe PSD16/PSB32 browser import/Worker/Undo with memory measurements, and browser PNG encoding cannot be forcibly interrupted once started. Keep tasks 002 and 003 open.


## 2026-10-11 — Stage 003 P1: cooperative RGBA8 tile preview (слито, CI success)

- Преобразование каждого native tile в RGBA8 оставлено в исходном precision pipeline; теперь тайлы обрабатываются кооперативно партиями по 2, с checkpoint `isCancelled` до следующей партии.
- Строится только приватный canvas. В Content-Aware Fill exact document/layer/source guard отменяет изображение ещё до PNG-кодирования, без `dataUrl`, истории и частичной публикации.
- Регрессии RGB16, Float32 CMYKA, паритета sync/cooperative tile iterator и смены документа во время RGBA conversion: `tests/tiled-preview-cooperative.test.mjs`.
- **Gate выполнен:** [PR #179](https://github.com/zeter1/ZeTer-Photo-Editor/pull/179) слит (squash `245676f0ea5776d3c44b768cd05b596bcf020f2e`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38125653965) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38125704626) завершились **success**. Node, generated parity, Chromium `file://`, оба informational profiles и diff hygiene прошли. Это закрывает только cooperative RGBA8 preview; задачи 002/003 по-прежнему открыты.
- **Ещё открыто:** широкий connected ROI без inflated bounding box, синхронный этап PNG encoding, независимый лицензированный Photoshop PSD16/PSB32 corpus с hash/provenance и Chromium Worker/Undo/RAM профилирование. Вся 003 открыта.


## 2026-10-11 — Stage 003 P1: cooperative native tiled writeRegion (слито, CI success)

- Добавлен общий iterator writeRegionSteps и отменяемый writeRegionCooperative: промежуточные массивы tiles остаются приватными, checkpoint каждые 32 768 pixels, никакой новой dirty/preview публикации до commit.
- Native Content-Aware fallback подключён к новому generator step; sync Worker и Node используют тот же алгоритм без await.
- Регрессии: RGB16 sync/cooperative byte parity, Float32 CMYKA, частично подготовленный ROI, сохранение предыдущих dirty tiles и отмена в inpaint write.
- **Следующие P1:** длинный connected ROI без inflated bbox; chunked RGBA8 preview. **P0:** независимый лицензированный Photoshop PSD16/PSB32 corpus и Chromium file:// Worker/Undo/RAM profiling. Задачи 002 и 003 открыты.
- **Gate выполнен:** [PR #178](https://github.com/zeter1/ZeTer-Photo-Editor/pull/178) слит (squash `e0cefd6a86382c1382c28171aac302bf41ddd524`). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38124785782) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38124840630) завершились **success**: Node, generated parity, Chromium `file://`, informational profiles и diff hygiene. Это закрывает только подэтап cooperative write; 002/003 открыты.

## 2026-10-11 — Stage 003 P1: cooperative native tiled readRegion (слито, CI success)

- Общий sync/cooperative iterator копирует native ROI с контрольной точкой каждые 32 768 pixels; отмена не возвращает частично считанные данные и не помечает tiles dirty.
- Native Content-Aware fallback теперь использует cooperative чтение для одиночных/разделённых ROI. Synchronous Worker/Node сохраняет тот же детерминированный алгоритм.
- Регрессии RGB16 и Float32 CMYKA: exact parity, отмена после частичной декодировки, unchanged source и прежняя отмена внутри kernel после read checkpoints.
- **Осталось:** cooperative `writeRegion`, длинные connected ROI без inflated bbox, chunked RGBA8 preview, реальный независимый лицензированный Photoshop PSD16/PSB32 corpus и браузерная проверка Worker/Undo/RAM. Задачи 002 и 003 остаются открытыми.
- **Gate выполнен:** [PR #177](https://github.com/zeter1/ZeTer-Photo-Editor/pull/177) слит (squash `bff5a5ac609733a32e93513672bd21c6064b8fa1`). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38122773381) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38122815550) — **success**: Node tests, generated artifacts, Chromium `file://` smoke, informational profiles и diff hygiene. **002/003 ещё открыты**.

## 2026-10-11 — измеряемый синхронный tiled region IO baseline (слито, CI success)

- Инструмент `tools/profile-tiled-region-io.mjs` отдельно фиксирует подготовку фикстуры, `readRegion`, `writeRegion`, сериализацию и process-level memory samples для RGB16 и CMYKA Float32 на 1024×512 с ROI через границы 256-px tiles.
- Автоматическая проверка запрещает потери native precision, любое изменение исходных payloads, запись соседних tiles и изменение более одного пикселя. Это инструмент **диагностики**, не новый renderer и не реализация cooperative IO.
- Следующий кодовый шаг: общий пошаговый iterator для sync/cooperative `readRegion`, далее `writeRegion` с exact-owner cancellation и all-or-none publish; сначала тест на отмену после декодирования первых тайлов, затем на изменение документа между чанками. Отдельно держать wide connected ROI, RGBA8 preview и реальные сторонние high-depth PSD/PSB.
- Gate пройден: [PR #176](https://github.com/zeter1/ZeTer-Photo-Editor/pull/176) слит в `main` (`b56ad540e5f7876230db0fa47bc532583a960aea`), [точный main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38122037274) — **success**. Node, generated parity, Chromium `file://` и diff hygiene прошли; задача 003 остаётся **открытой**.


## 2026-10-11 — Cooperative dirty-tile serialization (слито, CI success)

- Вместо единственного blocking `working.serialize()` после private ROI новый общий generator передаёт sync-исполнителю обычную сериализацию, а cooperative fallback — `serializeCooperative()`, который отдаёт управление после каждых четырёх изменённых tiles, но не тратит checkpoints на untouched tiles.
- Успех должен сохранять идентичные bytes/source/counters относительно синхронного пути. Отмена даже после нескольких encoded tile payloads должна вернуть `{cancelled:true,source:original,changed:0,...}` без каких-либо видимых результатов.
- Scope tests: `tests/tiled-raster-source.test.mjs` и `tests/tiled-inpaint-cooperative.test.mjs`. **Gate выполнен:** [PR #175](https://github.com/zeter1/ZeTer-Photo-Editor/pull/175) (squash `11aec98b5958dacbca97d7e7ca47096fc2301823`), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38121282434) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38121334792) — **success**; `npm run check`, generated parity, Chromium `file://` smoke, profiles и diff hygiene прошли.
- После проходки остаются крупные задачи: sync tiled `readRegion`/`writeRegion` и preview, wide connected ROI без inflated bbox, браузерный high-depth PSD/PSB corpus с независимой provenance/license/hash и memory profiling. **003 не закрыта.**

## 2026-10-11 — один большой native ROI: cooperative kernel (слито, CI success)

- Новая общая пошаговая реализация ядра поддерживает и прежнее синхронное вычисление, и cooperative исполнение с `yieldControl`/`isCancelled`. Выдача управления происходит внутри одного ROI при обходе маски, очереди граничного заполнения и PatchMatch; отмена возвращает исходный immutable source, а не частичный результат.
- Регрессии отдельно фиксируют побайтовую parity Uint16 RGB и отмену Float32 CMYKA **после** pre-ROI checkpoint на 256×256. При отсутствии выделения / на маленьких ROI поведение и число внешних boundary yields должны остаться прежними.
- **Gate завершён:** [PR #174](https://github.com/zeter1/ZeTer-Photo-Editor/pull/174) слит, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38120564410) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38120614660) прошли успешно. **Ещё открыто:** синхронные `readRegion`, `writeRegion` и `serialize`, ограничения oversized connected ROI, RGBA8 preview cancellation, лицензированный независимый Photoshop high-depth corpus и браузерный RAM/latency benchmark. Задача 003 остаётся открытой.


## Stage 003 P1 — прерываемый fallback при недоступном Worker (2026-10-10)

- Реализован единый валидатор frozen selected-index snapshot для синхронного Worker API и асинхронного UI fallback. Ответ `{ unavailable:true }` теперь ведёт в cooperative путь вместо синхронного `inpaintTiledPixelBufferSourceFromIndices`.
- Fallback отдаёт управление **до первого ROI** и между приватными ROI, проверяет отмену и не пересчитывает selection predicate. Отменённая операция не публикует изменённые tiles; Worker compute/protocol errors по-прежнему fail-closed.
- Добавлены регрессии Float32 CMYKA single-ROI cancellation до декодировки, Uint16 RGB disconnected ROI parity/отмена между ROI, duplicate index rejection, неизменность source.
- **Остаётся:** прерывание внутри одного kernel ROI, очень длинный connected ROI без inflated bounding box, full RGBA8 preview cancellation, реальные независимо Photoshop-authored PSD16/PSB32 и browser `file://` end-to-end memory/Undo. Задачи 002 и 003 не закрывать до независимой проверки.
- **Подэтап закрыт:** [PR #173](https://github.com/zeter1/ZeTer-Photo-Editor/pull/173) слит (squash `f88f9c4291753c35d3e4489e57f94b8e476b92d9`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38075041890) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38075098799) завершены со статусом **success**. Задачи 002 и 003 остаются открытыми.

## Stage 003 P1 — cooperative ROI cancellation (2026-10-10)

- Сделано: main-thread Content-Aware fallback yield после обработки каждого disjoint ROI и перед сериализацией single ROI. Отмена отбрасывает приватные tiles, не публикует неполный результат. Sync API и detached Worker используют те же ROI-шаги без asynchronous yield.
- **Подэтап закрыт:** Uint16 exact parity, одна выборка selection, отмена после первого ROI / перед сериализацией одиночного, immutable source. [PR #172](https://github.com/zeter1/ZeTer-Photo-Editor/pull/172) merged (squash `10e5723cad556ab47a27b6d17adf3ec35d4b66a0`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38072670560) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38072737008) — **success**. Вся задача 003 остаётся открытой.
- **Следующее:** полноценная отмена ВНУТРИ одного большого ROI, wide connected ROI без inflated bounding boxes, реальные независимо созданные Photoshop PSD16/PSB32 с лицензией, hashes, browser file:// Worker/preview/Undo и memory snapshots. Задачи 002 и 003 **открыты**.


## Проходка — exact selection halo для соседних tiled cells (2026-10-10)

- Проблема: старый oversized ROI planner сливал соседние занятые **полные** tiles, даже если фактические выбранные пиксели и их donor halo не пересекались; это давало ложный RangeError из-за inflated рабочей площади.
- Исправление: сохранять по каждой занятой tile-cell только min/max фактически выделенных pixels; intersect test и transitive merges работают по ним. Группы с пересекающимися padded footprints по-прежнему нельзя делить: исходные выбранные pixels не должны стать донорами в соседней группе.
- Регрессии: 16-bit RGB через два соседних tiles с непересекающимися halo, точная синхронная/Worker-index parity, immutable original, сумма ROI budget и пересечение halo fail-closed. Version patch 1.45.2.
- **Подэтап закрыт:** [PR #167](https://github.com/zeter1/ZeTer-Photo-Editor/pull/167) merged, squash `94825723a2593d479ca8296f2a2ad8448054a420`; [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38069654597) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38069712550) — **success**.
- **Не решено (задача 003 открыта):** очень длинные связанные ROI, независимый внешне созданный high-depth corpus, Chromium browser memory и прерываемый main-thread fallback/preview.

## P0 external high-depth corpus prerequisite (2026-10-10)

- Новый `tools/audit-external-high-depth-corpus.mjs` и Node-тесты обеспечивают независимый header/SHA-256/provenance *preflight* для внешних 16-bit PSD и 32-bit PSB; детали схемы в [002](002-psd-compatibility-corpus.md).
- Это **не** поставка реальных образцов, не браузерный benchmark и не доказательство Photoshop compatibility. После получения файлов: manifest validation → decode → tiles → настоящий file:// Worker → preview/Undo/Redo + memory. Wide connected ROI и interruptible fallback всё ещё P1. Вся Stage 003 **открыта**.

## Проходка 2026-10-10 — high-depth PSD/PSB binary → native tiled Worker (регрессия)

- Добавлена интеграционная Node-регрессия `tests/tiled-inpaint-high-depth-psd-psb-worker.test.mjs`: writer создаёт native layered **RGB16 PSD** и **Float32 HDR PSB**, реальные binary bytes декодируются с проверкой всех исходных samples, после чего работа идёт через `serializeTiledPixelBufferSource` и настоящий `worker_threads`-Worker.
- Контракты: one-shot selection scan, сверка с синхронным frozen-index oracle, сохранение precision, immutable source и неизменённых donor tile payloads, только один modified tile у seam-adjacent дефекта, завершение Worker.
- **Честная граница:** это собственные синтетические PSD/PSB writer fixtures и Node Worker, не независимые Photoshop-authored files и не browser `file://`/UI RAM benchmark. Реальный 16/32-bit внешний corpus, wide connected ROI и interruptible fallback/preview **остаются открытыми**.
- Gate: проверить `npm run check`, `npm run test:browser` и exact `main` CI после слияния. Не закрывать весь Stage 003 по одному тесту.

## Проходка 2026-10-10 — external PSD/PSB → native tiles → настоящий Node Worker (merged, main CI green)

- **Контракт:** к двум pinned независимым 8-bit fixtures (CMYK PSD и grouped RGB PSB) добавлена регрессия, которая декодирует подлинные bytes, подготавливает tiled source, однократно фиксирует selection, выполняет реальный `worker_threads` compute через production protocol и сравнивает полный результат с synchronous frozen-index oracle.
- **Доказательства:** проверяются по одной Worker-инстанции на fixture, отсутствие повторной выборки геометрии, очищенное Worker lifecycle, `filled=1`, точное совпадение result и байтовая неизменность исходных tiles. Тест: `tests/tiled-inpaint-external-psd-psb.test.mjs`.
- **Граница:** это **Node**, не browser `file://` UI/preview/Undo и не Photoshop-authored 16/32-bit real-world corpus. Нет измерения RAM/latency тяжёлых PSD/PSB, wide connected ROI и прерываемого synchronous fallback. Подэтап **закрыт**: [PR #164](https://github.com/zeter1/ZeTer-Photo-Editor/pull/164) merged (squash `f6a19f040079aef786559281f4be19fb6b23785b`), [PR CI #38067582057](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38067582057) и [точный main push CI #38067644445](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38067644445) завершились **success**. Вся 003 остаётся открытой.

## Проходка 2026-10-10 — немедленная отмена ожидания supplier при запуске Worker

- **Проблема:** до создания Worker вызов `run()` ожидал общий `loadSource()` до `onload/onerror` или 5-секундного timeout; `cancel()` / новый `run()` меняли generation, но устаревшее обещание UI продолжало висеть до завершения загрузчика.
- **Изменение:** у каждого ожидающего запуска теперь собственный прерываемый promise; `cancel()` и superseding `run()` немедленно возвращают устаревшему вызову `{ cancelled:true }`, при этом общий single-flight supplier остаётся загружаться и повторно используется новым запросом. Запущенный Worker по-прежнему отменяется через штатный client, а compute/protocol failures не переходят в fallback.
- **Регрессии:** `tests/tiled-inpaint-browser-worker.test.mjs` проверяет завершение до события `onload` **и до supplier timeout**, отсутствие Worker для отменённой операции, один script tag и возобновление нового запроса после успешной общей загрузки. Нет искусственного таймингового CI threshold.
- **Граница:** уже начатый синхронный fallback / UI preview этим изменением не прерывается. Browser Worker profile реальных независимых Photoshop-authored 16/32-bit PSD/PSB, широкий connected ROI и полноценно interruptible fallback остаются открыты. Подэтап закрыт: [PR #163](https://github.com/zeter1/ZeTer-Photo-Editor/pull/163) слит (squash `ef2b820d940dc32bd6e0a325d96f0bc9ed60644b`), [PR CI #38066925074](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38066925074) и [точный `main` push CI #38066973642](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38066973642) завершились **success**.



## Проходка 2026-10-10 — детерминированный порядок CDP memory snapshots

- **Суть:** periodical `snapshot('sample')` и явные stage markers/финальный `stop()` раньше могли одновременно вызвать `Performance.getMetrics` и `SystemInfo.getProcessInfo`, заполняя `samples` в порядке завершения, а не обращения. Последняя контрольная точка могла оказаться не последним измерением.
- **Изменение:** маленькая очередь promise-снимков в `tools/browser-renderer-heap-sampler.mjs`. Ошибка отклоняет *свой* promise; следующий снимок продолжает работать. Timer cleanup и fail-open для неподдерживаемого process counter сохраняются.
- **Тесты:** `tests/browser-renderer-heap-sampler.test.mjs` — перекрытие poll / двух маркеров / stop с управляемыми CDP-ответами и recovered sampling после rejected marker. Нет жёстких порогов времени/RAM, влияющих на CI.
- **Non-scope:** runtime, версия приложения, generated bundle, real external 16/32-bit PSD/PSB browser-memory corpus и широкий ROI. **Подэтап закрыт:** [PR #162](https://github.com/zeter1/ZeTer-Photo-Editor/pull/162) слит squash `7fce7decd0b2133aa3bf990abcd2ee5ce7677d25`; [PR CI #38065721850](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065721850) и [точный main push CI #38065777660](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065777660) — **success**. Общая Stage 003 остаётся **открытой**.


## Проходка 2026-10-10 — sampled Chromium process private memory (merged + green main CI)

- **Цель:** измерять не только renderer `JSHeapUsedSize`, но и предоставляемый браузерным CDP полный список `SystemInfo.getProcessInfo` с `privateMemory` в отдельном браузерном соединении.
- **Scope:** `tools/browser-renderer-heap-sampler.mjs`, `tools/browser-smoke.mjs`, `tests/browser-renderer-heap-sampler.test.mjs`; production runtime, generated bundle и версия приложения не меняются.
- **Корректность:** в сумме учитываются **только полные** валидные списки процессов; отсутствующие/неподдерживаемые значения не превращаются в нули или правдоподобные RAM-числа. Отдельная `chromiumProcesses` секция в информационном JSON сохраняет baseline, sampled max, конец, число процессов и причину отказа при отсутствии поля.
- **Ограничения:** `privateMemory` — CDP aggregate по всем отражённым процессам, **не** изолированный Worker, RSS/HWM, истинный peak или разбивка GPU/native buffers. CI не устанавливает жёсткий лимит RAM/времени; наличие process metric зависит от версии Chromium.
- **Следующее:** проверить реальный Photoshop-authored 16/32-bit PSD/PSB с pinned source hashes через decode → tiles → UI Worker → preview и с process/Worker resource baselines, затем большой связный ROI и interruptible fallback/preview. **Подэтап закрыт:** [PR #161](https://github.com/zeter1/ZeTer-Photo-Editor/pull/161) слит squash `59a17783417c9ed9ec7e914c617b0f0d9d7fa038`; [PR CI #38065177692](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065177692) и [exact main push CI #38065240683](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38065240683) — **success**. Вся Stage 003 и задача 002 остаются открытыми.


## Проходка 2026-10-10 — браузерные JS heap samples для реальной 16-bit UI-команды

- **Тестовый подэтап:** `tools/browser-renderer-heap-sampler.mjs` читает CDP `Performance.getMetrics` в реальном Chromium, периодически фиксирует `JSHeapUsedSize`, baseline, sampled maximum и stage markers. `tools/browser-smoke.mjs` выводит JSON для уже существующего полного пути native .zpe RGB16: импорт → видимый preview → marquee → Worker Content-Aware Fill → preview → Undo/Redo.
- **Контроль:** `tests/browser-renderer-heap-sampler.test.mjs` использует fake CDP, проверяет baseline/peak, отсутствие фиктивных значений и cleanup таймера при ошибке. Нет временных или RAM-порогов, влияющих на CI. Продуктовый runtime/форматы/версия не меняются.
- **Интерпретация:** sampled renderer JS heap **не** является peak RSS, Worker heap или GPU/native memory; fixture синтетический .zpe RGB16 **не** является Photoshop-authored PSD/PSB. Полный browser memory benchmark реальных больших PSD/PSB ещё **не выполнен**.
- **После подэтапа:** добавить 16/32-bit **внешние** Photoshop-authored PSD/PSB с pinned hashes/provenance и этапами decode → tiled Worker → preview; измерить независимо renderer/Worker/process RSS, подтвердить tile immutability и high-depth precision. Далее wide connected ROI и прерываемый synchronous fallback/preview. Вся 003 остаётся **открытой** до фактических проверок и green main CI.

## Проходка 2026-10-10 — stale-owner polling во время Worker compute (merged + green main CI)

- **Observed gap:** `isCurrent` опрашивался только при `ready`/response, а `reset()` отменял Worker при смене документа; изменение lock или `highDepthSource` во время тяжёлого kernel без Worker-событий продолжало грузить CPU до окончания вычисления.
- **Изменение:** optional `pollIntervalMs` в `src/core/tiled-inpaint-worker-client.js`; `src/core/tiled-inpaint-browser-worker.js` включает 50 ms только во время active task. При stale exact-owner guard вызывает `terminate()`; при любом outcome очищаются таймер и обработчики. Worker compute failure остаётся ошибкой, а не поводом для fallback.
- **Тесты:** `tests/tiled-inpaint-worker-client.test.mjs` deterministic injected scheduler: before-ready/after-ready stale, no late reply, manual cancel, errors, new job, reentrant poll setup.
- **Gate пройден:** [PR #158](https://github.com/zeter1/ZeTer-Photo-Editor/pull/158) слит squash `7d782443c36032e558794d58fa4f712196537b62`; [PR CI #38063616039](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38063616039) и [точный `main` push CI #38063682771](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38063682771) — **success** (`npm run check`, bundle parity, Chromium `file://`, два профилировщика, diff hygiene). Подэтап polling закрыт, вся Stage 003 **открыта**.
- **Следующее:** browser RAM/latency real 16/32-bit PSD/PSB + preview, wide connected ROI и отмена синхронного fallback. Вся задача `003` **остаётся открытой**.

## Проходка 2026-10-10 — end-to-end UI Chromium regression (merged + green main CI)

- **Контракт:** использовать настоящие `.zpe`-импорт, 16-bit four-tile RGB source, UI-маркировку выделения, Edit → Content-Aware Fill, production Worker, history + undo/redo. В отличие от PR #155 проверяется цепочка UI и persisted preview, не только автономный адаптер.
- **Scope:** только детерминированная browser smoke regression `tools/browser-smoke.mjs`; не меняются алгоритмы, worker API, версия и generated bundle.
- **Критерии:** в реальном `file://` Chromium видны красные дефектные пиксели до операции, ровно один `Worker.postMessage` с frozen `selectedIndices`, результат исправляет пиксели, history содержит ровно одну новую запись, Undo/Redo восстанавливают оба состояния.
- **Verified gate:** [PR #156](https://github.com/zeter1/ZeTer-Photo-Editor/pull/156) merged (squash `e2e8778a03c532c5aa2e89f71989f2fad31bd5c3`), [PR CI #38062298829](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38062298829) **success**, [exact main push CI #38062372137](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38062372137) **success**. Браузерный результат: 9 исправленных px, 4 native 16-bit tiles, 1 Worker dispatch, единственная History-запись, Undo/Redo; все 1078 Node-тестов пройдены.
- **Следующая независимая проходка:** browser peak RAM/latency на реальных 16/32-bit PSD/PSB (decode + tiled inpaint + preview), с recording baseline/peak на заданных файлах и проверкой неизменённых источников. Затем: большой связный ROI и другие случаи proactive Worker cancellation. **Вся 003 остаётся открытой.**

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

## Проходка 2026-10-10 — проверка production file:// Worker adapter ([PR #155](https://github.com/zeter1/ZeTer-Photo-Editor/pull/155), merged + green main CI)

- **Scope:** браузерная Chromium-регрессия в `tools/browser-smoke.mjs` проверяет не только raw classic Worker protocol, но и реальный `createBrowserTiledInpaintWorkerController`: повторную ленивую загрузку supplier через `file://`, вычисление на tiled RGBA8, immutable source, отмену уже созданного Worker через terminate и успешную работу следующего job. Записывается диагностическое `elapsedMs` (без нестабильных порогов).
- **Non-scope:** это отдельный browser controller integration check, **не** сценарий кликов пользователя, **не** heap-профиль больших PSD/PSB и **не** оптимизация широкого связного ROI. Production bundle/версия не меняются.
- **Gate пройден:** `npm run check`, Chromium `npm run test:browser`, bundle parity, профилировщики, diff hygiene; [PR CI #38061159764](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38061159764) **success**; [exact main push CI #38061213305](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38061213305) **success** (squash SHA `631dcac7a4b2cf60ccd2846bd58349aec7ff867a`). Подэтап browser adapter regression закрыт, **задача 003 остаётся открытой**.
- **Осталось по 003:** end-to-end UI command, 16/32-bit PSD/PSB browser heap/latency, wide connected ROI, cancellation при других live-owner invalidations; запись `reset()` для смены документа/вкладки уже есть в `src/main.js`.

## Проходка 2026-10-10 — runtime UI Worker dispatch ([PR #154](https://github.com/zeter1/ZeTer-Photo-Editor/pull/154), merged, main CI green)

- **Реализовано и слито в main:** `src/painting/tiled-inpaint-dispatch.js` freezes selection once in cooperative scan, sends `Uint32Array` indices and original serialized tiles to browser Worker, reuses frozen indices for bounded synchronous fallback ONLY if bootstrap is `unavailable`; compute/protocol errors propagate. Empty/full selection is a no-op.
- `src/painting/controller.js` retains exact document/layer/source/lock checks before and after Worker and preview; `reset()` requests termination. The result is never published when stale.
- `src/main.js` enables lazy browser controller. Version 1.45.0; canonical bundle/source parity and file:// browser smoke passed. [PR CI #38060575417](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38060575417) and [exact main push CI #38060648765](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38060648765) both **success**, squash SHA `bf76922ff21455a2c16ed6c2872da22deffc28f0`.
- **Осталось:** browser heap/latency real high-depth PSD/PSB, UI end-to-end Worker scenario, proactive termination on document switch (not just result suppression), interrupts during sync kernel/preview, wide connected ROI. Entire 003 remains open.

## Проходка 2026-10-10 — browser Worker loader / fallback ([PR #153](https://github.com/zeter1/ZeTer-Photo-Editor/pull/153), merged + main CI green)

- **Gate пройден:** [PR CI #38059806464](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059806464) — success; [exact main push CI #38059867375](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059867375) — success, merge squash `de10a1dba24ab05017de264a383fa4f674b46e7a`. Подэтап loader завершён, задача 003 **не завершена**.

- **Проблема:** self-contained classic Worker source поставляется отдельным generated скриптом, но нет browser-side production adapter, способного лениво подгрузить его при прямом открытии `file://`.
- **Изменение:** `src/core/tiled-inpaint-browser-worker.js` поверх существующего lifecycle client даёт `run(job, { isCurrent })` / `cancel()`: single-flight supplier загрузка, bounded script timeout, classic Blob Worker, revoke URL, generation guard во время async bootstrap, `{ cancelled:true }` на stale-owner и `{ unavailable:true }` только при bootstrap/CSP/unsupported для контролируемого cooperative fallback.
- **Тесты:** `tests/tiled-inpaint-browser-worker.test.mjs` проверяет `file://` supplier URL, одновременные запросы, отмену до load, onerror/timeout, CSP constructor fail и отсутствие подмены computation errors fallback'ом.
- **Граница:** loader пока **не подключён** к основному `src/main.js` / `persistTiledHighDepthInpaint()`, поэтому user-visible Worker dispatch и worker-owned compute ещё не включены. Это module-only подэтап: без версии/bundle изменения. Для будущего UI wiring нужно повторно использовать тот же frozen index snapshot и сверять exact-owner перед публикацией; не обходить существующий native precision/history path.
- **Next:** freeze indices на главном потоке → single Worker dispatch → cooperative fallback только при `unavailable` → exact-target checks/cancellation → реальный browser memory/latency benchmark. Общая 003 **остаётся открытой** до реального UI Worker dispatch, browser профилей и wide connected ROI.

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


## Проходка 2026-10-10 — fail-closed Worker `messageerror` и invalid factory cleanup ([PR #149](https://github.com/zeter1/ZeTer-Photo-Editor/pull/149), слито, main CI green)

- **Обнаружено:** браузерный Worker при ошибке structured-clone deserialization испускает `messageerror`, а не `error`. Клиент не завершал Promise, не освобождал Worker и блокировал ожидающий job. Node-shaped `messageerror` также не обрабатывался.
- **Исправление:** `src/core/tiled-inpaint-worker-client.js` завершает активный job typed Error, очищает listeners и вызывает `terminate()` как до `ready`, так и после dispatch. Invalid factory return с доступным `terminate` освобождается до reject; асинхронный reject terminate не порождает unhandled rejection.
- **Проверка:** регрессии браузерного/Node-shaped `messageerror`, late reply, восстановления следующего job, утечки обработчиков и defective factory в `tests/tiled-inpaint-worker-client.test.mjs`. [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38056934228) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38057003202) успешно завершили `npm run check`, browser `file://` smoke и другие проверки на squash `964b41aab9633feb4bc1b0bfb4056d6267ac46f4`.
- **Граница:** всё ещё **не** file:// Worker bootstrap, не UI integration, не true mid-kernel cancellation, не широкий связный ROI или heavy real high-depth PSD/PSB UI memory profiling; вся 003 остаётся открытой.

## Проходка 2026-10-10 — экономия памяти Worker selection ([PR #150](https://github.com/zeter1/ZeTer-Photo-Editor/pull/150), merged, main CI green)

- **Область:** только изолированный `src/core/tiled-inpaint-worker-protocol.js`, не подключённый к UI. Заменён `Set` выбранных индексов на битовую карту (1 бит/пиксель, максимум 2 MiB при 48 MiB source cap); проверка диапазона и дубликатов сохранена, неверная/слишком большая геометрия отклоняется до bitmap allocation.
- **Регрессии:** unsorted Array/Uint32Array, индексы через границу байта, cross-tile parity и сохранность источника, неверные/повторные индексы, некорректная геометрия и слишком длинный список.
- **Честная граница:** это memory-reduction, **не устранение полного пиксельного scan** в существующем `inpaintTiledPixelBufferSource`. Численные perf/heap deltas ещё не измерены. Browser `file://` bootstrap + fallback, exact-owner UI integration, mid-kernel cancellation, wide connected ROI и heavy PSD/PSB UI memory profile остаются следующими задачами.
- **Проверенный gate:** [PR CI #38057597657](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38057597657) — success; [exact main push CI #38057640261](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38057640261) — success (`event=push`, `head_branch=main`, squash SHA `04650b6087154aeff7d8a5e4e87e70c2cb35fa43`). Worker bitmap подэтап закрыт. Вся задача 003 остаётся открытой.

## Проходка 2026-10-10 — file:// classic Worker compute bootstrap ([PR #151](https://github.com/zeter1/ZeTer-Photo-Editor/pull/151), merged + main CI green)

- **Что сделано:** добавлен deterministic build self-contained classic Worker-сценария из canonical `io/inpaint/pixel-buffer/worker-protocol` без ES-модулей, `importScripts(file://…)` и fetch. Готовый supplier — `src/core/tiled-inpaint-worker-source.js`, создающий строку для Blob Worker; обычный `npm run build` регенерирует файл.
- **Тесты:** Node проверяет parity supplier с исходными файлами и проверяет CMYKA calculation/invalid-job recovery через Worker-style transport в изолированной VM; Chromium `file://` smoke загружает supplier как отдельный classic script, запускает Blob Worker и выполняет реальную заливку RGBA8 плитки, проверяя `filled=1`, `changedTiles=1` и изменённый tile payload.
- **Вне scope:** supplier загружается только browser-smoke, **не UI**; в `src/main.js` и `src/painting/command-controller.js` пока нет выбора Worker path или fallback. Недоступность Blob Worker, exact-owner generation/lifetime, отмена в ядре, пределы browser RAM, heavy PSD/PSB и широкие связанные ROI ещё предстоит решить.
- **Проверенный gate:** [PR CI #38058334339](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38058334339) — success; [exact main push CI #38058388873](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38058388873) — success (`event=push`, `head_branch=main`, squash SHA `ccf4e4865fb9840fb5b34a0926185dd8316acd2f`). Изолированный file:// bootstrap подэтап завершён, **задача 003 остаётся открытой** до owner-aware runtime wiring/fallback + реального large-workload профиля.

## Проходка 2026-10-10 — frozen-index fastpath для detached Worker ([PR #152](https://github.com/zeter1/ZeTer-Photo-Editor/pull/152), merged + main CI green)

- **Найденное узкое место:** Worker уже принимает `selectedIndices`, но ранее пересканировал весь `width × height` через bitmap-backed `isAllowed`, чтобы заново получить те же индексы; это дублировало основной cooperative scan и замедляло sparse-mask workloads.
- **Исправление:** `inpaintTiledPixelBufferSourceFromIndices()` валидирует geometry, каждый индекс и дубликаты в bounded битовой карте, накапливает ROI и вызывает существующий `inpaintFrozenTiledSelection()` напрямую. Canonical cross-tile donors, halo, budgets, zero/full-selection и immutable source сохраняются. Протокол Worker больше не использует повторный full-document predicate scan.
- **Регрессии:** deterministic direct/Node Worker/file:// parity, неверные индексы, перестановки, отсутствие мутаций caller snapshot, generated source/build hash parity.
- **Честные ограничения:** первый freeze полного выделения на UI main thread по-прежнему нужен; производительность не измерена, UI Worker loader и fallback пока не подключены, hard cancellation возможен лишь `terminate()`, большой реальный PSD/PSB UI/RAM и широкий связный ROI остаются открытыми. **Всю задачу 003 не закрывать.**

- **Verified gate:** [PR CI #38059123293](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059123293) — success; [exact main push CI #38059186053](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38059186053) — success (`event=push`, `head_branch=main`, squash `08933fcf603aa7847d422d7c6138cc1f2f96c02c`). Этот подэтап закрыт; общая 003 остаётся открытой.

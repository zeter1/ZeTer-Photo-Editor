# 003T — operation high-depth memory evidence, provenance and coverage

**Приоритет:** P1. **Статус:** IN PROGRESS (003T/1 — sampling windows; other 003T criteria OPEN). **Этап:** 003 (не закрыт).
**Зависимости:** [003S](003s-cdp-pid-aggregate-integrity.md), [025](025-browser-worker-target-census.md), [024](024-browser-operation-memory.md), [026](026-browser-memory-sample-coverage.md), [037C-3c](037c3c-final-acceptance.md).
**Причина:** sampled CDP `privateMemory` и Linux `VmRSS/VmHWM` — не true operation RAM peak; `Target.getTargets`/ `SystemInfo.getProcessInfo` не доказали target→OS PID.

## Цель

Получить более достоверные **реальные** Chrome `file://` high-depth PSD16/PSB32 memory receipts, не выдавая наблюдаемые samples или process-lifetime HWM за точный operation peak.

## Критерии готовности

- [ ] Выбрать и описать применимый для Chromium CI способ наблюдения памяти
  с точными границами: какой процесс/контейнер, какой момент операции,
  sampling gaps, создание/завершение processes и переиспользование PID.
- [ ] Если возможно доказательно измерить operation peak — привязать замер
  к изолированной операции и проверить метод независимой контрольной нагрузкой.
  Иначе сохранить `unknown`, `sampledMax` и явную причину недоказанности.
- [ ] Любое Worker→PID связывание — **только** документированный проверенный
  join CDP/OS identity (PID + process starttime), без timing-эвристики,
  совпадения количества targets/процессов или URL/title утечек.
- [ ] Настоящие Chromium `file://` PSD16 и PSB32 с memory evidence на
  больших high-depth tiled операциях: UI Fill, cancel/retry, Undo/Redo,
  сохранение native 16/32-bit пикселей, без избыточных full-frame копий.
- [ ] Отрицательные тесты: пропущенные start/finish snapshots, краткоживущие
  processes/targets, частичная /proc доступность, reused PID, невозможность
  доказать true peak. Проверить fail-closed JSON evidence/artifact parser.
- [ ] Пройти `npm run check`, browser smoke, реальный memory/artifact CI
  и после PR merge — exact-main CI; все ссылки/статусы записать в task.

## Ограничения

P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) — BLOCKED без лицензированного Photoshop-authored PSB32 + provenance/reference render.
Проверка memory не подтверждает Adobe-authoring или совместимость с Photoshop.
Не подменять число кратковременных выборок точным RSS peak, sum VmHWM
и не изобретать Worker-specific RSS.

## 2026-10-19 — 003T/1: действительные окна чтения и пропущенные таймеры (IN PROGRESS)

**Scope:** диагностический Node/CDP harness и JSON-verifier, не production runtime.
**Зависимости:** 003S DONE, 024/025/026 memory instrumentation.
**Цель:** не спутать requested 50 ms с доказанной частотой или непрерывным
покрытием процесса/операции. Асинхронный serial read запускает несколько
независимых запросов Chrome; ни один такой read не является атомарной метрикой
по всем процессам.

### Реализовано в ветке

- `tools/browser-sampling-timing.mjs`: строгая сводка observation read windows,
  максимальной длительности запроса, интервалов между запросами, попыток
  interval polling и пропусков при уже выполняющемся poll. Явные
  `trueOperationPeakKnown:false`, `workerPidMapping:'unknown'` — не разрешено
  объявлять эти значения измеренными.
- `tools/browser-renderer-heap-sampler.mjs`: фиксирует monotonic
  `readStartedMs`/`elapsedMs`/`readFinishedMs` и проверяет их порядок;
  считает busy skipped polls, включает `samplingTiming` в report.
- `tools/browser-operation-timeline.mjs`, `tools/browser-operation-artifact.mjs`,
  `tools/browser-real-photo-memory-evidence.mjs`: транзит измерений в
  PSD16/PSB32 evidence; genuine браузерные receipts обязаны содержать
  `samplingTiming`, CI verifier отвергает неверные счётчики, фальшивый
  `trueOperationPeakKnown` и необоснованный Worker→PID.
- `tests/browser-sampling-timing.test.mjs`,
  `tests/browser-operation-artifact.test.mjs`,
  `tests/browser-real-photo-memory-evidence.test.mjs`: сериализация async
  poll / занятые ticks / задержка per-PID RSS / отрицательные forged JSON.
- `task/README.md`, `task/NEXT.md`, `task/003-tiled-content-aware.md`:
  статус и очередь; без потери истории.

**Ограничение метрики:** `maxBetweenReadWindowsMs` показывает максимальную
паузу между завершением одного запроса и стартом следующего, но *не*
максимальную невидимую RAM-дельту: во время read окна CDP + /proc значения
также снимаются последовательно. Значение 0 не подтверждает full coverage.
Отсутствующие краткоживущие процессы и Worker PID остаются `unknown`.
В частности `maxReadDurationMs` — время исполнения harness-запроса, не
длительность операции. Нет раздельного operation peak или PID→Worker доказательства.

**PR:** [#280](https://github.com/zeter1/ZeTer-Photo-Editor/pull/280) — код и проверки на отдельной ветке; final PR CI, merge и exact-main ещё **PENDING**.

**Проверки:** новые тесты подготовлены для `npm run check`, реального
Chromium `file://` и обоих CI artifact validators. Локально полноценный
checkout недоступен (DNS github.com); до результатов CI тесты **не считать
пройденными**. PR CI/merge/exact-main пока **PENDING**.

### Что осталось для полной 003T

1. Получить успешный PR CI на настоящих PSD16/PSB32 browser receipts,
   затем merge и проверить **exact-main** CI; сохранить ссылки на результаты.
2. Установить независимую методику подтверждения именно operation peak
   (если возможно в этом Chromium/CI), проверить контрольной нагрузкой,
   а при отсутствии доказательства оставить `unknown` и sampled metrics.
3. Проверить Linux PID reuse / short-lived target/proc failure в real browser,
   не связывать Worker→PID по времени или совпадению количества.
4. Отдельный P0 002B/2c всё ещё **BLOCKED** на licensed Photoshop PSB32.

**Следующая проходка:** 003T/2 — real high-depth browser evidence с
измеренными интервалами, контролем overhead/short-lived processes и
честной границей operation peak; 003T и Stage 003 не закрывать ранее CI
и реального подтверждения.


## 2026-10-19 — 003T/2a: explicit milestone cannot hide a missed timed poll (IN PROGRESS)

**Приоритет:** P1; зависит от 003T/1 (PR #280 merged into main 1140b886).
**Scope:** diagnostic Chromium CDP harness; без изменения production code или версии.

### Обнаруженная причина

В старом `browser-renderer-heap-sampler.mjs` timer poll пропускался,
только когда уже имелась переменная `pending` от предыдущего таймерного poll.
Асинхронный обязательный `snapshot('during-fill')` или
`snapshot('after-fill')` занимал ту же serial queue, но не блокировал
постановку в неё новых timer samples. В результате задержанный periodic read
выдавался за допущенный timely poll, хотя был поставлен в очередь на
занятом milestone. Это ограничивало интерпретацию `pollsSkippedBusy`.

### Реализация

- `tools/browser-renderer-heap-sampler.mjs`: считаем queuedSnapshots
  при принятии каждого explicit или periodic snapshot, уменьшаем счётчик
  после success **или** reject. Timer poll, увидев pending или queued
  snapshot, увеличивает `pollsSkippedBusy` вместо постановки в очередь.
  Нет unhandled rejection от cleanup и сохраняется serialized read ordering.
- `tests/browser-sampling-timing.test.mjs`: два новых Node regression
  сценария: активный и ожидающий milestone с тремя пропущенными ticks,
  затем неудачный milestone освобождает busy guard и следующий timer poll
  действительно выполняется.
- `task/NEXT.md`, `task/README.md`, `task/003-tiled-content-aware.md`:
  текущая очередь и зависимости обновлены.

### Проверки и ограничения

- Код и тесты в ветке
  [fix/003t2-milestone-poll-busy-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/fix/003t2-milestone-poll-busy-20261019).
- PR #280 (003T/1): [core CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39248237317),
  [real-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39248237320),
  [merged main commit 1140b886](https://github.com/zeter1/ZeTer-Photo-Editor/commit/1140b886e598210a3b34ab946c03ce998db606b2).
- Новый PR CI, merge и exact-main **не считать пройденными до readback**.
- Зафиксированные read windows все ещё не являются атомарными замерами
  всех процессов. `trueOperationPeakKnown:false`;
  `workerPidMapping:'unknown'`; PSD/PSB Photoshop authored provenance
  по [002B/2c](002b2c-photoshop-psb32-provenance.md) всё ещё BLOCKED.

**Следующая 003T/2b:** контролируемая independent browser memory workload,
проверка пропущенных short-lived target/PID, reused PID, реальная high-depth
PSD16/PSB32 operation-peak методика или `unknown` с объяснением.
**003T и Stage 003 остаются IN PROGRESS / OPEN.**


## 2026-10-19 — close 003T/1, 003T/2a implementation; next 003T/2b (IN PROGRESS)

**Сводка:** 003T как задача IN PROGRESS; завершены только bounded
instrumentation проходки /1 и /2a. Этап 003 и полный roadmap OPEN.

### Подтверждённые реальные изменения и CI

1. **003T/1**: [PR #280](https://github.com/zeter1/ZeTer-Photo-Editor/pull/280)
   merged into [main 1140b886](https://github.com/zeter1/ZeTer-Photo-Editor/commit/1140b886e598210a3b34ab946c03ce998db606b2).
   [PR core CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39248237317);
   [PR real-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39248237320);
   [exact-main core success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249020260);
   [exact-main real-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249020566).
   Настоящие `file://` sampled CDP and /proc read windows, busy ticks,
   fail-closed PSB32/PSD16 evidence верно различают unsupported peak/PID.
2. **003T/2a**: [PR #281](https://github.com/zeter1/ZeTer-Photo-Editor/pull/281)
   merged into [main a18c828](https://github.com/zeter1/ZeTer-Photo-Editor/commit/a18c828d79cf8e03504fbb614904d5a3bcece6ce).
   [PR core CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249834322).
   First CI [failed](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39249628004):
   1379/1380 tests; legacy serializer regression expected a delayed periodic
   fifth query. Fixed test to assert exactly four serialized marker reads and
   one missed timer poll; both new independent regressions already passed.
   [Exact-main CI success #39250278990](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39250278990), 003T/2a accepted.
3. Нет дополнительных native snapshots или production runtime mutations:
   изменения диагностических инструментов и test harness. Browser operation
   `sampledMax` и `VmHWM` не являются доказательством true operation peak;
   `workerPidMapping:'unknown'` сохраняется.

### Следующая P1: 003T/2b

**Критерии приёмки:** независимая real Chromium control нагрузка,
подтверждённые временные границы наблюдения операции,
fail-closed short-lived process/PID reuse and /proc access-gaps,
основанная на документации CDP/OS Worker→PID привязка
**или честный `unknown`**, реальные PSD16/PSB32 Fill/cancel/retry
`file://` receipts, пройденные PR CI и exact-main CI.
Не заявлять global operation peak из sampledMax или VmHWM.

**P0 [002B/2c](002b2c-photoshop-psb32-provenance.md)** — BLOCKED
без независимо лицензированного Adobe-authored PSB32/reference render.

## 2026-10-19 — 003T/2b-1: fail-closed /proc identity membership + independent Linux control (IN PROGRESS)

**Priority P1; dependencies:** 003T/1, /2a, 003S. Scope is diagnostic tools/tests only, not production app.
**Goal/acceptance for this substep:** A per-PID /proc RSS sample may be published only if it contains each valid CDP PID exactly once and its aggregate VmRSS and largest VmHWM equal the verified per-PID values; one-sided process loss, changed PID/starttime, duplicate and missing records cannot become a reliable RSS measurement.

**Implementation on branch `fix/003t2b-rss-identity-membership-20261019`:**
- `tools/browser-rss-sample-identity.mjs` independently verifies PID membership, canonical positive Linux starttime, safe RSS/HWM integers, aggregate sum and max HWM. The check does **not** associate an opaque CDP Worker target with any OS process.
- `tools/browser-renderer-heap-sampler.mjs` applies the guard before publishing RSS. Invalid real-shaped observations become `linuxProcessRss.availability: 'unavailable'` with no invented baseline/max/end; independent renderer heap, process privateMemory and PID census continue. Legacy injected test samplers without per-PID rows retain only informational RSS; Linux incarnation attribution stays unavailable.
- `tests/browser-rss-sample-identity.test.mjs` covers incomplete, duplicate, wrong-PID, invalid starttime, inconsistent aggregate/HWM, and sampler fail-closed diagnostics; an **independent real Linux Node child process** is sampled via `/proc` while alive, then terminated and verified unreadable. This is an OS control, **not** a Chromium Worker→PID mapping or real browser operation peak.
- Existing real Chromium `file://` browser CI exercises default `sampleLinuxChromiumRss` through actual PSD16/PSB32 operation snapshots; browser CI and real-photo artifact status must be read back before acceptance.

**Verification:** Full local checkout unavailable (container DNS `github.com` unresolved); `npm run check`, real Chromium and PR CI are **PENDING**, not asserted green. PR/link and exact-main evidence to be appended after verification. Tests are proposed, not marked passed until CI readback.
**Known limits/bugs still open:** The CDP PID census is not atomic with sequential `/proc` reads. PID membership in one sample is not Worker identity, short-lived Chrome targets can exist between polls, a process lifetime `VmHWM` is not operation RSS peak, no independent real **Chromium** control workload yet. `trueOperationPeakKnown:false`, `workerPidMapping:'unknown'` and sampled maxima remain the only supported claims.
**Next:** **003T/2b-2 IN PROGRESS** — use an independently controlled temporary Chromium Worker/target and short-lived process in real `file://` operation, capture before/during/after target and PID/starttime coverage without timing joins, negative fail-closed receipts, CI verification; no peak unless a separately validated operation-isolated measurement method is found.
**Stage 003:** OPEN. **P0 002B/2c:** BLOCKED without provenance-verified, licensed Adobe Photoshop-authored PSB32.

## 2026-10-19 — 003T/2b-1 DONE, independent Chrome control still OPEN

- **Code PR:** [#283](https://github.com/zeter1/ZeTer-Photo-Editor/pull/283).
- **Merged in `main`:** [73839c6](https://github.com/zeter1/ZeTer-Photo-Editor/commit/73839c6b76db181af523a7eb03216a4007ed55bf).
- **PR CI success:** [39252673346](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39252673346), including `npm run check`, real `file://` Chromium UI smoke, Adobe-published PSD fixture browser native-layer checks, external PSB fixture checks, operation artifact verifier and informational profiles.
- **Exact merged `main` CI:** [39253156164](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39253156164) **SUCCESS** (verified completed; exact SHA 73839c6). 003T/2b-1 accepted; 003T whole task still IN PROGRESS.
- **Files:** `tools/browser-rss-sample-identity.mjs`, `tools/browser-renderer-heap-sampler.mjs`, `tests/browser-rss-sample-identity.test.mjs`, `task/003t-operation-memory-evidence.md`, `task/NEXT.md`, `task/README.md`, `task/003-tiled-content-aware.md`.
- **Defects/limits remaining:** sampled PID census and sequential `/proc` remain non-atomic, process lifetime HWM is not per-operation peak, OS control is not Chrome control, Worker→PID undocumented, P0 external Photoshop PSB32 corpus blocked.
- **NEXT 003T/2b-2 P1 IN PROGRESS:** inject independent real ephemeral Chrome Worker control in `file://` high-depth test, record target census and Linux PID incarnations across before/during/after with missing snapshots; prove detected-versus-missed observations, fail-closed artifact/CI, preserve `trueOperationPeakKnown:false` unless independent calibrated operation-isolated method is established.


## 2026-10-19 — 003T/2b-2: independent real Chromium file:// Worker visibility control (IN PROGRESS)

**Priority/dependencies:** P1, depends on 003T/2b-1 DONE and existing 024/025/026
sampler + Target/PID/proc identity diagnostics. **Scope:** test-only tooling/CI.
**Goal:** Show under real Chromium that an acknowledged short-lived Worker can
execute entirely between explicit target observations, while a held Worker
produces separately observed target arrivals/disappearance. Missing CDP read
must forbid inferred target churn or Worker-to-PID attribution.

**Acceptance for this substep:** real file:// Chromium executes an acknowledged
short-lived Blob Worker between sampled snapshots; a held acknowledged Worker
is visible in a successful Target.getTargets observation, then absent in a
later successful observation; an intentionally skipped target read yields
unknown transitions; Linux/CDP process observations (where available) do not
claim Worker PID/operation peak; artifact verifier rejects forged success,
missing data or unsupported claims; unit+browser CI green, merged PR and
exact-main CI green.

**Implementation in work branch**
[test/003t2b2-real-chromium-worker-control-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2b2-real-chromium-worker-control-20261019):
- Added \`tools/browser-worker-control-smoke.mjs\`. Launches a separate real
  headless Chromium with clean temporary profile and **real file:// page**.
  Short-lived Worker posts completion before termination; explicit sampled
  target observations before/after cannot infer how many Workers lived in
  between. A held Worker allocates/touches 8 MiB of process-managed payload,
  announces readiness, is observed alive via real Target.getTargets, then
  terminated and observed absent. Uses real
  \`createBrowserRendererHeapSampler\` including CDP process membership and
  verified /proc RSS/incarnation when available. Scheduled polling is
  intentionally disabled for deterministic explicit-only windows, and
  \`samplingTiming\` records this as zero periodic samples.
- Same script exports fail-closed \`validateIndependentWorkerControlEvidence\`
  and CLI \`--verify\`: validates five real milestone reads and one **injected**
  missing Target read from the existing independent target tracker. The
  induced read gap is NOT misrepresented as an actual CDP network failure.
  Neither target identity nor process type is a documented Worker→PID join.
  URLs/titles are not recorded; no claimed true operation peak or exit.
- Added \`tests/browser-worker-control-evidence.test.mjs\` for positive
  semantics, falsified peak/PID/target/coverage, accidental private path
  leak and gap-transition regressions.
- \`.github/workflows/ci.yml\` runs real Chromium control and offline
  independent JSON readback, uploads receipt as
  \`zpe-chromium-worker-control-003t2b2\`. The existing
  \`npm run check\` + genuine browser PSD16/PSB32 operations stay enabled.
- Updated \`task/NEXT.md\`, \`task/README.md\` and
  \`task/003-tiled-content-aware.md\` with status and queue.

**Evidence status:** unit tests, real browser control, PR CI, merge and
exact-main CI **PENDING** until GitHub Actions results are checked. Local
checkout unavailable because \`github.com\` DNS is inaccessible from the
execution container; no local test pass is asserted. Any failure must be
fixed in this PR before marking the substep DONE.

**Limits:** 8 MiB payload does not calibrate operation RAM peak;
\`VmHWM\` is lifetime HWM; even real acknowledged Worker activity between
snapshots does not imply PID identity. This substep complements but does NOT
replace real PSD16/PSB32 Fill/cancel/retry acceptance. PID reuse inside a
short-lived Chromium process, true operation peak and a documented
Worker→PID join remain unproven; preserve \`trueOperationPeakKnown:false\`,
\`workerPidMapping:'unknown'\`.

**Next:** finish CI/merge/exact-main for /2b-2; then **003T/2c P1**
controlled real Chromium process-lifetime/PID reuse or /proc-denied gaps
and independently validated operation-isolated RAM peak method if feasible.
P0 **002B/2c BLOCKED** on independently licensed Photoshop-authored PSB32
with proven provenance/reference rendering; whole Stage 003 OPEN.

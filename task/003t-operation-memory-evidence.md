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


## 2026-10-19 — 003T/2b-2 accepted (DONE); NEXT 003T/2c (TODO)

**Verified code change:** [PR #285](https://github.com/zeter1/ZeTer-Photo-Editor/pull/285),
merged into [main 36953580](https://github.com/zeter1/ZeTer-Photo-Editor/commit/36953580a15622e39e8fcfc2ded5da4fd4bc2424).

**Real checks:**
- First PR run [#39256131166](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39256131166)
  **FAILED**: isolated clean Chromium still reported pre-existing Worker targets.
  Root cause: invalid assumption that the baseline target list is empty.
  Fixed by comparing exact target IDs to a sampled baseline; no Worker→PID
  attribution or URL/title matching was added.
- Final code [PR CI #39256653417](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39256653417)
  **SUCCESS**: \`npm run check\` (including new negative Node tests),
  complete \`file://\` editor smoke, independent file Worker lifecycle control,
  offline \`--verify\` JSON readback and uploaded worker control artifact,
  external PSD/PSB checks, profiles and diff hygiene.
- After squash merge, [exact merged-main SHA CI #39257181413](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39257181413)
  **SUCCESS** (head SHA \`36953580a15622e39e8fcfc2ded5da4fd4bc2424\`).
- **No separate independent local checkout test run**: local \`github.com\`
  DNS unresolved; CI is real GitHub Ubuntu Chromium rather than a local mock.

**Scope proven:** isolated real Chromium Blob Worker message acknowledged;
separately sampled CDP target visibility while held and later target absence;
a real acknowledged ephemeral Worker can be missed by explicit observation
boundaries. A deliberately injected skipped target read results in unknown
transitions rather than forged arrivals. Sampler and report retain distinct
CDP PID, Linux /proc starttime and memory availability, with no Worker→PID
join. No assertion of completed native process exit or true operation RSS
peak is supported. The existing PSD16/PSB32 editor browser workflow remained
green in this CI; the 8 MiB control by itself is not an operation peak oracle.

**Files:** \`tools/browser-worker-control-smoke.mjs\`,
\`tests/browser-worker-control-evidence.test.mjs\`, \`.github/workflows/ci.yml\`,
\`task/NEXT.md\`, \`task/README.md\`,
\`task/003-tiled-content-aware.md\`, this card.

**Acceptance:** **003T/2b-2 DONE**; **003T whole IN PROGRESS**;
**Stage 003 OPEN**. P0 **002B/2c BLOCKED** on verified licensed
Photoshop-authored PSB32 and independent reference render.

### NEXT — 003T/2c P1 (TODO)

**Dependencies:** 003T/2b-2 accepted; 003S, 024, 025, 026.
**Goal:** exercise controlled *actual Chromium OS process* lifetime and
transient /proc access gaps (including PID reuse ambiguity) while an operation
runs; do not use Worker-target/OS-process coincidence as a join. Independently
calibrate an isolated operation memory measurement only if it can withstand
a separate known-load control. Otherwise document absent proof and preserve
\`trueOperationPeakKnown:false\`, \`workerPidMapping:'unknown'\`.

**Acceptance criteria:**
1. Real Linux Chromium run with before/during/after PID+starttime samples;
   deliberately missed process during poll, partial /proc and exit/read gaps
   flagged without presenting missing data as zero memory or proven exit.
2. Negative unit+artifact regressions for PID reuse/starttime mismatch and
   invalid/missing start/finish observations.
3. Reuse real PSD16/PSB32 Fill, cancel/retry, native 16/32-bit integrity and
   browser artifact CI, without weakening prior validation.
4. PR CI success, merge and exact-main CI success, linked here and in NEXT;
   or explicit BLOCKED reasons if reproducible real Chrome limitations.


## 2026-10-19 — 003T/2c: controlled real Chromium Linux launcher process lifecycle (IN PROGRESS)

**ID / priority / dependencies:** 003T/2c, P1; follows 003T/2b-2 DONE, RSS identity 003T/2b-1, stage 024/025/026. This is diagnostic/CI infrastructure and does **not** modify the editor runtime.

**Goal:** independently demonstrate observed OS lifecycle of a spawned real Chromium `file://` Linux launcher PID, distinguishing complete /proc reads, deliberately skipped reads, injected read denial and the process's actual termination. Never infer short-lived Chrome descendants or Worker PID from a single known launcher PID.

**Code and tests in branch:** [test/003t2c-chromium-os-pid-lifetime-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2c-chromium-os-pid-lifetime-20261019).

- `tools/browser-chromium-pid-lifetime-control.mjs`: launches independent real headless Chromium on temporary `file://` page, verifies live page through DevTools, captures /proc PID+starttime and validated VmRSS/VmHWM **before/after** deliberate missing snapshot, tests an explicitly **injected EACCES** failure path without counting it as real denial, observes actual child `close` after SIGTERM, then verifies original PID missing or a different incarnation. Rejects unreadable post-close data; stores only PID/starttime/RSS and sanitized, bounded evidence.
- `tools/browser-worker-control-smoke.mjs`: exports preexisting Chrome discovery and DevTools-stderr readiness helpers for reuse; prior Worker control remains independent.
- `tests/browser-chromium-pid-lifetime-control.test.mjs`: pure negative verification of forged peak/Worker PID/exit, PID reuse, corrupt /proc identity, hidden sampled gap, EACCES vs ENOENT and inconsistent membership.
- `.github/workflows/ci.yml`: real Chrome Linux OS PID control + `--verify`, retained downloadable JSON artifact.
- `task/README.md`, `task/NEXT.md`, `task/003-tiled-content-aware.md`, this card: queue + restrictions.

**CI/acceptance status:** code committed in branch; `npm run check`, real Chromium control receipt, PR CI, merge and exact-main **PENDING until readback**. No local full checkout (environment has no github.com DNS); do not assert green prior to actual CI.

**Evidence limits:** launcher PID verified by spawned child process, **not** a CDP Worker→OS PID join. Linux VmHWM is a lifetime watermark, not operation-isolated peak; a deliberate missed read is unknowable interval (no inferred process churn). Injected `EACCES` is a *test double*, not a real OS permission outage. A spawned launcher `close` establishes only that process's exit, not termination of every browser descendant. `trueOperationPeakKnown:false`, `workerPidMapping:'unknown'` remain mandatory.

**Remaining / next:** get passing real CI artifact, review and merge, verify exact-main SHA CI; then **003T/2d P1** investigate operation-isolated calibrated RSS peak measurement against independent real Chrome reference workload if feasible, otherwise keep explicit unknown and coverage gaps. P0 002B/2c still BLOCKED on independently licensed Photoshop-authored PSB32. Whole 003T IN PROGRESS, Stage 003 OPEN.


## 2026-10-19 — 003T/2c PR CI verified, exact-main pending

- **PR:** [#287](https://github.com/zeter1/ZeTer-Photo-Editor/pull/287); test-code SHA `d16ef293e84bcc382ec8b924f7db7398e5f9ce72`.
- **First PR run #39261014708 FAILED:** real Chromium exits normally on requested SIGTERM in this runner, whereas initial validator mistakenly required a signal-only exit. Actual observed `close` alone was not accepted. Fixed validator to accept either `SIGTERM/null` or the normal `null/0` pair, always with observed child `close`, added negative/positive test, and cleared the wait timeout on success/failure.
- **Successful PR CI:** [#39261662672](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39261662672) **SUCCESS** for `npm run check` (including negative tests), generated browser parity, real Chromium `file://` smoke, preexisting Worker target control, **new real Chromium launcher Linux PID lifetime control**, strict JSON `--verify`, artifact upload `zpe-chromium-pid-lifetime-003t2c`, diff hygiene.
- **Status:** PR tested; docs are being synchronized to that evidence. Merge and **exact-main CI remain PENDING**; do not count /2c DONE until both are confirmed. Production editor code remains unchanged.
- **NEXT P1 003T/2d:** operation-isolated RSS peak/control: document instrumentation boundary (cgroup/container/process tree), launch and end snapshots, cross-process/read gaps, independent calibrated known memory control if possible, otherwise `unknown` with explicit limitations. Still not Worker→PID, high-depth operation-wide peak, or Stage 003 completion. P0 002B/2c BLOCKED.


## 2026-10-19 — 003T/2c DONE (bounded real Linux Chromium PID lifecycle only)

**Accepted evidence:**
- [PR #287](https://github.com/zeter1/ZeTer-Photo-Editor/pull/287), [merged main commit `68fe52e6bccfb1930ff2d007e8b411cd6422a9a1`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/68fe52e6bccfb1930ff2d007e8b411cd6422a9a1).
- [Final PR CI #39262435414 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39262435414) (head SHA `05fed985c8a46f1f58bc068f6c78ffdcae73552a`); `npm run check`, Chromium `file://` browser smoke, previous Worker target visibility control, actual Linux spawned Chromium PID lifecycle, strict receipt verifier, JSON artifact upload and diff hygiene.
- [Exact merged-main CI #39263051566 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39263051566), exact SHA `68fe52e6bccfb1930ff2d007e8b411cd6422a9a1`.
- **Status 003T/2c: DONE** against its *bounded* criteria: an OS launcher PID with stable /proc starttime was sampled before/after deliberate gap; an injected EACCES is distinguished from true missing /proc; a real spawned-child close with documented signal/normal-exit semantics and post-close missing/reused incarnation were checked. Unit negatives and real CI artifact verifier pass.
- **Bug recorded:** First [CI #39261014708 FAILED](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39261014708) due to rejecting normal Chromium exit (code 0) following SIGTERM; fixed with exclusive allowed `SIGTERM/null` and `null/0` close-event outcomes and a dedicated positive test.
- **Unresolved:** no Chrome descendant census guarantee, no Worker→PID mapping, no operation-isolated peak, and an injected permission-denial fixture is not a real OS access outage. Thus **whole 003T remains IN PROGRESS**, Stage 003 OPEN.

**NEXT P1 003T/2d TODO:** evaluate independent and preferably operation-isolated process/cgroup/container high-depth RAM observation: isolate operation (start/finish) from launcher lifetime, choose documented OS telemetry, test with controlled known memory pulse versus sampled max, track child process churn and /proc/CDP blind windows, fail closed when true peak cannot be established. Preserve `trueOperationPeakKnown:false` / `workerPidMapping:'unknown'` unless strictly proven. P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED on provenance-verified licensed Photoshop-authored PSB32.\n

## 2026-10-19 — 003T/2d-1: independent Linux memory workload calibration (IN PROGRESS)

**Scope:** separate test-only Linux Node process, not the editor runtime or Chromium.
The control child acknowledges a **16 MiB page-touched pre-operation hold**,
then releases it; a **64 MiB page-touched operation hold** is sampled independently
by the parent via the existing Linux `/proc` RSS + exact PID/starttime gate.
Five named snapshots (before control, held control, before operation, held
operation, after operation) demonstrate what sampled VmRSS and process-lifetime
VmHWM actually observe. Real resident growth is required, rather than assuming
allocated bytes equal RSS growth; PID incarnation consistency and maxima of *observed* VmHWM must hold. Linux\nVmHWM readings may vary across GC/allocator cleanup (the first real CI run\nshowed a later HWM below an earlier sampled value); do not require\nmonotonicity of independently sampled reports or infer a true peak.
There is intentionally **no continuous sampling between acknowledgements**.

**Code:** `tools/browser-memory-peak-calibration.mjs` with real Linux child +
standalone `--verify` fail-closed JSON readback, negative and real-Linux
regressions in `tests/browser-memory-peak-calibration.test.mjs`,
and GitHub CI verification/artifact `zpe-linux-memory-calibration-003t2d1`.
The test rejects forged operation peaks or Worker PID claims, missing operation
snapshots, nonresident control, same-snapshot HWM below RSS, forged sampled maxima and reused PID. The sampled
values and process lifetime HWM are **not** a mathematical per-operation peak:
the baseline, startup, allocator, GC, /proc blind spans and temporary child
processes cannot be erased by subtracting two RSS snapshots.

**Branch:** [test/003t2d-independent-memory-calibration-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2d-independent-memory-calibration-20261019).
**Acceptance:** PR CI, merge and exact-main **PENDING** until actual GitHub CI readback.
Maintain `trueOperationPeakKnown:false` and `workerPidMapping:'unknown'`;
even a passing child calibration does **not** verify Chromium process-tree/
cgroup isolation, real PSD16/PSB32 operation peak, or full 003T completion.

**NEXT P1 003T/2d-2:** research/test a dedicated Chromium operation
process-tree or cgroup-scoped peak sensor with complete PID incarnation
membership and controlled concurrent allocations; if kernel/CI permissions
cannot prove operation-isolated peak, keep unknown with explicit limitations.
Whole 003T/Stage 003 OPEN. P0 002B/2c BLOCKED on genuinely licensed,
Photoshop-authored PSB32 with reference render and provenance.\n

## 2026-10-19 — 003T/2d-1 DONE; Chromium operation-isolated peak remains OPEN

- [PR #290](https://github.com/zeter1/ZeTer-Photo-Editor/pull/290) merged to [main `3760f97a`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/3760f97a4054c6320cb954782aadb2bd1b3f799c).
- [PR CI #39268139471 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39268139471): `npm run check` including 3 new calibration tests, real browser `file://` smoke, Photoshop PSD and independent PSB candidate checks, previous Chromium Worker and PID controls, real separate Linux child calibration, strict JSON `--verify`, uploaded `zpe-linux-memory-calibration-003t2d1` artifact and diff hygiene.
- [Exact merged-main CI #39268730099 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39268730099) on commit `3760f97a4054c6320cb954782aadb2bd1b3f799c`; full verify job passed, including the same independent real Linux calibration step.
- **Important real bug:** first CI runs [#39267485726](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39267485726), [#39267616497](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39267616497), [#39267858556](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39267858556) failed. First negative test fixture used a different case for mandatory limitations; corrected. Linux CI then proved kernel-reported `VmHWM` could decline between observed samples after GC: 118657024 → 118538240 bytes (drop 118784). Fixed validator and regression to retain `sampledMaxReportedHwmBytes` and `sampledMaxRssBytes`, not require monotonic `VmHWM` across phases; same-snapshot HWM >= RSS and exact PID/starttime remain mandatory. Later interim PR runs were superseded/cancelled by commits, not interpreted as failure of final SHA.

**Bounded acceptance:** 003T/2d-1 DONE for independent controlled *Node child* observational method only. No evidence that all Chromium renderer/Worker subprocesses belong to one isolated operation, no cgroup high-water calibration, and no true PSD/PSB operation peak. Therefore `trueOperationPeakKnown:false` and `workerPidMapping:'unknown'` must remain unchanged; 003T and Stage 003 remain OPEN.

**NEXT P1 003T/2d-2:** investigate whether a dedicated Chromium process-tree/cgroup operation window with frozen baseline and known-load independent control can be established in GitHub Linux CI, explicitly test short-lived descendants and read gaps. If a provable operation-isolated sensor cannot be enabled or calibrated, retain unknown rather than approximate peak with VmHWM. P0 002B/2c still BLOCKED on a verified licensed Photoshop-authored PSB32.

## 2026-10-19 — 003T/2d-2 real Chromium cgroup scope feasibility (IN PROGRESS)

**ID/Priority:** 003T/2d-2 / P1. **Dependencies:** accepted 003T/2d-1
independent Linux memory control, 003T/2c real launcher PID, browser control
003T/2b-2 and existing PSD16/PSB32 operation receipts. **Stage 003 OPEN.**

**Objective:** find whether CI runner permits a kernel cgroup-v2 observation
for a genuine headless Chromium `file://` 64 MiB page-touched *held* Blob
Worker, and whether its cgroup is distinct from the harness. Never confuse
cgroup `memory.current` with per-operation peak, Worker-to-PID mapping,
full descendant census, or exclusively reserved browser memory.

**Implemented on working branch:**
- `tools/browser-chromium-cgroup-control.mjs`: starts actual isolated-profile
  headless Chromium, connects page DevTools and waits for a real 64 MiB Worker
  allocation acknowledgement. Reads launcher `/proc/<pid>/stat` before/after
  cgroup-v2 `memory.current`; rejects PID starttime reuse. Compares Chromium
  cgroup with `/proc/self/cgroup` and reports *shared-with-runner* or
  *separate-unverified*; inaccessible/non-v2 groups are `unavailable` with
  null memory, never zero. No cgroup host path/target URL in receipt.
  The memory counter reflects a **sampled entire cgroup**, even if it includes
  unrelated CI processes. No assumption of atomically observed children.
- `tests/browser-chromium-cgroup-control.test.mjs`: parser and in-memory
  `/proc` mocks for same/unverified membership, denied/absent counter, PID
  reuse, forged isolation, unsupported true peak, Worker PID, missing/gapped
  evidence and tampered artifact. Tests alone do not prove real Chrome memory.
- `.github/workflows/ci.yml`: real Chromium control + independent offline
  `--verify` on saved JSON; upload
  `zpe-chromium-cgroup-scope-003t2d2` even on step failure.
- `task/NEXT.md`, `task/README.md`, `task/003-tiled-content-aware.md`,
  this task card: current state/next actions.

**Acceptance gate:** locally a full checkout was not available because the
execution environment cannot resolve `github.com`. Thus `npm run check`,
live Chromium, PR CI, merge and exact-main **PENDING** until verified remotely.
Do not mark 003T/2d-2 DONE on created code alone. If runner has shared cgroup,
document that isolation is impossible *for this harness* rather than
claiming `memory.current` is an operation-specific peak. A separate
unverified cgroup also cannot certify full renderer/Worker membership.

**Known limitations:** no high-depth editor operation in this control itself;
the existing PSD16/PSB32 browser smoke remains separate. No cgroup reset,
cgroup memory.peak, or bounded PID descendant membership audit; no
cross-process atomic snapshots; no RSS interpolation across blind spans.
Maintain `trueOperationPeakKnown:false`, `workerPidMapping:'unknown'`.
The independent Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md)
is still BLOCKED.

**NEXT P1 003T/2d-3:** read actual CI cgroup receipt, verify executable
feasibility. If cgroup membership is shared, require an independently
provisioned isolated cgroup or else explicitly retain unknown. If separate,
audit child process membership/contamination and PID reuse/exit gaps, then
attempt real PSD16/PSB32 operation-window control with calibrated observed
coverage; claim no true peak without a proven operation-exclusive sensor.

**PR:** [#292](https://github.com/zeter1/ZeTer-Photo-Editor/pull/292) is OPEN; live CI and receipt remain PENDING until checked. The runner step now prints only cgroup availability/scope (no host path) to support an independently readable verification. The strict parser rejects private path disclosure. Do not close the gate on unit-only coverage.

## 2026-10-19 — 003T/2d-2 DONE: real CI proves shared runner cgroup

**Bounded acceptance:** 003T/2d-2 **DONE**; whole 003T **IN PROGRESS**,
Stage 003 **OPEN**. This milestone establishes what the runner actually permits,
not an operation-exclusive memory-peak sensor.

**Verified GitHub evidence:**
- [PR #292](https://github.com/zeter1/ZeTer-Photo-Editor/pull/292) merged
  to [main fdb0509f0ac16966d02a42b04e65c30a5418c312](https://github.com/zeter1/ZeTer-Photo-Editor/commit/fdb0509f0ac16966d02a42b04e65c30a5418c312).
- [PR CI #39273181136 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39273181136):
  `npm run check` incl. negative unit tests; genuine Chromium `file://`
  PSD import/UI and earlier Worker/PID/real Linux controls; actual independent
  Chromium 64 MiB held Worker cgroup probe + strict `--verify`;
  artifact `zpe-chromium-cgroup-scope-003t2d2` uploaded; profiling and
  `git diff --check` all passed.
- Real job log from **that run**:
  `003T real Chromium cgroup probe PASS: before=sampled/shared-with-runner, held=sampled/shared-with-runner; operation peak/Worker PID unknown`.
  This shows the harness and spawned Chrome share the observed cgroup at both
  milestones. No exclusive operation sample or child census was established.
- [Exact merged-main CI #39273747139 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39273747139):
  `head_sha=fdb0509f0ac16966d02a42b04e65c30a5418c312`, the full verify
  job including real cgroup control and previous browser and native tests passed.
- **No independent local full-checkout tests**: the execution container
  could not resolve `github.com`; tested through actual Ubuntu/Chromium
  GitHub CI only. No editor runtime source changed this pass.

**Findings / defect boundary:** `memory.current` belongs to the *shared*
runner+Chrome cgroup. Even subtracting before/after values cannot isolate
the 64 MiB Worker operation from concurrent harness/browser allocations.
High-water counters belong to process/cgroup lifetimes, not operation windows.
No complete descendant census, transient PID read-gap coverage, exclusive
container, or documented Worker→PID join is proven.
Keep `trueOperationPeakKnown:false` and `workerPidMapping:'unknown'`.

**Next task 003T/2d-3 (P1, TODO):** determine whether CI can actually create
a fresh, dedicated cgroup v2 subtree (including permission/delegation check,
membership enforcement and clean teardown) for a browser process tree.
Acceptance requires demonstrably *exclusive* membership for launcher +
all children over a bounded real PSD16/PSB32 Fill/cancel/retry operation,
independent known-load calibration and negative PID reuse/read-gap tests.
If runner cannot delegate a dedicated group, record the precise permission
failure and mark isolation BLOCKED while sampled measurements stay
informational; never rebrand shared `memory.current` as operation peak.
P0 **002B/2c BLOCKED** on authenticated licensed Photoshop-created PSB32.

## 2026-10-19 — 003T/2e: explicit high-depth milestone observation windows (IN PROGRESS)

**Priority:** P1. **Work branch:** [test/003t2e-milestone-window-audit-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2e-milestone-window-audit-20261019). **Detailed acceptance:** [003t2e](003t2e-milestone-window-audit.md). This pass writes and independently validates the exact serialized sampling read windows at each explicit PSD16/PSB32 UI operation milestone, preserving missing PID/CDP/OS-incarnation observations as unknown. The full set of periodic samples is not represented by those milestones, and observed start/end samples are not uninterrupted observation or true operation peak.

Files: `tools/browser-milestone-window-audit.mjs`, `tools/browser-renderer-heap-sampler.mjs`, `tools/browser-operation-timeline.mjs`, `tools/browser-operation-artifact.mjs`, `tools/browser-real-photo-memory-evidence.mjs`, and targeted new/extended tests. Local standalone module: 2 PASS. Full `npm run check`, browser smoke, GitHub PR CI, merge and exact-main CI PENDING. The preceding bounded cgroup delegation runner permission gate is BLOCKED [PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294), and no Worker→PID or operation peak can be claimed. Next: verify CI, exact-main and independent PID incarnation/control gaps. P0 Photoshop-authored PSB32 002B/2c stays BLOCKED.

## 2026-10-19 — 003T/2d-3: real runner delegation and controlled child migration (IN PROGRESS)

**Priority:** P1, **dependency:** 003T/2d-2 real shared runner cgroup CI [#292](https://github.com/zeter1/ZeTer-Photo-Editor/pull/292). **Goal:** distinguish inability to create a fresh delegated cgroup on the actual runner from a *verified, but limited* disposable child move; neither result proves Chromium descendant completeness or an operation-specific memory peak.

**Implementation branch:** [test/003t2d3-cgroup-delegation-probe-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2d3-cgroup-delegation-probe-20261019).

- `tools/browser-cgroup-delegation-probe.mjs`: real `/proc/self/cgroup` + cgroup v2 controller availability, single-use child group under current membership, spawn disposable Node process, migration via `cgroup.procs`, verify incarnation and actual child membership, confirm runner membership unchanged. Guaranteed child termination and group deletion or hard CI failure; only sanitized status/reason, no host paths or Worker PID. If the runner lacks delegation, record actual EROFS/EACCES/EPERM/EBUSY class, not a fake zero or invented isolation.
- `tests/browser-cgroup-delegation-probe.test.mjs`: success/teardown, denied group creation, denied migration, spoofed child cgroup, PID incarnation, runner migration and false operation peak/Worker-to-PID claims.
- `.github/workflows/ci.yml`: execute real Linux probe + independent receipt verifier; upload `zpe-cgroup-delegation-003t2d3` even if probe fails.
- `task/NEXT.md`, `task/README.md`, `task/003-tiled-content-aware.md`: preserve history and point at active milestone.

**Acceptance:** only real runner CI and readback of receipt can establish a supported result. No local full checkout (the container cannot resolve github.com). Local tests / PR CI / merge / exact-main pending at writing time. A successfully moved Node child remains **not** an isolated Chromium browser tree; memory peak and Worker PID stay `unknown`. If blocked, the precise restricted stage is final for this bounded feasibility probe, but full 003T stays OPEN, requiring a different trusted instrument or more useful high-depth code fixes.

**Next P1:** after actual CI verify, audit browser process-tree membership only if independently delegated; otherwise document a blocked isolation gate, maintain `trueOperationPeakKnown:false` and pursue operation observations without peak claims. P0 Photoshop-authored PSB32 provenance 002B/2c remains BLOCKED.

## 2026-10-19 — 003T/2d-3 real CI: delegation BLOCKED by runner permissions

- **Status:** bounded non-privileged delegation feasibility probe **BLOCKED** by actual runner; instrumentation/negative tests PASS. The whole 003T remains **IN PROGRESS** and Stage 003 OPEN. No producer/editor code affected.
- **PR:** [#294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294); verified head `8282b417cecd7586a2106d27258ade900da3751e` in [PR CI run #39277310484 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39277310484).
- **Actual job receipt in CI log:** `003T real Linux cgroup delegation: blocked (cgroup-create-permission-denied); browser descendants/operation peak/Worker PID unknown`. Independent command reports `003T cgroup delegation evidence PASS`; always-upload artifact `zpe-cgroup-delegation-003t2d3` step SUCCESS. Distinguishes actual permission refusal from mock/assumed availability. The sanitized reason combines EACCES and EPERM rather than exposing private host paths or inventing an errno.
- **CI checks:** full `npm run check` with native regression tests PASS; existing `file://` Chromium PSD/PSB and Worker controls PASS; Linux scope/control verifier PASS; profiling and diff hygiene PASS. **Local checkout tests NOT RUN** because github.com DNS unavailable. **Merge and exact-main CI NOT YET VERIFIED** at time of this entry.
- **Limits:** group creation failed before disposable Node migration, so neither an isolated browser cgroup nor complete child membership was observed. The browser/runner shared cgroup established in 003T/2d-2 remains the available sampled instrument, not a true operation peak. No Worker→Linux PID mapping. No change to runtime pixel accuracy.
- **Next P1 003T/2e:** use existing real high-depth PSD16/PSB32 `file://` Fill/cancel/retry fixtures to record explicit sampled operation windows and process-incarnation coverage/gaps with independent controls; reject any claim of exclusive operation peak. Acceptance: typed operation receipts, robust missed-read/PID reuse denial tests, successful PR CI and exact-main after merge. Revisit dedicated cgroup only if CI runner explicitly supports delegation. **P0 002B/2c** remains BLOCKED pending licensed Photoshop-authored PSB32 provenance/reference.

## 2026-10-19 — 003T/2e PR acceptance and integration handoff

- [PR #295](https://github.com/zeter1/ZeTer-Photo-Editor/pull/295) merged into [main `092ff41f`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/092ff41f7e160531399c9f1f3f35c4709f67ed5f), PR [CI #39284501084 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39284501084). Exact-merged-main CI is not yet confirmed.
- Its high-depth CDP/Linux milestone observation is a sampled non-atomic audit, not continuous memory coverage or an operation peak. No Worker→PID mapping.
- [PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294) real cgroup creation is BLOCKED by runner permissions; previous final-head CI hit unrelated intermittent Worker disappearance timeout. Merged main changes into #294 branch; new CI/merge/exact-main pending.
- NEXT P1 003T/2f: independent PID incarnation / blind-gap control and Worker-target-lifecycle reliability; do not call 003T or Stage 003 DONE.

## 2026-10-19 — 003T/2e and 003T/2d-3 integration acceptance

- 003T/2e: [PR #295](https://github.com/zeter1/ZeTer-Photo-Editor/pull/295) merged as [`092ff41f`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/092ff41f7e160531399c9f1f3f35c4709f67ed5f). [PR CI #39284501084 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39284501084), exact-main [core #39287186969 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39287186969), [real-photo #39287187012 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39287187012). **Bounded milestone audit DONE**, whole 003T OPEN.
- 003T/2d-3: [PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294) merged as [`d302b30f`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/d302b30fc4338534aec30df9a10a2b710a2b603e), [final PR CI #39287659595 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39287659595) at merged branch head `68a55d3d06d00a1133a725cca89876f6db471608`. Exact-main [CI #39288381529 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39288381529) on exact main SHA `d302b30f`. Confirmed permission denial for creating a dedicated runner cgroup; do not infer browser process-tree isolation, operation-specific peak or Worker PID. A previous intermediate run #39278297051 failed because of an independent short-lived Worker target disappearance timeout; final merged-head run passed, but race reliability remains a follow-up.
- Next **P1 [003T/2f](003t2f-pid-window-control.md)**: independent Chromium target cleanup and PID-incarnation control, real high-depth window gap tests and negative evidence; no Stage 003 completion claim. P0 licensed Photoshop-authored PSB32 still BLOCKED.

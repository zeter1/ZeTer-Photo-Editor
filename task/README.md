> **037A ЗАКРЫТА (2026-10-14):** [PR #223](https://github.com/zeter1/ZeTer-Photo-Editor/pull/223) → [27a6adb](https://github.com/zeter1/ZeTer-Photo-Editor/commit/27a6adb830797d3258bc640ffe09dd89c3ef92b8), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38586323259), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38586743806). Независимый native RGB16/Float32 per-pixel clean-reference oracle с SHA-256, exact alpha/outside checks и 5 Node unit cases; все PR/main CI gates success. **Реальных photo benchmark результатов всё ещё нет:** CC0 источник только выбран, asset SHA-256 не закреплён. **Следом 037B** — pinned legal photo bytes/native clean+defect fixtures; **037C** — Chromium `file://` 3×/формат и artifact/quality gates. [037](037-real-photo-connected-roi-benchmark.md) · [provenance](../tests/fixtures/real-photo/README.md). P0 [002](002-psd-compatibility-corpus.md) остаётся открытой.

> **036C ЗАКРЫТА (2026-10-14):** [PR #222](https://github.com/zeter1/ZeTer-Photo-Editor/pull/222) → [27dbb27](https://github.com/zeter1/ZeTer-Photo-Editor/commit/27dbb2718ea0078dbbfffe09870494d8d90480bc); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38580054433), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38580574257). 1245 Node tests, PSD16/PSB32 real Chromium, 4/4 JSON artifact, профили success. Следующая P1 [037](037-real-photo-connected-roi-benchmark.md), внешний лицензированный P0 [002](002-psd-compatibility-corpus.md). **Полные Stage 002/003 ещё открыты.**

> **036B закрыта (2026-10-14):** [PR #221](https://github.com/zeter1/ZeTer-Photo-Editor/pull/221) → [`7fbc9117`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7fbc9117f617c4495ac0d0c20151145a177eb165); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38576559275), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38577167032). PSD16/PSB32 real Chromium UI selection / native Worker / public Save Project ×4 / byte-exact Undo/Redo; 8288/8288 selected pixels и native MAE→0 на ZeTer synthetic reference. **Следующее 036C:** versioned browser latency/RSS/CDP evidence; P0 [002](002-psd-compatibility-corpus.md) отдельно, Stage 003 открыта. [NEXT](NEXT.md).

> **Исторический ориентир после 035 / 036 (уже завершено):** [wide connected ROI native quality/latency/RSS в реальном Chromium `file://`](036-browser-connected-roi-quality.md) после закрытой 035; внешний Photoshop-authored корпус [002](002-psd-compatibility-corpus.md) остаётся P0. [NEXT](NEXT.md).

> **035 (закрыто, test-only):** [поздняя recovery-modal](035-browser-recovery-modal-flake.md) исправлена в Chromium smoke после трёх delayed IndexedDB `Page.reload`. [PR #219](https://github.com/zeter1/ZeTer-Photo-Editor/pull/219) → `66f41e6`; [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38563696598) и [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38564063538) success. Без production изменений.

> **034 / 024D3 (слито, CI success):** [native MAE/RMSE по широкому связанному выделению](034-complex-roi-native-quality.md) в Node Worker RGB16/CMYKA32. Проверяет оба этапа (дефект/восстановление) по известному чистому фону, точные невыделенные bytes/alpha, улучшение ошибки и нативную Worker parity. [PR #218](https://github.com/zeter1/ZeTer-Photo-Editor/pull/218) merged `8208ab9`, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545340603) + [main CI attempt 2](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383) success. Это **не** Chromium wide ROI или внешний Photoshop reference. Stage 002/003 остаются открыты. [NEXT](NEXT.md).

> **033 / 024D2 (слито в main; CI success, 2026-10-14):** [native 16/32-bit synthetic quality oracle в настоящем Chromium `file://` Fill + cancel/retry/Undo/Redo](033-browser-synthetic-native-quality.md). MAE/RMSE по известному постоянному фону дефекта 5×5 без преобразования в RGBA8; строгая проверка quality evidence в CI JSON. Только test harness; [PR #217](https://github.com/zeter1/ZeTer-Photo-Editor/pull/217) → `685d178`, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38542625807) и [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38543002186) — success. Stage 002/003 открыты. После этой проходки: P0 [002](002-psd-compatibility-corpus.md), P1 сложные connected ROI [003](003-tiled-content-aware.md), P1 target→PID evidence [025](025-browser-worker-target-census.md). [NEXT](NEXT.md).

> **032 / 024D1 (слито в main; PR и exact-code main CI success, 2026-10-14):** [точная проверка native-байтов в выделении при Chromium PSD16/PSB32 Worker + отмене/Undo/Redo](032-browser-native-selection-integrity.md). Получение frozen indices из реального Worker, отказ при записи в любой соседний невыделенный 16/32-битный пиксель; Node negative matrix. Тестовый harness; производственный runtime не меняется. [PR #216](https://github.com/zeter1/ZeTer-Photo-Editor/pull/216) → `f3d1336`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538156947) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538532002). Stage 002/003 остаются открытыми. Следом [002](002-psd-compatibility-corpus.md), [003](003-tiled-content-aware.md), [025](025-browser-worker-target-census.md). [NEXT](NEXT.md).

> **031 / 024C6 (слито в main, PR + exact-code CI success, 2026-10-14):** [защита JSON memory evidence от поддельного Worker PID/exit/peak](031-browser-memory-claim-integrity.md): `workerPidMapping:'unknown'`, `provenWorkerTerminationCount:null`, валидные target ID records и запрет несуществующих измерений проверяются перед записью и при чтении CI артефактов; негативные regressions. [PR #215](https://github.com/zeter1/ZeTer-Photo-Editor/pull/215) → `505a1a9`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38533360435), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38533729179). Только test harness; Stage 002/003 **открыты**. Следующие: [002](002-psd-compatibility-corpus.md), [025](025-browser-worker-target-census.md), [003](003-tiled-content-aware.md). [NEXT](NEXT.md).

> **030 / 024C5 (слито, PR + exact-code main CI success, 2026-10-14):** [проверяемые длительности browser operation](030-browser-operation-duration-evidence.md) — сводные `durationsMs` строго сверяются с milestones при `finish` и в CI JSON; подменённые интервалы cancel→retry и некорректные поля отвергаются. [PR #214](https://github.com/zeter1/ZeTer-Photo-Editor/pull/214) → `98ea308`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38531032892) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38531246576). Только test harness; Stage 002/003 открыты. Далее P0 [002](002-psd-compatibility-corpus.md), P1 [025](025-browser-worker-target-census.md) и [003](003-tiled-content-aware.md).

> **029 / 024C4 (слито, PR + exact-code main CI success, 2026-10-14):** [проверка порядка browser operation evidence](029-browser-operation-evidence-order.md). Реальный Chromium `file://` PSD16/PSB32: cancel→проверка байтов→retry→Undo/Redo подтверждается упорядоченными milestone, противоречивые JSON отвергаются. Только harness/tests, production без изменений. [PR #213](https://github.com/zeter1/ZeTer-Photo-Editor/pull/213) → `092b02d`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38529014491), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38529236050). **Следом:** P0 [002](002-psd-compatibility-corpus.md), P1 [025](025-browser-worker-target-census.md) и [003](003-tiled-content-aware.md).

> **028 / 024C3 (слито, PR + exact-code main CI success, 2026-10-14):** [Worker Target snapshot gaps](028-browser-worker-target-observation-gaps.md): отдельный `snapshotCoverage`, `null` для неизвестной финальной видимости, отсутствие выдуманного churn через пропуски, безопасный fallback при несовместимой метке фазы. [PR #212](https://github.com/zeter1/ZeTer-Photo-Editor/pull/212) → `88ede195`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38527401333), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38527667389). **Следом:** P0 [002](002-psd-compatibility-corpus.md), P1 [025B](025-browser-worker-target-census.md) и [003](003-tiled-content-aware.md); Stage 002/003 открыты. [NEXT](NEXT.md).

> **027 / 024C2 (слито, PR + exact-code main CI success, 2026-10-14):** [полнота PID-наблюдений и неизвестные интервалы при cancel→retry](027-browser-process-observation-gaps.md): отдельные CDP PID и Linux /proc snapshot coverage, отсутствие финального снимка не трактуется как видимость или exit. Проверено: [PR #211](https://github.com/zeter1/ZeTer-Photo-Editor/pull/211) → `93f5c2e`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38525012524), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38525286762). Следом P0 [002](002-psd-compatibility-corpus.md), P1 [025B](025-browser-worker-target-census.md); Stage 002/003 открыты. [NEXT](NEXT.md).

> **026 / 024C1 (слито, PR + exact-main CI success, 2026-10-14):** [coverage / реальные start/end значения browser memory](026-browser-memory-sample-coverage.md). При потере CDP privateMemory или Linux /proc VmRSS финальный счётчик теперь `null`, а не старый отсчёт; новые coverage/snapshot gaps в timeline. Тесты добавлены; [PR #210](https://github.com/zeter1/ZeTer-Photo-Editor/pull/210) слит (`67e4451`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38522956593) и [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38523222466). Далее P0 [002](002-psd-compatibility-corpus.md), P1 024C2/025B; Stage 002/003 открыты. [NEXT](NEXT.md).

> **025 / 024B3 (слито в main; PR + exact-code CI success, 2026-10-14):** [браузерный CDP Worker target census](025-browser-worker-target-census.md) ([PR #209](https://github.com/zeter1/ZeTer-Photo-Editor/pull/209), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38520690545), [CI точного кодового main SHA](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38520975172)): target IDs/types отдельно от PID+starttime, без URL/title, без ложных Worker-PID/exit/peak RAM утверждений, безопасный fallback при недоступности `Target.getTargets`. 1200 Node tests, реальный Chromium `file://` PSD16/PSB32, JSON artifacts, профили и diff hygiene — success. **Следующее:** P0 Photoshop-authored RGB16/CMYK32 oracle и P1 документированный target→PID метод либо `unknown`. Stage 002/003 открыты. [NEXT](NEXT.md).

> **024B2b завершена и слита в `main` (PR + exact-main CI success, 2026-10-14):** [PR #208](https://github.com/zeter1/ZeTer-Photo-Editor/pull/208), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38518410697), [main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38518637139). Реальный `file://` PSD16/PSB32 kernel-write → mid-kernel terminate по блокировке слоя → исходные native bytes/History без ложной публикации → новый Worker с exact Undo/Redo. **Следующее:** P0 независимые лицензированные Photoshop high-depth golden; P1 доказательный Worker→PID mapping. Stage 002/003 открыты. [024](024-browser-operation-memory.md) · [NEXT](NEXT.md).

> **024B2a (merged, PR CI success):** real Chromium `file://` PSD16/PSB32 operation JSON artifacts (timings, 50ms requested sampling, available/unavailable memory), Linux PID+starttime last-sample visibility without fabricated process-exit or operation peak claims. [PR #207](https://github.com/zeter1/ZeTer-Photo-Editor/pull/207), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38166256448). **Next 024B2b:** true CPU mid-kernel cancel→recovery/native word+History oracle and only evidenced CDP target attribution. P0 independent licensed Photoshop RGB16/CMYK32 corpus remains open. [Details](024-browser-operation-memory.md) · [NEXT](NEXT.md).

> **024B1 (merged, PR + exact-main CI success):** Linux Chromium process-identity samples now distinguish observed `PID+starttime` lifetimes and detect PID reuse across/within samples; add native RSS/HWM identity regression tests. [PR #206](https://github.com/zeter1/ZeTer-Photo-Editor/pull/206), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38165437542), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38165563357). [Details](024-browser-operation-memory.md). **Next:** 024B2 browser mid-kernel cancel/recovery timeline + machine-readable CI report, and P0 external Photoshop high-depth corpus. [NEXT](NEXT.md).

> **010E-B4 / 024A — слито в `main`, PR + exact-main CI success:** [PR #205](https://github.com/zeter1/ZeTer-Photo-Editor/pull/205), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38164350321), [main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38164497873). [browser high-depth operation timeline и sampled Chromium PID churn](024-browser-operation-memory.md) для PSD16/PSB32; RSS/HWM всё ещё sampled/process-lifetime, не истинный Worker peak. **Следующее:** 024B identity/starttime + process attribution, P0 licensed Photoshop corpus. [NEXT](NEXT.md).

> **010E-B3B / 023 — слито, PR и exact-code main CI green:** [общий лимит планирования native oversized ROI](023-planner-total-budget.md), отказ до private ROI decode при превышении 4 194 304 операций, RGB16/CMYKA32 Worker/cancel регрессии. [PR #204](https://github.com/zeter1/ZeTer-Photo-Editor/pull/204), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161611345), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161771493). **Следом:** [010E-B4 browser operation-wide memory methodology](024-browser-operation-memory.md) и P0 Adobe-authored external corpus. [Очередь](NEXT.md).

> **010E-B3A / 022 — завершено, код в `main`, exact-main CI success:** [cooperative planning checkpoints](022-cooperative-planning-checkpoints.md) внутри oversized ROI planner, ранняя атомарная отмена до чтения private tiles, проверки для frozen-index и geometry-scanned RGB16; [PR #203](https://github.com/zeter1/ZeTer-Photo-Editor/pull/203), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38160333627), [CI точного main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38160516517). **Далее:** B3B strict planner work budget + adversarial masks; P0 независимые Photoshop-authored high-depth golden и Stage 002/003 остаются открыты. [Очередь](NEXT.md).

> **010E-B2 / 021 — merged in main, exact-code CI green:** [bounded connected run bands](021-connected-run-bands.md): 8-connected bounded components of horizontal runs, exact native precision / cancel regression for twin diagonal RGB16/CMYKA32. [PR #202](https://github.com/zeter1/ZeTer-Photo-Editor/pull/202), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38158700018). Exact-code SHA `656e39f3` [exact-main code push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38158971996); Stage 002/003 remain open. [Next](NEXT.md).

> **010E-M / 019 — завершена инструментальная проходка (слито в main, PR CI success):** [Linux Chromium RSS + PID VmHWM](019-browser-linux-rss.md). Замеры для настоящего `file://` Worker UI smoke (11 Linux RSS выборок, без доступного CDP privateMemory); sampled, не peak. [PR #200](https://github.com/zeter1/ZeTer-Photo-Editor/pull/200), squash `1d8e6fbc`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38155212317). **Следующая основная 010E-B:** bounded adaptive horizontal runs/connected clusters; P0 Adobe corpus остаётся открытым. [Очередь](NEXT.md).

> **010E-A / завершено (2026-10-11, CI success):** [018 — complex dense connected ROI native Worker/precision/cancel + Node memory baseline](018-complex-roi-profile.md). [PR #199](https://github.com/zeter1/ZeTer-Photo-Editor/pull/199), squash `b8e82e6`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38153857359), [CI точного кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38154037812). 8288 selected, 536 native tiles, RGB16/CMYKA32 byte parity и atomic budget/cancel. **Следующая 010E-B:** adaptive horizontal runs/connected clusters с ограниченным planning cost, затем browser memory HWM. Stage 002/003 остаются открыты.

> **010D-D / завершённая малая проходка (2026-10-11, CI success):** [017 — две разные PSB32 Float32 вкладки, native Worker/cancel и независимое exact-word Undo/Redo](017-dual-native-psb32-session-isolation.md). [PR #198](https://github.com/zeter1/ZeTer-Photo-Editor/pull/198), squash `24d0edb7`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152587196), [CI кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152760057). Общие Stage 002/003 остаются открыты; [дальнейшая очередь](NEXT.md).

> **010D-C / завершённая малая проходка (2026-10-11, CI success):** [016 — реальный Chromium PSB32 Float32, активная mid-kernel смена вкладки и exact native Undo/Redo](016-psb32-mid-kernel-undo-redo.md). Продолжает [015](015-active-session-worker-cancel.md); обе глубины PSD16/PSB32 в `file://` smoke. [PR #196](https://github.com/zeter1/ZeTer-Photo-Editor/pull/196) слит (`9d146eb3`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150936804), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38151060369); Stage 002/003 остаются открыты. [Очередь](NEXT.md).

> **Завершена малая проходка 010D-B0 (2026-10-11):** [014 — Chromium две реальные вкладки / mid-kernel guard](014-browser-session-guard-mid-kernel.md): второй документ создаётся через UI, попытка смены вкладки во время CPU-bound Worker должна безопасно отклоняться, после отмены проверяются обе вкладки, исходные native PSD16 bytes и успешный повторный Fill. Результат слит: [PR #194](https://github.com/zeter1/ZeTer-Photo-Editor/pull/194), `main` squash `7d82588d`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38149023595), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38149125350). Это **не** реализация разрешённого mid-kernel session switch; 010D-B, Stage 002/003 остаются открыты. [NEXT](NEXT.md).

> **Текущая завершённая малая проходка 010A (2026-10-11):** Node Worker mid-kernel terminate + exact-owner poll на реальном `inpaintSelectedSamples` с test-only SharedArrayBuffer progress probe; последующий job успешно выполняется. [PR #190](https://github.com/zeter1/ZeTer-Photo-Editor/pull/190) слит (`61dcd260`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38144346522), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38144433426). **010 продолжается:** dense strip/segment grouping, native parity и настоящий Chromium `file://` mid-kernel stress. [Следующая очередь](NEXT.md), [подробный контракт 010](010-dense-roi-worker-mid-kernel-cancel.md). Stage 002/003 не закрыты.

> **Последняя завершённая проходка 009:** [большой PSB32 Float32 и Worker pending-reply cancellation](009-large-psb32-worker-cancellation.md). [PR #189](https://github.com/zeter1/ZeTer-Photo-Editor/pull/189) слит (`0cd2c2efc260b4721737b0997d12b9e3dac12290`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38143205232), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38143299893). **Следующая [010](010-dense-roi-worker-mid-kernel-cancel.md)** — bounded dense ROI и mid-kernel cancellation; общие 002/003 всё ещё открыты. [Очередь](NEXT.md).

> **Последняя завершённая проходка 008:** [большой PSD16 → v2 Worker через Chromium file://](008-browser-large-psd16-worker.md). [PR #188](https://github.com/zeter1/ZeTer-Photo-Editor/pull/188), squash f172168cbbda02ecded76818055164b63eca5ac3; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142325168); [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142408685). Следующая [009](009-large-psb32-worker-cancellation.md): PSB32 + отмена; dense ROI и независимый high-depth Photoshop corpus остаются открыты. [Очередь](NEXT.md).

> **Последняя завершённая проходка:** [007 — PSD16/PSB32 file:// UI import + native Save Project sample parity](007-browser-psd-psb-ui-import.md), [PR #187](https://github.com/zeter1/ZeTer-Photo-Editor/pull/187) слит; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137491812), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137556394). **Stage 002/003 остаются открытыми** — дальнейшая очередь [NEXT.md](NEXT.md).

> **Последняя завершённая проходка:** [006 — >256 occupied native tile fragments](006-many-tile-bounded-fragments.md), [PR #186](https://github.com/zeter1/ZeTer-Photo-Editor/pull/186) слит; [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136526958). Общие Stage 002/003 остаются открыты; [очередь](NEXT.md).

> **Последний завершённый подэтап:** [005 — connected ROI / global frozen donors](005-connected-roi-frozen-donors.md), [PR #185](https://github.com/zeter1/ZeTer-Photo-Editor/pull/185), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135223279). Следующие задачи — [NEXT.md](NEXT.md); общие Stage 002/003 ещё открыты.

> **Текущая исполнимая очередь:** [task/NEXT.md](NEXT.md) (2026-10-11). Стадии 002 и 003 **не закрыты**; не путать реализованный инструмент с полной Photoshop-совместимостью.

## 2026-10-11 — Stage 002 P0: bounded external manifest preflight (слито, main CI success)

- Закреплён bounded (1 MiB) descriptor-based manifest read с запретом symlink/replacement; аудитор не доверяет внешнему JSON независимо от 512 MiB лимита самих PSD/PSB.
- Заголовки RGB16/CMYK32 требуют не меньше 3/4 каналов; отклоняются неправдоподобно короткие PSD/PSB. Добавлены регрессионные тесты некорректных headers и manifest.
- Это улучшение **preflight**, не внешний Adobe golden и не завершение corpus. Gate пройден: [PR #182](https://github.com/zeter1/ZeTer-Photo-Editor/pull/182) → [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38128443224) → merge `2033a10` → [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38128545523). Далее брать P0 real licensed Adobe fixtures и P1 connected ROI из [NEXT.md](NEXT.md).

## 2026-10-11 — Stage 003 P1: валидация результата detached Worker (слито, CI success)

- Валидация reply перед native preview: целочисленные counters, полнота frozen selection, модель/глубина/alpha/colorSpace, tile topology, точная численность изменённых payloads и запрет любых изменений donor tiles вне выделения.
- tests/tiled-inpaint-ui-dispatch.test.mjs: набор повреждённых ответов Worker; отказ без повторного запуска fallback и без изменения immutable source. Это не пиксельная проверка изменений внутри выбранного tile и не внешний Adobe golden.
- **Gate выполнен:** [PR #181](https://github.com/zeter1/ZeTer-Photo-Editor/pull/181) слит в main (squash `2e434a74193fcc2d3af3ab8c4886fc1eea83fef8`). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38127890689) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38127939781) — **success**: 1134 Node tests, bundle parity, Chromium file://, два informational профиля и diff hygiene.
- **Очередь:** P1 — безопасная стратегия широких connected ROI без огромного bounding rectangle, с тестами cancel/precision и честным лимитом памяти. P0 002 — independently Photoshop-authored PSD16 + PSB32 с проверяемыми license/provenance/SHA-256. Затем end-to-end file:// UI Worker → Preview → Undo/Redo + sampled renderer/process RAM. Общие 002/003 не закрыты.

## 2026-10-11 — Stage 003 P1: source-safe tiled high-depth mutations (слито, CI success)

- **Gate выполнен:** [PR #180](https://github.com/zeter1/ZeTer-Photo-Editor/pull/180) слит в `main` (squash `c36d64e7d5680233e118e9228c483d6ea4503050`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38126514754) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38126567513) — **success**: Node, generated bundle parity, Chromium `file://`, информативные профили и diff hygiene. Общие задачи 002/003 остаются открытыми.


- Native non-inpaint tiled mutation now preserves exact original highDepthSource identity across cooperative preview, PNG encode and atomic publication; source replacement on the same owner/layer cancels superseded work.
- Caller continuation revocation aborts RGBA8 preview before PNG encoding. Explicit cancellation cannot yield a mutation with null dataUrl. Three regressions cover both cancellation windows and caller revocation.
- **Next P1:** extremely wide connected ROI without inflated bounding box, browser profiling of preview/Worker/Undo. **P0 002:** independently licensed Photoshop-authored PSD16/PSB32 with pinned hash/provenance and verified Adobe references. Neither 002 nor 003 is complete.

# task — очередь небольших инженерных проходок

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

## 2026-10-11 — Stage 003 P1: измерение узкого места tiled readRegion/writeRegion (слито, CI success)

- Добавлен изолированный Node-профиль `node tools/profile-tiled-region-io.mjs --cases rgb16,cmyk32` и контрактный тест `tests/tiled-region-io-profile.test.mjs`. Каждый случай выполняется в отдельном процессе с `--expose-gc`: измеряются `readRegion`, `writeRegion`, `serialize`, sampled RSS/heap/ArrayBuffers и process-wide high-water RSS.
- Проверяются полные native RGB16/CMYKA Float32 данные через seam, **ровно один** изменённый пиксель/тайл, побайтово неизменные исходные payloads и исходные samples. Тайминги и память **информационные**, без нестабильных performance thresholds в CI.
- **Граница:** это синхронный Node baseline на синтетических tiles, **не** cooperative cancellation, не Chromium `file://`, не настоящий Photoshop-authored PSD/PSB и не per-stage peak RSS. Подэтап профилирования не закрывает Stage 003.
- **Следующие P1:** (1) общий sync/cooperative chunked readRegion с отменой внутри большого ROI, затем chunked writeRegion без частичной публикации; (2) разбивка длинного связного ROI без раздувания bbox; (3) chunked RGBA8 preview и браузерные измерения памяти; (4) P0 по 002 — независимо созданные Photoshop PSD16/PSB32 с лицензией/hash.
- **Gate выполнен:** [PR #176](https://github.com/zeter1/ZeTer-Photo-Editor/pull/176) слит (squash `b56ad540e5f7876230db0fa47bc532583a960aea`), [точный push-CI `main`](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38122037274) — **success**. Проверены Node tests, generated artifact parity, Chromium `file://` smoke, informational профили и diff hygiene. Общая 003 и задача 002 остаются **открытыми**.

## 2026-10-11 — Stage 003 P1: cancellation during dirty tile serialization (слито, CI success)

- Реализация в ветке `feat/stage003-cooperative-tile-serialization-20261011`: `createSerializedPixelBufferTileWorkingSet().serializeCooperative()` сохраняет byte parity с sync `serialize()`, отдаёт управление после каждых четырёх реально перекодированных tiles и не публикует частичную tile-set при отмене.
- Обновлены обе cooperative native inpaint ветки (frozen indices и scan) через общий ROI command step; sync Worker/Node по-прежнему не использует await.
- Тесты: прямое прерывание кодирования RGB16, alpha promotion, одинаковые tile payloads, отмена большого multi-tile ROI в serialization phase и исходные immutable bytes.
- **Подэтап закрыт:** [PR #175](https://github.com/zeter1/ZeTer-Photo-Editor/pull/175) (squash `11aec98b5958dacbca97d7e7ca47096fc2301823`), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38121282434) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38121334792) — **success**. Node tests, generated parity, Chromium `file://` smoke, profiles и diff hygiene прошли; вся Stage 003 остаётся **открытой**.
- **Следующее (P1):** отменяемые `readRegion` / `writeRegion`, длинный связный ROI без inflated rectangle, chunked RGBA8 preview; затем Chromium `file://` real Photoshop-authored high-depth PSD/PSB с pinned hashes, memory/Undo measurements. `002` и `003` **открыты**.

## 2026-10-11 — Stage 003 P1: прерывание внутри одного ROI (слито, PR/main CI success)

- В ветке `feat/stage003-cooperative-inpaint-kernel-20261011`: синхронное native inpaint/Worker и cooperative fallback используют общие детерминированные шаги ядра. Fallback отдаёт управление во время scan, очереди заполнения и PatchMatch, а не только между ROI.
- Регрессии: точная Uint16 RGB sync/cooperative parity на 256×256 с большим ROI; отмена Float32 CMYKA после входа в единственный ROI с нулевой публикацией и неизменным source.
- **Подэтап закрыт:** [PR #174](https://github.com/zeter1/ZeTer-Photo-Editor/pull/174) слит (squash `b0453bab80c706ffc5c19a56672b3b799a1c44b3`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38120564410) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38120614660) — **success**: Node tests, generated artifact parity, Chromium `file://` smoke, profiling, diff hygiene. Задача 003 остаётся **открытой**.
- **Следующее (P1):** длинный связный ROI без глобальной прямоугольной аллокации; отменяемые native tile read/write/serialization и полноразмерный RGBA8 preview; браузерный стресс-тест + memory snapshots.
- **Отдельный блокер (P0, task 002):** независимо созданные/лицензированные Photoshop PSD16/PSB32 с pinned hash, goldens и реальным `file://` import/Worker/Undo. Не называть синтетические образцы эквивалентом Adobe.


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


## Stage 002 P0 — exact frozen-index Worker tile parity (2026-10-10)

- Добавлена **детерминированная проверка всех tile payload bytes и метаданных** результата реального Node Worker против синхронного `inpaintTiledPixelBufferSourceFromIndices` с **тем же однократно зафиксированным** пикселем выделения. Несовпадение `filled/changed/changedTiles/loadedTiles`, native metadata или любого tile payload теперь останавливает профиль вместо ложного `passed:true`; JSON фиксирует `workerParity: "exact"`, `oracleMs`, `memory.afterOracle`. Отрицательные регрессии инъецируют некорректный счётчик, depth и tile payload.
- Ограничения: это **сверка одного и того же ядра в двух средах**, а не независимый эталон Adobe Photoshop, не доказательство лицензии и не browser `file://`/UI. Oracle выполняется после Worker и добавляет отдельную CPU/memory нагрузку; memory checkpoints — не true peak RSS.
- **Далее P0:** лицензированные независимо Photoshop-authored PSD16/PSB32, зафиксированные hashes/provenance и референсы, запуск external CLI, браузерный import → tiled UI Worker → preview → Undo/Redo + renderer/Worker/process memory. **Далее P1:** connected wide ROI и прерываемые fallback/preview с atomic publication. `002` и `003` **не закрывать**.

## Stage 002/003 — audited high-depth PSD/PSB → native Node Worker (2026-10-10)

- В рабочей проходке добавлен `tools/profile-external-high-depth-psd-psb.mjs --manifest /path/to/manifest.json`. После существующего pinned SHA/header preflight инструмент повторно фиксирует bytes того же fixture, сверяет hash, декодирует реальный PSD/PSB, проверяет Uint16/Float32 native samples, сериализует tiles, запускает настоящий Node Worker и проверяет frozen selection / immutable tile payloads. JSON содержит snapshot RSS/heap/arrayBuffers, а **не** пиковый RSS.
- `tests/profile-external-high-depth-psd-psb.test.mjs` прогоняет сам инструмент на **явно синтетических** ZeTer-written 16/32-bit PSD/PSB; фиктивное поле Photoshop в тестовом manifest демонстрирует, что заявленный provenance **не** является доказательством авторства.
- **Открыто P0:** законно распространяемые независимо Photoshop-authored PSD16/PSB32 с исходниками/лицензией/референсами; запуск CLI на их pinned manifest; отдельный Chromium `file://` import → tiled UI Worker → preview → Undo/Redo и реальные browser/process/Worker snapshots. **Открыто P1:** широкий connected ROI и interruptible fallback/preview. Задачи 002 и 003 не закрывать, пока нет независимого подтверждения.


## Stage 002 P0 — закрепление file descriptor при аудите PSD/PSB (2026-10-10)

- Аудитор теперь открывает внешний fixture через `O_NOFOLLOW` (где поддерживается), сопоставляет `dev/ino/size` результата `lstat` с открытым дескриптором и повторяет проверку по завершении потока. Хеш и заголовок читаются **с того же открытого файла**, без второго обращения по пути и без полной загрузки PSB в RAM; descriptor закрывается при успехе/ошибке.
- Добавлены regressions для symlink даже при правильном SHA-256 и повторного успешного аудита после ошибочного payload. Это hardening preflight, **не** подтверждение авторства/Photoshop-совместимости. Приоритет P0 не меняется: легальные независимые Photoshop-authored PSD16/PSB32, эталон и Chromium `file://` end-to-end Worker/preview/Undo + memory. После них P1: широкий связный ROI и прерываемый fallback/preview. Задачи 002 и 003 остаются открытыми.


## Stage 002 P0 — потоковый SHA-256 preflight для больших PSD/PSB (2026-10-10)

- `tools/audit-external-high-depth-corpus.mjs` теперь проверяет внешние файлы фиксированными 64 KiB блоками вместо загрузки всего PSD/PSB (лимит 512 MiB) в Node heap. Заголовок проверяется по первым 27 байтам, stream length — повторно, SHA-256 — по всем байтам. Добавлена multi-chunk/tail-corruption regression.
- Это только инструмент аудитора, без изменения редактора/версии и без доказанной Photoshop-совместимости. **Следующее P0:** реальные лицензированные Photoshop-authored PSD16/PSB32 с provenance и end-to-end `file://` decode → UI Worker → preview/Undo/Redo, process/renderer/Worker memory samples. **Затем P1:** длинные связанные ROI и прерываемый main-thread fallback/preview. `002` и `003` остаются открытыми.


## Stage 003 — точные границы halo в соседних tiled ROI (2026-10-10)

- **Подэтап закрыт:** исправлено ложное объединение соседних занятых тайлов с раздельными фактическими selection/halo: source + оба generated Worker/browser artifacts + Uint16 parity regressions. [PR #167](https://github.com/zeter1/ZeTer-Photo-Editor/pull/167) merged (squash `94825723a2593d479ca8296f2a2ad8448054a420`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38069654597) и [exact main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38069712550) — **success**.
- **Следующее (002/003 ещё открыты):** P0 real Photoshop-authored 16-bit PSD / 32-bit PSB с audit hashes/provenance и browser file:// decode → UI Worker → preview/Undo + memory; P1 длинные связанные выделения (без oversized bounding box), прерывание fallback/preview. Основные задачи [002](002-psd-compatibility-corpus.md) и [003](003-tiled-content-aware.md) открыты.

## Проходка Stage 002 P0 — preflight независимых 16-bit PSD / 32-bit PSB (2026-10-10)

- Реализован локальный аудит `tools/audit-external-high-depth-corpus.mjs`: manifest с **двумя** внешними образцами (16-bit PSD v1 и 32-bit PSB v2), pinned SHA-256/size, исходной HTTPS-ссылкой, заявленным Photoshop provenance и лицензией; независимо проверяются 8BPS, reserved bytes, version, channels, geometry, bit depth и color mode. Нет network download и доверия имени расширения.
- Новые Node regressions: `tests/audit-external-high-depth-corpus.test.mjs` — положительный CLI/JSON контракт на **header-only mocks**, подмена bytes, size/header mismatch, неполный corpus, ложное происхождение и path traversal.
- **Статус:** реализован *только* инструмент предварительного аудита, ещё **нет** подтверждённых независимых реальных 16/32-bit Photoshop-authored fixtures. Header-only тесты **не** доказывают PSD decoder/Photoshop render.
- **Дальше P0:** добыть лицензированную пару реальных файлов; сохранить `manifest.json` и оба файла в новом provenance corpus; прогнать аудит, затем полный `decodePsd → native tiles → Worker → file:// preview/Undo/Redo` с memory sample. После этого P1: широкий connected ROI и прерываемый fallback/preview. Задачи 002/003 **открыты**.


## Актуальный приоритет — следующая проходка (Stage 002/003, 2026-10-10)

Активная задача: [003 — Tiled Content-Aware Fill](003-tiled-content-aware.md). Не считать прежние merged-подэтапы завершением всей задачи.

1. **P0 / corpus:** найти независимые Photoshop-authored **16-bit PSD и 32-bit PSB** с допустимой лицензией, pinned SHA-256, размерами и metadata/provenance в [002](002-psd-compatibility-corpus.md). Не выдавать файлы, созданные ZeTer writer, за внешний Photoshop corpus.
2. **P0 / browser:** прогнать реальные внешние высокобитные PSD/PSB через file:// import → native tiles → UI Worker Content-Aware Fill → preview → Undo/Redo; проверить source immutability, один history commit, precision и sampled renderer/worker/process memory с честными ограничениями измерений.
3. **P1 / algorithm:** проработать широкий связный ROI без непропорционального global bounding rectangle (сохранить donor/halo и atomic publication, защиту памяти).
4. **P1 / cancellation:** отдельная прерываемая main-thread fallback/preview ветка с immutable snapshot и exact-owner checks; без повтора выборки и без частичных tile writes.

**Текущая регрессионная проходка:** синтетический (созданный ZeTer writer) RGB16 PSD и Float32 HDR PSB теперь проверяется по полной цепочке binary decode → tiles → реальный Node Worker → bounded inpaint oracle. Это закрывает внутренний seam, **не закрывает** P0 внешний corpus и browser memory. Файл: `tests/tiled-inpaint-high-depth-psd-psb-worker.test.mjs`. [PR #165](https://github.com/zeter1/ZeTer-Photo-Editor/pull/165) **merged** (squash `454d4701ff3bc737d450c28565f6afe4eeb83d86`); [PR CI #38068148332](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38068148332) и [точный main push CI #38068208280](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38068208280) — **success**. Внутренний high-depth Worker seam закрыт; Stage 003 и P0 независимых файлов остаются открытыми.

## Stage 003 — real external PSD/PSB → Node Worker regression (2026-10-10; merged, main CI green)

- Новая end-to-end Node проверка существующего tiled UI dispatch на pinned внешних 8-bit CMYK PSD и RGB PSB: decode → tiles → one-shot selection → настоящий Worker → exact native result и исходные tile payloads unchanged.
- Реализация без production/runtime изменений и без bump версии: `tests/tiled-inpaint-external-psd-psb.test.mjs`. Проверяет detached Worker и immutable source, **но не** browser `file://` preview/Undo или real 16/32-bit large PSD/PSB memory profile.
- **Следующие задачи:** независимые Photoshop-authored 16/32-bit PSD/PSB с hashes/provenance, браузерный file:// decode → Worker → preview/Undo + memory/latency; широкий связный ROI, interruptible fallback/preview. `002` и `003` остаются открытыми. Подэтап **закрыт**: [PR #164](https://github.com/zeter1/ZeTer-Photo-Editor/pull/164) merged (squash `f6a19f040079aef786559281f4be19fb6b23785b`), [PR CI #38067582057](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38067582057) и [точный main push CI #38067644445](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38067644445) завершились **success**. Вся 003 остаётся открытой.

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

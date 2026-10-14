# 028 / 024C3 — Пропущенные CDP Worker target snapshots и честная неизвестность

**Статус (2026-10-14):** [PR #212](https://github.com/zeter1/ZeTer-Photo-Editor/pull/212), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38526924226) (`npm run check`, generated parity, реальный Chromium `file://`, JSON, профили и diff hygiene). **Merge и exact-main CI ещё ожидаются.** Только test instrumentation, production/editor bundle не изменён.

## Проблема

- `Target.getTargets` может отвечать до отмены Content-Aware Worker, а после отмены перестать отвечать. Прежний census сохранял последнюю успешную `previous` membership и выдавал `observedAtLastSnapshot:true` / ненулевое число видимых targets даже если снимок `finished` отсутствовал.
- Сопоставление двух успешных Target polls через неуспешный интервал выглядит как доказанное появление/исчезновение Worker. Это не подтверждает ни target lifecycle, ни OS process exit.
- CDP `Target.getTargets`, `SystemInfo.getProcessInfo` и Linux `/proc` имеют независимую доступность; ошибка первого API не должна отключать остальные.

## Scope / критерии приёмки

- [x] `tools/browser-worker-target-census.mjs`: `noteMissingSnapshot(phase)` сохраняет историю известных ID, но снимает знание о видимости на финальном снимке и разрывает сравнение с последним успешным снимком.
- [x] `observedAtLastSnapshot`, `observedAtLastSnapshotCount`, `noLongerObservedAtLastSnapshotCount` получают `null`, если последняя попытка неуспешна, а не устаревшие булевы или 0.
- [x] При первом успешном снимке после gap новые/пропавшие targets в milestone обозначены `null` (unknown), а не 0 или число с выдуманным переходом. Успешные соседние poll продолжают обычный census.
- [x] `snapshotCoverage`: число успешных/пропущенных наблюдений, старт/финиш, adjacency, неизвестные интервалы и точные пропущенные milestone. В лог не копируются `url`/`title` targets.
- [x] `browser-renderer-heap-sampler`: независимый флаг `workerTargetsObserved` и пропущенный Target snapshot для каждой попытки, включая после единичного отказа CDP Target API; доступные PID/privateMemory/RSS замеры продолжают работать.
- [x] Generic heap milestone с неподходящим census phase безопасно фиксируется как `invalid-phase` и не роняет Chromium smoke или независимые PID чтения.
- [x] Регрессии: две подряд неуспешные попытки во время cancel→retry, пропущенный финал, успешный CDP процессный опрос при отказавшем Target домене.
- [x] **PR verification:** `npm run check` (включая целевые Node-регрессии), настоящий Chromium `file://` PSD16/PSB32, JSON artifacts, все профили, diff hygiene — [run 38526924226](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38526924226), success.
- [ ] **Merge + exact-main CI:** до успешного main push workflow проходка не считается закрытой.

## Ограничения и следующий шаг

- `workerPidMapping: 'unknown'` остаётся принципиальным: в имеющихся ответах двух CDP методов нет доказательного ключа join targetId→OS PID. Target disappearance в успешном новом наблюдении не доказывает завершение потока/процесса.
- `snapshotCoverage` измеряет наблюдение, **не** истинный peak RAM, lifetime Worker или наличие кратковременных targets между polls.
- **P0 / [002](002-psd-compatibility-corpus.md):** independently licensed Adobe Photoshop-authored RGB16 PSD / CMYK32 PSB + provenance, hash, external render oracle; без фальшивых Golden.
- **P1 / [025](025-browser-worker-target-census.md):** задокументированный и доказательно валидированный CDP target→PID механизм либо оставить `unknown`.
- **P1 / [003](003-tiled-content-aware.md):** большие connected ROI и browser latency/RSS/quality на независимых high-depth fixtures. Общие Stage 002 и 003 пока открыты.

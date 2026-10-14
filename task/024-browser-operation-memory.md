## 024C1 / 026 — точный start/finish coverage при недоступном CDP или /proc (слито, 2026-10-14)

- [x] [026](026-browser-memory-sample-coverage.md), [PR #210](https://github.com/zeter1/ZeTer-Photo-Editor/pull/210) → `67e4451`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38522956593), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38523222466).
- [x] `baselinePrivateBytes` / `endPrivateBytes` и Linux RSS baseline/end отражают только **фактически полученный** первый/последний snapshot. При пропаже метрики `null`, а не последний старый отсчёт. `sampledIncreaseBytes` требует настоящую baseline.
- [x] `metricCoverage`: количества доступных/пропущенных опросов и missing milestones, отдельно CDP privateMemory и Linux RSS; перенос в timeline JSON и регрессионные тесты финального `/proc ENOENT`.
- [ ] **Следующая P1 / 024C2:** observation gaps/PID churn при cancel→retry с проверяемой полнотой; не путать target IDs, PID membership, Linux PID+starttime и доказанный exit.
- [ ] **P0 / [002](002-psd-compatibility-corpus.md):** независимые licensed Photoshop-authored high-depth goldens, hashes и Photoshop renders.
- Нет доказательства точного operation peak RAM, Worker→PID mapping или полной Photoshop-совместимости. Stage 002/003 открыты.

## 024B2b — завершена, слита в main, PR + exact-main CI success (2026-10-14)

- [x] **Для обоих** real Chromium `file://` ZeTer-generated PSD16 и PSB32 тестовый Blob добавляет after-write probe внутри настоящего native kernel, без изменения исходного Worker supplier на диске; отмена производится реальным UI lock во время CPU-stall, без готового reply.
- [x] Остановленный Worker не публикует результат: `completedReplies:0`, наблюдаемая остановка после настоящей записи (PSD16: 229ms, PSB32: 312ms от probe; единичные нестабильные CI timings), все serialized native tile dataUrl пословно совпадают, History не получает дополнительный Fill.
- [x] После разблокировки новый **неизменённый** Worker вычисляет заливку, публикует ровно одну новую Fill History запись; Undo возвращает **все** первоначальные native tile bytes, Redo восстанавливает **все** bytes результата.
- [x] Timeline/outcome и JSON-verifier требуют post-write cancellation **и** retry Undo/Redo evidence на PSD16/PSB32; memory limitations и Worker→PID=`unknown` сохраняются.
- [x] Gate: [PR #208](https://github.com/zeter1/ZeTer-Photo-Editor/pull/208) → squash `ad839ab6`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38518410697), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38518637139): 1196 Node, generated bundle parity, Chromium smoke, 2 JSON verification/upload, informational profiles, diff hygiene.
- [ ] **Следующий отдельный research-pass:** атрибуция CDP Worker→Linux PID только при документированном и тестируемом mapping; иначе `unknown`.
- **Ограничение:** Synthetic ZeTer PSD/PSB не заменяют Photoshop-authored golden, 6s spin — тестовая остановка, не RAM benchmark. Stage 002/003 остаются открыты.

## 024B2a — versioned browser operation JSON + final-snapshot process visibility (merged, PR CI success, 2026-10-11)

- [x] Produce `zpe-browser-operation-artifact-v1` files from actual Chromium `file://` PSD16 and PSB32 UI Worker smoke, with operation timeline, sample interval/window, available/unavailable metrics, PID+starttime per-incarnation observations, process churn, unchanged `unknown` Worker→PID mapping.
- [x] Do **not** call a missing PID a proven exit: `observedAtLastSnapshot`, `noLongerObservedAtLastSnapshotCount` and `provenExitCount:null`; test disappearance/reappearance with same starttime and PID reuse.
- [x] CI checks **both** report files and uploads them as an informational artifact, even when later steps fail (if files exist); no numeric performance gate, exact peak-RAM or fabricated `privateMemory`.
- [x] [PR #207](https://github.com/zeter1/ZeTer-Photo-Editor/pull/207) merged as `594295ad`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38166256448): Node, generated parity, real Chromium `file://`, required two JSON files/upload, native profiles, diff hygiene.
- [ ] Verify exact-main CI after documentation status sync.
- [x] **024B2b now merged:** real native in-kernel PSD16/PSB32 cancel→new Worker recovery, original native bitwise tile integrity and History ([PR #208](https://github.com/zeter1/ZeTer-Photo-Editor/pull/208)); independent CDP target→PID attribution remains unproven.

## 024B1 — PID+starttime samples (merged, PR + exact-main CI success, 2026-10-11)

- [x] Parse /proc/<pid>/stat field 22 with nested/whitespace comm and arbitrary-size starttime; reject absent/malformed data.
- [x] Read stat before/after VmRSS/VmHWM and fail an unstable/reused PID rather than associating mixed samples.
- [x] Track per-incarnation observed RSS and lifetime VmHWM, PID reuse between samples, missing/arriving identities; keep CDP process type separate from unsupported Worker→PID mapping.
- [x] Carry identity report into operation timeline. Invalid/unsupported identity is explicit unavailable, never an invented peak.
- [x] Deterministic tests for same-PID different starttimes, missing /proc, precision, full sampler-to-report integration.
- [x] [PR #206](https://github.com/zeter1/ZeTer-Photo-Editor/pull/206) merged as `dec6db5f`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38165437542) and [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38165563357): Node tests, generated parity, real Chromium `file://`, native profiles, diff hygiene. **The broader 024B is not completed.**

### Next 024B2 (open)

1. Instrument real Chromium `file://` PSD16 and PSB32 native Worker **mid-kernel** cancel→recovery in one operation timeline, including unchanged native byte/History evidence after cancel and successful new Worker job.
2. Attempt CDP target/process mapping only with a documented, tested source; otherwise retain `workerPidMapping: unknown`. Distinguish observed disappearance from proven exit.
3. Export versioned JSON artifacts from browser CI with operation ID, sampler interval, per-incarnation memory observations, missing metrics and timeline, without unsupported peak-RAM/performance claims.
4. Verify Node, real Chromium, artifacts, PR and exact-main CI; then update this status and [NEXT](NEXT.md).

## Проходка 024A — завершена и слита в main, CI success (2026-10-11)

- [x] `tools/browser-operation-timeline.mjs`: детерминированный `operationId`, монотонные отметки import/preview/native verification/selection/Fill/history/Undo/Redo; наблюдаемое время этапов (не точное время вычисления ядра).
- [x] Реальные Chromium `file://` ZeTer-generated PSD16/PSB32 Worker smoke выводят operation timeline и отдельный `completed-with-cancelled-retry` outcome **только после** доказанной отмены, неизменных native samples и History. Production code не менялся.
- [x] Самплер CDP дополнен отдельными PID observations: новые/отсутствующие между samples PID, process type maxima, неопределённая Worker→PID привязка и явное замечание про PID reuse. Эти числа **не** складывают VmHWM и не доказывают истинный peak.
- [x] Регрессионные тесты для времени/исхода, PID churn и unavailable path.
- [x] [PR #205](https://github.com/zeter1/ZeTer-Photo-Editor/pull/205) слит в `main` (`47045507`). [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38164350321) + [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38164497873): Node, generated parity, Chromium `file://`, informational profiles, diff hygiene.

**Фактический CI baseline 024A:** PSD16 — 61 sampled observations, около 470 мс input→preview и 643 мс Fill command→History preview; PSB32 — 126 sampled observations, около 682 мс input→preview и 1933 мс Fill→History preview. Это нестабильные информационные замеры одного CI-прогона, **не** пороги производительности, Worker kernel timing или доказательство пика RAM. CDP privateMemory в данном прогоне не предоставлялся.

**Следующая 024B (открыта):** Linux `/proc/PID/stat` starttime для PID identity/reuse, process exit accounting, per-PID sampled RSS/HWM, CDP target mapping; отдельный настоящий mid-kernel cancellation + recovery lifecycle для high-depth PSD/PSB; машинный файл с CI отчётами. Нельзя объявлять summed process HWM пиком операции.

# 024 / 010E-B4 — browser operation-wide timing and memory attribution

**Статус:** 024A и 024B1 завершены в `main`, PR и exact-code main CI успешно пройдены; 024B2, Stage 002/003 остаются открыты.

## Цель

Связать один реальный `file://` PSD16/PSB32 → native Worker Content-Aware Fill → private preview/publish → Undo/Redo с измерениями **времени всего действия** и памяти Chromium. Нынешний [019](019-browser-linux-rss.md) собирает RSS и per-PID HWM по отдельным снимкам, но не атрибутирует весь lifecycle конкретному Worker.

## План следующей инженерной проходки

1. Зафиксировать детерминированный `operationId` / временные границы UI: начало (после выбора источника), selection freeze, dispatch, Worker ready, native kernel finished, preview PNG, history publish, Undo, Redo, отмена; помечать cancelled/failed без ложной метрики completed.
2. Записывать CDP target/process mapping + Linux PID/status `VmRSS`/`VmHWM` до/во время/после операции, включая **новые/исчезнувшие PID**; отдельно Chrome main/renderer/utility/Worker, если доступно. Невозможность прямого Worker→PID mapping явно отмечать `unknown`.
3. Отделить `jsHeapUsedSize`, `privateMemory` (только если браузер предоставляет), sampled RSS и process-lifetime HWM. Последние не доказывают peak RAM операции; исключить интерпретацию суммы VmHWM как одновременного пика.
4. Сценарии: ZeTer-generated RGB16 PSD и CMYKA Float32 PSB в настоящем Chromium `file://`, успех, mid-kernel cancel, возобновление нового job и независимая Undo/Redo. Сверить immutable native little-endian words и не публиковать stale session.
5. Выводить machine-readable JSON для CI (informational) с sample count, lost PID count, sampling interval, unavailable metrics, началом/концом каждой фазы и peak *observed sample* для tracked PID. Не вводить случайные числовые performance gates.

## Критерии готовности

- [ ] Путь реально проходит `file://` Worker, не Node-only профилировщик.
- [ ] В тестах различаются operation duration, sampled RSS и per-process lifetime HWM.
- [ ] Проверено восстановление после отмены и native output parity.
- [ ] Linux отсутствует/нет /proc/CDP metric → аккуратная деградация, а не фиктивное число.
- [ ] `npm run check`, `npm run test:browser`, generated parity, CI и exact-main gate успешны.

## Параллельная P0

[002](002-psd-compatibility-corpus.md): independently Photoshop-authored licensed RGB16/CMYK32 PSD/PSB, эталонные рендеры, SHA-256/provenance. Настоящая широкая Photoshop compatibility этим профилем не закрывается.

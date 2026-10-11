## 024B1 — PID+starttime samples (code in PR branch; CI pending, 2026-10-11)

- [x] Parse /proc/<pid>/stat field 22 with nested/whitespace comm and arbitrary-size starttime; reject absent/malformed data.
- [x] Read stat before/after VmRSS/VmHWM and fail an unstable/reused PID rather than associating mixed samples.
- [x] Track per-incarnation observed RSS and lifetime VmHWM, PID reuse between samples, missing/arriving identities; keep CDP process type separate from unsupported Worker→PID mapping.
- [x] Carry identity report into operation timeline. Invalid/unsupported identity is explicit unavailable, never an invented peak.
- [x] Deterministic tests for same-PID different starttimes, missing /proc, precision, full sampler-to-report integration.
- [ ] PR CI, exact-main CI after merge. **The broader 024B is not completed.**

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

**Статус:** 024A завершена в `main`, PR и exact-main CI успешно пройдены; 024B, Stage 002/003 остаются открыты.

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

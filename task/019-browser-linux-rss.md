# 019 / 010E-M — Linux Chromium RSS + per-PID HWM instrumentation

**Статус: завершена малая инструментальная проходка, слита в `main` (2026-10-11).** [PR #200](https://github.com/zeter1/ZeTer-Photo-Editor/pull/200), squash `1d8e6fbc`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38155212317).

## Задача
Параллельный P1 подэтап Stage 003: дополнить существующий Stage 003 реальный Chromium `file://` UI Worker/preview/Undo/Redo информационными Linux /proc метриками. Не менять production bundle. Не путать выбранный максимум с истинным peak.

## Реализация и проверка
- [x] `tools/browser-linux-process-rss.mjs`: CDP `SystemInfo.getProcessInfo` PID list → validate unique positive PID → прочитать `/proc/<pid>/status` `VmRSS` и `VmHWM`, отвергать missing/partial/negative/overflow.
- [x] `tools/browser-renderer-heap-sampler.mjs`: самостоятельное поле `linuxProcessRss` в информационном отчёте уже работающего Chromium `file://` сценария (без изменения пользовательского кода), sampled aggregate VmRSS + наибольший наблюдавшийся individual VmHWM. Несовместимая ОС, закрывшийся PID и отсутствие CDP счётчика = `unavailable`, **не** ноль и не вывод ложного peak.
- [x] Unit test: арифметика, PID validation, отказ при пропущенном или исчезнувшем PID, fallback без потери privateMemory/renderer heap, lifecycle между этапами.
- [x] CI: `npm run check`, `npm run test:browser`, generated artifact parity, diff hygiene — PASS в [PR run #38155212317](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38155212317).
- [x] PR review/merge в `main`: [#200](https://github.com/zeter1/ZeTer-Photo-Editor/pull/200), squash `1d8e6fbc`; push-CI проверяется отдельно на финальном SHA ветки `main`.

## Фактический Linux Chromium CI baseline

Во время реального Chrome `file://` UI Worker/Preview/Undo/Redo smoke получено **11 Linux RSS snapshots**, `baselineAggregateRssBytes = sampledMaxAggregateRssBytes = 1315647488`, `endAggregateRssBytes = 1273528320`, `maxObservedIndividualProcessHwmBytes = 305303552`. При этом CDP `privateMemory` оказался недоступен; Linux RSS независимо собрался. Числа — информационные, включают браузерный процессный набор и запуск smoke, **не** изолированный расход Content-Aware Fill и **не** доказанный пик. Нестабильные числовые thresholds не вводятся.

## Границы измерения
`VmRSS` читается для каждого процесса **последовательно**. CDP сообщает идентификаторы процессов Chromium; aggregate не атомарен, не покрывает GPU memory allocation вне RSS, не гарантирует выборку фактического peak и не измеряет отдельно Worker. `VmHWM` — high-water-mark **одного PID**, **не** сумма пиков и не high-water-mark целой операции. Во время реальных операций короткоживущий Chromium PID может завершиться до чтения /proc: тогда Linux-счётчик помечается unavailable. Не устанавливать flaky perf thresholds в CI.

## Следующее
- **010E-B / главный P1:** адаптивные horizontal runs и connected clusters поверх fixed-grid с bounded planner work и worst-case отказом; native RGB16/CMYKA32 exact Worker/cooperative parity и cancellation.
- **Browser deep memory:** OS-level peak accounting всей дочерней Chromium process tree с безопасным tracking PID lifetime/starttime, репетируемым high-depth PSD16/PSB32 stress, сопоставлением sampled /proc и CDP; не называть этот 019 этап завершённым real browser peak.
- **P0 002:** независимые лицензированные Adobe Photoshop-authored high-depth RGB16/CMYK32 PSD/PSB + reference renders, provenance, SHA256.

Stage 002/003 остаются открыты.

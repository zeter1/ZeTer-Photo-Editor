# 019 / 010E-M — Linux Chromium RSS + per-PID HWM instrumentation

**Статус: реализация в рабочей ветке, gate/merge не подтверждены (2026-10-11).**

## Задача
Параллельный P1 подэтап Stage 003: дополнить существующий Stage 003 реальный Chromium `file://` UI Worker/preview/Undo/Redo информационными Linux /proc метриками. Не менять production bundle. Не путать выбранный максимум с истинным peak.

## Реализация и проверка
- [x] `tools/browser-linux-process-rss.mjs`: CDP `SystemInfo.getProcessInfo` PID list → validate unique positive PID → прочитать `/proc/<pid>/status` `VmRSS` и `VmHWM`, отвергать missing/partial/negative/overflow.
- [x] `tools/browser-renderer-heap-sampler.mjs`: самостоятельное поле `linuxProcessRss` в информационном отчёте уже работающего Chromium `file://` сценария (без изменения пользовательского кода), sampled aggregate VmRSS + наибольший наблюдавшийся individual VmHWM. Несовместимая ОС, закрывшийся PID и отсутствие CDP счётчика = `unavailable`, **не** ноль и не вывод ложного peak.
- [x] Unit test: арифметика, PID validation, отказ при пропущенном или исчезнувшем PID, fallback без потери privateMemory/renderer heap, lifecycle между этапами.
- [ ] CI: `npm run check`, `npm run test:browser`, generated artifact parity, diff check; записать конкретный run URL.
- [ ] Review/merge в `main`, exact-main push CI; только после этих доказательств отметить задачу завершённой.

## Границы измерения
`VmRSS` читается для каждого процесса **последовательно**. CDP сообщает идентификаторы процессов Chromium; aggregate не атомарен, не покрывает GPU memory allocation вне RSS, не гарантирует выборку фактического peak и не измеряет отдельно Worker. `VmHWM` — high-water-mark **одного PID**, **не** сумма пиков и не high-water-mark целой операции. Во время реальных операций короткоживущий Chromium PID может завершиться до чтения /proc: тогда Linux-счётчик помечается unavailable. Не устанавливать flaky perf thresholds в CI.

## Следующее
- **010E-B / главный P1:** адаптивные horizontal runs и connected clusters поверх fixed-grid с bounded planner work и worst-case отказом; native RGB16/CMYKA32 exact Worker/cooperative parity и cancellation.
- **Browser deep memory:** OS-level peak accounting всей дочерней Chromium process tree с безопасным tracking PID lifetime/starttime, репетируемым high-depth PSD16/PSB32 stress, сопоставлением sampled /proc и CDP; не называть этот 019 этап завершённым real browser peak.
- **P0 002:** независимые лицензированные Adobe Photoshop-authored high-depth RGB16/CMYK32 PSD/PSB + reference renders, provenance, SHA256.

Stage 002/003 остаются открыты.

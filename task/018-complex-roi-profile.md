# 018 / 010E-A — сложная связная ROI: native Worker, строгие бюджеты и Node memory baseline

**Статус: реализация в ветке, проверка и merge ещё требуются (2026-10-11).** Следующая малая P1-проходка после [017](017-dual-native-psb32-session-isolation.md); общий Stage 003 **остаётся в работе**.

## Цель и границы

Подготовить воспроизводимый тест worst-case плотного связного выделения для дальнейшего 010E adaptive planner. Задача не добавляет новую пользовательскую функцию, не меняет production source или generated bundle; это регрессия native backend, real Node Worker и baseline memory.

- [x] Новый `tools/profile-complex-roi.mjs`: два независимых процесса для Uint16 RGB и Float32 CMYKA, native v2 source с tileSize=4 (4096 плиток).
- [x] Составная маска: две независимые плотные области 64×64 **соединены** диагональным коридором из 96 пикселей; суммарно 8288 выбранных пикселей и >256 затронутых плиток.
- [x] Global padded bounding ROI >53k px и заведомо больше выбранного лимита 25k px. Нельзя безусловно обрабатывать глобальный прямоугольник или каждый tile с независимым огромным halo.
- [x] Прогон штатного синхронного engine и настоящего `worker_threads` (не имитация reply): exact native tile payload parity, UInt16/Float32 sample oracle, неизменность всех невыбранных native samples и alpha, неизменность входных tile payloads.
- [x] Atomic отказ при лимите 1000 px, отмена cooperative вычисления после контрольных yield: никакой частичной публикации, unchanged input source.
- [x] Измерения времени fixture/sync/Worker и RSS / parent heap / ArrayBuffers / Linux process HWM по фазам. Это **process-wide memory observations**, не isolated Worker heap, не максимальная память browser process и не peak конкретной операции.
- [x] Node регрессия `tests/tiled-inpaint-complex-roi-profile.test.mjs` и негативные CLI-варианты.

## Приёмочные критерии до слова «готово»

- [ ] `npm run check` и `npm run test:browser` в CI для **точной ветки**; bundle/generated parity; diff hygiene.
- [ ] PR review, merge в `main`, зелёный CI **точного main SHA**.
- [ ] Обновить README/NEXT/этот чеклист ссылками на реальные PR/CI/merge SHA.

## 010E-B — следующая инженерная проходка

Добавить и сравнить с фиксированной сегментной сеткой **адаптивные горизонтальные runs / connected clusters** для нескольких разнесённых плотных групп в одной полосе, включая группы на границе сегментов. Ввести ограниченный planning work budget и выбор результата по aggregate halo-area (не ценой неограниченного N² или повторных сканирований), передать общий deterministic plan в Node/Worker/cooperative. Acceptance: случаи, где фиксированные x-сегменты отвергают корректную ограниченную ROI, но adaptive plan укладывается; exact RGB16 и CMYKA32 byte parity, Frozen donor exclusion, worst-case fragmentation отказ, cancellation и memory/latency сравнение с этим профилем.

## Осталось за пределами этой проходки

- P0 [002](002-psd-compatibility-corpus.md): лицензированные независимо Adobe Photoshop-authored RGB16/CMYK32 PSD/PSB, происхождение, SHA256 и Photoshop reference renders.
- P1: реальный Chromium `file://` Worker/process peak RSS (и отдельное сравнение с sampled CDP counters), сценарии больших PSD/PSB по сложной ROI, внедрение 010E-B.
- P2: производительный CMYK ICC/soft proof, RAW, Adobe compatibility и качество Refine/Content-Aware; Stage 002/003 не закрывать.

# Stage 003 — native Worker byte-integrity profiling (проходка 2026-10-11)

## Цель и доказательство

- [x] Добавить отдельный **Node worker_threads** профиль для synthetic RGB16 и Float32 CMYKA.
- [x] Детерминированный дефект рядом с границей 128 px tile; проверить immutable source, ровно один изменённый selected pixel/tile, one-shot selection scan.
- [x] Сравнить каждый возвращённый native tile payload с синхронным frozen-index oracle на уровне canonical bytes; сравнение не ограничивать RGBA8 preview.
- [x] Изолировать каждый профиль в отдельном Node-процессе и выводить JSON: fixture setup, Worker roundtrip включая scan/dispatch, oracle, process RSS snapshots/parent heap.
- [x] Отсутствие неустойчивых performance thresholds; строгие тесты CLI/args и обеих глубин.
- [ ] PR CI, review, merge и зелёный CI конкретного SHA ветки main — **ещё не подтверждены**.

## Запуск

`node tools/profile-native-worker-integrity.mjs --sizes 1 --models rgb16,cmyka32`

По умолчанию размеры `8,24,48` MiB; каждый случай запускается в своём child process. Node 24; `npm run check` выполняет маленький 1 MiB diagnostic-regression. CI отдельно запускает 8 MiB информативный профиль.

## Чего профиль НЕ доказывает

- Данные сгенерированы ZeTer, а не Adobe Photoshop; независимые PSD16/PSB32, лицензии и Adobe render reference по-прежнему нужны для Stage 002.
- Оракул использует тот же математический native kernel, поэтому это **тест транспортной и byte-согласованности**, а не независимая проверка пикселей Photoshop.
- `process.memoryUsage().rss` — только снимки process-wide RSS; JS heap относится к main Node thread, не к Worker. Linux HWM включает всё время жизни процесса, а не только Worker. Нельзя называть это **peak browser RAM**.
- Нет Chromium `file://`, UI preview, Undo/Redo и cancellation lifecycle: все остаются в Stage 003.
- Большой связный ROI по-прежнему требует разделения на bounded chunks и исключения исходных selection donors; эта проходка его не реализует.

## Следующие задачи (в порядке исполнения)

1. Проверить PR CI и зелёный `main` CI после merge, затем отметить gate завершённым без завышения claims.
2. Сделать bounded wide-connected ROI planner: source-original donors исключены глобально, раздельные target subsets, aggregate budget, all-or-none publication и deterministic sync/Worker/cooperative tests.
3. Chromium `file://` PSD16/PSB32 → Worker → preview → Undo/Redo/cancel + CDP process/renderer sampled memory/latency, отдельно от Node baseline.
4. Реальный high-depth corpus с source URL, лицензией, SHA-256, независимо Photoshop-authored и независимыми reference renders.

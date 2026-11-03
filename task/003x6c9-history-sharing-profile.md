# 003X/6c-9 — real large History pooling memory/latency profile

**Приоритет:** P1. **Статус:** IN PROGRESS (production-fix candidate, Chrome A/B, PR/CI/merge ещё не приняты). **Зависимости:** 003X/6c-8. Parent 003X/Stage 6 IN PROGRESS; independent Adobe-authored PSB32 provenance 002B/2c BLOCKED.

## Цель
Измерить на больших RGB16/CMYKA32 Float32 documents реальную стоимость pooled native URL History: UI native source, separate History segments, reconstructed JSON transient, Undo/Redo CPU time, multiple document sessions and Worker input. Do not confuse unique pool byte count with total JS heap/RSS.

## Acceptance criteria
1. Identical baseline and pooled real Chrome file:// scenarios with the same Undo positions and original native samples.
2. Repeatable measurements of URL byte owner, non-native segments, reconstruction and GC/latency; true heap/RSS claims only with complete evidence.
3. Safe cancel/stale/session-close and workspace restore; exact .zpe v1/v2 and synthetic PSD16/PSB32 sNaN/-0/alpha oracles; document Adobe-provenance limitations.
4. Small verified code fix if a regression exists, otherwise document no-change decision.
5. Unit/browser regression, deterministic build, PR-head Linux 12-job core and separate real-photo CI, merge and exact-main proof; update task/NEXT.md, task/README.md and CHANGELOG.md.

Current: TODO. 003X/6c-8 unique pooled byte reduction alone does NOT prove RAM/RSS savings.
## Проходка 2026-11-03 — production-fix candidate, без принятия PR/CI

**Идентификатор:** 003X/6c-9. **Приоритет:** P1. **Статус:** IN PROGRESS. **Зависимость:** закрытая 003X/6c-8; Stage 6/003X IN PROGRESS. **Критерии:** исходные пять acceptance criteria выше; реальные сравнительные Chrome file:// профили и PR/exact-main gates остаются открытыми.

**Обнаруженная корневая причина.** Pooled entry.snapshot рекомбинировал каждый native ASCII Uint8Array через 8192-element String.fromCharCode spreads. Для больших RGB16/CMYKA32 Float32 документов это вызывало повторные дорогие JS конверсии при каждом Undo/Redo/restore; baseline generic snapshots просто читают готовую строку. Измерено в восьми отдельных Windows Node 24.13 процессах (RGB16/CMYKA32 Float32, 1025x1025, по два session с четырьмя Undo состояниями, 2 повтора с чередованием порядка). Среднее время однократного чтения pooled snapshot: RGB16 305.88 мс до / 5.03 мс после; CMYKA32 Float32 740.39 мс до / 11.68 мс после. Это среднее по пробам внутри повторов, **не** статистическая гарантия на иных устройствах или браузерах. Generic baseline snapshot ~0.01 мс; замена не меняет его.

**Реальная правка.** src/core/history.js реконструирует pooled immutable native ASCII URL в строку посредством встроенного TextDecoder('utf-8',{fatal:true}); если TextDecoder недоступен, сохраняется прежний fromUnits. Ненативные части JSON остаются Uint16Array с точными UTF-16, включая lone surrogate. Public entries[].snapshot, интернирование, счётчики, budget, Undo/Redo, branch/reset, JSON v1/v2 не меняются. Генерируемые src/app.bundle.js, index.html и version.json пересобраны, пакетные зависимости не добавлены.

**Код, регрессии и свидетельства:** src/core/history.js; tests/003x6c9-history-profile.test.mjs; tools/history-sharing-fixture.mjs; tools/history-profile-worker-thread.mjs; tools/profile-history-sharing-node.mjs; task/evidence/003x6c9-node-profile-before.json и 003x6c9-node-profile.json. Node-профиль выполняет настоящие production HistoryStack/session-navigation/Worker протокол, с отдельными Worker isolates и режимами complete/cancel/stale/session-close, но UI-порты Node не имеют настоящего браузерного рендера, а recovery проверена в памяти, не IndexedDB. В 8/8 случаях PASS. Порядок двух повторов чередуется.

**Память:** в точке retained-history после принудительной GC Node main-isolate heapUsed RGB16 baseline 112.9 MiB и pooled 27.4 MiB, CMYKA32 baseline 273.2 MiB и pooled 59.5 MiB. Это только измеренная Node метрика на отдельных процессах, не полная стоимость приложения, не предел RSS и не причинная оценка физических страниц. JS heap/external/arrayBuffers пересекаются, суммирование некорректно; Worker RSS разделяет процесс. Отдельное браузерное A/B сравнение ещё НЕ выполнено, GC и браузерный Worker PID/peak НЕ доказаны. Оригинальные данные синтетические; независимая Adobe-authored PSB32 provenance 002B/2c BLOCKED.

**Проверки:** focused tests 003X/6c-8 + 6c-9 **10/10 PASS**, включая независимый endian-packed raw bit oracle RGB16/v1,v2 и CMYKA32 Float32/v1,v2 (sNaN/-0/alpha), exact JSON и Undo/Redo/branch/clear, UTF-16 fallback contract; full Windows npm run check **1568 PASS / 10 SKIP / 5 FAIL** — пять существующих Linux-only /proc/cgroup fixtures не совместимы с Windows, не выдавать за полный green. Genuine Chrome `file://` **npm run test:browser PASS** (не A/B профиль). Deterministic npm run build повторён, app.bundle SHA256 `EDB440080152F5304953EDB808594B60AB80BE8E2D6622034BE8EACFFBA32919`, manifest `d69dba9bf64adb1d`.

**GitHub:** ветка perf/003x6c9-history-profile-20261103 от main 26ce263, commit/PR ссылки и exact PR-head CI указывать только после фактического появления; до них candidate без merge. **Следующий конкретный шаг внутри 003X/6c-9:** выполнить воспроизводимый same-fixture, fresh-process real Chrome file:// baseline vs pooled A/B, полный session persistence/Worker memory и latency; изучить regression; запустить PR-head Linux core 12 jobs + independent real-photo, merge только после green, проверить exact-main core + real-photo. Затем закрыть 6c-9 и выбрать следующую незавершённую задачу.

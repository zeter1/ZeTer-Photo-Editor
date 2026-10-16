# 037C-3a — Chromium real-photo observational memory (ЗАКРЫТА 2026-10-16)

Приоритет: P1, после закрытой 037C-2. Это часть 037C-3, а не закрытие всех возможностей Photoshop.

**Итоговые доказательства:** [PR #249](https://github.com/zeter1/ZeTer-Photo-Editor/pull/249) → [e245d36](https://github.com/zeter1/ZeTer-Photo-Editor/commit/e245d36b94e29cc7687e1247f200dc26db3e906f), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38847800247), [PR photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38847800306), [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38848104813), [exact-main photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38848104811): все success. На exact-main 6/6 Worker JSON + 6/6 memory JSON верны; PSD16 sampled 209/209/211, PSB32 312/308/311; Linux RSS sampled только в PSD16 run 2/3, unavailable в 4 сессиях. Никакого гарантированного RSS peak и Worker↔PID join не наблюдали.

## Реализация (слита в main)

- [x] После настоящего file:// импорта PSD16/PSB32 и внутри того же процесса Chromium запускать CDP renderer heap sampler и опциональные `SystemInfo.getProcessInfo`, Linux `/proc`, Worker target census.
- [x] Отдельный sampler snapshot после импорта и по точкам Worker Fill → Undo → Redo → reopen; ни одно значение не является «реальным пиком RAM».
- [x] Записывать `real-photo-psd16-memory-run-{1,2,3}.json` и `real-photo-psb32-memory-run-{1,2,3}.json`, никогда не смешивать с pinned photo quality receipt.
- [x] Fail-closed offline validator по шести наблюдениям, отрицательные unit-тесты: фальшивые peak, PID, forged coverage, malformed max, изменение source Worker identity.
- [x] Включить проверки в separate `real-photo-intake.yml` и общий `npm test`.

## Приёмка выполнена; следующий шаг

- [x] PR CI + genuine-photo CI green на точном head, шесть memory receipts прошли verifier. Linux RSS подтверждён только частично — 2/6 run на main.
- [x] После merge exact-main CI и photo CI green на e245d36, ссылки внесены в `task/NEXT.md` и `task/README.md`.
- [ ] 037C-3b: реальные negative Chromium сценарии abort, tab switch, close, stale-owner, malformed native bytes, worker memory cap и late replies с запретом stale publication.
- [ ] 037C-3c: итоговая CI acceptance. Отдельно P0 Photoshop-authored corpus 002, Stage 003 и оставшийся roadmap: smart objects, виртуальная tiled persistence, глубина/CMYK/ICC/RAW/AI.

## Границы доказательства

Снимки JS heap / CDP privateMemory / Linux VmRSS относятся к наблюдаемым процессам, а не к изолированному Worker. Missingness и отсутствие подтверждённого target→PID join обозначаются unknown. `sampledMaxAggregateRssBytes` — верхняя наблюдённая *выборка*, а не истинный максимальный расход RAM. Нет Adobe parity, sensor-native HDR/32-bit или полноценного inpainting benchmark на любой фотографии.

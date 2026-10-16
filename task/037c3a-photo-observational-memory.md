# 037C-3a — Chromium real-photo observational memory (НЕ закрыта до CI)

Приоритет: P1, после закрытой 037C-2. Это часть 037C-3, а не закрытие всех возможностей Photoshop.

## Реализация в этой ветке

- [x] После настоящего file:// импорта PSD16/PSB32 и внутри того же процесса Chromium запускать CDP renderer heap sampler и опциональные `SystemInfo.getProcessInfo`, Linux `/proc`, Worker target census.
- [x] Отдельный sampler snapshot после импорта и по точкам Worker Fill → Undo → Redo → reopen; ни одно значение не является «реальным пиком RAM».
- [x] Записывать `real-photo-psd16-memory-run-{1,2,3}.json` и `real-photo-psb32-memory-run-{1,2,3}.json`, никогда не смешивать с pinned photo quality receipt.
- [x] Fail-closed offline validator по шести наблюдениям, отрицательные unit-тесты: фальшивые peak, PID, forged coverage, malformed max, изменение source Worker identity.
- [x] Включить проверки в separate `real-photo-intake.yml` и общий `npm test`.

## Незакрытые критерии и следующий шаг

- [ ] Подтвердить green обычный PR CI и genuine-photo CI на **точно** этом commit; скачать/review 6 memory receipts. Не объявлять опциональный Linux RSS доступным, пока этого не видно в реальных артефактах.
- [ ] После merge подтвердить exact-main CI и занести фактические ссылки/статус в `task/NEXT.md` и `task/README.md`.
- [ ] 037C-3b: реальные negative Chromium сценарии abort, tab switch, close, stale-owner, malformed native bytes, worker memory cap и late replies с запретом stale publication.
- [ ] 037C-3c: итоговая CI acceptance. Отдельно P0 Photoshop-authored corpus 002, Stage 003 и оставшийся roadmap: smart objects, виртуальная tiled persistence, глубина/CMYK/ICC/RAW/AI.

## Границы доказательства

Снимки JS heap / CDP privateMemory / Linux VmRSS относятся к наблюдаемым процессам, а не к изолированному Worker. Missingness и отсутствие подтверждённого target→PID join обозначаются unknown. `sampledMaxAggregateRssBytes` — верхняя наблюдённая *выборка*, а не истинный максимальный расход RAM. Нет Adobe parity, sensor-native HDR/32-bit или полноценного inpainting benchmark на любой фотографии.

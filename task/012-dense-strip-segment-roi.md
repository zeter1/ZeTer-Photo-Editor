# 010C — Stage 003: bounded dense ROI strip/segment fallback

**Статус: код и регрессионные тесты в ветке `feat/stage003-dense-strip-segment-roi-010c`; PR / CI / merge ещё требуют проверки.** Задача продолжает [010](010-dense-roi-worker-mid-kernel-cancel.md) после 010A/010B и не означает завершение Stage 003.

## Что меняется

- Когда global padded ROI выходит за `maxLayerPixels`, старое halo-disjoint/group и tile fragment планирование остаётся первым выбором; только после исчерпания этих вариантов используется **bounded deterministic horizontal strip + x-segment fallback**.
- Кандидаты: полосы 32/64/128/256 px по высоте и горизонтальные сегменты 128/256/вся ширина px. Для каждого кандидата собираются только bounds; максимум **256 рабочих групп**, одна серия index arrays создаётся только для выбранного плана. Выбирается минимальная суммарная площадь, при равенстве — меньшее число групп.
- Все рабочие области учитываются **до** вычисления и имеют общий строгий `maxLayerPixels`. Global frozen selection bitmap исключает исходные выделенные пиксели из donor и PatchMatch-контекста независимо от перекрытия halo и предшествующих приватных записей.
- Индексы каждой рабочей области используются ровно один раз. Группы выполняются в пространственном порядке, вычисление и сериализация остаются приватными до атомарной publication. Отмена cooperative/Worker и ошибки бюджета не создают частичных dirty tiles/History.
- Изолированные плотные RGB16 / Float32 CMYKA islands при tileSize=4 занимают >256 cells: общий padded bbox и tile fragments превышают 12k cap, strip/segment plan укладывается. Проверяются byte oracle, сохранность unselected native samples/tiles, sync/cooperative/real Node Worker exact parity, fail-closed для 9k budget и отмена.

## Gate этой проходки

- [x] Код bounded planner и тестовый файл `tests/tiled-inpaint-dense-strips.test.mjs` внесены в ветку.
- [x] Генераторные браузерные артефакты `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json` синхронизированы в ветке; точную parity должен подтвердить CI.
- [ ] `npm run check`, `npm run test:browser`, generated parity, `git diff --check` — подтвердить через CI.
- [ ] Review, merge в main и **CI точного main SHA**; до этого статус «в работе».

## Следующие проходки

1. **010D / Browser UI real lock/session revocation**: настоящий большой native PSD16/PSB32 → Worker mid-kernel, изменение lock/active document во время исполнения, отсутствие preview/history publication, next-job recovery, telemetry Worker/process RSS (sampled max ≠ true peak).
2. **010E / Adaptive complex ROI**: несколько плотных кластеров внутри одной широкой полосы, горизонтальные runs/connected segments вместо фиксированной сетки, worst-case fragmentation и bounded per-region memory/profiling. Отдельный смарт-выбор плана с лимитом времени planning.
3. **P0 Stage 002**: независимые лицензированные Adobe Photoshop-authored PSD16/PSB32 и reference renders, checksum + проверенное происхождение; не подменять ZeTer-generated files.
4. **P1 Stage 003**: browser peak memory, cross-app PSD parity и large-file Undo/Redo на real fixtures, plus RAW/ICC/CMYK/selection quality followups из [NEXT](NEXT.md).

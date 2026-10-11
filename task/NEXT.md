## Проходка 009 — PSB32 / cancellation (код подготовлен, CI НЕ подтверждён)

- [009](009-large-psb32-worker-cancellation.md) — в `test/stage003-large-psb32-worker-cancel-20261011` подготовлены большая ZeTer-generated PSB32 Float32 fixture, native v2 sample/bit-oracle, Chromium file:// Worker + Undo/Redo и детерминированная stale-reply отмена через UI layer lock.
- **Статус: в работе.** Не считать доказанной проверку браузера до PR/main CI. Отмена покрывает pending Worker reply после вычисления; **не** доказывает mid-kernel termination/peak RSS.
- **Следующее:** CI/review/merge + exact-main gate; затем dense ROI и mid-kernel cancel, Stage 002 independently Adobe-authored high-depth fixture, реальный peak RAM.

## Завершённая проходка 008 — большой PSD16 → v2 Worker в Chromium file:// (2026-10-11)

- [008](008-browser-large-psd16-worker.md) — новый тест реального браузерного пути: ZeTer-generated 1025×1025 RGBA16 PSD (>8 MiB) → file input → adaptive tiled v2 → точный Save Project native byte oracle → Worker Content-Aware Fill → preview/Undo/Redo + sampled CDP memory.
- **Готово, слито и проверено:** [PR #188](https://github.com/zeter1/ZeTer-Photo-Editor/pull/188), squash f172168cbbda02ecded76818055164b63eca5ac3; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142325168); [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142408685). Это НЕ независимая Photoshop-authored fixture, не PSB32 end-to-end, не доказательство peak RAM и не Stage 003 done.
- **После 008:** [009](009-large-psb32-worker-cancellation.md) — >8 MiB PSB Float32/CMYK с реальной отменой Worker на UI; затем adaptive dense ROI strip/segment, повторяемые browser/process memory profiles. Stage 002 independent corpus (P0) параллельно.

# Очередь реализации по скриншотам (актуализация 2026-10-11)

Источник статуса — `main` и реальные тестовые доказательства, а не обещание «Photoshop parity».
Подробные дневники: [002](002-psd-compatibility-corpus.md), [003](003-tiled-content-aware.md).

## Завершённая проходка 007 — file:// PSD16/PSB32 import precision (2026-10-11)

- [007](007-browser-psd-psb-ui-import.md): тестовый ZeTer-generated PSD16 и PSB32 → настоящий UI `#fileInput` → high-depth import → canvas preview → File > Save Project → точный native little-endian sample oracle из сохранённого `.zpe`.
- **Готово и слито:** [PR #187](https://github.com/zeter1/ZeTer-Photo-Editor/pull/187), squash `c3fd57a807e941676f6b8b50b240a93537829bad`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137491812), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137556394). 1151 Node-тест, generated parity, Chromium `file://`, профили и diff hygiene.
- **Не закрыто:** большой PSD16/PSB32 → v2 tiled Worker → preview → Undo/Redo/cancellation, memory peak; лицензированный независимый Adobe Photoshop-authored high-depth golden. `Stage 002/003` остаются в работе.
- **Следующая исполнимая задача:** браузерный сквозной v2 import→Worker при >8 MiB с memory samples и атомарной отменой; затем adaptive dense ROI strip/segment grouping с aggregate budget. Внешний Stage 002 corpus — параллельный P0.

## Что считать готовым

- [x] Базовая v2-модель документов/слоёв, raster/vector masks, adjustment layers,
  редактирование Bézier, базовый PSD/PSB импорт/экспорт, Smart Objects,
  native RGB/CMYK 16/32-bit, ICC, selection refinement и bounded Content-Aware Fill
  уже имеют реализацию и регрессии в `main`. Это **не** означает полной Adobe-совместимости.
- [ ] Полная cross-app и pixel parity Photoshop с независимо полученными high-depth файлами.
- [ ] Масштабируемые широкие выделения, проверенная пиковая память браузера, отмена,
  Undo/Redo на больших PSD/PSB без блокировки UI.
- [ ] Production-quality RAW/DNG и универсальный gamut/soft-proof workflow.
- [ ] Дополнительное качество Selection/Refine/Inpaint, реальные GPU/ML ускорения.

## Завершённая малая проходка — P1 native Worker byte profile (2026-10-11)

- Инструмент: [004-native-worker-byte-integrity-profile.md](004-native-worker-byte-integrity-profile.md); `tools/profile-native-worker-integrity.mjs`.
- **Готово и слито в `main`:** synthetic RGB16 и Float32 CMYKA Node Worker profiling, exact byte oracle, immutable native tiles, отдельный процесс на случай, memory/time snapshots и regression 1 MiB; CI запускает информационный 8 MiB профиль.
- **Gate подтверждён:** [PR #184](https://github.com/zeter1/ZeTer-Photo-Editor/pull/184) слит в `main` (`28ec5de2dbdd38e2782a8d5bc864a9dbdc0db5d2`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38133313481) и [точный `main` CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38133376298) — **success** (Node, Chromium `file://`, generated parity, 8 MiB diagnostics, diff hygiene). Нет browser peak RAM/Undo, лицензированного Photoshop PSD16/PSB32 и поддержки oversized connected ROI.
- **Следующий кодовый шаг:** bounded connected ROI с глобально исключёнными source selection donors. Затем Chromium `file://` Worker / preview / Undo / memory и Stage 002 внешний high-depth oracle.

## Завершённая проходка — P1 connected ROI fragments (2026-10-11)

- **Реализовано и слито:** [PR #185](https://github.com/zeter1/ZeTer-Photo-Editor/pull/185) → squash `1d18f525d62b03eb6734b883e94a8cc5642ca6a1`. Детали: [005](005-connected-roi-frozen-donors.md).
- Разреженные широкие связные выделения могут делиться на ограниченные native tile fragments при неудаче прежнего halo-disjoint плана. Глобальная замороженная bitmap запрещает все original-selection donors и PatchMatch-контекст; publish остаётся атомарным, source immutable и Worker/cooperative precision parity проверяется регрессиями.
- **Gate пройден:** [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135146345) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135223279) — **success** (Node, Chromium `file://`, generated bundle/Worker parity, профили, diff hygiene).
- **Открыто:** максимальное число 256 occupied tiles; связные плотные выделения/суммарный ROI свыше 8 MP отклоняются; нет browser end-to-end PSD16/PSB32 → UI Worker → preview → Undo/Redo/RAM или независимых Adobe pixel-goldens. Вся Stage 003 и Stage 002 остаются открытыми.

## Завершённая проходка 006 — >256 occupied native tiles (2026-10-11)

- [006](006-many-tile-bounded-fragments.md): снят прежний жёсткий отказ на 256 tile cells; для больших разреженных выделений включён безопасный per-cell fragment plan с global frozen donor exclusion и проверкой суммарного ROI бюджета.
- Добавлены отдельные regression fixtures RGB16 и Float32 CMYKA (512 cells, sync/cooperative/real Worker, out-of-budget, cancellation) и синхронизированы generated bundle/Worker.
- **Gate выполнен:** [PR #186](https://github.com/zeter1/ZeTer-Photo-Editor/pull/186) слит в main (`6204003f26f43b3babfa370508565f6ea86225e9`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136465952), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136526958). Это лишь bounded sparse-selection improvement, **не** поддержка всех плотных/больших ROI, не полноценная Stage 003, не внешний Photoshop high-depth golden.

## Ближайшие выполняемые проходки

| Приоритет | Следующая задача | Критерий приёмки |
|---|---|---|
| P0 | **Stage 002: внешний high-depth corpus.** Найти **независимо Adobe Photoshop-authored** RGB/CMYK PSD16 и PSB32 с правом распространения; записать исходный URL, лицензию, происхождение и SHA-256 без подмены синтетикой. | `tools/audit-external-high-depth-corpus.mjs` PASS на реальных файлах; экспертно проверены license/authorship; pinned manifest; без скачивания сомнительных assets в репозиторий. |
| P0 | **Stage 002 → 003: реальный cross-app oracle.** Выполнить decode/группы/маски/adjustment + внешние Photoshop render references (включая clipping/blend). | Сверка semantic + pixel snapshots, чёткий unsupported list, независимый от собственного PSD writer golden. |
| P1 | **Stage 003: adaptive dense ROI / strip-segment grouping после >256 sparse cells.** Расширить уже реализованные >256 sparse cells на плотные/сложные выделения через bounded strip/segment grouping; проверить aggregate area, memory ceilings и cancellation. | RGB16/Float32 CMYKA sync/Worker/cooperative parity, отмена в read/kernel/write/serialize, caps при worst-case связной маске, неизменность нетронутых байтов/тайлов. |
| P1 | **Stage 003: browser end-to-end.** Chromium `file://` PSD16/PSB32 → tiled Worker → preview → Undo/Redo; отдельно lifecycle cancellation. | Автоматизированный сценарий, sample renderer + Worker/process memory и latency (не выдавать snapshot за peak), повторяемость и минимум две глубины. |
| P1 | Profiling byte-integrity проверки Worker на крупных RGB16/Float32 CMYK PSD/PSB и real browser peak RAM. | Измерить overhead per changed tile, latency, max memory и сравнить с previous baseline; exact native byte parity + source immutability. |
| P2 | Документы в Smart Objects, сложная структура Photoshop, текст/layout и vector path interoperability. | Поштучные independent fixtures + exact round-trip regression. |
| P2 | Color management и 16/32-bit performance на больших файлах; CMYK preview/soft proof. | ICC reference сравнения, измерения до/после и тесты конверсий. |
| P3 | RAW/DNG pipeline (LibRaw WASM), затем Select & Mask/Content-Aware quality и GPU/ML. | Отдельные технические спецификации, права на sample fixtures и контролируемый memory budget. |

## Завершённая проходка — P1 native Worker pixel integrity (2026-10-11)

- **Gate выполнен:** [PR #183](https://github.com/zeter1/ZeTer-Photo-Editor/pull/183) слит в `main` (squash `884896cf6630083d5760a595c137157e1df7d874`). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38129441200) и [точный `main` push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38129498774) завершились **success**: Node, generated parity, Chromium `file://`, profiles, diff hygiene. Общая задача 003 **не завершена**.
- **Контракт:** v1/v2 native source допускает только канонический Base64 с правильной padding-позицией и нулевыми неиспользованными битами; для Worker reply сравнить реальные little-endian bytes **каждого пикселя изменённого тайла**, не только tile ownership. Все изменённые пиксели должны входить в frozen selection, а `changed` обязан равняться реальному числу изменённых пикселей. Гарантия независима от lossless/8-bit preview.
- **Бюджет:** один бит выделения на пиксель (до ~2 MiB при максимальном 48 MiB source); одновременно декодируются только два payload одного changed tile; unchanged tiles не декодируются.
- **Regression:** `tests/tiled-inpaint-ui-dispatch.test.mjs` — CMYKA Float32 и RGB16 unselected neighbor tamper, forged pixel counters, alternative Base64 bits; `tests/pixel-buffer.test.mjs` — v1/v2 source padding and alphabet validation.
- **Проверено:** CI на точном merge SHA; код в `main`. Этот P1 hardening-подэтап завершён, но не доказал end-to-end Photoshop-паритет на сторонних high-depth файлах.
- **Далее после gate:** connected-wide ROI planning с неизменными исходными донорами, затем Chromium Worker/Undo/Redo/RAM/latency на больших сторонних PSD16/PSB32; параллельно P0 независимый лицензированный Photoshop-authored corpus.

## Предыдущая завершённая проходка (ветка `feat/stage002-bounded-corpus-preflight-20261011`)

- [x] В аудиторе P0 ограничено чтение недоверенного manifest (1 MiB) и
  запрещены symlink/path swaps manifest.
- [x] Проверены минимальные каналы RGB (3) и CMYK (4), нижняя граница размера
  PSD (40 байт) и PSB (44 байта), добавлены негативные регрессии.
- [x] PR [#182](https://github.com/zeter1/ZeTer-Photo-Editor/pull/182) проверен и слит (`2033a10`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38128443224) и [точный main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38128545523) завершились **success**.
- [ ] Реальные Photoshop-authored PSD16/PSB32 **пока не получены**;
  эта проходка не закрывает 002 или 003.

### Правило отчётности

Выполнено = код + тесты + review + merge в `main` + зелёный CI **точного main SHA**.
До завершения всех gates помечать «в работе», не записывать «всё реализовано».

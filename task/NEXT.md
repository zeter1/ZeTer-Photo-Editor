# Очередь реализации по скриншотам (актуализация 2026-10-11)

Источник статуса — `main` и реальные тестовые доказательства, а не обещание «Photoshop parity».
Подробные дневники: [002](002-psd-compatibility-corpus.md), [003](003-tiled-content-aware.md).

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

## Текущая малая проходка — P1 native Worker byte profile (PR в работе)

- Инструмент: [004-native-worker-byte-integrity-profile.md](004-native-worker-byte-integrity-profile.md); `tools/profile-native-worker-integrity.mjs`.
- **Реализовано в ветке, ещё НЕ засчитано как готовое:** synthetic RGB16 и Float32 CMYKA Node Worker profiling, exact byte oracle, immutable native tiles, отдельный процесс на случай, memory/time snapshots и regression 1 MiB; CI запускает информационный 8 MiB профиль.
- **Gate открыт:** PR CI → review → merge → точный зелёный `main` CI. Нет browser peak RAM/Undo, лицензированного Photoshop PSD16/PSB32 и поддержки oversized connected ROI.
- **Следующий кодовый шаг:** bounded connected ROI с глобально исключёнными source selection donors. Затем Chromium `file://` Worker / preview / Undo / memory и Stage 002 внешний high-depth oracle.

## Ближайшие выполняемые проходки

| Приоритет | Следующая задача | Критерий приёмки |
|---|---|---|
| P0 | **Stage 002: внешний high-depth corpus.** Найти **независимо Adobe Photoshop-authored** RGB/CMYK PSD16 и PSB32 с правом распространения; записать исходный URL, лицензию, происхождение и SHA-256 без подмены синтетикой. | `tools/audit-external-high-depth-corpus.mjs` PASS на реальных файлах; экспертно проверены license/authorship; pinned manifest; без скачивания сомнительных assets в репозиторий. |
| P0 | **Stage 002 → 003: реальный cross-app oracle.** Выполнить decode/группы/маски/adjustment + внешние Photoshop render references (включая clipping/blend). | Сверка semantic + pixel snapshots, чёткий unsupported list, независимый от собственного PSD writer golden. |
| P1 | **Stage 003: wide connected ROI.** Перейти от раздутого bounding rectangle к бюджетируемым фрагментам с запрещёнными original-selection donors и one atomic commit. | RGB16/Float32 CMYKA sync/Worker/cooperative parity, отмена в read/kernel/write/serialize, caps при worst-case связной маске, неизменность нетронутых байтов/тайлов. |
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

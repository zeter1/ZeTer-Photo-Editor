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

## Ближайшие выполняемые проходки

| Приоритет | Следующая задача | Критерий приёмки |
|---|---|---|
| P0 | **Stage 002: внешний high-depth corpus.** Найти **независимо Adobe Photoshop-authored** RGB/CMYK PSD16 и PSB32 с правом распространения; записать исходный URL, лицензию, происхождение и SHA-256 без подмены синтетикой. | `tools/audit-external-high-depth-corpus.mjs` PASS на реальных файлах; экспертно проверены license/authorship; pinned manifest; без скачивания сомнительных assets в репозиторий. |
| P0 | **Stage 002 → 003: реальный cross-app oracle.** Выполнить decode/группы/маски/adjustment + внешние Photoshop render references (включая clipping/blend). | Сверка semantic + pixel snapshots, чёткий unsupported list, независимый от собственного PSD writer golden. |
| P1 | **Stage 003: wide connected ROI.** Перейти от раздутого bounding rectangle к бюджетируемым фрагментам с запрещёнными original-selection donors и one atomic commit. | RGB16/Float32 CMYKA sync/Worker/cooperative parity, отмена в read/kernel/write/serialize, caps при worst-case связной маске, неизменность нетронутых байтов/тайлов. |
| P1 | **Stage 003: browser end-to-end.** Chromium `file://` PSD16/PSB32 → tiled Worker → preview → Undo/Redo; отдельно lifecycle cancellation. | Автоматизированный сценарий, sample renderer + Worker/process memory и latency (не выдавать snapshot за peak), повторяемость и минимум две глубины. |
| P1 | Harden high-depth source/result byte integrity и canonical base64; не ограничиваться метаданными detached Worker result. | Отказ при невыделенной мутации **внутри** выбранного tile; bounded decoding/precision regression. |
| P2 | Документы в Smart Objects, сложная структура Photoshop, текст/layout и vector path interoperability. | Поштучные independent fixtures + exact round-trip regression. |
| P2 | Color management и 16/32-bit performance на больших файлах; CMYK preview/soft proof. | ICC reference сравнения, измерения до/после и тесты конверсий. |
| P3 | RAW/DNG pipeline (LibRaw WASM), затем Select & Mask/Content-Aware quality и GPU/ML. | Отдельные технические спецификации, права на sample fixtures и контролируемый memory budget. |

## Текущая малая проходка (ветка `feat/stage002-bounded-corpus-preflight-20261011`)

- [x] В аудиторе P0 ограничено чтение недоверенного manifest (1 MiB) и
  запрещены symlink/path swaps manifest.
- [x] Проверены минимальные каналы RGB (3) и CMYK (4), нижняя граница размера
  PSD (40 байт) и PSB (44 байта), добавлены негативные регрессии.
- [ ] GitHub PR review и зелёные Node/CI проверки; затем merge в `main`.
- [ ] Реальные Photoshop-authored PSD16/PSB32 **пока не получены**;
  эта проходка не закрывает 002 или 003.

### Правило отчётности

Выполнено = код + тесты + review + merge в `main` + зелёный CI **точного main SHA**.
До завершения всех gates помечать «в работе», не записывать «всё реализовано».

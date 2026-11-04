# 008 — Stage 003: large PSD16 → browser file input → v2 Worker → Undo/Redo

**Статус:** завершена в main. [PR #188](https://github.com/zeter1/ZeTer-Photo-Editor/pull/188), squash f172168cbbda02ecded76818055164b63eca5ac3; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142325168); [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142408685). Эта проходка НЕ закрывает Stage 002/003 целиком.

## Цель

Закрыть конкретный пробел между предыдущими независимыми проверками:
- 007: маленький ZeTer-generated PSD16/PSB32 импортируется через настоящий Chromium file:// #fileInput и сохраняет точные native values (но v1);
- прежний Stage 003 smoke: настоящий Content-Aware Fill Worker + Undo/Redo для synthetic .zpe v2 8×8 (но не из PSD).

## Изменения проходки

- [x] Новая детерминированная ZeTer-authored PSD16 fixture 1025×1025 RGBA16, raw buffer 8 405 000 bytes, то есть строго выше порога tiled v2 8 MiB и ниже aggregate bounded 48 MiB.
- [x] Node regression: бинарный PSD decode и исходные/native damaged samples, adaptive serializer выбирает v2 и не теряет raw bytes.
- [x] Добавлен Chromium file:// smoke: порционная передача большого PSD по CDP в настоящий #fileInput, импорт/preview в editor canvas.
- [x] File → Save Project считывается через настоящий JSON Blob: проверяется v2, число тайлов и точные Uint16 samples в разных тайлах.
- [x] Настоящий canvas overlay marquee → Edit > Content-Aware Fill, подсчёт real Worker jobs, изменение preview, одна History запись, Undo и Redo.
- [x] Информационный CDP sampler: renderer heap и, если доступно, суммарная Chromium process privateMemory с отметками import/Worker/history. **Эти значения не являются реальным peak RAM или Worker RSS.**
- [x] PR CI и exact-main CI подтверждены для проходки 008, включая Chromium file://, 1152 Node tests, generated parity, профили и diff hygiene.

## Проверки

- npm run check (Node tests + generated assets parity)
- npm run test:browser (Chromium file://, включая новый large PSD16 regression)
- git diff --check
- CI профили: informational, без искусственных memory/latency SLO

## Ограничения и следующая очередь

1. **Следующая [009](009-large-psb32-worker-cancellation.md):** аналогичный >8 MiB (не крошечный) PSB Float32/CMYK тест real UI → v2 Worker → preview/Undo/Redo; отдельно проверить отмену во время pending Worker и отсутствие частичной публикации. Не считать простую точность импорта достаточной.
2. Stage 003: adaptive dense ROI strip/segment grouping + глобальный frozen donor exclusion, aggregate cap, scan/read/kernel/write cancellation и deterministic sync/Worker parity на плотных связных масках.
3. Stage 002 (P0): независимые и юридически допустимые Photoshop-authored PSD16/PSB32 + метаданные лицензии, SHA-256, reference renders и cross-app pixel parity.
4. Снять настоящий memory peak (включая Worker и native GPU/decoder allocations) отдельным профилировщиком; CDP snapshots этого не доказывают.

**Не переоценивать:** ZeTer-generated PSD16 — транспортный/precision regression, НЕ Photoshop compatibility golden.

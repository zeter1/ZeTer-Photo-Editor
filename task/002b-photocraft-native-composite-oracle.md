# 002B/1 — Pinned PhotoCraft Photoshop PSD16/PSD32 native embedded-composite oracle

**Приоритет:** P0 (часть 002). **Статус:** IN PROGRESS (до подтверждения PR CI, merge и exact-main CI). **Дата:** 2026-10-19.

## Цель и зависимости
Доказать на *независимо опубликованных* Adobe Photoshop-authored (по утверждению исходного автора) RGB16/PSD32 файлах, что ZeTer читает editable layer information и побитно сохраняет все native 16/32-bit значения Photoshop-embedded merged composite. Не смешивать PSD32 с PSB32.

**Источник:** https://github.com/storytold/photocraft-corpus/tree/b2e1dcba8954efa9ad0e7944c258cc0e9a5efc1e

**Provenance:** upstream README утверждает Photoshop 2026 (27.10) + Maximize Compatibility; генераторы находятся в `tools/photoshop-oracles/`, двойная MIT/Apache-2.0 лицензия указана в `LICENSE-MIT`, `LICENSE-APACHE` и `NOTICE`. Это утверждения публикации, не независимо проверенный запуск Photoshop или юридическое заключение.

**Закреплённые fixtures (из upstream SHA256SUMS):**
- `rgb16/baseline-layer-copy.psd` — 80540 bytes, SHA-256 `f31e10d19689df9dba71ebdc60652b28eb364ad8da9040a80bc5aeffcf34228e`.
- `rgb16/levels.psd` — 79020 bytes, SHA-256 `fbb18d1cfa5fc74cf1c4777b99acdc2465b2920574bd9069b5a2ac129c8151d9`.
- `rgb32/baseline-layer-copy.psd` — 143536 bytes, SHA-256 `73199414108280d7717cc5c908a76f51c5e3091d7471e21e7d0bac1a75734f32`.

## Выполнено в кандидатной ветке
- `tools/verify-photocraft-candidates.mjs`: fail-closed digest, size, header, dimensions и section bounds; независимое чтение PSD merged RGB16/Float32 (raw / PackBits / ZIP / ZIP prediction), без ZeTer writer. Сравнение *каждого* native RGBA sample с `decodePsd` на копии исходного файла, где удалена только layer/mask секция; исходный файл не изменяется. Отдельное `decodePsd` оригинального Photoshop PSD обязано подтвердить непустой импорт редактируемых слоёв.
- `tests/photocraft-candidates.test.mjs`: синтетические тесты raw/RLE/ZIP/16-bit prediction + фальшивый SHA, повреждённый размер/секция/сжатие/строка RLE, immutability. Синтетические тесты не подменяют реальные Photoshop test fixtures.
- `.github/workflows/ci.yml`: настоящий PR/main CI загружает **только** эти три файла из pinned immutable commit в `$RUNNER_TEMP`, проверяет SHA-256 в shell и независимо в Node, запускает oracle; отсутствие fixture/ошибка декодирования приводят к красному CI, без silent skip. 300 KiB binary fixtures не коммитятся.

## Проверки / CI
- PR CI: **PENDING**. `npm run check` и Chromium `file://`: **не запускались локально** (в контейнере GitHub DNS недоступен). Проверять реальные результаты workflow до статуса DONE.
- Main CI после merge: **PENDING**.
- Контракт проверки: точное совпадение native sample data после импорта Flattened Adobe embedded composite; layer section действительно импортируется; независимое чтение compressed preview из исходных bytes.

## Известные ограничения
- Photoshop embedded composite — reference **для композитного payload**, не эталон повторного вычисления blending/adjustment layers редактором.
- PSD32 **НЕ** PSB32. Нет разрешённого независимо Photoshop-authored PSB32, его reference render и полной формы `psd16+psb32` аудита.
- Нет показателей browser `file://` для этих Photoshop fixtures, Undo/Redo и native Worker, ICC/CMYK calibrated truth или независимой ручной Photoshop review.
- Рабочая ветка до подтверждения CI: тесты и документирование **не** означают завершения задачи 002B.

## Следующая задача: 002B/2
После green PR + exact-main CI 002B/1, найти и юридически подтвердить independently Photoshop-authored PSB32 с source URL/license/generator history/hash/reference, зафиксировать canonical dual-kind manifest, запустить существующий `audit-external-high-depth-corpus.mjs` → `profile-external-high-depth-psd-psb.mjs` с настоящим Worker → Chromium `file://` public import/preview/Undo/Redo/memory и semantic/render Adobe comparison. **Критерий:** независимое подтверждение происхождения, обе реальные high-depth разновидности и все gates green; до этого 002/002B остаётся открыта.

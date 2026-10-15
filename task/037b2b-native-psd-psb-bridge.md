# 037B2b-3a — pinned native defect → PSD16/PSB32 self-codec round-trip

**P1 / CODE PROPOSED — 2026-10-15.** Эта узкая проходка подготавливает экспорт и импорт **только из допущенного manifest** с pinned original JPEG / decoded RGBA8 / RGB16+Float32 clean и damaged SHA-256. **Не завершает 037B2b-2/3 и 037C**, так как реальный original CC0 JPEG и результаты независимого decoder/ICC/EXIF review всё ещё отсутствуют.

## Implemented

- `tools/real-photo-psd-psb-fixtures.mjs`: `createVerifiedPhotoDefectDocuments` вызывает `admitPhotoBundle` до экспорта, создаёт настоящий ZeTer PSD v1 RGB16 и PSB v2 RGB Float32 с одним повреждённым слоем (8288 connected selection, 8-bit-derived source) и native merged composite. Файлы возвращаются в памяти.
- Для каждого файла `verifyPhotoDefectDocument` повторно декодирует ZeTer codec, проверяет документные версии, размеры/битность, точные native LE SHA-256 всех каналов **слоя и merged composite**, соседние пиксели/alpha и damage-only selection против независимого clean массива. Никаких RGB8 display previews как oracle.
- `tools/real-photo-psd-psb-cli.mjs`: только офлайн `reviewed-manifest.json original.jpg decoded.rgba NEW-output-dir`; создаёт два файла лишь после проверок; не перезаписывает существующую output-директорию. Логирует JSON без image bytes.
- `tests/real-photo-psd-psb-fixtures.test.mjs`: положительный native round-trip PSD16/PSB32 и отрицательные проверочные случаи tampered hashes, bytes, source, native words и ложного Photoshop claim.
- В тесте используется намеренно не JPEG entropy-decodable **synthetic unit surrogate**; его положительный результат означает только contract/codec mechanics.

## Offline handoff after licensed photo arrives

1. Следовать [037B2b-1](037b2b-photo-bundle-admission.md): независимо скачать задокументированный CC0 original, проверить SHA-1 + SHA-256, размер 2560×1920, EXIF/ICC, версия decoder, unscaled oriented RGBA8, внешний review и все шесть SHA-256.
2. Запустить `node tools/real-photo-bundle-cli.mjs verify reviewed-manifest.json original.jpg decoded.rgba`; fail-closed gate обязателен.
3. Запустить `node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba ./photo-defect-output` (директория **не должна существовать**). Результат: `psd16-defect.psd`, `psb32-defect.psb`; отдельно pin file SHA-256 после review, не заменяя предыдущие native/source hashes.
4. С независимым image oracle/review проверить, что file header/native pixels физически проходят Adobe/сторонний PSD/PSB reader. ZeTer decoder ↔ ZeTer encoder **не** даёт Photoshop parity.
5. Дальше Chromium `file://` через UI: импорт обоих документов, polygon 8288, Worker, Save Project, Undo/Redo, минимум 3 прогона/format, честные native quality/perf JSON и отдельный external Photoshop corpus [002](002-psd-compatibility-corpus.md).

## Gates and remaining

- [x] Source-only implementation and negative tests committed to feature branch.
- [ ] PR CI and exact-main CI — требуется фактическая проверка; не отмечать успешными заранее.
- [ ] Real licensed source + externally reviewed JPEG decode/ICC/EXIF, durable blob/pins (037B2b-2).
- [ ] Реальные PSD16/PSB32 byte files и independent external reader validation (remaining 037B2b-3).
- [ ] Chromium `file://` per-pixel quality/memory 3×/format (037C).
- [ ] Stage [002](002-psd-compatibility-corpus.md) независимый Photoshop goldens; Stage [003](003-tiled-content-aware.md) system-wide memory budget.

**Scope limit:** этот test-only инструмент не меняет production render/document contracts, не повышает 8-bit точность и не доказывает реальный JPEG, proprietary Adobe compatibility, operation RAM peak или качество восстановленной фотографии.

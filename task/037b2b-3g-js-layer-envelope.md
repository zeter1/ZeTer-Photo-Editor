# 037B2b-3g — JS saved-PSD/PSB raw layer metadata integrity

**Статус: ЗАКРЫТА (2026-10-15).** [PR #237](https://github.com/zeter1/ZeTer-Photo-Editor/pull/237) → [7522747](https://github.com/zeter1/ZeTer-Photo-Editor/commit/75227473498a79b411b71eb8407b6e87202025d3); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38737045824) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38737509166). Это узкий test-only gate, НЕ общий PSD/PSB-парсер и НЕ доказательство совместимости с Photoshop.

## Почему

До 037B2b-3g JS-проверка `verifyPhotoDefectDocument` сверяла native words слоя/merged и имя через `decodePsd`. Но существующий Python/std-lib reader (037B2b-3d) уже доказал, что raw-метаданные слоя — flags, masks, blending ranges, extra tags — могут изменить семантику без изменения native-хешей. JS saved-artifact verifier должен отказывать при той же подмене, **даже если файл переподписан новым file SHA-256**.

## Граница реализации

- [x] Новый test-only `tools/real-photo-psd-layer-envelope.mjs`: валидирует точный one-layer PSD16/PSB32 native-defect binary envelope, 4 канала, full-canvas bounds, raw channel sizes, blend/opacity/clipping/flags, пустую mask/blending ranges, Pascal/Unicode name, tagged Lr16/Lr32, padding и отсутствие добавочных layer tags.
- [x] `tools/real-photo-psd-psb-fixtures.mjs`: вызывает raw envelope gate до общего `decodePsd`, сохраняя отдельную проверку layer+merged native words.
- [x] `tests/real-photo-psd-psb-fixtures.test.mjs`: внесение metadata-only мутаций PSD16/PSB32, а также дополнительного high-depth tag; проверяет прямое сохранение и сохранённые artifacts при переподписанном SHA.
- [x] `npm run check` и GitHub PR CI: Node/build, Chromium `file://`, JSON artifacts/profiles, diff hygiene — success.
- [x] После merge exact-code `main` CI — success. 037B2b-3g CLOSED.

## Следующие задания (реально остаются открытыми)

1. **037B2b-2:** получить неизменённый оригинал CC0 JPEG из документированного Wikimedia-источника; независимо декодировать и рецензировать EXIF/ICC/цвет, надёжно зафиксировать original/decoded/native clean+defect SHA-256 (не использовать суррогат как фото).
2. **037B2b-3:** сформировать PSD16/PSB32 из допущенного real-photo bundle; проверить **сторонним** PSD/PSB декодером (Python/std-lib fixture reader и ZeTer self-codec не равны сторонней проверке).
3. **037C:** настоящий Chromium `file://`, 3 прогона/формат, native Worker, connected ROI 8288, quality/Undo/Redo/Save и честная memory evidence.
4. **002 / 003:** Adobe-authored compatibility corpus и общий tiled/high-depth/memory бюджет остаются незавершёнными.

**Граница утверждений:** настоящий JPEG, независимые frozen pins и Photoshop/ICC/Chromium-photo проверки в этом PR отсутствуют. Версия 1.46.1 не меняется, потому что production/runtime код не затронут.

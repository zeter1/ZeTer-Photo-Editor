> **Продолжение 037B2b-1:** реализован [offline photo bundle admission](037b2b-photo-bundle-admission.md) со строгими original/decoded/native clean+defect pins и fail-closed negative matrix. **037 остаётся OPEN**: не получены настоящие CC0 байты/EXIF/ICC review, PSD16/PSB32 fixture import и Chromium real-photo runs. 037B2b-1 gate закрыт: [PR #226](https://github.com/zeter1/ZeTer-Photo-Editor/pull/226) → [fab6c49](https://github.com/zeter1/ZeTer-Photo-Editor/commit/fab6c49abed85f7314ef91b1769975496f8263b7); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38691322897) и [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38691679311) success. Дальше 037B2b-2/3 и 037C.

# 037 — реальное изображение: проверяемое качество широкого connected ROI в Chromium

**P1, OPEN (после закрытой [036C](036-browser-connected-roi-quality.md)).**
**Не подменяет [002](002-psd-compatibility-corpus.md):** независимо Photoshop-authored RGB16/CMYK32 PSB golden — отдельная P0 и остаётся открытой.

## Проходка 037B2a — детерминированная native fixture-подготовка (ЗАКРЫТА; PR + main CI success)

- Добавлен [исполняемый handoff](037b2a-photo-native-fixture-bridge.md): `tools/real-photo-native-fixtures.mjs` связывает pinned RGBA8 decode с bounded crop и независимыми RGB16/Float32 clean + controlled defect native arrays. Точная connected 8288 ROI, строго alpha/outside-selection неизменны. Обязателен отдельный pinned native LE SHA-256; вычисленный кандидатом digest сам по себе недостаточен.
- Unit negative tests покрывают неверный hash/bounds/alpha и native quality parity; это **подготовительный тест с синтетическим RGBA8 суррогатом**, не измерение реальной фотографии.
- **Gate выполнен:** [PR #225](https://github.com/zeter1/ZeTer-Photo-Editor/pull/225) → [64c0235](https://github.com/zeter1/ZeTer-Photo-Editor/commit/64c0235b70ea724ef6b6bacdc70c5ff9ce19a5fc), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38607110005), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38607607539); полный Node/build, настоящий Chromium `file://`, артефакты/профили и diff hygiene — success.
- **Далее 037B2b:** получить genuine CC0 JPEG/декодированные байты, source+decode+native SHA-256 и ICC/EXIF evidence; построить независимые fixture PSD16/PSB32. **037C** browser ×3/format после этого. 037 в целом открыта до полной цепочки CI/real asset.

## Проходка 037A — ЗАКРЫТА (2026-10-14; PR + exact-code main CI success)

- Реализованы `tools/real-photo-native-quality.mjs` и `tests/real-photo-native-quality.test.mjs`: native Uint16/Float32 **per-pixel** known-clean reference, обязательный SHA-256 clean LE words, независимые snapshots, MAE/RMSE/max error. Не опираются на constant-color ZeTer synthetic reference или RGBA8 preview.
- Отрицательные сценарии: любое изменение outside-selection, alpha, reference mismatch (включая неподменённый vs подменённый hash), неверный bit depth, алиасинг buffers, неупорядоченные/повторные индексы, NaN и signed-zero bit flip. Локально 5/5 Node success; [PR #223](https://github.com/zeter1/ZeTer-Photo-Editor/pull/223) → [27a6adb](https://github.com/zeter1/ZeTer-Photo-Editor/commit/27a6adb830797d3258bc640ffe09dd89c3ef92b8), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38586323259), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38586743806). Полный `npm run check`, реальный Chromium `file://` smoke, JSON/profile CI и diff hygiene — success (проверки инфраструктуры; **не** benchmark реального фото).
- Кандидат фото: CC0 1.0 кирпичная стена, MartinThoma, JPEG 2560×1920, sRGB ([provenance](../tests/fixtures/real-photo/README.md)). **Фотографические пиксели в benchmark пока не поступили: asset SHA-256 не проверен; пункт 1 и benchmark остаются незавершёнными.** Не считать этот unit-тест реальным фото.
- **Далее 037B:** получить разрешённые фото-байты, закрепить asset SHA-256, проверить geometry/color, создать отдельные frozen native known-clean references RGB16/PSB32 и контролируемые connected ROI defects; exact digest для каждого reference зафиксировать в fixture manifest.
- **Далее 037C:** настоящее `file://` Chromium PSD16/PSB32 import → polygon → Worker → Save Project → Undo/Redo, минимум 3 запуска на формат; native oracle, строгая validation JSON, honest RSS/CDP missingness, negative matrix и CI exact-main gate. 037 остаётся OPEN.

## Проходка 037B1 — входной контроль оригинального JPEG (2026-10-14; СЛИТО, PR CI success)

- **Gate 037B1:** [PR #224](https://github.com/zeter1/ZeTer-Photo-Editor/pull/224) → [8fa7b12](https://github.com/zeter1/ZeTer-Photo-Editor/commit/8fa7b12719a07ac92fd5af533c799a91fa0696c0), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38593642014); `npm run check`, настоящий Chromium `file://`, все JSON artifacts, профили и diff hygiene — success. Exact-code main CI после обновления handoff — ожидается.

- Реализована test-only проверка `inspectPhotoJpeg`: фиксированный SHA-1 оригинала с карточки CC0, SOI/EOI, SOF/scan, размеры, 8-bit/3 channels и регистрация наличия EXIF/ICC. Скрипт `node tools/inspect-real-photo-source.mjs <local-original-jpeg>` вычисляет **кандидат** SHA-256 из настоящего локального файла, без загрузки по изменяемому URL.
- `verifyPinnedPhotoJpeg` **запрещает** допуск исходника без самостоятельной фиксации оригинального SHA-256; `verifyPinnedDecodedRgba` отдельно требует SHA-256 декодированных RGBA8, точную геометрию и opaque alpha. JPEG header-сканер НЕ доказывает корректное энтропийное декодирование, ICC/sRGB, orientation или содержание фотографии.
- Unit negative matrix добавлена для повреждённого source и decoded payload. Эти тесты используют только structural JPEG surrogate; это **не реальные фотопиксели** и не Photoshop parity.
- **Следующее 037B2:** получить CC0 original bytes и вычислить SHA-256; выполнить trustworthy decode, записать decoded RGBA8 SHA-256, проверить ICC/EXIF ориентацию, собрать отдельные immutable RGB16/PSB32 clean+defect fixtures с native LE SHA-256 и selection 8288. Только затем 037C.
- **037 остаётся OPEN**, исходные JPEG-байты и frozen native clean refs пока не включены.

## Цель

Проверить Content-Aware Fill native RGB16/Float32 на **реальной текстурированной фотографии**, а не на ZeTer-generated плоском эталонном фоне. Не использовать одну только self-authored PSD/PSB как доказательство Photoshop-совместимости.

## Исполнимая последовательность

- [ ] Подобрать legally reusable photographed image или авторский оригинал с явно записанными license, origin, asset SHA-256, разрешением, color-space и правом включения только в тесты. Хранить fixtures по правилам проекта, не копировать чужие несвободные файлы.
- [ ] Сделать воспроизводимый known-clean image reference; **отдельно** создать документ с контролируемыми дефектами в двух 64×64 островах и тонком связном diagonal corridor (либо зафиксировать другую точную непустую native selection shape). Сохранить исходник и reference раздельно, обеспечить неизменные alpha и outside selection.
- [ ] Через настоящий \`file://\` UI выполнить import → polygon selection → native Worker → public Save Project → Undo/Redo для PSD16 и PSB32, с независимым native word oracle для nonselection/alpha и сравнением MAE/RMSE только с genuine known-clean reference.
- [ ] Для каждого формата записать минимум 3 независимых запуска (не объединять в ложный benchmark SLA). Версионировать timings / memory sample coverage, включая пропуски CDP/Unix, **не** заявлять true Worker→PID, true RAM peak либо Photoshop parity по этому тесту.
- [ ] Провести blind negative matrix: nonselection/alpha mutation, ложная quality, перепутанные clean reference/bits, corrupt tiles, необоснованные sample peaks/PID joins; сохранить строгий fail-closed artifact read/write.
- [ ] Gate: \`npm run check\`, реальный Chromium \`file://\` smoke, profile/artifact CI, чистый diff, PR-review, merge и exact-code main CI. Занести фактический SHA/CI/qualitative limits сюда и в [NEXT](NEXT.md).

## Незакрытые более крупные направления

- **P0 [002](002-psd-compatibility-corpus.md)** — независимые лицензированные Photoshop-authored goldens с истинным Adobe round-trip, CMYK32 / group masks, metadata; без данных не отмечать выполненным.
- **Stage 003** — совместимый render/document contract и глобальный tiled memory budget для патологических больших документов; истинные operation peaks требуют другой измерительной методики.
- **Остальное со скриншота:** PSD export compatibility, Smart Objects, 16/32-bit/HDR, ICC/CMYK, RAW и Select & Mask / Content-Aware Fill являются отдельными крупными дорожными картами; один synthetic test их не закрывает.

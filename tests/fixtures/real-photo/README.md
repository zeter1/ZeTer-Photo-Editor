> **037B2b-2 (2026-10-15):** [reviewed manifest](reviewed-manifest.json) и [независимый протокол](../../../task/037b2b-2-reviewed-photo-pins.md) фиксируют проверенные по подлинному main GitHub artifact шесть SHA-256 (JPEG/RGBA8/RGB16+Float32 clean/defect), EXIF Orientation 1, отсутствие встроенного ICC и явное assumed-sRGB. Фото/RGBA8 в git не включены; CI в отдельном workflow должен сверять заново скачанные байты с frozen pins. Реальные photo-derived PSD/PSB и Chromium quality ещё не получены.

> **037B2b-2h (2026-10-15): реальный JPEG/декодированные пиксели впервые получены через [GitHub Actions](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38767164287), artifact `zpe-real-photo-unreviewed-candidate` (7 дней), [результат и SHA-256](../../../task/037b2b-2h-github-real-photo-intake.md).** Оригинал имеет MPO index/434-byte trailer; Pillow primary frame RGBA8 и отдельный OpenCV 4.13.0 decode побайтово совпали. **Фотография не включена в Git history**, candidate SHA-256 ещё не immutable reviewed manifest; остаются внешний ICC/EXIF/license/color sign-off, PSD/PSB real-photo import, Chromium 037C и Photoshop parity. Далее прежние записи описывают историческое состояние до получения original.

> **Получение оригинала (037B2b-2e):** `node tools/fetch-real-photo-source.mjs NEW-original.jpg` (из корня репозитория, требуется HTTPS). [Handoff](../../../task/037b2b-2e-source-acquisition.md). Скрипт проверяет SHA-1 и JPEG структуру **до** создания нового файла; SHA-256 лишь кандидат, лицензия/реальное декодирование/ICC/EXIF и photo benchmark остаются не проверенными.

> **037B2b-3b merged + CI success:** [PR #228](https://github.com/zeter1/ZeTer-Photo-Editor/pull/228), [точный `main` CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38699204703). `codec-evidence.json` + `verify` rechecks saved ZPE PSD16/PSB32; это не заменяет реального оригинала и ICC/EXIF/Adobe review. [Handoff](../../../task/037b2b-3b-artifact-integrity.md).

## 037B2b-1 — offline pin verification available; actual photo still absent

- `tools/real-photo-bundle-cli.mjs candidate` derives **unadmitted** hash candidates only; `verify` requires separately reviewed SHA-256 original, decoded RGBA8 and native RGB16/Float32 clean+defect references. See [task handoff](../../../task/037b2b-photo-bundle-admission.md).
- Original photo JPEG and genuine decoded pixels are **still not checked into this repository**. The negative-matrix tests use a deliberately non-decodable JPEG surrogate; no quality/ICC/EXIF/Photoshop result is claimed. Next: actual source acquisition and external decoder review.

## 037B2a — подготовлен native fixture bridge, original photo ещё не получено

- См. [task/037B2a](../../../task/037b2a-photo-native-fixture-bridge.md): candidate RGBA8 → RGB16/Float32 native clean + 8288 connected selected defect, отдельный pinned SHA-256 LE native words обязателен до допуска.
- Генератор не выполняет entropy JPEG decode, не доказывает EXIF/ICC/sRGB и не повышает исходную 8-bit точность. В репозитории по-прежнему **нет** настоящего CC0 JPEG, frozen clean hashes и реального бенчмарка.

# 037 — кандидат реальной фотографии (не готовый benchmark fixture)

**Статус: provenance source candidate; оригинальные JPEG-байты и SHA-256 ещё не получены/не закреплены. НЕ заявлять benchmark quality или Photoshop parity.**

- Фотограф: MartinThoma (авторская фотография кирпичной стены, 7 августа 2014).
- Источник/история: https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg
- Прямая ссылка на оригинал: https://upload.wikimedia.org/wikipedia/commons/a/a8/Red-brick-wall-texture-clean.jpg
- Лицензия оригинала: CC0 1.0 Universal Public Domain Dedication, https://creativecommons.org/publicdomain/zero/1.0/
- Заявленные исходные параметры (Wikimedia Commons): JPEG, 2560×1920, sRGB; SHA-1 по карточке файла `c7fc9f013c70e01f164d232462ddd6e37e4079c4`.
- **Подготовлена тестовая приёмка 037B1:** скачай оригинал вручную, выполни `node tools/inspect-real-photo-source.mjs /path/to/Red-brick-wall-texture-clean.jpg`. Скрипт сначала сверяет документированный SHA-1 и JPEG header geometry и только затем сообщает SHA-256 для следующей независимой фиксации. `verifyPinnedPhotoJpeg` требует pinned SHA-256, `verifyPinnedDecodedRgba` — отдельный SHA-256 настоящего RGBA8 декодирования. Header check сам по себе **не является JPEG decoder**, не проверяет ICC/sRGB либо EXIF orientation.
- **Требуется до бенчмарка:** загрузить точные bytes, вычислить/закрепить независимый SHA-256 оригинального asset, верифицировать декодированные размеры и color space, зафиксировать лицензированную копию или долговечный content-addressed тестовый артефакт; не полагаться на «живой» URL без hash gate.
- Затем получить **отдельные** known-clean native references для RGB16/Float32, с собственными SHA-256 нативных LE words, не перемножая 8-bit preview и не переиспользуя уже исправленное изображение в качестве clean.
- Входные массивы `before`, `after` и `clean` для oracle в `tools/real-photo-native-quality.mjs` должны быть независимыми; указать SHA-256 clean reference в fixture manifest и передать через `expectedReferenceSha256`.
- Следующий исполнимый шаг: 037B (получение лицензированного фото + frozen fixture hashes + Native PSD16/PSB32 generation), затем 037C (Chromium UI + 3 прогона/формат + fail-closed JSON/memory + CI). Подробности: [task/037](../../../task/037-real-photo-connected-roi-benchmark.md).

Не хранить здесь фотографии случайного происхождения, не приписывать этот photographed источник Adobe/Photoshop и не считать SHA-1 исходника заменой обязательному SHA-256.

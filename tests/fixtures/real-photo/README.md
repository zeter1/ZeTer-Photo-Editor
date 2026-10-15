> **037B2b-3b, in review:** при сохранении ZeTer PSD16/PSB32 теперь формируется `codec-evidence.json` и отдельный `verify` повторно проверяет записанные байты. См. [handoff](../../../task/037b2b-3b-artifact-integrity.md). Это не заменяет реального исходника, внешнего JPEG/ICC/EXIF review или Photoshop golden.

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

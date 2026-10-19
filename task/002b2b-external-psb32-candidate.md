# 002B/2b — Independent 32-bit PSB candidate admission (not Photoshop provenance)

**Приоритет:** P0 (002B/2). **Статус:** IN PROGRESS. **Дата:** 2026-10-19.
**Зависимости:** 002B/1, 002B/2a Chromium PSD16/PSD32 native import.

## Цель и границы

В существующей внешней коллекции `psd-tools/psd-tools` обнаружены настоящие PSB version 2, RGB32 Float32 fixtures. Их происхождение именно из Adobe Photoshop **не установлено**, поэтому это дополнительная проверка реального независимого PSB32 codec, **не** требуемый Photoshop-authored PSB32 с Photoshop reference render.

Первоисточник: https://github.com/psd-tools/psd-tools/tree/c49b17525254d84c89ab42d1cb0316402ddb89b8/tests/psd_files (2017-04-19 Add PSB tests). Репозиторий публикует MIT LICENSE; индивидуальную историю создания бинарных fixtures и правообладателей ещё нужно проверить перед утверждением Photoshop provenance.

Закреплённые fixture SHA-256 получены из immutable upstream blob с независимым SHA-256 алгоритмом:
- `32bit.psb`: 282992 bytes, `232bde4537492a671d22b7ff7025a786bc8110677ce5add180103f977be4f5ee`, PSB version 2, RGB32 100×150;
- `32bit.psd`: 282154 bytes, `78dd96ec74960a392db0a3bf4193478d62adfa5d93634ab7ce8a40e4468df5e1`, PSD version 1, RGB32 100×150;
- `32bit5x5.psb`: 20954 bytes, `cd506872a4b1dc48bf7f64e10d321b99ea950c557cd3a83e303288e8ef6bf481`, PSB version 2, RGB32 5×5.

## Реализация в кандидатной ветке

- `tools/verify-psdtools-psb32-candidates.mjs`: источник строго проверяется по размеру, SHA, 8BPS/version, dimensions, RGB/Float32 и import через `decodePsd`; для editable raster слоёв требуется настоящий `Float32Array`, проверяется полная длина и SHA native данных. Парный PSD/PSB файл проверяется на matching raster layers без использования ZeTer writer.
- `tests/psdtools-psb32-candidates.test.mjs`: отрицательные header/hash и неправильно типизированные native data. Эти синтетические tests НЕ заменяют реальные PSB.
- `.github/workflows/ci.yml`: скачивает immutable upstream assets с sha256sum fail-closed и запускает проверку настоящего внешнего PSB; никаких бинарных данных в git, никаких изменений production/runtime.
- `task/NEXT.md`, `task/README.md`, `task/002-psd-compatibility-corpus.md`, `CHANGELOG.md`: учёт новой подпроходки и статуса 2a.

## Приёмка и проверки

**Критерии:** PR `npm run check`, реальные upstream PSB32 SHA-pinned assets и новая decode/native verifier зелёные; PR merge и exact-main CI success. В случае расхождения пары исследовать кодек/fixture; не ослаблять сравнительные проверки молча.

**Статус:** PR CI, merge и exact-main пока не подтверждены. Локальная проверка полного репозитория недоступна из-за отказа GitHub DNS в runtime, поэтому green не заявляется.

## Что остаётся

P0 002B/2c: найти независимо разрешённый и **доказуемо Photoshop-authored PSB32** с provenance, оригиналом, reference render + SHA-256; объединить Photoshop PSD16 + PSB32 audit → native Worker → public Chromium `file://` Undo/Redo/History/memory/render golden. Эта кандидатная проходка не закрывает 002/002B или этап 003, ICC/CMYK, RAW/HDR и общую Photoshop-совместимость.

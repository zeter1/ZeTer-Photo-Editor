# 037B2b-2a — воспроизводимое внешнее декодирование оригинального JPEG в RGBA8

**Небольшая test-only подготовительная проходка.** Она не закрывает 037B2b-2, потому что в репозитории по-прежнему нет genuine CC0 photo bytes и независимо закреплённых source/decoded/native SHA-256. Не использовать суррогатные данные теста как фотографию.

## Реализация

- `tools/decode-real-photo.py`: автономный **офлайн** Pillow/ImageCms/ImageOps JPEG-декодер исходника MartinThoma с жёсткой проверкой документированного SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4`, размеров 2560×1920, режима RGB и верхнего лимита файла.
- Применяет EXIF-ориентацию (отказывает, если она изменяет закреплённую геометрию), явно преобразует embedded ICC в sRGB через LittleCMS или объявляет отсутствие ICC как assumed-sRGB. Записывает opaque row-major RGBA8 и отдельный `decoder.json` со схемой текущего `tools/real-photo-bundle-admission.mjs`.
- Возвращает только **кандидатные** оригинальный и decoded SHA-256 и версии используемого decoder/LCMS. Не повышает кандидат автоматически до `reviewed-manifest.json`. Не перезаписывает выходные файлы, не скачивает JPEG из сети.
- `tests/decode-real-photo.test.mjs`: surrogate-only synthetic JPEG с EXIF=3, EXIF=6, валидным embedded sRGB ICC, хеш-мутантом и блокировкой перезаписи. Тест явно **не** содержит исходных фотографических пикселей.
- CI устанавливает test-only pinned `Pillow==12.0.0` в isolated venv; production зависимости, runtime редактора и версия приложения не меняются.

## Воспроизведение на настоящем оригинале (ещё не выполнено)

```sh
python3 -m venv .photo-venv
.photo-venv/bin/python -m pip install 'Pillow==12.0.0'
.photo-venv/bin/python tools/decode-real-photo.py original.jpg decoded.rgba decoder.json
node tools/real-photo-bundle-cli.mjs candidate original.jpg decoded.rgba decoder.json > candidate.json
```

`original.jpg` нужно отдельно получить с задокументированного CC0 Wikimedia оригинала. На Windows использовать `.photo-venv/Scripts/python.exe`. При декодировании из другого окружения отдельно зафиксировать его реальные версии: код выводит версии Pillow/LittleCMS.

## Следующие задачи — НЕ выполнены

1. **037B2b-2b / P1:** получить оригинальные CC0 JPEG-байты; дополнительно проверить лицензию, фактический EXIF/ICC и color transform другим независимым инструментом. Закрепить original/decoded SHA-256 *после внешней рецензии*, затем clean/defect RGB16+Float32 LE SHA-256. Проверить офлайн `verify` с reviewed manifest. Исключить подмену входа только что вычисленными кандидатными hash.
2. **037B2b-3 / P1:** на реально допущенном photo bundle сохранить PSD16 и PSB32; проверить `codec-evidence.json` и persisted bytes, дополнительно отдать документы стороннему PSD/PSB reader (не только ZeTer self-codec).
3. **037C / P1:** настоящий Chromium `file://` UI import → 8288-pixel polygon → native Worker Fill → Save Project → exact Undo/Redo; минимум 3 запуска для каждого формата, per-pixel photographic oracle, fail-closed JSON и честная память (не Worker peak).
4. **P0 [002](002-psd-compatibility-corpus.md)**: независимо Photoshop-authored high-depth goldens; **Stage [003](003-tiled-content-aware.md)**: общесистемный memory/tiled production contract. Все другие крупные требования со скриншота остаются отдельными этапами.

**Граница доказательств:** тестовый синтетический JPEG не соответствует documented SHA-1 оригинала; public CLI никогда не позволяет подменить pinned source policy. Ни Adobe parity, ни реальная фото-оценка, ни независимое подтверждение ICC/EXIF этим изменением не доказаны.

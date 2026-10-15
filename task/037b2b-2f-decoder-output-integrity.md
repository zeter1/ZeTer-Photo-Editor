# 037B2b-2f — восстановление целостности пары RGBA8 / decoder evidence

**Статус: изменение в PR, итоговая CI-проверка ожидается.** Тестовая инфраструктура, не пользовательская функция и не независимый photo benchmark.

## Контекст / сбой

`tools/decode-real-photo.py` первоначально записывал `NEW-decoded.rgba`, затем `NEW-decoder.json`. При сбое открытия/сериализации второго файла можно было оставить односторонний кандидат. Кроме того, CLI использовал `Path.resolve()` и тем самым мог раскрыть целевой путь **битой symlink**: `open('xb')` защищает указанное имя, но не заранее разыменованный путь.

## Изменения

- [x] После JPEG SHA-1/EXIF/ICC/Pillow/alpha preflight публикация проходит через `publish_candidate_pair` с эксклюзивным открытием двух файлов.
- [x] При обычном исключении во время публикации новый RGBA8 и частично созданный JSON удаляются в обратном порядке; перед удалением проверяются **inode + device + обычный файл**, чтобы не удалить чужую замену.
- [x] Подготовка пути CLI через `Path.absolute()` без разыменования конечной symlink. Dangling и существующие symlink/destination отвергаются, пользовательские файлы не перезаписываются.
- [x] Добавлен offline Pillow regression `tests/decode-real-photo-output-rollback.test.mjs`: частичный JSON write, занятый JSON, late collision, замена inode на другой и dangling symlink.
- [ ] CI: `npm run check`, обязательные Pillow tests, browser smoke и diff hygiene. Заполнить фактический результат после PR.
- [ ] Проходка **не** делает запись двух файлов crash-atomic: SIGKILL/отключение питания во время записи всё ещё могут оставить частичный набор. Для приёмки использовать только complete candidate + `real-photo-bundle-cli verify` с независимыми frozen hashes.

## Следующие задачи (по приоритету)

1. **037B2b-2 (P1, open)** — скачать подлинный CC0 JPEG и вручную проверить лицензию/историю файла, независимое ICC/EXIF/визуальное качество, зафиксировать отдельные SHA-256 source / Pillow RGBA / native. В этой проходке оригинальные фото-байты не получены.
2. **037B2b-3 (P1, open)** — из подлинного зафиксированного photo bundle создать PSD16/PSB32 и проверить native layer/merged через ZeTer, Python и внешний `psd-tools`.
3. **037C (P1, open)** — настоящий Chromium `file://` import → connected ROI 8288 → Worker → Undo/Redo/Save в трёх прогонах на глубину, качество + RSS.
4. **002 (P0), Stage 003 (P0)** — реальные лицензированные Photoshop-authored high-depth PSD/PSB, дальнейшее tiled/worker/global render и RAM-budget; остальные функции из общей roadmap-таблицы не завершены.

Не утверждать, что synthetic JPEG/passed Python tests подтверждают Adobe parity или качественную обработку фотографий.

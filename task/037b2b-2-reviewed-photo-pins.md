# 037B2b-2 — закреплённые проверенные CC0 original / RGBA8 / native reference pins

**Статус (2026-10-15):** независимая локальная байтовая/визуальная проверка завершена; репозиторный manifest добавлен, CI-верификация через отдельный GitHub Actions workflow. До успешного PR/main CI не объявлять полный gate закрытым. Ветка: `feature/037b2b-reviewed-photo-pins`.

## Протокол независимой проверки

- [x] Лицензия/история: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg) содержит фотографию MartinThoma 2014 года, `Own work`, CC0 1.0; история показывает загрузку 8 августа 2014, исходный размер 2560×1920 (2 783 744 bytes), SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4`. Проверено 2026-10-15. Публикация Commons — свидетельство заявления правообладателя, а не юридическая гарантия отсутствия сторонних прав.
- [x] Скачан готовый **main workflow** [run 38768459211](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38768459211), artifact `11990253339`, ZIP SHA-256 `d1da4702dcad8e201e5fc3b3cf73ccddf2a19db31ad22da815469907110e6e88` (срок хранения до 2026-10-22). Python `hashlib` независимо подтвердил source SHA-1 и source SHA-256 `dd01cf047c9b2b7a635e29c68a52c5585d7b346f4f99713f79968ea1ea4348b8`, RGBA8 `d1aa01e37ee9944099db871be53f9d30fd00bdd12ead94ba4e09f1dd765b1641`.
- [x] Pillow **12.3.0** независимо декодировал MPO primary frame 0, `ImageOps.exif_transpose(...).convert('RGBA')` дал **0 расхождений** по 19 660 800 байтам относительно GitHub Actions / Pillow 12.0.0. OpenCV **4.13.0** (другой декодер) дал **0 расхождений** по 14 745 600 RGB-каналам.
- [x] EXIF Orientation=**1**, EXIF sub-IFD ColorSpace=**1 (sRGB)**; встроенного ICC нет. В manifest сохранён **assumed-sRGB** — это проверка исходного цветового указания, **не доказательство ICC-conversion parity**; преобразований из встроенного профиля не было. Проверено отсутствие alpha в оригинале/opaque RGBA8, визуально просмотрена фактическая неоднородная кирпичная кладка.
- [x] Независимый Python/NumPy код сформировал raw Little-Endian 1025×1025×4 RGB16 и Float32 из `decoded.rgba`, с исходными 8-bit precision, отдельным damaged, двумя островами 64×64 и 96 точками диагонального моста (**8288 пикселей**). Все четыре SHA-256 совпали с candidate CI; только после этого значения зафиксированы в [reviewed-manifest.json](../tests/fixtures/real-photo/reviewed-manifest.json).

## Постоянный проверяемый контракт

- `tests/fixtures/real-photo/reviewed-manifest.json` — фиксированные original, decoded и четыре native LE hash. Не пересчитывать его из `candidate` внутри того же CI или по сетевому URL без review.
- `tests/real-photo-reviewed-manifest.test.mjs` — offline snapshot-инварианты зафиксированных значений, source/EXIF/ICC contract и запрет ложных Photoshop/benchmark flags.
- `.github/workflows/real-photo-intake.yml` — скачивает заново ровно зафиксированный оригинал, декодирует pinned Pillow, проверяет командой `node tools/real-photo-bundle-cli.mjs verify tests/fixtures/real-photo/reviewed-manifest.json "$ZPE_PHOTO_DIR/original.jpg" "$ZPE_PHOTO_DIR/decoded.rgba"`; сверяет live candidate с reviewed manifest, требует `pinned-byte-integrity-verified`, сохраняет `reviewed-byte-proof.json` вместе с временным artifact. Ошибка любого native/source SHA закрывает gate.
- Бинарные CC0 JPEG/RGBA8 **не коммитятся**; нынешний artifact с 7-дневным retention **не является долговечным хранилищем**. Воспроизводимость зависит от доступности Commons и строгого SHA.

## Дальше (не отмечать выполненным)

- [ ] **037B2b-3:** реальный photo-derived PSD16 и PSB32 из отдельно пинованного исходника; сохранить и перепроверить on-disk codec evidence; независимый `psd-tools==1.19.0` decode на genuine photo, не на структурном surrogate. Добавить GitHub Actions step/artifact и integrity-negative tests.
- [ ] **037C:** настоящий `file://` Chromium UI: открыть PSD16/PSB32 → polygon selection 8288 → Worker → Save Project → Undo/Redo, **3 независимых запуска/формат**, quality vs frozen clean reference, честные timing/RSS missingness и artifact validation.
- [ ] P0 [002](002-psd-compatibility-corpus.md): независимые Photoshop-authored golden PSD/PSB; Stage [003](003-tiled-content-aware.md): глобальная tiled память и производительные большие проекты. Другие пункты дорожной карты со скриншота также остаются открытыми.

**Запрет заявлений:** это genuine CC0-фотография с байтовой native приёмкой; **не** поддержка sensor-native 16/32-bit, не реальный Content-Aware quality benchmark, не Adobe-authored Photoshop parity и не проверенный Worker RSS peak.

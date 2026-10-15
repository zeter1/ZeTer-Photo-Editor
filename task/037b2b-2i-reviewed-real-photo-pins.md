# 037B2b-2i — неизменяемые SHA-256 подлинного CC0 photo bundle

**Статус: код и локальная независимая проверка выполнены 2026-10-15; PR / GitHub Actions / main CI пока требуют подтверждения.** Это test-only проходка. Не считать её Adobe compatibility, Photoshop parity, доказательством абсолютной точности цвета или browser Content-Aware benchmark.

## Проведённая независимая инспекция

- **Лицензия и история:** [Commons](https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg) указывает авторство MartinThoma, собственную фотографию 7 августа 2014, CC0 1.0, оригинал от 8 августа 2014, 2560×1920. Источник — документированное самопубликуемое CC0, а не сгенерированное изображение. Отдельно проверена видимая фотография (нерегулярная кирпичная кладка, не плоская synthetic fill).
- **Source:** GitHub Actions [main artifact #11990253339](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38768459211) (до 2026-10-22), original.jpg 2 783 744 bytes, независимые SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4` и SHA-256 `dd01cf047c9b2b7a635e29c68a52c5585d7b346f4f99713f79968ea1ea4348b8`.
- **Metadata:** файл — MPO с основным frame 0 (JPEG 2560×1920), 434 байта дополнительного MPO trailer; EXIF IFD0 Orientation=1; вложенный EXIF Photo ColorSpace (40961)=1 (sRGB); встроенного ICC-профиля нет. **Следовательно, `assumed-sRGB` — документированное допущение, НЕ результат colorimetric ICC transform/проверки дисплея**.
- **Декодер:** Pillow main-intake 12.0.0 / LittleCMS 2.17, повторное независимое декодирование в локальной среде; OpenCV 4.13.0 дал 0 отличающихся RGB-каналов относительно сохранённых RGBA8; Pillow совпал побайтово на всех 19 660 800 RGBA8 байтах. SHA-256 RGBA8: `d1aa01e37ee9944099db871be53f9d30fd00bdd12ead94ba4e09f1dd765b1641`.
- **Независимые native LE слова, crop (0,0,1025,1025), ROI 8288 px:** Python/stdlib `struct.pack_into` самостоятельно произвёл RGB16/Float32 clean и defect, а не взял результат ZeTer JS candidate:
  - RGB16 clean `b1eee911c356a3815dd548d3a3d708fd8457b16e35e0eff19dc80a48429fec0a`; damaged `70816f5177ad5008ee164513931e5cf3866c0134ce1a27362df430a4594a7228`.
  - Float32 clean `48ea38caae87ac76673bd5432f04e42408ab9d032feac8677b0d025de0794f15`; damaged `5ca57278cc7e28fd440435248667ec14236b527be3609ca5f3083e0b1fb63735`.
  - При проверке независимо воспроизведены два острова 64×64 и 96-пиксельный диагональный мост; clean/defect сохраняют alpha и непомеченные пиксели. Native 16/32-bit **получены из 8-bit JPEG**, не сенсорная 16/32-bit фотография.

## Изменения

- [x] `tests/fixtures/real-photo/reviewed-manifest.json`: шесть постоянных byte pins + строгое поле decoder provenance. Не генерировать или переподписывать их во время проверки.
- [x] `tools/verify-pinned-real-photo.py`: read-only независимый Python/Pillow decode, чтение EXIF/ICC, сравнение RGBA8 и вычисление 4 native SHA-256 через `struct` без JS-кодека.
- [x] `.github/workflows/real-photo-intake.yml`: workflow теперь запускается и при изменениях frozen manifest/Python gate; автоматически сравнивает реальные скачанные bytes с pinned manifest двумя реализациями (JS + Python). Любое несовпадение должно завершать CI ошибкой; успешный JSON evidence собирается как временный artifact.
- [x] Локально на точных байтах main GitHub artifact обе декодирующие библиотеки и четыре native хеша совпали; Python read-only verifier вернул `independent-byte-pins-verified`.
- [ ] Подтвердить **новые** PR CI / workflow artifact, а затем exact-code `main` CI. Без этих свидетельств не записывать «всё зелёное».

## Запуск

```bash
python3 tools/verify-pinned-real-photo.py \
  tests/fixtures/real-photo/reviewed-manifest.json \
  original.jpg decoded.rgba decoder.json
node tools/real-photo-bundle-cli.mjs verify \
  tests/fixtures/real-photo/reviewed-manifest.json original.jpg decoded.rgba
```

Оригинал и RGBA8 не добавлены в Git. Их можно повторно получить pin-checked CI либо из временного artifact (до удаления); без соответствующих байтов gate должен завершаться ошибкой. Ни `reviewed-manifest.json`, ни автоматическая сверка не превращают сомнительный источник в доверенный и не заменяют независимую предметную экспертизу Adobe/ICC.

## Следующие задачи

1. **037B2b-3 (приоритет):** используя закреплённые photo bytes, сгенерировать и проверить **настоящие photo-derived** PSD16/PSB32 через существующий `tools/real-photo-psd-psb-cli.mjs`; выполнить отдельный Python + psd-tools native readback, сохранить строгие native/file hashes, не включать огромные бинарники в Git и не приписывать авторство Photoshop.
2. **037C:** настоящий `file://` Chromium PSD16/PSB32 import → polygon 8288 → Content-Aware Worker → Save Project → Undo/Redo, **3 независимых запуска/формат**, negative matrix, честные RSS/CDP missingness.
3. **P0 002:** отдельный набор легальных Photoshop-authored goldens и Adobe parity, в том числе маски, CMYK и adjustments.
4. **Stage 003 и остальные возможности скриншота:** full tiled memory budget / ICC и wide gamut / RAW / Smart Objects и refine edge / export compatibility. Не объявлять roadmap выполненной по прохождению этой photo gate.

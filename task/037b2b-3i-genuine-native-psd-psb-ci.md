# 037B2b-3i — реальные CC0 photo-derived PSD16/PSB32, независимый saved native readback

**Статус: код подготовлен в feature branch; CI PR/main и file-hash pins ещё требуют проверки.** Основная задача [037B2b-3](037b2b-native-psd-psb-bridge.md) до успешного genuine-photo gate и независимой фиксации артефактов остаётся OPEN.

## Цель и исходные допущения

Источник — настоящий, опубликованный как CC0 JPEG Wikimedia (2560×1920), уже зафиксированный в [037B2b-2i](037b2b-2i-reviewed-real-photo-pins.md). **Зафиксированные SHA-256 manifest не генерировать заново и не заменять результатом самопроверки ZeTer.** Декодированный RGBA8, RGB16/Float32 native words являются **8-bit-derived**, без настоящего 16/32-bit сенсорного диапазона. Заявлений про Adobe-authored Photoshop, цветовой ICC calibration, идеальное inpaint или browser quality НЕ делать.

## Что внедрено в этой проходке

- [x] `.github/workflows/real-photo-intake.yml`: после самостоятельного frozen JPEG/Pillow/JS+Python byte gate создаёт **из настоящих photo bytes**, а не синтетического суррогата, `native-documents/psd16-defect.psd` и `native-documents/psb32-defect.psb`.
- [x] Повторный `node tools/real-photo-psd-psb-cli.mjs verify` читает **сохранённые** файлы и сравнивает native word layer+merged с pinned RGB16/Float32 SHA и 8288 connected ROI.
- [x] `tools/verify-photo-native-artifact-set.py`: независимо берёт SHA-256 байтов **с диска**, запускает Python/std-lib raw PSD/PSB reader и pinned сторонний `psd-tools==1.19.0`; проверяет format, размеры, file hash, native layer+merged hash, отсутствие Photoshop/benchmark claims и публикует отдельный JSON через exclusive create.
- [x] Отдельный 7-дневный GitHub Actions artifact `zpe-real-photo-native-psd-psb` содержит PSD, PSB, ZeTer proof и независимый native-readback JSON; оригинал/decoded/PSD/PSB не добавляются в Git.
- [x] `tests/real-photo-native-artifact-set.test.mjs`: негативные случаи forged source pin, ROI, Photoshop claim и symlink; отказ до записи success receipt.
- [ ] PR CI **на реальном источнике**, включая оба independent readers, должен завершиться success на точном commit SHA.
- [ ] Отдельно зафиксировать полученные file SHA-256 из подлинного CI artifact **после проверки**, не считать hash из ZeTer writer независимым golden.
- [ ] Merge и main CI exact-code success. Только после этого можно закрыть 037B2b-3i/3.

## Повторяемый gate

```bash
node tools/real-photo-psd-psb-cli.mjs \
  tests/fixtures/real-photo/reviewed-manifest.json original.jpg decoded.rgba NEW-DIR
node tools/real-photo-psd-psb-cli.mjs verify \
  tests/fixtures/real-photo/reviewed-manifest.json original.jpg decoded.rgba NEW-DIR
python3 tools/verify-photo-native-artifact-set.py \
  tests/fixtures/real-photo/reviewed-manifest.json NEW-DIR
```

Перед этим **обязательно** проверить `original.jpg` / `decoded.rgba` / decoder metadata через `tools/verify-pinned-real-photo.py` и JS `tools/real-photo-bundle-cli.mjs verify`, как делает workflow. В Python venv должен быть `psd-tools==1.19.0`. Генерация требует НОВУЮ директорию, JSON readback публикуется эксклюзивно и не переписывает ранее проверенное свидетельство.

## Следующие проходки

1. **037B2b-3j:** независимый review двух сохранённых файлов (format/ICC/color limitations, separate frozen file SHA-256), exact evidence и gate на повторных genuine download + export. Это отдельное доказательство, не Adobe compatibility.
2. **037C:** настоящий Chromium `file://`: import photo-derived PSD16 и PSB32 → редактирование 8288 ROI Content-Aware native Worker → Save Project → Undo/Redo, **3 независимых запуска на формат**, native pixel quality / bounded timing и наблюдаемая память + missingness.
3. **P0 002 и Stage 003:** независимые Photoshop-authored лицензированные goldens, полная tiled/peak-memory и color/CMYK parity; большой roadmap со скриншота по-прежнему открыт.

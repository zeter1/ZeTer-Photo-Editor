# 037B2b-3i — реальные CC0 photo-derived PSD16/PSB32, независимый saved native readback

**Статус: 037B2b-3 ЗАКРЫТА 2026-10-15: [PR #245](https://github.com/zeter1/ZeTer-Photo-Editor/pull/245) → [bae8c3e](https://github.com/zeter1/ZeTer-Photo-Editor/commit/bae8c3e0f8b790aed03a1896621a8a7a5fddd21e); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776136935), [PR genuine-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776137238), [exact main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776698341), [main genuine-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776698440).** Основная задача [037B2b-3](037b2b-native-psd-psb-bridge.md) до успешного genuine-photo gate и независимой фиксации артефактов остаётся OPEN.

## Цель и исходные допущения

Источник — настоящий, опубликованный как CC0 JPEG Wikimedia (2560×1920), уже зафиксированный в [037B2b-2i](037b2b-2i-reviewed-real-photo-pins.md). **Зафиксированные SHA-256 manifest не генерировать заново и не заменять результатом самопроверки ZeTer.** Декодированный RGBA8, RGB16/Float32 native words являются **8-bit-derived**, без настоящего 16/32-bit сенсорного диапазона. Заявлений про Adobe-authored Photoshop, цветовой ICC calibration, идеальное inpaint или browser quality НЕ делать.

## Что внедрено в этой проходке

- [x] `.github/workflows/real-photo-intake.yml`: после самостоятельного frozen JPEG/Pillow/JS+Python byte gate создаёт **из настоящих photo bytes**, а не синтетического суррогата, `native-documents/psd16-defect.psd` и `native-documents/psb32-defect.psb`.
- [x] Повторный `node tools/real-photo-psd-psb-cli.mjs verify` читает **сохранённые** файлы и сравнивает native word layer+merged с pinned RGB16/Float32 SHA и 8288 connected ROI.
- [x] `tools/verify-photo-native-artifact-set.py`: независимо берёт SHA-256 байтов **с диска**, запускает Python/std-lib raw PSD/PSB reader и pinned сторонний `psd-tools==1.19.0`; проверяет format, размеры, file hash, native layer+merged hash, отсутствие Photoshop/benchmark claims и публикует отдельный JSON через exclusive create.
- [x] Отдельный 7-дневный GitHub Actions artifact `zpe-real-photo-native-psd-psb` содержит PSD, PSB, ZeTer proof и независимый native-readback JSON; оригинал/decoded/PSD/PSB не добавляются в Git.
- [x] `tests/real-photo-native-artifact-set.test.mjs`: негативные случаи forged source pin, ROI, Photoshop claim и symlink; отказ до записи success receipt.
- [x] **Первый** genuine-photo PR CI success на коде до записи file pins: [run #38775589788](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38775589788). Native gate реально выполнен; independent Python + psd-tools readback прошёл на сохранённых PSD16/PSB32.
- [x] **Повторный PR CI** на exact-code с обязательными frozen-file pins: [success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776136935), [genuine-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776137238).
- [x] Из CI artifact #11993296690 **отдельно скачаны** реальные binary PSD/PSB и проверены SHA-256 через независимый Python `hashlib`: PSD16 `6749ddddb9338a25197a3d2961ce5c1f555fd4ef677d14aa8c0ce73d7225a403` (16 810 260 bytes), PSB32 `a8cfa8b2dcd745550784e86216eeb39574c9da7cc76a95db502dc4056f8a778a` (33 620 288 bytes). Frozen файл: `tests/fixtures/real-photo/reviewed-native-artifacts.json`; проверяющий скрипт сравнивает новые saved files **с этим эталоном**, а не только с `codec-evidence.json`.
- [x] Merge и exact-code main CI success: [bae8c3e](https://github.com/zeter1/ZeTer-Photo-Editor/commit/bae8c3e0f8b790aed03a1896621a8a7a5fddd21e), [CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776698341), [real photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38776698440). 037B2b-3 закрыта; 037C остаётся OPEN.

## Повторяемый gate

```bash
node tools/real-photo-psd-psb-cli.mjs \
  tests/fixtures/real-photo/reviewed-manifest.json original.jpg decoded.rgba NEW-DIR
node tools/real-photo-psd-psb-cli.mjs verify \
  tests/fixtures/real-photo/reviewed-manifest.json original.jpg decoded.rgba NEW-DIR
python3 tools/verify-photo-native-artifact-set.py \
  tests/fixtures/real-photo/reviewed-manifest.json NEW-DIR \
  tests/fixtures/real-photo/reviewed-native-artifacts.json
```

Перед этим **обязательно** проверить `original.jpg` / `decoded.rgba` / decoder metadata через `tools/verify-pinned-real-photo.py` и JS `tools/real-photo-bundle-cli.mjs verify`, как делает workflow. В Python venv должен быть `psd-tools==1.19.0`. Генерация требует НОВУЮ директорию, JSON readback публикуется эксклюзивно и не переписывает ранее проверенное свидетельство.

## Следующие проходки

1. **[037C](037c-real-photo-chromium-worker-acceptance.md):** настоящий Chromium `file://`: import photo-derived PSD16 и PSB32 → редактирование 8288 ROI Content-Aware native Worker → Save Project → Undo/Redo, **3 независимых запуска на формат**, native pixel quality / bounded timing и наблюдаемая память + missingness.
2. **P0 002 и Stage 003:** независимые Photoshop-authored лицензированные goldens, полная tiled/peak-memory и color/CMYK parity; большой roadmap со скриншота по-прежнему открыт.

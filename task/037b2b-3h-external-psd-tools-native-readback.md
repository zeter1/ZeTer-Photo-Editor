# 037B2b-3h — сторонний psd-tools PSD16/PSB32 native readback

**Статус: в работе (ветка `codex/037b2b-3h-external-psd-reader`; до прохождения PR CI не считать закрытой).**

## Зачем

Предыдущие 037B2b-3a…3g проверяли PSD16/PSB32 кодеком ZeTer и собственным Python/std-lib чтением. Это полезная паритетность, но не независимый сторонний decoder. В этой проходке отдельный пакет `psd-tools==1.19.0` читает PSD/PSB секции и раскладывает исходные native каналы без преобразования в 8-битный PIL/Canvas.

## Реализуемая проверка

- [x] Добавлен отдельный `tools/verify-real-photo-psd-external.py`, основанный на `psd_tools.psd.PSD.read`, `_get_layer_info`, `ChannelData.get_data` и `ImageData.get_data`. Никаких импортов ZeTer PSD codec или собственного Python reader.
- [x] Проверяются PSD v1 RGB16 / PSB v2 RGB Float32, четыре канала RGBA, геометрия, единственный full-canvas слой, raw layer и merged composite; raw BE samples → LE RGBA words, SHA-256 слоя и merged в отдельности.
- [x] На входе обязательны независимо закреплённые native и file SHA-256; несовпадения, перепутанная битность/геометрия и реподписанный испорченный merged канал отвергаются.
- [x] Node negative/positive tests на `structural surrogate` и CI-зависимость `psd-tools==1.19.0`. Синтетический вход **НЕ** является настоящим JPEG.
- [ ] Завершить PR CI, провести merge и проверить exact-code main CI.
- [ ] Прогнать эти команды на **подлинных** pinned real-photo PSD16/PSB32 (пока не получены, 037B2b-2/3 остаются открыты).

## Ручной gate после получения настоящего фото

```bash
python3 tools/verify-real-photo-psd-external.py PSD16 path/to/psd16-defect.psd WIDTH HEIGHT EXPECTED_RGB16_DAMAGED_SHA256 EXPECTED_PSD_FILE_SHA256
python3 tools/verify-real-photo-psd-external.py PSB32 path/to/psb32-defect.psb WIDTH HEIGHT EXPECTED_FLOAT32_DAMAGED_SHA256 EXPECTED_PSB_FILE_SHA256
```

Два native SHA должны совпасть с **отдельно рецензированным**, а не вычисленным на месте pin. Сравнение битовое: включая Float32 special values, не через float/8-bit preview. Результат намеренно маркируется `external-psd-tools-native-readback-only` / `photoshopParityVerified:false` / `realPhotoVerified:false`.

## Далее

1. **P1 037B2b-2:** законный CC0 оригинал Wikimedia, реальная JPEG entropy decode, внешняя ICC/EXIF/color review, SHA-256 оригинала, декодированного RGBA8 и native clean/defect, затем офлайн verify.
2. **P1 037B2b-3:** создать реальные PSD16/PSB32 и подтвердить одновременно ZeTer + Python/std-lib + psd-tools. Нельзя заявлять Photoshop-authored compatibility.
3. **P1 037C:** Chromium `file://` полноценный UI import → 8288 ROI → native Worker → Save/Undo/Redo три независимых прогона на формат, quality и observational memory.
4. **P0 002 / Stage 003:** настоящий Adobe-authored корпус и глобальный tiled/memory бюджет остаются отдельно открыты.

**Примечание:** только tools/tests/CI/task; production app/version 1.46.1 не затронуты.

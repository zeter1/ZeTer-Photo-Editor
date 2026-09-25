# Stage 16a — Photoshop Adjustment Layer fixtures

Эта папка содержит реальные внешние PSD fixtures из `psd-tools/psd-tools`, закреплённые на commit `8f9a25ea98202061365701db54ce938931b27c09`.

Набор покрывает пять Photoshop adjustment records:

- `brit + CgEd` — Brightness/Contrast;
- `expA` — Exposure;
- `hue2` — Hue/Saturation;
- `levl` — Levels;
- `curv` — Curves.

Fixtures не генерируются ZeTer Photo Editor и не скачиваются в CI. `manifest.json` фиксирует upstream Git blob, размер и SHA-256. Лицензия upstream — MIT; notice лежит рядом в `LICENSE-psd-tools-MIT.txt`.

Stage 16a использует их как независимый container/metadata oracle: decoder обязан распознать zero-bounds adjustment layer, сохранить raw Additional Layer Info, получить bounded semantic model и после safe writeback снова декодировать изменённые параметры из PSD и PSB.

## Stage 16b — masks, clipping, channel-specific Levels и editable Curves

Корпус расширен ещё четырьмя реальными MIT fixtures из того же pinned upstream commit:

- `adjustment-mask.psd` — zero-bounds Brightness/Contrast с настоящим raster mask channel `-2`;
- `clip-adjustment.psd` — Hue/Saturation с Photoshop clipping byte;
- `curves-rgb.psd` — несколько настоящих RGB Curves с point-based master/channel curves;
- `levels-rgb.psd` — Levels с независимыми master/Red/Green/Blue records.

Stage 16b использует их для regression-проверки: document-sized raster mask projection, native mask/clipping PSD/PSB round-trip, channel-specific Levels writeback и Curves v1 point-curve rebuild. CI остаётся hermetic: bytes закреплены в репозитории и проверяются manifest SHA-256.


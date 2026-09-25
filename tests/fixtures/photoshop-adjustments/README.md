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

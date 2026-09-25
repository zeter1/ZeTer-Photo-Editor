# Stage 13e — ICC / PSD / PSB compatibility corpus

Эта папка — hermetic regression corpus для color-management и Photoshop-compatible контейнеров. Тесты никогда не скачивают fixtures из сети: bytes закреплены в репозитории, а `corpus-manifest.json` фиксирует upstream commit, Git blob, размер и SHA-256.

## Источники и лицензии

- `CGATS001Compat-v2-micro.icc` и `DisplayP3-v4.icc` взяты из `saucecontrol/Compact-ICC-Profiles` на commit `bdd84663061bc4ae95ca70decff54f581e27f702`. Upstream публикует коллекцию под **CC0 1.0 Universal**; полный текст сохранён в `LICENSE-Compact-ICC-Profiles-CC0.txt`.
- `psd-tools-4x4-8bit-cmyk.psd` и `psd-tools-group.psb` взяты из regression corpus `psd-tools/psd-tools` на commit `8f9a25ea98202061365701db54ce938931b27c09`. Upstream repository распространяется по **MIT License**; notice сохранён в `LICENSE-psd-tools-MIT.txt`.

## Независимый oracle

`lcms-2.19-golden.json` не вычисляется кодом ZeTer Photo Editor. Векторы получены через **Pillow 12.3.0 / LittleCMS 2.19**:

- source: реальный CC0 CMYK profile `CGATS001Compat-v2-micro.icc`;
- destinations: LittleCMS built-in sRGB и реальный CC0 `DisplayP3-v4.icc`;
- rendering intent: Perceptual;
- дополнительно сохранены LittleCMS 8-bit Lab values и derived PCS XYZ D50.

Это даёт независимый test oracle: небольшой mutation в ICC LUT/PCS/display math должен нарушить golden-vector tolerance.

Для регенерации используйте `python tools/generate-icc-goldens.py` в изолированном окружении с `Pillow==12.3.0`. Регенерация golden-файла допустима только после осознанной проверки reference-engine/version drift; CI сам golden-файл не перезаписывает.

## Что доказывает corpus

1. реальный CMYK ICC `mft2/A2B0` согласуется с LittleCMS по PCS Lab/XYZ и display RGB в заданных допусках;
2. реальный Display P3 v4 matrix/TRC profile проходит application display-transform;
3. внешний CMYK PSD с большим printer ICC декодируется в native CMYK PixelBuffer и может пройти ZPE raster/native PSD round-trip с сохранением ICC bytes;
4. внешний layered PSB v2 декодируется с group/vector-mask/ICC metadata без synthetic writer fixture.

Corpus не заявляет pixel-identical Photoshop parity для proprietary text/smart-object/adjustment semantics — это следующий этап.

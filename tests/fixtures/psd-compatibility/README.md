# Генерируемый PSD/PSB corpus — nested groups + masks + adjustments

Сценарий: `tests/psd-masked-group-corpus.test.mjs`. На каждой проверке два файла (PSD v1 и PSB v2) строятся **в памяти** одной и той же детерминированной fixture-фабрикой; бинарные файлы не коммитятся.

## Provenance

- Цветовые RGBA-пиксели, alpha-маски, вложенные group markers, opacity, visibility и clipping заданы непосредственно в тесте, без внешних зависимостей.
- Photoshop `brit`/`CgEd` Additional Layer Info берутся из закреплённого внешнего файла `tests/fixtures/photoshop-adjustments/brightness-contrast.psd` (upstream `psd-tools/psd-tools`, commit `8f9a25ea98202061365701db54ce938931b27c09`, MIT). Его SHA-256 и Git blob закреплены в `tests/fixtures/photoshop-adjustments/manifest.json`; исходная лицензия — `tests/fixtures/photoshop-adjustments/LICENSE-psd-tools-MIT.txt`.
- После генерации codec-import проверяет group hierarchy, raster/adjustment masks, disabled state, clipping и число слоёв. Затем повторный экспорт/импорт сравнивается с нормализованной semantic snapshot, включая raw Photoshop adjustment block SHA-256. Проверяется эквивалентность семантики PSD и PSB.
- Проверка детерминизма повторной генерации выполняется по SHA-256 полных выходных байтов.

## Независимый byte-level oracle масок

В `tests/psd-masked-group-corpus.test.mjs` добавлена отдельная проверка исходных **записанных PSD v1/PSB v2 байтов** (не повторного `decodePsd`): парсер ограничен тестовым 8-bit RGB corpus и самостоятельно читает `lsct` section dividers, clipping, folder flags/opacity, `-2` mask channels, размеры/флаги mask header и PackBits row tables (2 байта PSD, 4 байта PSB). Он сравнивает альфу трёх масок с заданными константами (включая отключённую), а группу `Inner` — с флагом visibility и opacity 153/255. Таким образом проверяется wire semantics независимо от логики `decodePsd`; это **не** сторонний Photoshop reference renderer.

## Ограничения

Этот тест подтверждает **внутреннюю** round-trip стабильность ZPE codec, не независимое открытие в Adobe Photoshop и не pixel-level сравнение Photoshop rendered composite. Изменение composite preview здесь не тестируется: codec при наличии слоёв не возвращает прочитанный merged composite. Не считать этот self-generated corpus доказательством полной Photoshop compatibility. Следующая часть задачи `task/002-psd-compatibility-corpus.md` — внешний reference preview/semantic oracle, а также реальные групповые masks/adjustments из независимо созданных Photoshop файлов.

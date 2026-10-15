# 037B2b-2h — GitHub Actions acquisition of genuine CC0 photo candidate

**Статус: CI intake код добавлен; настоящее photo-admission 037B2b-2 всё ещё OPEN.** Скрипты источника и Pillow уже существовали; эта проходка соединяет их в отдельный реальный GitHub Actions workflow, а не в очередную синтетическую проверку.

## Почему это нужно

Предыдущие offline tests использовали structural JPEG surrogate, непригодный для декодирования. Рабочая среда текущей проходки не имеет DNS-доступа к `upload.wikimedia.org`. Нельзя объявить 037B2b-2 завершённой, переподписав синтетические данные или вычислив хеши без реального оригинала.

## Источник / provenance review (2026-10-15)

- [Wikimedia Commons: Red-brick-wall-texture-clean.jpg](https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg) — MartinThoma, собственная фотография от 7 августа 2014 года, явно заявленная CC0 1.0. Отдельно просмотреть карточку и её историю перед фиксацией fixture.
- Карточка указывает JPEG **2560×1920, 2 783 744 bytes, SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4`**, EXIF Orientation Normal, Exif Color space sRGB. Это метаданные Commons, НЕ независимо полученные source/ICC/EXIF bytes.
- В workflow закреплён один исходный URL, исходный SHA-1 и точная длина оригинала; SHA-256 после скачивания вычисляется независимо Node/Python, но остаётся **кандидатом** до внешней review.

## Что добавлено

- [x] `.github/workflows/real-photo-intake.yml`: отдельный workflow на ручной `workflow_dispatch` и однократный `push main` по изменению собственного YAML (не запускается на каждом PR).
- [x] Пинованные Node 24, Pillow 12.0.0, проверенный HTTPS downloader (redirect denied, 32 MiB limit, SHA-1 до сохранения), JPEG metadata inspection, настоящий Pillow JPEG entropy decode с EXIF/ICC и offline bundle-candidate.
- [x] Независимая Python-перепроверка SHA-1, **source/decoded SHA-256**, размера 2 783 744, RGBA8 19 660 800 bytes, нескольких JSON evidence и candidate manifest. Искажение/рассогласование приводит к fail, без выдачи фальшивого reviewed pin.
- [x] GitHub Actions artifact `zpe-real-photo-unreviewed-candidate` (7 дней): оригинальный JPEG, decoded.rgba, acquisition/inspection/decoder evidence, bundle-candidate, SHA256SUMS, unreviewed receipt. Нет коммита бинарных фото в репозиторий и нет автоматического допуска fixture.
- [ ] Зафиксировать URL успешного workflow run и artifact hash после реального запуска; при сетевой ошибке сохранить статус **blocked**, не переписывать SHA-1 / зеркало для обхода.
- [ ] Независимо обозреть license/history/EXIF/ICC и визуальные пиксели, сверить альтернативным декодером, зафиксировать исходный, RGBA и native clean/defect SHA-256 в reviewed manifest в отдельном коммите.
- [ ] 037B2b-3: сделать реальные photo-derived PSD16/PSB32 native fixtures, внешние декодеры и реальный Chromium 037C×3/формат.

## Как использовать

1. Перейти в GitHub Actions → **Real-photo CC0 intake (unreviewed)** → Run workflow (или открыть автоматический main push run после merge). Workflow ограничен фиксированной лицензированной фотографией.
2. Скачать `zpe-real-photo-unreviewed-candidate` в течение 7 дней; проверить `SHA256SUMS`, `ci-candidate-receipt.json` и `bundle-candidate.json`.
3. **Вручную** сравнить с опубликованными Commons историей/лицензией, ICC/EXIF и независимым JPEG декодером. Только после review создать внешне закреплённый manifest. Не брать `candidate` как `reviewed` автоматически.
4. Продолжить [037B2b-2 → 3 → 037C](037-real-photo-connected-roi-benchmark.md) и [P0 Photoshop corpus 002](002-psd-compatibility-corpus.md) / [tiled 003](003-tiled-content-aware.md).

## Чего не доказывает эта проходка

Даже успешный Action не доказывает полноценную цветовую / визуальную review, native Photoshop compatibility, реальную PSB32 вычислительную эффективность, пиксельную точность Content-Aware Fill, настоящую worker RSS memory peak или завершение screenshot roadmap. Полученные SHA-256 — только кандидаты с воспроизводимой цепочкой происхождения, **не фиксация внешне рецензированных hash pin**.

> **037B2b-2h слита / точные CI-проверки успешны (2026-10-15):** [PR #242](https://github.com/zeter1/ZeTer-Photo-Editor/pull/242) → [75da6c86](https://github.com/zeter1/ZeTer-Photo-Editor/commit/75da6c86b5c15640387a2bfedb549ed6ab79a54f); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38767842768), [exact-code main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38768459017) (Chromium file:// в том числе), [main real-photo intake](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38768459211) — **success**. [Артефакт main](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38768459211) `11990253339`, хранение до 2026-10-22. Следующая OPEN 037B2b-2 — независимый reviewed manifest и license/ICC/color approval, затем 037B2b-3, 037C, P0 002 / Stage 003.

> **037B2b-2h intake SUCCESS (2026-10-15, [PR #242](https://github.com/zeter1/ZeTer-Photo-Editor/pull/242), [real-photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38767164287)).** Настоящий CC0 original + Pillow RGBA8 получены в GitHub Actions. Artifact `zpe-real-photo-unreviewed-candidate` ID `11989382184`, retention до 2026-10-22; архив SHA-256 `84687bd1bef99733e22d751529f03876e48bfe4b4995a5082da23ec4693df227`. Не отмечать `037B2b-2` полностью закрытой до persistent reviewed pins и независимой цветовой рецензии.

## Реальные результаты и независимая проверка (2026-10-15)

- **Источник:** точный Wikimedia SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4`; размер **2 783 744 bytes**; source SHA-256 **candidate** `dd01cf047c9b2b7a635e29c68a52c5585d7b346f4f99713f79968ea1ea4348b8`.
- **Pillow 12.0.0 / LittleCMS 2.17:** реальный MPO container (2 кадра по локальной независимой инспекции, первый frame 0 — основной JPEG 2560×1920), JPEG EOI at 2783308 и известный 434-byte trailer; EXIF Orientation **1**, встроенного ICC **нет**, `assumed-sRGB` (sRGB заявлен в metadata Commons; профиль не встроен). Точный RGBA8 19 660 800 bytes SHA-256 **candidate** `d1aa01e37ee9944099db871be53f9d30fd00bdd12ead94ba4e09f1dd765b1641`.
- **Независимое readback из загруженного GitHub artifact:** Python SHA-1/SHA-256 полностью совпали с Node CI; локальный Pillow 12.3.0 повторно дал тот же RGBA8 SHA-256; OpenCV 4.13.0 отдельно декодировал основное изображение с **0 отличающихся из 14 745 600 RGB каналов** (max/mean absolute difference = 0). Визуальный просмотр уменьшенного изображения: неоднородная настоящая кирпичная кладка, без очевидного пустого/подставного raster. Это проверка данного декодирования, а не общая гарантия любого фото/профиля.
- **Кандидаты native SHA-256 (ещё НЕ externally pinned)**: RGB16 clean `b1eee911c356a3815dd548d3a3d708fd8457b16e35e0eff19dc80a48429fec0a`, damaged `70816f5177ad5008ee164513931e5cf3866c0134ce1a27362df430a4594a7228`; Float32 clean `48ea38caae87ac76673bd5432f04e42408ab9d032feac8677b0d025de0794f15`, damaged `5ca57278cc7e28fd440435248667ec14236b527be3609ca5f3083e0b1fb63735`. Derived from RGBA8 (не true sensor 16/32-bit capture).
- **CI gate:** [real-photo intake success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38767164287), raw/download/entropy/Pillow/fingerprint/manifest/upload пройдены; artifact доступен через GitHub Actions и сохранён локально для отдельной проверки. Общий `npm run check`/Chromium PR CI — проверить отдельно перед merge.

# 037B2b-2h — GitHub Actions acquisition of genuine CC0 photo candidate

**Статус: реальный CC0 intake SUCCESS; окончательная reviewed-manifest приёмка 037B2b-2 всё ещё OPEN.** Скрипты источника и Pillow уже существовали; эта проходка соединяет их в отдельный реальный GitHub Actions workflow, а не в очередную синтетическую проверку.

## Почему это нужно

Предыдущие offline tests использовали structural JPEG surrogate, непригодный для декодирования. Рабочая среда текущей проходки не имеет DNS-доступа к `upload.wikimedia.org`. Нельзя объявить 037B2b-2 завершённой, переподписав синтетические данные или вычислив хеши без реального оригинала.

## Источник / provenance review (2026-10-15)

- [Wikimedia Commons: Red-brick-wall-texture-clean.jpg](https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg) — MartinThoma, собственная фотография от 7 августа 2014 года, явно заявленная CC0 1.0. Отдельно просмотреть карточку и её историю перед фиксацией fixture.
- Карточка указывает JPEG **2560×1920, 2 783 744 bytes, SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4`**, EXIF Orientation Normal, Exif Color space sRGB. Это метаданные Commons, НЕ независимо полученные source/ICC/EXIF bytes.
- В workflow закреплён один исходный URL, исходный SHA-1 и точная длина оригинала; SHA-256 после скачивания вычисляется независимо Node/Python, но остаётся **кандидатом** до внешней review.

## Что добавлено

- [x] `.github/workflows/real-photo-intake.yml`: отдельный workflow на ручной `workflow_dispatch`, `pull_request` c изменением собственного YAML и `push main` по изменению собственного YAML (не запускается на каждом PR). PR-проверка позволяет обнаружить сетевые/декодерные проблемы до merge.
- [x] Пинованные Node 24, Pillow 12.0.0, проверенный HTTPS downloader (redirect denied, 32 MiB limit, SHA-1 до сохранения), JPEG metadata inspection, настоящий Pillow JPEG entropy decode с EXIF/ICC и offline bundle-candidate.
- [x] Независимая Python-перепроверка SHA-1, **source/decoded SHA-256**, размера 2 783 744, RGBA8 19 660 800 bytes, нескольких JSON evidence и candidate manifest. Искажение/рассогласование приводит к fail, без выдачи фальшивого reviewed pin.
- [x] GitHub Actions artifact `zpe-real-photo-unreviewed-candidate` (7 дней): оригинальный JPEG, decoded.rgba, acquisition/inspection/decoder evidence, bundle-candidate, SHA256SUMS, unreviewed receipt. Нет коммита бинарных фото в репозиторий и нет автоматического допуска fixture.
- [x] Зафиксированы успешные PR/main workflow и artifact hash; источник получен строго по фиксированному URL без переписывания SHA-1. Main artifact: `11990253339`, GitHub ZIP SHA-256 `d1da4702dcad8e201e5fc3b3cf73ccddf2a19db31ad22da815469907110e6e88` (архив отличается метаданными ZIP, исходные SHA-256 JPEG/RGBA не изменились).
- [ ] Независимо обозреть license/history/EXIF/ICC и визуальные пиксели, сверить альтернативным декодером, зафиксировать исходный, RGBA и native clean/defect SHA-256 в reviewed manifest в отдельном коммите.
- [ ] 037B2b-3: сделать реальные photo-derived PSD16/PSB32 native fixtures, внешние декодеры и реальный Chromium 037C×3/формат.

## Как использовать

1. Проверить автоматический PR run изменения workflow либо открыть GitHub Actions → **Real-photo CC0 intake (unreviewed)** → Run workflow (доступно после merge; также будет main push run). Workflow ограничен фиксированной лицензированной фотографией.
2. Скачать `zpe-real-photo-unreviewed-candidate` в течение 7 дней; проверить `SHA256SUMS`, `ci-candidate-receipt.json` и `bundle-candidate.json`.
3. **Вручную** сравнить с опубликованными Commons историей/лицензией, ICC/EXIF и независимым JPEG декодером. Только после review создать внешне закреплённый manifest. Не брать `candidate` как `reviewed` автоматически.
4. Продолжить [037B2b-2 → 3 → 037C](037-real-photo-connected-roi-benchmark.md) и [P0 Photoshop corpus 002](002-psd-compatibility-corpus.md) / [tiled 003](003-tiled-content-aware.md).

## Чего не доказывает эта проходка

Даже успешный Action не доказывает полноценную цветовую / визуальную review, native Photoshop compatibility, реальную PSB32 вычислительную эффективность, пиксельную точность Content-Aware Fill, настоящую worker RSS memory peak или завершение screenshot roadmap. Полученные SHA-256 — только кандидаты с воспроизводимой цепочкой происхождения, **не фиксация внешне рецензированных hash pin**.

# CAP-RAW-DNG-BLACKLEVEL-DELTA — signed sensor-space H/V (v1.47.4)

**20 ноября 2026 · Stage 9 · P1 · IN PROGRESS.** Ограниченная реализация кода и Windows acceptance локально завершены; выпуск на GitHub и Linux CI/merge ещё **НЕ проводились**. Stage 9 в целом не DONE.

## Основание, зависимости и объём

- GitHub `main` `ddd90d3be9c20092b043a3ea4761795177f7a94c`, [exact-main CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43923939475) только для опубликованного main.
- GitHub [#397 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397), head `bf6dd6628e2934dc39965fb8cf9058919d2dc9af`, [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733301) + [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733325), reviews 0. [#398 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398), head `05c48eb8398aea57b0470fcaacf50801503c1fa3`, stacked на #397, Linux PR-head CI не запускался из-за target branch != main.
- Текущий локальный код наследует `c3153dc` (`CAP-RAW-DNG-BLACKLEVEL-REPEAT`, SOF3 mixed scans 1+2+1) и реализован в `G:\МОЯ Веб-разработка\ZeTer Photo Editor\ZeTer-Photo-Editor-raw-next`, ветка `feat/raw-dng-blacklevel-delta-20261120`. **Production commit `3744a4cb8bcbeb1ba2195fe598b6f48882900782`**.
- Позже при проверке других веток найден уже существовавший код Delta на отдельной расходящейся RAW-линии (commit `6b7db54` ветки `feat/raw-dng-forward-matrix-20261116`); это **не претензия на новую уникальную функцию**. Здесь Delta впервые интегрирована в более свежую 20 ноября периодическую BlackLevel/mixed-SOF3 линию, без повторения ранних features.
- Scope: только тестовый checkout. Запрещены скрытая 8-bit деградация, изменение исходного DNG, фиктивный camera-authored pixel oracle, force push, прямое изменение main без проверок.

## Реальные изменения

1. `src/formats/dng.js`: TIFF теги **50715 BlackLevelDeltaH** и **50716 BlackLevelDeltaV** строго `SRATIONAL`. Early fail-closed для неверного типа, count/IFD/offset; signed numerator **и** denominator, отказ при нулевом знаменателе; длины ровно ширина/высота `ActiveArea`. Для каждого исходного Bayer site вычисляется `BlackLevelRepeatDim[positiveModulo(sensor y,x относительно ActiveArea)] + DeltaH[sensor x] + DeltaV[sensor y]`. Эффективный black должен удовлетворять `0 <= level < WhiteLevel`; вычитание **после** `LinearizationTable`, **до** bilinear demosaic, DefaultCrop/DefaultScale, Orientation и sRGB. Для внешней CFA border интерполяции калибровка Delta ограничивается ближайшими ActiveArea column/row. Нет модификации native DNG source.
2. `tests/fixtures/dng-fixture.mjs` и **новый** `tests/dng-blacklevel-delta.test.mjs`: II/MM, сенсорные H/V, отрицательные values и отрицательный rational denominator, только H/только V, устаревший без тегов, grids 1×1/2×2/2×4, crop/scale/orientation, 8-bit stored → 16-bit LUT, corruption type/count/offset/denominator/effective levels. Это synthetic TIFF, не реальная камера.
3. `src/document/import-controller.js`, `src/core/state.js`: `.zpe` persist/reopen `rawDng.blackDeltaH` и `blackDeltaV` **boolean provenance flags**; source bytes остаются авторитетными, старые проекты принимаются.
4. `src/main.js`: Properties показывает H/V сенсорные поправки. `tools/browser-raw-dng-check.mjs`: настоящий Chrome FileInput → RGBA oracle → Properties → исходный native DNG в `.zpe` → reopen → Exposure/History/Undo/Redo, прежние JPEG SOF3 и PNG/PSD/PSB **rendered raster** regressions.
5. `package.json`, `README.md`, `CHANGELOG.md`, `src/app.bundle.js`, `index.html`, `version.json` синхронизированы на локальную версию **1.47.4** с детерминированной сборкой.

## Выполненные проверки и дефекты

- **RED до изменения production:** чтение Delta tags отказывало как unsupported. Новые тесты доказуемо падали. После исправления **47/47 focused Node PASS**, команда `node --test tests/dng-blacklevel-delta.test.mjs tests/dng-blacklevel-repeat.test.mjs tests/dng-linearization.test.mjs tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs`. Дополнительный 5-й тест с negative denominator добавлен и отдельно PASS после последнего полного Windows check.
- **PASS** `npm run build` (bundle/cache manifest build `79cf8596499f4050`), `tests/version-consistency.test.mjs` (1/1), `git diff --check`.
- **PASS** `npm run test:browser:raw-dng` — настоящий Windows Chromium `file://`, фактический RGBA oracle, source bytes в `.zpe`, exposure/History Undo/Redo, PNG/PSD/PSB rendered raster и старые SOF3 сценарии.
- Windows полный `npm run check` — **FAIL 1737 total / 1722 PASS / 10 SKIP / 5 FAIL**: конкретно 4 теста `003T/2d-3` и 1 тест `003T/2d-2` требуют Linux `/proc`/cgroup (Windows возвращает unavailable). Не называть общий check PASS. Лог `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-blacklevel-delta-final47.log`. Повторный полный прогон уже включает дополнительный 5-й focused test (47/47).
- **NOT RUN:** Linux core/independent real-photo CI на новой ветке, GitHub review, PR/merge/exact-main CI, внешний независимый camera-authored LibRaw/RawTherapee pixel oracle. Внешняя provenance по-прежнему BLOCKED.

## Точная следующая задача — без переписывания уже готового

**CAP-RAW-DNG-PACKED-BAYER-PORT (P1 TODO)**: перенести существующий bounded packed 10/12/14-bit uncompressed TIFF Bayer из отдельной локальной ветки `feat/raw-dng-forward-matrix-20261116`, commit `f9e8452`, в текущий рабочий SOF3 mixed-scan + periodic BlackLevelRepeatDim + signed Delta стек. Проверить независимые II/MM packed pixel oracles, illegal layout/truncated fail-closed, LUT/WhiteLevel/ColorMatrix/ActiveArea/DefaultCrop/DefaultScale/Orientation, `.zpe` source, History/Undo/Redo, реальные Chrome `file://` pixel/PNG/PSD/PSB rendered raster regressions. Далее портировать **уже реализованные** ForwardMatrix `8bfcd0e` и Highlights/Shadows `3f1d0ad` (ветка `feat/raw-dng-tonal-controls-20261116`), не начинать их повторно.

Публикация: отдельный прямой GitHub write permission gate по локальному навыку, затем #397 → retarget #398 → exact Linux CI/reviews → local stack PR → exact-main CI; не force-push. Camera-authored corpus и independent pixels остаются BLOCKED.

[NEXT](NEXT.md) · [Матрица](CAPABILITY_MATRIX.md) · [Карта](README.md) · [предыдущий bounded срез](002-raw-dng-blacklevel-repeat.md).

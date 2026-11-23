# CAP-RAW-DNG-BLACKLEVEL-REPEAT — BlackLevelRepeatDim sensor-space (v1.47.3)

**20 ноября 2026 · Stage 9 · P1 · IN PROGRESS:** самостоятельный ограниченный функциональный срез локально реализован и принят в Node + реальном Windows Chromium. GitHub публикация, Linux PR-head CI, merge и exact-main CI **NOT RUN**. Полная RAW/DNG совместимость не принята.

## Исходное состояние и основание продолжения

- Точный GitHub main: `ddd90d3be9c20092b043a3ea4761795177f7a94c`; [main CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43923939475), не относится к этому коду.
- #397 ColorMatrix открыт, head `bf6dd6628e2934dc39965fb8cf9058919d2dc9af`; [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733301) и [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733325) SUCCESS, 13 checks, review 0. #398 DefaultCrop открыт и stacked на #397, head `05c48eb8398aea57b0470fcaacf50801503c1fa3`; 0 checks, exact-head CI NOT RUN.
- Локальная исходная ветка `feat/raw-dng-sof3-multiscan-20261120`, final commit `ed8d0fa7b508867d6e18e4bfb9a2ba9e35ca371c`: previous lossless JPEG SOF3 mixed scans 1+2+1 реализованы и повторять их не требуется.
- Новая отдельная локальная ветка `feat/raw-dng-blacklevel-repeat-20261120`, **production commit `093b0dfbb26773104ab9300c778067ac828699a9`**. Worktree: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\ZeTer-Photo-Editor-raw-next`.
- Scope: только тестовый репозиторий в G:, без перезаписи иных worktree. Push/merge не разрешены локальным навыком без отдельного прямого разрешения пользователя.

## Настоящая реализация

1. `src/formats/dng.js`: читаются DNG TIFF `BlackLevelRepeatDim` (50713) как SHORT[2] **в порядке [rows,cols]**, и `BlackLevel` (50714) как SHORT/LONG/RATIONAL[1..64]. Периодическая сетка отсчитывается от верхнего левого угла `ActiveArea`, в исходных сенсорных координатах, а не от (0,0). Горизонтальная×вертикальная сетка ограничена значениями 1..8 по каждой оси, максимум 64 сайта, count точно равен произведению. Старые scalar и 2×2 варианты сохранены.
2. В исходной CFA-плоскости для каждого sample учитывается `black[positiveModulo(y - activeTop, repeatRows) * repeatCols + positiveModulo(x - activeLeft, repeatCols)]`. Уровень вычитается **после LinearizationTable** и **до** demosaic, crop, default scale, orientation, ColorMatrix/гамма; нормализация индивидуальная `clamp((linearizedSample - siteBlack) / (white - siteBlack), 0, 1)`. Все исходные x,y — координаты сенсора, а не повернутой картинки.
3. Fail-closed: неправильный TIFF type/count, отсутствующий/недопустимый repeat, сетка вне лимита, несоответствие count, некорректный rational denominator, отрицательное/нечисловое black, `black>=white`, а также пока не реализованные `BlackLevelDeltaH` и `BlackLevelDeltaV` (50715/50716). Никакого тихого «0» при наличии неподдерживаемых delta-тегов.
4. `src/document/import-controller.js` сохраняет сенсорное `blackRepeatDim` в `layer.rawDng`, оригинальные bytes не меняются. `src/core/state.js` валидирует metadata в `.zpe`, старые версии получают implicit [1,1]. В `src/main.js` RAW Properties реально показывает сетку, а Exposure/WB, History и Undo/Redo повторно проявляют изображение, не уничтожая DNG.
5. `tests/fixtures/dng-fixture.mjs` добавлены II/MM/SHORT/LONG/RATIONAL fixture без имитации camera-authored provenance; новый `tests/dng-blacklevel-repeat.test.mjs`, расширен настоящий UI browser regression `tools/browser-raw-dng-check.mjs`. Версия 1.47.3 и generated bundle/cache manifest обновлены.

## Фактическая приёмка

- RED (до production patch): 2/5 новых тестов FAIL на unsupported 1×2 / 2×1 / 4×2 и некорректных тегах, остальные PASS; GREEN: 5/5 PASS.
- `node --test tests/dng-blacklevel-repeat.test.mjs tests/dng-linearization.test.mjs tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs`: **42/42 PASS** после финальной проверки. Включает invalid TIFF и pipeline regression.
- `npm run build`: **PASS**. `node --check tools/browser-raw-dng-check.mjs`, `git diff --check`, `tests/version-consistency.test.mjs` на финальном общем прогоне **PASS**.
- `npm run test:browser:raw-dng`: **PASS, настоящий Chromium через `file://`**, FileInput для 4×2 grid → реальные midgray RGBA с независимым численным pixel oracle → RAW Properties → нативные DNG bytes в `.zpe` → reopen → Exposure/History/Undo/Redo. Прежние JPEG SOF3 1+2+1, другие RAW pipeline и PNG/PSD/PSB **rendered raster** экспортные проверки PASS; исходный RAW не выдавался за редактируемый PSD DNG слой.
- Полный Windows `npm run check` — **FAIL: 1732 tests / 1717 PASS / 10 SKIP / 5 FAIL**; все 5 относятся к Linux-specific `/proc`/cgroup тестам, которые нельзя успешно выполнять в Windows. Полный check не объявляется PASS. Фактический лог: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-blacklevel-repeat-final.log`.
- **НЕ проводились:** Linux PR-head core/independent real-photo CI на новом SHA, review, merge, post-merge main CI, независимый camera-authored/LibRaw pixel golden; никаких заявлений о них.

## Граница и точная следующая задача

**CAP-RAW-DNG-BLACKLEVEL-DELTA (P1 TODO)**: реализовать `BlackLevelDeltaH` (50715) и `BlackLevelDeltaV` (50716) в sensor-space, с TIFF **SRATIONAL** строгой валидацией count (`ActiveArea` width для H, height для V), длины/смещения/знака/нулевого знаменателя/диапазона, BlackLevelRepeatDim и LinearizationTable, применением поправок для каждого сенсорного site до demosaic, корректным WhiteLevel normalization, ActiveArea/DefaultCrop/DefaultScale/Orientation, полноценной RAW Properties/.zpe/History/Undo/Redo, II/MM Node и настоящим Chromium `file://` с фиксированным независимым pixel oracle. **В текущем коде оба тега намеренно отклоняются.** Внешнюю camera-authored DNG/LibRaw проверку учитывать как BLOCKED, а не симулировать.

Сначала согласованно завершить #397 → #398 → зависимые локальные RAW изменения, только после отдельного разрешения на push/merge и exact PR-head CI/review; не дублировать PR и не force-push.

[CURRENT](NEXT.md) · [Матрица](CAPABILITY_MATRIX.md) · [Карта](README.md) · [предыдущая реализация](002-raw-dng-jpeg-mixed-scans.md).

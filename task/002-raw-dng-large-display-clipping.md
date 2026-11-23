# CAP-RAW-DNG-DISPLAY-CLIPPING-LARGE — локальная v1.47.14

**2026-11-23 · Stage 9 · P1 · локальный код принят, GitHub acceptance IN PROGRESS.**

## Контекст
В v1.47.13 `8da8622` экранная RGB-подсветка для RAW работала, но на кадрах >8 Мп целиком отключалась во избежание крупного readback. ColorMatrix #397, DefaultCrop #398, SOF3/packed, ForwardMatrix/tonal/demosaic были реализованы ранее и здесь не повторяются. Общий Chromium smoke падал на `red object brush preview` также на неизменённом #398 baseline.

## Реальная реализация
- `src/formats/dng-clipping-warning.js`: новый `markDisplayClippingWarningOnCanvas` читает только видимый Canvas тайлами до 262144 пикселя / **1 МиБ RGBA на одну операцию**; x/y плитки корректны и для сверхшироких изображений; подсчитывает highlights/shadows/eligible, не пишет плитки без предупреждений, уступает управление между плитками, возвращает null при отмене.
- `src/main.js`: для >8 Мп вызывается tiled scan, вместо прежнего полного отключения; `renderVersion` предотвращает запись устаревшего состояния после переключения документа/режима. Для <=8 Мп оставлен исходный путь. Данные DNG, renderBuffer, layer.dataUrl, History, `.zpe` и экспорт не меняются.
- `tests/dng-clipping-warning.test.mjs`: 3 новых RED→GREEN теста (9-Мп mock, tile cap и точные цвета/счётчики; cancel, invalid geometry). Итого 6/6 PASS.
- `tools/browser-raw-dng-check.mjs`: настоящий Chrome `file://`, синтетический `.zpe` preview 3001×3001 с сохранёнными исходными 4×4 RAW метаданными **исключительно для теста отображения**. Белый/чёрный пиксели -> magenta/cyan и назад, History без записи. Это НЕ camera-authored 9MP DNG и не LibRaw oracle.
- `tools/browser-smoke.mjs`: **корневая причина флаки — устаревшие экранные координаты**. После клика по toolbar/Properties DOM геометрия холста сдвигалась, но CDP указывал старый `removalPoint.x/y`, а сравнение пикселей оставалось в старой canvas точке. Теперь `mouse(type,dx,dy,buttons)` вычисляет актуальное client положение относительно `#overlayCanvas.getBoundingClientRect()` перед КАЖДЫМ событием; fill ждёт persist, далее настоящий held brush drag и исходная строгая проверка RGB/History. Добавлен быстрый настоящий Chromium `npm run test:browser:brush` с независимым выходом через общий finally/cleanup.
- `src/interaction/pointer-lifecycle-router.js`: исправлен настоящий race: запоздалый `lostpointercapture` предыдущего жеста не отменяет новый жест того же `pointerId`, когда canvas уже захватил его повторно. `tests/pointer-lifecycle-router.test.mjs`: воспроизводимый RED 9/10 → GREEN 10/10; суммарно pointer-release/clipping 26/26 PASS. Это самостоятельная защита, но широкий Chrome smoke при повторных запусках пока демонстрировал флаки — не трактовать первый PASS как устойчивый.

## Проверки
- Новый тест сначала RED (отсутствующая `markDisplayClippingWarningOnCanvas`), затем **6/6 PASS**.
- `node --test tests/dng*.test.mjs`: **115/115 PASS**.
- `npm run build`, `node --check` и `git diff --check`: PASS.
- `npm run test:browser:raw-dng`: **PASS**, включая реальный 9Мп Canvas, toggle/on/off, History и прежние .zpe/PNG/PSD/PSB raster regressions.
- `npm run test:browser:brush`: сначала 3/6 FAIL со старыми координатами (реальный brush-buffer был красным, но document readback проверял другой пиксель); затем после динамического пересчёта координат 6/6 PASS с диагностикой и **6/6 PASS после её удаления**, на реальном Chromium. `npm run test:browser` до исправления координат был нестабилен (один PASS, повторные FAIL); финальный полный прогон после исправления учесть отдельно. Защита от старого `lostpointercapture` — самостоятельный исправленный production race, но не объявляется единственной причиной прежнего smoke timeout.
- Финальные `npm run test:browser:raw-dng` **PASS** (включая синтетический 9 Мп clipping), `npm run test:browser` **PASS** (132-секундный полный Chrome file:// smoke), `node --test tests/dng*.test.mjs` **115/115 PASS**, targeted pointer/brush/clipping **26/26 PASS**, version consistency **1/1 PASS**, build/JS syntax/diff **PASS**.
- Финальный Windows `npm run check`: **FAIL 1777 tests / 1762 PASS / 10 SKIP / 5 FAIL** — 5 Linux-only `/proc`/cgroup сценариев, недоступных на Windows. Это не green для полного suite. Linux exact-head CI для локальной ветки NOT RUN; лицензированный camera-authored RAW + независимый oracle BLOCKED.

## Гейты и следующая задача
`main`: `ddd90d3be9c20092b043a3ea4761795177f7a94c` (exact-main core CI SUCCESS). #397 head `bf6dd662` core+real-photo CI SUCCESS, 0 reviews; #398 head `05c48eb` stacked на #397, CI NOT RUN, 0 reviews. V1.47.14 **только локально**, не main/remote PR.
**NEXT CAP-RAW-DNG-STACK-RECONCILIATION:** после отдельного прямого разрешения на push/merge и обязательных review/CI сначала #397, затем retarget #398 на main и Linux exact-head core+independent CI; далее clean PR объединённого RAW + v1.47.14, reviews/merge и final exact-main CI. Без force-push и утверждений об Adobe/LibRaw camera pixel parity.

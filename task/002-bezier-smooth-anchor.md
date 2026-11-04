# Stage 2 / CAP-BEZ — реальное Alt+Shift-сглаживание существующего Bézier-узла

**Статус:** IN PROGRESS · **Приоритет:** P1 · **PR:** [#125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) (старый PR, без дублей) · **База:** main `2d02391c572c895b5640b0aaa33b767f5da7d5e1`.

## Пользовательская функция

В режиме «Перо» Alt+Shift+клик по существующему угловому anchor превращает его в smooth, сохраняя один изменённый объект Path, имеющиеся остальные узлы и один Undo checkpoint. Соседние точки определяют касательную; длины ручек ограничены третью соответствующих соседних сегментов. Открытые начальный/конечный узлы получают только используемую ручку; замкнутые контуры связывают последний и первый узлы циклически. Общий контроллер обслуживает Shape, Vector Mask и Saved Paths. Alt+click→corner, обычные перетаскивания handles и serialization остаются прежними.

## Проверка этой проходки

1. Старый PR #125 считался конфликтующим с новым main. Выбранный код src/interaction/path-control-command-controller.js, src/main.js и tests/path-control-command-controller.test.mjs перенесён с помощью `git apply --check`/git apply на main после слияния #126. Конфликтов в выбранных исходниках нет.
2. `node --test tests/path-control-command-controller.test.mjs tests/path-control-surface-controller.test.mjs tests/path-control-gesture-controller.test.mjs`: **37/37 PASS** на Windows. Покрыты геометрия/открытые концы/closed wrap, сохранение одной операции, no-op, stale owner/target и inherited lock. Сборка `npm run build` → `383e86be13a7efb7`; `git diff --check` PASS.
3. **Фактические проверки:** полный Windows `npm test` FAIL на пяти известных Linux-only `/proc`/cgroup fixtures (не полный green). Независимый последовательный `npm run test:browser` реальный Chrome `file://` **PASS (exit 0, 103.12s)**. PR-head Linux CI и independent real-photo ещё PENDING до публикации; прямой Chrome E2E Alt+Shift click на реальном Shape/Vector Mask/Saved Path следует добавить, общий smoke его не доказывает. Реальный Adobe-authored PSD/PSB round-trip не заявлен. Наличие кода без UI и Save не равно полной Photoshop compatibility.

## Следующий точный шаг

Сверить рабочий diff относительно main, запустить общую и браузерную проверку, сохранить актуальные metadata/документацию и отправить изменения в **существующий** #125 без force push. Проверить точные Linux core 12 jobs и независимый real-photo workflow, затем при отсутствии конфликтов принять PR и отдельно проверить exact-main CI. После ограниченного приёма перейти к недостающему UI mask/adjustment workflow.

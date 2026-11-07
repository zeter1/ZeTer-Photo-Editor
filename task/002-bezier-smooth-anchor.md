# Stage 2 / CAP-BEZ — реальное Alt+Shift-сглаживание существующего Bézier-узла

**Статус:** IN PROGRESS · **Приоритет:** P1 · **PR:** [#125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) (старый PR, без дублей) · **База:** main `2d02391c572c895b5640b0aaa33b767f5da7d5e1`.

## Пользовательская функция

В режиме «Перо» Alt+Shift+клик по существующему угловому anchor превращает его в smooth, сохраняя один изменённый объект Path, имеющиеся остальные узлы и один Undo checkpoint. Соседние точки определяют касательную; длины ручек ограничены третью соответствующих соседних сегментов. Открытые начальный/конечный узлы получают только используемую ручку; замкнутые контуры связывают последний и первый узлы циклически. Общий контроллер обслуживает Shape, Vector Mask и Saved Paths. Alt+click→corner, обычные перетаскивания handles и serialization остаются прежними.

## Проверка этой проходки

1. Старый PR #125 считался конфликтующим с новым main. Выбранный код src/interaction/path-control-command-controller.js, src/main.js и tests/path-control-command-controller.test.mjs перенесён с помощью `git apply --check`/git apply на main после слияния #126. Конфликтов в выбранных исходниках нет.
2. `node --test tests/path-control-command-controller.test.mjs tests/path-control-surface-controller.test.mjs tests/path-control-gesture-controller.test.mjs`: **37/37 PASS** на Windows. Покрыты геометрия/открытые концы/closed wrap, сохранение одной операции, no-op, stale owner/target и inherited lock. Сборка `npm run build` → `383e86be13a7efb7`; `git diff --check` PASS.
3. **Фактические проверки:** полный Windows `npm test` FAIL на пяти известных Linux-only `/proc`/cgroup fixtures (не полный green). Независимый последовательный `npm run test:browser` реальный Chrome `file://` **PASS (exit 0, 103.12s)**. PR-head Linux CI и independent real-photo ещё PENDING до публикации; прямой Chrome E2E Alt+Shift click на реальном Shape/Vector Mask/Saved Path следует добавить, общий smoke его не доказывает. Реальный Adobe-authored PSD/PSB round-trip не заявлен. Наличие кода без UI и Save не равно полной Photoshop compatibility.

## Приёмка 2026-11-07

- В существующем PR head 9a547f2 core [CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41851946246), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41851946082). Новый head с E2E ещё локальный и требует отдельной CI-приёмки.
- Добавлены npm run test:browser:pen-smooth, tools/browser-pen-smooth-smoke.mjs и CI step. Реальный Chrome file:// импортирует Shape .zpe через UI, dispatch Alt+Shift mouse, проверяет History, Undo/Redo, no-op, реальный Ctrl+S .zpe Blob с точными smooth handles, reopen этого Blob и обратный Alt→corner. LOCAL PASS exit 0. 37/37 focused PASS; сборка и diff check PASS.
- Первое падение нового E2E было из-за CSS bounding rect против canvas bitmap после fit-to-view; тестовая координата исправлена, повторный Chromium PASS. Runtime-код/форматы не менялись; Vector Mask и Saved Paths direct UI E2E и Adobe PSD/PSB editable round-trip остаются открытыми.

## Следующий точный шаг

Опубликовать новый Chrome E2E в **существующий** #125 без force push, проверить точные new-head Linux core 12 jobs и independent real-photo CI, после review принять PR если разрешено, затем exact-main CI. После ограниченного приёма — отдельный Stage 2/CAP-MASK UI vertical slice.
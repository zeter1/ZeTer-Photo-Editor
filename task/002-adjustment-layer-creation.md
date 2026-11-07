# CAP-ADJ-CREATE — создание настоящих корректирующих слоёв (2026-11-07)

**Статус:** локальная реализация и реальный Chrome file:// PASS; не опубликовано в GitHub, нет PR/CI для этой ветки. **Основа:** main `9fa6a7d90477bc4c36534daeaec3a7e71153c6ec`. **Ветка:** `feat/adjustment-layer-creation-20261107`.

## Проблема и результат

Раньше меню «Слой → Новый корректирующий слой» добавляло `adjustment:null`: слой не выполнял никакой цветовой коррекции и выглядел как завершённая функция. Теперь меню открывает выбор восьми существующих видов: Brightness/Contrast, Levels, Curves, Exposure, Hue/Saturation, Invert, Posterize, Threshold. Создаётся типизированная сохраняемая модель, выбранный слой и одна запись History. Инспектор уже поддерживает редактирование параметров. Слой композитится существующим движком; исходные пиксели и векторная геометрия не переписываются. Пустые и поддельные PSD native metadata не создаются.

Транзакция выполняется через `src/layers/adjustment-command-controller.js`. Проверяются exact active document, валидный вид коррекции, лимит 500 слоёв, invalid/no-op не коммитят. При выборе вида modal помнит исходный owner, поэтому отложенный submit не применяет слой в другой документ.

## Изменённые файлы

- `src/layers/adjustment-command-controller.js` — typed presets, `createLayer`, безопасность.
- `src/main.js` — пользовательский диалог, передача owner.
- `tests/adjustment-creation.test.mjs` — 5 новых тестов и регрессии.
- `tools/browser-adjustment-create-check.mjs`, `tools/browser-adjustment-create-smoke.mjs`, `tools/browser-smoke.mjs` — живой Chrome file:// UI.
- `package.json`, `.github/workflows/ci.yml` — отдельная команда и CI gate.
- `src/app.bundle.js`, `index.html`, `version.json` — сборка из исходников; существующий version 1.46.4 до интеграции с PR #378.

## Приёмка и доказательства

- Windows Node focused: **26/26 PASS** (`tests/adjustment-creation.test.mjs`, `adjustment-command-controller.test.mjs`, `adjustments.test.mjs`).
- Windows Chrome: **PASS** `npm run test:browser:adjustment-create`: настоящие меню и modal, создание Levels поверх серого Shape, проверка исходного RGB 128 и гамма-коррекции до ~180, одна запись при создании и одна при правке, Undo/Redo пикселей, Ctrl+S реальный .zpe Blob и reopen с прежним Gamma и исходным слоем.
- Production `npm run build`: PASS; **полный реальный Windows Chrome `npm run test:browser`: PASS**, выход 0; `git diff --check`: PASS. **Полный Windows `npm run check`: FAIL** на известных Linux-only `/proc/cgroup` тестах (к исходникам CAP-ADJ не относится); это не общий local green. GitHub PR-head CI для ветки **NOT RUN**, без PR нельзя считать remote green.
- PSD/PSB: настоящие native adjustment metadata не создаются; Adobe-authored export/editable round-trip **NOT VERIFIED**. Родитель CAP-ADJ остаётся **IN PROGRESS**, а не полное DONE.

## Интеграционный кандидат после PR #378 (2026-11-07)

- В отдельном worktree `_worktrees/cap-adj-after-mask-20261107` создана ветка `feat/adjustment-layer-after-vector-mask-20261107` от точного head PR #378 `60c52a8b2aba71343cf53f850f3e418b53ab35fa` и перенесён CAP-ADJ-CREATE из локального коммита `fb0f548`.
- Разрешены пересечения в CI, версии, Chrome smoke и очереди, при этом сохранены обе настоящие пользовательские функции. Совместно проверены `npm run build`, **47/47 focused unit PASS**, реальный Chrome `file://` vector-mask PASS и adjustment-create PASS. Удалённая CI для объединённой ветки **NOT RUN**.
- Полный `npm run test:browser` на совмещённой сборке: **PASS**, настоящий Google Chrome `file://`. Полный Windows `npm run check`: **FAIL** — 1614 tests, 1599 PASS, 10 SKIP, 5 FAIL, только существующие Linux cgroup 003T/2d-2 и 003T/2d-3. Это **не** общий зелёный check и не CI для новой ветки.
- Основной рабочий каталог `verify-pr125-20261104` с несвязанными изменениями не затронут. PR #378 по-прежнему OPEN.

## CAP-ADJ-COLORIZE UI — реальное тонирование Hue/Saturation (2026-11-07)

- На интеграционной локальной ветке добавлен пользовательский переключатель **Colorize** в инспектор Hue/Saturation. Он изменяет ту же нормализованную adjustment model, которую реально использует alpha-preserving pixel compositor. Saturation в режиме Colorize ограничивается 0..100; исходная форма и RGB не изменяются в source layer.
- `src/layers/adjustment-command-controller.js`: `setColorize` с typed boolean, проверкой активного owner и рекурсивных lock, подавлением no-op и ровно одним History-коммитом. Неверный тип и stale document не изменяют модель.
- `tools/browser-adjustment-create-check.mjs`: в реальном Chrome `file://` создаётся Hue/Saturation слой над #808080, цветовой тон 120°, Saturation 100, затем переключатель Colorize переводит серый RGB в зелёный; Undo/Redo, одна запись History, Ctrl+S Blob и reopen `.zpe` с сохранёнными Hue/Saturation/Colorize проверены.
- Unit RED (`setColorize is not a function`) → GREEN. Focused 27/27 PASS; combined с vector mask **51/51 PASS**. `npm run build`, focused Chrome `test:browser:adjustment-create` и `git diff --check` PASS. Повторный `npm run test:browser:vector-mask` **PASS**, полный `npm run test:browser` **PASS** (real Chrome `file://`, exit 0, 111.46s), `git diff --check` PASS на одной итоговой сборке. **Без push, PR и exact-main CI**; текущий PR #378 остаётся OPEN.
- PSD/PSB editable Hue/Saturation metadata **NOT VERIFIED**; bounded slice не означает завершения CAP-ADJ.

## Зависимости и следующий шаг

Текущий PR масок [#378](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378) OPEN с exact-head CI PASS. По локальному `zeter-github-workflow` push/merge требует отдельного прямого разрешения. Совместный локальный срез уже подготовлен поверх точного head #378 (это не main). После разрешённого слияния #378 и exact-main CI необходимо перенести только CAP-ADJ diff на актуальный main, повторить build/unit/Chrome/gates и по отдельному разрешению открыть PR. Далее расширять Levels/Curves UI и маски/clipping/groups, PSD editable round-trip без неявного flatten.

## CAP-ADJ-CURVES UI: новый bounded increment (2026-11-07)

- На интеграционной локальной ветке `feat/adjustment-layer-after-vector-mask-20261107` в `src/main.js` добавлены отдельные Master/R/G/B SVG-графики поверх уже существующих editable Curves моделей. Master развёрнут; RGB каналы свёрнуты. Нажатие добавляет точку (макс. 19), перетаскивание ограничивает соседние X и коммитит одну History-запись при отпускании; Alt+клик удаляет внутреннюю точку; поле `input:output` осталось для точного ввода.
- Перед коммитом gesture повторно проверяет exact active document, selected layer, идентичность layer object и неизменность adjustment model. Отмена pointercancel не мутирует документ. Undo/Redo и native `.zpe` сохраняют редактируемые channel points; исходный Shape остаётся #808080.
- `tools/browser-adjustment-create-check.mjs`: настоящий Chrome `file://` CDP mouse press/release + drag, проверка реальных pixel RGB, единственной History-записи за каждый жест, Undo/Redo, Ctrl+S Blob и повторного открытия. `npm run build` (build `feba680d419a1ce6`), 47/47 focused Node tests, `npm run test:browser:adjustment-create` и `npm run test:browser:vector-mask` **PASS для финальной сборки**. Полный Chrome `npm run test:browser` **PASS, 108.43s**, был выполнен до последнего узкого исправления сохранения endpoint X; после него повторены build, focused и оба адресных Chrome smoke — PASS. Никаких удалённых GitHub-записей и PR для CAP-ADJ не сделано.
- Ограничения: визуальная геометрия графика пока линейная, без сглаженных интерполяционных кривых; нет встроенной гистограммы, эталонного Adobe PSD/PSB editable round-trip и доказанной поддержки всех групп/масок. Родитель **CAP-ADJ IN PROGRESS**. После разрешённого merge #378 — перенести CAP-ADJ код на точный main, провести повторные gates и только по разрешённому push/PR.

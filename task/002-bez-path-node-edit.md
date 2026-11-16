# CAP-BEZ-PATH-NODE-EDIT — Shape Path и Saved Paths, прямое Pen-редактирование узлов

**Дата:** 2026-11-16 · **Приоритет:** P1 · **Статус:** DONE (bounded code + merge + exact-main CI SUCCESS); локальная Chrome приёмка PASS.
**База:** exact main `70b70693bff620f08b89785c4e2f31a40b25d138` (main core CI SUCCESS). **Ветка:** `feat/path-node-edit-20261116`, **PR:** [#392 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392), **версия:** 1.46.17.
**Ограничение:** native PSD/PSB ZeTer self-round-trip не удостоверяет Adobe-authored Photoshop GUI; отсутствие внешнего corpus отдельно BLOCKED.

## Реализация (пользовательская, не декоративная)

- Pen `Ctrl+click` выбирает именно сегмент активного Shape Path (локальные координаты с layer transform) либо активного Saved Path (document coordinates), включая последний закрывающий сегмент. Тот же алгоритм sample-based closest cubic hit, что и у существующей applied Vector Mask; в обработке источники разделены.
- Команда `insertPathNode` делит существующий cubic методом De Casteljau; исходная форма математически точна, ручки соседних вершин заменяются разделёнными контрольными точками; прямая линия остаётся линией.
- `Ctrl+Alt+click` на anchor вызывает `deletePathNode`. Для закрытого контура оставляет минимум 3, для открытого минимум 2; сохраняет ручки остальных вершин без некорректных заявлений о точном слиянии двух кубических дуг.
- Запись reject: устаревший документ, иной selected layer, recursive group lock, смена group/shape/points/closed, другая Saved Path ID/object/subpath, заменённые points/node/from/to; 1000-node cap; без history на reject/no-op. Один обычный History commit на настоящий edit. Applied Vector Mask Ctrl-insert/delete и Alt/Shift drag не заменялись.
- Новые production UI-команды проходят `src/main.js` → `src/interaction/path-control-surface-controller.js` → `src/interaction/path-control-command-controller.js` → общий history, render, .zpe/PSD/PSB.

## Локальная проверка

- `node --test tests/path-shape-saved-node-edit.test.mjs tests/path-mask-node-edit.test.mjs tests/path-control-command-controller.test.mjs tests/path-control-surface-controller.test.mjs` **42/42 PASS**, 0 FAIL. 101-point exact cubic oracle (Shape и Saved), closing cubic, open/closed deletion, stale Saved owner/ID/path/subpath/points/node, inherited shape group lock и старые mask tests.
- `npm run build` **PASS**, generated `src/app.bundle.js`, `index.html`, `version.json` для `file://`.
- `npm run test:browser:path-node-edit`: **PASS** (real Chromium file://, exit 0), Shape/Saved pointer Ctrl-insert/delete, RGBA composite, History Undo/Redo, actual `.zpe` save/reopen; real export modal PSD/PSB native Saved Paths 5 nodes, binary parser и re-import.
- Полный Windows Chrome `npm run test:browser`: **PASS**, exit 0 (133.80s combined command runtime; не выдавать за чистое browser elapsed).
- Итоговый Windows `npm run check`: **1646 PASS / 10 SKIP / 5 FAIL** — ровно пять Linux-only `/proc/cgroup`, не полный Windows PASS. После синхронизации README/CHANGELOG/version повторный `tests/version-consistency.test.mjs` PASS, 21/21 focused (версия + paths) PASS.
- `git diff --check`: **PASS**. Linux PR-head [core run 43809833484](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43809833484) и [real-photo run 43809833528](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43809833528) запущены для первоначального опубликованного PR head; статус и проверку на последнем head сверить отдельно; review/merge/exact-main PENDING.

## Изменения

- `src/interaction/path-control-surface-controller.js`, `src/interaction/path-control-command-controller.js`, `src/main.js`.
- `tests/path-shape-saved-node-edit.test.mjs`; `tools/browser-path-node-edit-check.mjs`, `tools/browser-path-node-edit-smoke.mjs`, `tools/browser-smoke.mjs`; `package.json`, generated bundle/cache manifest; `README.md`, `CHANGELOG.md`, `task/NEXT.md`, `task/README.md`, `task/CAPABILITY_MATRIX.md`.

## Следующий обязательный шаг

Довести именно этот проверенный локальный срез до PR-head Linux CI (core + independent real-photo), review и стандартного merge при наличии требуемого разрешения, затем exact-main CI; не переписывать работающую applied Vector Mask. После bounded DONE выбрать независимый P1 по матрице. Внешний Photoshop-authored Saved Path/PSB32 corpus остаётся BLOCKED/UNKNOWN.

## 2026-11-16 — фактическое завершение PR-gates и merge

- Exact PR head `81fc4bf981ec37290a3ba453b7747ad0888144d9`: [Linux core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43810434572), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43810434570), 13/13 SUCCESS, review threads 0, submitted reviews 0, конфликтов нет.
- [PR #392 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392) в main `39ae073a7c3daa12ae607663423ff767ed10f4d1` (отдельно проверено). Exact merged-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43811572358) и [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43811572311) **SUCCESS оба** на merge SHA `39ae073a7c3daa12ae607663423ff767ed10f4d1` после независимого readback.
- Новый independent P1 — [CAP-RAW-DNG-FOUNDATION](NEXT.md): DNG Bayer decode + non-destructive WB/exposure, браузерный import/History/.zpe/export. Parent CAP-BEZ/PSD IN PROGRESS; Photoshop-authored corpus BLOCKED.

# CAP-BEZ-MASK-NODE-INSERT-DELETE — редактирование узлов применённой Vector Mask

**Приоритет:** P1. **Статус:** DONE (bounded) — Linux exact PR-head и exact-merge main core+real-photo SUCCESS. **База:** main 00018bc51e00d856b41ab0389eba12948bb72d56 (#390 merged). **Ветка:** feat/vector-mask-node-edit-20261115. **Версия:** 1.46.16. **PR:** [#391 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/391), exact PR head 43e81e0f68bb6c7279a68ec31df9e12127aa021e, merge main adfa66db3bf7d29d7079c1221e35380d0fb00e11; PR-head [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43734378771) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43734378774), 13/13 checks, no outstanding review threads. Exact-merge main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43735160771) / [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43735160712) on adfa66d.

## Реализовано

- Pen Applied Vector Mask: Ctrl+click на cubic/linear сегменте вставляет узел; Ctrl+Alt+click на anchor удаляет. Работает на выбранном слое с Vector Mask, включая nested clipped Levels/Curves; Shape-only и Saved Path отдельно.
- Document-space hit-testing: 48 sample intervals, zoom, layer transform. Запускается только по Ctrl+pointerdown.
- Вставка: exact De Casteljau subdivision; 101 point oracle с ошибкой менее 1e-8, включая closing segment. Линия остаётся линейной.
- Удаление сохраняет surviving cubic handles; closed polygon минимум 3 точки. Две произвольные cubic curves нельзя в общем случае точно заменить одной, сохранность формы после удаления не заявлена.
- Exact live doc/selected layer/mask/subpath/points/from/to identity, inherited group lock, 1000-node cap; один History commit на настоящую правку. Штатные Undo/Redo, .zpe и PSD/PSB serialization, без flatten.
- Пользовательская статусная подсказка с сочетаниями клавиш.

## Проверено локально

- Node syntax + path-mask-node-edit, path-control-command-controller, path-control-surface-controller: **49/49 PASS**. Group lock, stale owner, selected layer/mask swap, closing segment, triangle refusal.
- Windows Chrome file://, npm run test:browser:adjustment-mask-direct: **PASS**. Настоящий grouped Levels/Curves Ctrl-insert/Ctrl+Alt-delete pointer, Undo/Redo, .zpe reopen, UI PSD/PSB native editable masks/adjustments.
- Browser RED на строгом RGBA hash: Chromium rasterizer отличается на **3 channel values, max 8/255** из 64×64 изображения после mathematically exact split. Приёмка допускает <=4 изменённых канальных значений, max <=8; unchanged unmasked lower pixel. Это не byte-identical guarantee.
- Полный Windows npm run test:browser **PASS**, после последних identity guards отдельный target Chrome file:// **PASS**. Windows npm run check: **1632 PASS / 10 SKIP / 5 FAIL** (Linux-only /proc/cgroup; не полный PASS); Linux exact PR-head core + real-photo **SUCCESS**, 13/13; exact merged-main core+real-photo SUCCESS.

## Файлы

src/interaction/path-control-command-controller.js; src/interaction/path-control-surface-controller.js; src/main.js; src/selection/vector-mask-controller.js; tests/path-mask-node-edit.test.mjs; tools/browser-adjustment-mask-direct-check.mjs; canonical build, version, README, CHANGELOG и task docs.

## Следующая задача

Следующая P1 задача после [#391 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/391) — **CAP-BEZ-PATH-NODE-EDIT**: Pen insert/delete для Shape Path и Saved Paths с owner/lock, History/.zpe/native PSD+PSB Chrome acceptance. Внешняя Photoshop-authored проверка BLOCKED без corpus.

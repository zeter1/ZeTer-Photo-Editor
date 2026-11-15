# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / **CAP-BEZ-PATH-NODE-EDIT** — прямые Pen insert/delete существующих узлов **Shape Path и Saved Paths**; реализацию applied Vector Mask НЕ повторять.
> **PRIORITY:** P1 · **STATUS:** TODO, первая ещё не выполненная реализация. Родительские CAP-BEZ, CAP-MASK, CAP-PSD IN PROGRESS (полная Photoshop compatibility не заявлена).
> **BASE MAIN SHA:** adfa66db3bf7d29d7079c1221e35380d0fb00e11 — [#391 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/391) на 2026-11-15; версия 1.46.16.
> **PREVIOUS BOUNDED DONE:** CAP-BEZ-MASK-NODE-INSERT-DELETE [#391 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/391), exact PR-head 43e81e0f68bb6c7279a68ec31df9e12127aa021e, [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43734378771), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43734378774), 13/13 checks; exact-merge main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43735160771) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43735160712), проверены на adfa66db3bf7d29d7079c1221e35380d0fb00e11. Предыдущий [#390 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/390) main 00018bc, exact-main core+real-photo SUCCESS.
> **LOCAL EVIDENCE:** 49/49 focused Node PASS; полный Windows Chrome file:// PASS и отдельный повторный реальный grouped Levels+Curves Ctrl-insert/delete, Undo/Redo, .zpe reopen, PSD/PSB editable self-round-trip PASS. Windows npm run check: 1632 PASS, 10 SKIP, 5 FAIL на Linux-only /proc/cgroup; НЕ полный PASS. Chromium Canvas mathematical exact-split отразил 3 изменённых RGBA channel bytes (max 8/255), НЕ byte-identical render.
> **NEXT IMPLEMENTATION:** в чистой ветке от актуального main использовать существующие path-control-surface/command, Pen pointer dispatch; добавить source-aware Ctrl+click сегмента для shape и document-path, Ctrl+Alt+click anchor, корректные open/closed ограничения и exact document/path/layer/subpath/node identity+lock guards. Не ломать существующую Vector Mask и Alt/Shift drag.
> **REQUIRED ACCEPTANCE:** отдельные RED→GREEN Node тесты (cubic split exact, closing segment, deletion minimum, saved-path stale ID/owner, shape recursive lock), реальный Chrome file:// Pen Shape + Saved Paths, RGBA/overlay, History Undo/Redo, .zpe reopen, editable native PSD/PSB Paths. Затем Linux PR-head core/real-photo, review/merge, exact-main. Существующий self-round-trip не заменяет Adobe-authored Photoshop GUI.
> **OTHER BLOCKERS:** внешний Photoshop-authored Saved Path/Vector Mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md).

## Краткая очередь

1. **CAP-BEZ-PATH-NODE-EDIT:** P1 TODO — следующая настоящая реализация: Shape Path и Saved Paths node insert/delete, без повторения применённой маски.
2. **CAP-BEZ-MASK-PSD-UI:** IN PROGRESS — Adobe-authored interoperability, native high depth.
3. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit parity.
4. **Stage 9 / CAP-RAW:** TODO — end-to-end RAW decode + non-destructive development.

**Документы:** [матрица](CAPABILITY_MATRIX.md) · [карта](README.md) · [закрытый bounded журнал](002-bez-mask-node-insert-delete.md) · [родительская задача](002-bez-mask-psd-ui.md).

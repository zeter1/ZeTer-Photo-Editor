# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / **CAP-BEZ-MASK-NODE-INSERT-DELETE** — вставка/удаление узлов уже применённой Vector Mask через Pen.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — локальная production UI/Chrome приёмка PASS, PR-head/exact-main CI новой функции NOT RUN. Родители CAP-BEZ, CAP-MASK и CAP-PSD IN PROGRESS.
> **BASE MAIN SHA:** 00018bc51e00d856b41ab0389eba12948bb72d56 — [#390 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/390) из head ab871f7b854d12b9ff610c7f48a7ce73ac419efe.
> **ACTIVE BRANCH/PR:** feat/vector-mask-node-edit-20261115; PR ещё не опубликован на момент записи. Версия 1.46.16.
> **LAST VERIFIED:** #390 [core PR-head SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43732059900) и [real-photo PR-head SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43732059904); exact-main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43732711258), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43732711269) на момент записи. Новый срез: focused Node 49/49 PASS, настоящий Chrome file:// grouped Levels/Curves Ctrl-insert/Ctrl+Alt-delete, History Undo/Redo, .zpe reopen, native editable PSD/PSB UI round-trip PASS. Математически exact cubic subdivision меняет из-за Chromium anti-aliasing 3 RGBA channel samples, max 8/255 (не битовое равенство).
> **REMAINING ACCEPTANCE:** полный Windows browser, Linux PR-head core+real-photo CI, review, merge, exact-main CI. Отдельно raster/shape variants и Photoshop-authored compatibility.
> **NEXT IMPLEMENTATION ACTION:** полный regression+CI, затем merge при успешных gates. Следующая функция: **CAP-BEZ-PATH-NODE-EDIT** — Pen insert/delete на Shape Path и Saved Paths с cubic/owner/lock, History/.zpe и PSD/PSB acceptance.
> **BLOCKERS:** внешний Adobe-authored Saved Path/Vector Mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md).

## Краткая очередь

1. **CAP-BEZ-MASK-NODE-INSERT-DELETE:** P1 IN PROGRESS — PR-head → merge → exact-main.
2. **CAP-BEZ-PATH-NODE-EDIT:** P1 TODO — Pen insert/delete для Saved Paths и Shape Path.
3. **CAP-BEZ-MASK-PSD-UI:** IN PROGRESS — Adobe-authored interop, native high depth.
4. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit parity; **Stage 9 CAP-RAW:** TODO — RAW pipeline.

**История:** [матрица](CAPABILITY_MATRIX.md) · [карта](README.md) · [журнал](002-bez-mask-node-insert-delete.md) · [родительская задача](002-bez-mask-psd-ui.md).

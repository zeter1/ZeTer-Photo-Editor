# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / CAP-BEZ-MASK-PSD-UI → **CAP-BEZ-PATH-DRAG-VECTOR-MASK + CAP-BEZ-MASK-OP-EDIT** (bounded v1.46.14).
> **PRIORITY:** P1 · **STATUS:** LOCAL IMPLEMENTED / Chrome focused PASS; ветка `feat/vector-mask-direct-edit-20261115` **не опубликована**, GitHub CI этого кода NOT RUN.
> **BASE MAIN:** `83bfd35092a0230b89b82bb6944911b5c6952024` — [#387 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/387), exact-main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43723258117) / [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43723258105).
> **STACK DEPENDENCY:** [#388 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/388), exact head `edb0f43eb9f71dd5bfeddf17dd9dbd7c3721e431`, [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43724042011), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43724042013). Reviews и review threads: 0; не выдавать эти CI за CI v1.46.14.
> **REAL IMPLEMENTATION:** прямой Pen pointer anchor drag уже применённой Vector Mask; меню «Слой» и контекстное меню позволяют изменить `add/subtract/intersect/exclude` её существующего подпути без повторного применения Saved Path. В модальном onSubmit проверяются exact document/layer/mask/subpath, group lock, no-op и invalid input.
> **LOCAL VERIFICATION:** 2026-11-15 Windows `npm run build` 1.46.14 PASS, 47/47 focused Node PASS; полный `npm run test:browser` Chrome `file://` PASS (exit 0, 118.97 s), `test:browser:pen-boolean` и `test:browser:vector-mask` PASS; `npm run check` завершился exit 1: 1633 tests, 1618 PASS / 10 SKIP / 5 FAIL (Linux-only `/proc/cgroup` tests на Windows — не объявлять full PASS). Chrome `npm run test:browser:pen-boolean` PASS: Layer menu → applied-mask anchor drag → alpha edge → Undo/Redo → .zpe geometry; change existing mask boolean operation → alpha center → Undo/Redo → .zpe → нативные PSD + PSB editable operation/geometry в document space, независимо от Saved Path. Linux PR-head/new exact-main NOT RUN.
> **LIMITATIONS:** self-export/import ≠ Adobe Photoshop GUI или Photoshop-authored parity; raster/adjustment маски и обе Bézier-ручки применённой маски ещё не приняты внешним UI oracle.
> **NEXT IMPLEMENTATION ACTION:** **CAP-BEZ-PATH-DRAG-VECTOR-MASK-HANDLES** — реальный Chrome file:// Pen direct drag обеих `handleIn/handleOut` на *применённой* Vector Mask с визуальным RGBA pixel oracle и native PSD/PSB geometry, Undo/Redo, .zpe + lock/stale-document во время жеста. Исправить первый RED; добавить focused unit + browser.
> **RELEASE GATES:** review и merge #388 только после явно разрешённых GitHub-действий, затем публикация новой независимой ветки, exact PR-head core+real-photo CI, ревью/merge, exact-main CI. Для локальной 1.46.14 не заявлять опубликованную реализацию.
> **BLOCKERS:** внешние Adobe-authored Saved Path/Mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md) BLOCKED. Parent CAP-BEZ/MASK/PSD остаются IN PROGRESS.

## Краткая очередь

1. **#388 CAP-BEZ-PATH-OP-EDIT + DRAG-HIT:** OPEN, exact head `edb0f43` core+real-photo SUCCESS; review/merge gate отдельно. #387 уже MERGED, main `83bfd350`.
2. **CAP-BEZ-PATH-DRAG-VECTOR-MASK / MASK-OP-EDIT:** v1.46.14 новая локальная stacked branch; core code, genuine browser, unit and PSD/PSB self-round-trip; опубликовать только по разрешённому workflow.
3. **CAP-BEZ-PATH-DRAG-VECTOR-MASK-HANDLES:** direct edit already-applied handles, raster/adjustment variants, stale-owner mid-gesture UI, native/editable geometry and rendered RGBA.
4. **CAP-BEZ-MASK-PSD-UI (parent):** внешние Photoshop-authored PSD/PSB и GUI-interoperability; не смешивать native self-readback с Adobe parity.
5. **Stage 6 / 003X/6c-9:** Worker stale/close/edit parity; **CAP-RAW Stage 9:** production RAW pipeline TODO.

**Указатели:** [Матрица](CAPABILITY_MATRIX.md) · [Карта](README.md) · [Журнал](002-bez-mask-psd-ui.md).

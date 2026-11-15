# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / CAP-BEZ-MASK-PSD-UI → **CAP-BEZ-PATH-DRAG-VECTOR-MASK + CAP-BEZ-MASK-OP-EDIT + CAP-BEZ-MASK-DIRECT-HANDLES** (bounded v1.46.14).
> **PRIORITY:** P1 · **STATUS:** LOCAL IMPLEMENTED, focused Chrome `file://` PASS; отдельная ветка `feat/vector-mask-direct-edit-20261115` до публикации. Parent CAP-BEZ/MASK/PSD **IN PROGRESS**.
> **BASE MAIN SHA:** `cb947b194448f435b80053793d00afdc248380a9` — [#388 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/388). Exact merged-main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43727492331) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43727492411). Последний PR-head #388 `edb0f43`: [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43724042011), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43724042013).
> **ACTIVE PR:** v1.46.14 пока локальная отдельная ветка, **нового PR и Linux PR-head CI нет**. Не выдавать проверку #388 за проверку v1.46.14.
> **LAST VERIFIED:** Node 31/31 focused PASS на исходном v1.46.14; новый регрессионный RED → GREEN для синхронизации операции выбранного подпути. `npm run build` PASS; реальный Chrome `npm run test:browser:pen-boolean` PASS: Layer menu → drag применённого anchor и обоих handleIn/handleOut с Alt independent → полный RGBA alpha digest, Undo/Redo → `.zpe` → PSD+PSB native editable cubic geometry/operation; независимый Saved Path неизменен. Windows `npm run check` ранее: 1618 PASS / 10 SKIP / 5 Linux-only `/proc/cgroup` FAIL; не считать full PASS.
> **REAL IMPLEMENTATION:** прямое редактирование узлов и обеих ручек уже применённой Vector Mask; существующие подпути маски меняют add/subtract/intersect/exclude через Layer/context menu без повторного Apply Saved Path; guards exact document/layer/mask/subpath, inherited group lock, invalid/no-op. Исправлен реальный UX-дефект — выбор подпути в модальном окне синхронизирует выбранную операцию. History/Undo/Redo и сохранение нативной структуры проверены.
> **REMAINING ACCEPTANCE:** fresh full Chrome browser suite PASS (117.57 s, exit 0); опубликовать bounded v1.46.14 PR → exact head Linux core и real-photo CI → review/merge при gates → exact-main CI. Затем внешний Photoshop-authored PSD/PSB interop; не приписывать self-round-trip Photoshop parity.
> **NEXT IMPLEMENTATION ACTION:** **CAP-BEZ-MASK-ADJUSTMENT-DIRECT-EDIT** — настоящий UI Pen edit applied Vector Mask на Levels/Curves adjustment внутри группы; проверить compositing реальных пикселей нижнего слоя, inherited group lock, History/Undo/Redo, `.zpe` и native PSD/PSB geometry+adjustment без flatten, включить stale-document/target смену во время drag. Реальный RED → production fix → browser acceptance.
> **BLOCKERS:** внешний корпус Adobe-authored Saved Paths/Vector Masks и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md) BLOCKED, но не останавливают независимые code slices.

## Краткая очередь

1. **CAP-BEZ-MASK-DIRECT / v1.46.14:** завершить fresh browser/full acceptance и GitHub PR/CI/merge gates после #388.
2. **CAP-BEZ-MASK-ADJUSTMENT-DIRECT-EDIT — NEXT CODE P1:** уже применённая adjustment-layer Vector Mask, cubic handles, compositing, inherited locks, stale-owner и PSD/PSB native.
3. **CAP-BEZ-MASK-PSD-UI:** Adobe-authored external interop и полная raster/shape/adjustment mask матрица.
4. **Stage 6 / 003X/6c-9:** конкретные Worker stale/close/edit риски; **CAP-RAW Stage 9:** реальный RAW develop pipeline TODO.

**История и доказательства:** [матрица](CAPABILITY_MATRIX.md) · [карта](README.md) · [журнал](002-bez-mask-psd-ui.md).

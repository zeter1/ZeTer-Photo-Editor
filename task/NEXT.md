# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / **CAP-BEZ-MASK-ADJUSTMENT-DIRECT-EDIT** — прямое редактирование применённой Vector Mask сгруппированных Levels/Curves; следующий gate — GitHub PR-head CI, review, merge и exact-main CI.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (production fix и Windows локальная приёмка выполнены, Linux PR-head/exact-main ещё NOT RUN на новом коде). Родители CAP-BEZ / CAP-MASK / CAP-PSD остаются IN PROGRESS.
> **BASE MAIN SHA:** `d76d0c66ba8ee83d2ff0dca1652b8db0890c1a0d` — актуальный docs-only HEAD после #389, проверен 2026-11-15.
> **BRANCH:** `feat/adjustment-mask-direct-edit-20261115`; версия `1.46.15`; PR/commit заполнять только после реальной публикации.
> **PREVIOUS GATES:** #389 [MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/389) в `553e74715c79d97d83a456fa8f33612e43ab58a6`; exact-main `d76d0c6` [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729982189). Старый main `553e747`: [core CANCELLED](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729734006), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729733879).
> **LOCAL EVIDENCE:** Node RED — 2 FAIL (orphaned preview при inherited group lock и stale document) → GREEN 51/51 focused PASS, плюс selected layer/group change и external writer no-clobber; реальный Chrome `file://` `npm run test:browser:adjustment-mask-direct` PASS: nested Levels+Curves, clipping, actual pointer anchor/handle, full RGBA composite, History Undo/Redo, `.zpe` reopen, editable native PSD+PSB self-round-trip. `npm run build` PASS. Windows `npm run check`: **1626 PASS / 10 SKIP / 5 Linux-only `/proc/cgroup` FAIL**, не полный PASS. Full Chrome `npm run test:browser` **PASS, exit 0 (181.69 s)** через Windows Chrome `file://`.
> **REMAINING ACCEPTANCE:** GitHub exact PR-head core+real-photo CI, review/merge, exact-main core+real-photo; внешнее Photoshop-authored acceptance отдельно BLOCKED (self-round-trip не доказывает Adobe GUI parity).
> **NEXT IMPLEMENTATION AFTER MERGE:** **CAP-BEZ-MASK-NODE-INSERT-DELETE (P1 TODO)** — настоящие Pen insert/delete узлов существующей применённой Vector Mask (raster, shape, grouped Levels/Curves) с сохранением кубических сегментов; exact owner/group-lock/stale guards, Undo/Redo, `.zpe`, PSD/PSB editable geometry, реальные Chrome `file://` pointer tests. Не повторять уже сделанный anchor/handle drag.
> **OTHER BLOCKERS:** внешний Adobe-authored Saved Path/Vector Mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md) BLOCKED.

## Краткая очередь

1. **CAP-BEZ-MASK-ADJUSTMENT-DIRECT-EDIT:** P1 IN PROGRESS — локальная реализация/приёмка готовы; PR CI → review → merge → exact-main gates остаются.
2. **CAP-BEZ-MASK-NODE-INSERT-DELETE:** P1 TODO — новый функциональный Pen-срез после завершения CI/merge текущего.
3. **CAP-BEZ-MASK-PSD-UI:** IN PROGRESS — настоящий Photoshop-authored interop/Adobe GUI и high-depth editable PSD/PSB.
4. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit parity. **Stage 9 / CAP-RAW:** TODO — рабочий RAW pipeline.

**История:** [матрица](CAPABILITY_MATRIX.md) · [карта](README.md) · [журнал](002-bez-mask-psd-ui.md).

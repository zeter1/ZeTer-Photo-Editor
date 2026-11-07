# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2 / CAP-ADJ-STACK — корректирующие Levels/Curves в группах, clipping и совместно с масками.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — локальный bounded CAP-ADJ-STACK compositor + Chrome acceptance PASS, GitHub PR-head CI ещё не подтверждён.
> **BASE MAIN SHA:** `30590285bb7e5eb547854dd1fa21cacc589db3d2` — текущий docs-only main после [PR #379 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379); exact-main core CI [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42365185702).
> **ACTIVE PR:** CAP-ADJ-STACK локальная ветка `feat/adjustment-stack-compositor-20261107`; публикация и PR-head CI отдельно. Предыдущий [#379](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379) MERGED.
> **LAST VERIFIED (2026-11-07):** CAP-MASK-VD #378 bounded DONE — head [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796878), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796954), exact-main `8522b22` [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763495), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763521). CAP-ADJ-CREATE #379 bounded DONE — exact PR-head `56ce6c04` [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42364582039), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42364582048); local build PASS, **48/48 focused Node PASS**, настоящий Chrome `file://` adjustment and vector-mask PASS, полный Chrome smoke PASS (105.39s), Undo/Redo и Ctrl+S `.zpe` save/reopen PASS. Full Windows `npm run check` ранее FAIL на 5 Linux-only `/proc/cgroup` tests; не считать Windows full green. Exact-merged-main #379 CI для `275be947` и последующего documentation commit проверить отдельно.
> **REMAINING ACCEPTANCE:** bounded Chrome v1 .zpe / nested groups / clipping / raster+vector masks / Levels→Curves / History/Undo/Redo LOCAL PASS (46/46 focused), полный Windows Chrome file:// PASS. Full Windows check FAIL: 1601 PASS / 10 SKIP / 5 Linux-only cgroup FAIL. Настоящий .zpe v2/native-bit cross-check, Photoshop-authored PSD/PSB editability, Linux CI и exact-main отдельно НЕ приняты; CAP-ADJ parent IN PROGRESS.
> **NEXT IMPLEMENTATION ACTION:** RED→GREEN реального clipping/group контрпримера выполнен, настоящий Chrome `file://` Levels→Curves/маски/Undo/Redo/.zpe PASS. Теперь окончательные quality gates → независимый PR/exact-head CI → review/merge/exact-main CI. Далее отдельный CAP-ADJ-PSD с Photoshop-authored native editable Levels/Curves; без подмены synthetic parity. [Текущий журнал](002-adjustment-stack.md).
> **BLOCKERS:** внешний Adobe Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED независимо; Stage 6 native Worker RSS/peak UNKNOWN.

## Краткая очередь

1. **CAP-ADJ-STACK:** nested pass-through/isolated groups, fail-closed clipping, raster/vector mask + Levels→Curves pixel/UI/History/Undo/`.zpe` bounded LOCAL PASS; review/PR-head/exact-main CI PENDING — CURRENT.
2. **CAP-ADJ-PSD:** сохранить editability Level/Curves и native PSD/PSB round-trip на подтверждённых Adobe-authored файлах, не считать синтетическую parity.
3. **CAP-MASK/CAP-BEZ:** Photoshop-native vector mask controls и пути, full UI / PSD/PSB compatibility IN PROGRESS; предыдущий #378 bounded DONE.
4. **Stage 6 / 003X/6c-9:** targeted Worker stale/close/edit native parity, отдельный Adobe PSB32 provenance BLOCKED.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [CAP-ADJ-CREATE](002-adjustment-layer-creation.md) · [CAP-MASK-VD](002-vector-mask-density-feather.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).

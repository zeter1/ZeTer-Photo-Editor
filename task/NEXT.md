# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / CAP-ADJ-PSD-UI — пользовательский PSD/PSB Levels/Curves экспорт-импорт; production fix и E2E локально реализованы, GitHub публикация/CI ещё ожидаются.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — local code+Chrome acceptance PASS; remote push/PR/CI/merge НЕ выполнены без отдельного прямого разрешения согласно `G:\Мои навыки\zeter-github-workflow`.
> **ACTIVE PR:** не открыт на момент локальной проверки; публикация ветки и PR-head CI ожидаются по разрешённому GitHub workflow.
> **BASE MAIN SHA:** `70a17f1b2a56e0fa370c92b12efc480c3dd32701` (2026-11-07). Exact-main CI [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42383789995).
> **LAST LOCAL VERIFIED (2026-11-11):** CAP-ADJ-PSD-UI — RED: экспорт raster mask корректирующего слоя с канонической геометрией 1×1 приводил к PSD/PSB mask alpha=0 в документе 64×64, хотя native `levl`/clipping/group/vector mask присутствовали; GREEN: raster mask adjustment отрисовывается в пространстве всего документа. Настоящий production Chrome `file://` Layer menu Levels/Curves, RGB red point, UI export PSD+PSB, import, pixel/alpha, editable native metadata, History/Undo/Redo, group+clipping+raster/vector intersection, `.zpe` reopen — PASS. 19/19 focused Node tests PASS (including new document-space mask regression); full Chrome browser smoke PASS (103.31 s); Windows full `npm run check`: 1603 PASS / 10 SKIP / 5 Linux-only cgroup FAIL. [Журнал](002-adjustment-psd-ui.md).
> **NEXT IMPLEMENTATION ACTION:** после отдельного разрешения опубликовать текущий HEAD локальной ветки `feat/adjustment-psd-ui-20261107` через GitHub plugin, открыть PR, выполнить PR-head Linux CI, review/merge по разрешённому workflow, проверить exact-main CI. Затем отдельный следующий кодовый срез — CAP-BEZ-MASK-PSD-UI: воспроизвести первый неудовлетворённый реальный Vector Mask/Saved Paths UI gate в production Chrome: создать Saved Path через Pen, применить как Vector Mask к слою, изменить anchor/handles и boolean operation, экспортировать PSD/PSB через UI, открыть обратно, сверить геометрию/альфа-пиксели/History/Undo/Redo/`.zpe`; при расхождении исправить конкретный owner без flatten. Не дублировать готовые Levels/Curves.
> **REMAINING ACCEPTANCE:** Adobe Photoshop-authored Levels/Curves GUI readback, native-depth 16/32 и PSB32 provenance НЕ подтверждены; CAP-ADJ, CAP-PSD и CAP-BEZ остаются IN PROGRESS.
> **BLOCKED:** независимый Adobe-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md), не заменять synthetic/self-readback.

## Очередь

1. **CAP-ADJ-PSD-UI — CURRENT GITHUB PENDING:** локальный коммит готов; PR-head/merge/exact-main ещё не выполнены.
2. **CAP-BEZ-MASK-PSD-UI — NEXT CODE:** Saved Paths/Vector Mask, editing/boolean operations и PSD/PSB UI native round-trip.
3. **CAP-ADJ-PSD-EXT — внешняя зависимость:** Photoshop-authored editable Level/Curves и Adobe GUI confirmation; только при наличии подтверждённого корпуса.
4. **Stage 6 / 003X/6c-9:** Worker stale/close/edit native parity, отдельный PSB32 provenance BLOCKED.

**Последние bounded реализации:** [CAP-ADJ-PSD-UI](002-adjustment-psd-ui.md) (локально PASS, GitHub gates pending; commit `819ef38`), [CAP-ADJ-PSD-NEW #381](https://github.com/zeter1/ZeTer-Photo-Editor/pull/381) MERGED, [CAP-ADJ-STACK #380](https://github.com/zeter1/ZeTer-Photo-Editor/pull/380) MERGED, [CAP-ADJ-CREATE #379](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379) MERGED, [CAP-MASK-VD #378](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378) MERGED. [Матрица](CAPABILITY_MATRIX.md) · [План](README.md).

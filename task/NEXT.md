# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2 / CAP-MASK-VD — интеграция плотности и растушёвки векторной маски.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (код готов; PR-head CI PASS; merge не выполнен, требуется отдельное разрешение согласно локальному GitHub-навыку).
> **BASE MAIN SHA:** `9fa6a7d90477bc4c36534daeaec3a7e71153c6ec`.
> **ACTIVE PR:** [#378](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378) OPEN, exact head `60c52a8b2aba71343cf53f850f3e418b53ab35fa`, mergeable/clean на момент проверки, без запрошенных reviewers/review threads. Rulesets пусты, branch-protection API возвращает 403: обязательность ревью не подтверждена.
> **LAST VERIFIED (2026-11-07):** PR-head [core CI #42353796878](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796878) **PASS** и [independent real-photo #42353796954](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796954) **PASS** для exact head 60c52a8. Повторный Windows focused unit **24/24 PASS** и настоящий Chrome file:// vector-mask alpha/History/Undo/Redo/.zpe **PASS**. Предыдущий Windows full npm check содержит 5 Linux-only /proc/cgroup FAIL, не считать полным локальным PASS. Exact-main CI для #378 **NOT RUN** (PR не слит).
> **REMAINING ACCEPTANCE:** разрешённый merge PR #378, точный итоговый main SHA, exact-main CI и independent real-photo workflow. PSD/PSB editable mask controls и Photoshop-authored parity остаются вне bounded scope.
> **NEXT IMPLEMENTATION ACTION:** получить отдельное прямое разрешение на merge PR #378, проверить неизменность SHA `60c52a8` и exact-main CI. Совместная CAP-ADJ-CREATE + интерактивная SVG Curves подготовлена в `feat/adjustment-layer-after-vector-mask-20261107` поверх head #378; изменение Curves через реальные pointer click/drag, один History commit, Undo/Redo, native .zpe Blob/reopen проверяются в Chrome file://. После разрешённого merge #378 перенести только CAP-ADJ diff на фактический main, повторить unit/Chrome/gates и отдельно разрешённый push/PR. PSD editable round-trip оставить самостоятельной задачей.
> **BLOCKERS:** явное разрешение на merge/push по `G:\Мои навыки\zeter-github-workflow\SKILL.md`; Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED независимо.

## Краткая очередь

1. **CAP-MASK-VD:** PR #378 — merge/exact-main CI после разрешения; без повторной реализации.
2. **CAP-ADJ-CREATE + Curves + Colorize:** локальная `feat/adjustment-layer-after-vector-mask-20261107` поверх head #378: создание 8 типов, Master/RGB Curves click/drag/Alt+click, Hue/Saturation Colorize toggle, настоящий composite/History/Undo/Redo/Ctrl+S `.zpe` и Chrome file://. **51/51 combined focused unit PASS**; адресные Chrome adjustment и vector-mask smoke PASS (реальные RGB, reopen), полный Chrome browser smoke PASS (111.46s). Ещё НЕ в main/PR, удалённый CI NOT RUN; [журнал](002-adjustment-layer-creation.md).
3. **CAP-ADJ:** полнофункциональные Levels/Curves, группы/маски и PSD editable export/round-trip — IN PROGRESS.
4. **CAP-BEZ:** Vector Mask / Saved Paths direct E2E и подтверждённый PSD/PSB path parity — IN PROGRESS.
5. **Stage 6 / 003X/6c-9:** native Worker stale/close/edit parity — независимый трек.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [CAP-MASK-VD](002-vector-mask-density-feather.md) · [CAP-ADJ-CREATE](002-adjustment-layer-creation.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).

# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2 / CAP-ADJ-CREATE — типизированные корректирующие слои, интерактивные Curves и Hue/Saturation Colorize.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — реальный код и локальные acceptance PASS, PR-head CI / merge текущего среза предстоят.
> **BASE MAIN SHA:** `8522b22f8ad87d88257063b202e42c1cae9dca86` — [PR #378 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378).
> **ACTIVE PR:** [#379](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379) OPEN, ветка `feat/adjustment-layers-editable-20261107`. Сверять фактический latest head при проверке CI; doc-only commits изменяют SHA.
> **LAST VERIFIED (2026-11-07):** CAP-MASK-VD #378 head [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796878), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796954), merge `8522b22`, exact-main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763495), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763521). CAP-ADJ Git-blob-for-blob transferred from local worktree: `npm run build`, **48/48 focused unit PASS**, real Chrome `file://` `npm run test:browser:adjustment-create` PASS (Levels / interactive Curves / Colorize visible RGB, History, Undo/Redo, Ctrl+S `.zpe` Blob/reopen), `git diff --check` PASS. Full Windows `npm run check` previously FAIL on 5 Linux-only `/proc/cgroup` cases; not full Windows green. PR #379 exact-head Linux CI pending until verified.
> **REMAINING ACCEPTANCE:** latest-head PR #379 core (full Linux npm check, bundle parity, real file:// browser), independent real-photo CI, review/merge, exact-merged-main CI. CAP-ADJ parent remains IN PROGRESS: masks/groups/clipping and Photoshop-authored editable PSD/PSB round-trip unverified.
> **NEXT IMPLEMENTATION ACTION:** принять #379 только по latest-head gates; затем CAP-ADJ-STACK: Levels/Curves compositing в вложенных группах, clipping и масках с негативными тестами, Undo/Redo, native `.zpe`, PSD editable round-trip для подтверждённого формата. Не заменять редактируемые модели flatten.
> **BLOCKERS:** Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED отдельно; Windows `/proc/cgroup` fixtures заведомо Linux-only, CI проверяет их на Linux.

## Краткая очередь

1. **CAP-ADJ-CREATE / Curves / Colorize:** [PR #379](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379) — verify exact head + independent CI, review/merge, exact-main CI; код и Chrome приемка есть.
2. **CAP-ADJ-STACK:** клиппинг, маски, вложенные группы, editable PSD/PSB, Levels/Curves точность — следующий пользовательский вертикальный срез.
3. **CAP-MASK/CAP-BEZ:** vector mask PSD controls и Photoshop-authored paths; CAP-MASK-VD bounded DONE через #378, родители IN PROGRESS.
4. **Stage 6 / 003X/6c-9:** Worker stale/close/edit parity и native bit oracle; Adobe PSB32 provenance отдельно BLOCKED.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [CAP-ADJ](002-adjustment-layer-creation.md) · [CAP-MASK-VD](002-vector-mask-density-feather.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).

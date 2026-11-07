# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK:** [Stage 2 / CAP-BEZ — Alt+Shift сглаживание узла Shape, Vector Mask и Saved Paths (PR #125)](002-bezier-smooth-anchor.md)
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** PR #126 (Pen first-anchor closure) MERGED
> **BASE MAIN SHA:** `2d02391c572c895b5640b0aaa33b767f5da7d5e1` — [PR #126](https://github.com/zeter1/ZeTer-Photo-Editor/pull/126) merged exact head `b51bc0b`; PR-head [Linux core #41848991620](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41848991620) SUCCESS 12/12 and [real-photo #41848991037](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41848991037) SUCCESS. Exact-merged-main [core #41850289039](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41850289039), [real-photo #41850289066](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41850289066) PENDING at current observation.
> **ACTIVE PR:** [#125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) OPEN, head 9a547f2fc26337782d4f71aa7978d0040e0e1d2b (mergeable, no reviews). [Linux core #41851946246](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41851946246) SUCCESS and [independent real-photo #41851946082](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41851946082) SUCCESS **for this original head only**. Новые E2E изменения локальные, CI нового head NOT RUN.
> **LAST VERIFIED (2026-11-07):** focused path tests 37/37 PASS, npm run build PASS (383e86be13a7efb7), git diff --check PASS. Настоящий Chrome file:// npm run test:browser:pen-smooth PASS: UI Alt+Shift click Shape, no-op повторного клика, Undo/Redo, реальный Ctrl+S .zpe Blob + проверка handles + reopen и обратный Alt→corner. Старый полный Chrome smoke PASS (103.12s); полный Windows npm test ранее FAIL на пяти Linux-only /proc/cgroup тестах.
> **REMAINING ACCEPTANCE:** опубликовать новый E2E+CI в существующий #125 без force; проверить новый head Linux core и independent real-photo CI, review/merge и exact-main CI после merge. Настоящий UI E2E Vector Mask/Saved Paths и editable PSD/PSB round-trip открыты; не объявлять CAP-BEZ полностью DONE.
> **NEXT IMPLEMENTATION ACTION:** завершить существующий #125 с новыми CI checks, затем выбрать Stage 2/CAP-MASK — первый реальный недостающий UI edit workflow для векторной маски с Undo/Redo, .zpe и применимой PSD/PSB приёмкой.
> **BLOCKERS:** Adobe-authored PSB32 provenance 002B/2c BLOCKED; full Stage 6 native Worker editing/cancel stale/close still IN PROGRESS, Worker PID/RSS/peak UNKNOWN and not a reason to delay independent Stage 2 work.

## Дальнейшая очередь

1. **Stage 2 / CAP-BEZ**, existing #125 smooth-anchor integration — CURRENT.
2. **Stage 2 / CAP-MASK or CAP-ADJ**, new real user workflow after current PR is accepted; prioritize render + Undo/Redo + .zpe over planning.
3. **Stage 6 / 003X/6c-9**, bounded changed-native edit/Worker UI cancel/stale/close parity only when actionable and testable; parent stage incomplete.
4. **002B/2c**, Photoshop-authored PSB32 provenance BLOCKED externally.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [Детальная задача](002-bezier-smooth-anchor.md) · [История Stage 6](003x6c9-history-sharing-profile.md) · [Архив NEXT](archive/2026-11-04-NEXT-legacy.md).
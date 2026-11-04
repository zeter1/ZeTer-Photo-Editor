# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK:** [Stage 2 / CAP-BEZ — Alt+Shift сглаживание узла Shape, Vector Mask и Saved Paths (PR #125)](002-bezier-smooth-anchor.md)
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** PR #126 (Pen first-anchor closure) MERGED
> **BASE MAIN SHA:** `2d02391c572c895b5640b0aaa33b767f5da7d5e1` — [PR #126](https://github.com/zeter1/ZeTer-Photo-Editor/pull/126) merged exact head `b51bc0b`; PR-head [Linux core #41848991620](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41848991620) SUCCESS 12/12 and [real-photo #41848991037](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41848991037) SUCCESS. Exact-merged-main [core #41850289039](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41850289039), [real-photo #41850289066](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41850289066) PENDING at current observation.
> **ACTIVE PR:** [#125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) OPEN with original conflicting legacy head `da545c63db7053b29fb92bd25e64858ccc6c7b68`; current-main functional port local on `port-pr125-from-main` (not published yet). Do not duplicate or force push.
> **LAST VERIFIED:** source controller + UI command integration from #125 ported onto current main without conflicts: Alt+Shift click→smooth, tangent handles, closed-path wrap and open endpoints, owner/lock/history validation; focused path command/surface/gesture tests **37/37 PASS**, deterministic bundle build `383e86be13a7efb7`, `git diff --check` PASS. Windows npm test FAIL on five Linux-only /proc/cgroup fixtures; isolated genuine Chrome `file://` `npm run test:browser` PASS (exit 0, 103.12s). These checks belong to local #125 candidate, not prior #126.
> **REMAINING ACCEPTANCE:** native document/save/reopen + actual browser gesture smoke if feasible; independent new-head Linux core and real-photo workflow; merge only after green; verify exact new main CI. All-handle UI and editable PSD/PSB round-trip remain CAP-BEZ IN PROGRESS.
> **NEXT IMPLEMENTATION ACTION:** review/test genuine Alt+Shift Shape/Vector Mask/Saved Paths command against current 1.46.4; update existing PR #125 without force, wait for its exact CI gates, merge when safe. Then select a missing raster/vector mask or adjustment-layer UI workflow with full edit/render/history/.zpe behavior instead of more profiling.
> **BLOCKERS:** Adobe-authored PSB32 provenance 002B/2c BLOCKED; full Stage 6 native Worker editing/cancel stale/close still IN PROGRESS, Worker PID/RSS/peak UNKNOWN and not a reason to delay independent Stage 2 work.

## Дальнейшая очередь

1. **Stage 2 / CAP-BEZ**, existing #125 smooth-anchor integration — CURRENT.
2. **Stage 2 / CAP-MASK or CAP-ADJ**, new real user workflow after current PR is accepted; prioritize render + Undo/Redo + .zpe over planning.
3. **Stage 6 / 003X/6c-9**, bounded changed-native edit/Worker UI cancel/stale/close parity only when actionable and testable; parent stage incomplete.
4. **002B/2c**, Photoshop-authored PSB32 provenance BLOCKED externally.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [Детальная задача](002-bezier-smooth-anchor.md) · [История Stage 6](003x6c9-history-sharing-profile.md) · [Архив NEXT](archive/2026-11-04-NEXT-legacy.md).

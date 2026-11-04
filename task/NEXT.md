# NEXT — единая очередь ZeTer Photo Editor

> **CURRENT TASK:** Stage 2 / CAP-BEZ — [замыкание нового Bézier-контура кликом по первой точке, PR #126](https://github.com/zeter1/ZeTer-Photo-Editor/pull/126)
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** 003X/6c-9 dual-native UI/IDB bounded increment DONE via #377 (parent Stage 6 remains IN PROGRESS)
> **BASE MAIN SHA:** `a0e9fe4816d7385d8e2d8664798caaab6e1037dc` (PR #377 MERGED). Exact-main [core CI #41845793209](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41845793209) SUCCESS; independent [real-photo #41845793202](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41845793202) SUCCESS.
> **ACTIVE PR:** [#126](https://github.com/zeter1/ZeTer-Photo-Editor/pull/126) OPEN, pre-port head `620183696fa93cd0b56ddbeaf2cb538517813bed` conflicts with main; local worktree `port-pr126-from-main` contains original PR code on updated main. Verify remote head after publication; no force push / new duplicate PR.
> **LAST VERIFIED:** zoom-aware first-anchor close after ≥3 nodes, cubic preview, no duplicate anchor, persisted Shape/History command; 17/17 focused Pen/architecture tests PASS, build `291e5af38fc2b416`, `git diff --check` PASS. Full Windows `npm test` overall FAIL on five Linux-only /proc/cgroup tests. First `npm run test:browser` timed out in CDP Runtime.evaluate while tests ran concurrently; independent serial rerun **PASS** in actual Chrome `file://` (exit 0, 109.87s), although direct first-anchor-click Chrome E2E remains to be added.
> **REMAINING ACCEPTANCE:** independent real Chromium file:// smoke, ideally UI first-anchor click/Undo/Redo/save/reopen; publish refreshed PR #126 final head with Linux core and independent real-photo CI; merge only if green and allowed, then exact-main CI. Full Bézier/PSD parity remains IN PROGRESS.
> **NEXT IMPLEMENTATION ACTION:** port original #126 onto exact current main, review/test it, update *existing* branch without force. Then existing [#125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) smooth-anchor conversion or more valuable mask/adjustment UI gap. No duplicate PR.
> **BLOCKERS:** Adobe-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED; Stage 6 changed-native edit + paired Worker cancel/stale/close still open, Worker PID/RSS/peak UNKNOWN (not reason to extend profiling forever).

## Краткая очередь

1. **Stage 2/CAP-BEZ:** PR #126 closure — CURRENT.
2. **Stage 2/CAP-BEZ:** [PR #125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) smoothing — OPEN, check conflicts first.
3. **Stage 6/003X/6c-9:** bounded native Worker/edit/IDB parity when triggered by actionable defect or critical acceptance; parent IN PROGRESS.
4. **002B/2c:** Adobe-authored PSB32 external provenance BLOCKED.

[Матрица](CAPABILITY_MATRIX.md) · [Карта этапов](README.md) · [History журнал](003x6c9-history-sharing-profile.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).

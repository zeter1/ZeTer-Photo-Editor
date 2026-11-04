# NEXT — актуальная задача ZeTer Photo Editor

> **CURRENT TASK:** [003X/6c-9 — bounded real Chrome History/Worker/IDB acceptance](003x6c9-history-sharing-profile.md)
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** 003X/6c-8 DONE
> **BASE MAIN SHA:** [744bcb17055096a32427ed33ee85d21130be820c](https://github.com/zeter1/ZeTer-Photo-Editor/commit/744bcb17055096a32427ed33ee85d21130be820c) — PR #376 MERGED from final head `9fca579`; PR-head [core 12/12 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41825455853), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41825455743).
> **ACTIVE PR:** none for next increment; local branch `feat/003x6c9-dual-native-ui-idb-20261104` (publish after checks).
> **LAST VERIFIED:** 2026-11-04 Windows real Chrome `file://` 65×65 + 1025×1025 two distinct native projects (RGB16, CMYKA32 Float32), generic and pooled History, identical UI Add Raster Layer → Undo → Redo → Save → IndexedDB v2 reload/restore. Original native tile Data URLs and topology compared for exact equality, including Float32 special word patterns. Four 1025² Chrome process cases PASS; current source build `aeb55adcd2382b46`. Merged main exact-main [core attempt 1](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41841115717) FAIL only one Chromium DevTools bootstrap timeout before test; failed job rerun requested, [real-photo main SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41841115559). This is NOT an exact-main core PASS yet.
> **REMAINING ACCEPTANCE:** full paired UI 1025² Worker cancel/stale/tab close while both native docs are active, exact changed-native-word oracle after real edit/Undo/Redo/IDB, final UI timings, PR-head CI and exact-main after merge. Existing RGB16 real click-to-cancel is bounded PASS under #376. Synthetic files are NOT Photoshop provenance.
> **NEXT IMPLEMENTATION ACTION:** finish real two-model UI Worker cancellation/stale/tab-close and changed-pixel original/edit/Undo/Redo/IndexedDB equality, with bounded time/memory samples. If Worker PID/RSS/true peak remains UNKNOWN, close only bounded 003X/6c-9 acceptance and switch to Stage 2 mask/adjustment UX instead of repeating profiling.
> **BLOCKERS:** [002B/2c Adobe-authored PSB32](002b2c-photoshop-psb32-provenance.md) BLOCKED (external provenance); Worker PID/RSS/true operation peak UNKNOWN (not a reason to halt other development).

## Следующая очередь

1. **003X/6c-9**, P1: publish paired dual-native UI/IDB/History increment (new PR-head gates); then bounded Worker cancel/stale/close + changed-bit oracle.
2. **Stage 2 functional slice**, P1: after bounded acceptance choose incomplete mask/adjustment UX with save, Undo/Redo and browser E2E; check open #125/#126 first, no Bézier duplicates.
3. **002B/2c**, BLOCKED: genuine Adobe-authored PSB32 provenance.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [Журнал](003x6c9-history-sharing-profile.md) · [Архив очереди](archive/2026-11-04-NEXT-legacy.md).

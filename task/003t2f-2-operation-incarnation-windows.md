> **003T/2f-2 ACCEPTED (2026-10-19):** Full code and real Chromium `file://` acceptance in [PR #299](https://github.com/zeter1/ZeTer-Photo-Editor/pull/299), final head `6ae4b8ff703ebfd1c2cdd7376a02dee631ed8774`, [PR CI #39298148195 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39298148195), squash merge [main `2522de4b`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/2522de4bd0f97217f938c8c5a2dd2ca9c9f01d1b), [exact-code-main CI #39298757141 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39298757141). Node tests, generated artifacts, genuine PSD16/PSB32 Fill/cancel/retry/Undo/Redo, exact native tile bytes, strict JSON receipts, real Chromium Worker controls and diff hygiene passed. Earlier failed CI runs are retained below as historical regressions. **Bounded acceptance DONE**, not a Worker PID join, continuous OS process census or operation-exclusive memory peak. **NEXT [003T/2g](003t2g-transient-proc-gap-recovery.md)**: recover later independent snapshots after transient `/proc` gaps without filling unknown history. Whole 003T and Stage 003 remain OPEN; P0 002B/2c BLOCKED.

> **PR #299 CI REPAIR (2026-10-19):** [PR #299](https://github.com/zeter1/ZeTer-Photo-Editor/pull/299), initial [CI #39296542524 FAILED](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39296542524) due starttime regex, next [#39296714490 FAILED](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39296714490) due stale array not rejected, and [#39297111414 FAILED](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39297111414) after successful Node/build at browser artifact writer because new fields were omitted by `browser-operation-timeline.mjs`. All three root causes fixed in PR branch; new full CI, merge, exact-main PENDING. Newly changed file: `tools/browser-operation-timeline.mjs`. All failing checks are recorded as failures, never as accepted CI.

# 003T/2f-2 — PSD16/PSB32 PID+starttime operation boundary windows

**Priority:** P1. **Status:** DONE. **Parent:** [003T/2f](003t2f-pid-window-control.md) → [003T](003t-operation-memory-evidence.md). **Depends on:** 003T/2f-1 context-disposal cleanup, 003T/2e explicit read windows, 003T/2d-3 cgroup permission probe.

## Goal and scope

For genuine Chromium `file://` ZeTer-authored large PSD16 / PSB32 UI scenarios, record independently verified Linux `/proc/<pid>/stat` starttime for each *explicit* read window before/after first Fill, Undo/Redo, cancelled mid-kernel Fill and retry. Preserve each skipped/unavailable read as unknown rather than carrying forward identities. Do not claim continuous PID membership, OS Worker PID, exit, operation-specific RAM peak, or independent Photoshop provenance.

## Actual implementation on working branch

- New `tools/browser-operation-incarnation-windows.mjs`: strict versioned summary keyed to the existing 003T/2e read-window audit. Observed entries only contain sorted, unique, valid `pid` + decimal `starttimeTicks`; missing `/proc` observations yield `availability:'unknown'` and `incarnations:null`.
- Every pair of consecutive explicit milestones has a measured unsampled time gap and `pidIncarnationContinuity:'unknown'` even when endpoint PIDs match. No implicit target→PID joins or inferred process exits.
- `tools/browser-renderer-heap-sampler.mjs`: capture PID/starttime only after full CDP process census, per-PID RSS membership validation and successful independent Linux incarnation tracker observation. Keep periodic sampler/census semantics unchanged.
- `tools/browser-large-psd16-smoke.mjs`: real pre/post first Fill, first Undo/Redo, cancel Fill and retry / Undo / Redo boundaries; no potentially blocking probe inserted between kernel write acknowledgement and lock revocation. Existing real native tile-byte and selection quality oracles remain untouched.
- `tools/browser-operation-artifact.mjs`: strict saved JSON readback validation, real browser artifact must include ordered operation boundary windows. Summary rejects forged PID/starttime, duplicate PIDs, inserted gaps and false peak/Worker claims.
- `tests/browser-operation-incarnation-windows.test.mjs`, `tests/browser-operation-artifact.test.mjs`: valid observations, PID reuse between independently sampled endpoints, missing read, forged summary rejection.

## Acceptance checklist

- [x] Implement independent read-window schema + strict negative Node regression cases (committed, not yet executed in complete CI).
- [x] Instrument genuine PSD16 / PSB32 `file://` browser path without disabling native exact-byte / undo / cancel checks.
- [x] `npm run check` with new Node regressions passes on PR head.
- [x] Genuine Chromium `file://` CI smoke runs both PSD16 and PSB32 with real Linux incarnation receipts; JSON artifact validator succeeds.
- [x] Review CI artifacts for expected observed/unknown boundaries, native tile byte preservation and limitations.
- [x] Merge after green PR CI; verify exact-code-main CI success on merged SHA; update `task/NEXT.md`, `task/README.md` and parent task.

## Verified state and restrictions

- **Branch:** [test/003t2f2-pid-incarnation-windows-20261019](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2f2-pid-incarnation-windows-20261019).
- **PR:** pending creation; **local whole-repository Node/Chromium:** unavailable because the container cannot resolve `github.com`; **PR CI / exact-main:** pending.
- **Last checked main before branch:** `992a7c8b30073d16a3dc6012b3122dd5d008aad0`, exact-main Actions [39294712334](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39294712334) SUCCESS.
- **No completed inference:** `workerPidMapping:'unknown'`; `trueOperationPeakKnown:false`; zero proof of continuity between observations. Shared runner cgroup was not delegatable. P0 002B/2c remains BLOCKED for lack of independently licensed Photoshop-authored PSB32.

## Next step

**003T/2f-2 acceptance:** review PR CI, fix real Chromium failures, merge only if green, check exact-main, then mark DONE. **Next technical probe:** 003T/2f-3 real operation-exclusive evidence only if runner/delegated cgroup can be independently established; otherwise continue gap/coverage observability without a false operation peak.

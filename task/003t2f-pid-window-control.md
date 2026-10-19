> **003T/2f-2 CI REPAIR IN PROGRESS (2026-10-19):** [PR #299](https://github.com/zeter1/ZeTer-Photo-Editor/pull/299) actual `file://` Chromium pipeline exposed three defects: invalid starttime matcher, missing-read stale array not rejected, and dropped diagnostic fields at operation-profile serialization. Repaired matcher, fail-closed reader and passthrough of `incarnationWindowAudit` + raw stages; **final-head PR CI and exact-main acceptance not yet verified**, so subtask/parent remain OPEN. [Details](003t2f-2-operation-incarnation-windows.md).

> **003T/2f-2 IN PROGRESS (2026-10-19):** Implementing [explicit real PSD16/PSB32 Linux PID/starttime operation windows](003t2f-2-operation-incarnation-windows.md) in [working branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2f2-pid-incarnation-windows-20261019). Boundaries added before/after first Fill, native Undo/Redo, mid-kernel cancellation, retry; all skipped/missing Linux reads remain unknown, every inter-snapshot interval remains unverified. Strict versioned evidence verifier rejects PID reuse/duplicate/forged completeness and unsupported Worker→PID/peak. **Real PR CI, merge, exact-main acceptance pending**. Preserve all existing native-byte oracles. Whole 003T/2f, Stage 003 remain OPEN; Photoshop-authored PSB32 blocker unchanged.

> **003T/2f-1 DONE (bounded, 2026-10-19):** [PR #298](https://github.com/zeter1/ZeTer-Photo-Editor/pull/298) merged as [main `93de0d9a`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/93de0d9a34b6039a4f83ed2c146d725162600a8a). [Full PR CI #39293802442 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39293802442) and [exact-code-main CI #39294190313 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39294190313) on SHA `93de0d9a34b6039a4f83ed2c146d725162600a8a` including Node, genuine Chromium `file://`, independent Worker lifecycle and receipt verifier. A short Worker now runs inside a disposable browser context; `Target.disposeBrowserContext` is followed by a strict observed baseline of the still-live controller page. Negative regressions reject missing page, duplicate/changed target identities and lingering Workers. Independent real Chromium diagnostic: 4/4 isolated cleanup probes; plain `terminate()` plus navigation sometimes left stale target. **003T/2f parent remains IN PROGRESS. NEXT P1 003T/2f-2:** real PSD16/PSB32 UI operation start/end Linux PID/starttime windows and explicit unknown unsampled intervals; do NOT claim continuous membership, Worker→PID or true operation peak. P0 002B/2c still BLOCKED on authenticated Photoshop-authored PSB32.

> **003T/2f-1 IN PROGRESS (2026-10-19):** Isolated Chromium `file://` short-Worker control in a disposable `Target.createBrowserContext`, explicitly disposed via `Target.disposeBrowserContext` after real Worker message acknowledgement. This addresses the observed race where `terminate()` and navigation left the target listed for >12 seconds; real locally launched Chromium reproduction (4/4 context-disposal probes clean; earlier simple navigation had a persistent target) is an independent diagnostic, NOT full-repo CI. Added strict baseline membership helper requiring controller-page visibility, unique IDs, stable worker types and negative Node unit coverage for delayed cleanup, dropped snapshots, duplicate IDs and type changes. [Working branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t2f-isolated-worker-context-20261019). **PR CI/merge/exact-main: pending.** No Worker→PID mapping, complete process incarnation coverage or operation-isolated peak established. The other 003T/2f acceptance gates (real PSD16/PSB32 operation boundary samples, whole `npm run check`, Chromium smoke, CI, exact-main) remain OPEN.

# 003T/2f — independent Worker target cleanup and PID window control

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md); Stage [003](003-tiled-content-aware.md).
**Dependencies:** 003T/2d-3 real permission-denied cgroup probe ([PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294)); 003T/2e high-depth milestone audit ([PR #295](https://github.com/zeter1/ZeTer-Photo-Editor/pull/295)); 003T/2c Linux launcher PID lifecycle and 003T/2b-2 Worker CDP control.
**Status at creation:** TODO; no implementation or CI should be inferred from this card.

## Goal

Remove ambiguity in real short-lived Chromium `file://` Worker target cleanup and relate independently observed Linux PID/starttime snapshots to genuine high-depth PSD16/PSB32 operation read windows, without claiming seamless PID membership, target-to-PID mapping, or an operation-exclusive memory peak.

## Observed regression / blockers

- Intermediate [PR #294 CI #39278297051](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39278297051) failed: `timeout short Worker removed from CDP` in pre-existing `tools/browser-worker-control-smoke.mjs` even though earlier and later identical functional controls passed. Investigate page teardown/target lifecycle and baseline interpretation rather than only increasing timeout or claiming termination from disappearance.
- Real GitHub runner cannot delegate fresh cgroup; independent isolated operation peak and complete descendant census are BLOCKED unless runner privileges/provisioning change.
- Photoshop-authored PSB32 acceptance [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED by absent licensed reference.

## Acceptance criteria

- [ ] Reproduce or isolate short-Worker target disappearance race in actual Chromium `file://`, keep bounded explicit cleanup and no false claim of Worker OS process termination.
- [ ] Add focused automated regression for CDP delayed target visibility/cleanup and fail-closed evidence on unexpected targets, dropped reads, or PID reuse.
- [ ] Run genuine high-depth PSD16 and PSB32 UI Fill/cancel/retry, Undo/Redo with sampled start/end OS incarnation windows, explicitly record unknown unsampled intervals and unchanged native bytes.
- [ ] Keep `trueOperationPeakKnown:false` and `workerPidMapping:'unknown'` unless an independent verifiable operation-exclusive sensor and documented join actually exist.
- [ ] Pass `npm run check`, real Chromium `file://` smoke, strict artifact verifier; publish PR, merge only when CI green, verify exact merged-main and update this card/NEXT/README.

## Handoff

Implement one bounded reliability and incarnation evidence change before attempting further broad memory-peak claims. Retain original test protocol and sampled metrics unless proven unsafe. No task marked DONE before actual CI and exact-main acceptance. 

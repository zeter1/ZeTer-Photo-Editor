# 003T/2f — reject missing and contradictory milestone memory evidence

**Priority:** P1. **Status:** IN PROGRESS (PR CI and exact-main gate pending).
**Parent:** [003T](003t-operation-memory-evidence.md), [Stage 003](003-tiled-content-aware.md).
**Dependencies:** [003T/2e](003t2e-milestone-window-audit.md) merged as main `092ff41f` with exact-main [CI #39287187012](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39287187012) success; [003T/2d-3 PR #294](https://github.com/zeter1/ZeTer-Photo-Editor/pull/294) merged as main `d302b30f`, PR [CI #39287659595](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39287659595) success; exact-main CI pending at this writing.

## Goal and acceptance

Real serialized Chromium `file://` PSD16/PSB32 milestone receipts must list **all** nonperiodic reads and must never report privateMemory, RSS, or a validated Linux incarnation when the matching CDP PID census was unobserved. A Linux incarnation also requires an actual usable RSS read. Forged/inconsistent JSON must fail closed. No operation peak or Worker→PID can be deduced.

## Implementation

- `tools/browser-milestone-window-audit.mjs`: require `milestones.length === snapshotCount - periodicSamples`, with finite nonnegative integer periodic count; no omission of an explicit read under otherwise plausible `sampledReadCount`.
- Same verifier: privateMemory, Linux RSS, or Linux incarnation **cannot** be observed when the CDP PID list is missing; Linux incarnation additionally implies RSS was read. Independent Worker Target observation remains orthogonal.
- `tests/browser-milestone-window-audit.test.mjs`: adversarial receipt omissions, invalid periodic counts, contradictory flags and raw-sample summary fail-closed cases.
- No production rendering, native pixels, Worker scheduling or `.zpe` serialization changes. Existing true peak and Worker PID evidence remain unknown.

## Verification at PR preparation

- Code and tests committed to [working branch](https://github.com/zeter1/ZeTer-Photo-Editor/tree/fix/003t2f-milestone-evidence-consistency-20261019).
- Full local checkout unavailable: container cannot resolve `github.com`. Local full `npm run check` and Chromium `file://` smoke not executed.
- **PR CI / real Chromium receipt validation / merge / exact-main CI: PENDING** until separately read back. Do not mark DONE until those gates pass.
- Browser operation peak remains unproven: runner cgroup delegation probe explicitly reported `cgroup-create-permission-denied`. No true peak, Worker PID, or Photoshop-authored PSB32 claim.

## Next after this gate: 003T/2g

**P1, TODO:** independent PID/incarnation and operation-boundary control on real Chromium high-depth receipts. Acceptance: real file:// PSD16 and PSB32 evidence plus adversarial missing/late observations (PID reuse, /proc EACCES, short-lived process) with *no* inferred continuity across gaps; PR CI + exact-main checks. If no independent OS/CDP join is possible, preserve `workerPidMapping:'unknown'`, `trueOperationPeakKnown:false`. The parent 003T/Stage 003 remains open.

**Parallel P0:** [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED pending licensed Photoshop-authored PSB32 and verified reference rendering.

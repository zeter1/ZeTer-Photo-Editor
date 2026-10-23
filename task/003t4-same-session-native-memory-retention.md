# 003T/4 — Same-session high-depth native memory retention and causal regression

**Priority:** P1. **Status:** TODO. **Parent:** [003T](003t-operation-memory-evidence.md) IN PROGRESS; Stage 003/6 OPEN.
**Dependencies:** [003T/3d](003t3d-worker-pid-isolation-feasibility.md) bounded DONE; existing PSD16/PSB32 `file://` native dense Fill/cancel/Undo/Redo and sampled CDP CPU/RSS controls.

## Goal
Detect reproducible same-session retained-memory growth across multiple actual high-depth browser operations without confusing PID churn, process lifetime HWM or cgroup-wide counters with operation RAM peaks. Make a targeted production fix only if an owned cache/array/Worker lifetime cause is isolated.

## Acceptance criteria
1. Same fresh Chromium `file://` session per depth, at least three *sequential* native PSD16 and PSB32 dense Fill → Undo/Redo or cancel/retry cycles. Preserve exact native 16/32-bit sample bytes, selected-only/alpha/outside pixels, History owner and no stale Worker result.
2. Bracket each cycle with independent CDP SystemInfo and Linux `/proc` PID+starttime and RSS observations; strictly verify identities and re-derive only comparable sampled windows. Missing /proc or changed process membership means unknown, never zero.
3. Record actual operation phase boundaries, count, sampling/read-gap timestamps, and fixed evidence source hashes; distinguish per-cycle retained samples from one-off peak, HWM, whole-session CPU and continuous coverage.
4. Compare comparable cycles and investigate only repeatable suspected growth. If a precise production owner is established, implement a bounded leak/memory-lifetime fix with before/after genuine browser evidence; otherwise record uncertainty, not a claimed leak/optimization.
5. Independent negative Node tests (missing sample, reused PID, mismatched depth and native receipt, duplicate session, forged CPU/RSS/peak/Worker mapping), genuine both-depth Chromium evidence, `npm run check`, exact PR-head CI, merge and exact-main CI.
6. Preserve standalone `file://`, lack of required server/dependency, and native pixel precision. Do NOT retry the same nonprivileged cgroup delegation as a purported new peak measurement: exact 003T/3d-2 runner returned `cgroup-create-permission-denied`.

## Context / limitations
- [003T/3d-2 PR #331](https://github.com/zeter1/ZeTer-Photo-Editor/pull/331) proved controlled Worker CDP target live/absent, a bounded launcher-only CDP/Linux PID join and cgroup permission blocker in real CI; it did NOT map Worker target to OS PID or measure operation peak.
- Separate fresh-process repeated near-cap tests already exist under 003W. This task concerns *repeated operations in a single Chromium session* with conservative retained-memory comparisons. Avoid duplicating prior 003T/3c CPU/RSS milestone or 003T/3d-1 two-boundary churn validators.
- P0 independent Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED; do not reclassify synthetic PSB32 as Adobe-authored.

**First step:** inspect existing repeated same-session native Fill/Undo browser sequences and the CPU/RSS sidecar schema. Choose an independently verifiable per-cycle membership/retention comparison; implement only the missing behavior and a real acceptance gate.

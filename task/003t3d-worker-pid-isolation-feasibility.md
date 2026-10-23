# 003T/3d — Native CPU/RSS PID churn, independent coverage and isolation feasibility

**Priority:** P1. **Status:** TODO. **Parent:** [003T](003t-operation-memory-evidence.md) IN PROGRESS; Stage 003/6 OPEN.
**Dependencies:** [003T/3c](003t3c-cpu-rss-observation-gaps.md) bounded observation accepted; [003T/2d-3](003t-operation-memory-evidence.md) cgroup delegation remained unavailable in prior runner; independently Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.

## Goal
Investigate real independent Linux/Chromium process-membership churn and the limits of operation-resource isolation during native PSD16 and PSB32 `file://` Fill/cancel/retry. Extend trustworthy measurements only where reproducible source identity and scope are proven.

## Acceptance criteria
1. Compare genuine repeated PSD16/PSB32 native operation CPU/RSS sidecars with explicit CDP and Linux /proc identity snapshots; test real PID incarnation turnover / disappearing membership without fabricating a process exit or continuous coverage. Record observed vs unknown windows and read-error causes.
2. Investigate an independently controlled short-lived browser/Worker process case. Any Worker-to-OS-PID association requires a documented, verified CDP-to-PID-plus-starttime join; otherwise keep `workerPidMapping:'unknown'`.
3. Test true operation-isolated CPU/RSS peak feasibility only if supported by runner capabilities (such as delegated cgroup); when unsupported, document an independently validated blocker and retain `trueOperationPeakKnown:false`. Neither `VmHWM` nor sampled CPU jiffies is an operation peak.
4. Preserve real native 16/32-bit selected-only/alpha/outside color, cancellation/no stale Worker results, exact Undo/Redo and `file://` standalone behavior. No production dependency or native precision regression.
5. Strict independent JSON and negative Node tests, genuine Chromium both-depth receipts and, for an accepted implementation, exact PR-final-head CI, merge, exact-main CI. Update `task/NEXT.md`, `task/README.md` and 003T parent.

## Status / first work item
**TODO.** Start with controlled CDP process churn and independent Linux /proc identity tests under actual native Fill/cancel/retry; inspect 003T/3c snapshots and existing 003T/2d cgroup delegation evidence before changing code. Do not reimplement 003T/3c same-census CPU/RSS validation or duplicate historical PRs. Parent 003T remains OPEN and P0 Adobe-authored PSB32 provenance is independently BLOCKED.

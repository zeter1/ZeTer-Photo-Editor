# 003T/4 — Same-session high-depth native memory retention and causal regression

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md) IN PROGRESS; Stage 003/6 OPEN.
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

## 2026-10-23 implementation checkpoint — IN PROGRESS

**Scope:** observational browser test harness and independent fail-closed evidence verifier; no editor production pixel pipeline or cache ownership changes without a measured cause. Original 003T/3d-2 bounded DONE; parent 003T/Stage 003 OPEN.

### Real changes on candidate branch

- `tools/browser-near-cap-ui-smoke.mjs`: opt-in same fresh `file://` Chromium PSD16/PSB32 tab with three sequential real near-cap dense native Fill → exact Undo → exact Redo cycles, including original Escape/cancel/retry, settlement, Worker message/reply counts, native bytes/alpha/outside-selection and exact one History edit. Per-cycle independent CDP/Linux CPU/RSS samples before Fill and after history/settle; observe window starts/finishes and actual source SHA-256.
- `tools/browser-smoke.mjs`: refuse same-session instrumentation without real dense-cancel + CPU/RSS census configuration.
- `tools/browser-same-session-native-retention.mjs`: independently validate literal session identity, format + fixture SHA-256 + original accepted native cancellation receipt digest, three ordered native cycles, read intervals, both Linux CPU and RSS PID+starttime membership per sample. Only compare end-of-cycle sampled RSS when **all observed PIDs and incarnations match across both cycles**, else `unknown`. Never infer peak, Worker PID, leak or continuous process attribution.
- `tools/verify-browser-same-session-native-retention.mjs`: reconstitute both native fixture source hashes and independently audit the saved PSD16/PSB32 artifact pair and distinct session UUIDs.
- `tests/browser-same-session-native-retention.test.mjs`: positive/negative Node cases for observed-comparable, missing `/proc`, permission gap, reused PID, forged metadata, pixel/History claims, timing, native mismatch, peak/Worker claims.
- `.github/workflows/ci.yml`: real `dense-cancel-browser` job gets opt-in third-cycle PSD16 and PSB32, independent JSON verifier, retained artifact `zpe-native-retention-003t4`. Existing dense-cancel and 003T/3b,3c receipts unchanged.

**Priority/dependencies:** P1; 003T/3d-2 accepted, genuine high-depth Worker/file:// fixtures and sampled CPU/RSS support.

**Status / measured results:** all changes committed to working GitHub branch. Real browser, Node `npm run check`, PR exact-head CI, merge and exact-main acceptance remain **PENDING** at this checkpoint. No numerical RSS growth, reproducible leak or causal runtime owner has been measured, so no production memory change is warranted yet. The unprivileged cgroup blocker persists. P0 Photoshop-authored PSB32 provenance 002B/2c remains BLOCKED.

**Acceptance not yet met:** inspect real PSD16 and PSB32 three-cycle CI receipts and failure taxonomy; independently repeat any suspected comparable growth before attributing retained memory to a particular owner; fix and remeasure only if causal; green `npm run check`/browser/PR CI; merge; exact-main CI.

**Next concrete task (003T/4 continuation):** independently verify both real native same-session receipts including unknown windows and matched incarnations; if consistent comparable growth is repeatable, isolate the actual cache/Worker/native array owner and demonstrate targeted before/after genuine Chromium behavior. Otherwise retain unknown/no-leak-proven and keep parent 003T open. Maintain `task/NEXT.md` accordingly.

## 2026-10-23 — First exact PR-head native receipts / bounded 003T/4a acceptance

- Candidate [PR #333](https://github.com/zeter1/ZeTer-Photo-Editor/pull/333), exact original code head `c31bf0d9870e5cbbf18e84668909605d9d2eb9ab`: [core CI #39953617314 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39953617314) **10/10 jobs, 1506/1506 Node**, including genuine three-cycle PSD16/PSB32 `file://` and independent CPU/RSS, native, session/fixture SHA-256 JSON validation. [Real-photo CI #39953617324 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39953617324).
- PSD16 sampled end-of-cycle full Chromium RSS: cycle 1→2 `unknown` (PID-incarnation/process-membership change), cycle 2→3 `sampled-comparable-only`, `+235515904` bytes.
- PSB32: cycle 1→2 `sampled-comparable-only`, `+663715840` bytes; cycle 2→3 `unknown` (PID-incarnation/process-membership change).
- Observations are from **single sampled adjacency only per depth**. In particular this is NOT a proven leak, isolated native operation retention/peak, Worker PID or continuous process coverage. Save Project native readback observer allocations, image/history lifetime and GC remain potential confounders. Independent genuine between-run repeatability and no-mutation/observer control remain untested.
- Decision: **no causal production fix** from one comparable delta. Queue [003T/4b repeated native runs with observer-only control](003t4b-retention-observer-control.md) as the next P1 causal work. Parent 003T/4, whole 003T and Stage 003 remain OPEN. Independent Photoshop-authored PSB32 provenance 002B/2c still BLOCKED.
- This is a **first candidate head** result only; updated final PR-head checks, merge, and exact merged-code main CI are separately pending.

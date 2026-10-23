# 003T/3a — Chromium CPU tick census with OS PID incarnation provenance

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md), Stage 003/6 OPEN.
**Dependencies:** 003T/2f-2 and 003T/2g accepted; 003W/3c DONE [PR #322](https://github.com/zeter1/ZeTer-Photo-Editor/pull/322).
**Branch:** [test/003t3a-chromium-cpu-pid-census-20261023](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t3a-chromium-cpu-pid-census-20261023).

## Goal / acceptance

Independent real Linux Chromium file:// control launches a genuine CPU-consuming temporary Worker and samples CDP process lists with /proc/<pid>/stat user ticks (field 14), system ticks (field 15), and process starttime (field 22). Only nondecreasing counters for the **same PID and same starttime** contribute to overlap evidence. Missing/denied process reads invalidate the whole census, not a partial aggregate.

1. Precision-safe BigInt counters; sorted unique CDP PID membership, monotonic read boundaries, explicit unknown.
2. Independent strict JSON validator recomputes per-incarnation overlap and rejects forged CPU/peak/PID assertions, reversed clock, reuse or counter regression.
3. Real Chromium file:// Worker completion and independent saved-artifact verification in Linux CI; negative Node tests and a real /proc self-control.
4. Exact PR-head CI, PR merge, exact merged-code main CI before marking this bounded subtask DONE.

## Implemented code / tests (pending CI verification)

- tools/browser-linux-cpu-observation.mjs — complete OS census, parsing, comparison and evidence verifier.
- tools/browser-chromium-cpu-control.mjs — fresh file:// Chromium, real temporary CPU Worker, before/after CDP PID/OS observations and readback.
- tools/browser-chromium-cgroup-control.mjs — exports existing CDP helper functions for safe reuse.
- tests/browser-linux-cpu-observation.test.mjs — negative/integrity and real Linux self-read tests.
- .github/workflows/ci.yml — real control + saved JSON validator + artifact upload.
- task/README.md, task/NEXT.md, task/003t-operation-memory-evidence.md — queue and history updates.

## Limits / interpretation

Two non-atomic CDP+/proc snapshots cannot establish continuously complete process membership, all short-lived processes, exclusive operation CPU or true CPU/RSS peaks. Overlapping PID-incarnation user/system tick sums are **jiffies, not milliseconds**, and cannot be assigned to the Worker because CDP Target IDs lack verified OS PID mapping. Missing reads remain unknown, never zero. Worker cancellation, true native 16/32-bit fidelity and undo are not changed by this diagnostic pass.

## Verification and next

**Status: IN PROGRESS** until actual Node/Chromium CI, PR merge and exact-main CI are inspected. Local repository checkout could not be obtained because github.com DNS is unavailable in this environment.

**Next P1 003T/3b (TODO):** attach incarnation-safe CPU observations to real PSD16 and PSB32 high-depth UI Fill/cancel/retry operation boundaries; preserve native data, alpha/outside, history/Undo/Redo, missing-interval uncertainty; verify independent real Chromium receipts. Parent 003T / Stage 003 OPEN, independent licensed Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.

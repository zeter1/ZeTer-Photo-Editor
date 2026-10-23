# 003T/4b — Repeated native RSS retention: observer control and causal attribution

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T/4](003t4-same-session-native-memory-retention.md) IN PROGRESS, 003T and Stage 003 OPEN.
**Prerequisite:** 003T/4a genuine three-cycle PSD16/PSB32 same-session sampled evidence on [PR #333](https://github.com/zeter1/ZeTer-Photo-Editor/pull/333).

## Why next

Initial exact-head [CI #39953617314](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39953617314) (10/10 green) and [real-photo #39953617324](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39953617324) green demonstrate three sequential real browser cycles **per depth**, with independent negative checks. Per-cycle post-Redo compared endpoint sampled aggregate RSS:
- PSD16: cycle 1→2 **unknown** (PID/starttime membership changed); cycle 2→3 observed comparable +235,515,904 B (sampled-only, not leak).
- PSB32: cycle 1→2 observed comparable +663,715,840 B (sampled-only, not leak); cycle 2→3 **unknown** (PID/starttime membership changed).

These observations have **one comparable difference per format**; no repeated same-depth trend exists. They include whole-Chromium memory, unrelated processes and test-observer overhead (project Save/serialize, native sample inspection) and possibly GC timing. The reports correctly say `leakProven:false`, `trueOperationPeakKnown:false`, `workerPidMapping:'unknown'`. Do not interpret either sampled delta as operation-specific retained memory, an exact peak, or proof of a leak.

## Acceptance / next implementation

1. Repeat real `file://` PSD16 and PSB32 same-session, minimum 3 consecutive near-cap native Fill + Undo/Redo per run, in separate fresh process/profile instances, record their independent hashes/PID incarnations and native/History/Worker integrity. Keep old #333 receipts immutable.
2. Add a **matched observer-only control** that serializes/reads the same project/native pixels and probes CDP Linux RSS at comparable checkpoints *without an additional native Fill*, while retaining the same tool-observer and browser process lifetime. Distinguish actual producer memory from measurement-induced serialization/cache/GC effects.
3. Comparison: only same PID+starttime **complete process membership** at sampled endpoints qualifies as `sampled-comparable-only`; missing/replaced PID, denied `/proc`, negative/unbalanced windows remain `unknown`. Never extrapolate from adjacent samples into a continuous window or true operation peak.
4. Require reproducible owner-specific excess over the observer-only control with independent before/after fresh-session evidence before changing production Worker/cache/History/native-array lifetime. Otherwise document `no causal leak established`, not a negative proof of all leaks.
5. Add negative Node tests (cross-session comparisons, missing control, changed PID/starttime, partial snapshot, forged delta/leak/peak attribution), strict independent artifact verifier, real PSD16 and PSB32, `npm run check`, final-head PR CI and exact-main CI. Continue preserving `file://` and full native 16/32-bit selected-only, alpha/outside and Undo/Redo.
6. P0 independently Photoshop-authored PSB32 provenance 002B/2c stays BLOCKED; do not claim compatibility from synthetic PSB32.

**Status:** IN PROGRESS; implementation on branch `test/003t4b-native-observer-control-20261023`, exact-head CI/merge/main not yet verified. Do not repeat known read-only runner cgroup-v2 delegation as if it offered isolated peaks.

## 2026-10-23 — 003T/4b control implementation checkpoint

- Added opt-in real Chromium `file://` **separate fresh-process observer-only runs per format**: first real native Fill/cancellation remains checked; next three bounded control cycles do **not** dispatch Fill, and instead re-read .zpe/native project through exact Undo/Redo snapshots. Each cycle records sequential CDP Linux CPU/RSS, fixed initial Worker job/reply counts, unchanged History, exact native before/after and selection. This is a measurement control, not a memory fix.
- `tools/browser-native-observer-control.mjs`: strict exact-schema/fixture and original native receipt SHA-256, PID+starttime end-sample comparator and independent control+treatment two-format verifier. No cross-session absolute RSS subtraction; no causal leak, worker PID or peak claim.
- `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-smoke.mjs`: guarded `ZPE_SAME_SESSION_RETENTION_CONTROL` run, preserving existing active `003T/4a` path.
- `tests/browser-native-observer-control.test.mjs`: positive and negative PID-gap, reused incarnation, forged delta/peak/leak, native/history/Worker and missing control shape cases.
- `.github/workflows/ci.yml`: two additional real fresh Chromium PSD16/PSB32 runs and strict independent artifact gate, separate `zpe-native-observer-control-003t4b` retained receipts.
- **Acceptance pending:** exact PR-head `npm run check`, genuine two-depth browser artifacts/negative gates, separate fresh-run repeatability, final PR checks, merge and exact-main CI. No retention leak or targeted production fix proven. Independent Adobe-authored PSB32 provenance `002B/2c` still BLOCKED. Parent `003T/4` and Stage 003 remain IN PROGRESS.
- **Next:** inspect actual CI receipts and debug any genuine control issue; compare observed-versus-unknown within sessions without equating differing OS PIDs; repeat independent treatment/control pair before causal owner decision. Keep `003T/4b` OPEN until owner-specific attribution or a bounded no-causal-conclusion acceptance is documented.

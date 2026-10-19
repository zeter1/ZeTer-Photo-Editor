# 003T/2e-1 — fail-closed milestone evidence consistency

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md); follows completed [003T/2e](003t2e-milestone-window-audit.md).
**Branch / PR:** [PR #297](https://github.com/zeter1/ZeTer-Photo-Editor/pull/297).
**Dependencies:** 003T/2e merged via PR #295, 003T/2d-3 via PR #294 (runner cgroup delegation denied).

## Goal

Prevent the saved high-depth Chromium `file://` operation audit from hiding explicit read windows or asserting self-contradictory PID/privateMemory/Linux RSS/incarnation measurements. Never infer operation-exclusive peak or Worker→OS PID from sampled windows.

## Implemented

- `tools/browser-milestone-window-audit.mjs`: require every explicit read: `milestones.length === snapshotCount - periodicSamples`; validate bounded periodic sample count.
- Reject privateMemory, Linux RSS or Linux incarnation flags when the CDP PID census is missing; Linux incarnation additionally requires a Linux RSS reading.
- `tests/browser-milestone-window-audit.test.mjs`: forged JSON omitted windows, invalid periodic samples, contradictory evidence flags, and malformed raw-sample summaries.

## Verification / CI

- Local full checkout unavailable (container DNS for github.com).
- [PR #297 CI run #39289025401](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39289025401): attempt 1 **FAIL** at Chromium DevTools endpoint startup timeout *after successful build/tests*; attempt 2 **SUCCESS** (Node, browser file://, real Worker/cgroup control and remaining checks) on then-current head `3610e83c`.
- Current updated merge head after newer main integration **NOT YET VERIFIED**; PR not done, no merge or exact-main claim until readback.
- No production rendering, native buffer, save, or format mutation. True operation peak remains unknown; Worker PID join unknown.

## Next

**P1 [003T/2f](003t2f-pid-window-control.md)** already exists on main: independently controlled short-Worker disappearance/lifetime and PID-starttime/window evidence on real Chromium PSD16/PSB32, no continuity assumptions across missing reads. Acceptance demands real browser control and CI plus exact-main. Whole 003T/Stage 003 OPEN; P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.

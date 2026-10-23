# 003T/3c — Native high-depth CPU/RSS unknown-window and coverage consistency

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003T](003t-operation-memory-evidence.md) (IN PROGRESS); Stage 003/6 OPEN.
**Dependencies:** [003T/3b](003t3b-high-depth-cpu-evidence.md) DONE via [PR #325](https://github.com/zeter1/ZeTer-Photo-Editor/pull/325). Independently Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED.

## Goal
Follow up the real PSD16/PSB32 `file://` native Fill / Escape cancel / retry CPU observation results. Identify the cause and repeatability of unavailable PSB32 CDP+/proc CPU windows, and compare the meaning of the already implemented operation RSS and sampled CPU boundaries *without* conflating CPU jiffies with RSS, process exclusivity or operation peaks.

## Acceptance
1. Inspect saved PR #325 native CPU receipts and real test logs for OS census unknown reasons; reproduce in independent Chromium `file://` PSD16 and PSB32 sessions; describe whether gaps are transient PID lifetime/permissions/CDP races and avoid inferring missing information.
2. When an individual CDP/PID read is unavailable, retain an explicit reason and unknown for that window, permit later independent recovery, and never carry stale PID counters across gaps. Validate actual before/cancel/retry phase order, no fabricated continuity and no Worker→PID mapping.
3. Add strict CPU-versus-RSS operation-boundary coverage consistency checks or a justified nonimplementation finding if synchronized sampling would introduce observer distortion; samples remain non-atomic and never claim operation-exclusive CPU or true memory/CPU peak.
4. Preserve real native PSD16 and PSB32 selected-only color fidelity, native alpha/outside invariants, Worker cancellation/no late delivery, exact Undo/Redo, project save/reload where affected, and zero mandatory server or new runtime dependencies.
5. Pass negative Node tests, real Chromium `file://` both-depth receipts, independent JSON verifier, PR exact-final-head CI, merge and exact-main CI. Record links/results in task/NEXT.md, task/README.md and parent 003T.

## Known observations and limits
PR #325 real CPU samples: PSD16 5/5 sampled-overlap-only adjacent intervals, PSB32 3 sampled-overlap-only and 2 unknown. Validated by [PR core CI #39925720659](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39925720659) and [exact code-main core CI #39926508046](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39926508046), both SUCCESS. These are **not** CPU operation totals, CPU peaks, operation RSS peaks, continuous process coverage, or verified Worker-to-PID joins. Cgroup isolation remains blocked in the runner. No code or CI for 003T/3c has yet been implemented.

## Work log
**TODO — next implementation pass.** No new branch/PR/test report for 003T/3c yet. Begin by inspecting real 003T/3b artifact and existing RSS/CPU snapshot collectors, instrument only if a reproducible coverage problem is found, and preserve conservative semantics.

## 2026-10-23 — 003T/3c implementation candidate (IN PROGRESS)
Branch: [test/003t3c-cpu-rss-gap-coverage-20261023](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003t3c-cpu-rss-gap-coverage-20261023). Parent 003T and Stage 003/6 remain OPEN.
- **Priority/dependencies:** P1; 003T/3b DONE. Independent Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.
- **Code:** CPU Linux /proc unknown now distinguishes `proc-member-vanished` (ENOENT/ESRCH), `proc-access-denied` (EACCES/EPERM), and `proc-member-unavailable`. A failed partial read never exposes earlier counters; independent later census can recover.
- **Same-milestone CPU/RSS:** one real Chromium CDP process list per Fill/cancel/retry UI milestone, then strictly sequential non-atomic Linux CPU and RSS reads. Separate verified JSON sidecar binds to 003T/3b CPU report and the genuine native PSD16/PSB32 cancellation receipt. Requires exact PID+starttime agreement; mismatches or unreadable samples remain `unknown`. No cross-sample interpolation, operation CPU totals/peaks, peak RSS or Worker PID claim.
- **Modified files:** `tools/browser-linux-cpu-observation.mjs`, `tools/browser-smoke.mjs`, `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-operation-cpu-rss-coverage.mjs`, `tools/verify-browser-operation-cpu-rss-coverage.mjs`, `tests/browser-linux-cpu-observation.test.mjs`, `tests/browser-operation-cpu-rss-coverage.test.mjs`, `.github/workflows/ci.yml`.
- **Verification:** strict new negative tests added (recovery, partial RSS failures, PID-incarnation mismatch, CPU/RSS coverage forgery, unsafe native receipt, phase/read order). Real PSD16/PSB32 file:// CI and independent JSON verifier are configured but *not yet claimed passed* at this checkpoint. Baseline PR #325 PSD16 5/5 observed overlap and PSB32 3/5 observed overlap with two unknown intervals did not record distinct /proc errors.
- **Remaining acceptance:** exact PR-head Node/Chromium and both-depth artifacts; inspect specific unknown CPU/RSS reasons and repeatability; fix failures; merge only after green checks and verify exact merged main CI; update this task and queue to DONE only after evidence. Production editor pixels/rendering and runtime dependencies unchanged.

# 003W/3 — Comparative real near-cap selection-freeze responsiveness

**Priority:** P1. **Status:** TODO. **Parent:** [003W](003w-browser-selection-freeze-responsiveness.md), Stage 003/Stage 6.
**Dependency:** [003W/2b-2i](003w2b2i-failed-import-worker-completion.md) DONE with PR #319 and verified exact-main CI.

## Goal

Reconcile the currently successful near-2M genuine Chromium native Worker outcomes with the still-open requirement to *measure and, only if needed, improve* main-thread UI selection freeze responsiveness. Avoid further ownership-only permutations until measurable latency gaps and causal attribution are understood.

## Acceptance criteria

1. Fresh, independent Chromium `file://` ZeTer-authored PSD16 and PSB32 actual public-UI runs on 1450×1400 native tiled documents: 1,973,400 selected dense indices, sparse selection, and refusal of >2,000,000 selected indices. Preserve source/preview/History and exact native Undo/Redo, alpha and untouched byte invariants.
2. Identify actual production selection-freeze begin/end and `Worker.postMessage` boundaries using monotonic timestamps. Separate selection counting/freezing, UI command handoff, actual Worker execution and publication where instrumentation permits; do **not** label wall time as CPU time. Record timer interval drift, sampling gaps, truncation and uncertainty.
3. Compare multiple runs per format to prior [003W/1](003w-browser-selection-freeze-responsiveness.md) observational baseline and [003W/2b-2b](003w2b2b-dense-worker-success.md) real dense Worker timings. Never compare different selection sizes as though equivalent, or claim an unobserved RSS peak or Worker→PID mapping.
4. If a reproducible UI main-thread bottleneck is established, make a targeted bounded production optimization preserving 2M cap, cancellation/no stale Worker publication, native 16/32-bit accuracy, `file://` startup and Undo/Redo. If not, document measured non-need for optimization and remaining instrumentation limitations.
5. Add strict independent PSD16/PSB32 receipts and negative tests for missing timing boundary, fake near-cap count, impossible chronology, unmeasured peaks or invalid sample gaps. Complete Node and genuine-browser PR CI, merge, and exact-main verification; only mark DONE with observed evidence.

## Open constraints

P0 independently Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED. [003T](003t-operation-memory-evidence.md) operation-specific RSS/CPU peak and verified Worker→OS PID mapping remain OPEN. Do not infer these from renderer heap/timer observations.

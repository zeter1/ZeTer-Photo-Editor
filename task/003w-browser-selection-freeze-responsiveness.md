# 003W — real browser selection-freeze responsiveness and memory evidence

**Priority:** P1. **Status:** TODO. **Parent:** [003 tiled Content-Aware](003-tiled-content-aware.md), Stage 6.
**Dependencies:** [003U](003u-bounded-ui-selection-freeze.md) typed index freeze DONE, [003V](003v-ui-selection-scan-cancellation.md) mid-chunk cancellation accepted on exact-main.

## Objective and acceptance criteria

Move from small synthetic Node cancellation proofs to actual Chromium `file://` UI responsiveness observations for the native tile/Worker selection freeze. Baseline and optimize only if measurements show a reproducible bottleneck.

1. Use real UI PSD16 and PSB32 document sessions and broad dense/sparse selections, including near 2,000,000 selected-pixel Worker budget and out-of-limit refusal.
2. Record actual main-thread event-loop delay distribution and selection-freeze CPU/wall latency, bounded heap/RSS observations, and explicit gaps. Do not claim an operation-exclusive peak or verified Worker→OS PID without independent evidence.
3. Assert cancelled/owner-changed freeze never dispatches a Worker job or mutates native source/preview/history; successful native Worker paths preserve Undo/Redo, alpha, untouched bytes and source immutability.
4. Preserve local no-server `file://`, no new network/runtime dependency, existing bounded typed indices and data safety contracts. Introduce a production optimization only after showing baseline and verifying non-regression.
5. Record reproducible artifacts and strict verifier, `npm run check`, real browser CI, PR merge and exact-main results. Do not mark DONE on simulation alone.

## 2026-10-20 queue

- Created as follow-up to [003V](003v-ui-selection-scan-cancellation.md).
- **Current state TODO:** no implementation, measurements or claims of completion yet.
- P0 independently verified Photoshop-authored PSB32 source provenance remains [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED.

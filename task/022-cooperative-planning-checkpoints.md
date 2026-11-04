# 022 / 010E-B3A — cooperative planning checkpoints for oversized native ROI

**Status:** merged into `main` via [PR #203](https://github.com/zeter1/ZeTer-Photo-Editor/pull/203), squash `55282cc372c90ae0f9ad6122bcc62319a64577e1`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38160333627), [exact-main code CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38160516517) (2026-10-11). Stage 003 is **not closed**.

## Problem and scope

After 020/021, the selection itself was frozen and cooperative ROI decoding/kernel/writes/serialization yielded, but oversized ROI **planning** still ran synchronously: occupied tile scan, pairwise halo merge, tile-to-region membership passes, up to twelve stripe layout scans, winning-plan regrouping, and frozen donor-bitmap construction. Even an obsolete session could spend a long time planning before it became cancellable.

This pass deliberately changes **scheduling, not the planner's chosen regions, pixel math, format, or caps**. A Photoshop-authored oracle is still required separately under [002](002-psd-compatibility-corpus.md).

## Implementation

- [x] One shared generator now checkpoints after every 32,768 visited work entries in the oversized-selection planning paths (occupied tiles, halo links, fragment membership, horizontal strip/segment candidates, winning plan indices, global donor bitmap and per-region selection mask).
- [x] Nested `planRegions` became a generator delegated by `yield*`, so the cooperative runner can yield **inside** an otherwise synchronous full-selection pass instead of only at ROI boundaries.
- [x] The synchronous Node / detached Worker runner exhausts the same generator steps without altering region ordering, source bytes or selection semantics.
- [x] Cooperative `yieldControl()` always rechecks `isCancelled()` before continuing; cancellation returns the original `source` with zero changed/filled/tile counters. In particular no private ROI tile needs to be decoded before a planning-time cancellation.
- [x] Regression fixtures for 512×512 RGB16 with >32k selected pixels: (a) `FromIndicesCooperative` aborts exactly at the planner checkpoint after the existing pre-ROI yield; (b) geometry-scanned `Cooperative` aborts at its first planner checkpoint without a second geometry sample.
- [x] PR checks (Node, generated assets, Chromium `file://`, profiles, diff hygiene), merge, and exact-main CI on code SHA `55282cc3`: all green.

## Invariants / known limits

- Normal small and single-ROI paths retain their previous yield timing. Existing 020/021 RGB16 + CMYKA32 sync/cooperative/Worker bit parity and source immutability tests remain required.
- Each checkpoint covers a bounded count of **visited entries**, not a wall-clock SLA. Array sort in the last-resort 65,536-index fallback and bounded 4,096-run union-find are synchronous; a later pass may split these too.
- Overall planning can still rescan the same selection for multiple fallback layouts. This pass does **not** implement a strict total-visit budget, eliminate repeated scans, measure browser operation-wide peak RAM, or resolve the P0 independent Photoshop-authored PSD/PSB oracle.

## Next execution queue

1. **010E-B3B (P1)**: strict overall planner work/probe budget with deterministic refusal before ROI reads; adversarial fragmented masks and both depth models, exact Worker/cooperative parity, benchmarking.
2. **010E-B4 (P1)**: isolate browser operation memory HWM methodology across renderer/Worker/PIDs and measure planning-to-final-publish duration; don't mislabel sampled RSS as operation peak.
3. **002 (P0)**: obtain licensed, independently Adobe Photoshop-authored RGB16 and CMYK32 PSD/PSB + reference rendering and verify manifest SHA/license/provenance; existing synthetic ZeTer sources are insufficient.
4. **003 (P1/P2)**: big connected high-depth ROI, browser latency/memory, and professional output parity before any broad compatibility claim.

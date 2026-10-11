# 020 / 010E-B1 — bounded adaptive horizontal-run ROI planner

**Status:** merged in `main` via [PR #201](https://github.com/zeter1/ZeTer-Photo-Editor/pull/201), squash `5c3de98b`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38157871061) (2026-10-11). Exact-main CI after merge is tracked separately.

## Goal / why now
The fixed 32/64/128/256px stripe planner and per-tile fragments reject some thin connected diagonal selections despite a small selected-pixel count. Add a deterministic, memory-bounded run grouping fallback without relaxing the aggregate private working-area budget or exposing partially filled tiles.

## Scope
- [x] A secondary horizontal-run planner only when the existing halo-group, per-tile and fixed-stripe planners cannot fit.
- [x] Numeric index sort makes Worker-provided arbitrary index order equivalent to row-major scanner order.
- [x] Merge only touching runs on consecutive rows; cap at 8 rows per region, 65,536 sorted selected indices, 4,096 runs, 256 regions. Exceeding any cap returns to existing atomic refusal; do **not** claim unrestricted connected-component tracing.
- [x] Preserve global frozen donor exclusion, immutable source tiles and aggregate padded-ROI pixel budget; use existing shared sync/cooperative/Worker executor.
- [x] New RGB16 / CMYKA32 regression for 256px diagonal, reverse-order input, full native-pixel oracle, Worker parity, cancellation, budget refusal, pathological checkerboard.
- [x] CI `npm run check`, `npm run test:browser`, generated artifacts verification, informational profiles and diff hygiene — success, [run #38157871061](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38157871061).
- [x] Merge to main: PR #201, squash `5c3de98b`.
- [ ] Check exact-main push CI after merge, independently of PR CI.

## Remaining / follow-up
- 010E-B2: more general connected clusters + worst-case fragmentation caps beyond the 8-row run-band fallback; measure planning time on adversarial masks and large native PSD/PSB.
- Stage 003: real browser operation-wide memory high-water tracking; varied dense/connected selections and reliable cancellation across long planning work.
- Stage 002 P0: independent licensed Photoshop-authored 16/32-bit PSD/PSB fixture provenance and reference renders.
- RAW/DNG pipeline, advanced CMYK/soft proof and parity/quality work are separate unfinished roadmap items.

This subpass **does not complete Stage 002/003**, Photoshop parity or real browser peak-memory accounting.

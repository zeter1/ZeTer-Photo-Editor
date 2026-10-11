# 021 / 010E-B2 — bounded connected horizontal-run bands

**Status:** merged into `main` via [PR #202](https://github.com/zeter1/ZeTer-Photo-Editor/pull/202), squash `656e39f3`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38158700018) (2026-10-11). Exact-main push CI tracked separately. Stage 003 remains open.

## Motivation

010E-B1's greedy horizontal-run fallback only joins the immediately preceding group. Two diagonal strands on the same rows can exceed the 256-region cap even though a bounded connected-components plan fits inside the private ROI pixel budget.

## Implemented in this pass

- [x] Additional last-chance deterministic **8-connected** run-band planner for selections fitting 65,536 selected pixels and 4,096 runs.
- [x] Union-find merges branches and adjacent touching runs within **eight-row bands**, with explicit 32,768 adjacency-check cap and 256 private-region cap. Sort is numeric, including arbitrary Worker index order.
- [x] Refuse when total padded private ROI area exceeds `maxLayerPixels`; retain unchanged global donor exclusions, private tile commit and cooperative cancellation.
- [x] RGB16 and CMYKA32 twin-diagonal 256² fixtures; reverse-order/forward-order parity, sync/cooperative/real Node Worker equality, untouched native pixels and alpha, immutable source, budget refusal and cancel.
- [x] Adversarial checkerboard refusal contract.
- [x] PR CI `npm run check`, Chromium `file://`, generated artifacts, profiles + diff hygiene — all success, [run #38158700018](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38158700018).
- [x] Merge [PR #202](https://github.com/zeter1/ZeTer-Photo-Editor/pull/202), squash `656e39f3`.
- [ ] Verify exact-main push CI independently of PR CI before calling the gate complete.

## Known limits / next passes

This is **not unbounded component tracing**. >65,536 selected pixels, >4,096 runs, >32,768 link probes, >256 components or a too-large aggregate ROI still refuse atomically. Existing fixed-stripe planning happens before this fallback and can still do multiple full selection scans; planning-time UI yields and operation-level browser peak memory remain separate tasks. More complex dense clusters, Photoshop-authored high-depth reference renders, RAW/CMYK soft proof, GPU/ML acceleration and cross-app parity remain open.

# 003W/2b-2b — Real dense ~2M PSD16/PSB32 Chromium Worker success

**Priority:** P1. **Status:** DONE (2026-10-22; bounded dense-worker acceptance, not full 003W).
**Parent:** [003W](003w-browser-selection-freeze-responsiveness.md) / Stage 6.
**Dependencies:** 003W/2b-1 and [003W/2b-2a](003w2b2a-browser-near-cap-ui.md) merged.
**Previous:** [PR #308](https://github.com/zeter1/ZeTer-Photo-Editor/pull/308) verified real sparse Worker 576 indices and >2M refusal. That is **not** dense completion.

## Goal and acceptance criteria

1. Fresh real Chromium file:// per format, import ZeTer-generated high-depth tiled 1450×1400 PSD16 and PSB32; collect 1.9M–2M genuine frozen Uint32 selectedIndices in the **production Blob Worker**.
2. Worker must complete, change native **only selected colors**, leave all native alpha unchanged, preserve outside selected pixels, and maintain exact native .zpe tile bytes across Undo/Redo.
3. Persist strict per-format independent JSON proof: actual Worker-selected count/bytes, nonzero changed selected pixels, selected-only/alpha/History oracles, bounded 8ms renderer-timer intervals, elapsed menu-to-completion and nullable JS heap observations. No unsupported CPU, operation-peak or Worker→OS PID claims.
4. Pass Node unit/negative evidence tests, npm run check, two independent fresh Chromium CI executions, PR-head CI and merge/exact-main CI. Until all checks pass, leave **IN PROGRESS**.
5. If near-2M dense completion times out or errors, preserve failing logs, identify actual production performance/algorithm root cause, and reduce bottleneck without raising the 2M safety limit or weakening validation.

## Implementation in this passage

- `tools/browser-native-selection-integrity.mjs`: replace million-element JS Set of selected indices with a one-bit-per-pixel membership map; reject malformed, duplicate and out-of-bounds indices; compare exact native bytes in every changed tile.
- `tests/browser-native-selection-integrity.test.mjs`: 1450×1400 native 16-bit source with 1,994,400 dense typed selected indices, allowed byte mutation and forbidden outside-region or duplicate mutation.
- `tools/browser-near-cap-ui-smoke.mjs`: opt-in separate dense mode for ~1,973,400-pixel actual UI marquee, production Worker postMessage census, native selected-only/alpha and .zpe Undo/Redo readbacks, bounded renderer pulse/heap observations.
- `tools/browser-smoke.mjs`: opt-in `ZPE_DENSE_NEAR_CAP_BROWSER_ONLY=1` with format. Legacy sparse/over-cap flow unchanged.
- `tools/browser-dense-near-cap-evidence.mjs`, `tools/verify-browser-dense-near-cap-evidence.mjs`, `tests/browser-dense-near-cap-evidence.test.mjs`: strict per-format artifact schema, independent verifier, negative mutation tests.
- `.github/workflows/ci.yml`: distinct `dense-near-cap-browser` CI job, fresh Chromium per depth, strict JSON readback and artifact upload.

## Verification status

- Local repo checkout unavailable in this environment (GitHub DNS unavailable). **Local npm run check and real Chromium NOT RUN**.
- PR-head CI, dense Chromium PSD16/PSB32 success receipts, merge and exact-main CI: **PENDING** as of initial implementation. Do NOT promote this passage to DONE without real green evidence. Older PR #308 proves only sparse success.
- Boundaries: the 1450×1400 PSD/PSB fixtures are ZeTer-generated, **not** independently Photoshop-authored. Timer samples are not isolated CPU or continuous responsiveness traces; heap samples are not operation RSS peak; Worker PID remains unknown.
- If CI dense execution fails, keep status IN PROGRESS and examine real stage logs before changing performance code.

## Next after bounded acceptance

Continue 003W with cancellation during a genuinely dense running Worker, measured UI/operation responsiveness and memory caveats; complete 003W only after evidence supports all acceptance requirements. Stage 003/003T remain OPEN. [002B/2c](002b2c-photoshop-psb32-provenance.md) independent Photoshop-authored PSB32 provenance remains BLOCKED.

## 2026-10-22 first genuine dense PR CI: FAILURE, not accepted

- [PR #309](https://github.com/zeter1/ZeTer-Photo-Editor/pull/309); [initial PR CI #39749406069](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39749406069): **verify SUCCESS** (including `npm run check`, regenerated bundle parity and normal browser smoke), **near-cap-browser SUCCESS** (original sparse + over-cap), **dense-near-cap-browser FAILURE**.
- Genuine `Chromium PSD16 native dense ~2M Worker Fill` stayed without observed **completion acceptance** for the initial 240,000 ms test wait; `BrowserSmokeError: Timed out waiting for 003W/2b-2b genuine dense production Worker completion`. The second PSB32 dense step was **not run**, and no dense JSON was emitted. Do **not** infer whether Worker dispatched, computed but exceeded the 180,000 ms production watchdog, errored, or succeeded with an unexpected UI status from this first log.
- Next code revision adds a separate actual-Worker-dispatch census (actual frozen selected pixels and Uint32 bytes), logs status after dispatch, and prints exact observed status, counts and sampled elapsed values on failure. **New CI after this revision pending**. Never increase production timeout/safety cap merely to get a green test without verified performance and memory analysis.
- Next concrete step: inspect the new dense CI phase evidence. If `jobs===0`, diagnose selection freeze/UI and supplier/bootstrap; if `jobs===1` but no tiled completion, check status and 180 s Worker deadline, CPU kernel cost on near-full mask, no-donor texture case, and safe algorithm optimization. Then rerun PSD16 and PSB32; exact native bytes, alpha, Undo/Redo and JSON must all pass before marking DONE.

## 2026-10-22 genuine dense PSD16 failure, candidate native alpha repair

- [PR #309 CI #39750466446](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39750466446): verify PASS, legacy near-cap-browser PASS; dense PSD16 FAIL. Real production Worker received exactly 1,973,400 frozen Uint32 indices (7,893,600 bytes), but UI status became `Tiled inpaint: invalid Worker result` after ~205 s. Dense PSB32 SKIPPED. No dense success JSON or native Undo/Redo acceptance.
- Candidate bug: generic straight-alpha boundary synthesis and PatchMatch rewrite selected alpha while native tiled Worker result validator requires byte-for-byte unchanged alpha. On Uint16, float average can also truncate an opaque sample to 65534. New explicit `preserveAlpha` option is used only for tiled regions in both paths; legacy generic RGBA blending behavior stays unchanged.
- Regression extends dense CMYKA32 islands to selected alpha 0.375 vs donor alpha 1; synchronous, cooperative, and Node Worker parity must preserve original native alpha. Canonical bundle, standalone file:// Worker supplier, index build marker and version manifest have been regenerated.
- **IN PROGRESS until proven:** candidate does not prove the precise reason behind PSD16's invalid result, nor remove 180 s computation concerns. Require fresh PR-head CI including genuine Chromium PSD16 **and** PSB32 dense success with selected-only/alpha/Undo/Redo, saved strict evidence and exact-main CI. If failure persists, inspect result validation and deadline without loosening caps.

## 2026-10-22 — DONE: final PR-head + exact merged-code main acceptance

- [PR #309](https://github.com/zeter1/ZeTer-Photo-Editor/pull/309) merged as [main `288e7b64`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/288e7b64eb165a418b5304c016f369718a43fccc). Final exact-head `456dcc440094fe536cb5972313499ab43cfc7723`: [CI #39752664130 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39752664130), [real-photo #39752664135 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39752664135); exact merged-code main `288e7b64`: [CI #39753548350 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39753548350). Separate [real-photo main run #39753548386](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39753548386) was in progress at this checkpoint (not claimed green).
- Independent fresh-profile real Chromium `file://` PSD16/PSB32 dense runs each dispatched 1,973,400 frozen Uint32 indices (7,893,600 bytes) to an actual production Blob Worker and completed. PSD16 changed 1,006,908 selected pixels; PSB32 changed 25. Outside-selection native bytes and alpha unchanged in both, exact .zpe save/Undo/Redo proved, strict PSD16+PSB32 JSON receipts verified and uploaded. PSD16 menu→completion 4,261.7 ms, PSB32 3,694.1 ms. Both 8ms pulse samples were capped at 256 and truncated; no continuous responsiveness, operation-exclusive memory peak, Worker→OS PID, or isolated CPU claim.
- Root cause confirmed at behavioral level: native tiled Worker could rewrite selected alpha via generic Boundary/PatchMatch. Explicit tiled-only `preserveAlpha` fixes the failing PSD16 validation without changing general RGBA compositing. Nonopaque CMYKA32 regression tests native sync/cooperative/Node Worker paths.
- **Bounded subtask DONE; parent 003W/003T/Stage 003 OPEN.** Next [003W/2b-2c](003w2b2c-dense-worker-cancellation.md) real near-2M in-flight Worker cancellation/late results/renewed completion. 002B/2c independently Photoshop-authored PSB32 provenance remains BLOCKED.

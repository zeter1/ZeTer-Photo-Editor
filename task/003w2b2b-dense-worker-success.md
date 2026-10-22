# 003W/2b-2b — Real dense ~2M PSD16/PSB32 Chromium Worker success

**Priority:** P1. **Status:** IN PROGRESS (2026-10-22).
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

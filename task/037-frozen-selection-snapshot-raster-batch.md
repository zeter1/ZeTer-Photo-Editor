# Task 037 — Freeze selection semantics for async merged raster batches

## Goal

Make merged multi-layer selection clearing use one immutable selection snapshot for the whole asynchronous batch, so every target is prepared against the same selection geometry even if the live UI selection changes while rasterization / decode / preview encoding is pending.

## Why now / evidence

Task 036 made publication exact-target and all-or-none, but fresh-main review found a separate input-consistency seam:

- `src/selection/raster-mutation-controller.js::clearAcrossVisibleLayers()` captures document/session/target objects, then prepares targets sequentially across multiple `await` boundaries.
- High-depth preparation calls `selection.predicate(layer)`; Canvas8 preparation calls `selection.clipContext(context, layer)`. Both ports are resolved during preparation rather than from one captured selection value.
- `src/main.js` wires those ports to `rasterSelectionPredicate` / `clipContextToSelection`, which read the mutable global `selectionShape`.
- Selection gestures and keyboard selection commands can mutate `selectionShape`; the selection gesture controller does not own `paintPersisting`, and overlay marquee/magnetic dispatch is not rejected merely because a raster batch is pending.
- Therefore exact publication authority alone does not guarantee deterministic batch input: two layers in one merged clear can theoretically be prepared against different live selection versions.

Current code/logs/tests are still the source of truth; re-inspect before changing anything.

## Scope

- Capture one immutable selection semantic snapshot before asynchronous batch preparation starts.
- Make target intersection, native high-depth predicate generation and Canvas clipping for this batch consume that same captured snapshot.
- Keep selection geometry ownership outside the raster-mutation controller. Prefer a narrow snapshot/shape port rather than duplicating marquee/lasso/path math.
- Preserve Task 036 exact document/session/target-set/effective-lock publication gate and all-or-none behavior.
- Preserve merged Clipboard cut semantics, current lock/visibility eligibility, high-depth precision path, history label and shared persistence guard.
- Add/update focused architecture/AI routing docs only if the snapshot contract becomes a reusable rule.

## Non-scope

- Rewriting the selection gesture controller.
- Changing Clipboard API orchestration.
- Introducing a new global immutable selection store.
- Changing selection boolean/shape semantics.
- Broad UI disabling while raster persistence is pending unless evidence proves it is required for correctness.
- Refactoring unrelated selection-mask/vector-mask/painting commands.

## Inspect first

- `AGENTS.md`
- `docs/PROJECT.md`
- `task/README.md`
- this file only from the task queue
- `src/selection/raster-mutation-controller.js`
- selection shape helpers and the raster-mutation wiring in `src/main.js`
- `src/selection/gesture-controller.js`
- `tests/selection-raster-mutation-controller.test.mjs`
- selection/clipboard async-context regressions
- `docs/architecture/RASTER_PERSISTENCE.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `.github/workflows/ci.yml`

## Behavioral contracts to preserve

1. One merged clear is still one history transaction.
2. Task 036 remains intact: after preparation, exact document/session + every exact source target + effective locks are validated atomically before first persisted write.
3. Same-ID replacements/removals/late locks still reject the whole batch.
4. A selection change while preparation is pending must not change the pixels selected for any target already participating in that batch.
5. The live user selection after the operation must not be overwritten/rolled back merely because the batch used an older snapshot.
6. Native 16/32-bit RGB/CMYK targets stay on typed mutation paths where currently supported; no silent Canvas8 demotion.
7. Busy guard releases in `finally`; stale/no-op/error outcomes publish no incorrect history/success.

## Planned direction

Prefer an explicit immutable selection snapshot seam, for example:

- capture a cloned canonical selection shape (or an equivalent immutable snapshot object) once at batch start;
- expose helpers that accept that snapshot explicitly for `intersectsLayer`, per-layer predicate creation and Canvas clipping;
- avoid closures that fall back to mutable global `selectionShape` after the batch has started.

The exact API is not prescribed. Choose the smallest design that keeps geometry ownership canonical and makes snapshot use mechanically obvious in tests/source review.

## Targeted tests

At minimum add deterministic regressions using controlled deferred promises:

- two Canvas/raster targets: change the live selection after the first preparation yield; both targets must be cleared using the original captured selection semantics;
- mixed native high-depth + Canvas8 targets use the same original snapshot;
- replacing the live selection with a different shape (including same bounds but different geometry where practical) must not alter the pending batch;
- clearing the live selection to null while the batch is pending must not turn later targets into full-layer clears;
- the batch must not restore or mutate the newer live selection on success/stale/error;
- existing exact-target replacement/removal/lock regressions remain green;
- source/architecture guard should make accidental reintroduction of live-selection reads in the async batch difficult.

Prefer semantic observation of the snapshot passed to the preparation bridges rather than timing sleeps.

## Required verification

- targeted selection-raster tests;
- relevant selection-clipboard / async-document-context regressions;
- architecture/source guards;
- `npm run check`;
- generated artifact parity;
- `npm run test:browser` because the runtime selection bridge/wiring may change;
- `git diff --check`;
- PR-head CI green, then merged-main CI green.

## Done gate

Only after implementation, review, exact PR-head CI success, merge and merged-main CI success:

1. delete this task;
2. create exactly one evidence-based next task;
3. update relevant repository docs/CHANGELOG;
4. update the Drive engineering brain only with reusable verified lessons, not project-only noise.

## Risks / handoff notes

- Do not “fix” this by suppressing selection input globally unless the snapshot approach is proven insufficient.
- Do not move `selectionShape` ownership into the raster controller.
- Be careful that helper functions such as `pointInsideSelection` currently default to live global selection; a new snapshot-aware path must not accidentally call that live fallback.
- A rectangular-bounds-only snapshot is insufficient for ellipse/lasso/polygon/magnetic semantics.
- Task 036 publication validation and its regressions are the immediate safety net; do not weaken them while changing preparation inputs.

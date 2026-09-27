# Task 036 — Exact-target multi-layer selection raster batch publication

## Purpose

Close the remaining async publication gap in `src/selection/raster-mutation-controller.js::clearAcrossVisibleLayers()` without broadening the already-verified current-layer painting contract.

This is a bounded follow-up discovered during the Task 035 semantic review. Task 035 / PR #61 is complete and verified on merged `main@acf6232ed0b4f27c10bd0471fcff0d696b32ef44` with CI run #353 green.

## Evidence / root cause

Current `clearAcrossVisibleLayers()` correctly captures the originating document/session and prepares all layer results before mutation, but its final publication authority is weaker than the targets that were prepared:

- it awaits rasterization / Canvas PNG / native high-depth preview preparation for multiple targets;
- after those awaits it revalidates only the document object and active session;
- publication locates each target slot with `findIndex(item => item.id === layer.id)`;
- for an original raster layer, a same-ID replacement can make the prepared layer object detached while the command still commits history;
- for a rasterized non-raster target, the ID lookup can redirect `splice(index, 1, working)` into a different same-ID replacement object;
- native high-depth batch clearing intentionally uses the low-level `prepareHighDepthMutation()` / `applyHighDepthMutation()` primitives, so this batch owner must provide its own exact-target transaction contract rather than relying on the current-layer painting seam.

The canonical rule is documented in `docs/architecture/RASTER_PERSISTENCE.md`: authority after the last await must be at least as strict as the authority that created the prepared result.

## Scope

1. Capture the exact source layer object for every planned batch target before async preparation.
2. Preserve prepare-all-before-mutate semantics.
3. Immediately before the first persisted write, atomically revalidate the whole prepared target set:
   - exact originating document object;
   - exact active session;
   - every original target object is still present in that document;
   - no same-ID replacement is accepted as authority;
   - target editability / effective lock assumptions required by the command still hold.
4. Publish by exact object identity / exact validated slot, never by ID-only lookup.
5. If any target becomes stale, publish **none** of the prepared mutations and publish no history/success result.
6. Keep native 16/32-bit RGB and CMYK typed mutations native; do not route them through Canvas8.
7. Preserve existing selection predicate, visibility eligibility, rasterization semantics, locked-layer count, history label and shared persistence guard.
8. Keep Clipboard/browser API ownership in `src/selection/clipboard-controller.js`; this task owns only the destructive batch transaction.
9. Add or extend a focused architecture spec if the batch contract would otherwise need rediscovery; link it from AI routing/boundary/test docs rather than growing `AGENTS.md` into a manual.

## Required regression coverage

At minimum cover:

- successful multi-layer clear with the existing mixed raster/rasterized behavior;
- active document or session change during async preparation → zero publication/history;
- same-ID raster-layer replacement during preparation → zero publication/history;
- same-ID non-raster-layer replacement before rasterized splice → zero publication/history;
- target removal before publish → zero publication/history;
- target becoming effectively locked before publish → zero publication/history;
- high-depth prepared mutation stays unapplied when any batch target is stale;
- prepare/serialization failure remains an error and leaves every persisted target unchanged;
- shared busy guard is released for success, stale and error outcomes;
- source/architecture guard rejects ID-only publication authority in this batch owner.

Prefer deterministic deferred Promises over timing sleeps.

## Likely files

- `src/selection/raster-mutation-controller.js`
- `tests/selection-raster-mutation-controller.test.mjs`
- `tests/async-document-context.test.mjs` if its existing harness is the best adjacent oracle
- `tests/architecture-layout.test.mjs`
- focused architecture / AI-routing / test-matrix docs if the contract becomes reusable
- generated browser artifacts only if canonical source changes require them
- `CHANGELOG.md` for user-visible correctness changes

## Non-goals

- Do not reopen Task 035 current-layer painting persistence.
- Do not redesign selection geometry, Clipboard APIs, rasterization pixel math, PSD/PSB semantics or history storage.
- Do not introduce a generic transaction framework unless concrete repeated evidence proves the small exact-target batch plan is insufficient.
- Do not weaken tests, disable CI checks or suppress preparation failures.

## Verification / completion gate

1. Inspect current `main`, this task, relevant selection/painting ownership docs and `.github/workflows/ci.yml`.
2. Add targeted regressions first or alongside the fix.
3. Run/obtain evidence for the focused selection raster-mutation tests and adjacent async/high-depth tests.
4. Run canonical `npm run check`.
5. Verify generated artifact parity.
6. Run `npm run test:browser`.
7. Review semantic drift: visibility/lock policy, target order, rasterized replacement, history label, status/error behavior and all-or-none publication.
8. Open one bounded PR.
9. Require exact PR-head CI green.
10. Squash-merge only the verified head.
11. Require exact merged-`main` CI green.
12. Only then delete this task and create exactly one evidence-based next task.

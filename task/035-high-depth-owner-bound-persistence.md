# Task 035 — Exact-owner native high-depth paint persistence

## Purpose

Close the next verified async ownership gap in native 16/32-bit RGB and CMYK painting without broadening the pass into retouch math, color-management redesign, or generic transaction infrastructure.

Baseline: `main@2b84d250f0885af62745152201831738bb900e2c` is green after owner-bound Canvas8 persistence.

## Why now / current evidence

Fresh `main` still has a separate high-depth async publication path:

- `src/painting/controller.js::persistNativeHighDepthPaintLayer()` resolves a layer through mutable `currentDocument()`, then awaits `prepareHighDepthMutation(...)`, then applies the prepared mutation without revalidating the originating document or exact layer object.
- `prepareHighDepthMutation()` crosses async PNG preview serialization in `highDepthPreviewDataUrl()`.
- `ensureNativeHighDepthPaintBuffer()` reuses working state by `highDepthPaintLayerId` rather than exact document + exact layer identity, so same-ID replacement deserves explicit regression coverage.
- `src/painting/gesture-controller.js::end()` passes exact owner/target authority only to the Canvas8 branch; the native branch still calls `persistNativeHighDepthPaintLayer()` without that authority and may publish history/success after a document switch.
- high-depth branches in `src/painting/command-controller.js` perform `await prepareHighDepthMutation(...)` followed by `applyHighDepthMutation(layer,...)` and history/status publication without exact-owner/target revalidation.

This is the natural follow-up to `docs/architecture/RASTER_PERSISTENCE.md`: the same capture → prepare → await → revalidate → publish rule should be proven for native high-depth state without conflating Canvas8 and typed-buffer semantics.

## Scope

1. Inspect `AGENTS.md`, `docs/PROJECT.md`, `docs/architecture/BOUNDARIES.md`, `docs/architecture/RASTER_PERSISTENCE.md`, `docs/development/QUALITY_PLAYBOOK.md`, the painting controller/command/gesture owners, high-depth tests, async-document regressions, build graph and current CI.
2. Bind native high-depth working state to the exact originating document and exact raster-layer object, not only layer IDs.
3. Make native async publication explicitly owner-bound:
   - capture owner + exact target before preparation;
   - prepare mutation without persisted writes;
   - after async preview encoding, revalidate exact active owner and exact layer identity immediately before the first persisted mutation;
   - same-ID document/layer replacement is stale.
4. Carry owner/target authority through native paint gesture finalization and high-depth one-shot commands.
5. A stale native result must produce no layer mutation, no history/dirty publication, no success status, and no redirected write.
6. Preserve the shared `paintPersisting` guard and release it in caller `finally`.
7. Preserve native typed-buffer precision, RGB/CMYK models, alpha semantics, selection predicates, tool labels/statuses and existing successful-path history labels.
8. Keep high-depth pixel/retouch math in `src/core/pixel-buffer.js` / `src/retouch/controller.js`; do not move math into orchestration owners.

## Non-scope

- Canvas8 persistence redesign — already canonical in `RASTER_PERSISTENCE.md`.
- Retouch algorithm changes, ICC transforms, PSD/PSB codec work, UI redesign.
- Generic command framework or new busy flag.
- Broad refactor of all high-depth import/export paths.

## Correctness requirements

Use **capture → prepare → await → revalidate → publish**.

Authority must be exact object identity. IDs may remain metadata but cannot authorize publication.

If the working high-depth buffer is a cache, its reuse identity must be at least as strict as mutation authority: exact document + exact layer + compatible buffer contract. A replacement object with the same ID must not inherit old working state.

For multi-field publication (`highDepthSource`, `highDepthPreview`, `dataUrl`), prepare the complete mutation before the first write and publish only after revalidation.

## Targeted regressions

At minimum cover:

- native paint success with exact owner/target;
- delayed preview serialization + active-document switch;
- delayed serialization + same-ID replacement document;
- same-ID replacement layer within the originating owner;
- high-depth working-buffer cache not reused across exact-owner/target replacement;
- gesture end suppresses history / `Готово` for stale native persistence;
- high-depth line, fill and selection-clear suppress history/success for stale owner/target;
- serialization failure keeps persisted native metadata unchanged and releases shared busy state;
- normal RGB16/RGB32/CMYK precision/alpha paths remain green;
- architecture/source guard proves native publication no longer selects authority from mutable current document after the await.

Prefer controllable deferred Promises over sleeps.

## Documentation

If implementation can share the Canvas8 document without making it confusing, extend `docs/architecture/RASTER_PERSISTENCE.md` with a clearly separated native high-depth section. Otherwise create one narrow high-depth persistence spec and link it from:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/development/AI_WORKFLOW.md`
- `docs/testing/TEST_MATRIX.md`

Update `CHANGELOG.md` for code changes.

## Required verification

1. targeted painting controller / command / gesture high-depth regressions;
2. adjacent `high-depth-*`, retouch and async-document tests;
3. architecture/source-contract tests;
4. `npm run check`;
5. canonical generated-artifact parity;
6. `npm run test:browser`;
7. `git diff --check`;
8. focused semantic-drift review;
9. exact PR-head CI green;
10. squash/merge only the verified head;
11. exact merged-`main` CI green.

Delete this task only after merge + green exact merged-`main` CI, then create exactly one evidence-based next task.

## Risks / handoff notes

- Do not treat same `layer.id` as exact target identity.
- Do not mutate the persisted layer before async preview encoding finishes and authority is revalidated.
- Do not let stale native completion publish history against whichever document is active after the await.
- Preserve typed-buffer precision; never route high-depth correctness through Canvas8 as a convenience.
- Source-sliced tests may still encode old signatures. Retarget the oracle to the canonical owner/API instead of adding compatibility globals or weakening production guards.

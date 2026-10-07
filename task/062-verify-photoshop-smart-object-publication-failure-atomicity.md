# 062 — Verify fail-safe final publication for Photoshop Smart Object Save

- **Priority:** P2 — reliability / transaction safety.
- **Status:** готова к работе.
- **Evidence:** свежий code review после task 061; риск пока является явно помеченной гипотезой, а не подтверждённым багом.
- **Source SHA:** `c255c1d8761c83f97b5f2278489941fefed16ab0` (merged task 061; main CI #485 green).
- **Next action:** воспроизвести или опровергнуть реальную throwability canonical final-publication ports до изменения production-кода.

## Goal

Determine whether a synchronous exception during the **final Photoshop Smart Object publication region** can leave a partially mutated parent/resource/target state without matching history/dirty/recovery publication, and fix the canonical owner only if the risk is reproducible with realistic production ports.

## Why now / fresh evidence

Fresh post-task-061 review inspected current `src/document/smart-object-controller.js::saveContent()` together with `src/document/psd-smart-object-resource.js` and the focused Smart Object tests.

After all async authority/membership/lock checks pass, Photoshop Save currently performs synchronous publication in this order:

1. `publishEmbeddedSourceRewrite(parentDoc, rewrite)` replaces `parentDoc.psdLinkedLayerBlocks`;
2. the controller iterates final `liveTargets`;
3. for each target it replaces `embeddedDocument` and `previewDataUrl`;
4. Photoshop targets additionally run injected `updateTargetAfterRewrite(...)`;
5. only after the loop does the controller touch the document, push history, mark dirty, invalidate caches, render tabs and queue recovery.

The surrounding `try/catch` reports an exception, but it does not roll back resource/target mutations already performed before the throw.

The canonical production `publishEmbeddedSourceRewrite` is currently a simple assignment. `updateTargetAfterRewrite` updates native asset/baseline metadata and calls fingerprint helpers. Existing tests cover success, stale authority, membership churn, locks and superseded rewrites, but no test injects a failure during this final synchronous publication region.

This is a **risk hypothesis**, not yet a confirmed user-facing bug. The next pass must first prove whether a realistic accepted production input/port can throw after the first destructive write. Current code/tests/CI remain the source of truth if this handoff drifts.

## Scope

In scope:
- `src/document/smart-object-controller.js::saveContent()` final synchronous publication region;
- `src/document/psd-smart-object-resource.js::publishEmbeddedSourceRewrite()` and `updateTargetAfterRewrite()`;
- native fingerprint/update helpers only as needed to understand real throwability;
- focused deterministic tests in `tests/smart-object-controller.test.mjs` and/or `tests/psd-smart-object-resource.test.mjs`;
- minimal Smart Object lifecycle/test-matrix/changelog updates if behavior changes.

Out of scope:
- redesigning PSD binary rewrite preparation;
- changing latest-authorized generation, source identity, live membership or lock semantics already covered by tasks 058–061;
- generic history implementation;
- broad transaction framework refactor without a demonstrated need.

## Inspect first

- `AGENTS.md`;
- `docs/PROJECT.md`;
- this task only;
- `docs/architecture/SMART_OBJECT_LIFECYCLE.md`;
- `src/document/smart-object-controller.js::saveContent()`;
- `src/document/psd-smart-object-resource.js`;
- `src/document/psd-native-metadata-plans.js` fingerprint helpers;
- `tests/smart-object-controller.test.mjs`;
- `tests/psd-smart-object-resource.test.mjs`;
- latest `main` CI.

## Questions to answer before changing production

1. Can canonical `publishEmbeddedSourceRewrite` or `updateTargetAfterRewrite` throw for an input that has already passed rewrite preparation?
2. Can one target-specific metadata update succeed while a later target fails?
3. If a throw is possible, what state has already changed: `psdLinkedLayerBlocks`, embedded docs, previews, native metadata, cache/history/dirty/recovery?
4. Is the right fix prepare-all-before-mutate, a precomputed publication plan, rollback snapshots, or making the final ports explicitly total/non-throwing?
5. Can the safety contract be protected with a deterministic regression without inventing an impossible injected failure?

## Regression plan

Prefer a realistic production-port failure first.

- Add a focused oracle that captures parent linked-resource state, every target preview/content/native metadata, history, dirty/recovery/cache/tab state.
- Trigger the narrowest realistic final-publication failure after at least one would-be mutation.
- Expected fail-safe contract: either **zero persisted publication** or a formally documented all-or-none transaction with deterministic rollback; never resource/target partial state plus an error toast.
- Keep task-058…061 generation, identity, membership and lock regressions green.

If inspection proves the canonical final publication functions are total for every accepted prepared rewrite and a failure cannot occur without violating their input contract, do not add artificial rollback code. Instead codify that non-throwing contract at the narrow owner and add the smallest meaningful guard/test.

## Required verification

- focused Smart Object + PSD Smart Object resource tests;
- `npm run check`;
- generated-artifact parity if source changes;
- `npm run test:browser` if runtime/bundle code changes;
- `git diff --check`;
- exact PR-head CI green;
- guarded squash merge;
- exact merged-main push CI green.

## Done gate

Done only when the final Photoshop Smart Object publication region has an explicit, tested failure model: either a reproducible partial-publication path is fixed so failure is fail-safe/all-or-none, or production-port analysis proves the region non-throwing for accepted inputs and that contract is protected without speculative complexity.

After completion, delete this task only after merge + green main CI and create exactly one next bounded task from fresh review evidence.

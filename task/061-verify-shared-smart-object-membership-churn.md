# 061 — Verify shared Smart Object target membership churn across async Save

## Goal

Prove that shared ZPE/Photoshop Smart Object Save always publishes against the **current live source target set** after async boundaries, rather than accidentally retaining an earlier target array when linked/native instances are added or removed while Save is pending.

## Why now / fresh evidence

Post-merge review after task 060 inspected current `src/document/smart-object-controller.js::saveContent()` and the focused test names.

Production intentionally performs three discoveries for a shared Save:
1. `initialTargets` before the Save generation is claimed;
2. `previewTargets` after preview rendering;
3. final `liveTargets` after Photoshop resource preparation / immediately before publication.

Task 060 made effective-lock authority all-or-none across each current set. That safety property depends on preserving **live membership re-resolution**: a future refactor that caches `initialTargets` could mutate a detached removed instance, omit a newly linked/native instance, or skip the lock authority of a target added while an await is pending.

The focused Smart Object suite currently covers shared propagation, pre-existing/late locks, overlapping generations, same-ID replacement, content-tab staleness and Photoshop rewrite races, but contains no deterministic regression for target membership being added/removed during an in-flight Save.

This is primarily a missing behavioral oracle, not a claim that current production is already wrong. Current code, tests and CI remain the source of truth if this handoff drifts.

## Scope

In scope:
- `tests/smart-object-controller.test.mjs`;
- `src/document/smart-object-controller.js::saveContent()` only if a regression exposes incorrect membership behavior;
- linked ZPE `linkedSourceId` and Photoshop native source target discovery;
- minimal updates to `SMART_OBJECT_LIFECYCLE.md`, test matrix and changelog only if the verified contract needs clarification;
- canonical generated artifacts only if production source changes.

Out of scope:
- changing linked/native source identity semantics;
- changing effective-lock semantics established by task 060;
- partial shared-source publication;
- Convert/Open/Link/Unlink redesign;
- PSD binary/resource codec internals.

## Behavioral contracts to prove

- Target membership is re-resolved after every reorderable Save await before downstream work/publication.
- A target removed from the parent source set while Save is pending is not mutated through a stale earlier array.
- A writable target added to the same linked/native source while Save is pending participates according to the final live source set.
- A newly added effectively locked target must cause the existing task-060 all-or-none authority to fail closed.
- History label/count, cache invalidation and native target-update calls reflect the actual published live set, not a stale initial count.
- Latest-authorized generation and exact/source identity checks still run before stale/membership feedback or publication.

## Inspect first

- `AGENTS.md`;
- `docs/PROJECT.md`;
- this task only;
- `docs/architecture/SMART_OBJECT_LIFECYCLE.md`;
- `docs/testing/TEST_MATRIX.md`;
- `src/document/smart-object-controller.js::saveContent()`;
- `tests/smart-object-controller.test.mjs`;
- `tests/linked-smart-objects.test.mjs`;
- latest `main` CI.

## Regression plan

Use deferred Promises, never sleeps.

1. ZPE linked source: remove a sibling while preview is pending; after completion prove the detached object is byte/state unchanged and only the remaining live target is published.
2. ZPE linked source: add a new writable sibling while preview is pending; prove final publication includes it. Add a locked variant only if it adds independent evidence beyond task 060's late-lock regression.
3. Photoshop native source: change matching native membership while resource rewrite is pending; prove `updateTargetAfterRewrite`, cache invalidation and history operate only on final authorized targets.
4. Keep all task-060 lock, overlap-generation, unshared replacement and existing Photoshop regressions green.

If inspection shows one of these membership changes is intentionally forbidden by another canonical owner, document that contract and test the real allowed transition instead of inventing behavior.

## Required verification

- focused `tests/smart-object-controller.test.mjs`;
- relevant linked/Photoshop regressions;
- full `npm run check`;
- generated-artifact parity if source changes;
- `npm run test:browser` when source/bundle changes;
- `git diff --check`;
- exact PR-head CI green;
- guarded squash merge;
- exact merged-main push CI green.

## Done gate

Done when async shared-source membership behavior is protected by deterministic regressions that would fail if Save reused stale target arrays, any production defect found by those regressions is fixed at the canonical owner, docs match the verified contract, and PR + merged-main CI are green.

After completion, delete this task only after merge + green main CI and create exactly one next bounded task from fresh review evidence.

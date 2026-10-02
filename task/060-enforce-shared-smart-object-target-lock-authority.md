# 060 — Enforce all-or-none lock authority across shared Smart Object Save targets

## Goal

Prevent a shared Smart Object content Save from indirectly mutating a linked/native sibling instance that is effectively locked (including through a locked ancestor group) while another unlocked representative is used to authorize the Save.

## Why now / fresh evidence

Post-merge review after task 059 found a separate target-set authority gap in `src/document/smart-object-controller.js::saveContent()`:

1. Save resolves one authoritative `publishLayer` and now correctly revalidates its live effective lock after every reorderable await;
2. it then resolves `liveTargets = targetsFor(publishParent.doc, publishLayer)`;
3. for ZPE linked sources and Photoshop native sources, `liveTargets` can contain multiple layer instances;
4. the publication loop mutates every target's embedded document, preview and (where applicable) dimensions/native metadata;
5. no `isLayerLocked(publishParent.doc, target)` check is performed for the other targets before that loop;
6. canonical `src/core/state.js::isLayerLocked()` treats either the layer's own `locked` flag or a locked ancestor group as effective lock.

Therefore an unlocked representative can currently authorize a shared-source Save that updates another instance whose own editing policy says it is locked. Current code/main, tests and CI remain the source of truth if this handoff drifts.

## Scope

In scope:
- `src/document/smart-object-controller.js::saveContent()`;
- shared ZPE `linkedSourceId` and Photoshop source target-set lock semantics;
- focused deterministic regressions in `tests/smart-object-controller.test.mjs`;
- minimal updates to `docs/architecture/SMART_OBJECT_LIFECYCLE.md`, AI routing/test docs and changelog if behavior changes;
- canonical generated browser artifacts after source change.

Out of scope:
- changing `isLayerLocked` / group-lock semantics;
- partial per-target publication;
- unlink/link identity redesign;
- Convert/Open lifecycle;
- PSD binary codec/resource-rewrite internals.

## Behavioral contract to establish

Treat a shared-source Save as one atomic publication across its live target set.

- After resolving the final authoritative `liveTargets`, every target that will be mutated must be writable under the canonical effective-lock policy.
- If any live target is effectively locked, fail closed **before** Photoshop resource publication, preview/content/native metadata mutation, history, dirty/recovery/cache/tab or success feedback.
- Do not update only the unlocked subset: that would silently split instances that are supposed to share one source.
- For a target set that was already partly locked before Save starts, prefer failing during preflight/preparation if this can be done without changing latest-authorized generation ordering.
- Revalidate the complete target set again after reorderable awaits; a target or its ancestor group may become locked while preview/native preparation is pending.
- Superseded-generation continuations remain silent and must be checked before lock feedback.
- Preserve exact-object authority for ordinary unshared parents, `linkedSourceId` authority for ZPE linked instances, and Photoshop native source identity from tasks 058/059.

## Inspect first

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/SMART_OBJECT_LIFECYCLE.md`;
- `docs/testing/TEST_MATRIX.md`;
- `src/core/state.js::isLayerLocked()` and group-lock helpers;
- `src/document/smart-object-controller.js`;
- `tests/smart-object-controller.test.mjs`;
- `tests/linked-smart-objects.test.mjs`;
- current `.github/workflows/ci.yml` and latest main CI.

## Planned approach

Keep policy local to the Save transaction rather than changing global lock semantics.

A small helper may validate `targets.every(target => !isLayerLocked(owner.doc, target))` (or return the offending target) and publish one clear warning. Run it only after generation/source authority is established. Where there is another await after a target-set check, repeat the check before first destructive publication.

Do not cache a boolean lock snapshot and do not partially mutate a shared target set.

## Regression tests

Add deterministic cases with injected/stateful lock policy or real group state:

1. ZPE linked source: representative is unlocked, second linked instance is effectively locked before Save; Save returns `false` and neither instance nor history/dirty/recovery/cache/tab state changes.
2. ZPE linked source: Save waits at preview, a sibling instance becomes locked, preview resolves; late continuation cancels all-or-none with zero publication.
3. Photoshop shared source if multiple native instances are supported by the existing fixture/harness: lock a non-representative target while native rewrite preparation is pending and prove prepared resources are not published.
4. Existing ordinary-unshared, linked, Photoshop, overlap-generation, same-ID replacement and task-059 lock-race success/failure regressions remain green.

If inspection proves Photoshop target multiplicity has a materially different domain contract, document that fact and keep the implementation/test scope aligned with the actual source-owner semantics rather than inventing parity.

## Required verification

- focused Smart Object controller tests;
- relevant linked/Photoshop regressions;
- `npm run check`;
- canonical generated-artifact parity;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI green;
- guarded squash merge;
- exact merged-main push CI green.

## Done gate

Done only when every Smart Object instance that a shared Save will mutate is covered by an explicit effective-lock authority rule, locked siblings cannot be modified indirectly, publication remains all-or-none, source identity/generation semantics stay intact, docs match the final contract, generated artifacts are canonical, and PR + merged-main CI are green.

After completion, delete this task and create exactly one new bounded task from fresh review evidence.

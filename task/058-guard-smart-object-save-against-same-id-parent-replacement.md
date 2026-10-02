# 058 — Guard Smart Object Save against same-ID parent replacement

## Goal

Prevent a pending unshared Smart Object content Save from publishing into a different parent Smart Object object that replaces the original layer with the same external `id` while asynchronous preparation is in flight.

## Why now / fresh evidence

Post-merge review of `src/document/smart-object-controller.js::saveContent()` after task 057 found a separate exact-owner gap:

1. Save captures the original `parentSession` and `parentLayer` before the first await;
2. after preview/rewrite awaits it re-resolves the parent layer through `parentLayerFor(...)`;
3. for an ordinary unshared/non-Photoshop Smart Object, that lookup is by `link.layerId`;
4. the stale check verifies parent-session identity and shared-source identities, but when both `linkedSourceId` and `photoshopId` are null it does not require the re-resolved layer object to still be the original `parentLayer`;
5. therefore a replacement Smart Object with the same `id` can inherit a stale Save continuation and be overwritten.

This conflicts with the documented exact parent-layer authority model. Current code/main and CI remain the source of truth if this handoff drifts.

## Scope

In scope:
- `src/document/smart-object-controller.js::saveContent()`;
- focused `tests/smart-object-controller.test.mjs` regression coverage;
- minimal AI-facing docs/changelog updates required to keep the authority contract discoverable;
- canonical generated browser artifacts after source change.

Out of scope:
- changing linked Smart Object source propagation;
- changing Photoshop Smart Object UUID/source semantics;
- Convert authority;
- PSD/PSB codec or resource-rewrite internals;
- broad Smart Object controller refactoring.

## Behavioral contracts to preserve

- For an ordinary unshared Smart Object, post-await publication authority must remain bound to the exact original parent layer object, not merely a reusable layer ID.
- Replacing that layer with a different object carrying the same `id` must cancel the stale Save before any mutation/history/dirty/recovery/cache/success publication.
- Existing linked-source behavior must continue to resolve the current canonical linked instances by `linkedSourceId`; do not incorrectly require one original instance object to survive when the shared-source contract intentionally spans instances.
- Existing Photoshop Smart Object behavior must continue to use native source identity/UUID and its narrow rewrite ports.
- Latest-authorized Save generation remains independent from exact editor-state authority.
- Ordinary editor-state staleness keeps explicit cancellation feedback; superseded generation continuations remain silent.
- No safety limits or project sanitization may be weakened.

## Inspect first

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/testing/TEST_MATRIX.md`;
- `src/document/smart-object-controller.js`;
- `tests/smart-object-controller.test.mjs`;
- current `.github/workflows/ci.yml` and latest main CI.

## Planned fix

Keep the change local to Save authority. For the unshared/non-Photoshop branch, require the live/publish layer resolved after asynchronous boundaries to be the same object captured as `parentLayer`. Preserve the existing linked/Photoshop source-identity paths rather than replacing them with blanket object identity.

Prefer a small helper/predicate only if it makes the two post-await authority checks harder to drift apart; do not introduce a generic abstraction for one use.

## Regression tests

Add a deterministic deferred regression:

1. create an ordinary unshared parent Smart Object and open/save its child contents;
2. start Save A and stop at deferred preview rendering;
3. replace the parent document slot with a different Smart Object object using the same layer `id`;
4. resolve preview;
5. assert Save returns `false`, replacement preview/embedded content remain untouched, and there is zero history, parent dirty mutation, recovery, cache invalidation, tab/success publication;
6. assert cancellation feedback identifies parent staleness.

Keep normal Save success, linked-source propagation, Photoshop rewrite and overlap-generation regressions green.

## Required verification

- focused Smart Object controller tests;
- `npm run check`;
- canonical generated-artifact parity;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI green;
- guarded squash merge;
- exact merged-main push CI green.

## Done gate

Done only when same-ID parent replacement cannot inherit an unshared Smart Object Save continuation, the regression proves zero partial publication, linked/Photoshop semantics remain green, docs match the final authority rule, generated artifacts are canonical, and PR + merged-main CI are green.

After completion, delete this task and create exactly one new bounded task from fresh review evidence.

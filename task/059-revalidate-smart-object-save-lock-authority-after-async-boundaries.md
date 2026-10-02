# 059 — Revalidate Smart Object Save lock authority after async boundaries

## Goal

Prevent a pending Smart Object content Save from publishing after its parent Smart Object becomes effectively locked while preview rendering or Photoshop native-resource preparation is in flight.

## Why now / fresh evidence

Post-merge review after task 058 found a separate authority gap in `src/document/smart-object-controller.js::saveContent()`:

1. Save rejects a locked parent during synchronous preflight;
2. it then crosses one or two reorderable awaits: preview rendering and, for Photoshop Smart Objects, embedded-resource rewrite;
3. post-await checks revalidate command generation, content/session ownership and parent/source identity;
4. they do **not** re-run `isLayerLocked(parentSession.doc, live/publishLayer)`;
5. therefore a layer or ancestor group can become locked while Save is pending, yet the late continuation may still mutate the parent Smart Object, history, dirty/recovery/cache state and native Photoshop resources.

This violates the project's general async-owner rule that mutable publication policy such as effective lock must be revalidated before persisted writes. Current code/main, tests and CI remain the source of truth if this handoff drifts.

## Scope

In scope:
- `src/document/smart-object-controller.js::saveContent()`;
- focused `tests/smart-object-controller.test.mjs` regressions;
- minimal AI-facing docs/changelog updates;
- canonical generated browser artifacts after source change.

Out of scope:
- changing lock semantics themselves;
- changing linked-source membership semantics;
- changing Photoshop codec/resource-rewrite internals;
- Convert authority;
- broad Smart Object refactoring.

## Behavioral contracts to preserve

- Initial effective-lock preflight remains unchanged.
- After every reorderable Save await, publication must not proceed if the authoritative parent Smart Object is now effectively locked.
- A lock acquired while preview rendering is pending must cancel before Photoshop rewrite or any persisted mutation.
- For Photoshop Save, a lock acquired while native rewrite preparation is pending must cancel before `publishEmbeddedSourceRewrite`, target metadata update, preview/content mutation, history, dirty/recovery/cache/tab or success feedback.
- Lock cancellation is ordinary editor-state staleness and should remain observable through status/toast policy chosen by the existing controller conventions; superseded-generation continuations remain silent.
- Latest-authorized generation and source-aware parent identity from tasks 057/058 stay independent and intact.
- Do not weaken safety limits, project sanitization or shared-source identity checks.

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

Keep lock revalidation local to Save authority. Reuse the already re-resolved authoritative parent layer after async boundaries and call the canonical injected `isLayerLocked` policy before expensive downstream work and again immediately before first publication after the final await.

Avoid a generic retry or lock snapshot. Lock is live publication policy: if it changed to locked, the stale continuation must stop.

## Regression tests

Add deterministic deferred cases for:

1. ordinary unshared Save: start Save, block at preview, make the parent effectively locked, resolve preview, assert Save returns `false` with zero parent/content/history/dirty/recovery/cache/tab/success publication;
2. Photoshop Save: allow preview to complete, block at native rewrite, make the parent effectively locked, resolve rewrite, assert prepared native resources are **not** published and all persisted/UI success side effects remain absent;
3. existing unlocked normal/linked/Photoshop Save success and overlap-generation regressions remain green.

Use an injected `isLayerLocked` stateful oracle rather than mutating unrelated model internals unless a real group-lock path is simpler and equally deterministic.

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

Done only when a post-start effective lock can no longer be bypassed by pending Smart Object Save, both preview-only and Photoshop-rewrite races are regression-tested, existing source-aware ownership semantics remain green, docs match the final contract, generated artifacts are canonical, and PR + merged-main CI are green.

After completion, delete this task and create exactly one new bounded task from fresh review evidence.

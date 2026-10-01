# 057 — Keep Smart Object Save generation behind all synchronous preparation

## Goal

Make Smart Object content Save claim its latest-authorized generation only after every synchronous preparation step that can throw has succeeded, and handle preparation failures through the existing Save error UX without revoking older authorized work.

## Fresh evidence from pass 056

Post-fix review of `src/document/smart-object-controller.js::saveContent()` found a separate ordering seam:

1. pending/edit, parent existence and effective-lock checks complete;
2. `saveContentGeneration` is incremented;
3. only then the controller resolves shared/native targets and calls `restoreDocument(sourceSnapshot)`;
4. those preparation calls are currently outside the main Save `try/catch`.

This means a synchronous preparation exception can both reject the async command and consume Save authority before preview rendering begins. Current code/main and CI remain the source of truth if this handoff drifts.

## Scope

In scope:
- `src/document/smart-object-controller.js::saveContent()`;
- focused `tests/smart-object-controller.test.mjs` regressions;
- minimal AI-facing docs/changelog updates;
- canonical generated browser artifacts after source change.

Out of scope:
- Convert (handled in pass 056);
- Photoshop resource rewrite internals;
- PSD/PSB codec changes;
- generic menu error wrappers;
- broad Smart Object refactor.

## Required behavior

- A synchronous Save preparation failure must resolve through controller failure handling instead of leaking a rejected Promise.
- Failed preparation publishes no parent/child mutation, history, dirty/recovery/cache state or success feedback.
- Failed preparation must not claim/revoke `saveContentGeneration`; an older authorized Save may still publish if its exact content/parent authority remains valid.
- Save generation and exact editor-state authority remain independent.
- Superseded post-await success/failure continuations remain silent.
- Do not weaken canvas/document sanitization or Photoshop safety limits.

## Regression tests

Add deterministic tests for:
1. a real or narrowly injected synchronous Save preparation failure that does not reject and publishes normal failure diagnostics with zero mutation/history;
2. older Save A pending in preview, newer Save B failing during synchronous preparation, then A still publishing exactly once when exact owner state remains valid;
3. existing overlapping Save completion/failure/native-rewrite tests remain green.

Prefer the real `restoreDocument`/target-preparation path; add an injection seam only if the canonical failure cannot be triggered cleanly without corrupting model invariants.

## Inspect first

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `src/document/smart-object-controller.js`;
- `src/core/state.js` snapshot/restore helpers;
- `tests/smart-object-controller.test.mjs`;
- current `.github/workflows/ci.yml` and latest main CI.

## Required verification

- focused Smart Object controller tests;
- `npm run check`;
- generated artifact cleanliness after canonical build;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI green;
- squash merge;
- exact merged-main push CI green.

## Done gate

Done only when Save preparation failure is controller-contained, failed preparation cannot consume command generation, older authorized Save preservation is regression-tested, docs describe the ordering, generated artifacts are canonical, and PR + merged-main CI are green.

After completion, delete this task and create exactly one new bounded task from fresh evidence.

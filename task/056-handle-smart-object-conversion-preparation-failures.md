# 056 — Handle Smart Object conversion preparation failures without unhandled rejections

## Goal

Make synchronous/pre-await preparation failures in `convertSelected()` observable through the existing Smart Object error UX instead of escaping as rejected Promises, while preserving the newly established latest-authorized Convert generation and exact editor-state ownership rules.

## Why now / fresh evidence

The completed overlap pass protects continuations **after** `await renderPreview(embedded)`, but fresh post-merge review found an earlier failure gap:

1. `src/document/smart-object-controller.js::convertSelected()` performs target/type/effective-lock/nesting preflight;
2. it calls `sourceBounds(source)` **before** entering its current `try/catch`;
3. `sourceBounds()` calls `checkedCanvasSize(...)`;
4. `src/core/state.js::checkedCanvasSize()` throws when the bounded Smart Object content area exceeds the 48 MP safety budget;
5. the two current UI call sites in `src/main.js` invoke `convertSelectedToSmartObject()` without `await` or `.catch()`.

Because `convertSelected()` is async, a preparation exception before its `try` becomes a rejected Promise. The normal controller error status/toast/log path is skipped, and a fire-and-forget menu invocation can surface as an unhandled rejection instead of actionable user feedback.

This is separate from the overlap bug fixed in PR #90. Current code/main and logs/tests remain the source of truth if this handoff drifts.

## Scope

In scope:

- `src/document/smart-object-controller.js::convertSelected()`;
- focused `tests/smart-object-controller.test.mjs` regressions;
- the smallest AI-facing docs/change log updates needed to preserve the contract;
- canonical generated browser artifacts if source changes.

Out of scope:

- Smart Object Save;
- PSD/PSB resource rewrite;
- generic menu error wrappers;
- changing canvas safety limits;
- broad refactoring of `src/main.js`.

## Inspect first

Read only the smallest relevant route:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `src/document/smart-object-controller.js`;
- `src/core/state.js::checkedCanvasSize()`;
- the two `convertSelectedToSmartObject` call sites in `src/main.js`;
- `tests/smart-object-controller.test.mjs`;
- current `.github/workflows/ci.yml` and latest main CI.

## Required behavior / invariants

### 1. Preparation failures are handled by the controller

Any exception raised while preparing an otherwise accepted conversion before preview rendering must not escape as an unhandled rejected Promise.

At minimum cover `sourceBounds()` / canvas-budget failure. Keep the existing user-facing conversion failure semantics consistent unless a more specific safe message materially improves them:

- no layer mutation;
- no history commit;
- error remains observable in diagnostics;
- user gets status/toast feedback;
- command resolves through the controller's normal failure path.

Do not weaken the 48 MP / dimension safety checks.

### 2. Failed preparation must not claim latest-authorized Convert generation

The Convert generation must still be claimed only after all synchronous preparation that can reject has succeeded and immediately before the reorderable preview phase.

A newer conversion attempt that fails during preparation must not supersede an already-authorized older conversion.

### 3. Preserve dual authority after preview

Do not remove or merge:

- Convert command generation;
- exact document object;
- active session ID;
- exact source object at the captured slot;
- unchanged source snapshot/state.

Superseded post-preview continuations stay silent. Ordinary exact-state staleness stays explicitly cancelled.

### 4. Do not move responsibility to fire-and-forget callers

Prefer making `convertSelected()` a self-contained safe command rather than adding ad hoc `.catch()` handlers to the two current menu call sites. Future callers should not need to remember a hidden rejection contract.

## Regression tests

Use deterministic tests; no sleeps/timers.

Add focused cases for at least:

1. a source whose computed Smart Object bounds exceed the canvas pixel budget:
   - `convertSelected()` does not reject;
   - source layer remains unchanged;
   - no commit is recorded;
   - one observable error/status/toast path is produced.

2. older conversion A reaches pending preview and owns the current generation; selection then targets a different oversized layer and newer conversion B fails during preparation:
   - B does not claim/revoke Convert generation;
   - A may still complete if its exact source/document/session state remains valid;
   - exactly one conversion commit is published.

3. existing post-preview superseded success/failure tests remain green.

4. existing ordinary tab/source stale cancellation and normal identity/commit behavior remain green.

Avoid adding injection ports unless the real safety-limit path cannot be tested cleanly with existing model factories.

## Documentation update

Review and update only docs that help a fresh AI locate this contract:

- `docs/architecture/BOUNDARIES.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`;
- `AGENTS.md` / `docs/PROJECT.md` only if routing would otherwise be incomplete.

Document the distinction:

- rejected synchronous/preparation attempt = handled failure, **no generation claim**;
- authorized async attempt = owns a generation;
- superseded authorized continuation = silent;
- current authorized continuation with exact-state staleness = explicit cancellation.

## Generated artifact discipline

If `src/document/smart-object-controller.js` changes:

- run the canonical `npm run build`;
- commit resulting `src/app.bundle.js`, `index.html`, and `version.json`;
- never hand-edit generated bundle logic as source of truth.

## Required verification

Minimum gate:

- focused Smart Object controller tests;
- `npm run check`;
- `git diff --exit-code -- src/app.bundle.js index.html version.json` after canonical build;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI green;
- squash merge;
- exact merged-main push CI green.

If CI fails: inspect failed step/logs, classify root cause, fix it, and rerun. Do not weaken checks.

## Done gate

Done only when:

- preparation/canvas-limit failure is handled without rejected-Promise leakage;
- no partial layer/history state publishes on that path;
- failed newer preparation cannot revoke an older authorized conversion;
- existing latest-authorized and exact-state guards remain independent;
- deterministic regressions cover the error and overlap-preservation cases;
- AI-facing docs capture the preflight/preparation/generation ordering;
- generated artifacts are canonical;
- PR and merged-main CI are green.

After completion, delete this task and create exactly one new bounded task from fresh evidence.

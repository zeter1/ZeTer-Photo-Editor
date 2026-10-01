# 054 — Make overlapping Smart Object content saves latest-authorized-wins

## Why this is next

Post-merge review of the nearest async save owner found the same command-overlap class in `src/document/smart-object-controller.js::saveContent()`.

The controller already has strong **editor-state** guards:

- exact originating content-session ID/object;
- an immutable `sourceSnapshot` checked again with `snapshotDocument(session.doc)`;
- exact parent-session object;
- parent Smart Object layer/source identity;
- revalidation after `renderPreview()` and, for Photoshop content, after `rewriteEmbeddedSource()`.

Those guards do not distinguish two save commands that are both authorized against the **same unchanged child snapshot**.

Concrete race:

1. A starts Ctrl+S, passes preflight and waits in `renderPreview(A)` or Photoshop resource preparation.
2. B starts later while the child/session/snapshot are still identical and also passes every current guard.
3. B may publish first.
4. A can still pass `contentStillCurrent()` because the child document is unchanged and then publish again.

At minimum this can create duplicate parent history entries/recovery writes/cache invalidation/success UI for one unchanged save intent. In the Photoshop path an older prepared native-resource rewrite can also reach `publishEmbeddedSourceRewrite()` after a newer save unless command authority is checked after the rewrite await.

This is a **command-intent race**, separate from the existing child/parent state guards. Follow the same proven dual-authority rule used by PSD import and native `.zpe` open: local generation selects the newest authorized command; exact state checks prove the command still belongs to the same editor state.

## Scope

Primary owner:

- `src/document/smart-object-controller.js`

Focused tests:

- `tests/smart-object-controller.test.mjs`

Review/update only the AI-facing docs that actually route this contract:

- `AGENTS.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- any existing narrow Smart Object spec discovered during INSPECT
- `CHANGELOG.md` for the code change

Generated browser artifact:

- `src/app.bundle.js` only through the canonical build graph.

## Required behavior

1. Add controller-local monotonically increasing authority for **Smart Object content save commands**. Do not reuse the generations owned by native project open, PSD import, clipboard, or other controllers.
2. Claim a new save generation only after the command has passed the initial no-link / pending-edit / parent-exists / parent-lock preflight. A rejected or blocked newer save must not cancel an already-authorized older one.
3. Preserve `contentStillCurrent()` and the existing parent/layer/source identity checks as independent state authority. Do not replace them with generation alone.
4. Revalidate generation immediately after every reorderable await:
   - `renderPreview()`;
   - `rewriteEmbeddedSource()` when Photoshop-native rewrite is used;
   - any new async boundary introduced by the refactor.
5. A superseded continuation must exit silently before publication. It must not:
   - publish embedded Photoshop resource blocks;
   - mutate Smart Object targets/previews/dimensions;
   - touch the parent document;
   - push parent history;
   - change dirty state;
   - invalidate preview cache;
   - render tabs;
   - queue recovery;
   - overwrite the newer command's final status/toast;
   - log a stale error/warning caused only by the superseded command.
6. Keep ordinary exact-state stale outcomes distinct: existing tab/content/parent changes should retain their current user-facing cancellation semantics unless code evidence proves that behavior is wrong.
7. Keep the final mutation/publication region await-free. If a future await is added there, both generation and exact state authority must be re-proved before the first write.
8. Do not generalize these controller-local generations into a shared scheduler in this pass.

## Regression tests

Use deterministic deferred Promises; no timers.

1. **A old / B new; A preview resolves after B claims authority**
   - A returns without parent mutation/history/recovery/UI overwrite;
   - B later publishes exactly once.
2. **B publishes first; A preview resolves later**
   - final parent target/history/dirty/recovery/status/toast stay exactly as after B.
3. **Superseded A preview rejects after B claims authority**
   - A produces no error log/status/toast and cannot affect B.
4. **B never receives authority**
   - block B at the initial pending-edit or parent-lock/preflight guard;
   - A remains authorized and can publish normally.
5. **Photoshop rewrite overlap**
   - let A enter a deferred `rewriteEmbeddedSource()`;
   - start/complete B as the newer save;
   - resolving A later must not call `publishEmbeddedSourceRewrite()`, update targets, push history, or overwrite B's feedback.
6. Existing tests for content-tab change during preview and after Photoshop rewrite remain green and keep their exact-state cancellation behavior.
7. Successful single save still publishes one coherent transaction with the existing linked-source propagation semantics.

## Inspect first

Before changing code:

- read the whole `saveContent()` path and its injected Photoshop ports;
- inspect `tests/smart-object-controller.test.mjs` harness and all save tests;
- inspect `src/document/psd-smart-object-resource.js` only far enough to understand prepare-vs-publish boundaries;
- confirm all callers of `saveContent` / `saveSmartObjectContent`, including `src/document/project-controller.js` save routing;
- inspect current `.github/workflows/ci.yml` before writes.

## Verification

Run/observe:

1. focused `tests/smart-object-controller.test.mjs`;
2. `npm run check`;
3. generated-artifact parity;
4. `npm run test:browser`;
5. `git diff --check`;
6. exact PR-head CI;
7. guarded merge only after green PR head;
8. exact merged-main push CI before deleting this task.

If browser smoke alone times out before a DevTools endpoint while the identical tree already passed the same smoke, classify from logs first and use one exact-SHA failed-job rerun before changing code or weakening the gate.

## Done gate / handoff

After exact merged-main CI is green:

- delete this completed task;
- review one adjacent async persistence owner for the next concrete race/correctness issue;
- create exactly one bounded next task backed by code/test evidence.

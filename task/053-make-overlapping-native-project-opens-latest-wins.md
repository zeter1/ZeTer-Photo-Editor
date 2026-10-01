# 053 — Make overlapping native .zpe opens latest-authorized-wins

## Why this is next

A focused review after PSD/PSB import authority work found the same *command overlap* class in the separate native-project owner `src/document/project-controller.js`.

`openProject(file)` already captures a strong exact editor-state ticket after pending/discard preflight:

- exact document object;
- active session ID;
- exact current history entry;
- monotonic document-change serial.

That correctly rejects a prepared result after the editor state changes. It does **not** distinguish two `.zpe` open commands that were both authorized against the same ticket.

Current race:

1. A starts, passes preflight, waits in `readFileAsText(A)`.
2. B starts later against the same document/session/history/change serial and also passes preflight.
3. If A finishes first, A still owns a structurally valid ticket and can publish even though B is the newer user intent; B then becomes stale.
4. If B finishes first, B publishes and A later fails the exact-owner check, but A can still overwrite B's success UI with the stale warning/toast.

The invariant should be the same dual-authority model now documented for PSD imports: **command generation answers which open intent is newest; exact owner ticket answers whether the editor state that authorized it is still current.**

## Scope

Primary owner:

- `src/document/project-controller.js`

Focused tests:

- `tests/project-controller.test.mjs`

AI/documentation routing if the contract changes:

- `AGENTS.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md`

Generated browser artifact:

- `src/app.bundle.js` only through `npm run build` / canonical CI evidence; never hand-invent generated content.

## Required behavior

1. Add controller-local monotonically changing authority (generation/token) for native `.zpe` open commands.
2. Claim the new generation only after the new command passes the initial pending-edit + replacement/discard preflight. A rejected/blocked newer attempt must **not** cancel an already-authorized older open.
3. Preserve the existing exact document/session/history/change-serial owner ticket unchanged as an independent guard.
4. After every reorderable async boundary in `openProject` (currently file read), an older generation must exit silently before parse/sanitize/publication where practical.
5. A superseded continuation must not:
   - reset history;
   - set the document;
   - mark clean/dirty state;
   - queue recovery;
   - fit the viewport;
   - publish success/stale/error status or toast;
   - alert the user;
   - emit a stale error log.
6. Keep the synchronous publication region await-free. If a future await is inserted after final authority validation, revalidate both generation and exact owner before the first write.
7. Do not generalize PSD and native-project generations into a shared scheduler unless a concrete third owner proves that abstraction is cohesive; local ownership is easier for AI to reason about and safer to review.

## Regression tests

Use deterministic deferred Promises, not timers.

1. **A old / B new; A read resolves first after B starts**
   - A publishes nothing;
   - B later resolves and publishes exactly once;
   - final document/name belongs to B.
2. **B publishes first; A resolves later**
   - document/history/dirty/recovery/fit remain exactly as after B;
   - A does not replace B's final success status/toast with stale UI.
3. **Superseded A throws after B has claimed authority**
   - no alert/error status/error toast/error log from A;
   - B remains authoritative.
4. **B never receives authority**
   - make B fail pending-edit or replacement/discard preflight;
   - A must still be allowed to finish and publish.
5. Existing exact-owner stale tests for document/session/history/change serial remain green and keep their current user-facing retry warning.
6. Existing successful open ordering remains one coherent transaction:
   `replaceHistory → setDocument → markDirty(false) → queueRecovery → fitToView → success UI`.

## Verification

Run/observe:

1. focused `tests/project-controller.test.mjs`;
2. `npm run check`;
3. generated-artifact parity;
4. `npm run test:browser`;
5. `git diff --check`;
6. exact PR-head CI;
7. guarded merge only after green PR head;
8. exact merged-main push CI before deleting this task.

## Completion / handoff

After exact merged-main CI is green:

- delete this completed task;
- review the nearest async document-open/save owner for one concrete next bug/refactor;
- create exactly one bounded next task with code evidence, not a generic backlog item.

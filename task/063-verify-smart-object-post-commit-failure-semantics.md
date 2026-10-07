# 063 — Verify truthful post-commit failure semantics for Smart Object Save

- **Priority:** P2 — reliability / truthful feedback / recovery.
- **Status:** готова к работе.
- **Evidence:** свежий post-task-062 review на `main@9820aa30fded07049bff4c03afd7a71b980215ea` показал, что `saveContent()` держит в одном широком `try/catch` как destructive publication + history/dirty publication, так и последующие cache/tab/recovery/status side effects. Production `queueRecovery({ immediate:true })` до Promise-chain синхронно вызывает `syncCurrentSession()`, собирает dirty sessions и делает `snapshotProject()`; `renderDocumentTabs()` синхронно перестраивает DOM. Если любой поддерживаемый post-commit port реально может бросить, catch вернёт `false` и покажет «Не удалось обновить смарт-объект» уже после фактического commit.
- **Source SHA:** `9820aa30fded07049bff4c03afd7a71b980215ea` (task 062 merged via PR #98; exact main push CI run `37660607449` / #491 green).
- **Next action:** воспроизвести или опровергнуть realistic synchronous throw **после** in-memory Smart Object commit boundary; менять production только при подтверждённом риске.

## Goal

Determine whether a synchronous failure in the **post-commit side-effect region** of Smart Object Save can make the command report failure after parent/resource/target state, history and dirty state have already been committed, and make success/failure reporting truthful without hiding real transaction failures.

## Why now / fresh evidence

Task 062 proved the narrow Photoshop resource/target publication helpers are synchronous and non-throwing for accepted canonical mutable state, so speculative rollback there was intentionally avoided.

Fresh review of the next region in `src/document/smart-object-controller.js::saveContent()` shows a different boundary:

1. native resource + target content/preview metadata are published;
2. parent document is touched and a history snapshot is pushed;
3. parent/child dirty state, active document and Smart Object link are updated;
4. old preview caches are invalidated;
5. document tabs are rendered;
6. `queueRecovery({ immediate:true })` is called;
7. success status/toast is published;
8. the same outer `catch` still converts any synchronous throw into `return false` + error status/toast.

Production ports inspected on the merged main:
- `invalidateImageCache()` only deletes/clears Maps;
- `renderDocumentTabs()` performs synchronous DOM creation/replacement;
- `queueRecovery({ immediate:true })` synchronously runs session sync + `snapshotDocument()` for dirty sessions before storage work is moved into a caught Promise chain;
- IndexedDB/storage rejection itself is already caught inside recovery and converted to a warning.

This is a **bounded risk hypothesis**, not a confirmed bug. The next pass must identify the actual in-memory commit point and test only realistic supported production state. Do not manufacture a failure with exotic `Proxy`/frozen objects merely to justify refactoring.

## Scope

In scope:
- `src/document/smart-object-controller.js::saveContent()` from history/dirty publication through cache/tab/recovery/status publication;
- production implementations of `invalidateImageCache`, `renderDocumentTabs`, `queueRecovery`, `setStatus` and `toast` only as needed to establish realistic throwability;
- `src/workspace/recovery-controller.js` immediate queue path and canonical snapshot behavior;
- focused Smart Object/recovery/session tests;
- minimal lifecycle/test documentation if the failure model changes.

Out of scope:
- reopening task 062 Photoshop resource publication semantics;
- broad transaction framework or generic UI exception framework;
- changing IndexedDB persistence format;
- swallowing arbitrary errors merely to keep the UI green.

## Questions to answer before changing production

1. What is the precise point after which Smart Object Save is already committed from the user's document/history perspective?
2. Can any canonical production post-commit port synchronously throw under supported state, especially immediate recovery snapshot preparation?
3. If a late throw occurs, which of parent state, child session, history, dirty state, active document, recovery and UI already reflect success?
4. Should a confirmed late failure be isolated as a warning/non-critical side effect, moved before commit, or handled by a narrower owner-specific guard?
5. How can tests prove truthful return/status behavior without weakening diagnostics or suppressing genuine publication failures?

## Regression plan

- Prefer a failure that comes from a realistic production contract rather than a synthetic arbitrary callback throw.
- Capture command return value plus parent/child document state, history, dirty flags, active document/link, recovery calls, statuses and toasts.
- If the operation is already committed, a non-critical post-commit failure must not be reported as if the document update was rolled back.
- If the failure is transaction-critical and occurs before the commit point, existing fail-safe `false` + error behavior must remain.
- Keep task-058…062 Smart Object generation/identity/membership/lock/publication regressions green.

If inspection proves every supported post-commit production port is already synchronous-total or internally failure-contained, do not add broad catches. Document/protect that contract with the smallest meaningful regression instead.

## Required verification

- focused Smart Object + relevant recovery/session tests;
- `npm run check`;
- generated-artifact parity if runtime source changes;
- `npm run test:browser` if runtime/bundle code changes;
- `git diff --check`;
- exact PR-head CI green for production/test changes;
- guarded squash merge;
- exact merged-main push CI green.

## Done gate

Done only when the post-commit Smart Object Save region has an explicit tested failure model: either a realistic late synchronous failure is handled so user-visible success/failure is truthful, or production-port analysis proves supported post-commit ports cannot create that false-failure state and the contract is protected without speculative complexity.

After completion, delete this task only after merge + green main CI and create exactly one next bounded task from fresh review evidence.

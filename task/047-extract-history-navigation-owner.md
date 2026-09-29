# 047 — Extract history navigation owner

## Goal
Вынести runtime-транзакции **Undo / Redo / jump-to-history** из `src/main.js` в узкий canonical owner, сохранив текущую HistoryStack/session/document/transient-state семантику и не смешивая это с рендерингом Properties, Help/About или layer/context menus.

## Why now / fresh-main evidence
- Task 046 merged as `main@804083508dcf2dedb6fbc73d7f8667a0dd14c525`; exact merged-main push CI green.
- Fresh `src/main.js` всё ещё содержит `undo()`, `redo()`, `jumpToHistory()` и history-panel wiring рядом с unrelated composition/UI code.
- `src/core/history.js` уже является canonical data structure, но runtime navigation policy — restore snapshot, transient cleanup, update/dirty/status publication — остаётся в composition root без прямого owner test.
- Fresh `src/main.js` is ~146k chars; этот seam небольшой и самостоятельный, поэтому подходит для следующей bounded проходки.

Текущий код/тесты/CI — source of truth. Перед write заново перепроверь fresh `main`, blob SHAs, current task queue и Actions preflight.

## Inspect first
1. `AGENTS.md` → `docs/PROJECT.md` → `task/README.md` → этот task.
2. Fresh `src/main.js` вокруг `updateHistory()`, `jumpToHistory()`, `undo()`, `redo()`, menu/keyboard/toolbar wiring и `updateAll()`.
3. `src/core/history.js`: `HistoryStack.undo/redo/jump/current/reset`.
4. `src/workspace/session-controller.js`: per-session history binding/snapshot/load semantics.
5. Transient state owners used by navigation today: selection, crop gesture, raster edit buffer and any pointer/edit pending guard.
6. Existing tests that assert Ctrl+Z/Ctrl+Y, history DOM, session history restoration, source slices/regex or VM/eval behavior.
7. `tools/build-bundle.mjs`, architecture guards and `.github/workflows/ci.yml`.

## Behavioral contracts to preserve

### Preflight
- Every navigation command must call the existing `blockPendingDocumentEdit()` before changing history/document.
- Blocked navigation must not change HistoryStack index, document, transient state, dirty state or status.

### Undo / Redo
- Use the active session's **current mutable HistoryStack binding**; do not capture a stale history object across tab/session replacement.
- A semantic no-op (`history.undo()/redo()` returns null) publishes nothing.
- Successful navigation restores the exact entry snapshot through canonical `restoreDocument`.
- Preserve current transient cleanup semantics unless inspection + direct regression evidence proves an existing bug. Do not silently broaden cleanup during extraction.
- Preserve `updateAll()` before `markDirty(true)` ordering unless current session invariants/tests prove a safer required order.
- Preserve exact statuses:
  - `Отменено → <label>`
  - `Повторено → <label>`

### Jump to history
- Keep current `HistoryStack.jump(index)` validation/no-op semantics.
- Successful jump restores the chosen snapshot and preserves current transient cleanup behavior, including the existing Crop reset if it is still intentional after inspection.
- Preserve exact status `История → <label>`.
- Clicking the current history entry remains disabled/no-op at the UI layer.

### Session/identity safety
- Navigation must always act on the currently active document/history session at command time.
- Do not introduce async boundaries.
- Do not create a second HistoryStack implementation or duplicate snapshot parsing.

## Target boundary
Prefer `src/workspace/history-navigation-controller.js` (or a comparably narrow workspace owner after fresh inspection).

Use explicit ports, for example:
- state: `getHistory`, `setDocument` or a narrow restore-publication port;
- guards: `blockPendingDocumentEdit`;
- restore: canonical `restoreDocument`;
- transient cleanup: explicit selection/crop/raster ports;
- runtime/UI publication: `updateAll`, `markDirty`, `setStatus`.

Do **not** pass a broad app/context object.

The owner should not:
- render history DOM rows;
- own `HistoryStack` internals;
- absorb generic session-tab lifecycle;
- absorb commit/history creation policy;
- absorb Properties/Help/menu definitions.

If inspection shows history-panel rendering and navigation are inseparable without awkward callbacks, document the reason before expanding scope; default is to keep DOM rendering outside this owner.

## Source-oracle closure
Before deleting `undo()`, `redo()` or `jumpToHistory()` from `main.js`, search repository-wide for:
- direct calls and menu/keyboard callbacks;
- toolbar/button listeners;
- source `slice/indexOf`, regex/source guards and VM/eval harnesses;
- tests that use one of these functions as a delimiter for unrelated code.

Retarget stale source tests to the canonical owner or stable semantic boundaries. Do not keep compatibility wrappers only to satisfy brittle tests.

## Targeted tests
Add direct owner coverage for at least:
1. required bridge fail-fast;
2. pending edit blocks undo/redo/jump with zero mutation/publication;
3. undo no-op and redo no-op;
4. successful undo restores exact snapshot and exact status;
5. successful redo restores exact snapshot and exact status;
6. jump validates through `HistoryStack.jump`, restores exact target and exact status;
7. transient cleanup calls match current intended semantics for each command;
8. publication ordering around document restore / cleanup / `updateAll` / dirty / status is pinned where order is behaviorally significant;
9. current history binding is resolved at command time, so tab/session replacement cannot route navigation into stale history;
10. menu/keyboard/toolbar/history-row composition routes to the owner while `main.js` no longer owns navigation transactions.

Keep `src/core/history.js` tests focused on stack mechanics; controller tests should cover runtime orchestration, not duplicate HistoryStack implementation tests.

## Documentation
Update the smallest relevant set:
- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Create a dedicated spec only if fresh inspection reveals a durable history/session invariant that would otherwise be expensive to rediscover.

## Non-scope
- No redesign of the History panel.
- No history persistence format changes.
- No HistoryStack limit/byte-limit changes.
- No commit/coalescing redesign.
- No Properties/Inspector extraction.
- No Help/About/Shortcuts extraction.
- No layer/group context-menu refactor.
- No keyboard shortcut redesign.

## Required verification
Focused new history-navigation tests + `src/core/history.js`/workspace-session regressions → architecture/source guards → full `npm run check` → generated artifact parity → real `npm run test:browser` file:// smoke → `git diff --check` → exact PR-head CI → squash merge with expected head SHA → exact merged-main push CI.

If CI fails: run → jobs → first failed step/log → classify root cause → minimal real fix. Never weaken a useful check.

## Done gate
Only after exact merged-main push CI is green:
- delete this task;
- create exactly one next bounded task from fresh `main`;
- update Drive brains only if the pass produced a genuinely new reusable lesson not already captured.

## Handoff risks
- `history` is a mutable per-session binding; stale capture is the main architecture risk.
- Undo/Redo and Jump currently have slightly different transient cleanup. Treat that as an inspection question, not an invitation to normalize behavior without evidence.
- `updateAll()` syncs current session; moving publication order can subtly change which document/history state is persisted into the session.
- UI enable/disable state for Undo/Redo is refreshed by `updateAll()`; preserve that integration.

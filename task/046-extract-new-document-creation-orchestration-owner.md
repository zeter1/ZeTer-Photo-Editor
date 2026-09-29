# 046 — Extract New Document creation orchestration owner

## Goal
Вынести оставшуюся транзакцию **File → Новый… / Ctrl+N** из `src/main.js` в узкий canonical document owner, сохранив текущую modal/dirty/pending/recovery/history/viewport семантику без добавления новых функций редактора.

## Why now / fresh-main evidence
- Task 045 merged as `main@e0b80d43ee17aa671caefc84c7665701de5bea64`; exact merged-main push CI green.
- После последовательного extraction Project/Open/Export/Resize/Background `src/main.js` всё ещё содержит `canReplaceDocument()` + `createNewDialog()` одной плотной строкой.
- New Document — самостоятельная lifecycle transaction: pending-edit preflight → dirty confirmation → modal → submit-time pending recheck → canonical document creation → history/session replacement → clean state → immediate recovery → fit-to-view.
- Этот seam мал и изолирован; его не смешивать с Properties, Help/About, Undo/Redo или import/open.

Текущий код/тесты/CI являются source of truth. Перед write заново перепроверь fresh `main`, blob SHAs и Actions preflight.

## Inspect first
1. `AGENTS.md` → `docs/PROJECT.md` → `task/README.md` → этот task.
2. Fresh `src/main.js` вокруг `canReplaceDocument()`, `createNewDialog()`, File menu, Ctrl+N routing и controller composition.
3. `src/core/state.js`: `createDocument`, canvas-size/name/background sanitization/limits.
4. `src/core/history.js`: `HistoryStack`.
5. `src/workspace/session-controller.js` + `setDoc`/session bridge semantics in `main.js`.
6. Recovery owner and exact meaning of `queueRecovery({ immediate:true })`.
7. `src/ui/modal-controller.js` callback/close behavior.
8. Tests that source-eval/slice/indexOf `createNewDialog`, `canReplaceDocument` or neighboring functions.
9. `tools/build-bundle.mjs`, architecture docs/guards and `.github/workflows/ci.yml`.

## Behavioral contracts to preserve

### Open preflight
- If `blockPendingDocumentEdit()` blocks, do not confirm, do not open modal.
- If current document is dirty, preserve the exact confirmation text:
  `В документе есть несохранённые изменения. Продолжить без сохранения?`
- Cancelled confirmation opens nothing and mutates nothing.
- Clean document skips confirmation.

### Modal schema
Preserve exactly:
- title `Новый документ`;
- name default `Без имени`;
- width default `1200`, number, min `1`, max `12000`, required;
- height default `800`, number, min `1`, max `12000`, required;
- background select default `transparent`;
- options: transparent/Прозрачный, #ffffff/Белый, #000000/Чёрный;
- submit label `Создать`.

### Submit transaction
- Repeat `blockPendingDocumentEdit()` immediately on submit; blocked submit returns `false` and publishes nothing.
- Name fallback remains `Без имени`.
- Width/height conversion remains Number-based and canonical `createDocument` validation remains authoritative; do not duplicate core size limits.
- Successful creation preserves the exact publication order/semantics currently observable:
  1. build next canonical document;
  2. reset history to a fresh `HistoryStack(80)`;
  3. replace active document/session with label `Новый документ` and reset-history semantics;
  4. mark clean;
  5. queue immediate recovery;
  6. fit viewport.
- Creation/validation error keeps modal open, publishes the existing error message via error toast + status, and does not partially replace document/history/session/recovery state.
- Do not invent an Undo entry for creating/replacing the document.

## Target boundary
Prefer `src/document/new-document-controller.js` because this is a document lifecycle transaction, not merely modal markup.

Use narrow explicit ports instead of a generic app object. A reasonable shape after fresh inspection may include:
- state/preflight: pending-edit check, dirty/confirmation access;
- document factory: canonical `createDocument` directly or a narrow factory port if tests are cleaner;
- history/session/runtime publication ports;
- recovery + viewport ports;
- modal/status/toast ports.

The controller must not:
- own generic modal DOM;
- duplicate `createDocument` validation/schema;
- absorb project open/import/export;
- read global `els`;
- create a broad mutable context bag.

If one owner would require unsafe access to mutable `history` binding, choose explicit getter/setter/reset ports; do not hide the dependency.

## Source-oracle closure
Before deleting `createNewDialog()` / `canReplaceDocument()`, search repository-wide for:
- direct calls;
- `slice/indexOf` delimiters;
- regex/source assertions;
- VM/eval harnesses;
- keyboard/menu deferred callbacks.

Do **not** use the function being extracted as a delimiter for an unrelated source test. Retarget stale oracles to stable semantic boundaries or direct owner tests.

## Targeted tests
Add direct controller coverage for at least:
1. required bridge fail-fast;
2. pending edit blocks open before confirmation;
3. dirty confirmation exact text and cancel behavior;
4. clean open path;
5. exact modal schema/defaults/options;
6. submit repeats pending guard;
7. successful creation forwards canonical values/name fallback;
8. success performs one ordered publication: history reset → document replacement → clean → immediate recovery → fit;
9. canonical factory/validation failure keeps modal open with exact toast/status and zero partial publication;
10. File menu/Ctrl+N composition routes to the owner while `main.js` no longer owns the dialog transaction.

Keep core state/history/session tests as their own semantic oracles; do not duplicate low-level validation/history implementation tests.

## Documentation
Update the smallest relevant set only:
- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Create a dedicated spec only if fresh inspection reveals a durable lifecycle invariant that would otherwise be expensive for the next AI session to rediscover.

## Non-scope
- No New Document presets/templates/recent sizes.
- No units, DPI, color profile or advanced background picker.
- No changes to canvas limits.
- No redesign of dirty-confirmation UX.
- No Help/About extraction.
- No Undo/Redo refactor.
- No README marketing changes in this pass.
- No generic “document dialog framework”.

## Required verification
Focused new controller tests + relevant document/session/recovery tests → source/architecture guards → full `npm run check` → generated artifact parity → real `npm run test:browser` file:// smoke → `git diff --check` → exact PR-head CI → squash merge with expected head SHA → exact merged-main push CI.

If CI fails: inspect run → job → first failed step/log, classify root cause (production regression vs stale oracle/harness/build issue) and make the minimum real fix. Never weaken a useful check.

## Done gate
Only after exact merged-main push CI is green:
- delete this task;
- create exactly one next bounded task from fresh `main`;
- update Drive brains only if the pass produced a genuinely new reusable lesson not already captured.

## Handoff risks
- History is a mutable composition-root binding today; preserve its exact reset semantics rather than accidentally stacking new history onto the old document.
- Recovery must represent the newly created clean document/workspace after publication, not a half-created candidate.
- `fitToView()` belongs after successful publication only.
- The dirty confirmation is an open-time user decision; submit-time safety is the repeated pending-edit guard, not a second dirty confirmation.

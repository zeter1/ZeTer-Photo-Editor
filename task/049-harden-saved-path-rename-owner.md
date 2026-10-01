# Task 049 — Harden Saved Path rename against stale tab/session owners

## Why this is next

Fresh review of merged `main` after Task 048 found a concrete delayed-modal ownership bug in `src/ui/paths-controller.js`.

`renameSelectedDocumentPath()` currently captures only `targetIndex`, then its modal `onSubmit` resolves `paths()[targetIndex]`. The `paths()` helper reads the **currently active** document through `getDocument()`.

If the user opens **Rename Saved Path**, switches to another document tab while the modal is still open, and then submits, the callback can resolve the same index in the new tab and rename the wrong document's path. Index-only capture is also weaker than the controller's stable Photoshop-compatible path IDs if the list changes before submit.

This is a correctness/data-integrity issue, not a cosmetic refactor.

## Goal

Make Saved Path rename exact-owner/exact-target safe without broadening PathsController ownership or changing normal-path UX.

## Required investigation

Before changing code:

1. Read current `src/ui/paths-controller.js`, especially:
   - `documentValue()`
   - `paths()`
   - `selectedPath()`
   - `renameSelectedDocumentPath()`
   - Saved Path ID allocation/normalization assumptions
2. Read `tests/paths-controller.test.mjs` and any composition/source guards for Paths.
3. Confirm how document-tab switching updates `getDocument()` and whether modal submission can remain alive across a tab switch.
4. Confirm the intended generic modal contract: what `onSubmit === false` means and whether stale submission should remain open or close.
5. Do not assume path index is stable when a canonical ID or exact object identity can be revalidated.

## Expected ownership pattern

Prefer the same reliability distinction documented in the project brains:

- synchronous live UI rendering may resolve the current document on every render;
- an async/delayed user intent opened for a specific document/path must capture its **origin owner + target identity**, then revalidate them immediately before mutation/publication.

For rename, the submit callback must never redirect a stale intent into another active tab.

## Acceptance criteria

At minimum:

1. Open rename on document A/path A, switch active document to B, submit:
   - B is unchanged;
   - A is not mutated by a stale modal unless current project policy explicitly supports safe origin-owned modal publication and all commit/session routing is proven exact-owner safe;
   - no history entry/commit is published to the wrong document.
2. Normal rename in the same active document still:
   - trims the name;
   - respects the existing 240-character cap;
   - suppresses empty/same-name no-ops;
   - publishes exactly one existing `Переименовать контур` commit on real mutation.
3. Target deletion/replacement/reorder before submit cannot rename a different path that merely occupies the old index.
4. Stable target identity is used where valid; if Saved Path IDs are not sufficient in every sanitized state, use an exact documented fallback rather than silently relying on index.
5. No new alternate owner for Saved Path schema, modal shell, session lifecycle, vector-mask conversion, Pen editing, or history mechanics.
6. No broad PathsController rewrite in this pass.

## Required regressions

Extend direct `tests/paths-controller.test.mjs` with focused cases for:

- same-document happy-path rename;
- tab/session switch before submit;
- another path at the old numeric index in the new document;
- target removed or replaced before submit;
- no commit/history publication on stale/no-op submit;
- exact existing commit label on successful rename.

Add/adjust a narrow source/composition guard only if it protects a real ownership invariant and is not redundant with behavior tests.

Mutation question for each test: *which plausible stale-owner bug makes this red?*

## Documentation

Update only the smallest relevant AI-facing docs if ownership/invariants materially change:

- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md`

Update `AGENTS.md` / `docs/PROJECT.md` only if routing to the canonical Paths owner actually changes.

Document the reusable rule, not implementation trivia: delayed modal callbacks are origin-bound commands and must revalidate exact owner/target before mutation.

## Verification ladder

Required before merge:

1. focused PathsController tests;
2. relevant session/tab regressions;
3. `npm run check`;
4. generated browser artifact parity;
5. `npm run test:browser` because this is modal/session/UI behavior;
6. `git diff --check`;
7. exact PR-head CI success;
8. squash merge with expected head SHA;
9. exact merged-main push CI success.

Do not mark this task complete from source inspection alone.

## Non-goals

- redesigning the Paths panel;
- changing Saved Path PSD resource-ID ranges;
- refactoring all modal callbacks;
- changing Pen/Vector Mask behavior;
- changing generic `modal-controller.js` semantics unless a proven bug there is required for this fix;
- broad session-controller changes.

## Handoff rule

After the merged-main CI for this task is green:

- delete this task file;
- create exactly one new bounded task from fresh evidence;
- keep `task/README.md` as the queue operating guide;
- update the project brains only if the pass produced a genuinely reusable practice not already documented.

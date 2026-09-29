# Task 044 — Extract Image Size / Canvas Size dialog orchestration owner

## Goal

Move the remaining user-facing Image Size / Canvas Size modal orchestration out of `src/main.js` into one directly testable UI owner while keeping persisted geometry mutation in `src/document/resize-command-controller.js` and preserving all current behavior.

## Why now / fresh-main evidence

- Task 043 is merged and exact merged-main CI is green at `main@0a0feb78df9c9df9e35c2ce38c9a067e4d1717c6`.
- `src/document/resize-command-controller.js` already owns the difficult persisted command semantics: exact originating-document guard, checked sizes, atomic transform/position planning, semantic no-op, history publication, transient reset and fit-to-view.
- `src/main.js` still owns `handleDocumentResizeCommandResult()`, `resizeImageDialog()` and `resizeCanvasDialog()`.
- Those UI functions still encode modal titles/fields/ranges, the 3×3 canvas anchor labels, open-time pending-edit preflight, exact owner capture, submit-time repeated pending guard, command routing, and INVALID/REJECTED status/toast presentation.
- `docs/PROJECT.md` explicitly records this split today as command owner in `src/document/resize-command-controller.js` but modal markup/status in `src/main.js`.
- Architecture source guards currently assert `documentResizeCommandController.resizeImage(owner,v)` and `.resizeCanvas(owner,v)` directly in `main.js`; these need to move with the ownership boundary rather than remain stale source oracles.

Current code, tests and CI are source of truth; re-inspect fresh `main` before changing anything.

## Target boundary

Prefer a narrow `src/ui/document-resize-controller.js` (or an equally clear UI-specific name discovered during inspection) that owns only Image Size / Canvas Size dialog orchestration.

It may depend on:
- a runtime state port that returns the active document and checks pending persisted edits;
- the existing `showModal` UI port;
- the existing `documentResizeCommandController` through narrow `resizeImage(owner, values)` / `resizeCanvas(owner, values)` command ports;
- status/toast output ports;
- the resize result enum / anchor contract where importing the stable public constants reduces duplicated magic values.

It must not:
- implement geometry transforms, layer-position planning, history, canvas-size validation, fit-to-view or transient-state cleanup;
- mutate the document directly;
- absorb generic modal DOM implementation;
- become a generic app/context bag.

## Behavioral contracts to preserve

### Image Size
- Opening while a persisted edit is pending does nothing.
- Capture the exact active document as `owner` when the modal opens.
- Preserve title `Размер изображения`, width/height defaults from that owner, required fields, min `1`, max `12000`, and submit label `Изменить`.
- Re-run the pending-edit guard on submit; if blocked return `false` and do not call the command.
- Otherwise call the existing resize-image command with the captured owner, not whatever document is active later.

### Canvas Size
- Preserve the same open/submit guards and exact owner capture.
- Preserve title `Размер холста`, width/height fields and limits.
- Preserve all nine anchor values and user labels, with `center` as the default.
- Delegate to the existing resize-canvas command with the captured owner.

### Command-result presentation
- `INVALID`: show the command error message (fallback `Не удалось изменить размер документа`) through error toast + status and return `false` so the modal stays open.
- `REJECTED`: publish `Документ изменился — размер не применён` and return `false`.
- `COMMITTED` / semantic `NOOP`: preserve the current close behavior; do not invent extra toast/status/history.

## Inspect first

1. `AGENTS.md` → `docs/PROJECT.md` → this task.
2. Fresh `src/main.js` around resize controller composition, result handling and both dialogs.
3. `src/document/resize-command-controller.js` + `tests/document-resize-command-controller.test.mjs`.
4. `src/ui/modal-controller.js` only for the stable `showModal` callback contract.
5. `tests/architecture-layout.test.mjs` and repository-wide source-eval/source-regex references before extraction.
6. `tools/build-bundle.mjs` and `.github/workflows/ci.yml` before writes.

## Planned extraction / test closure

1. Create the narrow UI owner and direct deterministic tests for its modal/guard/result-routing behavior.
2. Compose it from `src/main.js`; menu entries should call the controller-facing Image Size / Canvas Size actions while `main` no longer implements the dialog/result functions.
3. Retarget architecture/source assertions to the canonical UI owner and prove the command controller remains the only persisted resize implementation.
4. Check source-eval delimiters and lazy menu callbacks so removal of the old functions cannot create a runtime-only regression.
5. Add the new module to the canonical file:// bundle graph before `src/main.js`, regenerate generated artifacts only through the canonical build.
6. Update CHANGELOG and the smallest relevant AI navigation docs; create a new spec only if this pass reveals a durable resize-dialog invariant not already obvious from owner tests/docs.

## Targeted tests

Direct UI-controller tests should cover at least:
- pending guard prevents opening either modal;
- exact Image Size field schema/defaults;
- exact Canvas Size field schema/defaults + all nine anchors;
- submit repeats the pending guard and does not invoke a command when blocked;
- owner identity captured at open survives active-document replacement before submit;
- Image Size routes to `resizeImage`; Canvas Size routes to `resizeCanvas`;
- INVALID result publishes error toast/status and returns `false`;
- REJECTED result publishes stale-document status and returns `false`;
- COMMITTED and NOOP preserve normal modal-close semantics without duplicate UI publication.

Keep the existing command-controller suite as the geometry/history oracle; do not duplicate its low-level cases in the UI test.

## Non-scope

- No change to resize math, max canvas/layer-position limits or history labels.
- No aspect-ratio UX feature, resampling algorithm choice, new units or preview UI in this extraction.
- No general modal framework refactor.
- No unrelated Properties-panel, menu, Crop or Background refactor.
- No README marketing change in the same CL.

## Required verification

1. focused new UI-owner tests;
2. existing resize command regressions + architecture/source guards;
3. repository-wide reference closure for removed symbols;
4. `npm run check`;
5. generated `src/app.bundle.js`, `index.html`, `version.json` parity;
6. `npm run test:browser` real `file://` smoke;
7. `git diff --check`;
8. holistic final diff review after green tests;
9. exact PR-head CI green;
10. squash merge with expected head SHA;
11. exact merged-main `push` CI green.

## Done gate

Delete this task only after the merged `main` SHA has an exact successful push CI run. If any gate fails, classify the first failing step/log and fix the root cause without weakening checks.

## Handoff note

This is deliberately a small UI-orchestration extraction. The next pass should not combine it with the much larger `updateProperties()` / Properties-panel decomposition merely because both live in `src/main.js`.

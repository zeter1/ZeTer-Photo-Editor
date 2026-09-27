# 029 — Extract new Pen draft gesture lifecycle owner

## Goal

Move the transient **new Pen path draft + per-point handle drag lifecycle** out of the large `src/main.js` composition root into a focused interaction owner.

Keep this pass bounded to the in-progress draft/gesture state. Do **not** move final persisted Shape publication/history yet; `finishPenPath()` remains the next separate command boundary unless inspection proves a smaller/safer split.

## Why now / evidence

Tasks 026–028 established clear owners for **existing** Bézier controls:

- read-only discovery/projection/hit/render/cursor → `src/interaction/path-control-surface-controller.js`;
- one-shot Alt-click existing-anchor → corner command → `src/interaction/path-control-command-controller.js`;
- existing anchor/handle drag transaction → `src/interaction/path-control-gesture-controller.js`.

The largest remaining Pen-specific interaction state in `src/main.js` is the **new-path draft**:

- global `penDraft`;
- `beginPenPoint()` creates a transient corner node and `drag={kind:'pen-handle', ...}`;
- idle pointer movement writes `penDraft.hover`;
- `pen-handle` pointermove applies the `1 / zoom` threshold, symmetric smooth handles, and Alt independent-handle semantics;
- pointerup publishes exact Pen status text;
- pointercancel and Escape each splice the transient node and may clear the entire draft;
- tool/document/session changes clear `penDraft`;
- overlay rendering and existing-control cursor gating read whether a draft exists.

That is a coherent transient gesture lifecycle and is now the next high-value composition-root extraction.

## Source of truth / inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. all current `penDraft` / `pen-handle` occurrences in `src/main.js`
6. `src/interaction/pointer-lifecycle-router.js`
7. `src/interaction/path-control-surface-controller.js`
8. `src/interaction/path-control-command-controller.js`
9. `src/interaction/path-control-gesture-controller.js`
10. document/session/tool reset paths that currently clear `penDraft`
11. nearest pointer/Pen/architecture regressions, especially:
   - `tests/advanced-tools-v120.test.mjs`
   - `tests/pointer-release-tools.test.mjs`
   - `tests/editor-interactions.test.mjs`
   - `tests/architecture-layout.test.mjs`
   - `tests/vector-masks.test.mjs`

Current code, runtime behavior, GitHub and CI override this task if they diverge.

## Scope

Prefer one focused owner such as `src/interaction/pen-draft-gesture-controller.js` if inspection confirms the boundary.

The owner may cover:

- transient draft state (`points` + hover) and read-only getters;
- beginning a new draft point and creating the corresponding transient handle gesture;
- the current close/finish-intent proximity rule (`4 / zoom`) expressed as an outcome for the composition root rather than directly persisting a layer;
- idle hover updates while a new Pen draft is active;
- `pen-handle` gesture identification;
- handle-drag update with the current `1 / zoom` threshold;
- current smooth/symmetric-handle vs Alt independent/corner semantics;
- pointer-release completion/status outcome for a transient point;
- one canonical cancel primitive used by pointercancel and Escape;
- explicit reset used by tool/document/session transitions.

The composition root should keep generic pointer routing/capture and convert controller outcomes into UI orchestration where appropriate.

## Behavioral contracts to preserve

- First/new point starts as `{ handleIn:null, handleOut:null, kind:'corner' }`.
- New point immediately starts a `pen-handle` transient gesture.
- Drag distance `<= 1 / zoom` remains a corner/no-handles state.
- Drag distance `> 1 / zoom` creates `handleOut`.
- Without Alt, `handleIn` mirrors around the anchor and `kind='smooth'`.
- With Alt, `handleIn=null` and `kind='corner'` while `handleOut` follows the pointer.
- Releasing preserves current exact status behavior:
  - no move → `Перо: угловая точка`;
  - moved smooth → `Перо: гладкая точка с симметричными ручками`;
  - moved Alt/corner → `Перо: угловая точка с независимой ручкой`.
- Pointercancel and Escape during the active new-point handle gesture remove exactly that transient node; an empty draft becomes null.
- Escape with a draft but no active handle gesture cancels the whole draft and keeps exact status `Контур отменён`.
- Tool/document/session transitions continue to clear transient draft state.
- Existing-path surface/command/gesture owners must not absorb new-path draft policy.
- Saved Path and Vector Mask edit modes still reject adding a new Pen draft through their current explicit status paths.
- No persisted layer/history entry is produced merely by drafting or moving a handle.

## Non-scope

Do **not** move or redesign in this pass:

- final `finishPenPath()` persisted Shape creation/history;
- `penDraftBounds()`, `localizePenNode()` or final `createShapeLayer()` publication unless inspection proves they are required only as a narrow read-only helper for the draft owner;
- `tracePenDraftPath()` / overlay styling unless a tiny read-only helper extraction is necessary for ownership clarity;
- existing Shape / Vector Mask / Saved Path control surface;
- existing path-control one-shot corner command;
- existing anchor/handle drag transaction;
- Saved Paths CRUD;
- Vector Mask lifecycle;
- PSD/PSB codecs;
- generic Pointer Events capture;
- unrelated Pen feature redesign.

Do not combine transient draft extraction and persisted path-finalization command extraction in one pass.

## Planned extraction

1. Inventory every `penDraft` and `pen-handle` read/write and classify it as transient draft state, pointer gesture lifecycle, overlay read, reset, or final persisted publication.
2. Define grouped narrow ports for zoom and redraw/status only where the controller truly needs side effects.
3. Move transient draft state and begin/update/release/cancel/reset mechanics behind explicit methods/results.
4. Make pointercancel and Escape share the same node-cancel primitive instead of duplicating splice/null logic.
5. Keep `finishPenPath()` as composition-root/persisted command code; when double-click/Enter requests finalization, consume a safe snapshot/result from the draft owner rather than reaching into mutable global draft state where practical.
6. Preserve surface cursor gating through a narrow `hasDraft()`/getter rather than exposing mutable state.
7. Add the new owner to `tools/build-bundle.mjs`.
8. Update AI routing docs to distinguish:
   - existing control read surface;
   - existing one-shot command;
   - existing drag transaction;
   - **new Pen draft gesture**;
   - final new-path persisted publication (still `main.js` after this pass).

Prefer a minimal diff.

## Targeted tests

Add direct tests for at least:

- first point/draft creation;
- subsequent point creation;
- close/finish intent threshold `4 / zoom` without directly persisting a layer;
- handle update below and above `1 / zoom`;
- smooth mirrored handles;
- Alt independent-handle/corner behavior;
- release outcome/status classification;
- pointercancel-style active-point rollback;
- Escape-style whole-draft cancellation;
- reset on owner/tool/session boundary through the public reset seam;
- no persisted/history side effects from transient gesture methods;
- composition-root wiring/source guards proving `pen-handle` mutation/splice policy no longer drifts in `src/main.js`.

Retarget stale source-location assertions to the canonical owner; scope source guards to the relevant function/owner instead of scanning unrelated Pen code globally.

## Required verification

- direct Pen-draft gesture controller tests;
- affected pointer/Pen/vector/architecture regressions;
- `npm run check`;
- canonical generated `src/app.bundle.js` / `index.html` / `version.json` parity;
- `npm run test:browser`;
- `git diff --check`;
- PR CI green on latest head SHA;
- after merge, main push CI green.

## Done gate

Only after merge + green main CI:

- delete this task file;
- create exactly one next bounded task from current evidence;
- likely evaluate final new-path publication (`finishPenPath()` + bounds/localization/history) as its own command owner, but do not pre-commit to that if current evidence points elsewhere.

## Risks / handoff notes

The main risk is accidentally mixing **transient draft mechanics** with **persisted path publication**, recreating a large Pen controller. Keep the new owner small and transaction-like. A second risk is duplicated cancellation semantics: pointercancel, Escape and document/tool reset must not diverge. Preserve current user-visible statuses and thresholds exactly unless a reproducible bug demonstrates that a behavior change is required.

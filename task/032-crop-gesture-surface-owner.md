# 032 — Extract transient Crop gesture / overlay owner

## Goal

Move the **transient Crop-tool interaction state and overlay presentation** out of the large `src/main.js` composition root into one focused interaction owner, while keeping persisted crop mutation/history in the already-canonical `src/document/crop-command-controller.js`.

This pass should give Crop the same explicit split already used elsewhere:

- pointer/tool dispatch → `src/main.js`;
- transient gesture + crop draft + crop overlay → new focused interaction owner;
- persisted geometry/history → `src/document/crop-command-controller.js`;
- generic pointer capture → `src/interaction/pointer-lifecycle-router.js`.

## Why now / fresh evidence

Fresh `main` after PR #57 is about 2.8k lines and has a clean selected-layer transform surface owner. The next coherent interaction state still spread across the composition root is Crop:

- global `cropRect` is owned directly by `src/main.js`;
- document-session snapshot/restore reads/writes `cropRect`;
- `drawOverlay()` contains the full crop dimming/frame/rule-of-thirds renderer;
- Crop pointer-down creates `{kind:'crop', start, current, owner}` and a zero-size `cropRect`;
- pointer-move normalizes and republishes the draft rectangle;
- pointer-up applies the final release point and enforces the existing 10×10 gate before delegating to `applyCrop(d.owner, r)`;
- pointer-cancel / Escape / tool or document reset clear `cropRect`;
- `documentCropCommandController` already owns persisted geometry, exact-owner validation and the single `Кадрирование` history publication.

This is one bounded transient owner, not a reason to build a generic all-overlay controller.

## Source of truth / inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `src/main.js` around:
   - global `cropRect`;
   - `documentSessionController.getRuntimeState/applyRuntimeState`;
   - `setDoc()`, `jumpToHistory()`, tool/reset/Escape paths;
   - the crop block inside `drawOverlay()`;
   - Crop branches in `onOverlayPointerDown/Move/Up/Cancel`;
   - `applyCrop()` and `cropToSelection()`.
6. `src/document/crop-command-controller.js`
7. `src/interaction/pointer-lifecycle-router.js`
8. nearest transient-owner patterns:
   - `src/selection/gesture-controller.js`;
   - `src/interaction/pen-draft-gesture-controller.js`;
   - `src/interaction/layer-transform-surface-controller.js`.
9. Source-sliced / VM tests before changing pointer caller dependencies:
   - `tests/pointer-release-tools.test.mjs`;
   - `tests/architecture-layout.test.mjs`;
   - any `runInNewContext`, `vm`, `eval`, `slice/indexOf`, regex/source guard that mentions `cropRect`, `kind:'crop'`, `applyCrop`, pointer functions or `drawOverlay`.
10. Lazy/runtime references too: session restore, keyboard Escape, document/history/tool reset paths and browser smoke.

Current code, tests, GitHub and CI override this task if they differ.

## Preferred boundary

Prefer a small owner such as:

`src/interaction/crop-gesture-controller.js`

if inspection confirms the dependency shape.

The owner may cover only the transient Crop interaction:

- current crop draft rectangle;
- exact originating document identity captured at begin;
- begin/update/final-release/cancel semantics;
- final-release rectangle calculation;
- current pointer minimum-size acceptance gate;
- immutable snapshot/restore needed by per-document session state;
- read-only crop overlay drawing:
  - outside dimming;
  - clear crop window;
  - white dashed border;
  - rule-of-thirds guides;
  - current zoom-stable line/dash metrics.

Prefer semantic outcomes from `finish()` such as accepted/rejected + exact owner + final rect; `src/main.js` should decide to call the persisted crop command.

## Behavioral contracts to preserve

### Gesture / final release

- Crop begins only from the existing Crop-tool pointer dispatch and captures the exact current document object.
- Start/current coordinates remain document-space points.
- Move uses canonical `normalizeRect(start, point)`, including reverse drags.
- Pointer-up must apply the **actual release position even when there was no final pointermove**.
- The existing pointer-gesture acceptance gate remains exactly:
  - `width >= 10`;
  - `height >= 10`.
- An undersized release clears the transient crop draft, redraws, and publishes no persisted crop/history.
- An accepted release delegates the exact captured owner + final rect to the existing `documentCropCommandController` path.
- Do not merge the Crop-to-Selection 1×1 eligibility policy into the pointer 10×10 gesture gate.

### Cancellation / resets / sessions

- Pointer cancel, lost capture through the existing lifecycle, Escape, document replacement/history jump and tool reset must not leave a stale crop draft.
- A stale gesture must never redirect a crop into a later document.
- Per-document session snapshots must preserve the same current `cropRect` presentation state as today.
- Restoring a session must restore only safe immutable crop-draft data; active pointer ownership/drag objects must not be resurrected.
- Successful persisted crop transient completion must clear the canonical crop draft through the new owner instead of maintaining a second `cropRect` variable.

### Overlay

Preserve the exact current visual policy unless inspection proves a bug and adds a regression:

- outside fill `#0008`;
- crop window cleared from the dimming layer;
- border `#ffffff`;
- border line width `1 / zoom`;
- border dash `[8 / zoom, 5 / zoom]`;
- guide alpha `.72`;
- guide dash `[4 / zoom, 5 / zoom]`;
- guides at 1/3 and 2/3 in both axes;
- balanced Canvas `save()/restore()`.
- Preserve overlay ordering relative to selection, Pen/path controls, brush/clone guides, smart guides and selected-layer transform surface.

## Ownership rules

The new transient owner must publish **no persisted document mutation and no history**.

Keep outside it:

- actual canvas/layer geometry mutation and `Кадрирование` history → `src/document/crop-command-controller.js`;
- Crop-to-Selection command entry → `src/main.js` / selection bridge;
- generic pointer capture → `pointer-lifecycle-router.js`;
- global tool routing → `src/main.js`;
- other overlays / selection / Pen / brush / Smart Snap;
- document/session object ownership → workspace controller.

The Crop interaction owner may receive explicit read-only runtime ports for current zoom/document or draw directly from passed `ctx/zoom/documentSize`, but it must not absorb workspace/session policy.

## Non-scope

Do **not** combine this pass with:

- redesigning persisted Crop semantics;
- Image Size / Canvas Size;
- Crop-to-Selection behavior changes;
- selection gesture refactoring;
- generic shape/line/gradient gesture extraction;
- a full `drawOverlay()` renderer rewrite;
- viewport zoom/pan changes;
- changing Crop UI or adding resize handles;
- unrelated `updateProperties()` refactoring.

## Planned extraction

1. Inventory **all** reads/writes of `cropRect` and `kind:'crop'`, including session/reset/lazy paths.
2. Inventory source-sliced/VM pointer tests before modifying function dependencies.
3. Define a narrow transient API, e.g.:
   - `begin(owner, point)`;
   - `isGesture(value)`;
   - `update(gesture, point)`;
   - `finish(gesture, releasePoint)`;
   - `cancel(gesture?)` / `reset()`;
   - `snapshot()` / `restore(snapshot)`;
   - `draw(ctx)` or `draw(ctx, {zoom, documentSize})`.
4. Preserve exact document identity in gesture objects and reject stale/replaced gesture state rather than redirecting.
5. Make pointer-down/move/up/cancel consume the owner API; keep `main.js` as dispatcher only.
6. Route session snapshot/restore and reset paths through the owner; do not keep a shadow `cropRect`.
7. Move only the crop overlay block from `drawOverlay()`, preserving its position in the draw order.
8. Keep accepted finalization delegation to `documentCropCommandController` through the existing `applyCrop` presentation bridge.
9. Add the module to `tools/build-bundle.mjs`.
10. Update AI-routing docs and structural guards.
11. Run repository-wide reference closure for removed helpers/state, including lazy runtime callbacks.
12. Regenerate browser artifacts canonically.

Prefer a minimal diff.

## Targeted tests

Add direct controller tests for at least:

- required explicit ports / invalid input;
- begin captures exact owner and initializes zero-size draft;
- reverse-direction update normalizes the rectangle;
- immutable snapshot;
- session restore accepts a safe rectangle but restores no active pointer gesture;
- final release uses release geometry without needing a last move;
- exact 10×10 boundary accepted;
- one dimension below 10 rejected and clears transient draft;
- stale/replaced document cannot yield an accepted persisted intent;
- cancel/reset idempotently clears only the Crop transient state;
- overlay exact styles/dashes/thirds and paired save/restore;
- owner methods do not mutate document geometry or publish history.

Retarget integration/source guards for:

- pointer-down delegates Crop begin;
- pointer-move delegates update;
- pointer-up delegates final release and then only accepted outcome reaches `applyCrop`;
- pointer-cancel/Escape/reset delegate cancellation/reset;
- session snapshot/restore uses the new owner;
- `src/main.js` no longer owns a mutable global `cropRect` or the crop overlay drawing block;
- `document-crop-command-controller.js` remains the only persisted/history owner;
- pointer release still honors the final release position.

Update every VM/source-sliced harness dependency explicitly; do not add production globals/fallbacks to satisfy tests.

## Required verification

- direct Crop gesture/overlay controller tests;
- existing document Crop command tests;
- affected pointer-release/architecture/reliability/session regressions;
- `npm run check`;
- canonical generated `src/app.bundle.js` / `index.html` / `version.json` parity;
- `npm run test:browser`;
- `git diff --check`;
- exact-head PR CI green;
- after merge, `main` push CI green.

## Done gate

Only after merge + green main CI:

- delete this task file;
- create exactly one next bounded task from fresh `main` evidence;
- do not preselect the following hotspot before re-inspecting current code.

## Risks / handoff notes

Primary risk: creating a second persisted Crop owner. The new controller is transient only; `crop-command-controller.js` remains authoritative for document geometry and history.

Second risk: `cropRect` currently participates in per-tab session snapshots even when no active pointer gesture exists. Preserve this display-state contract without restoring stale pointer ownership.

Third risk: `tests/pointer-release-tools.test.mjs` source-slices `onOverlayPointerMove/Up` into a VM context. New delegation dependencies must be supplied explicitly in the harness.

Fourth risk: repository-wide reference closure is mandatory. PR #57 proved that lazy UI callbacks can retain a removed helper even when unit/source tests pass; browser smoke must execute the real file:// UI path before merge.

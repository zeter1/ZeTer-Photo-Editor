# 030 — Extract final new-Pen path publication command owner

## Goal

Move the **final persisted publication of a brand-new Pen path** out of the large `src/main.js` composition root into one focused command owner.

Task 029 already extracted transient draft/handle gesture state into `src/interaction/pen-draft-gesture-controller.js`. This pass must keep that owner transient-only and extract the next separate boundary: consuming finalized draft points into a persisted Shape layer + history entry.

## Why now / evidence

Current `main` after PR #55 has a clean split for Pen interactions:

- existing control read surface → `src/interaction/path-control-surface-controller.js`;
- existing Alt-click anchor command → `src/interaction/path-control-command-controller.js`;
- existing anchor/handle drag transaction → `src/interaction/path-control-gesture-controller.js`;
- new-path transient draft/handle gesture → `src/interaction/pen-draft-gesture-controller.js`.

The remaining finalization code is still concentrated in `src/main.js`:

- `penDraftBounds(points)`;
- `localizePenNode(point,bounds)`;
- `finishPenPath()`;
- final `createShapeLayer({... shape:'path' ...})`;
- `addLayer(doc,...)`;
- exact history publication `commit('Добавить Bézier-контур')`;
- final status `Bézier-контур добавлен`.

This is now a coherent persisted command boundary and is the next high-value composition-root extraction.

## Source of truth / inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `src/main.js` around:
   - `tracePenDraftPath()`;
   - `penDraftBounds()`;
   - `localizePenNode()`;
   - `finishPenPath()`;
   - Enter/double-click callers.
6. `src/interaction/pen-draft-gesture-controller.js`
7. `src/core/state.js` shape-layer creation/schema helpers
8. nearest command-owner patterns:
   - `src/interaction/path-control-command-controller.js`;
   - `src/layers/command-controller.js`;
   - `src/selection/vector-mask-controller.js`.
9. all tests that source-slice/eval Pen or pointer functions before changing dependencies:
   - `tests/pointer-release-tools.test.mjs`;
   - `tests/advanced-tools-v120.test.mjs`;
   - `tests/architecture-layout.test.mjs`;
   - any `runInNewContext`, `vm`, `slice/indexOf`, regex source guards touching finalization.

Current code, runtime behavior, GitHub and CI override this task if they diverge.

## Scope

Prefer one focused owner such as `src/interaction/pen-path-command-controller.js` if inspection confirms the boundary.

The owner may cover:

- validation of finalized point arrays for publication;
- current bounds calculation, including handles;
- localization of anchors/handles into layer-local coordinates;
- creation/publication of the final Shape path through narrow explicit runtime/state ports;
- current `pathClosed`, stroke, stroke width and opacity inputs;
- exact success history label;
- explicit semantic outcome for rejected/no-op finalization.

Keep pointer/keyboard dispatch in `src/main.js`. Keep transient draft ownership in `pen-draft-gesture-controller.js`.

## Behavioral contracts to preserve

- Fewer than 2 points do not create a layer and publish no history.
- Bounds include anchor coordinates plus `handleIn` / `handleOut`.
- Degenerate geometry where `max(width,height) < 1` creates no layer and publishes no history unless inspection proves an existing bug that should be fixed with a regression.
- Persisted path points are localized relative to the computed bounds.
- `kind` remains canonical `smooth` or `corner`.
- Shape publication preserves:
  - `name:'Контур'`;
  - `shape:'path'`;
  - `pathClosed:Boolean(els.penClosed?.checked)`;
  - `fill:'transparent'`;
  - current primary stroke color;
  - `strokeWidth=Math.max(1, Number(brushSize) || 1)`;
  - current tool opacity.
- Layer dimensions remain clamped to at least 1 as today.
- Exactly one successful persisted publication yields exactly one history entry with exact label `Добавить Bézier-контур`.
- Success status remains exact `Bézier-контур добавлен`.
- Failed/rejected finalization publishes no layer/history.
- Draft consumption/reset remains owned by `pen-draft-gesture-controller.js`; do not recreate a mutable `penDraft` in the new command owner.
- Existing Shape/Vector Mask/Saved Path editing semantics remain untouched.

## Non-scope

Do **not** combine this pass with:

- overlay rendering / `tracePenDraftPath()` styling extraction unless inspection proves a tiny pure-helper move is required;
- existing Bézier surface/command/drag refactors;
- Saved Paths CRUD;
- Vector Mask lifecycle;
- PSD/PSB codec changes;
- generic pointer capture;
- Pen feature redesign;
- changing close/handle thresholds from task 029;
- unrelated `main.js` cleanup.

Do not turn the final publication owner into another large Pen controller.

## Planned extraction

1. Inventory all callers of `finishPenPath()` and all source-sliced/VM tests that evaluate its callers.
2. Define a narrow command API around finalized point data + publication options, with explicit outcomes rather than DOM reads hidden inside the owner where practical.
3. Move `penDraftBounds()` and `localizePenNode()` with the publication command if they are used only by that boundary.
4. Keep `pen-draft-gesture-controller.js` responsible for `consumePoints()`; pass the consumed immutable points to the command owner.
5. Move Shape creation/add/history into the command owner using existing canonical state helpers/ports; preserve exact label/status.
6. Have `src/main.js` translate command outcome into redraw/status orchestration only.
7. Add owner to `tools/build-bundle.mjs`.
8. Retarget architecture docs/source guards so future agents route:
   - transient new-path gesture → `pen-draft-gesture-controller.js`;
   - final persisted new-path command → new command owner;
   - pointer/keyboard dispatch → `main.js`.
9. Regenerate browser artifacts canonically.

Prefer a minimal diff.

## Targeted tests

Add direct tests for at least:

- <2 points → no layer/history;
- degenerate bounds → no layer/history;
- bounds include handles;
- point + handle localization;
- smooth/corner normalization;
- open vs closed `pathClosed`;
- exact stroke/strokeWidth/opacity mapping;
- exactly one layer publication + exact `Добавить Bézier-контур` history on success;
- no history on rejected/no-op paths;
- composition-root wiring: Enter and double-click consume draft then delegate final publication;
- source guards proving `penDraftBounds`, `localizePenNode`, direct path `createShapeLayer` publication and exact history label no longer drift in `src/main.js`;
- update any VM/source-sliced harness dependencies explicitly rather than adding runtime fallbacks.

Where useful, use `node:test` spies/mocks or explicit call-recording stubs to verify command delegation. Node's test runner exposes mock functions; source executed in `node:vm` uses the supplied context as its global scope, so any retained VM harness must declare delegated dependencies explicitly.

## Required verification

- direct new Pen publication command tests;
- affected Pen/pointer/vector/architecture regressions;
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
- do not assume the next hotspot before re-inspecting current `main`.

## Risks / handoff notes

Primary risk: mixing transient draft state back into the persisted command owner. The command should receive finalized immutable points; it must not own hover, active pointer gesture or draft reset policy.

Second risk: tests that source-slice `main.js` can have hidden VM-context dependencies. Search them before the write. If CI reports `ReferenceError` only inside such a harness, fix the harness/root cause instead of adding a production global/fallback.

Third risk: finalization currently consumes the draft before publication validation. Preserve observable behavior unless a reproducible bug and a dedicated regression justify changing it.

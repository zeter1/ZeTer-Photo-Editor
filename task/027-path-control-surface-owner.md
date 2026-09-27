# 027 — Extract existing path-control overlay / hit-test surface

## Goal

Move the read-only existing Bézier edit surface out of the large `src/main.js`: editable-target discovery, document-point projection, handle/anchor hit-testing, path tracing, overlay controls and Pen cursor hit feedback.

Keep this pass bounded to **read-only target discovery + hit/render/cursor behavior**. Do not absorb persisted mutations or new-path creation.

## Why now / evidence

Task 026 moved the existing anchor/handle drag transaction into `src/interaction/path-control-gesture-controller.js`, but the composition root still owns a coherent ~100-line read-only cluster:

- `selectedEditablePathTargets()`
- `pathTargetPoints()`
- `pathControlDocumentPoint()`
- `hitSelectedPathControl()`
- `traceEditablePathTarget()`
- `drawSelectedPathControls()`
- `updatePenCursor()`

The cluster resolves the same three editable sources (Shape path / Vector Mask / Saved Path), performs coordinate projection, chooses handles before anchors for hit precedence, renders source-specific overlays and drives pointer-vs-crosshair cursor state.

Leaving those mechanics in `main.js` makes AI navigation expensive and keeps path-edit responsibilities split across unrelated runtime code.

## Source of truth / inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `src/main.js` bounded window around `selectedEditablePathTargets` → `updatePenCursor`
6. `src/interaction/path-control-gesture-controller.js`
7. `src/ui/paths-controller.js`
8. `src/selection/vector-mask-controller.js`
9. nearest tests:
   - `tests/advanced-tools-v120.test.mjs`
   - `tests/vector-masks.test.mjs`
   - `tests/path-control-gesture-controller.test.mjs`
   - `tests/architecture-layout.test.mjs`

Current code/GitHub/CI override this task if they diverge.

## Scope

Prefer one focused owner such as `src/interaction/path-control-surface-controller.js` (name may change if inspection finds a clearer boundary).

The extracted owner should cover:

- current editable target projection for:
  - selected Shape path;
  - selected Vector Mask edit target;
  - selected Saved Path edit target;
- stale/invalid edit-target cleanup only where it is already part of discovery semantics;
- layer-local → document coordinate projection through an injected/canonical geometry bridge;
- deterministic hit-testing:
  - handles before anchors;
  - current `8 / zoom` radius contract;
  - locked layer-backed targets are not editable;
- tracing an editable cubic path into an injected canvas context;
- overlay anchors/handles/source-specific path colors and lock appearance;
- Pen cursor hit feedback (`pointer` vs `crosshair`) through a narrow runtime/UI port.

## Non-scope

Do **not** move or redesign in this pass:

- persisted drag transaction/update/finalize/cancel — remains `path-control-gesture-controller.js`;
- Alt-click anchor → corner persisted mutation/history;
- `beginPathControlDrag()` orchestration unless a tiny wrapper becomes unnecessary after extraction;
- `penDraft`, `pen-handle`, `beginPenPoint()`, `finishPenPath()`;
- Saved Paths CRUD/panel/apply logic;
- Vector Mask lifecycle commands;
- PSD/PSB path/vector-mask codecs;
- generic Pointer Events capture lifecycle.

If Alt-click corner conversion needs a canonical owner, leave it as a separate future task instead of broadening this one.

## Behavioral contracts to preserve

- Saved Path edit mode wins over selected-layer Shape/Vector Mask targets.
- Invalid Saved Path edit index resets to `-1` exactly as today.
- Vector Mask edit is active only for the currently selected matching layer ID.
- Hidden selected layers expose no layer-backed editable controls.
- Recursive effective layer locks prevent control hit/edit and retain locked overlay appearance.
- Shape path target uses `pathClosed`; Vector Mask/Saved Path targets use each subpath `closed !== false`.
- Handle hit precedence remains before anchor hit precedence.
- Hit radius remains zoom-stable at `8 / zoom`.
- Layer-backed anchor/handles are projected with canonical layer→document geometry; Saved Paths remain document-space.
- Vector Mask and Saved Path outlines keep their current dashed rendering and source-specific colors.
- Overlay control sizes/line width remain zoom-stable.
- Cursor remains `pointer` only over a hit editable control, otherwise `crosshair`, and only while Pen is idle (no drag/new-path draft).

## Planned extraction

1. Define grouped ports for live edit identity/state, geometry, lock policy and overlay/UI effects.
2. Move pure/read-only target discovery + projection + hit/tracing/render behavior.
3. Keep DOM listener installation and tool dispatch in `main.js`.
4. Make `main.js` delegate hit-test, draw and cursor decisions to the new owner.
5. Add the owner to `tools/build-bundle.mjs`.
6. Update architecture/AI routing docs so future models do not reopen the whole Pen section in `main.js`.

Prefer minimal diff; do not invent a generalized vector framework.

## Targeted tests

Add direct tests for at least:

- Shape / Vector Mask / Saved Path target discovery and precedence;
- stale Saved Path edit-index cleanup;
- selected-layer visibility and matching Vector Mask edit ID;
- recursive lock hit rejection;
- layer→document anchor and handle projection;
- handle-before-anchor hit precedence;
- zoom-dependent hit radius;
- open vs closed tracing;
- source-specific overlay styling / zoom-stable sizes at contract level;
- cursor pointer/crosshair routing and idle guards;
- composition-root wiring + architecture source guard.

Retarget old regex tests to the canonical owner instead of deleting the behavior assertions.

## Required verification

- targeted new controller tests;
- affected path/vector/pointer/architecture regressions;
- `npm run check`;
- generated `src/app.bundle.js` / `index.html` / `version.json` clean after canonical build;
- `npm run test:browser`;
- `git diff --check`;
- PR CI green on latest head SHA;
- after merge, main push CI green.

## Done gate

Only after merge + green main CI:

- delete this task file;
- create exactly one next bounded task from current evidence;
- do not leave stale completed queue entries.

## Risks / handoff notes

The main risk is accidentally mixing read-only surface extraction with persisted path mutations. Keep transaction ownership in `path-control-gesture-controller.js` and keep Alt-click corner conversion/new Pen draft out of scope.

When testing overlay rendering, prefer a minimal fake canvas context and semantic call assertions over pixel snapshots unless a real visual regression requires pixels.

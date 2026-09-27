# 028 — Extract existing path-control corner conversion command

## Goal

Move the one-shot **Alt-click existing anchor → corner** persisted mutation/history policy out of the large `src/main.js` wrapper into a focused interaction command owner.

Keep this pass bounded to **converting an already-existing anchor to a corner**. Do not absorb drag transactions, read-only surface behavior or new-path drafting.

## Why now / evidence

Task 027 moved existing Bézier target discovery/projection/hit-testing/control drawing/cursor feedback into `src/interaction/path-control-surface-controller.js`, while task 026 already moved existing anchor/handle drag transactions into `src/interaction/path-control-gesture-controller.js`.

The remaining `beginPathControlDrag()` wrapper in `src/main.js` still owns a small but behavior-sensitive persisted command:

```js
if(hit.control==='anchor'&&event.altKey){
  const changed=Boolean(node.handleIn||node.handleOut||node.kind==='smooth');
  node.handleIn=null;node.handleOut=null;node.kind='corner';
  if(changed)commit(...source-specific history label...);
  else setStatus('Bézier-узел уже угловой');
  return true;
}
```

This is not a drag transaction and not read-only surface policy. Giving it a narrow owner will further reduce mutation/history logic in the composition root without mixing unrelated Pen responsibilities.

## Source of truth / inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `src/main.js` around `beginPathControlDrag()`
6. `src/interaction/path-control-surface-controller.js`
7. `src/interaction/path-control-gesture-controller.js`
8. `src/core/state.js` lock/identity helpers
9. nearest tests:
   - `tests/path-control-surface-controller.test.mjs`
   - `tests/path-control-gesture-controller.test.mjs`
   - `tests/advanced-tools-v120.test.mjs`
   - `tests/vector-masks.test.mjs`
   - `tests/architecture-layout.test.mjs`
   - `tests/selection-vector-mask-controller.test.mjs`

Current code/GitHub/CI override this task if they diverge.

## Scope

Prefer one focused owner such as `src/interaction/path-control-command-controller.js` if inspection confirms that a command boundary is clearer than extending either surface or gesture owners.

The command should cover only:

- accepting an existing path-control hit target;
- requiring an anchor + Alt intent;
- resolving the live target/node through an explicit narrow port rather than duplicating target-discovery policy;
- converting that anchor to corner semantics:
  - `handleIn = null`;
  - `handleOut = null`;
  - `kind = 'corner'`;
- semantic no-op detection;
- exact source-specific history publication;
- existing no-op status feedback;
- safe rejection of stale/missing/non-editable targets if inspection shows the current wrapper can reach them.

## Behavioral contracts to preserve

- Only Alt-click on an existing **anchor** enters this command; handles remain drag behavior.
- Existing source identity remains Shape / Vector Mask / Saved Path.
- A semantic change clears both handles and sets `kind = 'corner'`.
- Already-corner/no-handles state produces **no history entry**.
- Exact current history labels remain:
  - Saved Path: `Преобразовать узел сохранённого контура`
  - Vector Mask: `Преобразовать узел векторной маски`
  - Shape path: `Преобразовать Bézier-узел в угловой`
- Exact current no-op status remains `Bézier-узел уже угловой`.
- Do not weaken recursive lock or stale-target protections already enforced by hit/surface/gesture boundaries.
- A rejected/stale target must not mutate another document/layer/path or publish history.

## Non-scope

Do **not** move or redesign in this pass:

- target discovery/projection/hit-testing/control drawing/cursor feedback — stays `path-control-surface-controller.js`;
- anchor/handle drag update/finalize/cancel/history — stays `path-control-gesture-controller.js`;
- `penDraft`, `pen-handle`, `beginPenPoint()`, `finishPenPath()`;
- Saved Paths CRUD/panel/apply;
- Vector Mask lifecycle commands;
- PSD/PSB codecs;
- generic Pointer Events capture;
- unrelated status strings for active dragging.

Do not turn this into a generalized path command framework unless current code demonstrates another immediately shared command with the same lifecycle and invariants.

## Planned extraction

1. Inspect whether the current surface target object contains enough stable identity for a one-shot command; prefer exact live re-resolution over mutating a stale array reference when practical.
2. Define grouped narrow ports for target resolution, transaction/history and UI status.
3. Move corner-conversion mutation + no-op/history policy.
4. Keep tool dispatch and the decision to start a drag in `src/main.js`.
5. Make `beginPathControlDrag()` a thinner orchestrator: command attempt first, otherwise delegate to gesture owner.
6. Add the owner to `tools/build-bundle.mjs`.
7. Update AI routing docs so models know:
   - read-only existing controls → surface controller;
   - one-shot existing-control commands → command controller;
   - drag transaction → gesture controller;
   - new Pen paths → `main.js`.

Prefer a minimal diff.

## Targeted tests

Add direct tests for at least:

- Shape anchor conversion and exact history label;
- Vector Mask anchor conversion and exact history label;
- Saved Path anchor conversion and exact history label;
- handle target is not consumed by the corner command;
- non-Alt intent is not consumed;
- already-corner semantic no-op produces no history and exact status;
- both existing handles are cleared and `kind` becomes `corner`;
- stale/missing target rejection without mutation/history;
- recursive locked target rejection if command owns a live lock check;
- composition-root wiring and source guards proving the mutation no longer drifts into `src/main.js`.

Retarget old regex/source tests to the canonical owner instead of deleting behavioral assertions.

## Required verification

- targeted command-controller tests;
- affected surface/gesture/vector/architecture regressions;
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

The main risk is accidentally turning a one-shot command into a second target-discovery or drag owner. Reuse the canonical surface/identity policy through narrow ports, preserve exact history/no-op semantics, and avoid broad Pen refactors in this pass.

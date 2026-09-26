# 015 — Extract Layers panel/tree controller

## Goal

Move the **Layers panel tree rendering + panel-local interaction lifecycle** out of the remaining `src/main.js` composition root into a dedicated UI owner, tentatively:

`src/ui/layers-panel-controller.js`

This pass is intentionally about the **Layers tree/panel surface**, not a general rewrite of layer commands or the document model.

After task 014, `src/main.js` is still about 190k characters. The clearest next bounded cluster is `updateLayers()` (roughly 270 lines) plus the panel-local drag state/root-drop wiring around it.

## Why this is next

Current runtime still owns all of these together:

- `layerDragId` / `groupDragId`;
- `clearLayerDragDecorations()`;
- `updateLayers()` and its nested `appendLayerRow`, `appendGroupRow`, `renderLevel`;
- layer/group display ordering and recursive group presentation;
- row focus/keyboard behavior;
- row/group drag-start / drag-over / drop / drag-end behavior;
- the root `els.layers` drag target registered near startup wiring;
- thumbnail/type glyph + mask-summary hints;
- panel-local selected/locked/hidden/collapsed CSS and ARIA state.

That makes future AI/Codex work on one panel require reading distant parts of `main.js`, and it leaves drag lifecycle state in the global runtime even though no other feature needs it.

## Required owner boundary

The new controller should own:

1. Rendering the layer/group tree into the Layers panel.
2. Building the display hierarchy/order from document layers + nested groups.
3. Layer-row and group-row DOM construction.
4. Panel-local ARIA/tabindex/classes/titles for selected, effective visibility, effective lock, nesting depth and collapse state.
5. Layer/group thumbnails/type glyphs and mask-summary tooltip text currently produced during row render.
6. Panel-local keyboard routing for a focused row: Arrow Up / Arrow Down, Home / End, Enter / F2 rename, Delete.
7. Panel-local drag lifecycle: layer/group drag identity, decorations, midpoint before/after routing, drop into group, root drop and cleanup.
8. Binding/unbinding the root Layers-panel drag listeners.
9. A narrow `render()`/refresh entry point used by `updateAll()` and group-collapse callers.

Prefer controller-local drag state. `layerDragId` and `groupDragId` should disappear from `src/main.js` if no non-panel consumer truly needs them.

## Keep outside this owner

Do **not** absorb unrelated layer/domain features just because their buttons appear in the panel.

Keep these boundaries explicit:

- canonical document/layer/group schema and reusable mutation primitives: `src/core/state.js`;
- history storage / Undo / dirty/session publication: existing runtime/workspace owners;
- feature-heavy layer context-menu contents (Smart Object, Smart Filters, masks, Vector Mask, rasterize, blending): existing command owners / `src/main.js` composition for now;
- Blending Options: `src/ui/layer-blending-controller.js`;
- selection→raster mask: `src/selection/mask-controller.js`;
- selection→Vector Mask: `src/selection/vector-mask-controller.js`;
- Smart Filter behavior: `src/ui/smart-filter-controller.js`;
- Saved Paths: `src/ui/paths-controller.js`;
- global Alt+Arrow shortcuts and unrelated keyboard routing: runtime;
- generic top/context-menu mechanics: `src/ui/menu-controller.js`;
- Photoshop/PSD semantics: document/format owners.

The Layers controller may call those capabilities through narrow action ports, but must not become a second semantic owner.

## Ports / dependency direction

Prefer direct imports for stable, pure/core queries when they already have one canonical implementation.

Use grouped live ports for runtime/UI effects, for example:

- `state`: current document / selected id / exact selection publication if needed;
- `actions`: rename, delete, open Smart Object, open layer/group context menu, reorder/move-to-group/move-to-root, commit;
- `ui`: status, requestAnimationFrame/focus bridge;
- `dom`: Layers container and browser constructors only where direct DOM access would make Node tests needlessly hard.

Do not pass dozens of unrelated globals as one flat callback list. If a capability is only needed for one feature-heavy context-menu action, keep that menu outside and inject one `openLayerContextMenu(layerId,event,row)` action.

## Code-review targets during extraction

Review the current panel code rather than moving it verbatim.

At minimum check:

1. **Effective ancestor state:** nested group visibility/locking should use canonical recursive helpers, not only the immediate parent when deciding row classes/disabled actions.
2. **Drag state cleanup:** every successful/failed/cancelled drag path must clear panel decorations and local drag identity.
3. **Root drop correctness:** moving a layer/group to root must not silently mutate a locked target/source or publish history on no-op.
4. **Document identity:** callbacks captured by a rendered row must not mutate a different document if the active tab changes before the event fires. Prefer exact-document/identity validation or a render-generation guard where needed.
5. **Keyboard focus:** Home/End/Arrow navigation should keep one tabbable selected row and restore focus to the newly selected row without duplicate global routing.
6. **Nested group cycles:** controller presentation must tolerate only the canonical validated hierarchy; mutation remains responsible for rejecting self/descendant moves.
7. **Smart Object double-click:** keep the exact row/thumbnail behavior without making the panel own Smart Object lifecycle.
8. **Mask hints:** raster/vector/Smart Filter mask summaries remain display-only and must not duplicate mutation logic.

If review finds a real bug, add a regression and document the intentional fix; do not bundle unrelated cleanup.

## Tests required

Add focused direct tests for the new owner. Reuse the repository's existing lightweight fake-DOM/controller patterns rather than introducing a large DOM dependency unless truly necessary.

Cover at least:

1. root layers render top-to-bottom in the same display order;
2. nested groups render recursively with the same depth;
3. collapsed group hides descendants without deleting/changing document membership;
4. effective hidden/locked ancestor state reaches child layer/group presentation;
5. selected row gets exact selected/ARIA/tabindex contract;
6. layer visibility + lock buttons route through the intended semantic action/commit path;
7. group collapse/visibility/lock/delete route through the intended action boundary;
8. row click selects exact layer;
9. Smart Object double-click delegates exact layer identity once;
10. Arrow/Home/End focus navigation behavior;
11. Enter/F2 rename and Delete behavior;
12. layer drag before/after midpoint routing;
13. layer drop into group;
14. group drop into group;
15. layer/group root drop;
16. locked source/target does not publish a move/history action;
17. dragend/cancel cleanup removes all decorations and local identities;
18. stale-document/rendered-row callback cannot mutate a newly active document;
19. source ownership guard: `updateLayers()` leaves `src/main.js`; panel-local drag IDs leave `src/main.js` when no longer needed; feature-heavy context-menu semantics and global shortcuts remain outside;
20. build graph contains `src/ui/layers-panel-controller.js`.

Update existing layer/group contracts rather than preserving stale source-location assertions.

Relevant regressions include at least:

- `tests/layer-groups.test.mjs`;
- `tests/architecture-layout.test.mjs`;
- any layer-selection/navigation contracts touched by the wiring;
- Smart Object / mask source contracts if row rendering assertions depend on them.

## Documentation to update with the code change

Update the canonical routing docs in the same implementation PR:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

The docs should explicitly say that the Layers **panel/tree DOM + DnD lifecycle** has one owner, while layer/group schema/mutations, feature context-menu semantics and global keyboard/runtime state remain separate.

## Generated bundle

Add the new source to `tools/build-bundle.mjs` in dependency-safe order and regenerate `src/app.bundle.js` only through the canonical build graph.

Remember the bundle-flattening namespace guard: top-level private names from the new module share the classic bundle scope after import/export stripping. Avoid generic top-level helper names that can collide; prefer function-local helpers or module-specific names.

## Verification

Use this order:

1. direct new controller test;
2. `tests/layer-groups.test.mjs`;
3. relevant layer/navigation/architecture source contracts;
4. any Smart Object/mask regressions affected by row presentation;
5. full `npm run check`;
6. generated-bundle parity;
7. `npm run test:browser`;
8. `git diff --check`;
9. exact PR-head CI green;
10. guarded squash merge;
11. exact merged-main CI green.

Do not mark this task completed based only on source inspection.

## Task lifecycle

Delete this file only after the implementation PR is merged **and** the exact merged `main` SHA has green CI.

Then inspect current `main` and create exactly one next bounded task.

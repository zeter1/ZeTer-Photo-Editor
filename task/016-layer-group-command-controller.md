# 016 — Extract layer/group command controller

## Goal

Create one canonical owner for the **primitive layer/group mutation commands** that are currently duplicated across `src/main.js` global commands and the action ports wired into `src/ui/layers-panel-controller.js`.

Tentative owner:

`src/layers/command-controller.js`

This pass is about application-level layer/group commands and their history/lock/no-op rules. It is **not** a rewrite of the Layers panel, transforms, Smart Objects, masks, Smart Filters, PSD semantics or generic menu rendering.

## Why this is next

Task 015 moved Layers tree DOM + panel-local DnD lifecycle out of `src/main.js`, but the extraction intentionally left semantic mutation ports in the runtime. On current `main`, equivalent rules now exist in more than one place:

- panel ports directly toggle layer/group visibility and locks;
- global commands separately implement selected-layer visibility/lock/delete/duplicate/rename;
- group create/rename/properties/delete still live in `src/main.js`;
- reorder helpers `moveLayerRelativeToTarget()` / `moveLayerToRootTop()` remain runtime-owned even though the panel now delegates to them;
- panel DnD ports add their own commit/no-op decisions around core mutation helpers.

That duplication is already exposing a correctness risk: `toggleSelectedLock()` checks only the immediate `group.locked`, while the panel path uses canonical recursive `isGroupLocked()`. A layer nested below a locked ancestor must have one lock policy regardless of whether the command came from the panel, shortcut or menu.

The next pass should remove this policy split instead of letting future features copy it again.

## Required owner boundary

The new command controller should own the reusable command transaction for primitive layer/group actions, including where applicable:

1. Layer visibility toggle.
2. Layer lock toggle using effective recursive group lock semantics.
3. Delete selected/exact layer with pending-edit + effective-lock guard.
4. Duplicate selected/exact layer with effective-lock guard.
5. Rename exact layer, including modal submission validation and stale exact-document/layer guard if the modal can outlive the initiating context.
6. Group visibility toggle.
7. Group lock toggle with recursive ancestor lock guard.
8. Create root/subgroup using canonical core helpers and parent lock validation.
9. Rename exact group with stale-document/group guard.
10. Edit primitive group properties (opacity / blend mode) with validation and one commit transaction.
11. Delete group while preserving current core semantics for its contents.
12. Layer reorder relative to target and move-to-root command publication.
13. Layer move-into-group and group move-into-group/root command publication, including no-op/locked/cycle failure handling.
14. History/status publication only after an actual successful mutation.

Prefer exact `document + id` command inputs for callbacks that may be invoked from rendered UI. Re-resolve the live entity immediately before mutation rather than treating a captured mutable object as authority.

## Keep outside this owner

Do **not** turn the new module into a general layer feature monolith.

Keep outside:

- Layers tree DOM, row focus, thumbnails, collapse presentation and drag identity/decorations: `src/ui/layers-panel-controller.js`;
- document/layer/group schema, sanitization and reusable mutation primitives: `src/core/state.js`;
- history storage implementation / session switching / dirty-session persistence: existing runtime/workspace owners;
- geometry transforms: nudge, center, align, fit-to-canvas and pointer transform gestures remain separate for now;
- global selection navigation / Alt+Arrow and global keyboard routing: `src/main.js`;
- feature-heavy context-menu actions: Smart Object, Smart Filters, raster/vector masks, rasterize, Blending Options and related feature owners;
- generic context-menu mechanics: `src/ui/menu-controller.js`;
- Smart Object lifecycle: `src/document/smart-object-controller.js`;
- Blending Options: `src/ui/layer-blending-controller.js`;
- raster mask: `src/selection/mask-controller.js`;
- vector mask: `src/selection/vector-mask-controller.js`;
- Smart Filters: `src/ui/smart-filter-controller.js`;
- PSD/PSB import/export and Photoshop metadata: document/format owners.

`layerContextMenu()` / `groupContextMenu()` may remain in the runtime as composition lists during this pass. Their primitive entries should call the canonical command controller instead of reimplementing mutations.

## Ports / dependency direction

Prefer stable core imports for pure domain queries/mutations that already have canonical owners:

- `isLayerLocked`
- `isGroupLocked`
- `addLayerGroup`
- `removeLayerGroup`
- `moveLayerIntoGroup`
- `moveLayerGroupIntoGroup`
- `removeLayer`
- `duplicateLayer`
- other existing state primitives only when they are truly reusable domain operations.

Use grouped runtime ports only for effects that belong outside the command module, for example:

- `state`: get active document / selected layer id / exact document identity;
- `transaction`: pending-edit guard, commit/history publication, dirty/session update if commit does not already encapsulate it;
- `ui`: modal shell and status messages.

Do not inject the whole runtime or dozens of unrelated feature callbacks.

## Code-review targets

Do not mechanically move the old functions. Review the command invariants while extracting.

At minimum verify:

1. **Nested effective lock parity:** selected-layer, exact-layer and panel commands all use recursive effective lock rules; an immediate unlocked group under a locked ancestor must still block mutation.
2. **Exact owner after modal await/user delay:** rename/group-properties Apply must not mutate a document/group/layer that is no longer the initiating active target.
3. **No-op history:** same-name rename, same group properties, same reorder target, failed group move/cycle, locked source/target and missing ids publish no history.
4. **Reorder lock rules:** both source and relative target effective lock state are checked consistently.
5. **Group ancestor rules:** a group cannot toggle lock/edit/delete through a locked ancestor.
6. **Group membership:** delete-group preserves the documented existing content behavior; moving groups cannot create self/descendant cycles.
7. **Panel parity:** panel action ports should become thin calls into the command owner, not a second copy of the same policies.
8. **Global command parity:** selected-layer wrappers/shortcuts should call the same owner with current selected id.
9. **Context menus:** feature-heavy menu composition remains outside; primitive menu entries reuse command methods.
10. **Status vs history:** rejection may report status, but must not call commit.

If this review exposes a real lock/no-op bug, add a regression and document the intentional behavior fix in `CHANGELOG.md`.

## Targeted tests

Add a direct controller suite with lightweight fake state/UI ports. Cover at least:

1. exact layer visibility toggle commits once;
2. nested locked ancestor blocks layer lock toggle;
3. nested locked ancestor blocks delete/duplicate/rename;
4. successful delete/duplicate commit once;
5. same-name rename is a no-op;
6. stale document/layer rename submission publishes nothing;
7. group visibility/lock respects recursive ancestor lock;
8. subgroup creation rejects locked parent;
9. group rename same-name + stale owner are no-ops;
10. unchanged group properties publish no commit;
11. delete group preserves current member behavior;
12. relative reorder rejects locked source and locked target;
13. relative reorder no-op publishes no history;
14. layer move into group commits only after success;
15. group self/descendant/locked-target move publishes no history;
16. move layer/group to root commits only when state actually changes;
17. panel ports call the canonical owner rather than duplicate semantics;
18. selected/global wrappers call the same owner;
19. feature-heavy context-menu entries remain outside the controller;
20. architecture/source ownership guard removes the extracted primitive mutation implementations from `src/main.js`;
21. build graph includes the new module.

Update existing layer/group, navigation and architecture source-contract tests so they follow the **new canonical owner** rather than pinning old `main.js` locations.

## Documentation to update with the code change

Update in the implementation PR:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Document the split explicitly:

- Layers panel DOM/DnD owner = `src/ui/layers-panel-controller.js`;
- primitive layer/group command/history policy = new command controller;
- reusable schema/mutations = `src/core/state.js`;
- feature-heavy menu semantics remain with their dedicated owners/runtime composition.

## Generated bundle

Add the new source to `tools/build-bundle.mjs` in dependency-safe order and regenerate `src/app.bundle.js` only through `npm run build`.

Remember that the classic bundle flattens module scope: avoid generic top-level private names that can collide with other source modules.

## Verification

Use this order:

1. direct new layer/group command controller test;
2. Layers panel controller regressions;
3. `tests/layer-groups.test.mjs`;
4. navigation/source-contract tests;
5. architecture ownership test;
6. any Smart Object/mask/menu source-contract test touched only by composition rewiring;
7. full `npm run check`;
8. generated-bundle parity;
9. `npm run test:browser`;
10. `git diff --check`;
11. exact PR-head CI green;
12. guarded squash merge;
13. exact merged-main CI green.

When CI fails after source ownership moves, first classify whether the failure is a real behavior regression or a stale source-location assertion. Move stale assertions to the canonical owner; do not delete the invariant.

## Done gate

Delete this file only after the implementation is merged and the exact merged `main` SHA has green CI.

Then inspect current `main` again and create exactly one next bounded task.

## Risks / handoff notes

- Keep this pass bounded to primitive layer/group commands. Do not also extract transform gestures or Properties UI.
- Prefer one command implementation reused by panel/global/menu callers over wrappers that still duplicate validation.
- Preserve Russian user-visible status/history labels unless a regression proves a correction is needed.
- Current evidence to re-check before implementation: panel lock path uses recursive `isGroupLocked()`, while `toggleSelectedLock()` on current `main` checks only immediate `group.locked`.

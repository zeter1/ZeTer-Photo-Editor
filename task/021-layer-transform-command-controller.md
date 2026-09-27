# 021 — Extract discrete layer transform command owner

## Goal

Move the remaining synchronous selected-layer layout commands out of `src/main.js` into one narrow semantic owner so keyboard/menu routes cannot diverge on transformability, recursive locks, geometry, no-op history or status behavior.

Target owner: `src/layers/transform-command-controller.js`.

This is a bounded ownership extraction, not a redesign of pointer Move/Resize/Rotate gestures or generic Properties live-preview policy.

## Current evidence on merged `main`

`src/main.js` still directly owns and mutates persisted layer geometry in:

- `nudgeSelected(dx,dy)` → direct `x/y` mutation + `commit('Сдвинуть слой')`;
- `centerSelectedLayer()` → frame-center math + direct `x/y` mutation + commit;
- `alignSelectedLayer(mode)` → alignment policy + direct `x/y` mutation + history/status;
- `fitSelectedLayerToCanvas()` → frame bounds, scale + recenter mutation + commit.

These commands overlap the same persisted transform domain already guarded elsewhere, but currently duplicate exact-target/lock/no-op/history policy in the composition root. In particular, center/fit can publish history even when the canonical resulting transform is unchanged, and nudge has no semantic zero-delta guard.

## Bounded scope

Move only the four discrete layout commands above.

The controller should own:

1. exact active-document validation;
2. stable layer-ID re-resolution at command time;
3. recursive effective-lock rejection through the canonical core query;
4. transformable-layer validation (Adjustment layers stay rejected exactly as today);
5. finite nudge delta validation;
6. alignment-mode allow-listing;
7. center/align/fit geometry calculation using the existing canonical geometry helpers rather than duplicating frame math;
8. semantic no-op suppression before persisted mutation/history;
9. exactly one history publication for a real mutation;
10. expressive result values so UI can distinguish invalid/rejected/no-op/committed without inventing fake error states.

Suggested public surface:

- `nudge(owner, layerId, dx, dy)`;
- `center(owner, layerId)`;
- `align(owner, layerId, mode)`;
- `fitToCanvas(owner, layerId)`.

The composition root may keep tiny selected-layer wrappers that resolve the current selected ID and map result/status text, but those wrappers must not mutate `x/y/scaleX/scaleY` directly.

## Preserve behavior

Keep the existing history labels for real changes:

- `Сдвинуть слой`;
- `Центрировать слой`;
- `Вписать слой в холст`;
- `Выровнять слой <режим>`.

Keep current user-facing alignment status text and current transformability rules.

Use the existing geometry helpers (`layerFrame`, `frameBounds`, `alignLayerToCanvas` or their canonical public equivalents). Do not create a second geometry implementation inside the controller.

## Non-scope

Do **not** in this pass:

- move pointer Move/Resize/Rotate gesture lifecycle;
- move Properties range/live-preview transaction logic;
- change layer schema;
- redesign alignment UI/menu structure;
- change canvas/document resize or crop commands;
- refactor unrelated `markDirty`/history calls;
- move Smart Object, Adjustment Layer, Blending or Text feature logic.

## Regression tests

Add a direct controller test file and architecture/source guards. Cover at least:

1. real nudge mutates once and commits once;
2. zero nudge is a no-op with zero history;
3. center real change once;
4. already-centered layer is a no-op;
5. each supported alignment mode reaches the canonical geometry result;
6. already-aligned target is a no-op;
7. fit-to-canvas real change once;
8. already-fitted-and-centered canonical target is a no-op;
9. invalid/non-finite deltas are rejected without mutation;
10. invalid alignment mode is rejected;
11. own layer lock blocks all four command families;
12. locked ancestor group blocks all four command families;
13. Adjustment/non-transformable layer is rejected;
14. stale originating document publishes nothing;
15. missing target ID publishes nothing;
16. rotated/scaled layer uses canonical frame/bounds math, not axis-aligned shortcuts;
17. `src/main.js` contains no direct `x/y/scaleX/scaleY` mutation inside these discrete command wrappers;
18. build graph includes the owner and architecture docs point to the same canonical boundary.

Prefer behavior assertions over source-location assertions. Source-contract tests should only pin canonical ownership/wiring.

## Documentation

Update only material routing/architecture/test docs if the ownership boundary changes:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md` for the code change.

Keep documentation progressive: route AI quickly to the new owner without repeating implementation details in every file.

## Build and verification

Because `src/app.bundle.js` is generated, add the controller to `tools/build-bundle.mjs` in dependency-safe order and regenerate only through the canonical build.

Proof ladder:

1. direct transform-controller tests;
2. relevant layer/property/geometry regressions;
3. architecture/source guards;
4. full `npm run check`;
5. generated-artifact parity;
6. Chromium `file://` smoke;
7. diff hygiene;
8. exact PR-head CI;
9. guarded squash merge by reviewed head SHA;
10. exact merged-main CI.

If CI exposes a stale source-location oracle after the extraction, migrate the oracle to the new canonical owner while preserving the underlying behavioral invariant; do not reintroduce duplicate runtime code just to satisfy a regex.

## Completion rule

Delete this task file only after the implementation is merged and the exact merged `main` CI is green. Then inspect the live repository and create exactly one next bounded task.

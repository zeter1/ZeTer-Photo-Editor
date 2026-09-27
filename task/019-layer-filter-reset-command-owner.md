# 019 — Close remaining Layer Filter reset bypasses

## Goal

Finish the **already-established Layer Property command ownership** by removing the two remaining direct `layer.filters` mutations from the Image menu in `src/main.js`:

- `Сбросить цветокоррекцию`
- `Сбросить все фильтры слоя`

Do this by extending/reusing `src/layers/property-command-controller.js`, not by creating another competing controller.

This is intentionally a small cleanup/correctness pass before the larger remaining Adjustment Layer seam.

## Why now / current evidence

Task 018 is complete on `main` at merge SHA `347d57cf9b5bf7272a78e027890fe9748f6b26d9` with green merged-main CI.

A fresh post-merge review found that the canonical property owner already contains:

- exact active-document + layer-id re-resolution;
- recursive effective-lock checks;
- no-op-aware filter live preview;
- `resetEffects(owner, layerId)`;
- `resetSelectedEffects()`;
- effect-key selection through the injected `effects.filterKeysForLayer` port.

However current `src/main.js` still bypasses that owner in the Image menu:

1. `Сбросить цветокоррекцию` sanitizes `l.filters`, directly overwrites `COLOR_CORRECTION_KEYS`, then always calls `commit('Сбросить цветокоррекцию')`.
2. `Сбросить все фильтры слоя` directly assigns `{...DEFAULT_LAYER_FILTERS}` and always calls `commit('Сбросить фильтры')`.

Consequences confirmed from source inspection:

- the composition root still owns semantic filter writes even though docs say the property controller is canonical;
- an already-default reset can create a synthetic Undo/history entry;
- reset semantics are duplicated and can drift from canonical sanitization/lock/no-op policy;
- `COLOR_CORRECTION_KEYS` remains imported into `main.js` only for the bypass.

Current live source has priority over this plan. Re-run INSPECT → DIAGNOSE before changing code.

## Scope

Extend the existing property command owner with a narrow reset primitive/policy and route both Image-menu actions through it.

Preserve the two distinct user intents:

1. **Reset Color Correction**
   - raster layer only, matching the current menu availability;
   - reset only the canonical Color Correction keys;
   - preserve non-color effects such as Blur;
   - exact history label remains `Сбросить цветокоррекцию` unless a verified behavior correction requires a documented change.

2. **Reset all layer filters**
   - preserve the current menu availability/compatible layer types;
   - reset the complete persisted filter state to canonical defaults;
   - exact history label remains `Сбросить фильтры` unless a verified behavior correction requires a documented change.

For both commands:

- resolve the exact active document + stable selected layer ID at command time;
- re-check effective recursive lock;
- sanitize current filter state once before comparison/publication;
- publish **zero** history for an already-default/no-op reset;
- publish exactly one commit for a real reset;
- do not create transient/live-preview history for these discrete menu commands;
- clear or avoid any stale filter preview baseline that could incorrectly influence a later final `change` event.

Prefer one shared internal `resetFilters` helper inside `property-command-controller.js` plus narrow public wrappers if that keeps policy clearer than duplicated methods.

Keep configuration dependencies explicit. Do **not** make `src/layers/` depend on `src/ui/tool-config.js` merely to obtain `COLOR_CORRECTION_KEYS`. If the controller needs the key set, pass it through the existing narrow `effects` port (or use an equally clean core-owned contract discovered during inspection).

## Non-scope

Do **not** combine this pass with:

- Adjustment Layer parameter/Curves/Levels/clipping ownership;
- extraction of the 100+ line `updateProperties()` renderer;
- Color Correction modal transaction changes already owned by `src/ui/color-correction-controller.js`;
- Smart Filter stack/mask UI;
- Layer Blending Options / Styles;
- transform/pointer gestures;
- PSD/PSB codec or native-adjustment metadata rewrites;
- changing filter algorithms or visible rendering output.

If inspection reveals an unrelated bug, record it for the next handoff after this task is complete rather than widening this pass.

## Inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. this task
4. current `src/main.js` around:
   - `createLayerPropertyCommandController(... effects ...)`
   - Image menu filter reset commands
   - `bindPropertyInputs`
5. `src/layers/property-command-controller.js`
6. `src/ui/tool-config.js` for `COLOR_CORRECTION_KEYS`, `BASIC_EFFECT_CONTROLS`, `RASTER_EFFECT_CONTROLS`
7. `src/core/state.js` for `DEFAULT_LAYER_FILTERS` / `sanitizeFilters`
8. `tests/layer-property-command-controller.test.mjs`
9. source/architecture tests that pin property ownership
10. `tools/build-bundle.mjs` and current Actions workflow before writes

## Behavioral contracts to preserve

1. **Exact owner:** a command may mutate only the currently active originating document.
2. **Exact target:** selected layer ID is re-resolved; missing target means no mutation/history.
3. **Effective lock:** own/group/ancestor lock blocks reset.
4. **No-op history:** already-default reset creates zero commits and zero synthetic dirty state.
5. **Color-only reset:** preserve Blur and every filter not in the canonical Color Correction key set.
6. **Full reset:** every persisted filter key ends at its canonical `DEFAULT_LAYER_FILTERS` value.
7. **Sanitization:** malformed/out-of-range persisted filter input is normalized through the canonical sanitizer before reset comparison/publication.
8. **History labels:** preserve current Russian labels for real changes.
9. **Menu parity:** existing enable/disable behavior remains unless a concrete source/test proves it incorrect.
10. **Preview hygiene:** a menu reset must not leave an old range-preview baseline capable of producing a duplicate or misleading later commit.

## Targeted tests

Extend the direct property-controller suite. Cover at least:

1. Color Correction reset changes one color key and commits once.
2. Color Correction reset preserves non-color Blur.
3. Color Correction reset when already default returns false / commits zero.
4. Full filter reset changes color + Blur and commits once.
5. Full reset when already default commits zero.
6. Missing/stale document publishes nothing.
7. Missing layer publishes nothing.
8. Effective ancestor lock blocks both reset variants.
9. Malformed/out-of-range filter payload is sanitized deterministically before publication.
10. Menu/source contract proves `main.js` delegates both reset actions to the controller and contains no direct `.filters =` reset for those commands.
11. If baseline state is relevant, regression proves reset + later range `change` cannot create duplicate history from a stale preview baseline.
12. Architecture/build guard remains green; retarget source-location assertions rather than weakening them.

## Documentation / AI navigation

Because this is a completion of an existing boundary rather than a new subsystem, update only docs that become materially more precise:

- `AGENTS.md` if the route currently implies a weaker/stronger ownership contract;
- `docs/architecture/BOUNDARIES.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/testing/TEST_MATRIX.md` if the reset regressions add a new explicit oracle;
- `CHANGELOG.md` (mandatory for source changes).

Avoid documentation churn that merely repeats existing text.

## Generated bundle

No new module is expected. Regenerate browser artifacts through the canonical build after source changes and verify parity.

Do not hand-edit `src/app.bundle.js`.

## Verification

Use this order:

1. targeted `tests/layer-property-command-controller.test.mjs`;
2. relevant color/effects/filter regressions;
3. architecture/source-contract tests;
4. full `npm run check`;
5. generated bundle parity;
6. `npm run test:browser`;
7. `git diff --check`;
8. exact PR-head CI;
9. guarded squash merge using the exact reviewed head SHA;
10. exact merged-main CI.

If a check fails, classify product regression vs stale source-location oracle vs generated-artifact/build-graph error before changing anything.

## Done gate

Delete this file only after:

- implementation is merged;
- exact merged `main` SHA is verified;
- merged-main CI is green.

Then inspect live `main` and create exactly one next bounded task.

## Risks / handoff notes

- There is already a tested `resetEffects` implementation. Prefer extending/generalizing it over adding parallel reset logic.
- Do not silently broaden `resetEffects` semantics: Color Correction reset must preserve Blur, while full reset must not.
- The current direct menu callbacks call `selected()` at invocation time, so this task is primarily an ownership/no-op-history correctness cleanup, not an asserted stale-callback bug.
- A separate fresh scan found a likely next seam around Adjustment Layer parameter/Curves/clipping callbacks that capture `layer` while consulting global `doc`. Do not fold that into this pass; reassess it from live `main` after task 019 is complete.

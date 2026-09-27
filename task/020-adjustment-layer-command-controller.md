# 020 — Extract Adjustment Layer command transaction owner

## Goal

Move the **persistent Adjustment Layer mutation/history policy** out of `src/main.js` into one narrow canonical command owner, tentatively:

`src/layers/adjustment-command-controller.js`

This pass is deliberately limited to the commands behind the existing Adjustment Layer Properties controls:

- scalar/Levels parameter edits;
- Curves channel point edits;
- clipping toggle.

Keep the current Properties markup/rendering in `src/main.js`. This is a command-boundary extraction and correctness pass, not a redesign of Adjustment Layer UI or Photoshop metadata.

## Why now / current evidence

Task 019 is complete on merged `main` at `7c35d4c4c45a4cffbae7ff9e3121b82f1504ceee`. Exact merged-main CI run `36297550340` is green for:

- `npm run check`;
- generated browser artifact parity;
- Chromium `file://` smoke;
- `git diff --check`.

A fresh post-merge scan of live `src/main.js` found the next bounded semantic seam around lines ~2376–2440:

1. `updateAdjustmentProperty(layer, path, raw)` captures a mutable layer object but checks lock state against global `doc`, mutates `layer.adjustment`, then publishes through global history.
2. `updateAdjustmentCurveChannel(layer, id, raw)` has the same captured-layer/global-document split.
3. `bindAdjustmentControls(root, layer)` captures the layer object in DOM callbacks; the clipping callback also checks global `doc` before mutating the captured layer.
4. All three real-write paths can publish history without an exact originating-document + stable-layer-ID re-resolution at callback time.
5. Scalar and Curves paths always call `markDirty(true); commit(...)` after a valid parse even if the sanitized Adjustment model is semantically unchanged.
6. The clipping path always calls `markDirty(true); commit(...)` after its callback.
7. Global `commit()` already calls `markDirty(true)`, so the current Adjustment paths increment `documentChangeSerial` twice for one publication.
8. `adjustmentModelEqual` is already imported from `src/core/adjustments.js` but currently unused in `src/main.js`, which is a strong hint that no-op comparison belongs at this seam.

The current live source, tests and generated artifacts have priority over this task text. Re-run INSPECT → DIAGNOSE before writing.

## Scope

Create one command controller for Adjustment Layer persisted mutations and route the existing Properties controls through it.

The controller should own:

1. exact active-document validation;
2. stable layer-ID re-resolution at command time;
3. Adjustment Layer type validation;
4. recursive effective-lock rejection through the canonical core lock query;
5. scalar/Levels path validation and canonical model sanitization;
6. Curves text parsing/validation and channel replacement;
7. clipping boolean mutation;
8. semantic no-op suppression;
9. exactly one history publication for one real command;
10. invalid/stale/missing/locked paths with zero mutation and zero history.

Prefer direct imports from stable core/domain modules for:

- `sanitizeAdjustmentModel`;
- `adjustmentModelEqual`;
- canonical effective-lock query.

Receive only narrow runtime ports such as:

- `state.getDocument()`;
- `transaction.commit(label)`;
- minimal status/refresh callbacks if the controller must own invalid-input feedback.

Do not inject the whole runtime.

## Binding contract

Change Adjustment control binding so callbacks capture:

- originating document;
- stable layer ID;

rather than a mutable layer object as authority.

A likely shape is:

`bindAdjustmentControls(root, owner, layerId)`

The controller must re-resolve the layer by ID and prove `state.getDocument() === owner` before a persisted write.

If UI refresh/status behavior is kept in the binding layer, make the command result expressive enough to distinguish:

- invalid input;
- stale/missing/locked target;
- semantic no-op;
- real committed change.

Do not show an “invalid parameter” message for a valid same-value no-op.

## Behavioral contracts to preserve / improve

1. **Exact owner:** a callback rendered for document A cannot mutate A while committing into newly active document B.
2. **Exact target:** deleted/replaced target IDs publish nothing.
3. **Effective lock:** own/group/ancestor lock blocks scalar, Curves and clipping edits.
4. **One command = one publication:** remove the pre-`commit()` `markDirty(true)` duplication; the transaction owner must not increment dirty/change serial separately when `commit()` already does it.
5. **No-op history:** a scalar edit that sanitizes to the existing model creates zero history.
6. **Curves no-op:** text describing the same canonical channel points creates zero history.
7. **Clipping no-op:** assigning the existing clipping value creates zero history.
8. **Validation:** invalid numeric/Levels paths and invalid Curves input leave persisted state unchanged.
9. **Canonicalization:** successful Adjustment mutations end with `sanitizeAdjustmentModel(...)`.
10. **History labels:** preserve current labels unless a tested behavior correction requires a documented change:
   - `Изменить Photoshop adjustment`;
   - `Изменить точки Photoshop Curves`;
   - `Изменить clipping adjustment layer`.
11. **PSD metadata compatibility:** do not silently discard `psdAdjustment` or change native-export eligibility semantics.
12. **UI parity:** keep existing Properties markup, field ranges, labels and enabled/disabled behavior unless a concrete source/test proves them wrong.

## Curves validation

The existing `parseCurvePointsInput` policy is semantic command validation and should move with the command owner (or into a clearly reusable core/domain helper if inspection proves that is the better boundary).

Preserve the current contract unless tests expose a bug:

- 2–19 points;
- `input:output` tokens separated by comma/semicolon;
- integer values 0..255;
- sort by input;
- strictly increasing input coordinates;
- rejected malformed tokens create no mutation/history.

Do not move display formatting such as `curvePointsInputValue()` merely to reduce line count; formatting belongs with markup unless it becomes independently reusable.

## Non-scope

Do **not** combine this pass with:

- extracting `adjustmentPropertiesMarkup()` or the whole `updateProperties()` renderer;
- redesigning Levels/Curves controls;
- adding live-preview `input` transactions;
- changing Adjustment rendering math in `src/core/adjustments.js` / `src/core/render.js`;
- changing PSD/PSB native Adjustment metadata parsing or rewrite planning;
- changing clipping render semantics;
- Color Correction, Smart Filter or Layer Blending owners;
- broad cleanup of every remaining `markDirty(true); commit(...)` pair elsewhere in the app.

If another independent bug is found, record it for the next bounded task rather than widening this pass.

## Inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `task/README.md`
4. this task
5. current `src/main.js` around:
   - Adjustment branch in `updateProperties()`;
   - `adjustmentPropertiesMarkup`;
   - `updateAdjustmentProperty`;
   - `parseCurvePointsInput`;
   - `updateAdjustmentCurveChannel`;
   - `bindAdjustmentControls`;
   - global `commit()` / `markDirty()`
6. `src/core/adjustments.js`
7. `src/core/state.js` lock query and Adjustment layer shape
8. `tests/adjustments.test.mjs`
9. `tests/psd-adjustment-layer.test.mjs`
10. `tests/architecture-layout.test.mjs`
11. current source-contract tests that reference Adjustment controls
12. `tools/build-bundle.mjs`
13. current `.github/workflows/ci.yml` before any writes

## Targeted tests

Add a direct controller suite, tentatively `tests/adjustment-command-controller.test.mjs`, covering at least:

1. real scalar property change commits exactly once;
2. same scalar value / sanitized semantic no-op commits zero;
3. Levels channel update creates a missing canonical channel when valid;
4. invalid numeric value/path leaves state/history unchanged;
5. real Curves edit commits exactly once;
6. same canonical Curves points commit zero;
7. invalid Curves syntax/range/order publishes nothing;
8. clipping real change commits once;
9. clipping same value commits zero;
10. own lock blocks all three command families;
11. ancestor/group lock blocks all three command families;
12. stale document callback publishes nothing;
13. missing/replaced layer publishes nothing;
14. mutation preserves unrelated Adjustment fields and `psdAdjustment`;
15. binding/source contract proves `src/main.js` passes owner + layer ID rather than captured-layer authority;
16. source guard proves Adjustment command paths no longer call `markDirty(true)` before `commit()`;
17. architecture/build graph pins the new owner.

Retarget stale source-location tests to the new owner rather than weakening their behavioral invariant.

## Documentation / AI navigation

Update only material routing docs:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md` (mandatory for source changes).

Document the boundary explicitly:

- Adjustment Properties markup/rendering = `src/main.js`;
- persisted Adjustment command/validation/history policy = new controller;
- Adjustment model sanitization/equality/math = core;
- Photoshop-native metadata eligibility/rewrite = document/PSD modules.

## Generated bundle

Add the new source to `tools/build-bundle.mjs` in dependency-safe order and regenerate browser artifacts through the canonical build.

Do not hand-edit `src/app.bundle.js`.

Direct ESM controller tests remain mandatory because the flattened `file://` bundle can hide missing module dependencies.

## Verification

Use this order:

1. direct Adjustment command-controller tests;
2. `tests/adjustments.test.mjs`;
3. `tests/psd-adjustment-layer.test.mjs`;
4. architecture/source-contract tests;
5. full `npm run check`;
6. generated artifact parity;
7. `npm run test:browser`;
8. `git diff --check`;
9. exact PR-head CI;
10. guarded squash merge using the exact reviewed head SHA;
11. exact merged-main push CI.

Classify any failure before changing code: product regression vs stale source oracle vs build graph/generated artifact vs browser integration.

## Done gate

Delete this file only after:

- implementation is merged;
- exact merged `main` SHA is verified;
- merged-main CI is green.

Then inspect live `main` and create exactly one next bounded task.

## Risks / handoff notes

- The stale-state issue is caused by **captured layer object + global mutable document/history authority**, not by Adjustment math itself.
- Do not fix the double-change-serial issue by suppressing `markDirty` globally; remove duplicate publication at this command boundary.
- Use `adjustmentModelEqual` (or an equally canonical semantic equality discovered during inspection) rather than JSON string comparisons.
- Do not create history merely because sanitization allocated a fresh object.
- Keep this pass small: one semantic command owner + bindings + tests/docs/build verification.

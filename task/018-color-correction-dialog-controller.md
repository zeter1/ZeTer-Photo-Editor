# 018 — Extract Color Correction dialog transaction owner

## Goal

Move the custom **Color Correction** modal transaction out of the remaining `src/main.js` composition root into one narrow canonical UI owner, tentatively:

`src/ui/color-correction-controller.js`

This pass is about the modal lifecycle and its live filter preview transaction. It is **not** a general Properties renderer extraction and is not a rewrite of the filter/render pipeline.

## Why now / current evidence

Task 017 is complete on merged `main` (`9a5fc1a335295d1d687533597412cca11b306e83`) with green merged-main CI. Generic Layer Properties writes now have exact document/layer ownership, effective-lock checks, no-op suppression and live-preview baselines in `src/layers/property-command-controller.js`.

A fresh post-merge scan shows `openColorCorrectionDialog()` still owns a second, older filter transaction directly inside `src/main.js`:

- it captures only `layerId`, then later resolves `doc.layers.find(...)` against whatever document is active at callback time;
- live range callbacks mutate that resolved layer directly and call `render()`;
- Cancel/Escape restore filters through the current global `doc`, not the originating document;
- Apply computes change state and calls the global `commit()` without re-checking exact originating document or effective lock;
- lock state is checked only when opening the dialog;
- modal DOM/focus/cleanup behavior is custom and separate from the newer exact-owner transaction patterns.

That is a real stale-state boundary risk: a tab switch, target removal/replacement or lock change while the modal remains open must not mutate/restore/commit through the wrong active session.

Current live source, tests and CI have priority over this plan. Re-run INSPECT → DIAGNOSE before writing.

## Scope

Create one controller responsible for the Color Correction modal transaction:

1. exact originating document + layer-ID ownership for the entire modal lifetime;
2. raster-layer/effective-lock validation at open;
3. private original filter snapshot and controller-owned live preview state;
4. bounded normalization for every `COLOR_CORRECTION_CONTROLS` range;
5. live preview without history;
6. Reset-to-default preview;
7. Apply with exact owner/entity + current lock revalidation;
8. no-op Apply with zero history;
9. Cancel/Escape/backdrop/close rollback to the exact originating layer when it still exists;
10. stale document/layer/lock finalization that restores originating transient state when safe but publishes no history into another session;
11. idempotent cleanup and focus restoration;
12. one canonical status/toast path for rejected or cancelled publication.

Prefer importing stable filter constants/sanitizers directly from core/config and receiving live effects through narrow ports:
- `state.getDocument()`;
- `transaction.commit`, optional transient-change marker;
- `render.render`, inspector refresh;
- `ui.modalRoot`, document/HTMLElement/Event classes, status/toast/focus helpers.

Do not inject the whole runtime.

## Reuse / integration with task 017 owner

Inspect whether the modal should call `src/layers/property-command-controller.js` for final generic publication or keep its own modal transaction and only share core filter normalization. Avoid forcing reuse if it would break Cancel rollback semantics.

The important invariant is one semantic source for filter ranges/default sanitization and exact-owner publication. Do not create another incompatible clamp/history policy.

## Non-scope

Do **not** combine this pass with:

- full `updateProperties()` DOM extraction;
- generic Layer Properties owner changes unrelated to Color Correction;
- Smart Filter add/edit modal;
- Layer Blending Options;
- Adjustment Layer parameter controls;
- CMYK/ICC color-management controller;
- pixel filter/compositor implementation in `src/core/render.js`;
- transform pointer gestures;
- PSD/PSB metadata work;
- broad modal-shell redesign unless a tiny generic lifecycle hook is strictly required.

## Inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `task/README.md`
4. this task
5. current `src/main.js` around:
   - `openColorCorrectionDialog`
   - `formatFilterValue`
   - menu/button wiring that opens the dialog
   - `refreshInspectorPanels`
6. `src/layers/property-command-controller.js`
7. `src/ui/modal-controller.js`
8. `src/ui/tool-config.js` filter control metadata
9. `src/core/state.js` filter defaults/ranges/sanitizer + lock query
10. relevant filter/color-correction/source-contract tests
11. `tools/build-bundle.mjs` and current Actions workflow before writes

## Behavioral contracts

Preserve or improve:

1. **Exact owner:** modal callbacks never use the newly active tab as authority.
2. **Exact target:** deleted/missing target becomes a no-op; no other layer is mutated by coincidence.
3. **Effective lock:** lock/group-lock changes after modal open block Apply.
4. **Live preview:** range movement updates canvas with zero history.
5. **Cancel rollback:** Cancel/Escape restores the original exact layer filter values and publishes no history.
6. **Reset:** reset updates the draft/preview to canonical defaults but is not itself a history commit.
7. **No-op Apply:** unchanged values create zero history entries.
8. **Real Apply:** one commit maximum.
9. **Stale finalization:** tab switch or stale target publishes neither dirty/history nor status implying success in the new document.
10. **Cleanup:** modal listeners/transient references/focus cleanup are idempotent.
11. **Normalization:** every control uses canonical ranges/defaults; invalid numeric state does not leak NaN.
12. **Specialized ownership:** renderer/filter math remains core; the new UI owner owns transaction/lifecycle only.

## Targeted tests

Add a direct controller suite covering at least:

1. rejects non-raster target;
2. rejects initially locked target;
3. live input clamps and renders without commit;
4. repeated same preview is a no-op where practical;
5. Reset previews defaults without commit;
6. real Apply commits exactly once;
7. unchanged Apply commits zero;
8. Cancel restores original filters;
9. Escape follows the same rollback path;
10. document switch before preview/finalization cannot mutate the new document;
11. missing target before Apply publishes nothing;
12. lock-after-preview blocks Apply and does not publish history;
13. stale close restores originating preview state when target still exists;
14. focus/cleanup runs once;
15. source-contract test proves `src/main.js` only constructs/invokes the controller;
16. architecture guard + build graph pin the owner.

Retarget stale source-location tests rather than weakening their behavioral invariant.

## Documentation / AI navigation

Update as needed:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md`

Document the split:
- Color Correction modal lifecycle/preview transaction = new controller;
- generic Properties mutation policy = `src/layers/property-command-controller.js`;
- filter schema/ranges/sanitization = core;
- pixel application = render;
- composition/menu wiring only = `src/main.js`.

## Generated bundle

Add the new source to `tools/build-bundle.mjs` in dependency-safe order and regenerate browser artifacts through the canonical build.

The flattened `file://` bundle can hide missing ESM dependencies, so direct module tests remain mandatory.

## Verification

Use this order:

1. direct Color Correction controller tests;
2. existing filter/render/property regressions;
3. architecture/source-contract tests;
4. full `npm run check`;
5. generated artifact parity;
6. `npm run test:browser`;
7. `git diff --check`;
8. exact PR-head CI;
9. guarded squash merge with expected head SHA;
10. exact merged-main push CI.

If CI fails after extraction, classify first: real behavior regression vs stale source-location oracle vs module/build graph error.

## Done gate

Delete this file only after implementation is merged and the exact merged `main` SHA has green CI.

Then inspect live `main` and create exactly one next bounded task.

## Risks / handoff notes

- Do not let a modal controller keep a captured mutable layer object as authority; use originating document + stable layer ID and re-resolve.
- Rollback and publication are different concerns: an inactive originating layer may still need its transient preview restored even though nothing should render/commit into the active document.
- A generic property controller is not automatically the right owner for modal draft state. Keep responsibilities explicit rather than creating hidden cross-controller mutable state.
- Do not “fix” stale behavior with catch/suppression or by disabling history checks.
- Keep this pass small: one modal transaction owner + tests/docs/build verification.

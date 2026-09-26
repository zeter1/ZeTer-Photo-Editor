# Task 007 — Smart Object content lifecycle seam

## Goal

Убрать следующий cohesive orchestration-block из большого `src/main.js`: lifecycle ZPE Smart Object content-tab (convert/open/save/link/unlink) так, чтобы AI искал session/content rules в одном каноническом owner, а Photoshop binary/resource rewrite и PSD import/export boundaries не смешивались с generic Smart Object orchestration.

## Why now

После extraction PSD import transaction, import semantics и native export metadata plans в `main.js` всё ещё остаётся плотный Smart Object block примерно вокруг функций:

- `photoshopSmartObjectLayers()`
- `smartObjectLinkedCount()`
- `createLinkedSmartObjectCopy()`
- `unlinkSmartObject()`
- `smartObjectSessionDepth()`
- `smartObjectSourceBounds()`
- `smartObjectPreviewDataUrl()`
- `serializePhotoshopEmbeddedAsset()`
- `rewritePhotoshopEmbeddedSource()`
- `convertSelectedToSmartObject()`
- `openSmartObjectContents()`
- `saveSmartObjectContent()`

Не переносить их механически одной пачкой: сначала разделить generic Smart Object lifecycle и Photoshop-specific resource rewrite.

## Inspect first

- `src/main.js` — bounded Smart Object block и все call-sites;
- `src/core/state.js` — Smart Object/document/session invariants;
- `src/document/psd-export-controller.js`;
- `src/document/psd-native-metadata-plans.js`;
- `src/document/psd-import-semantics.js`;
- `src/formats/psd.js` — только public embedded-resource rewrite/encode contracts;
- Smart Object / async document-context / PSD compatibility tests;
- `docs/architecture/CODEMAP.md`, `BOUNDARIES.md`, `TEST_MATRIX.md`.

## Scope

1. Classify functions as:
   - generic Smart Object content/session orchestration;
   - shared runtime helper;
   - Photoshop-specific serialization/resource rewrite.
2. Extract **only one cohesive lifecycle owner**, preferably `src/document/smart-object-controller.js` (choose another name only if current dependencies prove a clearer boundary).
3. Keep stable core/domain dependencies direct.
4. Keep browser rendering, document/session mutation, history/dirty/recovery publication and Photoshop-specific rewrite as explicit narrow ports where they remain external responsibilities.
5. Preserve generic Smart Object behavior independently from Photoshop-native resource round-trip.
6. Add direct public-API regression tests plus one architecture ownership guard.
7. Update AI routing docs, source contract tests, test matrix, changelog and deterministic bundle.

## Preserve exactly

- max nested Smart Object session depth and user-visible failure behavior;
- source bounds, preview generation and layer identity;
- linked-copy vs unlink semantics;
- content-tab open/save ownership and stale-session/document guards;
- history/dirty/recovery behavior on successful save;
- Photoshop embedded asset rewrite only when existing eligibility/baseline rules allow it;
- honest raster/native fallback messages;
- existing linked/embedded source UUID/resource identity.

## Non-scope

- PSD/PSB binary codec rewrite;
- new Smart Object features or filter semantics;
- PSD import semantics;
- PSD native export metadata planning;
- broad layer-panel or workspace-session refactor;
- changing user-visible Smart Object behavior unless a verified bug is found and covered by a regression test.

## Verification

Targeted Smart Object + async-context + PSD compatibility tests → `npm run check` → `npm run test:browser` → exact-head PR CI → squash merge with expected-head guard → exact main push CI.

## Review questions

- Does the new owner avoid depending on an export-only/import-only module for shared runtime behavior?
- Did any optional/default/catch/fallback semantics drift during extraction?
- Can direct tests prove save/open/link/unlink behavior without loading the whole app runtime?
- Are Photoshop resource rewrite details still behind a narrow boundary rather than becoming generic controller policy?
- Does `src/main.js` become wiring/dispatch rather than a second Smart Object owner?

## Done gate

Delete this task only after the merged `main` SHA is green. If Photoshop embedded-resource serialization remains a separate meaningful seam, create the next single task for it instead of expanding this pass.

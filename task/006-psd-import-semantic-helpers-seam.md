# Task 006 — PSD import semantic helpers seam

## Goal

После extraction `src/document/psd-import-controller.js` убрать оставшуюся необходимость искать PSD import semantics в большом `src/main.js`: вынести **только import-specific Photoshop mapping helpers** за узкую каноническую границу.

## Why now / evidence

Task 004 вынес transaction owner и оставил явный `semantics` port. Это правильный bounded промежуточный state, но часть import mapping всё ещё определяется helper-функциями в runtime, поэтому AI/Codex для Text/Shape/Adjustment/Smart Object import может снова открывать большой `main.js`.

## Inspect first

1. `src/document/psd-import-controller.js`
2. только helpers, реально переданные в его `semantics` port:
   - `importPsdAdjustmentMetadata`
   - `importPsdVectorMask`
   - `canMapPsdSolidShape`
   - `importPsdEmbeddedAssetDocument`
   - `importPsdShapeMetadata`
   - `importPsdTextMetadata`
   - `importPsdSmartObjectMetadata`
   - `psdOpaqueBlockToState`
3. usage count каждого helper — не переносить shared runtime/vector helpers вслепую
4. relevant PSD fixture tests

## Scope

- классифицировать helpers: import-only vs shared;
- вынести только cohesive import-only semantics в `src/document/psd-import-semantics.js` или другой узкий owner;
- shared helpers оставить в их текущем каноническом месте либо выделить только если есть ясная отдельная boundary;
- сократить `semantics` port import-controller без скрытого global coupling;
- добавить direct regressions для supported/unsupported mapping decisions;
- обновить source contracts, architecture guard, AI maps, test matrix, changelog и bundle.

## Preserve exactly

- TySh/EngineData import eligibility и typography mapping;
- solid Shape path/fill/stroke/vector-mask import;
- adjustment semantic model, mask/clipping/native metadata;
- Smart Object embedded/linked/opaque metadata и editable nested asset behavior;
- vector-mask flags/geometry;
- bounded opaque metadata sizes и fallback warnings.

## Non-scope

- export native metadata plans (Task 005);
- PSD/PSB binary codec;
- новые Photoshop features;
- document transaction/publish logic, уже принадлежащий `psd-import-controller`.

## Verification

Targeted import semantics tests → `npm run check` → `npm run test:browser` → exact-head PR CI → merge → exact main CI.

## Done gate

Удалить task только после merge + green main CI.

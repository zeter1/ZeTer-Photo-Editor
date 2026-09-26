# Task 005 — Photoshop native metadata plan seam

## Goal

После import-mapping проходки собрать **только export semantic planning** Photoshop-native Text / Shape / Adjustment / Smart Object metadata в отдельный owner, чтобы `src/main.js` перестал быть местом поиска PSD export compatibility rules.

## Dependency

Начинать после Task 004 либо раньше только если текущее состояние кода явно показывает, что import mapping не пересекается с этим seam.

## Inspect first

- `src/document/psd-export-controller.js`
- bounded ranges вокруг:
  - `psdTextNativePlan()`
  - `psdShapeNativePlan()`
  - `psdAdjustmentNativePlan()`
  - `psdSmartObjectRoundTripPlan()`
  - связанных metadata rewrite helpers
- `src/formats/psd.js` только по нужным public rewrite contracts
- relevant Photoshop compatibility fixture tests

## Scope

- определить один canonical owner, предпочтительно `src/document/psd-native-metadata-plans.js` либо другой узкий document/format bridge;
- перенести semantic eligibility/rewrite planning без изменения binary writer;
- дать `psd-export-controller` прямую зависимость от нового owner или узкий API вместо большого runtime `semantics` port;
- добавить direct regression tests на supported/unsupported/fallback decisions;
- обновить source-contracts, architecture guard, AI maps, test matrix, changelog и bundle.

## Preserve exactly

- opaque byte passthrough и invalidation rules;
- Smart Object linked/embedded source identity;
- TySh/EngineData text round-trip constraints;
- shape fill/stroke/vector-mask rewrite eligibility;
- adjustment masks/clipping/parameter rewrite semantics;
- honest raster fallback warnings при unsupported/stale metadata.

## Non-scope

- binary PSD/PSB codec rewrite;
- import mapping;
- новые Photoshop features;
- массовый рефакторинг всех PSD helpers за один проход.

## Verification

Targeted compatibility tests → `npm run check` → `npm run test:browser` → exact-head PR CI → merge → exact main CI.

## Done gate

Удалить task только после green main. Любой следующий отдельный PSD seam оформить отдельным Markdown-файлом.

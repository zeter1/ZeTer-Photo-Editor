# Raster Layer Masks

This document is the fast path for AI/Codex work on raster layer masks.

## Ownership

- `src/core/state.js` owns persisted mask schema and sanitization.
- `src/core/pixels.js#applyMaskControlsAlpha` owns deterministic alpha semantics for invert, density and feather.
- `src/core/render.js` owns runtime composition of the controlled mask with rendered layer pixels.
- `src/selection/mask-controller.js` owns selection → mask creation, Select & Mask refinement, mask properties/toggle/invert commands and exact-target publication guards.
- `src/document/psd-export-controller.js` bakes runtime mask controls into PSD/PSB mask alpha so exported files retain the visible mask result.
- `src/main.js` only composes the controller and exposes menu/context-menu routes.

## Persisted schema

A raster layer mask is:

```js
{
  enabled: true,
  dataUrl: null,
  invert: false,
  density: 1,   // 0..1
  feather: 0,   // 0..250 layer pixels
}
```

`dataUrl: null` is the compact "show all" representation. Feather has no boundary to soften in that state. Invert may still turn it into a hide-all/partial-density mask.

## Alpha contract

The canonical order is:

1. Start from immutable 8-bit mask alpha.
2. Apply bounded two-pass feather.
3. Apply inversion.
4. Apply density as `255 - (255 - alpha) * density`.

Density `0` therefore disables the hiding effect without deleting the mask; density `1` preserves the full mask effect.

Runtime and PSD/PSB export must reuse `applyMaskControlsAlpha`. Do not reimplement these equations in UI code or format code.

## Mutation and async rules

Mask commands capture the exact active document, selected layer and, for property dialogs, the exact mask object. A replacement mask makes a delayed modal stale. Stale/locked targets publish neither mutation nor history.

Select & Mask may perform async rendering/encoding. It must prepare first and revalidate the exact owner/target immediately before assigning `layer.mask`. Replacing an existing refined mask preserves its enabled/invert/density/feather controls.

## PSD/PSB compatibility

PSD/PSB writer preparation rasterizes `invert`, `density` and `feather` into the exported mask alpha. This intentionally preserves visual compatibility even when the target format path does not carry ZPE's runtime mask-control metadata as separate editable fields.

## Tests

- `tests/layer-mask-controls.test.mjs` — alpha math, schema bounds and render/export ownership.
- `tests/selection-mask-controller.test.mjs` — exact-target command/modal transactions.
- `tests/selection-refine.test.mjs` — Select & Mask refinement pipeline.
- PSD/PSB export/integration suites — mask channel compatibility.

When changing mask semantics, run the full `npm run check` because the generated file:// bundle and browser smoke are part of the contract.

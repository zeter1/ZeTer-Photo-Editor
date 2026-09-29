# Raster Layer Masks

This document is the fast path for AI/Codex work on raster layer masks.

## Ownership

- `src/core/state.js` owns persisted mask schema and sanitization.
- `src/core/pixels.js#applyMaskControlsAlpha` owns deterministic alpha semantics for invert, density and feather.
- `src/core/render.js` owns runtime composition of the controlled mask with rendered layer pixels, including the persisted relative affine mask transform.
- `src/core/geometry.js` owns affine composition/inversion and the compensation equation used by layer transforms.
- `src/selection/mask-controller.js` owns selection → mask creation, Select & Mask refinement, mask properties/toggle/invert/link commands and exact-target publication guards.
- `src/layers/transform-command-controller.js` and `src/interaction/layer-transform-gesture-controller.js` preserve document-space mask placement while an unlinked layer moves/resizes/rotates.
- `src/document/psd-export-controller.js` bakes runtime mask controls and placement into PSD/PSB mask alpha so exported files retain the visible mask result.
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
  linked: true,
  transform: null, // compact identity or {a,b,c,d,e,f}, mask-local → layer-local
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

## Select & Mask edge-color cleanup and output

Edge-color decontamination is a **pixel mutation**, not a mask property. The default output remains `Маска слоя`; non-zero color cleanup is rejected in that mode so a preview cannot silently rewrite source pixels.

The explicit `Новый растровый слой + маска` output renders the selected source at full layer resolution, applies the same refined alpha used by the mask, optionally replaces contaminated partial-edge RGB from nearby confident foreground samples, creates a new raster layer with that mask, and keeps the original source layer hidden rather than destructively replacing it. Publication is still one exact-owner transaction and one history entry.

The full-resolution raster output is bounded to 12 MP. Edge detection keeps its existing 48M pixel-radius work budget, and color decontamination uses a separate bounded radius/kernel budget. Sources carrying `highDepthSource` are deliberately refused for this raster output until a native PixelBuffer decontamination path exists; mask-only output remains available and preserves 16/32-bit RGB/CMYK precision. Preview may show decontamination on its bounded proxy, but it never mutates the document.

## Link / unlink transform contract

`linked: true` means future layer transforms leave the mask's relative transform unchanged, so content and mask move together. `linked: false` means layer-transform owners compensate the mask after every transform so its document-space coverage stays fixed.

The canonical equation is:

`new relative = inverse(new layer transform) × old layer transform × old relative`

Compensation is always computed from the captured command/gesture baseline, never incrementally from the previous pointer event. This avoids affine drift during long resize/rotate gestures. Cancel restores both the layer transform and the exact captured mask transform.

`transform: null` is the compact identity. Re-linking does not erase a non-identity transform: it preserves the current relative placement and only changes how future layer transforms behave.

Runtime and PSD/PSB export both compose the same relative transform. Do not implement link/unlink by modifying the mask bitmap or by adding one-off x/y offsets in `src/main.js`.

## PSD/PSB compatibility

PSD/PSB writer preparation rasterizes `invert`, `density` and `feather` into the exported mask alpha. This intentionally preserves visual compatibility even when the target format path does not carry ZPE's runtime mask-control metadata as separate editable fields.

## Tests

- `tests/layer-mask-controls.test.mjs` — alpha math, schema bounds and render/export ownership.
- `tests/layer-mask-linking.test.mjs` — affine invariance, linked/unlinked transform behavior, cancel rollback and runtime/export wiring.
- `tests/selection-mask-controller.test.mjs` — exact-target command/modal transactions.
- `tests/selection-refine.test.mjs` — Select & Mask refinement pipeline.
- PSD/PSB export/integration suites — mask channel compatibility.

When changing mask semantics, run the full `npm run check` because the generated file:// bundle and browser smoke are part of the contract.

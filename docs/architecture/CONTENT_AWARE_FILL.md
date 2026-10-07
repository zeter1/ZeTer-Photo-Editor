# Content-Aware Fill — deterministic texture synthesis contract

## Purpose

This document owns the algorithmic boundary for **Edit → Content-Aware Fill**. The user-facing transaction is owned by `src/painting/command-controller.js`; pixel synthesis is owned by `src/core/inpaint.js`; native 16/32-bit RGB/CMYK data reaches the same core through `inpaintPixelBuffer()` in `src/core/pixel-buffer.js`.

Do not move async document/layer ownership checks into the math module. Do not add Canvas/RGBA8 conversion inside the high-depth path.

## Transaction boundary

Before any async raster preparation, the command captures a frozen selection snapshot and the exact originating document/layer. Publication remains valid only while that exact document still owns the exact editable raster layer.

The inpaint core receives only:

- a typed pixel buffer;
- width / height / channel count;
- a frozen `isAllowed(x, y)` selection predicate;
- explicit safety/tuning limits.

It has no access to UI, history, sessions, Canvas, or persistence.

## Object Removal brush

The separate **Удаление объектов** tool (`Shift+J`) now uses browser LaMa; its dedicated transaction and installation/privacy/runtime contract is [AI_OBJECT_REMOVAL.md](AI_OBJECT_REMOVAL.md). The normal **Edit → Content-Aware Fill** still uses the deterministic synthesis below, including native RGB/CMYK precision paths. Do not route AI errors silently through this legacy fill.

## Stage 1 — bounded boundary synthesis

The first stage grows from the hole boundary inward.

Each selected pixel records a donor identity that ultimately points to an **immutable pixel outside the original selection**. Synthesized pixels may provide geometric propagation, but they never become source authority for later pixels. This prevents recursive color drift and preserves the previous deterministic fallback.

Default hard budgets remain:

- layer: 8,000,000 pixels;
- selected fill region: 2,000,000 pixels.

A fully selected layer is a semantic no-op because there is no legal donor region.

## Stage 2 — bounded PatchMatch-style refinement

For completed fills whose selected area is at most **250,000 pixels**, `src/core/inpaint.js` performs a second deterministic texture pass.

The pass uses:

1. a small patch score around each selected target;
2. nearest-neighbour-field propagation from already visited selected neighbours;
3. deterministic pseudo-random search around the current best donor;
4. exact sample copy from the winning donor center.

Source patch samples that fall inside the original selection are rejected. Candidate donor centers must also be outside the original selection. RGB/RGBA scoring ignores alpha as a texture-color channel; CMYK/CMYKA scoring compares the four ink channels while the winning donor copies the complete sample, including alpha.

Alternating forward/backward passes make good offsets propagate across the hole without using non-deterministic randomness.

This is **PatchMatch-style texture synthesis**, not Adobe's proprietary implementation and not an ML/semantic fill system.

## Large-region fallback

Patch search is intentionally capped. If the selected area exceeds the PatchMatch refinement budget, Stage 1 remains the final result.

This is a reliability contract, not a silent precision downgrade:

- the operation still respects the frozen selection;
- native sample type/model are preserved;
- no high-depth/CMYK path is converted through Canvas8;
- existing layer/fill safety limits still apply.

Raise the PatchMatch budget only with performance evidence and regression coverage.

## Precision contract

The algorithm works directly on typed samples:

- `Uint8ClampedArray` / 8-bit;
- `Uint16Array` / 16-bit;
- `Float32Array` / 32-bit;
- RGB/RGBA;
- CMYK/CMYKA.

Integer patch differences are normalized by their native sample range. Float differences use a bounded relative scale so HDR/unmanaged samples are compared without first clipping them to 0…1.

## Tests

Primary regressions live in `tests/content-aware-fill.test.mjs`.

They must cover:

- legacy single-hole/boundary behavior;
- no-donor full-selection no-op;
- native Float32 CMYK preservation;
- deterministic repeated-texture reconstruction through PatchMatch refinement;
- explicit large-selection boundary-only fallback.

Command-level publication/owner checks remain in `tests/painting-command-controller.test.mjs` and the high-depth editing suites.

## Change rules

When modifying Content-Aware Fill:

1. keep the math deterministic;
2. never allow a donor inside the frozen original selection;
3. preserve the existing 8 MP / 2 MP safety gates unless there is measured evidence;
4. keep exact-owner async publication in the command/persistence layer;
5. preserve native RGB/CMYK 8/16/32-bit sample domains;
6. regenerate `src/app.bundle.js`, `index.html` build metadata and `version.json`;
7. run `npm run check` and `npm run test:browser`.

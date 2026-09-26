# 003 — Isolate first PSD document-orchestration seam

## Goal

Reduce the very large PSD-facing section in `src/main.js` without mixing a risky full PSD rewrite into one pass.

## Why now / evidence

`src/formats/psd.js` already owns binary codec semantics, but `src/main.js` still owns many import/export mapping and preparation functions. This is the next large architectural debt after smaller UI owners are extracted.

## Scope

First pass only: inventory adjacent PSD orchestration declarations/callers, select **one cohesive seam** (for example export preparation or import mapping), lock behavior with direct regression contracts, then extract that seam. Keep the PR small enough to review.

## Non-scope

Do not move the whole PSD block at once. No new PSD feature, no unsupported Photoshop semantics claim, no broad format refactor.

## Inspect first

- exact PSD-related symbol inventory in `src/main.js`
- `src/formats/psd.js`
- `tests/psd-*.test.mjs`, high-depth/CMYK tests, async document-context tests
- current bundle order and architecture guards

## Behavioral contracts to preserve

PSD/PSB round-trip honesty, preserved opaque bytes/metadata, high-depth/CMYK native paths, Smart Object/Text/Shape/Adjustment rewrite semantics, async originating-document guards and export bounds.

## Targeted tests

Choose tests that would fail on a broken mapping/preparation contract; add a direct controller/helper regression before or with extraction. Do not rely only on source slicing.

## Required verification

Relevant PSD fixture/golden tests → `npm run check` → `npm run test:browser` → PR CI → main CI.

## Done gate

Exactly one PSD seam extracted, behavior unchanged, docs/maps updated, main CI green. Then delete this task file; split remaining PSD debt into new bounded task files.

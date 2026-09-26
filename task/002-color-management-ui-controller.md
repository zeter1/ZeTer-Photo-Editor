# 002 — Extract color-management UI orchestration

## Goal

Separate document color-management/proofing UI orchestration from `src/main.js` while keeping transform math in `src/core/color-management.js`.

## Why now / evidence

The runtime still contains a dense UI-facing block around `colorProfileBytes`, transform-cache invalidation, proof/display-profile actions and control binding. Core math already has a canonical owner, so the remaining seam is primarily orchestration.

## Scope

After inventorying all callers, extract profile-control binding, policy updates, proof/display profile UI actions and cache invalidation coordination behind explicit ports. Keep one owner for each transform cache.

## Non-scope

No ICC parser/math rewrite, no new color science behavior, no PSD/PSB format change, no rendering-intent feature expansion.

## Inspect first

- `src/main.js` symbols from `colorProfileBytes` through `bindColorManagementControls`
- `src/core/color-management.js`
- color-management/profile/compatibility-corpus tests
- render bridge and PSD color metadata call sites

## Behavioral contracts to preserve

Native CMYK/high-depth precision, rendering intents, BPC, soft-proof/display policy, gamut-warning settings, profile load/remove behavior and cache invalidation.

## Targeted tests

Direct controller tests for UI/state transitions and stale cache invalidation plus existing color-management/corpus regressions; architecture guard for ownership.

## Required verification

`npm run check` + `npm run test:browser`; fixture/corpus tests must remain green. Inspect PR CI and main CI.

## Done gate

Merged to main with green main CI and current docs/maps/bundle. Then delete this task file.

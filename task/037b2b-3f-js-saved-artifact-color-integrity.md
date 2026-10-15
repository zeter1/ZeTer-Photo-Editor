# 037B2b-3f — JavaScript saved-artifact rejection of hidden PSD/PSB color metadata

**Status: CLOSED (2026-10-15).** [PR #236](https://github.com/zeter1/ZeTer-Photo-Editor/pull/236) merged as [51e87e2](https://github.com/zeter1/ZeTer-Photo-Editor/commit/51e87e2e47c29c54406c50d1f662125188d5b54c); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38731725562) and [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38732120517). This is a narrow test-only hardening pass, not photo/Photoshop interoperability.

## Problem

The separate strict Python/std-lib reader (037B2b-3e) refuses extra top-level
Color Mode Data and Image Resources in the exact one-layer ZeTer PSD16/PSB32
native defect fixture. The offline JavaScript artifact verifier
(`tools/real-photo-psd-psb-fixtures.mjs`) had only skipped their declared lengths,
then checked layer and merged native word hashes. Unreviewed ICC or color
metadata could therefore be silently admitted by the JavaScript codec
verification even if pixel hashes were unchanged.

## Implementation scope

- [x] In `verifyRawPhotoMergedPlanes`, require *both* top-level section
  lengths to be zero, with checked bounds, for **this exact fixture contract**.
- [x] Invoke raw/native verification **before** `decodePsd` to avoid
  ignoring normalized/unsupported color metadata before checking its presence.
- [x] Test both PSD16 and PSB32: inject nonzero Color Mode Data and an
  8BIM/1039 ICC resource while leaving native layer/merged samples untouched.
- [x] Test the real saved artifact `verifyPhotoDefectArtifactSet` entrypoint
  even when a malicious artifact's file SHA is recomputed.
- [x] PR CI: `npm run check`, Chromium `file://` smoke, JSON/profile checks.
- [x] Exact merged-code `main` CI success before marking this subpass CLOSED.

Verified in GitHub Actions: full Node/build, real Chromium `file://`, versioned JSON/profile checks, and diff hygiene. Run locally with `node --test tests/real-photo-psd-psb-fixtures.test.mjs`
and `npm run check`. The reviewed genuine JPEG is not included.

## Next passes / still-open external gates

1. 037B2b-2: receive independently licensed genuine CC0 JPEG bytes,
   independently review entropy decode, EXIF/ICC/color, original and decoded
   and native clean/damaged SHA-256 pins. The existing structural surrogate is
   NOT a real image.
2. 037B2b-3: validate genuine PSD16/PSB32 via a third-party PSD/PSB decoder,
   without interpreting ZeTer writer→reader or this exact-fixture reader as
   Adobe parity.
3. 037C: genuine-photo Chromium `file://`, native Worker, 8288 connected ROI,
   Save/Undo/Redo, 3 independent runs per depth, native quality and honest
   sampled memory.
4. P0 002: independent Photoshop-authored golden corpus; Stage 003:
   full tiled memory budget/quality/performance and other screenshot features.

**Non-scope:** production UI/runtime, generic PSD/PSB ICC handling, embedded ICC
color transforms, independent Photoshop compatibility, original JPEG bytes and
real-photo quality claims. Version stays 1.46.1 (test-only gate).

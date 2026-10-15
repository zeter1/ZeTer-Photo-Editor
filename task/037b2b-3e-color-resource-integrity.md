# 037B2b-3e — Strict color/resource integrity for pinned PSD16/PSB32

**Status: IMPLEMENTED IN PR, VERIFICATION PENDING (2026-10-15).**

Test-only pass. The narrow Python/std-lib one-layer native SHA oracle previously
skipped top-level Color Mode Data and Image Resources, though ICC or untagged
color metadata can change color interpretation without changing RGBA native
layer/merged bytes. The ZeTer one-layer defect fixture contains neither section.

## Acceptance criteria

- [x] Reject any nonempty Color Mode Data in this exact fixture.
- [x] Reject any nonempty Image Resources, including a Photoshop-style
  `8BIM` resource ID 1039 (ICC), rather than silently skipping it.
- [x] Negative Python-oracle regressions for **both PSD16 and PSB32** insert
  color or ICC resource blocks while leaving native layer + merged words intact.
- [ ] Verify `npm run check`, genuine Chromium `file://` smoke, and PR CI.
- [ ] After merge verify CI for the **exact merged main SHA**, then close.

## Commands

```sh
node --test tests/real-photo-psd-python-readback.test.mjs
npm run check
npm run test:browser
```

## Next tasks — still open

1. **037B2b-2:** obtain genuine, independently licensed CC0 original JPEG
   and reviewed decoder/ICC/EXIF/orientation/color policy, frozen original,
   RGBA8 and RGB16/Float32 clean/damaged SHA-256. Synthetic test pixels
   are not sufficient.
2. **037B2b-3:** use a true third-party PSD16/PSB32 decoder with independently
   reviewed provenance. This Python structural one-layer oracle is **not**
   generic Photoshop decoding or independent Adobe interoperability proof.
3. **037C:** genuine-photo PSD16/PSB32 Chromium file:// native Worker and
   connected ROI 8288, Save, Undo/Redo; three independent runs per format,
   native quality oracle and honest memory evidence.
4. **P0 002** independent Photoshop-authored compatibility goldens;
   **Stage 003** large tiled/raster memory, cancellation and performance.
   The larger screenshot roadmap remains open.

No new real-photo bytes, new runtime functionality, ICC color transform
validation, Photoshop golden, or quality/performance claim is supplied here.

# 037B2b-3e — Strict color/resource integrity for pinned PSD16/PSB32

**Status: CLOSED (2026-10-15).** [PR #235](https://github.com/zeter1/ZeTer-Photo-Editor/pull/235) merged as [ce2e029](https://github.com/zeter1/ZeTer-Photo-Editor/commit/ce2e02931c08f58c6dae70dfa5bc669a041d5e85); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38729586823) and [exact merged-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38730012860).

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
- [x] Verified `npm run check`, real Chromium `file://` smoke and full [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38729586823).
- [x] Verified [exact merged-code main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38730012860) success for `ce2e02931c08f58c6dae70dfa5bc669a041d5e85`; stage CLOSED.

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

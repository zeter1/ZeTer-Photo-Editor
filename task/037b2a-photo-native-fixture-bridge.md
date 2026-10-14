# 037B2a — bounded native reference bridge for a pinned real-photo decode

**Subpass 037B2a CLOSED:** [PR #225](https://github.com/zeter1/ZeTer-Photo-Editor/pull/225) → [64c0235](https://github.com/zeter1/ZeTer-Photo-Editor/commit/64c0235b70ea724ef6b6bacdc70c5ff9ce19a5fc), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38607110005), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38607607539); full build/Node, Chromium `file://`, artifact/profile gates and diff hygiene passed. The parent 037 task is still OPEN.

**P1 / 037B preparation.** Scope: deterministic **test-only** 8-bit-decoded photo → 16-bit unsigned or 32-bit float clean reference + controlled connected defects. This does **not** complete 037B, 037C, or Photoshop parity.

## Input and proof boundary

1. Acquire a legally reusable **original** photo and independently pin original JPEG SHA-256 (the Commons-listed SHA-1 alone is insufficient). Confirm full entropy decode, EXIF orientation, ICC/sRGB profile and pixel coordinates using a trustworthy decoder. Record decoder/version/settings.
2. Separately pin decoded **opaque RGBA8** SHA-256. Test runner must compare that pinned digest against actual decoder bytes using `verifyPinnedDecodedRgba`. Do not infer color correctness or orientation from a matching JPEG-header hash.
3. `preparePhotoNativeFixtureCandidate({rgba,width,height,expectedRgbaSha256,bitsPerChannel,cropX,cropY,cropWidth,cropHeight})` in `tools/real-photo-native-fixtures.mjs` derives a bounded row-major 1025×1025 crop by default (source can be 2560×1920), a *per-pixel textured* clean native RGB plus opaque alpha and a defect-only copy. For RGB16 use exact `byte * 257`; for Float32 use `Math.fround(byte / 255)`. **Both are 8-bit-derived**, not independently photographed high-depth values or Adobe-authored goldens.
4. The exact native 8-connected 8288-pixel ROI is the two 64×64 islands and 96-pixel diagonal corridor from 036A/B. Its origin is centered within the crop. Only selected RGB words are damaged (XOR 0xffff for RGB16 or +1 for float); alpha and non-selected pixels remain exact. The crop is bounded by existing 2 MP native ROI evidence limits.
5. Record `referenceCandidateSha256` as a **reviewed manifest pin** (LE native-word digest, not preview bytes). `createPinnedPhotoNativeFixture` refuses missing or different `expectedReferenceSha256` and rechecks the separately pinned RGBA8 payload. Hand the independent `clean` and `damaged` arrays to the native PSD16/PSB32 transport and the 037A independent per-pixel oracle. Recheck the hash before every benchmark run; typed arrays themselves remain mutable.

## Acceptance, limits and execution

- [x] Test-only generation for both native word depths; non-overlapping independently allocated clean/defect buffers; exact ROI alignment; explicit RGBA8-origin precision.
- [x] Local-data unit negative cases: unpinned clean digest, wrong clean digest, changed decoded bytes, transparency, malformed geometry/format, outside-selection and alpha invariants through 037A oracle.
- [ ] Pin actual CC0 original bytes and decoded digest, verify full JPEG decode, EXIF orientation and ICC/sRGB. No real photo pixel assets are included by this preparatory code.
- [ ] Add immutable real-photo manifest (source/decoded/native RGB16/native Float32 SHA-256, license and decoder version), real clean+defect PSD16/PSB32 fixtures and independent verification from actual files.
- [ ] 037C: Chromium `file://` import → polygon → native Worker → Save Project → Undo/Redo, 3 distinct repeats/format, fail-closed JSON/observational memory; cross-app Adobe-authored corpus is separately [002](002-psd-compatibility-corpus.md).

**Verify:** `node --test tests/real-photo-native-fixtures.test.mjs`, then `npm run check` and Chromium `file://` CI. Report PR/head CI only after it truly runs; main-gate only after merge plus matching main CI.

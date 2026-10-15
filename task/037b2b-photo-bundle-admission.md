# 037B2b-1 — offline admission for pinned original / RGBA8 / RGB16 + Float32 photo fixtures

**037B2b-1 CLOSED — [PR #226](https://github.com/zeter1/ZeTer-Photo-Editor/pull/226) merged as [fab6c49](https://github.com/zeter1/ZeTer-Photo-Editor/commit/fab6c49abed85f7314ef91b1769975496f8263b7); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38691322897), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38691679311) (2026-10-15).** Full Node/build, Chromium file://, JSON/profiles and diff hygiene passed. **P1 / 037 stays OPEN.** This is a test-only **byte-integrity admission tool**, not genuine photo pixels or a Photoshop gold standard. See [037](037-real-photo-connected-roi-benchmark.md), [037B2a](037b2a-photo-native-fixture-bridge.md), and [asset provenance](../tests/fixtures/real-photo/README.md).

## Changes in this subpass

- `tools/real-photo-bundle-admission.mjs` implements `inspectPhotoBundleCandidate` and `admitPhotoBundle`. Candidate generation NEVER constitutes admission.
- `tools/real-photo-bundle-cli.mjs` works **offline**, takes reviewed local JPEG + row-major RGBA8 bytes + decoder evidence, and refuses missing/wrong SHA-256 for **original, decoded, RGB16 clean/defect, Float32 clean/defect**.
- Fixed production source identity: Commons CC0 MartinThoma brick photo with documented SHA-1 `c7fc9f013c70e01f164d232462ddd6e37e4079c4`, expected 2560×1920. CLI cannot substitute a different source policy. Unit tests inject a **clearly synthetic structural surrogate** to test verifier mechanics without pretending an actual JPEG entropy decode.
- Validates bounded crop, 8288 connected ROI, RGBA opacity, 8-bit-derived precision, strict manifest schema and EXIF/ICC declaration consistency with JPEG header flags. A declared decoder tool/version/command/color evidence does **not** cryptographically prove it decoded or managed colors correctly; human review is required.
- Tests: `node --test tests/real-photo-bundle-admission.test.mjs`, then `npm run check` and genuine Chromium CI. Do **not** claim checked CI before it completes.

## Procedure for actual licensed photo bytes (required before 037B2b-2)

1. Independently download original documented CC0 JPEG and record license/source history. Inspect it with `node tools/inspect-real-photo-source.mjs /absolute/path/original.jpg`. Independently pin its full SHA-256, not only the publicly documented SHA-1.
2. Use a trustworthy externally versioned JPEG decoder (e.g., pinned Pillow/libjpeg build) to create **unscaled, correctly oriented, color-managed, opaque row-major RGBA8 bytes**, exactly `2560 * 1920 * 4 = 19,660,800` bytes. Record exact decoder name/version/command, EXIF orientation *actually observed*, whether rotation was applied and ICC handling. Retain independent decoded SHA-256.
3. Write `decoder.json` with **exact** keys `tool`, `version`, `command`, `exifOrientation` (null when no EXIF, 1–8 when present), `orientationApplied` (Boolean), `iccPolicy` (either `embedded-ICC-to-sRGB` when APP2 marker present, or `assumed-sRGB` otherwise), `colorEvidence` (concrete external observations). If EXIF/ICC contradict header signals, the gate fails. Even matching flags alone are **not** independent validation of color transforms.
4. Produce **candidate only**:

   ```sh
   node tools/real-photo-bundle-cli.mjs candidate original.jpg decoded.rgba decoder.json > candidate.json
   ```

   Inspect `candidate.json.manifest` and independently review/pin its six SHA-256 values (original JPEG, decoded RGBA8, RGB16 clean/damaged, Float32 clean/damaged) in `reviewed-manifest.json`. Exact schema is the `manifest` object output by candidate mode. The manifest is **not** accepted just because it was produced by the candidate command; retain and review source and decoder provenance separately. Default source crop is `(0,0) 1025×1025` for the frozen 8288-pixel selection.
5. Verify without any network calls:

   ```sh
   node tools/real-photo-bundle-cli.mjs verify reviewed-manifest.json original.jpg decoded.rgba
   ```

   Successful output says only `pinned-byte-integrity-verified` and leaves `independentDecoderIccExifReviewRequired: true`, `browserBenchmarkVerified: false`, `photoshopParityVerified: false`. Native arrays are returned **in-process**, never dumped into JSON or repinned from their own output during verification. Treat a mutable URL or freshly recalculated hashes as unreviewed, never as a trusted fixture.

## Next passes / acceptance

- [x] 037B2b-1: strict offline manifest/native integrity gate and negative-mutation unit suite (PR merged, PR CI and exact-main CI success).
- [ ] 037B2b-2: receive **genuine** CC0 original bytes; independently review JPEG entropy decode, EXIF, ICC, actual SHA-256s, license and durable asset storage; check `verify` output against frozen reviewed pins. Current repository does **not** ship genuine photo pixels; DO NOT assert this is completed.
- [ ] 037B2b-3: emit and re-import test-only PSD16 and PSB32 defect documents from admitted pinned native input, validate native tile bytes/geometry and public import provenance independently. No claim of Photoshop-authored goldens.
- [ ] 037C: real Chromium `file://` PSD16/PSB32 import → polygon 8288 → native Worker → Save Project → Undo/Redo, three **independent** runs/format, strict per-pixel quality and observational timing/memory JSON. Blind negatives and PR/exact-main CI.
- [ ] P0 [002](002-psd-compatibility-corpus.md) independently licensed Photoshop-authored goldens. Stage [003](003-tiled-content-aware.md) and the screenshot's broader professional feature set remain OPEN.

**Boundary:** This pass adds no production rendering/UI feature, photo asset, successful photo quality metric or true RAM peak. Native RGB16/Float32 values still come from decoded **8-bit** pixels.

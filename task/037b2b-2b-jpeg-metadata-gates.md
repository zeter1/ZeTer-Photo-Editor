# 037B2b-2b — integrity gate for JPEG EXIF/ICC metadata (test-only)

**Status: CLOSED (2026-10-15).** [PR #230](https://github.com/zeter1/ZeTer-Photo-Editor/pull/230) merged as [`1847c0b`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/1847c0b1409d6ebe7b2cadfeae014ea3267da48d); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38703368803) and [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38703772619). The broader 037B2b-2 *genuine photo* task is OPEN; this pass does not contain original photographic pixels.

## Goal and evidence

- The previous source inspector reported ICC if any APP2 marker began with `ICC_PROFILE`, without validating multi-part completeness. Pillow can omit malformed ICC metadata, which could incorrectly make a decoded candidate look like `assumed-sRGB`.
- EXIF APP1 metadata need not include an Orientation tag. Rejecting a `null` Orientation merely because APP1 EXIF exists was overly strict; conversely a false `orientationApplied:true` statement was not rejected for absent/identity orientation.

## Implemented

- `tools/real-photo-source-integrity.mjs`: validate non-empty ICC APP2 chunks, NUL signature, valid 1-based sequence numbers, consistent total, no duplicates or missing segments. Still *only* a JPEG marker/structure inspection, **not** entropy decode.
- `tools/decode-real-photo.py`: independently scan raw JPEG APP2 chunk graph before Pillow decode; require the reassembled ICC profile to match the precise bytes Pillow exposes before ImageCms conversion. Preserve strict pinned source SHA-1 and output-is-candidate policy.
- `tools/real-photo-bundle-admission.mjs`: accept EXIF container with no Orientation tag (`null`); require the transpose declaration to agree with orientation (2–8 true, absent/1 false).
- Node and Pillow negative regressions: incomplete, duplicate, mismatched, malformed ICC parts, false orientation claim, synthetic EXIF without Orientation, valid profile assembly. Tests use **synthetic bytes only**.

## Gate

1. Run `node --test tests/real-photo-source-integrity.test.mjs tests/real-photo-bundle-admission.test.mjs tests/decode-real-photo.test.mjs` with `Pillow==12.0.0` (required by CI).
2. Run `npm run check`, real Chromium `file://` smoke, profile/artifact validators, clean `git diff --check`.
3. **Verified:** PR CI and exact-code `main` CI both completed successfully with build/Node tests, Chromium `file://`, artifact/profile checks and diff hygiene. No Photoshop/photo-quality claims from these tests.

## Next open steps

1. **037B2b-2 genuine bytes / independent review:** acquire original CC0 JPEG from the documented Commons source; document provenance and license; independent decoder/EXIF/ICC visual review and original/decoded/native clean+defect immutable SHA-256 pins. Do not promote self-generated candidate hashes into reviewed evidence.
2. **037B2b-3 real native artifacts:** admitted photographed image to PSD16/PSB32, persisted byte-level verification and external PSD/PSB reader.
3. **037C browser quality:** 3 independent `file://` native-Worker benchmark runs per format, per-pixel oracle, honest timings/memory missingness.
4. **P0 002 and Stage 003:** Photoshop-authored compatibility corpus and global tiled/document memory guarantees remain OPEN.

**Limit:** syntactic ICC completeness/byte agreement with Pillow do not prove correct rendering intent or independent color management; both need external reference review.

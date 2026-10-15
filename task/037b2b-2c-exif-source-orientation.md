# 037B2b-2c — EXIF Orientation source-byte gate

**Status:** implementation in progress; no verified CI or main merge claimed.

## Goal
Read the EXIF Orientation from the original JPEG APP1/TIFF IFD0 and compare it with the decoder's manifest. This closes the gap where a decoder declaration could disagree with the source bytes while matching only the presence of an EXIF container.

## Scope
- Support both TIFF endian formats, an absent Orientation tag, and valid 1–8 values.
- Reject malformed/truncated EXIF, duplicate tags/containers and false decoder declarations.
- Add focused negative unit regressions. Do not change production editor or JPEG entropy decoder.

## Acceptance
- Targeted photo integrity/admission tests and `npm run check`.
- PR CI and exact-code main CI before marking this subpass closed.

## Next (still OPEN)
- Acquire independently reviewed CC0 JPEG and pinned original/RGBA/native SHA-256s (037B2b-2).
- Externally verify PSD16/PSB32 native photo artifacts (037B2b-3).
- Real Chromium photographic quality/performance runs ×3 per format (037C).
- Licensed Photoshop high-depth reference corpus (002); broader tiled-rendering Stage 003.

**Limits:** source-byte Orientation consistency does not itself prove a color-managed decode, genuine photo content or Photoshop parity.

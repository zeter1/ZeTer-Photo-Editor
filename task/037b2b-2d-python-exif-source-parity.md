# 037B2b-2d — Python decoder EXIF/TIFF source-byte parity

**Status: CLOSED (2026-10-15).** [PR #232](https://github.com/zeter1/ZeTer-Photo-Editor/pull/232) merged as [`6d58f6b`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/6d58f6b8eb5280d5ece6b5f88415146319b1139e). [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38708933494) and [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38709327930).
Date: 2026-10-15. Depends on closed [037B2b-2c](037b2b-2c-exif-source-orientation.md).

## Why

JS bundle admission already parses original APP1/TIFF IFD0 Orientation and reconciles it with decoder metadata. The offline Pillow decoder previously derived its EXIF claim only from Pillow; this subpass verifies original bytes before writing candidate outputs.

## Scope (test-only tooling; no production app behavior change)

- [x] Added bounded TIFF IFD0 Orientation reader in tools/decode-real-photo.py, little/big endian, absent tag, valid 1–8.
- [x] Reject duplicate EXIF APP1 and Orientation, bad TIFF magic/endian/offset/type/count, malformed/truncated IFD0.
- [x] Compare TIFF-derived value with Pillow Image.getexif() before decode/transposition/output; reject mismatch.
- [x] Added tests/decode-real-photo-exif-source-parity.test.mjs with synthetic/Pillow JPEG, malformed/duplicate/mismatch negative matrix and no-output assertions.
- [x] Full CI: build, all Node/Python tests, generated bundle parity, Chromium `file://`, artifact/profile/diff gates successful on PR and exact merge SHA.
- [x] Reviewed diff, merged PR #232, and verified exact-code main CI success; 037B2b-2d CLOSED.

## Limits

Source-byte EXIF parity does not supply genuine CC0 pixels, independent image-decoder/color review, frozen licensed photo pins, Adobe parity or photographic benchmark. Tests use synthetic JPEG; this is a preparation hardening, not photo quality evidence.

## Next OPEN gates

1. **037B2b-2**: acquire documented CC0 MartinThoma original, independently check licensing/source SHA-256/EXIF/ICC/color, decode/version RGBA8 and separately freeze original/decoded/native clean+defect hashes. No original downloaded in this environment; do not invent hashes.
2. **037B2b-3**: generate native photo PSD16/PSB32 and verify saved files in an independent Photoshop-compatible reader.
3. **037C**: true Chromium file:// import/polygon/native Worker/Save Project/Undo-Redo ×3 per format with photographic oracle and honest RSS/CDP missingness.
4. **002 / 003**: licensed Photoshop-authored goldens and broader tiled document/render-memory work remain OPEN.

## Evidence

- Evidence: [PR #232](https://github.com/zeter1/ZeTer-Photo-Editor/pull/232), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38708933494), [merge SHA](https://github.com/zeter1/ZeTer-Photo-Editor/commit/6d58f6b8eb5280d5ece6b5f88415146319b1139e), [exact-code main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38709327930).

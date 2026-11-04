# 037B2b-3d — strict one-layer PSD16/PSB32 metadata oracle

**Status: CLOSED (2026-10-15).** [PR #234](https://github.com/zeter1/ZeTer-Photo-Editor/pull/234) merged as [31a0de7](https://github.com/zeter1/ZeTer-Photo-Editor/commit/31a0de799b75600d052d46f87c8abd6b843226ec); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38726903064) and [exact merged-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38727329049).
Scope: **test-only** offline native photo defect document integrity; does not affect
production/UI/renderer, introduce genuine photo bytes, or prove Adobe parity.

## Bug / impact

The standalone Python native PSD/PSB reader from [037B2b-3c](037b2b-3c-python-native-readback.md)
compared all raw native RGBA layer and merged pixel bytes with independently pinned
SHA-256. It previously *skipped* the per-layer extra section, including mask,
blending ranges, Pascal/Unicode names; and tolerated protection flags and different
layer count signs. A PSD with changed semantic metadata could therefore report
an identical native pixel digest and be incorrectly considered a matching one-layer
defect fixture. Layers/masks/text and importer interpretation matter beyond pixels.

## Implementation

- [x] In `tools/verify-real-photo-psd-native.py`, fail closed unless the exact
  fixture has one RGBA layer with merged transparency; expected layer flags;
  no extra layer-mask payload or blending ranges; exact Pascal and `luni`
  Unicode layer names; valid Unicode/Pascal alignment; no trailing metadata.
  The reader is deliberately narrow: **not a general PSD/PSB decoder**.
- [x] In `tests/real-photo-psd-python-readback.test.mjs`, mutate metadata
  only (layer count, protected flag, mask, blending ranges, both names,
  `luni` key, padding) in **both** PSD16/PSB32 files and require independent
  Python rejection despite original native layer+merged pixels and their SHA.
- [x] Verified new tests and full `npm run check`, genuine Chromium `file://`
  smoke, generated bundle parity, JSON/profiles/diff checks via PR CI.
- [x] Reviewed PR, merged to `main` and verified **exact merged code SHA** CI before
  marking 037B2b-3d CLOSED ([PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38726903064), [main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38727329049)).

## Remaining mandatory gates (unchanged)

- [ ] **037B2b-2** independently licensed original CC0 photo with actual JPEG
  bytes, source/decoded/native frozen SHA-256, EXIF/ICC/color provenance and
  external review. Synthetic pixels are explicitly not genuine photographic proof.
- [ ] **037B2b-3** external third-party Photoshop-compatible PSD16/PSB32
  decoding with reviewed provenance; this Python structural reader is not that.
- [ ] **037C** real photo native PSD16/PSB32 in Chromium file://, connected ROI,
  Worker, Save/Undo/Redo, three independently measured runs per depth,
  native photographic quality reference, memory observation with missingness.
- [ ] **P0 [002](002-psd-compatibility-corpus.md)** Adobe-authored goldens
  and **[003](003-tiled-content-aware.md)** tiled performance/cancellation
  remain open. Broader screenshot features are not considered finished.

## Evidence / execution

```sh
node --test tests/real-photo-psd-python-readback.test.mjs
npm run check
npm run test:browser
```

Do not infer successful tests, CI, true Photoshop interoperability or a
real-photo benchmark from this checklist until validated.

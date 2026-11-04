# 037B2b-3c — independent Python PSD16/PSB32 native plane readback

**037B2b-3c CLOSED (2026-10-15): [PR #233](https://github.com/zeter1/ZeTer-Photo-Editor/pull/233) merged as [7cc4459](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7cc4459b787f66a2590ae82d2ab4edb76f685867); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38724278629) and [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38724736301).** Independent of the ZeTer JavaScript PSD encoder/decoder, but **NOT** an external Adobe/Photoshop-approved decoder, and not a real CC0 image. Stage 037, 002, 003 remain OPEN.

## Scope

- New offline tool `tools/verify-real-photo-psd-native.py` (Python standard library, no imports from ZeTer) checks saved high-depth PSD16/PSB32: 8BPS header/depth/geometry, bounded high-depth `Lr16`/`Lr32` tagged block, exactly one full-size visible RGB+A layer, four unique raw channels with PSD/PSB length widths, native byte-order conversion and merged composite.
- Requires **independently pinned SHA-256 of LE interleaved damaged native RGBA**; separately computes and compares the layer and merged composite hashes against that same pin. It does not accept candidate-generated digests as trusted without human review.
- Bounded 48 MiB on-disk file / 2,000,000 pixels. Reject unknown channel/compression, truncated/extended data, wrong depth/format/pin, incorrect header, corrupt per-layer or merged plane.
- Node test `tests/real-photo-psd-python-readback.test.mjs` calls **real Python** against writer-produced PSD16 + PSB32 files. The fixture is clearly synthetic; negative matrix mutates layer-only, merged-only, compression, pins, geometry, format, truncation, trailing bytes.
- No effect on editor production/runtime; no version bump.

## How to run against an actual *reviewed* bundle

After separately obtaining/licensing/reviewing the genuine original JPEG and full RGBA/native manifest, run the existing offline producer and artifact verifier (do not repin candidates from their own outputs):

```sh
node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba output-dir
node tools/real-photo-psd-psb-cli.mjs verify reviewed-manifest.json original.jpg decoded.rgba output-dir
python3 tools/verify-real-photo-psd-native.py PSD16 output-dir/psd16-defect.psd 1025 1025 <reviewed-native-rgb16-damaged-sha256>
python3 tools/verify-real-photo-psd-native.py PSB32 output-dir/psb32-defect.psb 1025 1025 <reviewed-native-float32-damaged-sha256>
```

The expected SHA-256 values come from the separately reviewed manifest, not Python's output. `status: independent-python-native-readback-only` says exactly what was tested. The tool **does not** prove generic PSD/PSB parser coverage (e.g. compressed/complex layers), ICC/EXIF accuracy, Photoshop import/export parity, photographic quality or an Adobe-authored golden.

## Evidence / next

- [x] PR and main CI: full `npm run check` (Node and Python), real Chromium `file://` smoke, artifact/profiles, generated parity and diff hygiene passed.
- [x] [PR #233](https://github.com/zeter1/ZeTer-Photo-Editor/pull/233) merged (squash `7cc4459`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38724278629) and [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38724736301) success. Only the Python readback subpass is closed.
- [ ] **037B2b-2** obtain licensed genuine original, independent EXIF/ICC/color review and frozen source/decoded/native hashes.
- [ ] **037B2b-3 remaining** run actual saved fixtures through independent third-party Photoshop-compatible reader with provenance; Python self-contained structural reader is only a cross-language native layout oracle.
- [ ] **037C** real Chromium `file://` native Worker Content-Aware Fill, 3 trials/format, clean-photo quality + honest RSS/latency.
- [ ] **P0 002** Photoshop-authored golden corpus; **Stage 003** full tiled operation constraints.


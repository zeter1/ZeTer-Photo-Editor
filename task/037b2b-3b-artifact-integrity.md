# 037B2b-3b — persisted PSD16/PSB32 artifact verification

**Scope:** test-only, source-only follow-up to [037B2b-3a](037b2b-native-psd-psb-bridge.md). Verify saved PSD/PSB files and their persisted proof, instead of treating an in-memory self-codec proof or console text as a durable benchmark. This is **not** independent Adobe decoding, human ICC/EXIF review or real-photo quality.

## Implementation and acceptance

- `tools/real-photo-psd-psb-artifacts.mjs` provides a strict schema and readback verifier for `codec-evidence.json`. Requires original JPEG, decoded RGBA8, independently pinned manifest and both saved PSD16/PSB32 files.
- Re-admits the original/decoded/native clean+defect SHA-256 and 8288 ROI, validates all recorded fields, per-file SHA-256, exact high-depth layer and merged composite native words, and outside-ROI/alpha behavior. Refuses extra or forged metadata, swapped formats and altered bytes. The proof explicitly says `photoshopParityVerified: false`, `browserBenchmarkVerified: false`.
- Offline CLI: `node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba NEW-output-dir` saves files with `codec-evidence.json` written last. `node tools/real-photo-psd-psb-cli.mjs verify reviewed-manifest.json original.jpg decoded.rgba output-dir` verifies the *saved* bytes, without rewriting anything.
- Negative regressions in `tests/real-photo-psd-psb-fixtures.test.mjs` use a **structural non-photo surrogate**. No benchmark quality or real licensed photo claim.
- Source-only test/tool changes: no runtime version bump. PR CI and exact-main CI must be reported separately, never assumed.

## Next after this pass (still OPEN)

1. **037B2b-2:** obtain the documented actual MartinThoma CC0 original JPEG; independently decode/version RGBA8 and review EXIF orientation, ICC and licenses. Pin immutable original / decoded / native RGB16+Float32 SHA-256 *out of band*. Do not treat this test's surrogate as licensed photo pixels.
2. **037B2b-3 remaining:** run offline creator + verifier against that reviewed manifest, preserve and pin actual PSD16/PSB32 bytes and independently check in a third-party Photoshop-compatible decoder with provenance.
3. **037C:** true Chromium `file://` UI import → native Worker Fill → Save Project → Undo/Redo, 3 trials per depth and per-pixel clean-photo quality + observational RAM/latency evidence; keep non-peak memory claims honest.
4. **P0 002 / Stage 003:** independently Adobe-authored high-depth compatibility corpus and full system-wide large-ROI/memory constraints remain open.

**Completion criterion:** the CI/unit gate closes only the persisted ZPE native artifact-verification step; real-photo 037, Adobe parity 002 and tiled production 003 stay OPEN.

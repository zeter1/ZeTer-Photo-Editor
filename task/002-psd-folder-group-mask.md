# Stage 17a — native raster mask Photoshop folder groups (v1.47.19)

**Дата:** 2026-11-23. **Base main:** `b9f5503be135f0750ff64337959f86adb98e0e78`, PR #400 MERGED. **Parent CAP:** IN PROGRESS. **Provenance:** synthetic ZPE-produced fixtures, not Photoshop-authored.

## RED и реализация

- RED 3/3: PSD+PSB folder-divider (-2) masks silently lost; sanitizer stripped group raster mask. Code previously only decoded masks from ordinary child layers.
- PSD/PSB `src/formats/psd.js`: decode mask channel from native folder divider into document-sized per-group alpha; retain disabled flag and nested hierarchy; native group folder marker export writes mask channel -2 + bounds, 8-bit and matching document depth, without flattening. Child-layer masks untouched.
- `src/core/state.js`: canonical `group.mask` sanitized through same layer-mask schema; legacy unmasked groups compatible; `.zpe` persistence.
- `src/document/psd-import-controller.js` and `psd-import-semantics.js`: encode native folder group mask into raster data URL for ordinary and embedded PSD imports.
- `src/core/render.js`: mask applied to isolated offscreen group result before group blend/opacity; isolated clipping sibling unaffected. Masked pass-through currently approximates isolated source-over (not full Adobe parity).
- `src/document/psd-export-controller.js`: render document-coordinate group mask alpha; PSD/PSB writer stores editable native folder marker and mask channels.
- `src/layers/command-controller.js`: Group Properties modal enables/disables existing raster folder mask with group lock/owner/no-op guards and History single commit.

## Проверки

- `node --test tests/psd-group-raster-mask.test.mjs`: 5/5 PASS; native PSD/PSB 2x roundtrip, masked nested folders, offset/defaultColor and disabled flags, canonical .zpe sanitize.
- `node --test tests/psd-group-raster-mask.test.mjs tests/psd-masked-group-corpus.test.mjs tests/layer-groups.test.mjs tests/psd-import-controller.test.mjs tests/psd-import-semantics.test.mjs tests/psd-export-controller.test.mjs`: profile 43/43 PASS after legacy absent-mask export fix (earlier 41/41 before adding two tests).
- `npm run test:browser:psd-group-mask`: real headless Chromium production `file://`, 4x2 exact RGBA left [255,127,127,255], right [255,255,255,255]; mask enabled/disabled via group context menu, Undo/Redo, Save Project Blob, reopen .zpe PASS.
- Self-generated fixture oracle != genuine Adobe-authored PSD/PSB pixel reference. Independent exact PR-head Linux core and real-photo workflows needed before merge.

## Ограничения и продолжение

**Не принимается:** настоящая Photoshop-authored pixel parity, background-sensitive mask compositing in pass-through groups, native knockout and complex nested clipping/adjustment. **Следующая реализация:** independent Adobe-origin licensed golden, pass-through backdrop isolation correctness, layered file import-export UI roundtrip and complex nested clipping chain. See [NEXT](NEXT.md).

## 1.47.20 — masked Pass Through against the actual backdrop (2026-11-23)

**Base exact main:** `3a9b025dac3e590d69cd0437effefedaa0e8374b` (#401 already MERGED). **Branch:** `feat/psd-masked-pass-through-backdrop-20261123`. **Parent CAP:** IN PROGRESS.

- **Reproduced RED in real Chromium file://:** under blue document backdrop, a red `multiply` raster child in a native masked `pass-through` folder was incorrectly composited as an isolated source-over layer. Existing child/group raster masks, native PSD/PSB and .zpe records were not replaced or flattened.
- **Implementation:** `src/core/render.js` renders masked Pass Through descendants against a snapshot of the actual parent backdrop, then interpolates between original and adjusted canvases using positioned folder raster-mask alpha and group opacity. Premultiplied alpha interpolation is performed in 256×256 ImageData tiles; disabled masks retain existing unmasked rendering, invalid masks fail closed. Group clipping coverage is computed separately from the backdrop.
- **GREEN real Chromium file://:** 4×2 native .zpe loaded by actual File input; red Multiply child on blue backdrop, folder mask alpha 255/128/0 produced exact RGBA `[0,0,0,255]`, `[0,0,127,255]`, `[0,0,255,255]`. Real Group Properties mask disable and History Undo/Redo PASS; File > Save Project + .zpe reopen maintained mask and pixels PASS. Existing masked isolated group smoke still PASS.
- **Boundary:** this is a synthetic, internal browser pixel oracle and production UI integration, **not** an independent Photoshop-authored golden. Complex nested adjustments/clipping and Photoshop knockout not accepted; transparent backdrop and high-depth native byte semantics need further targeted acceptance. No Photoshop-authored provenance claimed.
- **Remote:** PR-head CI and independent workflow must be evaluated at new branch head; #401 already merged at exact main `3a9b025`. Main CI first run had known 003T Worker lifecycle flake; rerun requested.
- **Publication:** [PR #402](https://github.com/zeter1/ZeTer-Photo-Editor/pull/402) created from new 1.47.20 code. Exact-main `3a9b025` core CI [attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45182533824), independent [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45182533906); initial core attempt known 003T Worker flake. PR-head gates separate.

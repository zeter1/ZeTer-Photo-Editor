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

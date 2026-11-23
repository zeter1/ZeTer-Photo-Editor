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

## 1.47.21 — nested clipped adjustment on a translucent masked Pass Through base (2026-11-23)

**Exact base main:** `ef6070090907b45904da6bda81f793f73f298ffd`. **Branch:** `feat/psd-nested-translucent-20261123`. **Parent CAP:** IN PROGRESS.

- **Bug / baseline:** the clipped adjustment source was seeded from the composite containing backdrop + semitransparent raster base. Inverting red over blue therefore also changed blue outside the base's own color contribution. Existing clipping path multiplied base coverage twice for adjustments. The new pure RGBA contract was RED (missing export) before changes.
- **Code:** `src/core/adjustments.js` transfers the clipped base's **premultiplied RGB delta** (baseAlpha / targetAlpha) to the already composited parent without changing parent alpha; accounts for adjustment opacity and effective mask alpha, no new pixels outside base. `src/core/render.js` now starts a clipped adjustment from its clipping raster base instead of the flattened parent, avoiding applying the clipping coverage twice. Ordinary non-clipped adjustment flow untouched.
- **Node evidence:** three exact unit RGB/alpha oracles (opaque/transparent backing, partial adjustment mask, no base), two PSD+PSB editable nested masked group/clipped Invert structural round trips; focused adjustment/group suites PASS. Third-party Photoshop pixel reference is **not** used here.
- **Real production Chromium `file://`:** native .zpe via File input, nested Pass Through child group, red alpha128 base, clipped Invert, blue alpha128 backdrop, outer folder mask 255/128/0. Exact pixel oracle: `[0,170,255,192]` / `[0,102,255,160]` / `[0,0,255,128]`. Real Group Properties mask toggle and History Undo/Redo PASS; File > Save Project + native .zpe reopen retains nested group/mask, clipping flag, adjustment and pixels PASS.
- **Scope limit:** a clipped raster between the base and adjustment still needs independent composite-stack semantics; non-source-over blend of the clipping base, advanced knockout and exact Photoshop-authored parity are **NOT VERIFIED**. No flatten of PSD/PSB native group/adjustment records.

**Remote gates:** to be filled only after published exact-head GitHub CI and merge checks. Do not treat these local green tests as remote success.

### PR #403 exact-head Linux regression and cumulative clipping fix (2026-11-23)

- Initial PR head `7d980e63d83b674c671c7a2f8187ec54f9dcad3c`: Linux `verify` **FAILED** on real Chromium `test:browser:adjustment-stack`, exact step `Isolated group opacity controls adjustment coverage`; not a flaky infrastructure claim. The first clipped adjustment corrected the translucent backdrop, but a second clipped adjustment still read the original base, not the first correction. Baseline 1.47.20 used an inflated isolated-opacity output 96 over gray128 (now semantically corrected to 64 for black base with 50% folder opacity).
- Fixed production `applyAdjustmentLayer` to transfer the RGB delta into the parent **and** apply adjustment color to the reusable clipped base canvas without changing alpha. The next clipped adjustment uses the accumulated base; raster mask, vector mask and clipping coverage remain stable. Updated real Chromium isolated opacity expected 64/128 and added two-adjustment progressive RGBA Node test.
- Local real Chromium `npm run test:browser:adjustment-stack` **PASS**, including Levels → Curves, nested folder, raster/vector adjustment masks, inspector, History Undo/Redo and ZPE reopen. Nested translucent dedicated smoke **PASS**. Focused Node suites **33/33 PASS**. Added dedicated PR Linux CI step `test:browser:psd-nested-alpha`. Exact corrected PR head and remote statuses must be verified after publication.
- **Limit:** clipped raster layer inserted between adjustments has not been independently accepted; remains next task. Independent Photoshop-authored golden unavailable.

## 1.47.22 — clipped raster Multiply/Screen followed by clipped Invert (2026-11-23)

**Base main:** `fae0d28b7a8d64b93639d27b3d5ee94ff0f58c48`. **Branch:** `feat/psd-clipped-raster-adjustment-20261123`. Parent CAP remains **IN PROGRESS**.

- Baseline: clipped raster child affected the already blended parent but never updated the clipping source. The following clipped adjustment therefore adjusted the wrong RGB, and a partially translucent raster could inflate backdrop alpha. Bounded RED: missing `compositeClippedRasterPixels` export; no prior verified combined browser oracle.
- `src/core/adjustments.js`: blend each raster overlay (with its own alpha/mask/opacity once) into the reusable clipping source RGB, then transfer only premultiplied RGB delta scaled by base alpha / target alpha. Do not multiply base coverage twice or alter source/target alpha; outside-base, zero-overlay-alpha and missing-base are no-ops. `src/core/render.js`: render clipped raster source-over offscreen, apply Multiply/Screen while mutating stack consumed by clipped adjustments.
- **Local** `node --test tests/psd-clipped-adjustment-alpha.test.mjs tests/isolated-raster-clipping.test.mjs`: **16/16 PASS**; includes nested native PSD and PSB codecs for both modes, clipping flags, raster/adjustment records, mask channels. These fixtures are generated by ZeTer, not Photoshop.
- **Actual Chromium file://** `npm run test:browser:psd-clipped-raster`: **PASS** for Multiply → Invert and Screen 50% → Invert. At folder mask 100/50/0% over translucent blue: Multiply [170,170,255,192]/[102,102,255,160]/[0,0,255,128]; Screen [0,170,170,192]/[0,102,204,160]/[0,0,255,128]. Real Group Properties, History Undo/Redo, File > Save Project and .zpe reopen PASS, layer order retained.
- Earlier isolated group clipping `npm run test:browser:psd-isolated` **PASS** and pre-existing nested Invert `npm run test:browser:psd-nested-alpha` **PASS**. New dedicated Chromium CI step added.
- **Remote:** PR-head CI **PENDING/NOT RUN until published**; exact-main and independent workflow for this increment **NOT RUN**. Never infer acceptance from previous commits.
- **Not accepted:** licensed Photoshop-origin pixel comparison, complex knockout and exotic blend modes, UI-mediated native PSD/PSB export/reopen for this exact four-layer stack, and variable overlay raster-mask coverage (only layer opacity and full/zero source alpha in this bounded increment). Continue with native browser PSD/PSB roundtrip + partial per-overlay mask, then independent Adobe oracle if supplied.

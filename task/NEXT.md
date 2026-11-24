# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / Luminosity v1.47.35 acceptance.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — Saturation #417 MERGED; Luminosity #418 existing candidate, no duplicate implementation.
> **BASE MAIN SHA:** 4a776ac085faaeabb6400a5fe71a331bbae79b11.
> **ACTIVE PR:** [#418 Luminosity](https://github.com/zeter1/ZeTer-Photo-Editor/pull/418).
> **LAST VERIFIED:** **Saturation v1.47.34 #417 MERGED; Luminosity v1.47.35 #418 IN PROGRESS.** Saturation exact PR-head `d17b891f86114c5944f078ee504822b6a4cd0aa1`: [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354828671), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354828649), 13/13 checks, clean PR, protected=false, no rulesets. Squash main `4a776ac085faaeabb6400a5fe71a331bbae79b11` tree equals tested Saturation head; exact-main [core PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45355907087), [independent PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45355907082). Hue exact-main [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354421590) and [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45354421602). Fresh Windows tests on Luminosity candidate `c649d5eca2c03366a652a1ea66e735fa08e4ea93`: 14/14 focused (Color/Hue/Saturation/Luminosity + version) PASS; full dedicated Chromium file:// **196 native editable PSD/PSB roundtrips**, 12 Luminosity, 16 mode switches + Undo/Redo, mask, .zpe PASS (77.74s, exit 0). Full Windows npm run check **FAIL: 1828 tests / 1813 PASS / 10 SKIP / 5 Linux-only cgroup/proc FAIL**, no other failing tests. Rebuilt app bundle hash matches candidate. Reconcile #418 with accepted Saturation tree without force; runtime/test/build unchanged; fresh exact-head Linux core and independent workflow required before merge. Parent CAP IN PROGRESS; no Adobe-authored parity or native RGB16/32/CMYK non-separable math accepted.
> **REMAINING ACCEPTANCE:** Saturation exact-main [core PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45355907087), [independent PENDING](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45355907082); #418 reconciled exact-head core and independent CI, review/merge gates, then exact merged-main CI. Windows full check is FAIL, not PASS.
> **NEXT IMPLEMENTATION ACTION:** Accept #418 without duplicating it. Then implement bounded native RGB16 Color blend for eligible flat raster layers (native composite words, opacity/mask, UI/History/.zpe, editable PSD/PSB, independent numerical oracle); keep unsupported group/adjustment/Float32/CMYK paths fail-closed until verified.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference; native high-depth non-separable modes not yet implemented.

## Short queue

1. P1 Luminosity #418 exact-head and exact-main gates.
2. P1 Native RGB16 Color bounded flat-layer composite + PSD/PSB native words.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

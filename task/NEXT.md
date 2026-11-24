# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Issue #115 / recovery snapshot preparation / existing PR #124, v1.47.42.
> **PRIORITY:** P1 (HIGH data safety).
> **STATUS:** IN PROGRESS — ported and focused tests PASS; mandatory acceptance pending.
> **BASE MAIN SHA:** 093f961ad67341feb673ec661cd0b15423b551ee.
> **ACTIVE CANDIDATE:** [#124](https://github.com/zeter1/ZeTer-Photo-Editor/pull/124), fix/recovery-snapshot-preparation-20261008; no duplicate PR.
> **LAST VERIFIED MAIN:** [#423](https://github.com/zeter1/ZeTer-Photo-Editor/pull/423) 42b0afe49a69a444b5e008da7d9a48801620a20d, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45373971603), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45373971594).
> **MERGED CANDIDATE:** [#424](https://github.com/zeter1/ZeTer-Photo-Editor/pull/424), v1.47.41, head f973f0f78738400abdcfe1b40c9635571877ea5f, 13/13 checks, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45376668368), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45376668369). Merged main 093f961ad67341feb673ec661cd0b15423b551ee, identical tree f09685aa24f0b3e0f3d6cd2aa66a6d620e8e35a2, separate [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45377600104) and [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45377600481) pending at readback.
> **IMPLEMENTATION:** Recovery catches synchronous preparation exceptions before storage mutation; previous record retained, warning once, fatal retry lockout survives late success/rejection. Transient IndexedDB write retry remains bounded. Fault injection, not a naturally malformed editor document.
> **EVIDENCE:** On exact #424/main tree RED 17/21 (4 expected failures) -> GREEN 37/37 recovery + RGB16 group regression. Build a04a2ea75e859647. Initial full Windows check 1863 total / 1847 PASS / 10 SKIP / 6 FAIL (5 existing Linux-only proc/cgroup checks plus version marker, corrected and independently retested PASS). Combined browser regression and exact-head Linux core/independent gates required; no gates weakened.
> **NEXT ACTION:** Verify separate #424 exact-main CI, #124 updated exact head core + independent, full browser, diff and merge/review/protection gates. Merge only when all PASS, verify separate merged-main CI, then close #115 if verified. Revert normally if regression.
> **NEXT IMPLEMENTATION ACTION:** Stage 17a bounded native RGB16 isolated separable group blend modes with exact-word independent math, alpha/mask, topology rejections, group Properties/History/.zpe and PSD/PSB roundtrip.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; native nesting/pass-through/clipping/adjustments/Float32/CMYK not accepted.

## Short queue

1. P1 Verify #424 exact-main acceptance.
2. P1 HIGH data safety recovery #115/#124 v1.47.42 exact-head and exact-main acceptance.
3. P1 Bounded native RGB16 isolated separable group blend modes.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

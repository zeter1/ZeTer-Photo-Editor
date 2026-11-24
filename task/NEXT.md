# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / Color Dodge and Burn v1.47.46.
> **PRIORITY:** P1 HIGH native precision.
> **STATUS:** IN PROGRESS - dependent functional candidate; not accepted.
> **LAST VERIFIED MAIN:** [#425](https://github.com/zeter1/ZeTer-Photo-Editor/pull/425) d2e449cd6e834e9c922a46ce806e6949e31f29f4, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45391479624), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45391479743); #115 CLOSED.
> **MERGED, ACCEPTANCE PENDING:** [#426](https://github.com/zeter1/ZeTer-Photo-Editor/pull/426) v1.47.44, head c17314f7e5aef027651a46e1adf2ca27bf62ef96, [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45392483434), [independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45392483196), 13/13 checks. Main f5354164bbcc239f10d3987f09efd229b42e4b6e, identical tree 8c3b13e6d7da99ac8f00bc3ff83c6cac7b49824c; [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45396060659), [independent](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45396060528) pending at readback.
> **PREDECESSOR:** [#427](https://github.com/zeter1/ZeTer-Photo-Editor/pull/427) draft, exact head 62ec208de5d392ffdbf129037952e12bd6f5b559 tree 6c6ca9211a1a92e7b317f65779752dbd96ac2b1f. Five separable modes; stacked on #426 head. After #426 exact-main PASS, forward-port without force and retarget to main; fresh head/main checks mandatory.
> **ACTIVE CANDIDATE:** feat/psd-rgb16-isolated-dodge-burn-20261124-pass3, based on #427 exact tree; not main.
> **IMPLEMENTATION:** W3C Compositing 10.1.7-8 backdrop extrema take precedence at source singularities (black/white Dodge, white/black Burn). Both modes use the shared typed path for one bounded root isolated contiguous encoded sRGB16 raster folder; straight alpha, group opacity and prepared mask once, exact merged/editable PSD/PSB words. Fail closed outside supported native topology; no Canvas8 fallback.
> **EVIDENCE:** RED 14/18 -> GREEN 18/18; 28/28 focused incl. high-depth compositor, version 1/1; deterministic build a6546cbc9a135fc3. Full dedicated Chromium file:// PASS exit 0, both Dodge/Burn as final group modes, Properties, preview, Undo/Redo, .zpe, PSD and PSB exact raw words and editable reimport. Windows npm run check FAIL: 1873 total / 1858 PASS / 10 SKIP / 5 pre-existing Linux-only proc/cgroup FAIL. Synthetic arithmetic oracle, not Adobe-authored parity. No gates weakened.
> **NEXT ACTION:** Verify #426 separate exact-main core and independent. Integrate #427 onto accepted main without force; retarget to main, fresh exact-head core/independent, review/protection, guarded merge, exact-main CI. Then forward-port this candidate and repeat acceptance; never merge into an unaccepted predecessor.
> **NEXT IMPLEMENTATION ACTION:** After bounded modes accepted, CAP-PSD-NATIVE-NESTED-ISOLATED-RGB16: support a bounded two-level Normal isolated group hierarchy with contiguous native sRGB16 raster children, independent word-domain oracle for inner/outer masks and opacity, child ordering, negative topology and exact PSD/PSB editable hierarchy; UI History/.zpe. Verify scope against actual sources and matrix first.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; nested/pass-through/clipping/adjustments/ICC/Float32/CMYK outside this bounded native contract.

## Short queue

1. P1 #426 exact-main acceptance.
2. P1 #427 retarget/integration and exact head/main acceptance.
3. P1 Color Dodge/Burn candidate exact head/main acceptance after #427.
4. P1 CAP-PSD-NATIVE-NESTED-ISOLATED-RGB16 (bounded next implementation).
5. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
6. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

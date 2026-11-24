# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-BLEND-MODES / Color Dodge and Burn v1.47.46.
> **PRIORITY:** P1 HIGH native precision.
> **STATUS:** IN PROGRESS — #428 integration candidate, fresh exact-head acceptance required.
> **LAST VERIFIED MAIN:** [#427](https://github.com/zeter1/ZeTer-Photo-Editor/pull/427) ACCEPTED: main `ecf3df2c0dd1bf7dfe8d0a21ee8c3649368ea9b3`, tree `eaaa4304deae90d15775d8feeab8532b9d0e1820` identical to tested head `062c7ba7dffdc8d587a20220a09bc7916ca3ed91`; [main core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45407112359), [main independent PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45407112360).
> **BASE MAIN SHA:** ecf3df2c0dd1bf7dfe8d0a21ee8c3649368ea9b3
> **ACTIVE CANDIDATE:** [#428](https://github.com/zeter1/ZeTer-Photo-Editor/pull/428), feat/psd-rgb16-isolated-dodge-burn-20261124-pass3; original tested runtime tree ab3476adf3987475ec66de36e4a13a50c684b5bf; only task documentation differs in integration.
> **IMPLEMENTATION:** bounded single root isolated contiguous encoded sRGB16 raster group Color Dodge/Burn. Shared compositor correct W3C backdrop endpoint precedence, straight alpha, group opacity and prepared mask once, exact PSD/PSB merged and editable native words, fail closed outside supported topology.
> **EVIDENCE:** Original #428 candidate `566ec2ce9c0ebcd81f739c29e9811359c9a805a0` tree `ab3476adf3987475ec66de36e4a13a50c684b5bf` identical to clean local `b0ead341b2313362ef4cc89a80f682f39a3f7efd`; fresh Windows Node v24.13.0 focused 18/18 PASS. Prior RED 14/18 → GREEN 18/18, focused 28/28 + version 1/1, build `a6546cbc9a135fc3`, full dedicated live Chromium file:// PASS (both modes, Properties, preview, History, ZPE, raw PSD/PSB words and editable reimport). Prior Windows full check FAIL: 1873 total / 1858 PASS / 10 SKIP / 5 existing Linux-only proc/cgroup FAIL. Original and integration runtime/test/generated blobs identical; fresh exact-head CI required. Synthetic oracle, not Adobe-authored parity.
> **NEXT ACTION:** Retarget #428 to main; fresh exact-head core and independent CI, review/protection/checks, guarded merge, then separate exact-main CI. Branch readback protected=false, protection.enabled=false, rulesets empty (classic admin protection endpoint 403). Never merge red/pending.
> **NEXT IMPLEMENTATION ACTION:** Existing local successors, not published: v1.47.47 Normal-only `93e3f21c13674b688696b66d86af0441e28d41db` tree `45f940954cc3f4d855fc83aa0dcef50fa415df13` (prior targeted 20/20, adjacent 14/14, full Chromium PASS); v1.47.48 two-level Normal `ab2cbe452dd462c8cc3516c4745c0526ab091be8` tree `a011d438178d81478f02d3f6dd311bec75d2a267` (prior focused 24/24, expanded 65/65, dedicated Chromium PASS, Windows full check 5 Linux-only FAIL). Integrate sequentially after predecessors accepted; do not duplicate.
> **BLOCKERS:** Adobe-authored clipping/knockout oracle; genuine camera DNG/LibRaw; nested/pass-through/clipping/adjustments/ICC/Float32/CMYK outside this bounded native contract.

## Short queue

1. P1 #428 exact-head/main acceptance on accepted #427 main.
2. P1 integrate existing v1.47.47 Normal-only candidate after #428 acceptance.
3. P1 integrate existing v1.47.48 bounded two-level Normal candidate after v1.47.47 acceptance.
4. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
5. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).

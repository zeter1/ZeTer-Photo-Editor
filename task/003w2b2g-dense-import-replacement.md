# 003W/2b-2g — Real dense Worker replacement by authorized PSD/PSB import

**Priority:** P1. **Status:** TODO (2026-10-22).
**Parent:** [003W Chromium native selection responsiveness](003w-browser-selection-freeze-responsiveness.md), Stage 6.
**Predecessor:** [003W/2b-2f File → New replacement](003w2b2f-dense-owner-replacement.md), PR [#313](https://github.com/zeter1/ZeTer-Photo-Editor/pull/313) merged.

## Goal

A user-authorized **File → Open PSD/PSB** import while the original 1.9M–2M selection native tiled production Blob Worker is in flight. This differs from File → New: PSD/PSB decode, preview generation, async continuation/owner and replacement preflight provide independent opportunities for stale writes. Do not silently count tab close, tab switch or File → New as this scenario.

## Acceptance

1. Two fresh isolated Chromium `file://` scenarios, **PSD16 and PSB32**, imported with actual 1450×1400 ZeTer native tiled sources. Retain exact source bytes, alpha, UI preview, History and original owner; run actual ~1,973,400 frozen Uint32 native Worker indices before any replacement decision.
2. Trigger real File → Open PSD/PSB UI while old Worker is in flight. Rejected dirty confirmation must preserve old Worker, no cancel/terminate/new import, identity, History and native bytes. Then accepted confirmation of a **distinct** PSD/PSB (different name/preview/content or dimensions, independently recognized as high-depth source) must safely revoke the old Worker lease and prevent stale old postMessage/preview/History publication.
3. Verify replacement native document by exact tiles/alpha/preview/History after bounded settle; newly authorized import cannot be overwritten by an old Worker reply, even when decode/preview awaits. Do not weaken limits (2,000,000 selection or 180s timeout) or bypass user confirmation. Preserve normal error and cancellation semantics if decode fails.
4. A separate genuine dense Blob Worker Fill on the newly imported high-depth owner succeeds; changed native bytes confined to the fresh selection, alpha unchanged, one History entry, byte-exact Undo and Redo. Verify no late stale result, no ghost tab and valid ownership.
5. Independent fail-closed PSD16/PSB32 JSON receipts: no fake Worker callbacks, actual dispatch/terminate/reply and imported identity. Preserve observational 8ms timer and JS heap bounds; **do not** claim isolated operation CPU/RSS peak, Worker→PID mapping or independent Photoshop-authored PSB32.
6. Unit test authorizer path (refusal/acceptance, decode failure, stale owner race), `npm run check`, file:// browser artifacts, exact PR-head CI, real-photo, merge and exact main CI. If import is intentionally guarded and cannot replace in flight, add narrowly-scoped cancellable-lease correction and regression; do not relax guards for other raster operations.

## Notes

Start with `src/document/psd-import-controller.js`, `src/main.js`, `src/painting/command-controller.js`, `tools/browser-near-cap-ui-smoke.mjs`, and strict 003W/2b-2f evidence. Parent 003W/003T/Stage 003 remain OPEN. Independently Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED by missing provenance.

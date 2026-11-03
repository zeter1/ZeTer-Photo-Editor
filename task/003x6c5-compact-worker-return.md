# 003X/6c-5 — compact native Worker result ownership

**Date:** 2026-11-03. **Priority:** P1. **Status:** IN PROGRESS pending PR CI/merge/exact-main gates. **Depends on:** 003X/6c-4 DONE; parent 003X/6c and Stage 6 IN PROGRESS. **Related blocker:** genuine independently Adobe Photoshop-authored PSB32 fixture 002B/2c BLOCKED.

## Goal and acceptance
Avoid redundant full native v2 Data URL source *return* structured clone from tiled Content-Aware Fill Worker when a local edit changes only a small number of tiles. Preserve the unchanged UI-side source, exact 16/32-bit RGB/CMYK samples (including alpha, Float32 signaling NaN and -0), cancellation, stale-session safety, History Undo/Redo, and .zpe v1/v2. Do not claim measured whole-process RAM/Worker RSS caps. Finish after PR-head Linux core 12-job workflow, independent real-photo, and successful exact-main verification.

## Measured real path
The UI sends a frozen, detached source and Uint32 selected pixel indices to a genuine Worker. The old Worker protocol returned a complete `result.source` array (unchanged native tile Data URLs plus changed tiles). Before this pass, for the 131×99 / tileSize 32 fixture editing exactly one native tile, JSON.stringify of actual unmodified protocol replies counted **141014 chars (RGB16)** and **348547 chars (CMYKA32 Float32)**. Compact replies counted **11072** and **27456** chars respectively, containing just one changed tile plus counters (about 92% smaller JSON character count). Those counts characterize reply content, **not actual structured-clone byte layout, GC lifetime, global JS heap, RSS, or isolated Worker PID**. The input clone still contains the original source, and an immutable History snapshot may retain another entire serialized project; this pass does not bound those owners.

## Production changes
- `src/core/tiled-inpaint-worker-protocol.js`: when requested with `compactResult:true`, produce `tileUpdates: [{index,dataUrl}]` and counters instead of returning the complete full source; legacy non-opted-in callers retain the original result format.
- `src/painting/tiled-inpaint-dispatch.js`: production UI opts in to compact replies; reconstructs a complete source from existing UI-side unchanged tile owners only after validating compact patch structure (count/unique/index/dataUrl), and then subjects it to the unchanged strict byte-exact native Worker result validator. Legacy full-source stubs and supplier-unavailable CPU fallback still work.
- `tools/browser-real-photo-switch-failure.mjs`: instrumented real-photo Chromium Worker response probes accept the newly opted-in compact reply as genuine (while retaining legacy full-source support), and malformed alpha/nonfinite/outside-ROI/counter injections mutate the actual changed tile patch without bypassing strict validation. First PR run [real-photo #41603944177](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41603944177) failed on a stale full-source-only observational assertion, not a native pixel mismatch; amended PR-head CI is required before acceptance.
- `tests/003x6c5-compact-worker-return.test.mjs`: independent raw-byte oracles covering RGB16 and CMYKA32 Float32 sNaN/-0/alpha, 32/65/256 tile sizes, unchanged tile identity, actual Node Worker and structured clone, malformed duplicate/bounds/alpha payload, cancellation/stale/failure retry, History Undo/Redo and JSON .zpe v1/v2.
- Generated `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json` from `npm run build`; no new dependency, no .zpe/PSD/PSB schema change.

## Local verification
- Focused `node --test tests/003x6c5-compact-worker-return.test.mjs tests/tiled-inpaint-worker-protocol.test.mjs tests/tiled-inpaint-ui-dispatch.test.mjs`: **24/24 PASS**.
- Windows `npm run check`: **1551 PASS, 10 SKIP, five pre-existing Linux-only /proc/cgroup-fixture FAIL**; generated build manifest **e6dacd54c2325ca9**. This is not a Linux CI success.
- Real Windows Chrome `file://` `npm run test:browser`: **PASS**, including high-depth PSD16/PSB32 native Worker, cancellation/recovery, owner switch, Undo/Redo and .zpe.
- **GitHub CI:** not yet established by these local checks. **PR merge:** pending. **Exact merged-main CI:** pending.

## Remaining scope / next handoff
Actual simultaneous History snapshot residency, Worker input-side full-source clone, peak JS heap/OS RSS and Worker-PID attribution remain **unmeasured or unbounded**. Investigate **003X/6c-6 P1**: quantify/history and Worker *input*-side duplicated source strings and prove one narrower safe ownership/budget improvement, with opt-in failure preflight and the same independent CI. Do not remove immutable History snapshots or conflate clone reply savings with RAM peak. After acceptance, update this file, task/NEXT.md, task/README.md, and parent task with PR and exact-main links.

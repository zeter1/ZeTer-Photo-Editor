# 003X/6c-6 — quantify Worker input clone and History source ownership

**Date:** 2026-11-03. **Priority:** P1. **Status:** BOUNDED DONE (PR #363 merged, exact merged-main core 12/12 + independent real-photo SUCCESS). **Depends on:** 003X/6c-5 BOUNDED DONE, [PR #361](https://github.com/zeter1/ZeTer-Photo-Editor/pull/361); parent 003X / Stage 6 IN PROGRESS. **Independent blocker:** 002B/2c independently Photoshop-authored PSB32 fixture BLOCKED.

## Goal and acceptance
Measure the full native input Data URL clone and independent History snapshots. Implement one strictly opt-in pre-dispatch budget with native RGB16/CMYKA32 Float32 byte integrity, no selection/Worker launch on refusal, cancellation/stale/late failure recovery, Undo/Redo, .zpe v1/v2 and offline file:// regression. Do not conflate serialized character counts with actual V8 heap/RSS/Worker PID. Final acceptance requires PR-head Linux core 12 jobs, independent real-photo, merge, and exact merged-main core + real-photo.

## Measured owner scopes
Actual native 131×99, tile size 32, one edited pixel (20 tiles) constructed with RGB16 RGBA and CMYKA32 Float32, including alpha signaling NaN payload, negative-zero and last edge-tile alpha payload:
- RGB16: UI retained tile Data URLs **139,352 ASCII characters**; an actual structuredClone of the input retains **139,352 URL characters**; separately held History JSON snapshot **140,957 characters**.
- CMYKA32 Float32: UI native URLs **346,856 characters**; independently cloned input URLs **346,856 characters**; independent History JSON snapshot **348,490 characters**.
- The full input clone remains necessary for one-shot Worker computation; the compact 6c-5 **reply** does not reduce input cloning. These figures describe UTF-16 code-unit counts in immutable ASCII Data URL fields and JSON strings, **not measured physical memory/heap/RSS**. No global residency bound is claimed.

## Production candidate
- `src/painting/tiled-inpaint-dispatch.js`: new optional `maxWorkerInputDataUrlChars` enforces a strict aggregate count of all native tiled URL characters after source validation but **before the first selection predicate, async yield, Worker request or document mutation**. Short-circuits on overflow with `RangeError`. Null/default leaves existing dense behavior unchanged; Worker-unavailable CPU path is not subject to a Worker-input-only budget.
- `src/painting/controller.js`: exposes the opt-in bound through `persistTiledHighDepthInpaint`. No default UX changes, schema modifications or new dependencies.
- `tests/003x6c6-worker-input-budget.test.mjs`: independent native RGB16/CMYKA32 bit-oracles, exact threshold/refusal/acceptance, input structuredClone evidence, independent History Undo/Redo, .zpe v1/v2, invalid cap, controller forwarding, late error/retry and cooperative cancellation/owner stale cases.
- Deterministic offline generated bundle: `src/app.bundle.js`, `index.html`, `version.json`, build `43f8b4d1cfb6d7b8` (Worker source unchanged).

## Verification status
- **Before changes:** 17/17 relevant focused tests PASS.
- **After changes:** 20/20 focused tests PASS (including existing 6c-5 + tiled dispatch). Initial new test typo was corrected before final focused run.
- Windows `npm run check`: five previously known Linux-only `/proc`/cgroup fixture tests FAIL on Windows; not a clean cross-platform result. Linux CI authoritative for acceptance.
- Windows real Chrome `file://` `npm run test:browser`: **PASS (exit 0)**, including actual native Worker, high-depth PSD16/PSB32 synthetic fixture import, cancellation/owner switch, Undo/Redo and recovery. These are ZeTer-authored fixtures, not independently Adobe-authored PSB32.
- GitHub [PR #363](https://github.com/zeter1/ZeTer-Photo-Editor/pull/363), branch `feat/003x6c6-worker-input-budget-20261103`, initial commit [`21417c8`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/21417c85e70c48ca17d53dd4c7cc213a56bbbe05). Final PR head `d14a4caae67fabb87acba324b9dedb7a6dece16d`: [Linux core #41613692664](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41613692664) **SUCCESS 12/12**, independent [real-photo #41613692798](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41613692798) **SUCCESS**; no blocking reviews/threads. Squash-merged [PR #363](https://github.com/zeter1/ZeTer-Photo-Editor/pull/363) to [main `d68880c`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/d68880c09a3566c230b9b56c15cb3a877270d0ab). **Exact merged-main `d68880c`:** [Linux core #41614822281](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41614822281) **SUCCESS 12/12** and independent [real-photo #41614822175](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41614822175) **SUCCESS**.

## Scope still open
The cap is opt-in and bounds *accounted Worker input URL characters*, not live Worker memory, JS heap/RSS, string deduplication, History snapshots or OS-level peaks. History keeps full immutable JSON snapshots. For the next bounded task **003X/6c-7 P1**, investigate incremental/structural sharing for immutable History native URLs with exact reconstruct/Undo/.zpe/failure gates, only if independently measurable and semantics remain intact. Preserve Photoshop-authored PSB32 provenance blocker 002B/2c.

## Handoff
003X/6c-6 P1 BOUNDED DONE. **NEXT 003X/6c-7 P1 TODO:** [investigate immutable History native URL snapshot owners](003x6c7-history-snapshot-ownership.md), with independent exact-retention evidence and an atomic improvement if justified. Parent Stage 6 / 003X IN PROGRESS; Adobe-authored PSB32 provenance 002B/2c BLOCKED.

# 033 — Gradient persisted command: exact-owner async publication

Status: pending  
Priority: next bounded refactor/reliability pass  
Baseline: `main@c7ca787409cefab86c3be63342b4a3a9edd181c1` is green after Crop interaction extraction.

## Goal

Extract the persisted Gradient “create raster layer” transaction out of `src/main.js` into one focused owner and close the stale-document publication window around the asynchronous PNG serialization step.

Preferred owner: `src/painting/gradient-command-controller.js` unless fresh inspection proves a better existing domain boundary.

Keep this pass bounded. Do **not** simultaneously extract generic Shape/Line preview surfaces, redesign selection clipping, or invent a generic drawing-command framework.

## Why now / evidence

Fresh `main` still contains `applyGradient(start,end)` in the composition root.

Current flow:

1. reads global `doc`, tool colors/opacity/type and the live selection;
2. rasterizes the gradient into a temporary Canvas;
3. sets the shared `paintPersisting` guard;
4. `await canvasToDataURL(...)`;
5. after the await, reads global `doc` again and publishes a new Raster layer + history.

The pointer drag is currently `{kind:'gradient', start, current}` and does not capture its originating document.

That creates a concrete ownership risk: a document/tab replacement during PNG encoding can let a command prepared for document A resume against document B. At minimum, layer dimensions/publication target are read from mutable global state after an await.

This is higher-value than another cosmetic split because it combines composition-root reduction with an async stale-owner correctness guard.

## Inspect first

Read only the relevant current surfaces:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/development/QUALITY_PLAYBOOK.md`
- `src/main.js`: Gradient pointer-down/move/up, `previewGradient`, `applyGradient`, `paintPersisting`, selection clip bridge
- `src/painting/controller.js`
- `src/painting/command-controller.js`
- `src/painting/gesture-controller.js`
- `src/selection/gesture-controller.js` only as needed to understand the selection clip contract
- tests mentioning Gradient, `applyGradient`, `paintPersisting`, source slicing / VM harnesses and architecture ownership
- `tools/build-bundle.mjs`
- current Actions workflow before writes

Search repo-wide for every `applyGradient`, `previewGradient`, `kind:'gradient'`, `paintPersisting`, `clipContextToDocumentSelection`, `canvasToDataURL` reference before planning the write.

## Behavioral contracts to preserve

Unless current tests/code prove otherwise, preserve:

- drag distance below 2 px is rejected with status `Градиент: протяните линию по холсту`;
- an already-running shared raster persistence operation is rejected with `Сохраняется предыдущая растровая операция…`;
- linear/radial choice follows the current Gradient control;
- primary color is stop 0;
- secondary color is stop 1 with existing `#ffffff` fallback;
- tool opacity maps to Canvas `globalAlpha`;
- the current document selection clips the rasterized gradient exactly as today;
- a successful command creates one Raster layer named `Градиент` at `x:0,y:0` with the originating document dimensions;
- success clears the shared raster edit buffer, publishes exactly one `Добавить градиент` history entry and status `Градиент добавлен на новый слой`;
- encoding failure logs the error, shows `Не удалось создать градиент` as an error toast, publishes no layer/history and always releases the busy guard;
- preview visuals and pointer coordinates remain behaviorally unchanged unless a failing regression proves a current bug.

## Correctness requirements

The persisted command must follow **capture → prepare → await → revalidate → publish**:

1. capture the exact originating document object before the async command starts (preferably in Gradient drag state at pointer-down);
2. reject if that exact owner is not active before preparation;
3. use captured owner dimensions for temporary raster preparation;
4. after `await canvasToDataURL`, revalidate exact object identity immediately before the first persisted write;
5. stale/replaced owner => no `addLayer`, no history, no success status, no redirected publication;
6. same-id-but-replaced document objects are still stale;
7. busy state is released in `finally` on success, stale abort and errors.

Do not rely on UI/tool state alone as the stale guard.

## Planned extraction

Prefer a controller with explicit grouped ports:

- state: current document / exact-owner check;
- raster preparation: Canvas factory or narrowly injected browser raster adapter as needed;
- selection clipping: explicit current-selection bridge, only while the captured owner is proven current;
- IO: `canvasToDataURL`;
- model: `createRasterLayer` / `addLayer`;
- shared raster persistence guard + buffer cleanup;
- transaction/history;
- status/toast/logging.

Stable pure/domain dependencies may be direct imports where that matches existing architecture. Keep effectful browser/runtime state behind ports.

Do not move `previewGradient` merely to make the controller larger. If preview extraction is independently valuable, leave it as a later task.

## Targeted tests

Add a direct controller test suite that independently covers:

- required bridge validation;
- <2 px no-op/status;
- busy rejection;
- linear and radial gradient geometry;
- primary/secondary color + fallback + opacity;
- selection clipping bridge use;
- successful Raster layer schema/dimensions + exactly-one history publication;
- encoding failure cleanup/no publication;
- exact originating owner;
- document switch while `canvasToDataURL` is intentionally delayed;
- same-id replacement while delayed;
- busy guard released for success/error/stale outcomes.

Retarget any source-contract / VM tests that assert the old `main.js` implementation. Do not add compatibility globals just to keep a source-sliced harness green.

Keep one architecture guard proving:

- the canonical controller is in the build graph;
- persisted Gradient publication no longer lives in `src/main.js`;
- `src/main.js` supplies the captured owner and presents controller outcomes;
- preview behavior remains in its declared owner.

## Documentation

Update in the same PR:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md`

Create a separate Gradient spec only if the pass discovers a stable multi-owner contract that would otherwise be expensive for future AI/Codex sessions to reconstruct. Follow the progressive-disclosure rule; do not duplicate prose mechanically.

## Required verification

Before merge:

1. direct Gradient controller tests;
2. adjacent painting/selection/pointer tests;
3. architecture/source-contract tests;
4. `npm run check`;
5. canonical generated-artifact parity;
6. `npm run test:browser`;
7. `git diff --check`;
8. exact PR-head CI green.

After merge:

9. exact merged-`main` SHA CI green.

Only then delete this task and create exactly one next bounded task from fresh `main` evidence.

## Done gate

Done only when persisted Gradient publication has one explicit exact-owner async transaction boundary, the old global-after-await mutation path is absent from `src/main.js`, behavior regressions are green, generated artifacts are canonical, docs route future agents to the new owner, PR-head CI is green, merge is complete and merged-main CI is green.

## Risks / handoff notes

- `paintPersisting` is shared policy; do not accidentally create an independent Gradient-only busy flag that permits overlapping raster persistence.
- Selection clipping is current-document state. Prove owner identity immediately before consuming it; do not serialize a live selection object across the await.
- A local Canvas/data URL is preparation, not permission to publish.
- Do not replace exact object identity with IDs or structural equality.
- Source-sliced tests may need explicit new controller dependencies; fix the oracle, not production code.

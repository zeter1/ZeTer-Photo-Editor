# Gradient persisted command contract

This specification is the narrow source-of-truth for **persisted Gradient publication**. Read it when changing Gradient pointer release, PNG serialization, selection clipping, raster-layer creation, or async document ownership. Do not use it as a reason to load unrelated painting code.

## Ownership map

| Concern | Canonical owner |
|---|---|
| Gradient pointer/tool dispatch and drag object | `src/main.js` |
| Gradient visual preview while dragging | `src/main.js::previewGradient` |
| Persisted Gradient raster transaction | `src/painting/gradient-command-controller.js` |
| Shared Canvas/high-depth edit buffers | `src/painting/controller.js` |
| Selection path/clip state | selection/runtime boundary in `src/main.js` |
| Raster-layer schema + insertion | `src/core/state.js` |
| PNG Canvas serialization | `src/core/io.js` through the controller IO port |
| History/dirty publication | runtime `commit` port |

The persisted command must not become a second preview owner, selection owner, history store, or independent raster-persistence guard.

## Required transaction pattern

Gradient publication crosses an asynchronous PNG-encoding boundary. The command therefore follows:

`capture exact owner → validate → acquire shared busy guard → prepare → await encode → revalidate exact owner → publish → finally release guard`

The originating document object is captured in the Gradient drag at pointer-down and passed unchanged to the command on pointer-up.

### Exact-owner invariant

Authority is **object identity**, not document name, ID, dimensions, tab index, or structural equality:

`state.getDocument() === owner`

A document switch or a same-ID replacement makes the command stale. A stale command must publish **no layer, no history entry, no success status** and must never redirect its result into the newly active document.

Selection state is live current-document state. The command must prove that the captured owner is still active immediately before consuming the selection clip. It must repeat exact-owner validation immediately after `await canvasToDataURL(...)` and before the first persisted write.

## Preserved behavior

- Drag distance below 2 px: no write; status `Градиент: протяните линию по холсту`.
- Shared raster persistence already active: no write; status `Сохраняется предыдущая растровая операция…`.
- Type `radial` uses start point + drag distance; every other value follows the linear start→end path.
- Stop 0 uses the primary color.
- Stop 1 uses the secondary color with `#ffffff` fallback.
- Tool opacity maps to Canvas `globalAlpha`.
- Current document selection clips the prepared raster.
- Success creates exactly one Raster layer named `Градиент`, at `x:0,y:0`, with the captured owner's width/height.
- Success clears the shared raster edit buffer, commits exactly one `Добавить градиент`, then reports `Градиент добавлен на новый слой`.
- Encoding/preparation failure logs the error, shows `Не удалось создать градиент` with error tone, publishes no layer/history, and releases the shared busy guard.
- The busy guard is released in `finally` on success, error, and stale abort.

## Change rules

When modifying this path:

1. keep preview extraction separate unless preview itself is the task;
2. never read mutable global `doc` after an await to choose the publication target;
3. never recover authority by matching an ID after the captured document object was replaced;
4. never add a Gradient-only persistence flag — use the shared runtime guard;
5. do not serialize a live selection object across the await; consume selection only while exact owner is current;
6. do not add compatibility globals to satisfy source-sliced tests — update their explicit harness dependencies;
7. keep generated `src/app.bundle.js` canonical through `tools/build-bundle.mjs`.

## Verification routing

Primary regression: `tests/gradient-command-controller.test.mjs`.

Also run:
- `tests/pointer-release-tools.test.mjs` for final release position + owner handoff;
- `tests/architecture-layout.test.mjs` for build graph/ownership drift;
- adjacent painting, selection and async-document tests;
- full `npm run check`;
- canonical generated-artifact parity;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI and merged-main CI.

If a future change adds another async publication step, reapply the exact-owner check immediately before every first persisted write after that await boundary.

# Task 038 — Bind async Selection Clipboard copy/cut to originating context and frozen selection semantics

## Goal

Make Selection Clipboard copy/cut one deterministic async command transaction: the pixels written to the Clipboard, the document/layer authority used after awaits, and the selection geometry used by a later Cut must all come from the same originating user intent.

Task 037 / PR #63 is complete and verified on merged `main@cb61db64532a2d92ea05dd3ce17583dec81e705f` with merged-main CI run #360 green. Task 037 froze selection semantics inside the merged raster batch itself; this task addresses the higher-level Clipboard orchestration boundary that can await before that batch begins.

## Why now / fresh-main evidence

Fresh-main review after Task 037 found a distinct async ownership seam in `src/selection/clipboard-controller.js`:

- `copySelectionToClipboard()` captures only `selectionRect`, the selected layer reference and copy mode, then crosses Clipboard/render awaits.
- merged copy calls `renderSelectionMergedToPng(bounds)`, which awaits `renderDocument(full, getDocument(), ...)` and only afterwards calls `clipContextToDocumentSelection(ctx)`; that clipping bridge reads the live selection shape.
- after `await navigatorTarget.clipboard.write([item])`, merged Cut calls `clearSelectionAcrossVisibleLayers(...)`; Task 037 correctly snapshots the selection at *that later moment*, which may no longer be the selection that produced the Clipboard pixels.
- selected-layer Cut similarly calls `clearSelectedPixels(...)` after Clipboard write; that downstream command resolves current live document/layer/selection state unless the caller provides stronger captured authority.
- successful copy/cut finally clears selection state and switches tools; without stale-context validation, completion of an older async Clipboard action can overwrite newer UI state after a tab/selection change.

This means exact lower-level publication safety is necessary but not sufficient: the **actual user-intent boundary** must freeze semantic inputs and ownership before the first unrelated await.

Current code/logs/tests remain authoritative; re-inspect before implementation.

## Scope

1. Capture at Clipboard command start:
   - exact originating document object;
   - exact active session;
   - one full cloned canonical selection shape, not bounds alone;
   - pixel bounds derived from that snapshot;
   - copy mode;
   - exact selected layer object when selected-layer mode is used.
2. Render copied PNG pixels from those captured values only:
   - merged rendering uses the captured document;
   - selection clipping uses the captured full shape explicitly;
   - selected-layer rendering stays bound to the captured exact layer.
3. After every relevant await and before any stateful continuation, revalidate the originating context required for that continuation.
4. For Cut, delete pixels using the **same captured selection semantics** that generated the Clipboard payload:
   - extend narrow downstream ports as needed so merged raster clear and current-layer clear can consume a caller-supplied frozen selection snapshot instead of re-snapshotting newer live selection;
   - keep canonical geometry ownership in existing selection helpers; do not duplicate point-in-shape/path math in the Clipboard controller.
5. Preserve Task 036/037 exact-target/all-or-none publication and high-depth/native precision contracts.
6. A stale Clipboard action may already have written the copied image to the OS Clipboard, but it must not then mutate a newer document, newer same-ID target, newer selection/tool state, or publish stale history/success.
7. Keep browser Clipboard API ownership in `src/selection/clipboard-controller.js`.
8. Preserve copy-before-destructive-cut ordering, browser permission/error behavior and existing Russian user messaging unless a stale-specific message is required for correctness.
9. Update focused architecture/AI/test documentation only where the cross-controller intent-boundary rule would otherwise need rediscovery.

## Non-goals

- Rewriting Clipboard paste/import behavior.
- Changing Clipboard MIME formats.
- Introducing a global immutable selection store.
- Blocking all selection or tab UI while Clipboard work is pending.
- Redesigning selection geometry.
- Weakening Task 036 exact-target validation or Task 037 frozen batch semantics.
- Refactoring unrelated mask/vector-mask/painting/PSD code.
- Adding a generic transaction framework without concrete repeated need.

## Inspect first

- `AGENTS.md`
- `docs/PROJECT.md`
- `task/README.md`
- this task only from the task queue
- `src/selection/clipboard-controller.js`
- `src/selection/raster-mutation-controller.js`
- `src/painting/command-controller.js`
- selection snapshot/clipping helpers and controller wiring in `src/main.js`
- `tests/selection-clipboard.test.mjs`
- `tests/async-document-context.test.mjs`
- `tests/selection-raster-mutation-controller.test.mjs`
- `tests/painting-command-controller.test.mjs`
- `tests/selection-types-v119.test.mjs`
- `tests/architecture-layout.test.mjs`
- `docs/architecture/RASTER_PERSISTENCE.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `.github/workflows/ci.yml`

## Behavioral contracts to preserve

1. Copy still writes Clipboard pixels before Cut mutates document pixels.
2. Merged copy still renders the complete document pipeline; selected mode still copies only the chosen layer.
3. Non-rectangular selection geometry remains exact; same bounds with different ellipse/lasso/polygon semantics must not collapse to rectangle semantics.
4. One Cut remains one intended history transaction for its destructive mutation path.
5. Task 036 remains intact: merged multi-target publication is exact-document/session/target-set/effective-lock all-or-none.
6. Task 037 remains intact: one merged raster clear uses one frozen selection semantic snapshot.
7. Native 16/32-bit RGB/CMYK clear paths remain native where currently supported.
8. A newer live selection/tool/tab created while an old Clipboard operation is pending must survive that older operation.
9. Same-ID document/layer replacements are stale; IDs alone never authorize a late Cut.
10. Clipboard permission/render failures remain observable and cause no destructive cut.

## Planned direction

Prefer a narrow command-context value captured once at `copySelectionToClipboard()` entry, for example an immutable object containing owner/session/selection snapshot/bounds/mode/exact selected target.

Pass that context explicitly through rendering and destructive ports. Do **not** let helpers silently fall back to `getDocument()`, live selection shape or current selected layer after the command has crossed an await.

For lower-level destructive commands, prefer optional explicit caller authority/snapshot parameters that preserve existing direct callers while making the Clipboard path mechanically incapable of re-reading live semantic input.

## Required deterministic regressions

Use controlled deferred Promises, not sleeps. At minimum cover:

- merged copy: change live selection after `renderDocument()` begins; final PNG clipping still uses the original full shape;
- merged Cut: change/clear live selection while Clipboard write is pending; destructive clear receives the original captured shape and newer live selection remains untouched;
- merged Cut: switch tabs or replace the document with a same-ID object before Clipboard write resolves; no destructive mutation/history/tool/selection cleanup lands in the newer context;
- selected-layer Cut: same-ID selected-layer replacement while Clipboard write is pending is stale and receives no pixel mutation/history;
- selected-layer Cut: live selection changes to same bounds but different geometry; copied and deleted pixels still use the same original geometry;
- successful non-stale copy/cut preserves existing Clipboard-before-cut ordering, messages and single history semantics;
- Clipboard write/render failure performs no Cut and releases any command guard/state;
- stale completion does not clear a newer selection or force the newer UI tool to Move;
- existing paste async-context regressions remain green;
- source/architecture guards make live `getDocument()`/selection fallback after async Clipboard boundaries difficult to reintroduce.

## Verification

- focused Selection Clipboard tests;
- async-document-context regressions;
- merged raster-mutation tests;
- current-layer painting command regressions if its port changes;
- selection geometry/source-contract tests;
- architecture/source guards;
- canonical `npm run check`;
- generated artifact parity;
- `npm run test:browser` because Clipboard/runtime wiring changes;
- `git diff --check`;
- exact PR-head CI green;
- squash-merge only that verified head;
- exact merged-`main` CI green.

## Done gate

Only after implementation, semantic review, exact PR-head CI success, merge and exact merged-main CI success:

1. delete this task;
2. create exactly one evidence-based next task from fresh `main`;
3. update relevant repository docs/CHANGELOG;
4. update the Drive engineering brain only with reusable verified lessons, not project-only details.

## Risks / handoff notes

- Task 037 snapshots inside the raster batch are intentionally not enough for this task: a Clipboard Cut can await before entering that batch, so the user-intent snapshot must be captured higher in the call chain.
- Do not “solve” stale completion by restoring the old selection or old tab; stale work must yield to newer live state.
- Bounds-only capture is insufficient for ellipse/lasso/polygon/magnetic geometry.
- Be explicit about what can be guaranteed after OS Clipboard write succeeds: the clipboard may contain the copied pixels even if subsequent context revalidation correctly aborts destructive Cut.
- Keep all publication authority exact-object based; never redirect late work by matching IDs.

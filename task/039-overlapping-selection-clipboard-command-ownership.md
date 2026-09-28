# Task 039 — Serialize overlapping Selection Clipboard commands by command-generation ownership

## Goal

Make overlapping Selection Clipboard copy/cut operations deterministic inside the **same still-current document/session/layer context**. A newer Clipboard command must supersede an older pending command so stale same-context work cannot perform a later destructive Cut, clear selection/tool state, overwrite success/error status, or publish duplicate history after the newer command owns the user intent.

Task 038 / PR #64 is complete and verified on merged `main@a99e4f32bfba6533223a7bc8d78b785c4a4859ce` with merged-main CI run #367 green. Task 038 freezes exact document/session/layer/selection semantics across async render and OS Clipboard awaits. This task addresses the remaining same-context concurrency seam that exact context identity alone cannot distinguish.

## Why now / fresh-main evidence

Fresh-main review after Task 038 found:

- `copySelectionToClipboard()` captures exact document/session/selection/layer intent before the first await.
- `isClipboardContextCurrent(context)` rejects document/session or selected-layer replacement, but it has no command generation/request token.
- transient UI cleanup additionally checks original selection object identity and tool, but destructive Cut revalidation does not require that the command is still the latest Clipboard command.
- two rapid `Ctrl+X` / menu Cut operations can therefore capture the same exact document/session/layer/selection, cross independent render/Clipboard awaits, and both remain context-valid.
- the existing deterministic Clipboard tests cover document replacement, selected-layer replacement, geometry replacement, ordering and Clipboard failures, but no overlapping copy/cut commands.

Current code/logs/tests remain authoritative; re-inspect before implementation.

## Scope

1. Introduce a narrow Selection Clipboard command-generation/ownership mechanism local to `src/selection/clipboard-controller.js`.
2. Every new copy/cut command obtains a monotonically changing command identity before async work begins.
3. After every async boundary that can reorder commands, stateful continuation must verify both:
   - Task 038 exact originating context authority; and
   - that this command still owns the Clipboard command generation.
4. A superseded command:
   - performs no destructive merged/current-layer Cut;
   - publishes no history through destructive ports;
   - does not clear a newer selection or force Move;
   - does not overwrite status/toast owned by the newer command with stale success/error messaging.
5. Decide and document explicit overlap semantics:
   - prefer **latest command owns continuation** unless browser Clipboard API ordering makes a safer narrower rule necessary;
   - do not globally block selection/tab UI while a Clipboard operation is pending.
6. Preserve Task 038 frozen full selection geometry and exact object identity semantics.
7. Preserve copy-before-cut ordering and Clipboard permission/error behavior.
8. Keep paste/import generation guards separate; do not merge unrelated paste lifecycle state into this command token unless evidence proves one owner is simpler and safer.

## Non-goals

- Redesigning Selection Clipboard MIME formats.
- Reworking paste/import behavior.
- Introducing a generic app-wide transaction scheduler.
- Disabling keyboard/menu commands while one Clipboard request is pending.
- Changing selection geometry.
- Weakening Task 036/037/038 publication, precision, or snapshot contracts.
- Refactoring unrelated painting/mask/vector-mask/PSD code.

## Inspect first

- `AGENTS.md`
- `docs/PROJECT.md`
- `task/README.md`
- this task only from the queue
- `src/selection/clipboard-controller.js`
- `src/main.js` Clipboard/menu/keyboard wiring
- `tests/selection-clipboard.test.mjs`
- `tests/async-document-context.test.mjs`
- `tests/architecture-layout.test.mjs`
- `docs/architecture/BOUNDARIES.md`
- `docs/architecture/RASTER_PERSISTENCE.md`
- `docs/testing/TEST_MATRIX.md`
- `.github/workflows/ci.yml`

## Behavioral contracts to preserve

1. Task 038 remains intact: copied PNG and later Cut use one frozen originating document/session/layer/full selection snapshot.
2. Same-ID replacement documents/layers remain stale.
3. Clipboard image data is written before destructive Cut begins.
4. One valid Cut produces at most one intended destructive history publication.
5. A newer selection/tool/tab survives older async completion.
6. Browser Clipboard denial/render failure performs no destructive Cut.
7. Existing paste generation/fallback behavior remains unchanged.
8. Native high-depth RGB/CMYK destructive paths remain native where currently supported.

## Planned direction

Prefer one local monotonically increasing generation counter or exact command token owned by `createSelectionClipboardController`.

Capture the token in the Task 038 command context. Revalidate it together with exact document/session/layer authority before Clipboard write continuation, before destructive Cut, and before status/toast/transient cleanup.

Do not use IDs, timestamps, sleeps, or selection bounds as command ownership.

Be explicit about OS Clipboard reality: an older command may already have completed a browser/OS write before a newer command supersedes it. The guarantee is that superseded commands cannot continue mutating editor state or publish stale UI/history after losing ownership; final Clipboard contents should follow the browser writes that actually complete and should be tested only to the extent the injected Clipboard port can deterministically model ordering.

## Required deterministic regressions

Use deferred Promises, never sleeps. At minimum:

- two overlapping merged Cuts in the same exact context: newer command completes first; older command later performs no destructive clear/history/transient cleanup/status overwrite;
- older command reaches Clipboard write first, newer command starts before the older destructive continuation; ownership rule remains deterministic and documented;
- overlapping selected-layer Cuts against the same exact layer cannot both mutate/history-publish;
- Copy followed by Cut and Cut followed by Copy define deterministic latest-owner continuation semantics;
- superseded render/write rejection does not replace status/toast from the newer successful command;
- non-overlapping single copy/cut retains current success behavior;
- document/session/layer replacement regressions from Task 038 remain green;
- source/architecture guard prevents removing command-generation revalidation from the async boundary.

## Verification

- focused `tests/selection-clipboard.test.mjs`;
- async-document-context regressions;
- architecture/source guards;
- canonical `npm run check`;
- generated artifact parity;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI green;
- squash-merge only the verified head;
- exact merged-`main` CI green.

## Done gate

Only after implementation, review, exact PR-head CI success, squash merge and exact merged-main CI success:

1. delete this task;
2. create exactly one evidence-based next task from fresh `main`;
3. update only documentation/brain material that captures a reusable verified lesson.

## Risks / handoff notes

- Task 038 exact-context validation is necessary but not sufficient for overlapping commands because both operations may legitimately reference the same exact objects.
- Do not solve overlap by comparing only selection identity: two commands can intentionally start from the same selection object.
- Do not restore older selection/tool/status when a command loses ownership; stale work yields to the newer command.
- Keep generation state local to Clipboard command orchestration unless repeated evidence justifies a broader abstraction.

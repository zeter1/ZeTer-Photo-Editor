# Task 011 — Text edit / live-preview controller seam

## Goal

Extract the cohesive text add/edit modal transaction and live-preview orchestration from `src/main.js` into one dedicated owner, preferably `src/ui/text-edit-controller.js`, without changing text rendering, font persistence, PSD semantics or visible editor behavior.

This is a bounded structural/refactoring pass with direct regressions. Do not combine it with a broad Properties inspector or typography-engine rewrite.

## Why now / evidence

After Task 010, `src/main.js` is about 213k characters and the next cohesive UI seam is the text editing transaction:

- `textDraft` is mutable transient state in `main.js`;
- `openTextModal()`, `attachTextPreview()` and `syncTextPreviewCanvas()` form one add/edit/preview lifecycle but are separated from the render integration that consumes the draft;
- generic `src/ui/modal-controller.js` currently receives text-specific `attachTextPreview` and `onModalClose` callbacks solely to bridge this state back into `main.js`;
- `documentWithTextPreview()` already provides a clean non-mutating core boundary, so the UI transaction can be extracted without moving text renderer/domain code;
- async font/form preparation already has generation/document checks that should become explicit controller contracts rather than incidental `main.js` coupling.

Current code, tests and CI remain source of truth. Re-inspect before editing.

## Inspect first

Read only the bounded paths/symbols needed for this owner:

- `src/main.js`
  - `textDraft` and every occurrence;
  - `openTextModal()`;
  - `attachTextPreview()`;
  - `syncTextPreviewCanvas()`;
  - render path using `documentWithTextPreview(doc, textDraft)`;
  - overlay path choosing `textDraft.layer`;
  - `topTextLayerAt()`;
  - `textModalFields()`, `textSettingsFromForm()`, `readCustomTextFont()`, `loadComputerFonts()` only to identify ports/shared ownership;
  - text-tool caller and modal-controller wiring.
- `src/ui/modal-controller.js` — generic modal lifecycle; identify and remove text-only coupling only if the new controller can own it cleanly.
- `src/core/state.js` — `createTextLayer()` and `documentWithTextPreview()`; do not duplicate them.
- `src/core/render.js` — text rendering/font loading; do not move renderer mechanics into UI.
- `tests/text-font.test.mjs`, `tests/render-pipeline.test.mjs`, modal tests and browser smoke.
- `tools/build-bundle.mjs`.
- `AGENTS.md`, `docs/PROJECT.md`, `docs/architecture/CODEMAP.md`, `docs/architecture/BOUNDARIES.md`, `docs/testing/TEST_MATRIX.md`.

## Planned owner

Create one canonical text-edit controller that owns, as far as the current architecture allows without duplication:

- add-vs-edit modal transaction started from a canvas point;
- exact originating document/layer identity for an edit;
- controller-owned transient text draft;
- async preview generation/versioning and stale-result rejection;
- preview DOM/canvas lifecycle and `ResizeObserver` cleanup;
- preview-canvas synchronization against the accepted rendered composite;
- Apply/Cancel/Escape/backdrop cleanup semantics through narrow modal integration;
- narrow read APIs needed by composition/render/overlay, such as obtaining the current accepted draft and syncing its preview canvas.

Prefer stable direct imports for pure/domain helpers. Inject live/effectful capabilities such as current document/selection, modal shell, field/settings builders, add/commit/render/update-panels, canvas/render buffer, zoom/tool opacity, status/toast and DOM primitives.

Shared font discovery/custom-font parsing used by both modal editing and Properties inspector may remain outside this controller unless a separate pure helper extraction is necessary to avoid duplication. Do not create a second font-policy owner merely to make this controller self-contained.

## Explicit non-scope

Do **not**:

- move text rendering or `ensureTextFont()` out of `src/core/render.js`;
- move persisted text-layer schema or `documentWithTextPreview()` out of `src/core/state.js`;
- change PSD text import/export semantics;
- redesign the Text UI or typography controls;
- refactor the entire Properties inspector;
- change transform/selection behavior unrelated to the transient draft;
- hand-edit generated bundle logic independently of the canonical build graph.

## Behavioral contracts to preserve

Preserve exactly unless a direct regression demonstrates an existing bug and the fix is intentionally documented:

1. clicking an existing visible text layer selects it before edit; a locked text layer cannot be edited;
2. clicking empty text-tool space opens Add Text with the same default-width/position/opacity/height rules;
3. modal fields and font choices retain current values/defaults and custom/system-font semantics;
4. preview generation is asynchronous and latest-wins; an older font/settings result cannot replace a newer draft;
5. a document switch or closed modal rejects late preview publication;
6. live text preview does not mutate the persisted document or create history entries;
7. edit preview replaces only the originating layer in the render-only preview document; add preview appends only a render-only draft;
8. Apply Edit revalidates active modal, originating document, exact selected layer identity and lock state before mutation, then commits exactly `Редактировать текст`;
9. Apply Add revalidates active modal + originating document, then adds one text layer and commits exactly `Добавить текст`;
10. failed/stale Apply returns control to the modal without partial persisted mutation;
11. Cancel/Escape/backdrop close clears only the draft owned by that modal and re-renders the persisted document;
12. font-family/system-font/custom-file mutual exclusion remains equivalent;
13. preview canvas keeps current DPR/zoom/bounds/alignment/background-offset behavior;
14. observer/listener cleanup cannot retain a stale modal/draft after close;
15. render and overlay use the controller draft only when it belongs to the active document.

## Targeted tests

Add a direct owner test, for example `tests/text-edit-controller.test.mjs`, covering policy without booting the whole app where possible:

- add vs edit target resolution/guards;
- locked-edit rejection;
- latest-wins async preview and stale-document/closed-modal rejection;
- preview draft does not mutate the persisted document/history;
- exact-layer edit Apply and stale/locked Apply rejection;
- Add Apply creates exactly one layer and one history commit;
- modal-owned cleanup clears only its own draft;
- preview-canvas sync sizing/DPR/alignment and stale-document guard;
- source/architecture guard: `src/main.js` wires the controller but no longer owns `textDraft`, `openTextModal()`, `attachTextPreview()` or `syncTextPreviewCanvas()`;
- generic modal controller no longer carries unnecessary text-specific state hooks if the extraction makes them obsolete.

Keep `tests/text-font.test.mjs` for persistence/render-domain behavior and extend only when a real contract belongs there.

## Review checklist

- semantic-drift scan for fontData/fontLabel preservation, quote-wrapped system font names, custom-font replacement, default text/size/width/height/opacity, line-height and decoration fields;
- async result publication revalidates after every awaited boundary;
- no broad catch/suppression added;
- exactly one transient text-draft owner;
- generic modal controller remains generic instead of gaining more text policy;
- no renderer/state/PSD duplication in UI;
- no new top-level bundle-name collision;
- generated artifact remains derived;
- `src/main.js` becomes smaller and composition-oriented.

## Documentation / AI navigation

Update routing so a fresh AI/Codex session can jump directly to the text-edit owner:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Document clearly that persisted text schema/rendering remain core-owned and that the new controller owns only UI transaction/transient preview state.

## Required verification

1. direct text-edit controller tests;
2. existing text/font/render/modal regressions;
3. `npm run check`;
4. generated bundle parity;
5. `npm run test:browser`;
6. exact PR-head CI green;
7. squash merge guarded by expected head SHA;
8. exact merged-main push CI green.

## Done gate

Delete this task only after implementation is merged and the exact merged `main` SHA has green CI. Then inspect the new repository state and create exactly one next bounded task.

## Risk / handoff note

The hidden coupling is the render loop: it builds `documentWithTextPreview(doc, textDraft)`, then the overlay may frame `textDraft.layer`, and after the render buffer is accepted it synchronizes the modal preview canvas. Preserve that ordering through narrow controller reads/methods; do not expose writable controller state back to `src/main.js`.

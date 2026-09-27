# 022 — Canonical document resize command owner

## Goal

Выделить **только** semantic command policy для двух синхронных persisted document-geometry операций из `src/main.js`:

- **Image Size / Размер изображения**;
- **Canvas Size / Размер холста**.

Цель — убрать mutation/history/validation ownership из modal callbacks, закрыть stale-modal document bug и заменить VM/source-slicing regression на прямые tests публичного command owner.

Предпочтительный новый owner: `src/document/resize-command-controller.js` (точное имя можно скорректировать после INSPECT, если live architecture даёт более естественный seam).

## Why now / evidence

Live `main` после task 021 / commit `8aadcb96217427effef022e46646754217d03188`:

- `resizeImageDialog()` в `src/main.js` открывает modal, но `onSubmit` повторно читает **глобальный текущий `doc`**, а не originating document:
  - `checkedCanvasSize(... || doc.width, ... || doc.height)`;
  - `imageResizeTransforms(doc.layers,...)`;
  - direct layer mutation;
  - direct `doc.width/doc.height`;
  - `commit('Размер изображения')`.
- `resizeCanvasDialog()` имеет тот же split ownership:
  - глобальный `doc` в delayed Apply;
  - anchor math + `MAX_LAYER_POSITION` guard;
  - direct layer/document mutation;
  - direct history publication.
- Если пользователь открыл resize modal в документе A, переключился на B и затем нажал Apply, callback не доказывает ownership A и может применить значения из modal A к активному B.
- `tests/resize-dialog-boundary.test.mjs` подтверждает архитектурный долг: он извлекает приватные функции из `main.js` и запускает их через `node:vm`, то есть oracle привязан к старой location/implementation вместо public owner API.
- Canonical primitives уже существуют в `src/core/state.js`:
  - `checkedCanvasSize`;
  - `imageResizeTransforms`;
  - `MAX_LAYER_POSITION`.
  Их не дублировать.

## Scope

### In scope

1. Semantic Image Size command.
2. Semantic Canvas Size command.
3. Originating-document / stale modal validation.
4. Request validation + no-op policy.
5. Staged mutation: никакого partial persisted state при ошибке.
6. Exactly-one history publication только после реального изменения.
7. Explicit result contract для UI wrapper, например:
   - `COMMITTED`;
   - `NOOP`;
   - `INVALID`;
   - `REJECTED`.
8. Narrow runtime hooks для существующего transient cleanup после успешной команды:
   - crop draft reset;
   - selection reset;
   - raster edit buffer reset;
   - fit-to-view.
   Не давать controller прямой доступ к DOM.
9. Direct controller tests + один architecture/source ownership guard.
10. AI routing docs / test matrix / changelog / canonical build graph + generated file:// artifacts.

### Explicit non-scope

- `applyCrop()` / Crop tool semantics.
- zoom / pan / viewport math.
- pointer transform gestures.
- New Document / Open Project / import flows.
- layer nudge/center/align/fit (уже `src/layers/transform-command-controller.js`).
- изменение persisted schema.
- изменение canvas safety limits.
- redesign modal UI.
- изменение формата history/storage/recovery.

Не расширять проходку на все document commands.

## Inspect first

Перед write перечитать:

1. `AGENTS.md`.
2. `docs/PROJECT.md`.
3. `docs/architecture/CODEMAP.md`.
4. `docs/architecture/BOUNDARIES.md`.
5. `docs/testing/TEST_MATRIX.md`.
6. `src/main.js`:
   - `resizeImageDialog()`;
   - `resizeCanvasDialog()`;
   - `commit()`;
   - `blockPendingDocumentEdit()`;
   - `clearSelectionState()`;
   - `fitToView()`.
7. `src/core/state.js`:
   - `checkedCanvasSize`;
   - `imageResizeTransforms`;
   - `MAX_LAYER_POSITION`.
8. `src/ui/modal-controller.js` submit lifecycle.
9. `tests/resize-dialog-boundary.test.mjs`.
10. `tools/build-bundle.mjs` + current CI workflow before any commit.

## Behavioral contracts to preserve

### Image Size

- Existing safe-canvas normalization/error text stays canonical through `checkedCanvasSize`.
- Same final width + height = semantic no-op, no history, no cleanup side effects.
- Scale factors are computed against the **originating** document dimensions.
- All layer transforms are computed with `imageResizeTransforms` **before** any persisted mutation.
- If any transform is invalid (including non-proportional resize of rotated layer or position/scale overflow), no layer/document field is changed and no history entry is published.
- Adjustment-layer behavior remains exactly whatever `imageResizeTransforms` defines.
- Successful command applies all staged transforms, then final document size, and publishes exactly:
  - `Размер изображения`.

### Canvas Size

- Existing safe-canvas size contract stays canonical through `checkedCanvasSize`.
- Same final width + height = no-op.
- Preserve the nine existing anchors:
  - `top-left`, `top`, `top-right`;
  - `left`, `center`, `right`;
  - `bottom-left`, `bottom`, `bottom-right`.
- Calculate the full layer shift plan before mutation.
- If any shifted layer would exceed `MAX_LAYER_POSITION`, reject atomically with existing user-facing error:
  - `Размер холста выведет слой за допустимые пределы`.
- Successful command shifts all layers, changes document size and publishes exactly:
  - `Размер холста`.

### Owner / delayed modal

- Dialog opening captures `const owner = doc` (or equivalent stable document/session identity).
- Apply passes owner + normalized request into the command owner.
- Command must prove `state.getDocument() === owner` immediately before persisted mutation.
- Switching tabs/documents while modal is open => stale Apply:
  - originating document untouched;
  - newly active document untouched;
  - no history;
  - no transient cleanup/fit publication against the new document.
- Do not rely only on modal UI state for this invariant.

### Transient runtime state

Preserve current successful-command behavior:
- clear crop draft;
- clear selection state;
- clear reusable raster brush buffer;
- fit view after commit.

These effects must execute **only after/around a real committed resize** and against the correct active owner. Expose narrow runtime ports/results rather than importing DOM/editor globals into the controller.

## Planned extraction

Target shape (adjust after reading live code; do not cargo-cult this exact API):

```js
createDocumentResizeCommandController({
  state: {
    getDocument,
  },
  transaction: {
    commit,
  },
  runtime: {
    resetGeometryTransientState,
    fitToView,
  },
})
```

Public commands should accept originating owner explicitly:

```js
resizeImage(owner, { width, height })
resizeCanvas(owner, { width, height, anchor })
```

Important:
- controller owns persisted semantic transaction;
- `src/core/state.js` remains owner of reusable size/transform limits and math;
- `src/main.js` keeps modal markup/fields, presentation errors/status and thin wiring;
- no duplicated transform/anchor safety policy in both places.

If a cleaner separation is possible where controller returns a committed result and `main.js` performs transient cleanup, prove that stale/no-op/error paths cannot clear state in the wrong document before choosing it.

## Targeted tests

Replace or substantially simplify `tests/resize-dialog-boundary.test.mjs`; prefer a direct `tests/document-resize-command-controller.test.mjs`.

Minimum regressions:

1. Controller rejects missing required bridges.
2. Image resize success:
   - transforms every layer using canonical helper;
   - updates width/height;
   - one exact history label.
3. Image resize same dimensions => no-op / zero history.
4. Non-proportional rotated-layer failure => atomic: exact pre-state preserved / zero history.
5. Image resize overflow/invalid request => no partial mutation.
6. Canvas resize success for representative anchors; verify exact shifts + one history label.
7. Cover all nine allowed anchor values at least through table-driven shift expectations.
8. Canvas same dimensions => no-op.
9. Canvas layer-position overflow => atomic reject / zero history.
10. Stale owner after document switch blocks **both** Image Size and Canvas Size; neither old nor new doc changes.
11. Missing/replaced originating owner identity cannot publish history/runtime cleanup.
12. Successful command triggers transient cleanup/fit exactly once; rejected/no-op command triggers them zero times.
13. Source/architecture guard proves:
    - `main.js` composes the new owner;
    - resize modal callbacks delegate by stable originating owner;
    - direct document/layer resize mutation no longer lives in those callbacks;
    - build graph contains the new module.
14. Existing core resize/safety regressions remain green.
15. Chromium `file://` smoke remains green.

If a legacy test fails only because it asserts old private-function/source location, first compare product behavior. Migrate the oracle to the canonical owner; never reintroduce duplicated runtime code to satisfy regex.

## Documentation / build updates

If implementation proceeds:

- update `AGENTS.md`;
- update `docs/PROJECT.md`;
- update `docs/architecture/CODEMAP.md`;
- update `docs/architecture/BOUNDARIES.md`;
- update `docs/testing/TEST_MATRIX.md`;
- update `CHANGELOG.md`;
- add new source to `tools/build-bundle.mjs`;
- regenerate `src/app.bundle.js`, `index.html`, `version.json` only through canonical build graph.

Keep docs concise and route future AI directly to the new semantic owner.

## Required verification

During development use the smallest relevant tests, but final PR gate must include repository-standard checks:

1. syntax/compile via repo scripts;
2. direct resize-controller regressions;
3. existing resize/core/document tests;
4. architecture/source guard;
5. full `npm run check`;
6. canonical generated-artifact parity;
7. Chromium `file://` browser smoke;
8. `git diff --check`;
9. exact current PR-head CI success;
10. guarded merge by expected head SHA;
11. exact merged-main push CI success.

## Done gate

Task is done only when:

- Image Size + Canvas Size have one canonical semantic owner outside `main.js`;
- delayed modal Apply cannot mutate a different active document;
- invalid operations are atomic;
- no-op commands create no Undo/history or cleanup;
- history labels/visible behavior are preserved;
- source-slicing VM oracle is replaced by direct public-owner coverage;
- docs/build graph point to the new owner;
- exact PR head CI is green;
- exact merged `main` SHA CI is green.

Only then delete this task and create exactly one next bounded task.

## Risks / handoff notes

- Do **not** move `applyCrop()` into this pass just because it also changes document geometry; Crop has pointer/selection lifecycle and deserves separate evidence.
- Do not mutate layers incrementally before all resize validation succeeds.
- Do not weaken `checkedCanvasSize`, `imageResizeTransforms` or `MAX_LAYER_POSITION` guards.
- The current VM test is evidence of a weak oracle, not a reason to keep private resize implementations in `main.js`.
- The important correctness bug class is stale delayed modal ownership, not line count.

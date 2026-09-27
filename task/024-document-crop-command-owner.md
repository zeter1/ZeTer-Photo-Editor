# 024 — Canonical Crop persisted geometry command owner

## Goal

Вынести persisted document-geometry transaction команды Crop из `src/main.js` в узкий `src/document/crop-command-controller.js`, сохранив crop gesture/overlay/keyboard/session state в текущих interaction/UI owners.

Главная цель — сделать Crop таким же хорошо локализованным для ChatGPT/Codex, как Image Size / Canvas Size и Document Background: один semantic owner, прямые regressions, atomic validation before mutation и явный history/runtime contract.

## Why now / evidence

Текущее `applyCrop(r)` в `src/main.js`:

- округляет `x/y/width/height`;
- сразу сдвигает **все** `doc.layers[].x/y`;
- затем меняет `doc.width/height`;
- очищает `cropRect`, selection и raster brush buffer;
- безусловно делает `commit('Кадрирование')` и `fitToView()`.

Callers сейчас два:

1. crop pointer release — normalized/clamped document coordinates, минимум 10×10;
2. `cropToSelection()` — текущий `selectionRect`, минимум 1×1.

Отдельного crop-controller regression suite сейчас нет; поиск по `tests/` не нашёл `applyCrop`, `cropRect` или label `Кадрирование`.

Core safety уже определяет:

- `MAX_CANVAS_DIMENSION = 12000`;
- `MAX_CANVAS_PIXELS = 48_000_000`;
- `MAX_LAYER_POSITION = 120000`;
- `checkedCanvasSize()` и resize owners уже используют staged validation до persisted writes.

Это создаёт bounded follow-up: Crop всё ещё владеет mutation/history policy внутри большого composition root и не доказывает atomicity для invalid/non-finite requests или layer-position overflow.

## Scope

- Новый `src/document/crop-command-controller.js`.
- Persisted crop rect normalization/validation policy.
- Exact originating-document identity guard.
- Полный layer-position plan до первой mutation.
- Canvas-size safety и `MAX_LAYER_POSITION` safety.
- Semantic no-op/history policy.
- Один history publish для реального crop.
- Narrow runtime ports только для существующего post-crop cleanup/fit, если это действительно принадлежит command completion.
- Direct controller regressions.
- Architecture/source guard.
- `tools/build-bundle.mjs`, generated file:// artifacts, CHANGELOG, PROJECT/CODEMAP/BOUNDARIES/TEST_MATRIX/AGENTS routing.

## Non-scope

Не затягивать в controller:

- crop pointer begin/move/up/cancel и pointer capture;
- `cropRect` overlay drawing/grid;
- Escape/tool-switch cancellation;
- selection gesture creation/refinement;
- `cropToSelection()` menu enablement/status;
- Image Size / Canvas Size;
- renderer/compositor semantics;
- document schema/version;
- generic «document geometry framework».

## Inspect first

1. `AGENTS.md` → `docs/PROJECT.md` → `task/README.md`.
2. Точный `applyCrop()`, оба caller-а и все `cropRect` lifecycle writes в `src/main.js`.
3. `src/document/resize-command-controller.js` — reusable transaction shape, но не копировать blindly.
4. `src/core/state.js`: `checkedCanvasSize`, `MAX_LAYER_POSITION`, sanitization/snapshot behavior.
5. Session switching in `src/workspace/session-controller.js`: `cropRect` is transient per-session state.
6. Existing pointer/cancellation/document tests before deciding what belongs in direct crop tests.
7. Current Actions/workflow preflight before writes.

## Behavioral contracts to preserve

- Pointer crop keeps its existing minimum 10×10 gate.
- Crop-to-selection keeps its existing no-selection/too-small behavior.
- Crop geometry keeps current rounding semantics unless a regression proves they create an invalid persisted state.
- A successful crop shifts every layer by the crop origin and updates document width/height consistently.
- History label remains exactly `Кадрирование`.
- Existing successful-crop transient completion remains observable: crop draft closes, selection is cleared, raster brush buffer is cleared, viewport fits.
- Escape/tool-switch/pointer-cancel semantics stay outside the command owner.
- No partial persisted mutation on rejected/invalid crop.

## Planned extraction / correctness gates

Preferred narrow API shape (adjust only if inspection proves a better boundary):

```js
createDocumentCropCommandController({
  state: { getDocument },
  transaction: { commit },
  runtime: {
    completeCropTransientState,
    fitToView,
  },
})

crop(owner, rect)
```

Suggested results: `COMMITTED`, `NOOP`, `INVALID`, `REJECTED`.

Required command policy:

1. Capture/pass the exact originating `owner`; revalidate `state.getDocument() === owner` immediately before the first persisted write.
2. Normalize/validate finite crop geometry before mutation; prove the final canvas size is safe.
3. Build every final layer `x/y` first and reject any non-finite or `MAX_LAYER_POSITION` overflow before touching the document.
4. Do not mutate layer 1 and then discover that layer N is invalid.
5. Treat a full-bounds persisted geometry crop (`x=0,y=0,width=owner.width,height=owner.height`) as a semantic no-op for history/dirty publication.
6. Preserve command-completion transient behavior explicitly for NOOP vs COMMITTED rather than accidentally coupling it to `commit()`: a full-bounds crop may still need to close crop/selection UI, but it must not fabricate an Undo entry.
7. Real persisted change publishes exactly one `commit('Кадрирование')`; cleanup/fit must not run twice.
8. Do not create a generic document-property/geometry framework only to share code with resize/background.

## Targeted tests

Create `tests/document-crop-command-controller.test.mjs` covering at minimum:

- constructor bridge requirements;
- real crop shifts all layers and sets final canvas dimensions exactly;
- preserved rounding behavior;
- exactly one `Кадрирование` commit and one runtime completion/fit for real change;
- full-document semantic no-op: zero history/dirty publication with explicitly tested transient-completion policy;
- stale owner A→B rejection with zero mutation/history/runtime side effects;
- structurally equal replacement object rejection;
- non-finite/unsafe crop request rejected atomically;
- layer-position overflow near `-MAX_LAYER_POSITION` rejected before any layer/document mutation;
- pre-write owner revalidation if live owner changes during planning;
- architecture guard: main imports/composes/delegates; direct crop persisted mutation does not drift back into `src/main.js`; build graph includes owner.

Keep existing pointer/release/cancel/session/core regressions green. Add browser smoke only because composition-root/bundle wiring changes.

## Required verification

- syntax/Node direct crop-controller tests;
- relevant core/document/session/pointer regressions;
- architecture/source guard;
- full `npm run check`;
- generated `src/app.bundle.js`, `index.html`, `version.json` parity;
- `npm run test:browser`;
- `git diff --check`;
- exact current PR-head CI green;
- after merge, exact merged-main push CI green.

## Done gate

После merge + green exact merged-main CI:

- удалить этот task-файл;
- создать ровно **одну** следующую bounded задачу по свежему inspection;
- не оставлять stale task queue.

## Risks / handoff notes

- Не переносить `cropRect` transient gesture ownership целиком в document controller: это session/UI interaction state.
- Не считать UI clamping достаточной domain safety: command boundary должен оставаться atomic при ошибочном internal caller input.
- Не «чинить» overflow через silent clamp persisted layer positions — либо canonical validated plan, либо rejected/invalid command.
- Не менять selection/crop-cancel UX побочно.
- Если full-bounds crop historical behavior конфликтует с no-op history hygiene, разделить persisted NOOP от transient completion и зафиксировать оба контракта тестами.

# 023 — Canonical document background command owner

## Goal

Убрать persisted mutation/history policy команды **Image → «Фон документа…»** из `src/main.js` и закрыть два конкретных correctness-дефекта delayed modal:

1. Apply после переключения вкладки не должен менять новый активный документ.
2. Повторное применение уже выбранного фона не должно создавать synthetic Undo/history.

Сделать это отдельной bounded-проходкой без расширения на Crop, New Document, resize или другие document properties.

Предпочтительный seam после INSPECT: узкий `src/document/background-command-controller.js`. Не создавать generic document-property framework без реального второго use case.

## Why now / evidence

Live `main` после task 022 / merge `18bc4430b95364e2bba8fc4b60bbf10644fcd729` содержит:

```js
function setDocumentBackground() {
  showModal({
    title:'Фон документа',
    fields:[{
      name:'background',
      label:'Фон',
      type:'select',
      value:doc.background,
      options:[
        ['transparent','Прозрачный'],
        ['#ffffff','Белый'],
        ['#000000','Чёрный'],
        [els.primaryColor.value,'Основной цвет']
      ]
    }],
    submitLabel:'Применить',
    onSubmit:v=>{
      doc.background=v.background;
      commit('Фон документа');
    }
  });
}
```

Фактические проблемы:

- modal открывается против текущего `doc`, но delayed `onSubmit` снова читает **глобальный текущий `doc`**;
- открыть modal в A → переключиться на B → Apply может записать background в B;
- same-value Apply безусловно вызывает `commit('Фон документа')`, создавая лишний Undo/dirty/recovery publication;
- отдельного behavior regression для этой команды сейчас нет;
- единственный caller — Image menu entry `['Фон документа…','',setDocumentBackground]`, поэтому scope хорошо ограничен;
- persisted `background` остаётся частью document schema в `src/core/state.js`; новый command owner не должен забирать schema ownership.

Этот seam найден post-merge second-owner audit после task 022: брать его выгоднее, чем немедленно переносить Crop, потому что здесь есть явный stale-modal correctness bug при очень маленьком blast radius.

## Scope

### In scope

1. Exact originating-document guard для Background modal Apply.
2. Semantic no-op suppression.
3. Exactly-one history publication для реального изменения.
4. Preserve текущего Image-menu route, modal title/field/options/status behavior.
5. Direct public-controller regressions.
6. Architecture/source guard, запрещающий возврат direct background mutation/history в modal callback.
7. AI-routing docs / test matrix / changelog / canonical build graph + generated file:// artifacts.

### Explicit non-scope

- `applyCrop()`, Crop pointer/selection lifecycle.
- Image Size / Canvas Size — уже owner `src/document/resize-command-controller.js`.
- New Document / Open Project / import.
- document rename/tab rename.
- color-management / proof/display profile.
- изменение persisted project schema или project version.
- изменение renderer semantics для transparent/color background.
- redesign modal UI.
- generic framework для всех document properties без доказанного use case.

Одна проходка = одна background command boundary.

## Inspect first

Перед write перечитать:

1. `AGENTS.md`.
2. `docs/PROJECT.md`.
3. `docs/architecture/CODEMAP.md`.
4. `docs/architecture/BOUNDARIES.md`.
5. `docs/testing/TEST_MATRIX.md`.
6. `src/main.js`:
   - `setDocumentBackground()`;
   - Image menu entry;
   - `commit()`;
   - session/tab switching paths;
   - `showModal` wiring.
7. `src/ui/modal-controller.js` generic submit lifecycle.
8. `src/core/state.js`:
   - document `background` schema/default;
   - `sanitizeProject` treatment of background.
9. renderer background consumers only as needed to preserve accepted values.
10. current tests containing document/background/session behavior.
11. `tools/build-bundle.mjs` and current `.github/workflows/ci.yml`.

Before writes also confirm current `main` SHA and latest main CI are still green.

## Behavioral contracts to preserve

### Modal / UI

- Menu label stays `Фон документа…`.
- Modal title stays `Фон документа`.
- Field stays a select named `background`.
- Existing options remain:
  - `transparent`;
  - `#ffffff`;
  - `#000000`;
  - current primary color captured for the modal.
- History label for real mutation stays exactly:
  - `Фон документа`.

Do not move generic modal DOM construction into the document command owner.

### Exact owner

At modal open capture the originating document:

```js
const owner = doc;
```

The field value must come from `owner.background`, not a later global document.

Apply delegates the candidate value plus exact `owner` to the command owner.

Immediately before persisted mutation the command owner must prove:

```js
state.getDocument() === owner
```

Tab/document switch while modal remains open => rejected command:
- origin A unchanged;
- active B unchanged;
- zero history/dirty publication;
- no unrelated cleanup;
- modal may remain open or return false according to existing generic modal contract, but must not mutate either document.

Do not rely only on the UI/pending-edit state for this invariant.

### Value / no-op

Preserve existing accepted UI values. Do not silently narrow dynamic primary-color values.

Candidate equal to `owner.background` => semantic no-op:
- no assignment;
- no `commit`;
- no dirty/recovery publication.

Real different candidate:
- assign once to the confirmed owner;
- publish exactly one `commit('Фон документа')`.

If normalization/validation is introduced, it must be justified by current schema/render contract and must not change existing valid behavior accidentally.

### Replacement identity

Because the command targets the document object itself, object identity is the authority:
- active structurally-equal replacement object is **not** the originating owner;
- replacement must not receive stale Apply.

## Planned extraction

Preferred shape, subject to live-code inspection:

```js
createDocumentBackgroundCommandController({
  state: {
    getDocument,
  },
  transaction: {
    commit,
  },
})
```

Public command:

```js
setBackground(owner, value)
```

Suggested explicit result contract can mirror nearby command owners:

- `COMMITTED`
- `NOOP`
- `INVALID` only if a real domain validation exists
- `REJECTED`

Keep `src/main.js` as:
- menu composition;
- modal fields/options;
- user-facing status if needed;
- thin delegation.

Keep `src/core/state.js` as:
- document schema/default;
- persisted sanitizer.

Do **not** fold this into `resize-command-controller.js`; background and geometry resize are different semantic responsibilities.

## Targeted tests

Prefer a new direct test such as:

`tests/document-background-command-controller.test.mjs`

Minimum regressions:

1. Constructor rejects missing required state/transaction bridges.
2. Real background change:
   - exact owner changes;
   - exactly one history label `Фон документа`.
3. Same background:
   - `NOOP`;
   - exact document unchanged;
   - zero history.
4. Transparent → white / white → black or equivalent supported values.
5. Dynamic color value such as `#123456` remains supported if current UI/schema supports it.
6. Stale document switch A → B before Apply:
   - A unchanged;
   - B unchanged;
   - zero history.
7. Structurally-equal replacement document is rejected by object identity.
8. Architecture/source guard proves:
   - `main.js` composes/imports the canonical owner;
   - modal captures `owner=doc`;
   - callback delegates `setBackground(owner,...)`;
   - direct `doc.background = ...; commit('Фон документа')` no longer lives in `setDocumentBackground()`;
   - build graph includes the new source.
9. Existing document/session/core/render regressions remain green.
10. Chromium `file://` smoke remains green.

Do not use VM/source-slicing to execute private `main.js` code. Direct owner API tests + one structural guard are the preferred oracle split.

## Documentation / build updates

If implementation proceeds, update only relevant navigation:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`;
- `tools/build-bundle.mjs`;
- canonical generated `src/app.bundle.js`, `index.html`, `version.json`.

Keep documentation concise and explicitly state non-scope so future AI does not merge Background, Resize and Crop into one document monolith.

## Required verification

Development can use targeted tests first, but final proof must be:

1. direct background-controller regressions;
2. relevant core/document/session tests;
3. architecture/source guard;
4. full `npm run check`;
5. generated artifact parity;
6. Chromium `file://` browser smoke;
7. `git diff --check`;
8. exact current PR-head CI success;
9. guarded merge with expected head SHA;
10. exact merged-main push CI success.

If any test fails because it assumed the old physical location, classify behavior vs stale oracle from evidence; do not restore duplicate production logic just to satisfy regex.

## Done gate

Task is done only when:

- document background has one semantic command owner outside `src/main.js`;
- delayed Apply cannot mutate a different tab/document;
- same-value Apply creates zero Undo/history;
- a real change publishes exactly one preserved history label;
- modal UI/options remain behavior-compatible;
- direct public-owner regressions replace implementation-location dependence;
- docs/build graph point to the owner;
- exact PR head CI is green;
- exact merged-main SHA CI is green.

Only then delete 023 and create exactly one next bounded task.

## Risks / handoff notes

- The main value is correctness, not line-count reduction.
- Avoid speculative generic document-property abstraction.
- Do not pull Crop into this pass; Crop couples document geometry to selection/pointer lifecycle and needs separate evidence.
- Do not change accepted background/color semantics without a demonstrated bug and dedicated tests.
- Any write after a green PR run invalidates that run as exact-head evidence and requires a new CI run before merge.

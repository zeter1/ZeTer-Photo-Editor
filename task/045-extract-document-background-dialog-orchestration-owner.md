# 045 — Extract Document Background dialog orchestration owner

## Goal
Вынести UI-оркестрацию **Image → Фон документа…** из `src/main.js` в узкий canonical UI owner, сохранив persisted mutation/history policy в `src/document/background-command-controller.js`.

## Why now / evidence
- После task 044 `src/main.js` всё ещё хранит `setDocumentBackground()`: modal schema, dynamic primary-color option, exact owner capture и REJECTED presentation.
- Persisted command уже изолирован и напрямую протестирован: exact active owner, NOOP, one history publication.
- Это маленький self-contained owner; не смешивать с большим `updateProperties()`.

## Inspect first
`AGENTS.md` → `docs/PROJECT.md` → `task/README.md` → свежий `src/main.js` вокруг `setDocumentBackground()`/Image menu/composition → `src/document/background-command-controller.js` → его tests → `src/ui/modal-controller.js` → соседний `src/ui/document-resize-controller.js` → `tools/build-bundle.mjs` → architecture/docs references.

Перед write перепроверь current `main`, blob SHAs и Actions preflight.

## Behavioral contracts to preserve
- title `Фон документа`;
- field `background`, label `Фон`, type `select`, initial value = background exact document captured at open;
- options exactly: `transparent/Прозрачный`, `#ffffff/Белый`, `#000000/Чёрный`, **current primary color sampled at dialog-open time** / `Основной цвет`;
- submit `Применить`;
- delayed Apply passes the exact captured owner to `setBackground(owner, value)`;
- REJECTED → status `Документ изменился — фон не применён` + return `false`;
- COMMITTED/NOOP → existing normal modal-close semantics, no duplicate status/toast/history;
- **do not add a pending-edit guard**: current Background behavior has none;
- new owner must not reach into global `els`; sample primary color via explicit port.

## Planned extraction
Prefer `src/ui/document-background-controller.js` with narrow ports:
- `getDocument()`;
- `getPrimaryColor()`;
- `setBackground(owner, value)`;
- `showModal(...)`;
- `setStatus(...)`.

`src/main.js` should only compose these ports and route the Image menu item. Keep `DOCUMENT_BACKGROUND_COMMAND_RESULT` out of `main.js` if no longer needed there.

## Classic bundle ordering
If the UI owner imports `DOCUMENT_BACKGROUND_COMMAND_RESULT`, list it in `tools/build-bundle.mjs` after `src/document/background-command-controller.js`. Add an architecture guard when imported bindings make this ordering runtime-significant.

## Targeted tests
Direct UI-owner tests:
1. exact modal schema/default/submit;
2. exact static options + dynamic primary color sampled on each open;
3. originating owner remains captured across active-document switch;
4. command receives exact selected value;
5. REJECTED exact status + `false`;
6. COMMITTED normal close/no duplicate publication;
7. NOOP same normal close behavior;
8. explicit bridge fail-fast if consistent with neighboring owners.

Keep `tests/document-background-command-controller.test.mjs` for persisted policy. Update architecture/source guards so dialog logic cannot drift back into `main.js`.

## Documentation
Update only the smallest relevant set: `AGENTS.md`, `docs/PROJECT.md`, `docs/architecture/CODEMAP.md`, `docs/architecture/BOUNDARIES.md`, `docs/testing/TEST_MATRIX.md`, `CHANGELOG.md`.

## Non-scope
No renderer/background semantics change; no custom color picker; no pending-edit policy change; no command/history refactor; no Properties-panel extraction; no Crop/Resize changes; no README marketing; no unrelated refactor.

## Required verification
Focused UI tests + existing background tests → architecture guards → full `npm run check` → generated parity → real `file://` browser smoke → `git diff --check` → exact-head PR CI → squash merge with expected head SHA → exact merged-main push CI.

On failure: inspect run/job/failed step/logs, classify root cause, make minimal fix; never suppress useful checks.

## Done gate
After merge + green exact main push CI: delete this task, create one next bounded task from fresh `main`, and update Drive brains only with genuinely reusable lessons.

## Risks / handoff notes
- Dynamic primary color is current behavior: sample at dialog open, not controller construction.
- Never redirect delayed Apply by re-reading the active document.
- Do not invent a generic document-property dialog framework; Background/Resize/Crop have different guard/outcome contracts.

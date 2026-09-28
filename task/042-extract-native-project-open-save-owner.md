# Task 042 — Extract native .zpe project open / save orchestration from `src/main.js`

## Goal

Вынести lifecycle открытия и сохранения собственного `.zpe` project format из большого `src/main.js` в узкий document/workspace owner. Сохранить существующую session-safety, Smart Object save routing, recovery publication и UI wiring без изменения формата файла.

Цель проходки — уменьшить composition root и дать AI один canonical owner для native project IO вместо чтения большого участка `main.js`.

## Why now / fresh-main evidence

Task 041 завершён и проверен:

- PR #67 exact-head CI run #378 — green;
- squash-merge `main@c0da1005b6b9080c62a1c0aa755d2e1998f2f257`;
- exact merged-main push CI run #379 — green;
- `src/main.js` после extraction остаётся **2856 строк / 131 top-level function**.

Fresh-main evidence:

- `openProject(file)` и `saveProject()` всё ещё находятся в `src/main.js`.
- `openProject` уже содержит важную async owner-safety policy:
  - блокирует замену при pending document edit;
  - проверяет `canReplaceDocument()`;
  - до `await readFileAsText(file)` захватывает exact document, active session id, current history entry и `documentChangeSerial`;
  - после await повторно валидирует весь owner snapshot;
  - stale result ничего не публикует и сообщает пользователю;
  - parsing/sanitization выполняются до persisted mutation;
  - успешная публикация сбрасывает history, очищает dirty, ставит immediate recovery, делает fit-to-view и status/toast.
- `saveProject` содержит отдельную policy:
  - pending-edit guard;
  - Smart Object child session делегирует `saveSmartObjectContent(session)`;
  - обычный документ сериализуется как JSON, скачивается как `.zpe`, затем публикуется immediate recovery/status.
- `docs/architecture/BOUNDARIES.md` прямо фиксирует: project open/save остаётся вне `document/import-controller.js` до выделения собственного boundary.
- Это отдельная ответственность от image/PSD import: не расширять `document/import-controller.js` native-project логикой.

Current code/tests/CI остаются source of truth; перед реализацией перепроверить свежий `main`.

## Scope

1. Создать узкий owner, предпочтительно `src/document/project-controller.js`, который владеет native `.zpe` open/save orchestration.
2. Сохранить open semantics:
   - preflight pending-edit + replace guard;
   - capture originating document/session/history/change-serial before await;
   - read → JSON parse → `sanitizeProject` before first persisted mutation;
   - exact stale-result rejection after await;
   - repeat pending-edit guard before publish;
   - one successful publication path: fresh HistoryStack / setDoc-reset, clean dirty state, immediate recovery, fit-to-view, status/toast;
   - parse/read/sanitize failure must not partially mutate the document.
3. Сохранить save semantics:
   - pending-edit guard;
   - Smart Object child save delegates to the existing Smart Object owner;
   - regular project keeps current `.zpe` JSON/download behavior, safe filename, immediate recovery and status.
4. Оставить file-input/menu dispatch and generic UI shell in `src/main.js`.
5. Не смешивать owner с `src/document/import-controller.js`; image/PSD/PSB import remains separate.
6. Передавать document/session/history/IO/recovery/UI через explicit narrow ports; не создавать generic app context bag.
7. Добавить direct deterministic tests нового controller-а и мигрировать stale source-oracle assertions с `main.js` на canonical owner.
8. Обновить build graph, generated `file://` bundle, CHANGELOG и только релевантные AI navigation docs/specs.

## Behavioral regression tests

Минимум проверить напрямую:

- successful open applies sanitized project only after async read completes;
- stale originating document;
- stale active session;
- changed history entry;
- changed document serial;
- pending edit before read;
- pending edit appearing during await;
- invalid JSON / sanitizer failure → no document/history/dirty/recovery/fit mutation;
- success → clean dirty + immediate recovery + fit + status/toast exactly once;
- regular save → `.zpe` filename + JSON download + recovery/status;
- Smart Object child save delegates and does not trigger regular download;
- save is blocked by pending edit.

Source/architecture guards должны доказывать:

- `src/main.js` imports/composes the controller;
- `openProject` / `saveProject` implementations больше не живут в `main.js`;
- native project owner не содержит PSD/image import policy;
- build loads controller before `main.js`.

## Non-scope

- Не менять `.zpe` schema/version.
- Не менять PSD/PSB/image import/export.
- Не менять Smart Object persistence semantics.
- Не добавлять File System Access API или cloud storage.
- Не менять recovery storage format.
- Не рефакторить одновременно History UI/undo-redo.
- Не переписывать generic dialogs/menu wiring.

## Verification / delivery gate

INSPECT → DIAGNOSE → PLAN → CHANGE → VERIFY → REVIEW → DELIVER.

Required:

1. direct project-controller tests;
2. affected async-stale/reliability/session tests;
3. architecture/source guards;
4. `npm run check`;
5. generated artifact parity;
6. `npm run test:browser` real `file://` smoke;
7. `git diff --check`;
8. exact PR-head CI green;
9. squash merge with expected head SHA;
10. exact merged-main `push` CI green.

Если CI падает: run → jobs → first failed step → logs → classification → root cause → fix. Не ослаблять полезные проверки.

## Documentation / AI outcome

После успешной extraction AI должен идти:

- native `.zpe` open/save policy → новый project controller + direct tests;
- image/PSD import → `src/document/import-controller.js`;
- project schema/sanitization → `src/core/state.js`;
- low-level text/download IO → `src/core/io.js`;
- recovery scheduling → `src/workspace/recovery-controller.js`;
- menu/file-input wiring → `src/main.js`.

Если во время проходки выявится reusable правило для async owner extraction / source-oracle migration / generated-artifact verification — обновить project docs и «мозги» только подтверждённым выводом.

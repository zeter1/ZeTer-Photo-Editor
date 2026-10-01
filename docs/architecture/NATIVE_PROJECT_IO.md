# Native `.zpe` project IO contract

Этот документ — узкая спецификация открытия и сохранения собственного project format. Она позволяет AI/Codex не восстанавливать async-инварианты из большого `src/main.js`.

## Карта владельцев

- `src/document/project-controller.js` — orchestration open/save и stale-result policy.
- `src/document/import-controller.js` — классификация incoming files и image-import transaction.
- `src/core/state.js` — schema validation/sanitization через `sanitizeProject`.
- `src/core/io.js` — низкоуровневые text read/download/filename primitives.
- `src/document/smart-object-controller.js` — сохранение Smart Object content-tab обратно в parent.
- `src/workspace/recovery-controller.js` — recovery scheduling/storage orchestration.
- `src/main.js` — composition, menu/file-input dispatch и concrete runtime ports.

## Open transaction

Native project open следует prepare-before-publish и использует две независимые authority:

1. Preflight: pending persisted edit блокирует команду; `canReplaceDocument()` должен разрешить замену.
2. До первого await захватить exact document object, active session id, current history-entry object и `documentChangeSerial`.
3. Только после успешного preflight присвоить команде новый controller-local monotonic open generation. Заблокированная/отклонённая более новая попытка не отменяет уже авторизованное старое открытие.
4. Прочитать текст без mutation.
5. Сразу после async read проверить generation. Superseded continuation завершается тихо до `JSON.parse` / `sanitizeProject` и до любой UI/error publication.
6. Выполнить `JSON.parse` и `sanitizeProject`, затем отдельно доказать все четыре exact-owner tokens.
7. Снова проверить pending-edit guard.
8. Publish once, без await внутри publication region: заменить history owner, установить sanitized document с reset history, `markDirty(false)`, immediate recovery, fit-to-view, затем success status/toast.

Обычная ошибка чтения/JSON/sanitization и exact-owner stale outcome не должны частично менять document/history/dirty/recovery/view. Ошибка уже superseded команды дополнительно не публикует alert/status/toast/error log, чтобы старый результат не перетёр feedback более нового намерения. Если в будущем между финальной authority-проверкой и первой записью появится await, после него нужно повторно проверить и generation, и exact-owner ticket.

## Почему generation и exact-owner ticket нужны одновременно

Generation отвечает на вопрос «эта ли команда является последним авторизованным открытием?». Exact document/session/history/change-serial ticket отвечает на другой вопрос: «то ли состояние редактора, которое разрешило эту команду, всё ещё активно?». Два открытия могут иметь одинаковый exact ticket, поэтому ticket не заменяет generation; generation, наоборот, не доказывает неизменность документа.

`readFileAsText` не принимает AbortSignal, поэтому здесь generation — корректный discard/ownership protocol, а не фиктивная физическая cancellation. AbortController следует добавлять только если конкретный IO primitive реально поддерживает signal.

## Почему history entry и change serial нужны одновременно

Тот же document object и та же вкладка не доказывают неизменность состояния. `history.current()` ловит history-переход, а `documentChangeSerial` закрывает persisted/transient изменения, которые ещё не создали новый history entry.

## Save routing

- Pending edit блокирует save.
- Session с `smartObjectLink` делегируется `saveSmartObjectContent(session)`; обычный project-download path не запускается.
- Обычный документ сериализуется `JSON.stringify(document, null, 2)`, скачивается как `${safeFilename(name)}.zpe` с `application/json`, затем получает immediate recovery и download status.
- Обычный browser download не вызывает `markDirty(false)`: старт скачивания не доказывает durable save.

## Не переносить сюда

Image/drag-drop classification, PSD/PSB parsing/export, IndexedDB storage, schema implementation и generic modal/menu/file-input DOM lifecycle остаются у своих владельцев.

## Verification при изменении

Direct `tests/project-controller.test.mjs`; async/recovery regressions при изменении owner/save semantics; source/build guard; `npm run check`; generated bundle/cache parity; `npm run test:browser`; exact PR-head CI; exact merged-main push CI.

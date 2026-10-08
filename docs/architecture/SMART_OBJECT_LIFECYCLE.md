# Smart Object lifecycle and async authority

Этот документ — узкая спецификация для AI/Codex по Smart Object lifecycle. Он позволяет не восстанавливать временные инварианты из большого controller и не смешивать обычную layer identity, ZPE linked identity и Photoshop native source identity.

## Карта владельцев

- `src/document/smart-object-controller.js` — convert/open/save/link/unlink, content-tab lifecycle, shared-source propagation и command authority.
- `src/document/psd-smart-object-resource.js` — prepare/publish Photoshop embedded/linked resource rewrite.
- `src/document/psd-export-controller.js` + `src/formats/psd.js` — PSD/PSB mapping и binary codec.
- `src/core/state.js` — canonical Smart Object schema, snapshot/restore и reusable layer helpers.
- `src/document/project-controller.js` — Ctrl+S routing: content-tab делегирует Save Smart Object controller.
- `src/workspace/session-controller.js` — document/content sessions; Smart Object controller получает session operations только через narrow ports.

## Три вида parent/source identity

После async boundary одного layer ID недостаточно.

1. Обычный unshared ZPE Smart Object авторизуется exact object identity: найденный parent обязан быть тем же объектом `layer === parentLayer`.
2. ZPE linked instances авторизуются canonical `linkedSourceId`: конкретный экземпляр может измениться, пока общий source identity остаётся тем же.
3. Photoshop Smart Objects авторизуются native source identity (`psdSmartObject.uniqueId` через injected Photoshop ports).

Stable ID подходит для lookup, но не является ownership proof, если domain contract не объявляет его canonical source identity.

## Convert transaction

Convert и Save имеют независимые monotonic generations и не должны взаимно supersede друг друга.

Convert:
1. выполняет pending/type/effective-lock/nesting preflight;
2. выполняет synchronous bounds + embedded-document preparation внутри собственного error boundary;
3. только после успешной preparation получает новый convert generation;
4. пересекает preview-render await;
5. сначала проверяет generation, затем exact document/session/source object/state;
6. публикует замену слоя и history только после этих проверок.

Новая попытка, отклонённая до generation claim, не отбирает authority у уже ожидающей старой команды. Superseded continuation полностью тихая.

## Save transaction

Save использует prepare-before-publish и две независимые authority: latest-authorized generation и exact live editor/source state.

Порядок:
1. pending-edit guard;
2. sync content session;
3. capture exact child session + serialized content snapshot;
4. resolve parent; parent должен существовать и быть эффективно разблокирован;
5. synchronous shared/native target discovery выполняется внутри controller error boundary; **каждый target, который общий Save будет менять, должен пройти canonical effective-lock policy**, затем выполняется `restoreDocument(sourceSnapshot)`;
6. только после успешной preparation Save получает новый generation;
7. await preview render;
8. сначала discard superseded generation; затем verify exact child/session snapshot, заново resolve parent/source identity и полный live target set; **повторно вызвать canonical `isLayerLocked` для каждого live target**;
9. для Photoshop — await native resource rewrite preparation;
10. снова discard superseded generation, verify child/session + parent/source identity, заново resolve финальный live target set и **повторно проверить effective lock каждого target перед первой destructive publication**;
11. только после этого разрешены resource publish, target rewrite, preview/content mutation, history, dirty state, recovery, cache invalidation, tab/UI success publication.

## Финальная Photoshop publication: поддерживаемая модель ошибок

После последней revalidation Photoshop Save входит в короткую синхронную publication-зону. Для **канонического состояния редактора** её контракт намеренно уже, чем у preparation:

- `rewriteEmbeddedSource(...)` остаётся fallible/async preparation owner: codec, binary rewrite, лимиты и любая работа, которая может завершиться ошибкой, выполняются до первой destructive publication;
- `publishEmbeddedSourceRewrite(...)` и `updateTargetAfterRewrite(...)` принимают только уже подготовленный rewrite и обычные mutable JSON-state объекты редактора, выполняют синхронные присваивания/fingerprint math и возвращают `undefined`;
- эти publication helpers не должны получать I/O, Promise, codec/serialization, внешний callback или другую fallible работу после начала мутации;
- exotic host objects, `Proxy`, frozen/read-only state и process-level failures вроде OOM не входят в поддерживаемый document-state contract и не являются основанием для speculative rollback;
- если будущая реализация потребует реально бросающую операцию после первой мутации, её нужно либо перенести в prepare-before-publish, либо ввести явную all-or-none transaction/rollback до расширения publication region.

Регрессия этого контракта находится в `tests/psd-smart-object-resource.test.mjs`. Она не доказывает, что JavaScript-процесс вообще никогда не может аварийно завершиться; она защищает именно поддерживаемую production-границу: подготовленный Photoshop rewrite + канонические mutable объекты не должны вводить новый recoverable throw между resource publish и target metadata publication.

## Save post-commit feedback и recovery failure boundary

После изменения live targets и фиксации history snapshot команда обновляет parent/child dirty state, активный content document и Smart Object link. Затем следуют cache invalidation, рендер вкладок, немедленная постановка recovery snapshot и вывод результата. С этого момента **обновление документа уже выполнено**: отказ независимого recovery storage не означает rollback Smart Object.

Production `queueRecovery({ immediate:true })` синхронно синхронизирует активную сессию и сериализует **все dirty вкладки** через `snapshotDocument()` (`JSON.stringify`). Для канонических JSON-документов, ранее уже прошедших history snapshot, это синхронная подготовка. Реальная запись IndexedDB выполняется в Promise-цепочке: `saveSnapshot`/`clearSnapshot` rejection локально обрабатывается `reportRecoveryFailure`, отключает повторную запись и показывает отдельное warning. Smart Object Save должен возвращать `true` с корректным history/dirty и успехом, а пользователь — вручную сохранить родительский документ при недоступном автовосстановлении.

`invalidateImageCache` работает с Map delete/clear, а `renderDocumentTabs` создаёт стандартные DOM-элементы в исправном UI. Реалистичный recoverable synchronous throw этих портов на каноническом состоянии не установлен; общий speculative catch/rollback не добавляется. Если будущий порт начнёт делать fallible synchronous work после commit, нужно пересмотреть границу и модель feedback, чтобы уже сохранённое не выдавалось за неудачное сохранение. Повреждённые JS-объекты, внедрённые throwing callbacks и process-level OOM в эту гарантию не входят.

Integration regression: `tests/smart-object-controller.test.mjs` связывает реальный `createRecoveryController` с `snapshotDocument`, отдельной dirty-вкладкой и имитированной асинхронной ошибкой storage; проверяет committed preview, parent history/dirty, recovery snapshot и независимые success/warn сообщения.

## Effective lock — живая publication policy

Lock нельзя захватывать boolean snapshot до await. Пока Promise ожидает, любой экземпляр общего source или его ancestor group может стать locked. Shared-source Save — одна атомарная публикация: разблокированный representative не даёт права косвенно менять locked sibling, и частичное обновление только разблокированных экземпляров запрещено.

Порядок проверки важен:
- сначала generation: superseded continuation должна остаться полностью тихой;
- затем exact/source identity: нельзя читать policy у уже чужого replacement;
- затем заново получить полный live target set и проверить canonical `isLayerLocked(owner.doc, target)` для **каждого** target;
- затем downstream await либо destructive publication.

До generation claim выполняется такой же all-target lock preflight, чтобы отклонённая новая попытка не отзывала уже авторизованный старый Save. После каждого reorderable Save await полный target set и его locks доказываются заново. Если после последней lock-проверки в будущем появится новый reorderable await, generation, identity, membership и locks нужно доказать ещё раз.

Lock-stale outcome — обычное состояние редактора: Save возвращает `false`, показывает warning и не публикует parent/resource/history/dirty/recovery/cache/tab/success state.

## Regression oracles

Главный набор: `tests/smart-object-controller.test.mjs`.

Для async races использовать deferred Promise, а не sleep:
- overlapping Save: оба completion order;
- superseded preview/rewrite success и failure;
- rejected/failed newer preflight/preparation не отзывает старую authority;
- unshared same-ID replacement обязан fail closed по object identity;
- pre-existing effective lock любого linked/native sibling отменяет shared Save до async preparation/generation claim;
- lock любого sibling/ancestor, появившийся во время preview, отменяет Save до Photoshop rewrite и persisted writes;
- lock любого Photoshop sibling/ancestor, появившийся во время native rewrite preparation, отменяет Save до native-resource publication и любых persisted writes.
- linked sibling, удалённый во время preview await, не должен получать stale publication из ранее захваченного массива целей;
- linked sibling, добавленный во время preview await, обязан войти в следующий live target set и финальную публикацию;
- Photoshop sibling, добавленный/удалённый во время native rewrite await, учитывается только по финально re-resolved source membership перед resource/target publication.

Связанные regressions: `tests/linked-smart-objects.test.mjs`, `tests/psd-smart-object-resource.test.mjs`, `tests/psd-smart-object-roundtrip.test.mjs`, `tests/psd-export-integration.test.mjs`.

## Не переносить сюда

Binary PSD codec, generic session mechanics, project serialization, renderer implementation и global lock semantics остаются у своих canonical owners. Smart Object controller должен вызывать их через ports, а не дублировать.

## Verification

После изменения Smart Object lifecycle:
1. focused Smart Object tests;
2. relevant linked/Photoshop regressions;
3. `npm run check`;
4. canonical `npm run build` generated-artifact parity;
5. `npm run test:browser` для file:// runtime composition;
6. `git diff --check`;
7. exact PR-head CI, затем exact merged-main push CI.

# 051 — Зафиксировать stale-owner контракт PSD/PSB для same-document change epochs

## Почему это следующая задача

После исправления delayed authority у **File → New** соседний destructive-open путь **PSD/PSB import** уже выглядит существенно безопаснее: `src/document/psd-import-controller.js` после первоначального discard decision захватывает exact document, active session, history entry и monotonic change serial, затем после async decode/preparation проверяет все четыре значения перед публикацией.

Однако текущая видимая regression coverage в первую очередь доказывает tab/document switch. Harness уже умеет менять `changeSerial`, но отдельные same-document epoch/history regressions не закреплены. Это важный контракт: будущий рефакторинг не должен случайно превратить exact stale guard в проверку только active tab/document.

## Цель проходки

Сделать высококачественный bounded code review PSD/PSB open transaction и доказать тестами, что prepared PSD result никогда не публикуется после изменения исходного документа, даже если document object и session формально остались теми же.

Production-код менять **только если воспроизводимый тест найдёт реальный gap**. Если текущая реализация уже корректна, ограничиться regression tests + AI-facing документацией.

## Сначала прочитать

1. `AGENTS.md`
2. `docs/AI_START_HERE.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `docs/testing/TEST_MATRIX.md`
6. `src/document/psd-import-controller.js`
7. PSD/PSB runtime wiring в `src/main.js`
8. `tests/psd-import-controller.test.mjs`
9. релевантные async/document-context tests
10. `task/README.md`

Также использовать базу знаний:
- `05_GITHUB И КАЧЕСТВО КОДА/03_GITHUB OPERATIONS — коммиты, Actions, релизы и профиль`
- `05_GITHUB И КАЧЕСТВО КОДА/11_ASYNC COMMAND OWNERSHIP — await, stale-result guards и generated-artifact discipline`
- `05_GITHUB И КАЧЕСТВО КОДА/15_DELAYED UI COMMAND AUTHORITY — modal callbacks, dirty epochs и stale-owner guards`

## Обязательный code review

Проверь весь PSD/PSB open flow как temporal transaction:

- initial pending-edit guard;
- initial shared discard confirmation;
- момент захвата `targetDocument`, `targetSessionId`, `targetHistoryEntry`, `targetChangeSerial`;
- все `await` после захвата authority;
- final exact stale revalidation;
- отсутствие `await` между final revalidation и destructive publication либо наличие новой revalidation, если await появится;
- zero partial publication при stale/failure;
- status/toast side effects stale path;
- смысл exact history-entry equality: действительно ли он защищает undo/history owner и не дублирует serial бессмысленно.

Не ослабляй guard ради упрощения кода.

## Regression tests

Добавь deterministic deferred-promise tests минимум для этих сценариев:

1. **Same document + same session + changeSerial++ during decode**
   - decode завершается поздно;
   - document object не меняется;
   - session не меняется;
   - serial увеличивается;
   - `publishDocument` не вызывается;
   - показывается stale/cancel warning.

2. **Same document + same session + history owner replacement**
   - history entry меняется во время async preparation;
   - prepared result не публикуется.

3. **Late change during a later async preparation boundary**
   - не только сам `decodePsd`, но и один из последующих async этапов, например `rgbaPixelsToDataUrl` или embedded Smart Object preparation;
   - change epoch меняется после decode, но до final publication;
   - результат не публикуется.

4. **Exact owner remains current**
   - существующий happy path остаётся зелёным;
   - не добавляй лишних cancel/reconfirm.

Если test harness слишком связан с implementation details, улучшай его минимально и только для наблюдаемого контракта.

## Семантическое правило

Для PSD/PSB import при смене epoch предпочтителен **cancel + retry**, а не fresh re-confirmation уже подготовленного результата: decode/conversion строились из state и color-policy исходного owner, поэтому старый prepared result нельзя молча переавторизовать под новый state.

Это отличается от New Document modal, где factory вызывается только после свежей проверки и не использует длительно подготовленный результат старого документа.

## Документация

Если контракт ещё не зафиксирован, обнови минимально:

- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- при пользовательски заметном исправлении — `CHANGELOG.md`

Документация должна прямо сказать AI/Codex:
- PSD/PSB import authority = exact document + session + history entry + monotonic change serial;
- после async preparation stale owner отменяет публикацию;
- same-document `true → true` dirty transitions ловятся serial, а не dirty boolean;
- prepared PSD result при смене epoch отменяется, а не перенаправляется.

## Non-goals

- не переписывать PSD decoder;
- не менять ICC/color-management semantics без найденного бага;
- не расширять формат PSD/PSB;
- не рефакторить все import controllers;
- не делать большой `main.js` refactor;
- не удалять полезные stale guards;
- не маскировать проблемы через `try/catch`, suppression или отключение тестов.

## Проверка

Перед изменениями сделать Actions preflight.

После изменений:
1. targeted PSD import tests;
2. `npm run check`;
3. canonical generated-artifact parity;
4. `npm run test:browser`, если менялись source/composition/generated bundle;
5. `git diff --check`;
6. PR exact-head CI;
7. после merge — merged-main CI.

Не считать задачу выполненной, пока main CI не зелёный.

## Критерии готовности

- same-document serial/history stale scenarios доказаны deterministic tests;
- все relevant await boundaries проаудированы;
- stale prepared result имеет zero destructive publication;
- production change сделан только при реально воспроизводимом gap;
- AI-facing docs отражают точный PSD temporal-authority contract;
- generated artifacts синхронизированы канонической сборкой, если затронут runtime source;
- exact PR-head и merged-main CI зелёные;
- этот task удалён только после green merged main;
- в конце создан ровно один следующий bounded task.

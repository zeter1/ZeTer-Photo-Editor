# 052 — Сделать overlapping PSD/PSB imports latest-authorized-wins

## Почему это следующая задача

Проходка 051 доказала regression tests, что один PSD/PSB import привязан к exact document + session + history entry + monotonic change serial и не публикует prepared result после смены owner/epoch.

При code review остался соседний temporal race: два `open()` могут стартовать на одном и том же document/session/history/serial до первой публикации. Текущий exact-owner guard различает изменения редактора, но не различает **поколения самих конкурирующих PSD import commands**.

Возможные нежелательные исходы текущей схемы:
- более старый import может завершиться первым и опубликоваться, хотя пользователь уже запустил более новый import;
- если более новый import публикуется первым, поздний stale continuation старого import может затем перезаписать свежий success status/toast предупреждением об отмене;
- поздняя ошибка superseded import может показать alert/error UI, уже не относящийся к актуальному намерению пользователя.

Это отдельный bounded owner/race и не должно смешиваться с уже закрытым same-document epoch contract.

## Цель проходки

Сделать PSD/PSB import latest-authorized-command-wins без ослабления existing exact-owner guards.

Новая попытка должна supersede старую только после успешного initial preflight/discard decision. Superseded continuation не должен:
- публиковать документ;
- публиковать success/stale/error status/toast/alert поверх более новой команды;
- очищать или перенаправлять state новой команды.

## Сначала прочитать

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `docs/architecture/BOUNDARIES.md`
5. `docs/testing/TEST_MATRIX.md`
6. `src/document/psd-import-controller.js`
7. PSD runtime wiring в `src/main.js`
8. `tests/psd-import-controller.test.mjs`
9. latest-wins/generation patterns в соседних controllers/tests
10. `task/README.md`

База знаний:
- `05_GITHUB И КАЧЕСТВО КОДА/03_GITHUB OPERATIONS — коммиты, Actions, релизы и профиль`
- `05_GITHUB И КАЧЕСТВО КОДА/11_ASYNC COMMAND OWNERSHIP — await, stale-result guards и generated-artifact discipline`
- `05_GITHUB И КАЧЕСТВО КОДА/15_DELAYED UI COMMAND AUTHORITY — modal callbacks, dirty epochs и stale-owner guards`

## Обязательный code review

Проверь semantics поколения команды отдельно от document authority:

- где именно новая команда получает generation/token;
- cancelled/blocked preflight не должен случайно supersede уже разрешённый import;
- generation должен проверяться после async boundaries и непосредственно перед publication;
- exact document/session/history/change-serial guard остаётся обязательным и не заменяется generation;
- старый superseded command не должен публиковать stale/success/error UI;
- exceptions старого command не должны показывать alert/toast поверх нового command;
- expensive preparation можно прекращать раньше только там, где это не ломает cleanup и не усложняет код;
- не вводить глобальный mutable owner в `src/main.js`, если generation естественно принадлежит PSD import controller.

## Regression tests

Добавить deterministic deferred-promise tests минимум для:

1. **A старше B, A decode завершается первым после старта B**
   - обе команды получили одинаковый исходный document/session/history/serial;
   - B уже успешно прошёл initial replacement decision;
   - A не публикуется;
   - затем B завершается и публикуется ровно один раз.

2. **B завершается и успешно публикуется, A завершается позднее**
   - A не меняет финальный success status/toast B;
   - A не публикует stale warning/alert.

3. **Superseded A падает после старта B**
   - ошибка A не публикует user-facing alert/error status/toast;
   - B остаётся authoritative и может успешно завершиться.

4. **Вторая попытка не получила authority**
   - если B заблокирован pending guard либо пользователь отклонил discard до generation claim, она не должна без причины отменять уже-authorized A;
   - закрепить выбранную policy тестом.

5. **Existing exact-owner stale paths**
   - document/session/history/change-serial regressions из 051 остаются зелёными.

## Предпочтительная архитектура

Если review подтверждает race, предпочти controller-local monotonic generation/token:

`initial guards/decision → claim generation → capture exact owner ticket → async prepare → validate generation + exact owner → publish`

Не заменяй exact owner ticket одним generation counter: они защищают разные классы гонок.

Для superseded work предпочитай тихий fail-closed outcome. Stale warning нужен пользователю при изменении document authority, но не должен всплывать из старой команды, которую уже сознательно заменила более новая.

## Документация

При подтверждённом изменении обновить минимально:

- `AGENTS.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md` — так как это runtime behavior fix

Документация должна различать:
- exact document authority;
- command generation/latest-authorized intent;
- stale-owner warning vs silently superseded continuation.

## Non-goals

- не переписывать PSD decoder;
- не менять PSD mapping/color-management semantics;
- не делать generic framework для всех async commands;
- не рефакторить `src/main.js` целиком;
- не отменять полезные exact owner/history/serial guards;
- не добавлять AbortController без доказанной пользы и реальной cancellation поддержки нижнего слоя.

## Проверка

Перед изменениями: Actions preflight.

После:
1. targeted `tests/psd-import-controller.test.mjs`;
2. `npm run check`;
3. canonical generated-artifact parity;
4. `npm run test:browser` для runtime source/bundle change;
5. `git diff --check`;
6. exact PR-head CI;
7. merged-main exact-SHA push CI.

## Done gate

- latest-authorized PSD import deterministically wins независимо от completion order;
- superseded continuation не публикует document или user-facing UI;
- failed/blocked second preflight semantics явно зафиксированы;
- exact document/session/history/serial authority сохранена;
- production change имеет regression coverage и CHANGELOG;
- docs отражают два независимых слоя authority;
- exact PR-head и merged-main CI зелёные;
- этот task удалён только после green merged main;
- в конце создан ровно один следующий bounded task.

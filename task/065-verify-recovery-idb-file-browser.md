# 065 — Проверить восстановление IndexedDB autosave в браузере file:// после временного сбоя

- Приоритет: P2 (testing / reliability).
- Статус: готова к работе.
- Основание: PR #102 (`main@6e1a41cff7769cf59144437bc7f5e5239c14291e`) устранил sticky-disable в `src/workspace/recovery-controller.js`, и детерминированные Node tests + общий browser smoke прошли. Но браузерный `file://` сценарий реального adapter `src/core/recovery.js` с отклонённой транзакцией и затем успешной транзакцией не проверен.
- Цель: закрыть ровно один пробел интеграционной проверки: убедиться, что after-write-abort новая dirty-правка действительно публикуется в IndexedDB в браузере и переживает reload без потери прежней записи.
- Границы: recovery storage-adapter + browser smoke fixture. Не менять runtime без доказанной первопричины; не расширять функциональность редактора и не создавать внешний сервер.
- Проверка: через штатный browser harness с контролируемым `IndexedDB.transaction` abort/rejection выполнить: первая запись отказала → новых попыток до cooldown нет → новая dirty-правка после cooldown сохранилась → reload восстанавливает именно её. Проверить отдельный window key и отсутствие лишних тостов; постоянный отказ не запускает retry loop.
- Если/browser harness не позволяет управлять `file://` storage или временем, честно зафиксировать NOT VERIFIED и сохранить реализуемую инструментальную методику, не маскируя её mock-only проверкой.
- Gates: адресный browser сценарий → `npm run check` → `npm run test:browser` → generated parity → PR CI → main push CI; удалить карточку только после merge + зелёного main CI.

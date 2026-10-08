# 064 — Проверить восстановление autosave после временного отказа хранилища

- Приоритет: P2 (reliability).
- Статус: готова к работе.
- Основание: `src/workspace/recovery-controller.js` на `main@19e2fae4cffed1889e9e020cfdbf93ccaa2cbf7e`. `reportRecoveryFailure()` устанавливает `recoveryStorageAvailable = false`; последующие `queueRecovery()` сразу выходят. Task 063 (PR #100, main CI #498) проверила независимый success Smart Object Save при отказе записи autosave, но не проверила повторную доступность IndexedDB.
- Гипотеза, не подтверждённый баг: после временного отклонения операции IndexedDB и последующего восстановления доступности хранилища новые dirty-изменения могут остаться без recovery snapshot вплоть до перезагрузки страницы.

## Цель

Определить, нужен ли безопасный повтор autosave после подтверждённо временной ошибки, и закрепить проверенную модель без потери данных, бесконечных retry и спама предупреждениями.

## Исследование

1. Проследить `recoveryStorageAvailable`, генерации, debounce, window-key ownership и `whenIdle()` в `src/workspace/recovery-controller.js`, реальный IndexedDB storage contract в `src/core/recovery.js`.
2. Отличить восстановившуюся квоту/временный сбой от постоянно недоступного storage; проверить, может ли такой сценарий возникать при поддерживаемом `file://` режиме.
3. Не менять пользовательский runtime без доказательства поддерживаемого сценария и регрессионного теста.

## Проверки

- Детерминированно смоделировать первый `saveSnapshot` rejection и затем восстановившуюся запись при новой dirty-правке; установить ожидаемый контракт доступности и реальное поведение.
- Не терять старые recovery-записи и не затрагивать чужой window key; доказать упорядоченность и отсутствие дублирующихся сохранений.
- Постоянный отказ — ограниченное предупреждение и отсутствие необоснованных повторов.
- Сохранить независимость успешных document/Smart Object commands от результата autosave.

## Границы

Только recovery controller, storage-адаптер и связанные tests/docs. Не вводить новый backend, не удалять snapshot пользователя, не маскировать ошибки общим catch. При изменении runtime — SemVer PATCH по `docs/development/CHANGELOG_GUIDE.md`, `CHANGELOG.md` на русском, штатная сборка и bundle parity.

## Gates

Адресные recovery/session tests → `npm run check` → `npm run test:browser` при runtime/storage изменении → generated parity → `git diff --check` → точный PR CI → merge → точный main push CI.

После доказанного результата удалить карточку только после зелёного main CI и оставить одну следующую ограниченную задачу.

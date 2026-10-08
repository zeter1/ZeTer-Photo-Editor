# Журнал проходок качества

## 2026-10-08 — Запуск редактора при заблокированном localStorage

- **Направление:** исправление бага; **подсистема:** UI/запуск (обучение, настройки и AI-модель фона); **контракт:** getter `window.localStorage` может выбрасывать `SecurityError`; инициализация редактора не должна от этого зависеть; два других startup-конструктора также имели unguarded default-storage getter.
- **Причина:** `src/main.js` передавал `window.localStorage` в `createLearningCenterController` до защищённых операций чтения/записи; кроме того, `createBackgroundModels` и `createEditorSettingsController` по умолчанию читали это свойство без защиты.
- **Исходный main:** `137819d2c46be0f1d2f8b580a248b76471582a1a`. **Результат:** ветка `fix/learning-center-blocked-storage-20261008` (с PR после записи).
- **Исправление:** main безопасно получает storage один раз и передаёт всем трём startup-потребителям, контроллер обучения также обрабатывает getter по умолчанию. При отказе progress не сохраняется между открытиями диалога; обычное локальное сохранение не меняется.
- **Доказательство:** воспроизведён `SecurityError` от бросающего getter-а в Node.js; добавлены проверки `tests/learning-center.test.mjs` для default и explicit storage + composition. Исходный build FNV `2aeebf4a613aafde` сверён с `version.json`; итоговый `af1f61032582c6de` пересчитан.
- **Проверки:** PR CI `npm run check`, generated artifacts parity, `npm run test:browser`, `git diff --check` ожидаются; ручной браузер с отключённым DOM Storage ещё не проверен.
- **Статус:** ожидает проверки и интеграции; `main` не изменён.
- **Разнообразие:** последние проходки в открытых PR затронули выделения, экспорт, ICC, browser smoke и сборку, не Learning Center.

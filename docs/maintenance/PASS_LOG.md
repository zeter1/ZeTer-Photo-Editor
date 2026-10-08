# Журнал проходок качества

## 2026-10-08 — Запуск Центра обучения при заблокированном localStorage

- **Направление:** исправление бага; **подсистема:** UI/запуск; **контракт:** getter `window.localStorage` может выбрасывать `SecurityError`; инициализация редактора не должна от этого зависеть.
- **Причина:** `src/main.js` передавал `window.localStorage` в `createLearningCenterController` до защищённых операций чтения/записи; предшествующий getter с исключением прерывал запуск.
- **Исходный main:** `137819d2c46be0f1d2f8b580a248b76471582a1a`. **Результат:** ветка `fix/learning-center-blocked-storage-20261008` (с PR после записи).
- **Исправление:** controller safely obtains available storage, runtime composition no longer eagerly reads the property. При отказе progress не сохраняется между открытиями диалога; обычное локальное сохранение не меняется.
- **Доказательство:** воспроизведён `SecurityError` от бросающего getter-а в Node.js; добавлены проверки `tests/learning-center.test.mjs` для default и explicit storage + composition. Исходный build FNV `2aeebf4a613aafde` сверён с `version.json`; новый `9e68fb4400831527` пересчитан.
- **Проверки:** PR CI `npm run check`, generated artifacts parity, `npm run test:browser`, `git diff --check` ожидаются; ручной браузер с отключённым DOM Storage ещё не проверен.
- **Статус:** ожидает проверки и интеграции; `main` не изменён.
- **Разнообразие:** последние проходки в открытых PR затронули выделения, экспорт, ICC, browser smoke и сборку, не Learning Center.

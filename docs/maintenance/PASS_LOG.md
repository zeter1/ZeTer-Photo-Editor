# Журнал проходок качества

## 2026-10-08 — корректные имена загрузок Windows

- Направление: исправление бага. Подсистема: экспорт PNG/JPEG/WebP, PSD/PSB и сохранение `.zpe`.
- Контракт/первопричина: общий `src/core/io.js:safeFilename` пропускал недопустимые в Win32 device names и управляющие символы; все названные форматы дополняют его результат собственным расширением.
- Исходный `main`: `137819d2c46be0f1d2f8b580a248b76471582a1a` (версия 1.43.3); результат: ветка `fix/windows-safe-export-filenames-20261008` с исправлением, регрессионным тестом и согласованным bump 1.43.4.
- Доказательство до правки: `CON` → `CON.png`, `aux.txt` → `aux.txt.png`, `part\\0name` сохранял NUL; проверено прямым запуском исходного алгоритма Node.js.
- Проверено: baseline исходного `io.js` совпал с chunk generated bundle; исходный build hash `2aeebf4a613aafde` совпал; новый `efc0011c44fe39cf` вычислен штатным алгоритмом. PR [#120](https://github.com/zeter1/ZeTer-Photo-Editor/pull/120), [CI #37744347776](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/37744347776) для SHA `98e427c1b3e2c68a8352c6f3564937fd4d5f12ef`: успешны `npm run check`, generated-artifact parity, `npm run test:browser` (file://), `git diff --check`. Последующее уточнение этой записи не меняет source/runtime.
- Статус: исправление готово в ветке, PR #120 ожидает интеграции. Не проверено: реальный Windows Save As / скачивание под `file://`; следующий шаг: при необходимости провести ручной Windows export и интегрировать после review.

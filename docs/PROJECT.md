# ZeTer Photo Editor — быстрый инженерный вход

ZeTer Photo Editor — локальный браузерный многослойный растровый редактор. Обычная работа не требует сервера; production/runtime contract включает прямое открытие `index.html` через `file://`.

> Цель этого файла — дать разработчику или AI достаточную карту за несколько минут. Детальные исторические заметки вынесены в [reference/PROJECT_HISTORY.md](reference/PROJECT_HISTORY.md).

## 1. Куда идти по задаче

| Задача | Главные файлы | Сначала тесты |
|---|---|---|
| UI, события, меню, dialogs, pointer/keyboard | `src/main.js`, `src/ui/menu-controller.js`, `src/ui/modal-controller.js`, `src/ui/`, `src/styles.css`, `index.html` | interaction/browser tests |
| Вкладки, document sessions, session history | `src/workspace/session-controller.js`, wiring в `src/main.js` | `tests/workspace-session-controller.test.mjs`, `tests/document-tabs.test.mjs` |
| Порядок инструментов, drag/drop, tooltips | `src/ui/toolbar-controller.js`, `src/ui/tool-layout.js`, `src/ui/tool-config.js` | `tests/tool-layout.test.mjs`, browser smoke |
| Документы, слои, groups, smart objects | `src/core/state.js` | core/layer/smart-object tests |
| Рендеринг и composite | `src/core/render.js` | render/blending/high-depth tests |
| Пиксельные операции | `src/core/pixels.js`, `src/core/pixel-buffer.js` | pixel/retouch/high-depth tests |
| ICC/CMYK/soft proof | `src/core/color-management.js` | color-management/corpus tests |
| PSD/PSB import/export | `src/formats/psd.js` | `tests/psd-*.test.mjs` |
| Recovery / IO | `src/core/recovery.js`, `src/core/io.js` | recovery/reliability tests |
| Bundle/build | `tools/build-bundle.mjs` | `npm run check` |
| Реальный startup по file:// | `tools/browser-smoke.mjs` | `npm run test:browser` |

Полная карта: [architecture/CODEMAP.md](architecture/CODEMAP.md).

## 2. Source of truth

- `src/main.js` — runtime orchestrator. Это всё ещё большой файл; не читай его целиком без необходимости. Ищи конкретный symbol/event handler.
- `src/ui/tool-config.js` — чистые UI-константы, labels/help/effect-control metadata/storage keys.
- `src/ui/toolbar-controller.js` — drag/drop/persistence/drop-slot и rich tooltip lifecycle панели инструментов; выбор текущего tool остаётся в `src/main.js`.
- `src/ui/menu-controller.js` — lifecycle верхнего меню и context-menu: DOM items, позиционирование, focus/keyboard navigation, outside-click close и безопасный async action dispatch; доменные списки команд остаются в `src/main.js`.
- `src/ui/modal-controller.js` — generic modal/dialog shell: form fields, numeric normalization, focus restore, backdrop/Escape close, draggable text-modal lifecycle, info/recovery dialogs; editor-specific preview/mutations приходят callback-ами из `src/main.js`.
- `src/ui/tool-layout.js` — чистая математика порядка/позиции toolbar.
- `src/workspace/session-controller.js` — lifecycle document sessions: create/switch/close/rename/duplicate, per-tab history/zoom/dirty/selection state и smart-object parent/child tab guard.
- `src/core/*.js` — domain, render, pixel, history, IO, recovery и color logic.
- `src/formats/psd.js` — единственный канонический PSD/PSB implementation.
- `src/app.bundle.js` — generated artifact для `file://`; править только через `npm run build`.
- `src/adapters/psd.js` и `src/core/tool-layout.js` — legacy compatibility shims; implementation туда не возвращать.

## 3. Критические инварианты

1. **file:// first** — editor должен стартовать без dev-server.
2. **No destructive bypass** — lock, selection, Undo/Redo и pending async edit guards должны сохраняться.
3. **Precision ownership** — 16/32-bit и CMYK typed sources нельзя тихо сводить к Canvas8, если операция имеет native path.
4. **PSD/PSB honesty** — unsupported Photoshop semantics не выдавать за native round-trip; preserve bytes/metadata там, где контракт это обещает.
5. **Generated bundle parity** — source graph и `src/app.bundle.js` обязаны совпадать.
6. **Bounded memory/state** — safety limits и bounded caches/queues не снимать ради прохождения теста.
7. **Regression before suppression** — исправлять root cause, а не выключать проверки.

Более формальные границы: [architecture/BOUNDARIES.md](architecture/BOUNDARIES.md).

## 4. Команды проверки

```bash
npm run build
npm test
npm run check
npm run test:browser
```

- `npm run check`: build → syntax → Node regression suite.
- CI дополнительно проверяет, что generated bundle актуален, запускает real `file://` browser smoke и `git diff --check`.
- Для Canvas/pointer/drag/Clipboard визуальные/интерактивные изменения browser smoke не всегда достаточен — нужна targeted runtime verification.

Матрица: [testing/TEST_MATRIX.md](testing/TEST_MATRIX.md).

## 5. Минимальный AI workflow

INSPECT → DIAGNOSE → PLAN → CHANGE → VERIFY → REVIEW → DELIVER.

Не загружай весь `src/main.js` или всю PSD-историю заранее. Сначала прочитай карту, найди symbol через search, затем открой небольшой диапазон вокруг него и соответствующий regression test.

Подробно: [development/AI_WORKFLOW.md](development/AI_WORKFLOW.md).

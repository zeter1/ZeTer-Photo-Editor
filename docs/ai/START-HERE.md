# AI START HERE

Цель этого документа — дать AI-агенту достаточно контекста за несколько минут и не заставлять его отправлять в контекст весь проект.

## Первые 90 секунд

1. Прочитайте `AGENTS.md`.
2. Определите тип задачи по таблице ниже.
3. Откройте 1–3 основных файла владельца, затем связанные tests.
4. Ищите конкретный symbol/error/feature name прежде, чем читать большой файл целиком.
5. `src/app.bundle.js` не читать как source и не править вручную.
6. `docs/architecture/RUNTIME-CONTRACTS.md` открывать только для сложных imaging/PSD/Smart Object/high-depth/CMYK задач.

## Маршрутизация задач

| Если задача про… | Начать с | Потом проверить |
| --- | --- | --- |
| Toolbar, порядок инструментов, tooltip | `src/ui/toolbar.js`, `src/config/editor.js` | `src/core/tool-layout.js`, `tools/browser-smoke.mjs` |
| Tool selection, pointer/keyboard workflow | search нужного handler в `src/main.js` | `geometry.js`, relevant core helper |
| Слои, группы, project schema, sanitizer | `src/core/state.js` | state/project tests |
| Render/composite/export image | `src/core/render.js` | `pixel-buffer.js`, `color.js` |
| Brush/fill/retouch RGBA | `src/core/pixels.js` + relevant block in `main.js` | pixel regressions |
| 16/32-bit/HDR/typed raster | `src/core/pixel-buffer.js` | render + high-depth tests |
| CMYK/ICC/soft proof/display | `src/core/color-management.js` | `pixel-buffer.js`, color-management fixtures |
| PSD/PSB binary format | `src/adapters/psd.js` | PSD/PSB fixture tests; only then mapping in `main.js` |
| Photoshop text/shape/adjustment/smart object mapping | search feature name in `src/main.js` and `src/adapters/psd.js` | deep runtime contracts + focused tests |
| Undo/Redo | `src/core/history.js` | mutation/commit caller in `src/main.js` |
| Recovery | `src/core/recovery.js` | recovery lifecycle block in `src/main.js` |
| Layout/CSS/DOM | `index.html`, `src/styles.css` | browser smoke |
| Build/file:// startup | `tools/build-bundle.mjs`, `index.html` | `package.json`, `tools/browser-smoke.mjs` |
| CI | `.github/workflows/ci.yml` | `package.json`, verification docs |

## Как экономить токены

- **Не начинайте с `src/app.bundle.js`.** Это generated duplicate исходников.
- **Не читайте весь `src/main.js`.** Сначала найдите function/symbol, затем читайте локальный диапазон и непосредственные зависимости.
- **Не читайте весь `docs/architecture/RUNTIME-CONTRACTS.md`.** Найдите Stage/feature keyword.
- **Не загружайте все tests.** Начните с имени feature/module и соответствующего `*.test.mjs`.
- Для PSD/PSB не читайте весь adapter: ищите key (`TySh`, `levl`, `curv`, `lnk2`, `Lr16`, `Lr32`, etc.) или public function.
- Для regression сначала найдите существующий test рядом с тем же contract и расширьте его вместо создания параллельного oracle без причины.
- После чтения документации всё равно сверяйтесь с текущим кодом: код/fixtures/CI имеют приоритет над устаревшим текстом.

## Правило нового кода

Перед добавлением функции в `src/main.js` спросите:

- это pure/model/image logic? → `src/core/`;
- это binary/file-format boundary? → `src/adapters/`;
- это статическая конфигурация? → `src/config/`;
- это автономный DOM-controller без владения document model? → `src/ui/`;
- это связывание нескольких подсистем/жизненный цикл? → `src/main.js`.

Не дробите код ради количества файлов: модуль должен иметь понятного владельца, контракт и тестируемую границу.

## Минимальная проверка

Source change:

```bash
npm run check
```

DOM/startup/drag/clipboard/menu/file:// change:

```bash
npm run test:browser
```

Подробнее: [../testing/VERIFICATION.md](../testing/VERIFICATION.md).

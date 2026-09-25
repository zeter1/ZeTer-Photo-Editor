# Карта проекта ZeTer Photo Editor

ZeTer Photo Editor — локальный браузерный редактор изображений. Runtime собирается в один `src/app.bundle.js`, чтобы пользователь мог открыть `index.html` напрямую через `file://`, но исходный код разделён по владельцам.

Для AI-агента первая точка входа — [ai/START-HERE.md](ai/START-HERE.md). Этот файл даёт только карту, а не полный исторический справочник.

## Дерево верхнего уровня

```text
.
├── index.html                 # DOM-shell приложения
├── src/
│   ├── adapters/              # форматы и внешние binary contracts
│   ├── config/                # статическая конфигурация редактора
│   ├── core/                  # модель, рендер, pixel/color/geometry primitives
│   ├── ui/                    # автономные browser UI controllers
│   ├── main.js                # composition root / orchestration
│   ├── styles.css             # UI styles
│   └── app.bundle.js          # GENERATED, не редактировать
├── tests/                     # Node regression/contract tests + fixtures
├── tools/                     # build, browser smoke, maintenance utilities
├── docs/                      # короткая навигация + deep reference
├── assets/                    # локальные статические ресурсы и шрифты
└── .github/workflows/         # CI
```

## Владельцы подсистем

| Задача | Основной владелец | Обычно рядом |
| --- | --- | --- |
| Документ, слои, группы, sanitizer | `src/core/state.js` | state/tests, `src/main.js` wiring |
| Canvas renderer и raster export | `src/core/render.js` | `color.js`, `pixel-buffer.js`, layer styles |
| 8/16/32-bit RGB/CMYK primitives | `src/core/pixel-buffer.js` | `color-management.js`, PSD adapter |
| ICC/CMYK/proof/display transforms | `src/core/color-management.js` | color-management fixtures/tests |
| Геометрия, transform, snapping | `src/core/geometry.js` | `main.js` pointer orchestration |
| Базовые RGBA pixel operations | `src/core/pixels.js` | pixel tests |
| Adjustment model | `src/core/adjustments.js` | renderer + PSD mapping |
| Layer styles | `src/core/layer-styles.js` | renderer + properties UI |
| Recovery | `src/core/recovery.js` | `main.js` lifecycle |
| Browser/file helpers | `src/core/io.js` | import/export orchestration |
| PSD/PSB parsing/writing | `src/adapters/psd.js` | PSD fixtures/tests, `main.js` mapping |
| Tool labels/options/static policy | `src/config/editor.js` | `src/ui/toolbar.js`, `main.js` |
| Toolbar reorder + persistence + tooltips | `src/ui/toolbar.js` | `core/tool-layout.js`, browser smoke |
| UI workflows, pointer/keyboard, dialogs | `src/main.js` | extract only when a boundary is proven |
| DOM skeleton | `index.html` | `src/styles.css` |
| Browser bundle | `tools/build-bundle.mjs` | `src/app.bundle.js` |

Полная карта модулей: [architecture/MODULE-MAP.md](architecture/MODULE-MAP.md).

## Dependency direction

Предпочтительное направление:

```text
config + core primitives
        ↓
adapters / ui controllers
        ↓
      main.js
        ↓
generated app.bundle.js
```

`core/` не должен зависеть от DOM. `ui/` может зависеть от browser APIs и чистых `core/` helpers, но не должен владеть document model. `main.js` связывает подсистемы и остаётся единственным местом для действительно cross-feature orchestration.

## Runtime boot

1. `index.html` создаёт DOM.
2. Загружается только `src/app.bundle.js`.
3. `tools/build-bundle.mjs` детерминированно собирает bundle из source-модулей без внешней runtime-зависимости.
4. `src/main.js` выполняет bootstrap и соединяет core/adapters/ui с DOM.

Поэтому изменение source-модуля всегда требует пересборки bundle.

## Что читать глубже

- Быстрый task router для AI: [ai/START-HERE.md](ai/START-HERE.md)
- Точные владельцы и границы: [architecture/MODULE-MAP.md](architecture/MODULE-MAP.md)
- Долгоживущие imaging/PSD/runtime invariants: [architecture/RUNTIME-CONTRACTS.md](architecture/RUNTIME-CONTRACTS.md)
- Проверка изменений: [testing/VERIFICATION.md](testing/VERIFICATION.md)
- Пользовательские возможности/запуск: [../README.md](../README.md)
- История фактических изменений: [../CHANGELOG.md](../CHANGELOG.md)

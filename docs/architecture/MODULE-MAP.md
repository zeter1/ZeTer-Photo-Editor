# Module Map

Этот файл отвечает на вопрос «где живёт эта логика?». Он намеренно конкретнее `docs/PROJECT.md`, но короче deep runtime reference.

## `src/config/`

### `editor.js`
Статические labels/help/options/tool sets/storage keys. Без DOM, Canvas и mutable application state.

Добавляйте сюда только конфигурацию, которую полезно находить независимо от runtime orchestration.

## `src/ui/`

### `toolbar.js`
Владелец browser-состояния панели инструментов:
- drag/drop reorder;
- вычисление drop-slot через `core/tool-layout.js`;
- `localStorage` persistence порядка;
- suppression click после drag;
- tooltips.

Не владеет active tool или document state: выбор инструмента остаётся в `main.js`.

## `src/core/`

### `geometry.js`
Coordinates, bounds, transforms, hit-testing, selection geometry, snapping/alignment. Pure/deterministic logic предпочтительнее DOM-логики.

### `tool-layout.js`
Чистые операции порядка инструментов и mapping pointer → grid slot. UI находится в `ui/toolbar.js`.

### `history.js`
Snapshot Undo/Redo и memory/history limits.

### `io.js`
Browser I/O helpers: data URLs, Blob/text download, filenames, dimensions.

### `pixels.js`
RGBA8 pixel primitives: fill, retouch helpers, mask refinement/preview.

### `pixel-buffer.js`
Typed RGB/CMYK PixelBuffer, 8/16/32-bit samples, high-depth destructive editing/compositing, CMYK ink-space primitives.

### `color-management.js`
ICC parsing/transforms, CMYK↔PCS/display/proof policy, gamut/proof path.

### `recovery.js`
IndexedDB recovery storage boundary.

### `layer-styles.js`
Layer-style schema/sanitization/render helpers.

### `adjustments.js`
Semantic adjustment-layer model and deterministic adjustment processing.

### `state.js`
Document/layer/group/project schema, sanitization, smart-object/smart-filter state helpers. Главный владелец persisted application model.

### `color.js`
RGB/color-correction math used by rendering and worker paths.

### `pixel-worker.js`
Bounded worker bridge для тяжёлой per-pixel обработки; document/Canvas ownership остаётся на main thread.

### `render.js`
Canvas compositor, image/font caches, layer rendering and ordinary raster export.

## `src/adapters/`

### `psd.js`
Binary boundary PSD/PSB: parsing, channel compression, layer/image resources, native writeback, opaque Photoshop metadata. Не переносите UI policy в adapter.

## Composition root

### `src/main.js`
Связывает DOM, state, renderer, adapters и feature workflows. Здесь допустимы cross-feature orchestration и lifecycle, но pure/isolated functionality должна уходить к соответствующему owner.

Особенно большой `main.js` читать по symbol/range, а не целиком.

## Browser shell

### `index.html`
DOM skeleton, embedded SVG symbol definitions, input elements, script/style wiring.

### `src/styles.css`
Layout и visual state.

### `src/app.bundle.js`
**GENERATED.** Однофайловый runtime для `file://`. Не использовать как источник истины и не править вручную.

## Build / runtime tools

### `tools/build-bundle.mjs`
Authoritative source order для generated bundle. Новый runtime module должен быть явно добавлен сюда в корректном dependency order.

### `tools/browser-smoke.mjs`
Headless Chrome/Chromium real `file://` integration smoke: startup + critical DOM/browser contracts.

### `tools/generate-icc-goldens.py`
Maintenance-only generation independent color-management golden data; не runtime и не обычный CI path.

## Tests

`tests/*.test.mjs` — Node contract/regression tests. `tests/fixtures/` — локальные compatibility corpus/fixtures.

При изменении contract:
1. найдите existing test по module/feature name;
2. расширьте ближайший oracle;
3. отдельный новый test создавайте, если появляется новая архитектурная boundary.

## Документация

- `AGENTS.md` — короткие обязательные правила для агента.
- `docs/ai/START-HERE.md` — task router и token-saving reading strategy.
- `docs/PROJECT.md` — верхнеуровневая карта.
- `docs/architecture/MODULE-MAP.md` — этот owner map.
- `docs/architecture/RUNTIME-CONTRACTS.md` — подробные imaging/PSD/history contracts.
- `docs/testing/VERIFICATION.md` — proof ladder и команды.
- `README.md` — пользователь/портфолио: возможности, запуск, диагностика, краткая архитектура.
- `CHANGELOG.md` — фактическая история изменений.

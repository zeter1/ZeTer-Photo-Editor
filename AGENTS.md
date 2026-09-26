# ZeTer Photo Editor — agent entrypoint

Сначала прочитай [docs/PROJECT.md](docs/PROJECT.md). Не загружай весь репозиторий без причины.

## Канонические границы

- UI/runtime orchestration and tool-specific pointer dispatch: `src/main.js`
- Global overlay pointer lifecycle, capture/release and active-pointer routing: `src/interaction/pointer-lifecycle-router.js`
- Workspace/session/tab lifecycle: `src/workspace/session-controller.js`
- Recovery/autosave orchestration, window ownership, debounce/restore: `src/workspace/recovery-controller.js`; IndexedDB persistence only: `src/core/recovery.js`
- Document import / file routing: `src/document/import-controller.js`
- Selection shape gestures (marquee/lasso/polygon/magnetic), draft lifecycle: `src/selection/gesture-controller.js`
- Selection copy/cut/paste lifecycle: `src/selection/clipboard-controller.js`
- Destructive selection raster mutation, merged-cut clearing and selected-layer rasterization: `src/selection/raster-mutation-controller.js`
- Raster edit state, Canvas/high-depth buffers, persistence and paint preview: `src/painting/controller.js`
- Fill / raster line / current-layer selection clear commands: `src/painting/command-controller.js`
- Brush/eraser + retouch stroke gesture lifecycle (begin/move/end): `src/painting/gesture-controller.js`
- Clone/heal/smudge/blur/dodge/burn mechanics (Canvas8 + high-depth/CMYK): `src/retouch/controller.js`
- UI config + toolbar/menu/modal/workspace-layout/saved-Paths controllers: `src/ui/`
- Saved Paths selection/CRUD/panel/context-menu/vector-mask apply orchestration: `src/ui/paths-controller.js`; Pen geometry stays in `src/main.js`, PSD codec in `src/formats/psd.js`.
- Core domain/render/pixel logic + low-level storage primitives: `src/core/`
- PSD/PSB format boundary: `src/formats/psd.js`
- Generated file:// bundle: `src/app.bundle.js` — **не редактировать вручную**
- Tests: `tests/`
- Build/smoke tooling: `tools/`
- Future-pass queue/handoff: `task/README.md` — читай только одну верхнюю релевантную задачу, а не всю очередь.

`src/adapters/psd.js` и `src/core/tool-layout.js` — только compatibility shims. Новую логику туда не добавлять.

## Быстрый выбор документа

- где находится код → `docs/architecture/CODEMAP.md`
- какие зависимости допустимы → `docs/architecture/BOUNDARIES.md`
- как работать AI/Codex → `docs/development/AI_WORKFLOW.md`
- как делать refactor/debug/review/tests с доказательствами → `docs/development/QUALITY_PLAYBOOK.md`
- какие проверки запускать → `docs/testing/TEST_MATRIX.md`
- что делать в следующей небольшой проходке → `task/README.md`
- подробная историческая инженерная летопись → `docs/reference/PROJECT_HISTORY.md`

## Обязательные инварианты

Сохраняй `file://` запуск на Windows, layer lock, selection boundaries, Undo/Redo, async save/export guards, high-depth/CMYK precision и PSD/PSB round-trip semantics.

После source change: `npm run check`; для startup/DOM/file://: `npm run test:browser`. Любое изменение кода отражай в `CHANGELOG.md`.

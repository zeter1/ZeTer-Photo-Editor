# ZeTer Photo Editor — agent entrypoint

Сначала прочитай [docs/PROJECT.md](docs/PROJECT.md). Не загружай весь репозиторий без причины.

## Канонические границы

- UI/runtime orchestration: `src/main.js`
- Workspace/session/tab lifecycle: `src/workspace/session-controller.js`
- UI config + toolbar layout: `src/ui/`
- Core domain/render/pixel logic: `src/core/`
- PSD/PSB format boundary: `src/formats/psd.js`
- Generated file:// bundle: `src/app.bundle.js` — **не редактировать вручную**
- Tests: `tests/`
- Build/smoke tooling: `tools/`

`src/adapters/psd.js` и `src/core/tool-layout.js` — только compatibility shims. Новую логику туда не добавлять.

## Быстрый выбор документа

- где находится код → `docs/architecture/CODEMAP.md`
- какие зависимости допустимы → `docs/architecture/BOUNDARIES.md`
- как работать AI/Codex → `docs/development/AI_WORKFLOW.md`
- какие проверки запускать → `docs/testing/TEST_MATRIX.md`
- подробная историческая инженерная летопись → `docs/reference/PROJECT_HISTORY.md`

## Обязательные инварианты

Сохраняй `file://` запуск на Windows, layer lock, selection boundaries, Undo/Redo, async save/export guards, high-depth/CMYK precision и PSD/PSB round-trip semantics.

После source change: `npm run check`; для startup/DOM/file://: `npm run test:browser`. Любое изменение кода отражай в `CHANGELOG.md`.

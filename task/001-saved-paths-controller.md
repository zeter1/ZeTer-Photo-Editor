# 001 — Extract saved Paths panel controller

## Goal

Уменьшить `src/main.js`, вынеся cohesive UI/state orchestration сохранённых Paths в отдельный narrow controller без изменения PSD/vector-mask semantics.

## Why now / evidence

После workspace layout extraction в `src/main.js` остаётся связный блок Paths примерно вокруг `normalizeSelectedDocumentPathIndex` → `updatePathsPanel`. Existing `tests/paths-panel.test.mjs` в основном source-contract tests и всё ещё привязаны к расположению функций в main.

## Scope

Вынести ownership выбранного saved-path index, CRUD/panel rendering/context-menu wiring и session-facing selected-index bridge в новый controller (ориентир: `src/ui/paths-controller.js` или другой точный owner после inspect).

## Non-scope

Не переносить в эту же проходку PSD binary codec, generic Pen geometry, vector-mask coordinate conversion или Smart Object code, если они не нужны как узкие injected ports.

## Inspect first

- `AGENTS.md`, `docs/PROJECT.md`, `docs/architecture/CODEMAP.md`
- symbols: `selectedDocumentPathIndex`, `normalizeSelectedDocumentPathIndex`, `pathFromCurrentSource`, `updatePathsPanel`, `pathContextMenu`
- `tests/paths-panel.test.mjs`, `tests/vector-masks.test.mjs`, `tests/architecture-layout.test.mjs`
- session selected-path bridge in `src/workspace/session-controller.js`

## Behavioral contracts to preserve

- Photoshop-compatible resource ID range 2000..2997 and 998-path limit.
- Per-document selected path state survives session switching.
- Entering/leaving Pen edit mode does not leak across documents.
- Locked/adjustment layer rules for applying vector masks stay intact.
- Context-menu/button accessibility and panel keyboard navigation stay intact.

## Targeted tests

Prefer direct public-controller tests for CRUD/selection/render-state decisions; keep one architecture guard proving the owner did not drift back into `src/main.js`. Preserve existing vector-mask/paths regressions.

## Required verification

`npm run check` + `npm run test:browser`; inspect PR CI and then main CI.

## Done gate

Merged to main, green main CI, docs/maps/test matrix updated, generated bundle current. Then delete this task file.

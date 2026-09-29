# 048 — Extract History panel renderer

## Goal
Вынести DOM-рендеринг панели **History** из `src/main.js` в узкий UI owner, сохранив уже выделенный runtime-navigation owner из Task 047 и не возвращая HistoryStack/session/document policy обратно в UI.

## Why now / fresh-main evidence
- Task 047 merged as `main@cca6be05d46c9cd3fdc19fa339c73644ee02d51e`; exact merged-main push CI run `36543441878` green.
- `src/workspace/history-navigation-controller.js` теперь canonical owner для Undo / Redo / jump-to-history transactions.
- Fresh `src/main.js` всё ещё содержит `updateHistory()`: создаёт History rows, current marker/title/disabled state, wiring `row.onclick = () => jumpToHistory(index)` и scroll-to-bottom.
- `updateAll()` всё ещё вызывает этот DOM helper рядом с unrelated workspace/layers/properties/render orchestration.
- Seam небольшой, синхронный и хорошо отделяется через `getHistory` + `onJump`, поэтому это безопасная следующая bounded проходка.

Текущий код/тесты/CI — source of truth. Перед write заново перепроверь fresh `main`, blob SHAs, task queue и Actions preflight.

## Inspect first
1. `AGENTS.md` → `docs/PROJECT.md` → `task/README.md` → этот task.
2. Fresh `src/main.js` вокруг `updateAll()`, `updateHistory()`, `#clearHistoryBtn`, History/Undo/Redo controls и session switching.
3. `src/workspace/history-navigation-controller.js` — navigation transaction boundary; UI owner не должен дублировать его.
4. `src/core/history.js` — HistoryStack entries/index/current/clear semantics.
5. `src/workspace/session-controller.js` — live per-session history binding.
6. Existing architecture/source tests and fake-DOM controller tests.
7. `tools/build-bundle.mjs` and `.github/workflows/ci.yml`.

## Behavioral contracts to preserve

### Rendering
- Every render resolves the **current live history binding**; no stale HistoryStack capture across tab/session switches.
- Render one `button` per `history.entries` item in order.
- Preserve exact class semantics: `history-row current` only at `history.index`.
- Preserve exact visible marker: current row text begins with `● `; other rows do not.
- Preserve exact titles:
  - current: `Текущее состояние`
  - other: `Перейти к этому состоянию`
- Current row remains disabled; non-current rows remain actionable.
- Clicking a non-current row delegates its exact index to the injected jump/navigation callback.
- After render, preserve `scrollTop = scrollHeight`.

### Session identity
- Re-render after a session switch must show the replacement session's history object, not the object present when the controller was created.
- No async boundaries are needed.

### Ownership
- `src/workspace/history-navigation-controller.js` remains the only runtime owner for Undo / Redo / jump-to-history mutation.
- `src/core/history.js` remains the only HistoryStack mechanics owner.
- `src/workspace/session-controller.js` remains the per-tab history binding owner.
- `src/main.js` remains composition root and may keep the Clear History command unless fresh inspection proves a narrow UI binding is cleaner; do not merge clear-history mutation into navigation semantics without evidence.

## Target boundary
Prefer `src/ui/history-panel-controller.js` with explicit ports:
- `container`: History list DOM node;
- `state.getHistory()`: current live HistoryStack-like binding;
- `commands.jumpToHistory(index)`: injected navigation callback;
- optional `documentRef` for deterministic tests if needed.

Do not pass a broad app/context object.

The owner should not:
- call `restoreDocument`, `markDirty`, `updateAll` or `setStatus`;
- call `history.undo/redo/jump` itself;
- own HistoryStack construction/snapshots;
- own tabs/session lifecycle;
- absorb generic menu/keyboard/button routing;
- redesign History UX.

## Source-oracle closure
Before deleting `updateHistory()` from `main.js`, search repository-wide for:
- direct calls;
- tests using `slice/indexOf`, regex/source guards, VM/eval;
- generated-bundle order guards;
- Clear History wiring that assumes the old helper exists.

Retarget brittle source tests to the canonical panel owner or stable semantic boundary; do not keep compatibility wrappers solely for tests.

## Targeted tests
Add direct owner coverage for at least:
1. required bridge/container fail-fast;
2. empty history render;
3. ordered rows, exact labels/classes/titles and current disabled state;
4. non-current click delegates exact index;
5. current row is inert because it is disabled at the UI layer;
6. scroll-to-bottom after render;
7. live history binding replacement between renders;
8. composition: `updateAll()` routes to owner, `main.js` no longer defines `updateHistory()`;
9. build graph loads owner before `main.js`.

If Clear History binding moves too, add direct coverage preserving exact `clearToCurrent` + refresh behavior and no document-dirty publication; otherwise leave it in composition scope.

## Documentation
Update the smallest relevant set:
- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

No dedicated spec unless fresh inspection reveals a durable History-panel invariant not already captured above.

## Non-scope
- No History panel redesign/styles.
- No HistoryStack limit/byte-limit/persistence changes.
- No Undo/Redo/jump transaction changes.
- No Clear History semantic redesign.
- No session/tab lifecycle refactor.
- No Properties/Inspector extraction.
- No Help/About/Shortcuts extraction.
- No keyboard/menu redesign.

## Required verification
Focused History panel/controller tests + history navigation/core/session regressions → architecture/source guards → full `npm run check` → generated artifact parity → real `npm run test:browser` file:// smoke → `git diff --check` → exact PR-head CI → squash merge with expected head SHA → exact merged-main push CI.

If CI fails: run → jobs → first failed step/log → classification → root cause → minimal real fix. Never weaken a useful check.

## Done gate
Only after exact merged-main push CI is green:
- delete this task;
- create exactly one next bounded task from fresh `main`;
- update Drive brains only if the pass produced a genuinely new reusable lesson not already captured.

## Handoff risks
- The history object is a mutable per-session binding; stale capture is the primary correctness risk.
- `updateAll()` currently syncs session state before rendering panels, so keep History render on the existing refresh path.
- Current-row disabled behavior is part of navigation safety and should stay pinned by direct DOM tests.
- File:// bundle source order must initialize the new controller before `src/main.js`.

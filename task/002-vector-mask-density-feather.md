# Stage 2 / CAP-MASK-VD — Vector Mask density and feather (2026-11-07)

## Scope

Неразрушающие `density` 0..1 и `feather` 0..250 px в векторных
масках, сохранение исходных cubic subpaths, legacy defaults 1/0.
`renderVectorMaskBitmap` после операций subpaths применяет
`applyMaskControlsAlpha` (feather → invert → density) в обеих
ветках композитинга. PSD/PSB editable metadata не включена.

UI — «Параметры векторной маски…» в меню «Слой» и контекстном
меню. Один History checkpoint при успешном изменении, no-op
без истории; stale owner/layer/mask и locked target отвергаются.
Замена контура сохраняет density/feather. Сводка показывает значения.

## Changed source and tests

`src/core/state.js`, `src/core/render.js`,
`src/selection/vector-mask-controller.js`, `src/main.js`;
`tests/selection-vector-mask-controller.test.mjs`, `tests/vector-masks.test.mjs`;
`tools/browser-smoke.mjs`, `tools/browser-vector-mask-controls-smoke.mjs`,
`package.json`, generated `src/app.bundle.js`, `index.html`,
`version.json`, workflow, architecture/testing docs, task + CHANGELOG.

## Acceptance (exact SHA to be recorded after publication)

Base main: `9fa6a7d90477bc4c36534daeaec3a7e71153c6ec`. [PR #378 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378), implementation head `5aee2881db25cf5feffcdbcef3602f5a21efad22`; exact final head CI after this task-update commit must be checked separately.
LOCAL PASS: 25/25 focused unit, `npm run build`, `git diff --check`.
Real Chrome `file://` `npm run test:browser:vector-mask` PASS:
shape alpha before/after density + feather, menu/form,
single History, Undo/Redo, original Ctrl+S .zpe Blob and reopen
with identical alpha and editable fields.
Full Windows `npm run check`: 1609 tests, 1594 PASS, 10 SKIP,
5 Linux-only /proc/cgroup failures. Overall FAIL (not full green).
The menu VM harness and current version marker regression were fixed.
Windows Chrome full `npm run test:browser`: PASS (`Browser smoke passed`, file://). Remote PR-head CI remains a separate gate.
PSD/PSB independent Photoshop-authored visual/editor parity NOT VERIFIED.

## Next

CI PR-head + independent real-photo → review/merge gates →
exact-main CI. Then CAP-ADJ Levels/Curves editable composite,
Undo/Redo, .zpe and PSD bounded round-trip.

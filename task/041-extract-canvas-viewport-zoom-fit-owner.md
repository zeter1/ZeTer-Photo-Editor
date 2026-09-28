# Task 041 — Extract canvas viewport zoom / fit orchestration from `src/main.js`

## Goal

Вынести zoom/fit-to-view runtime policy из большого `src/main.js` в узкий owner, сохранив существующую клавиатурную/колёсную/menu wiring и поведение viewport. Цель — уменьшить composition root и дать ChatGPT/Codex прямой canonical owner для изменения масштаба без чтения больших участков `main.js`.

## Why now / fresh-main evidence

Task 040 завершён и проверен: PR #66 exact-head CI green, squash-merge `main@b3b7cdcf863dbdb72cb16c0d2e67435333cfd1ed`, push CI run #375 green.

Fresh-main inventory показывает:

- `src/main.js` всё ещё около **158 KB / 2856 строк / 134 top-level functions**, несмотря на предыдущие extraction-проходки.
- Canvas navigation остаётся без отдельного owner-а:
  - `setZoom(next, announce=true)`;
  - `setZoomAtClientPoint(next, clientX, clientY)`;
  - `fitToView()`.
- Zoom — per-session runtime state: каждая команда обновляет `zoom` и `currentSession().zoom`.
- Point-anchored zoom после изменения масштаба делает deferred scroll correction через `requestAnimationFrame`.
- `fitToView()` использует `fitZoom(viewportWidth, viewportHeight, doc.width, doc.height, 90)` и затем `viewport.scrollTo({left:0,top:0})`.
- Keyboard/menu/wheel dispatch уже отделим от policy: `Ctrl+0`, `Ctrl+1`, `Ctrl++/-`, View menu и Ctrl/Alt+wheel лишь вызывают zoom/fit functions.
- `src/ui/workspace-layout-controller.js` отдельно владеет canvas-mode/sidebar visibility и сохранением центральной точки viewport; это соседний, но другой owner.
- `tests/workspace-navigation-v17.test.mjs` сейчас в основном source-regex проверяет zoom wiring в `main.js`, поэтому extraction потребует миграции source oracle + direct behavioral tests нового owner-а.

Current code/tests/CI остаются source of truth; перед реализацией перепроверить свежий `main`.

## Scope

1. Создать узкий owner, предпочтительно `src/workspace/viewport-controller.js` (или другой явно обоснованный workspace/UI путь), который владеет:
   - canonical zoom clamp **0.1 … 16**;
   - semantic no-op при практически неизменном масштабе;
   - записью нового zoom в active session;
   - canvas-size + overlay refresh после zoom;
   - optional status announcement;
   - point-anchored zoom + deferred scroll correction;
   - fit-to-view calculation + viewport reset.
2. Оставить в `src/main.js`:
   - keyboard/menu/wheel event dispatch;
   - глобальное `zoom` state bridge, если полное перенесение состояния расширит scope;
   - pan gesture routing (`drag.kind='pan'`, middle mouse, Space);
   - generic DOM bootstrap.
3. Передавать runtime/state/geometry/DOM через явные narrow ports; не создавать generic app context/state bag.
4. Retarget source tests и добавить direct behavioral tests нового owner-а.
5. Обновить canonical build graph, `AGENTS.md` / `PROJECT.md` / CODEMAP/BOUNDARIES/AI routing только в нужных местах.
6. Обновить `CHANGELOG.md` как behavior-preserving refactor.

## Non-scope

- Не менять UX масштабирования, min/max zoom, горячие клавиши или View menu.
- Не менять pan gesture / Space / middle-button behavior.
- Не объединять `workspace-layout-controller.js` с новым viewport owner-ом без явного доказательства необходимости.
- Не менять document session schema/history semantics.
- Не менять Canvas render pipeline, pixel interpolation policy или transform geometry.
- Не добавлять smooth zoom/animation, new UX, wheel sensitivity settings или feature work.
- Не рефакторить unrelated Properties/menu/PSD code.

## Inspect first

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/development/AI_WORKFLOW.md`
- `task/README.md`
- this task only
- `src/main.js`: zoom state, `setZoom`, `setZoomAtClientPoint`, `fitToView`, wheel/key/menu callers, `updateCanvasSize`, `clientPointToCanvas`
- `src/workspace/session-controller.js`
- `src/ui/workspace-layout-controller.js`
- `src/core/geometry.js` / `fitZoom`
- `tests/workspace-navigation-v17.test.mjs`
- `tests/workspace-session-controller.test.mjs`
- `tests/architecture-layout.test.mjs`
- `tools/build-bundle.mjs`
- `.github/workflows/ci.yml`

## Behavioral contracts to preserve

1. Zoom is clamped to **10%–1600%**.
2. A near-identical requested zoom is a no-op: no unnecessary resize/redraw/status publication.
3. Every real zoom updates both live runtime zoom and the current session's stored zoom.
4. Every real zoom updates canvas sizing and overlay geometry.
5. Normal zoom announces exact rounded percent when requested; silent callers remain silent.
6. Point-anchored zoom preserves the canvas point under the client pointer by applying the existing post-layout scroll correction after the zoom update.
7. Fit-to-view uses viewport dimensions + current document dimensions + existing **90 px** padding policy, then resets viewport scroll to origin.
8. Keyboard/menu/wheel contracts remain:
   - Ctrl/Alt + wheel anchors zoom at pointer;
   - Ctrl+0 → fit;
   - Ctrl+1 → 100%;
   - Ctrl + plus/minus → ±0.1;
   - View menu delegates to the same canonical commands.
9. Per-tab/session zoom restore remains compatible with `workspace/session-controller.js`.
10. Canvas-mode panel toggle continues preserving the central canvas point through `workspace-layout-controller.js`.
11. `file://` startup remains first-class.

## Planned direction

Preferred composition:

```text
src/main.js
  keyboard / wheel / View-menu dispatch
            │
            ▼
src/workspace/viewport-controller.js
  zoom clamp + session sync
  canvas/overlay refresh
  pointer-anchored scroll correction
  fit-to-view
            │
            ├─ geometry ports: clamp / fitZoom / clientPointToCanvas
            ├─ state ports: get/set zoom, current session, current document
            └─ UI/runtime ports: viewport, overlay rect, resize/redraw/status/rAF
```

Do not let the new owner take pan-drag state or general workspace-layout responsibilities.

## Targeted tests

Add direct deterministic tests for the owner, at minimum:

- zoom clamp to min/max;
- semantic no-op avoids resize/redraw/status;
- active-session zoom synchronization;
- announce true/false status behavior;
- point-anchored zoom computes the same scrollLeft/scrollTop correction using a controllable synchronous/deferred `requestAnimationFrame` port;
- fit-to-view delegates existing `fitZoom(..., 90)`, updates zoom and resets scroll;
- no active session still updates live zoom safely;
- source/architecture guard: implementation leaves `src/main.js`, event wiring remains there;
- source/architecture guard: pan gesture ownership does **not** move into the viewport owner;
- build graph loads the new owner before `src/main.js`.

Retarget `tests/workspace-navigation-v17.test.mjs`: behavior/oracle for zoom math should point to the canonical owner; keep only dispatch wiring assertions in `main.js`.

## Required verification

1. Focused viewport/navigation + workspace session tests.
2. Architecture/source guards.
3. `npm run check`.
4. Canonical generated-artifact parity.
5. `npm run test:browser` with real `file://` startup.
6. `git diff --check`.
7. Exact PR-head CI green.
8. Squash merge only verified head.
9. Exact merged-`main` push CI green.

## Done gate

Only after implementation + verification + merge + green exact main push CI:

1. delete Task 041;
2. create exactly one evidence-based next task from fresh `main`;
3. update reusable project/brain documentation only for lessons that were actually verified.

## Risks / handoff notes

- Main risk is scroll anchoring behavior: DOM layout changes after zoom are why the current implementation uses `requestAnimationFrame`; do not "simplify" it away without proof.
- Source-regex tests currently treat `main.js` as implementation owner; migrate the oracle rather than duplicating code in `main.js`.
- Preserve per-session zoom ownership. A clean extraction that stops updating `currentSession().zoom` is a regression even if visible zoom works.
- Keep `workspace-layout-controller.js` separate: it owns shell visibility and center preservation across panel toggles, not zoom command policy.

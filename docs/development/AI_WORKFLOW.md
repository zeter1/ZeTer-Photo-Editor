# AI / Codex workflow

## Goal

Find the smallest correct context, change the canonical owner, and prove the result without making the model reread the entire editor.

## 1. INSPECT

Read in this order:
1. `AGENTS.md`;
2. `docs/PROJECT.md`;
3. one targeted map (`CODEMAP`, `BOUNDARIES` or `TEST_MATRIX`);
4. the exact source symbol and nearby test.

Avoid opening all of `src/main.js`, `src/formats/psd.js`, `CHANGELOG.md` or historical docs unless the task truly spans them.

For a multi-pass continuation, read `task/README.md`, then open only the highest-priority task that matches the request. A task file is pending intent, not evidence: current code, logs and CI override it.

## 2. DIAGNOSE

For bugs, start from observable evidence: failing test, browser error, traceback, exact UI reproduction or corrupted format fixture. Classify the owner before editing.

Useful routing:
- generic overlay pointer capture / active-pointer ownership / up-cancel-lost-capture → `interaction/pointer-lifecycle-router`
- tool-specific pointer branches → generic capture in `interaction/pointer-lifecycle-router`; transient Crop gesture/session draft/overlay in `interaction/crop-gesture-controller` with `architecture/CROP_INTERACTION.md`; Move/Resize/Rotate transaction in `interaction/layer-transform-gesture-controller`; existing Bézier discovery/hit/render/live-target identity in `interaction/path-control-surface-controller`; Alt-click anchor→corner one-shot mutation/history in `interaction/path-control-command-controller`; existing Bézier anchor/handle transaction in `interaction/path-control-gesture-controller`; transient new Pen draft/handle gesture in `interaction/pen-draft-gesture-controller`; final new-path Shape/history publication in `interaction/pen-path-command-controller`; pointer routing in `main`; persisted Crop geometry/history in `document/crop-command-controller`
- sidebar collapse / canvas-mode shell visibility → `ui/workspace-layout-controller`
- zoom / pointer-anchored zoom / fit-to-view → `workspace/viewport-controller` + `architecture/VIEWPORT_NAVIGATION.md`; keyboard/menu/wheel dispatch remains in `main`
- Saved Paths selection/CRUD/panel/context menu/apply-as-vector-mask → `ui/paths-controller`; existing Shape/Vector Mask/Saved Path discovery/hit/drawing → `interaction/path-control-surface-controller`; Alt-click anchor→corner → `interaction/path-control-command-controller`; existing anchor-handle drag transaction → `interaction/path-control-gesture-controller`; transient new-path draft/point-handle gesture → `interaction/pen-draft-gesture-controller`; final new-path Shape/history publication → `interaction/pen-path-command-controller`; PSD resource codec → `formats/psd`
- other DOM/menu/dialog interaction → main + ui
- document/layer invariant → state
- clone/heal/smudge/blur/dodge/burn mechanics → retouch/controller + painting/controller state; include painting/gesture-controller when the bug is in stroke begin/move/end routing
- Gradient persisted publication / late async result / wrong-tab layer → `painting/gradient-command-controller.js` + `architecture/GRADIENT_COMMAND.md`; inspect `main.js` only for preview/pointer owner handoff
- Canvas8 **or native high-depth/CMYK** raster buffer / async PNG-preview persistence / wrong-tab or same-ID target → `painting/controller.js` + `architecture/RASTER_PERSISTENCE.md`; inspect the command/gesture owner next, and do not treat `layer.id` as mutation authority
- brush/eraser/retouch stroke begin/move/end → painting/gesture-controller + painting/controller + retouch/controller
- fill / raster line / current-layer selection clear → painting/command-controller + painting/controller + pixel-buffer/pixels; main only supplies selection/tool/transaction ports
- marquee / ellipse / free-lasso / polygon / magnetic selection gesture → selection/gesture-controller; inspect main only for global pointer/keyboard routing
- Selection Copy/Cut async ownership/render/write → selection/clipboard-copy-cut-controller + architecture/SELECTION_CLIPBOARD.md; Paste/native fallback → selection/clipboard-controller; destructive merged cut / rasterize selected layer → selection/raster-mutation-controller
- pixels/precision → pixel-buffer/pixels
- rendering → render
- ICC/CMYK → color-management
- PSD/PSB import transaction / decoded layer-group-path mapping / high-depth-CMYK source preservation / stale-tab import guard → `document/psd-import-controller`; Photoshop Text/Shape/Adjustment/Smart Object import decisions or embedded asset mapping → `document/psd-import-semantics`
- Photoshop Text/Shape/Adjustment/Smart Object native export eligibility or metadata rewrite decision → `document/psd-native-metadata-plans`; PSD/PSB export preparation / bounds / group mapping / native high-depth-CMYK eligibility / merged composite → `document/psd-export-controller`; binary parse/write/rewrite primitives → `formats/psd`
- recovery/autosave / dirty-tab snapshot / restore/discard / multi-window ownership → `workspace/recovery-controller`; IndexedDB record/storage bug → `core/recovery`
- startup/file:// → build-bundle + browser-smoke

## 3. PLAN

Prefer a bounded diff. Preserve existing behaviour not named by the task. If moving code, define its new owner and dependency direction first.

## 4. CHANGE

- edit canonical modules, never generated bundle directly;
- keep old import paths only as tiny compatibility shims when migration risk justifies them;
- do not hide failures with broad try/catch, disabled tests or weak assertions;
- add regression coverage for fixed behaviour;
- prefer public/controller API tests over VM/source slicing of private function text; keep structural source tests only for architecture ownership contracts;
- when a change establishes or discovers a reusable behavioral contract, owner split, failure pattern or non-obvious invariant, create or update the smallest targeted specification/pattern document and link it from the navigation map. Do not duplicate code comments into broad prose; document what future AI needs to avoid rediscovery or semantic drift.

## 5. VERIFY

Minimum source change gate: `npm run check`.

Also use `npm run test:browser` for startup, DOM, toolbar, menus, persistence and real `file://` behaviour.

A green syntax check is not proof of Canvas/pointer/format/runtime behaviour. Report NOT VERIFIED for layers you could not exercise.

For non-trivial refactor/debug/reliability work, use `docs/development/QUALITY_PLAYBOOK.md` for the evidence/test-oracle/review checklist.

## 6. REVIEW

Inspect the final diff for:
- accidental generated/manual edits;
- stale import paths;
- duplicated owners;
- changed safety limits;
- missing changelog;
- docs that point at old paths.

## 7. DELIVER

State what changed, what was actually verified, and any remaining NOT VERIFIED layer. Do not claim stronger verification than the evidence.

## Token-saving search strategy

Use path → symbol → bounded range → nearest test. For pointer bugs, inspect `src/interaction/pointer-lifecycle-router.js` first when the symptom is capture/ownership/lost-capture; inspect `src/interaction/crop-gesture-controller.js` plus `docs/architecture/CROP_INTERACTION.md` for Crop gesture/draft/session/overlay semantics; inspect `src/interaction/layer-transform-gesture-controller.js` for layer transform transaction semantics; inspect `src/interaction/path-control-surface-controller.js` for existing Bézier target/hit/render identity, `src/interaction/path-control-command-controller.js` for Alt-click one-shot mutation/no-op/history semantics, `src/interaction/path-control-gesture-controller.js` for existing-control drag/threshold/history/cancel semantics, `src/interaction/pen-draft-gesture-controller.js` for a brand-new Pen draft/handle lifecycle, and `src/interaction/pen-path-command-controller.js` for final bounds/localization/Shape/history publication; for persisted Gradient async ownership inspect `src/painting/gradient-command-controller.js` + `docs/architecture/GRADIENT_COMMAND.md`; open `src/main.js` only for pointer/keyboard dispatch, Gradient preview and outcome presentation. Historical notes are last resort, not the first context loaded.

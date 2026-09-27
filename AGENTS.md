# ZeTer Photo Editor — agent entrypoint

Сначала прочитай [docs/PROJECT.md](docs/PROJECT.md). Не загружай весь репозиторий без причины.

## Канонические границы

- UI/runtime orchestration and tool-specific pointer dispatch: `src/main.js`
- Global overlay pointer lifecycle, capture/release and active-pointer routing: `src/interaction/pointer-lifecycle-router.js`
- Workspace/session/tab lifecycle: `src/workspace/session-controller.js`
- Recovery/autosave orchestration, saved-project manager actions, window ownership, debounce/restore/delete policy: `src/workspace/recovery-controller.js`; recovery dialog DOM/actions: `src/ui/modal-controller.js`; IndexedDB persistence only: `src/core/recovery.js`
- Document import / file routing: `src/document/import-controller.js`
- Document Image Size / Canvas Size persisted command policy, stale-modal owner guard, atomic resize plan + history publication: `src/document/resize-command-controller.js`; modal fields/status remain in `src/main.js`, reusable limits/math in `src/core/state.js`.
- Document Crop persisted geometry command policy, exact gesture/selection owner guard, atomic layer-position plan and no-op/history completion: `src/document/crop-command-controller.js`; crop gesture/overlay/min-size gates remain in `src/main.js`, reusable limits in `src/core/state.js`.
- Document Background persisted command policy, exact-owner stale-modal guard and semantic no-op/history suppression: `src/document/background-command-controller.js`; modal/options/status remain in `src/main.js`, schema/default in `src/core/state.js`.
- Smart Object content lifecycle (convert/open/save/link/unlink, shared-source propagation and content-tab stale guards): `src/document/smart-object-controller.js`.
- Photoshop Smart Object embedded PNG/PSD/PSB serialization, `liFD` linked-resource prepare/publish and baseline metadata refresh: `src/document/psd-smart-object-resource.js`; low-level PSD/PSB bytes stay in `src/formats/psd.js`.
- Selection shape gestures (marquee/lasso/polygon/magnetic), draft lifecycle: `src/selection/gesture-controller.js`
- Selection copy/cut/paste lifecycle: `src/selection/clipboard-controller.js`
- Destructive selection raster mutation, merged-cut clearing and selected-layer rasterization: `src/selection/raster-mutation-controller.js`
- Selection → raster layer mask / Select & Mask preparation, non-destructive preview and guarded Apply: `src/selection/mask-controller.js`; Smart Filter consumes its shared rasterizer through a narrow port.
- Selection → Vector Mask geometry/boolean lifecycle commands: `src/selection/vector-mask-controller.js`; Pen direct-edit state/geometry stays in `src/main.js`, Saved Paths in `src/ui/paths-controller.js`, and PSD/PSB vector-mask import/export remains on the runtime/format boundary.
- Raster edit state, Canvas/high-depth buffers, persistence and paint preview: `src/painting/controller.js`
- Fill / raster line / current-layer selection clear commands: `src/painting/command-controller.js`
- Brush/eraser + retouch stroke gesture lifecycle (begin/move/end): `src/painting/gesture-controller.js`
- Clone/heal/smudge/blur/dodge/burn mechanics (Canvas8 + high-depth/CMYK): `src/retouch/controller.js`
- UI config + toolbar/menu/modal/workspace-layout/saved-Paths/color-management controllers: `src/ui/`
- Layers panel/tree DOM, recursive presentation, row keyboard focus and layer/group DnD lifecycle: `src/ui/layers-panel-controller.js`; primitive layer/group command policy + guarded history publication: `src/layers/command-controller.js`; discrete selected-layer nudge/center/align/fit transform commands + no-op/history policy: `src/layers/transform-command-controller.js`; interactive Move/Resize/Rotate gesture transaction, exact owner/target guards, Smart Snap, final history and cancel rollback: `src/interaction/layer-transform-gesture-controller.js`; generic Layer Properties / Color & Effects / discrete Image-menu filter reset / persistent opacity+blend / HDR-preview mutation-history policy: `src/layers/property-command-controller.js`; layer schema + sanitizers/reusable mutations: `src/core/state.js`; feature-heavy context-menu lists and Properties markup stay in `src/main.js` and delegate semantic writes to the canonical owners.
- Adjustment Layer Properties markup/rendering stays in `src/main.js`; persisted scalar/Levels/Curves/clipping validation, exact owner/target + recursive lock policy, semantic no-op suppression and history publication belong to `src/layers/adjustment-command-controller.js`; canonical model sanitization/equality/math stay in `src/core/adjustments.js`; Photoshop-native metadata eligibility/rewrite stays in document/PSD modules.
- Color Correction modal lifecycle + live filter preview transaction: `src/ui/color-correction-controller.js`; it owns exact document/layer identity, Reset/Apply/Cancel rollback, stale/lock revalidation and modal cleanup. Filter defaults/ranges/sanitization stay in `src/core/state.js`, control metadata in `src/ui/tool-config.js`, and pixel application in `src/core/render.js`.
- Saved Paths selection/CRUD/panel/context-menu/vector-mask apply orchestration: `src/ui/paths-controller.js`; Pen geometry stays in `src/main.js`, PSD codec in `src/formats/psd.js`.
- CMYK/ICC policy/profile UI orchestration, preview/edit transform caches and async preview rebuild ownership: `src/ui/color-management-controller.js`; ICC math stays in `src/core/color-management.js`, PSD/PSB codec in `src/formats/psd.js`.
- Smart Filter stack/mask markup, commands, DOM bindings and edit-modal lifecycle: `src/ui/smart-filter-controller.js`; Smart Filter schema/limits stay in `src/core/state.js`, pixel composition in `src/core/render.js`.
- Layer Blending Options / Layer Styles dialog, draft/live-preview transaction, stale-owner rollback and preview-canvas lifecycle: `src/ui/layer-blending-controller.js`; style schema/rendering stay in `src/core/layer-styles.js` and `src/core/render.js`.
- Text add/edit modal transaction, controller-owned transient draft, async latest-wins preview and preview-canvas lifecycle: `src/ui/text-edit-controller.js`.
- Shared Text typography/font UI policy — weight/style/alignment options, local-font discovery/registry, custom-font read cache/validation, modal fields and form normalization: `src/ui/text-settings-controller.js`; persisted schema/preview projection stay in `src/core/state.js`, actual font-face loading/rasterization in `src/core/render.js`; Properties markup/binding stays in `src/main.js`, while generic property validation/mutation/history publication goes through `src/layers/property-command-controller.js`.
- Core domain/render/pixel logic + low-level storage primitives: `src/core/`
- PSD/PSB import transaction / decoded-payload mapping: `src/document/psd-import-controller.js`; Photoshop Text/Shape/Adjustment/Smart Object import semantics + embedded-asset mapping: `src/document/psd-import-semantics.js`; binary decode stays in `src/formats/psd.js`.
- PSD/PSB export preparation (layer/group mapping, native high-depth/CMYK eligibility, raster/native payloads, merged composite): `src/document/psd-export-controller.js`
- Photoshop-native Text/Shape/Adjustment/Smart Object export eligibility + metadata rewrite plans: `src/document/psd-native-metadata-plans.js`
- PSD/PSB binary codec + Photoshop metadata parsing/writing/rewrite primitives: `src/formats/psd.js`
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

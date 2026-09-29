# ZeTer Photo Editor — agent entrypoint

Сначала прочитай [docs/PROJECT.md](docs/PROJECT.md). Не загружай весь репозиторий без причины.

## Канонические границы

- UI/runtime orchestration and tool-specific pointer dispatch: `src/main.js`
- Global overlay pointer lifecycle, capture/release and active-pointer routing: `src/interaction/pointer-lifecycle-router.js`
- Workspace/session/tab lifecycle: `src/workspace/session-controller.js`
- Canvas viewport zoom / pointer-anchored zoom / fit-to-view policy: `src/workspace/viewport-controller.js`; keyboard/menu/wheel dispatch stays in `src/main.js`, while canvas-mode shell visibility/center preservation stays in `src/ui/workspace-layout-controller.js`.
- Recovery/autosave orchestration, saved-project manager actions, window ownership, debounce/restore/delete policy: `src/workspace/recovery-controller.js`; recovery dialog DOM/actions: `src/ui/modal-controller.js`; IndexedDB persistence only: `src/core/recovery.js`
- Native `.zpe` project open/save transaction, async stale-owner guards and Smart Object save routing: `src/document/project-controller.js` (spec: `docs/architecture/NATIVE_PROJECT_IO.md`); schema sanitization stays in `src/core/state.js`, low-level text/download IO in `src/core/io.js`.
- Document import / file routing: `src/document/import-controller.js`; it delegates `.zpe` persistence to the project controller and PSD/PSB opening to the PSD import owner.
- Document Image Size / Canvas Size persisted command policy, stale-modal owner guard, atomic resize plan + history publication: `src/document/resize-command-controller.js`; modal fields/status remain in `src/main.js`, reusable limits/math in `src/core/state.js`.
- Crop transient gesture/draft/session snapshot + overlay/min-size policy: `src/interaction/crop-gesture-controller.js` (spec: `docs/architecture/CROP_INTERACTION.md`); persisted geometry command, exact owner guard, atomic layer-position plan and no-op/history completion: `src/document/crop-command-controller.js`; tool dispatch stays in `src/main.js`, reusable limits in `src/core/state.js`.
- Document Background persisted command policy, exact-owner stale-modal guard and semantic no-op/history suppression: `src/document/background-command-controller.js`; modal/options/status remain in `src/main.js`, schema/default in `src/core/state.js`.
- Smart Object content lifecycle (convert/open/save/link/unlink, shared-source propagation and content-tab stale guards): `src/document/smart-object-controller.js`.
- Photoshop Smart Object embedded PNG/PSD/PSB serialization, `liFD` linked-resource prepare/publish and baseline metadata refresh: `src/document/psd-smart-object-resource.js`; low-level PSD/PSB bytes stay in `src/formats/psd.js`.
- Selection shape gestures (marquee/lasso/polygon/magnetic), draft lifecycle: `src/selection/gesture-controller.js`
- Selection Copy/Cut transaction owner: `src/selection/clipboard-copy-cut-controller.js`; it captures exact originating document/session, full cloned selection shape and selected-layer identity before the first await, owns the copy/cut command generation and propagates latest-owner continuation into destructive raster publication. Paste/native-paste/fallback generation plus the stable public facade consumed by `src/main.js` stay in `src/selection/clipboard-controller.js`. Keep these generations independent; detailed contract: `docs/architecture/SELECTION_CLIPBOARD.md`.
- Destructive selection raster mutation, merged-cut clearing and selected-layer rasterization: `src/selection/raster-mutation-controller.js`; one merged batch captures a full cloned selection-shape snapshot before target discovery/preparation, then uses exact-target all-or-none publication after async work (spec: `docs/architecture/RASTER_PERSISTENCE.md`). Live selection changes must not alter pending batch pixels, and same-ID replacements/removals/effective locks must abort before any write/history.
- Selection → raster layer mask / Select & Mask preparation, non-destructive preview and guarded Apply: `src/selection/mask-controller.js`; Smart Filter consumes its shared rasterizer through a narrow port.
- Selection → Vector Mask geometry/boolean lifecycle commands: `src/selection/vector-mask-controller.js`; existing Pen edit-target discovery/projection/hit-testing/control drawing/cursor feedback lives in `src/interaction/path-control-surface-controller.js`; existing anchor/handle drag transaction lives in `src/interaction/path-control-gesture-controller.js`; one-shot Alt-click anchor→corner mutation/history lives in `src/interaction/path-control-command-controller.js`; edit-mode identity stays in `src/main.js`; final new-path Shape publication/history lives in `src/interaction/pen-path-command-controller.js`; transient new-path draft/handle gestures live in `src/interaction/pen-draft-gesture-controller.js`, Saved Paths CRUD in `src/ui/paths-controller.js`, and PSD/PSB vector-mask import/export remains on the runtime/format boundary.
- Raster edit state; exact-owner/target Canvas8 **and native 16/32-bit RGB/CMYK** cache + async publication (spec: `docs/architecture/RASTER_PERSISTENCE.md`), including paint preview validity: `src/painting/controller.js`
- Fill / raster line / current-layer selection clear commands: `src/painting/command-controller.js`
- Persisted Gradient raster-layer publication, exact-owner async revalidation and shared raster-persistence exclusion: `src/painting/gradient-command-controller.js` (spec: `docs/architecture/GRADIENT_COMMAND.md`); Gradient preview + tool pointer dispatch stay in `src/main.js`.
- Brush/eraser + retouch stroke gesture lifecycle (begin/move/end): `src/painting/gesture-controller.js`
- Clone/heal/smudge/blur/dodge/burn mechanics (Canvas8 + high-depth/CMYK): `src/retouch/controller.js`
- UI config + toolbar/menu/modal/workspace-layout/saved-Paths/color-management controllers: `src/ui/`
- In-app Learning Center curriculum, mental models, persisted practice/mastery checklists, knowledge checks, readiness-gated completion, local progress and lesson navigation: `src/ui/learning-center-controller.js`; generic dialog shell/focus lifecycle stays in `src/ui/modal-controller.js`, menu routing stays in `src/main.js`.
- Layers panel/tree DOM, recursive presentation, row keyboard focus and layer/group DnD lifecycle: `src/ui/layers-panel-controller.js`; primitive layer/group command policy + guarded history publication: `src/layers/command-controller.js`; discrete selected-layer nudge/center/align/fit transform commands + no-op/history policy: `src/layers/transform-command-controller.js`; read-only selected-layer transform target discovery/control hit-testing/frame+handle drawing/rotated resize cursors: `src/interaction/layer-transform-surface-controller.js`; interactive Move/Resize/Rotate gesture transaction, exact owner/target guards, Smart Snap, final history and cancel rollback: `src/interaction/layer-transform-gesture-controller.js`; existing Bézier read-only edit surface (target discovery/projection/hit-testing/control drawing/cursor feedback): `src/interaction/path-control-surface-controller.js`; existing Bézier one-shot Alt-click anchor→corner command, live-target/lock revalidation, no-op/history policy: `src/interaction/path-control-command-controller.js`; existing Bézier anchor/handle gesture transaction, exact path identity, threshold/no-op/history and cancel rollback: `src/interaction/path-control-gesture-controller.js`; generic Layer Properties / Color & Effects / discrete Image-menu filter reset / persistent opacity+blend / HDR-preview mutation-history policy: `src/layers/property-command-controller.js`; layer schema + sanitizers/reusable mutations: `src/core/state.js`; feature-heavy context-menu lists and Properties markup stay in `src/main.js` and delegate semantic writes to the canonical owners.
- Adjustment Layer Properties markup/rendering stays in `src/main.js`; persisted scalar/Levels/Curves/clipping validation, exact owner/target + recursive lock policy, semantic no-op suppression and history publication belong to `src/layers/adjustment-command-controller.js`; canonical model sanitization/equality/math stay in `src/core/adjustments.js`; Photoshop-native metadata eligibility/rewrite stays in document/PSD modules.
- Color Correction modal lifecycle + live filter preview transaction: `src/ui/color-correction-controller.js`; it owns exact document/layer identity, Reset/Apply/Cancel rollback, stale/lock revalidation and modal cleanup. Filter defaults/ranges/sanitization stay in `src/core/state.js`, control metadata in `src/ui/tool-config.js`, and pixel application in `src/core/render.js`.
- Saved Paths selection/CRUD/panel/context-menu/vector-mask apply orchestration: `src/ui/paths-controller.js`; existing Pen target discovery/projection/hit-testing/control drawing/cursor feedback: `src/interaction/path-control-surface-controller.js`; existing anchor/handle drag transaction: `src/interaction/path-control-gesture-controller.js`; one-shot Alt-click anchor→corner command: `src/interaction/path-control-command-controller.js`; edit-mode identity stays in `src/main.js`; final new-path Shape publication/history lives in `src/interaction/pen-path-command-controller.js`; transient new-path draft/handle gestures live in `src/interaction/pen-draft-gesture-controller.js`; PSD codec in `src/formats/psd.js`.
- New Pen transient draft state, idle hover, `4 / zoom` finish intent, `1 / zoom` point-handle gesture, final-release geometry and pointercancel/Escape point rollback: `src/interaction/pen-draft-gesture-controller.js`; finalized bounds/localization/Shape publication + exact-owner/history policy: `src/interaction/pen-path-command-controller.js`; pointer/keyboard routing and outcome presentation stay in `src/main.js`.
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
- zoom / fit / pointer anchoring contract → `docs/architecture/VIEWPORT_NAVIGATION.md`
- какие зависимости допустимы → `docs/architecture/BOUNDARIES.md`
- как работать AI/Codex → `docs/development/AI_WORKFLOW.md`
- как делать refactor/debug/review/tests с доказательствами → `docs/development/QUALITY_PLAYBOOK.md`
- какие проверки запускать → `docs/testing/TEST_MATRIX.md`
- что делать в следующей небольшой проходке → `task/README.md`
- подробная историческая инженерная летопись → `docs/reference/PROJECT_HISTORY.md`

## Обязательные инварианты

Сохраняй `file://` запуск на Windows, layer lock, selection boundaries, Undo/Redo, async save/export guards, high-depth/CMYK precision и PSD/PSB round-trip semantics.

После source change: `npm run check`; для startup/DOM/file://: `npm run test:browser`. Любое изменение кода отражай в `CHANGELOG.md`.

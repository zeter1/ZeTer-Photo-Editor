# Code map

## Runtime entry

### `index.html`
DOM skeleton, menus, toolbar, panels, dialogs and version meta. Runtime uses generated `src/app.bundle.js`.

### `src/main.js`
Application orchestrator: tool-specific pointer/keyboard dispatch, tool selection, history/transaction coordination and save/export flows. Generic overlay pointer capture/active-pointer lifecycle is delegated to `src/interaction/pointer-lifecycle-router.js`; transient Crop gesture/draft/session snapshot/overlay is delegated to `src/interaction/crop-gesture-controller.js`; selected-layer transform read-only target discovery/control hit-testing/frame+handle drawing/cursor intent are delegated to `src/interaction/layer-transform-surface-controller.js`; Move/Resize/Rotate transaction state, geometry publication, final history and rollback are delegated to `src/interaction/layer-transform-gesture-controller.js`; existing Bézier target discovery/projection/hit-testing/control drawing/cursor feedback and exact live-target resolution are delegated to `src/interaction/path-control-surface-controller.js`; one-shot Alt-click anchor→corner mutation/history is delegated to `src/interaction/path-control-command-controller.js`; existing Bézier anchor/handle drag transaction, exact path identity, threshold/no-op/history and rollback are delegated to `src/interaction/path-control-gesture-controller.js`; transient creation of a new Pen path, hover/finish intent and per-point handle gestures are delegated to `src/interaction/pen-draft-gesture-controller.js`; final bounds/localization/Shape/history publication is delegated to `src/interaction/pen-path-command-controller.js`. Selection gesture mechanics are delegated to `src/selection/gesture-controller.js`; raster layer-mask / Select & Mask orchestration to `src/selection/mask-controller.js`; selection-driven Vector Mask command/policy to `src/selection/vector-mask-controller.js`. Paint-stroke lifecycle, one-shot raster commands, destructive selection raster mutations and raster edit buffers/persistence, plus extracted session, viewport, clipboard, import, menu/modal/toolbar/workspace-layout/saved-Paths and retouch mechanics, are delegated to their canonical owners.

**AI rule:** do not read the whole file first. Search for the command/tool/function involved, then inspect a bounded window and its tests.

## Document lifecycle boundary — `src/document/`

### `new-document-controller.js`
Owns File → New / Ctrl+N as one replacement transaction: pending-edit preflight, shared dirty confirmation, exact New Document modal schema, submit-time pending recheck, canonical document factory call, fresh-history replacement, clean-state publication, immediate recovery and fit-to-view. The factory must finish successfully before any runtime publication.

Its `canReplaceDocument` policy is intentionally reused by PSD/PSB and native `.zpe` open owners through narrow ports. It does **not** own generic modal DOM, document schema/limits, session internals, recovery storage or viewport math; those stay in their existing owners. Menu/keyboard/recovery dispatch remains in `src/main.js`.

## Interaction boundary — `src/interaction/`

### `pointer-lifecycle-router.js`
Owns the generic overlay Pointer Events lifecycle: one active pointer at a time, capture/release, routing of idle hover vs active-pointer movement, matching up/cancel, and fail-safe cancellation when `lostpointercapture` arrives unexpectedly.

It deliberately does **not** know tool names or mutate layers, selections, paths, crop geometry or paint buffers. Those domain branches remain in `src/main.js` and dedicated domain controllers.

### `crop-gesture-controller.js`
Owns only transient Crop interaction: exact originating-document gesture identity, normalized draft rectangle, final pointer-release geometry, the 10×10 pointer acceptance gate, immutable session-safe draft snapshot/restore and the dim/frame/rule-of-thirds overlay. It publishes a semantic accepted/rejected intent to `src/main.js` and never writes document geometry or history.

Tool/keyboard dispatch stays in `src/main.js`; generic pointer capture stays in `pointer-lifecycle-router.js`; persisted Crop mutation/history stays in `src/document/crop-command-controller.js`; Crop-to-Selection keeps its separate 1×1 eligibility policy. See `docs/architecture/CROP_INTERACTION.md` before changing this seam.

### `layer-transform-surface-controller.js`

Owns the read-only selected-layer transform interaction surface: transformable/visibility/effective-lock policy, selected rotate/resize control hits, reverse-z Move target discovery, zoom-aware frame/control/name-badge drawing, canvas-clamped rotation control and rotated idle cursor intent. A text-edit preview layer enters through an explicit display-layer port so this owner does not absorb Text transaction policy.

It deliberately publishes no document mutation/history and does not own pointer capture or DOM cursor writes. `src/main.js` consumes semantic move/resize/rotate intent; `layer-transform-gesture-controller.js` owns interactive mutation/Smart Snap/history/rollback; `src/layers/transform-command-controller.js` owns discrete nudge/center/align/fit.

### `layer-transform-gesture-controller.js`

Owns one interactive selected-layer Move / Resize / Rotate transaction from captured baseline through live pointer updates to exactly-one history publication or cancel rollback. It binds the originating document, stable layer ID and object identity; revalidates recursive locks on every update/finalize/cancel; owns Shift axis-lock, Smart Snap/Ctrl bypass, resize modifiers/min-size and rotate snapping by delegating to canonical core geometry.

It deliberately does **not** install DOM listeners, choose/draw the selected transform surface, hit-test handles, own pointer capture, render the Layers tree or absorb one-shot nudge/align/fit commands. Generic capture stays in `pointer-lifecycle-router.js`; read-only transform discovery/hit/draw/cursor policy stays in `layer-transform-surface-controller.js`; tool dispatch stays in `src/main.js`; discrete transform commands stay in `src/layers/transform-command-controller.js`.

### `path-control-surface-controller.js`
Owns the read-only existing-Bézier interaction surface shared by Shape paths, Vector Masks and Saved Paths: Saved Path edit precedence, selected Shape/Vector Mask discovery, visibility-aware target projection, handle-before-anchor hit testing, dashed path tracing/control drawing, locked presentation and idle Pen cursor feedback. It receives live edit-mode state plus canonical layer→document geometry through narrow ports and intentionally keeps locked controls visible while rejecting them from hit/edit targeting.

It deliberately does **not** mutate persisted path geometry, publish history, own pointer capture, create new `penDraft`/`pen-handle` paths, own Saved Paths CRUD or Vector Mask lifecycle. One-shot corner conversion belongs to `path-control-command-controller.js`, drag transactions to `path-control-gesture-controller.js`, transient new Pen drafting to `pen-draft-gesture-controller.js`, with final Shape/history publication in `src/interaction/pen-path-command-controller.js`, and resource/lifecycle commands to their domain owners.

### `path-control-command-controller.js`
Owns the one-shot persisted Alt-click existing-anchor → corner command across Shape paths, Vector Masks and Saved Paths. It distinguishes ignored intent from rejected stale/non-editable targets, revalidates the active document, resolves exact live identity through the surface controller, rechecks recursive locks immediately before mutation, preserves exact source-specific history labels and emits no history for the already-corner semantic no-op.

It deliberately does **not** discover/render controls, own pointer capture/drag state, create new Pen paths, or absorb Saved Paths / Vector Mask lifecycle commands.

### `path-control-gesture-controller.js`
Owns one drag transaction for an existing Bézier anchor or handle across Shape paths, Vector Masks and Saved Paths. It captures the originating document plus exact target identities, uses stable Saved Path IDs when available, localizes layer-backed points, applies Shift/Alt semantics, restores sub-threshold/no-op previews, applies the final release point, publishes one exact history label and shares one cancel primitive for pointer-cancel/Escape.

It deliberately does **not** own target discovery/projection/hit-testing/control drawing/cursor feedback; those belong to `path-control-surface-controller.js`. Alt-click corner conversion belongs to `path-control-command-controller.js`; new-path draft/handle state and release statuses belong to `pen-draft-gesture-controller.js`; final persisted path publication belongs to `src/interaction/pen-path-command-controller.js`; Saved Paths CRUD stays in `src/ui/paths-controller.js`; Vector Mask lifecycle stays in `src/selection/vector-mask-controller.js`.

### `pen-draft-gesture-controller.js`
Owns only the transient lifecycle for a brand-new Pen path before it becomes document state: draft points + hover, double-click close intent with `4 / zoom`, per-point handle gesture with `1 / zoom`, smooth mirrored handles vs Alt-independent corner handles, final pointer-release geometry, exact release status classification, active-point cancellation and whole-draft reset/snapshot/consume seams.

It deliberately does **not** hit-test or mutate existing Shape / Vector Mask / Saved Path controls, install DOM listeners, add layers or publish history. Existing path editing stays in the surface/command/gesture owners; `src/main.js` routes pointer/keyboard events, while `src/interaction/pen-path-command-controller.js` owns finalized bounds/localization plus Shape/history publication.

### `pen-path-command-controller.js`
Owns the one-shot persisted publication boundary for a consumed new-Pen draft: validates the exact active document, normalizes finite anchors/handles, includes handles in bounds, localizes nodes into Shape-layer coordinates, preserves corner/smooth semantics and maps Pen close/stroke/stroke-width/opacity options into the canonical Shape schema.

Too-short, invalid and sub-one-pixel finalized drafts publish no layer/history. A real publication revalidates the exact originating document immediately before `addLayer`, selects the new Shape through the canonical state primitive and emits exactly one `Добавить Bézier-контур` history entry. It does not own transient draft state, pointer/keyboard dispatch, overlay tracing or existing-path editing.
## UI boundary — `src/ui/`

### `tool-config.js`
Pure immutable-ish configuration: tool labels/help, control metadata, storage keys and sets describing tool capabilities. No DOM reads, no document mutation.

### `tool-layout.js`
Pure toolbar order/grid-slot helpers. Safe to unit-test without browser state.

### `toolbar-controller.js`
Owns toolbar drag/drop, persisted order, drop-slot rendering and rich accessible tooltips. It deliberately does not own `currentTool`; tool selection stays in `src/main.js`.

### `menu-controller.js`
Owns generic top-menu/context-menu mechanics: rendering menu items, enabled state evaluation, popup positioning, focus restoration, keyboard navigation, outside-click close and async action error surfacing. Domain command lists and editor mutations stay in `src/main.js`.

### `modal-controller.js`
Owns generic modal/dialog mechanics: field rendering, numeric normalization, async submit lifecycle, focus restoration, backdrop/Escape close, draggable text-modal shell, info dialogs and the saved-project recovery manager (list/select/load/new/rename/delete/restore actions, including rapid right-button double-click restore). Feature state remains outside the shell; Text draft/preview belongs to `text-edit-controller.js` and Text font/settings policy belongs to `text-settings-controller.js`.

### `learning-center-controller.js`
Owns the in-app Learning Center curriculum and its lightweight local learning state: lesson ordering/levels, mental models and decision rules, persisted hands-on practice/mastery checklists, two-question knowledge checks, resume point, readiness-gated completion, level/progress summaries and Help-dialog interaction. The v2 state migrates previously completed v1 lessons without revoking progress. Storage remains browser-local and contains only lesson/checklist/quiz progress, never document pixels or project content.

The controller uses the generic `showInfoModal` shell from `modal-controller.js`; it does not own editor document/layer/history state and intentionally does not claim that an editor action was performed. The user practices on the real canvas, explicitly records completed practice steps, passes the lesson knowledge check, self-checks mastery, then may mark the lesson mastered. Menu wiring remains in `src/main.js`.
### `workspace-layout-controller.js`
Owns editor-shell layout state that is independent of document contents: persisted sidebar collapse IDs, legacy collapse-state migration, accessible panel toggle state and canvas-mode visibility with viewport-center preservation. It receives DOM/runtime geometry through narrow ports and does not own document/layer/history/tool state.

### `layers-panel-controller.js`
Owns the Layers panel DOM tree and panel-local interaction lifecycle: recursive group/layer presentation, selected/effective ancestor state, thumbnails/mask hints, row keyboard focus and layer/group drag identity/drop cleanup including root drop. Event callbacks are bound to the rendered document identity. Semantic layer/group actions are explicit ports into the canonical command owner rather than a second mutation/history policy.

### `src/layers/command-controller.js`
Owns primitive layer/group command policy shared by the Layers panel, menus, buttons and keyboard routes: exact active-document/entity guards, recursive effective-lock checks, create/rename/delete/duplicate/visibility/lock/group-properties commands, step/relative/root moves and history publication only after a real mutation. Rename/property modals re-resolve the originating owner and target on Apply, so a tab switch or deleted target becomes a no-op.

It deliberately does **not** render the Layers tree, own drag identity, define persisted layer/group schema, store history, or absorb Smart Object/mask/blending feature menus. Stable model mutations remain in `src/core/state.js`; `src/main.js` is the composition root for transaction/modal/status ports and feature-heavy menu lists.

### `src/layers/transform-command-controller.js`
Owns synchronous one-shot selected-layer layout transforms shared by keyboard/menu routes: nudge, center, six canvas alignments and fit-to-canvas. It re-resolves the exact active layer by stable ID, applies recursive effective-lock and transformability guards, delegates rotated/scaled frame math to `src/core/geometry.js`, suppresses semantic no-ops and publishes one history entry only after a real transform.

It deliberately does **not** own pointer Move/Resize/Rotate gesture state or generic Properties live-preview transactions; those belong to `src/interaction/layer-transform-gesture-controller.js` and `src/layers/property-command-controller.js` respectively. `src/main.js` keeps only selected-layer/status wrappers.

### `src/layers/property-command-controller.js`
Owns generic Layer Properties mutation/transaction policy shared by the Properties/Color & Effects panels, discrete Image-menu filter resets and persistent layer controls: exact active-document + layer-ID re-resolution, effective-lock checks, numeric/text/shape/filter normalization, raster canvas-size safety, custom-font publication, layer blend/opacity commands and HDR display-preview update/reset.

Range-style live preview records an owner/layer/property baseline, mutates only the exact live target, increments the transient change serial and renders without history; the final `change` publishes at most one commit relative to that original baseline. Discrete filter resets reuse the same owner, canonical sanitizer and lock/no-op policy while clearing relevant preview baselines before publication. Stale callbacks, invalid values, locked targets and semantic no-ops publish no history.

It deliberately does **not** own Properties markup, Adjustment Layer controls, Smart Filter UI, Blending Options, Text add/edit modal state or persisted schema. Markup/bindings remain in `src/main.js`; stable clamps/sanitizers live in `src/core/state.js`; Text option/capability policy stays in `src/ui/text-settings-controller.js`.

### `src/layers/adjustment-command-controller.js`
Owns persisted Adjustment Layer command policy for the existing Properties controls: scalar/Levels edits, Curves point validation/replacement and clipping toggle. Every command carries the originating document + stable layer ID, re-resolves the exact live Adjustment layer, checks recursive effective lock, canonicalizes through `sanitizeAdjustmentModel`, suppresses semantic no-ops and publishes at most one history entry.

It deliberately does **not** own Adjustment Properties markup/formatting, render math or Photoshop-native metadata planning. Markup and display formatting stay in `src/main.js`; model sanitization/equality/pixel math stay in `src/core/adjustments.js`; PSD-native import/export eligibility and metadata rewrite stay in document/format boundaries.

### `color-correction-controller.js`
Owns the Color Correction dialog as one UI transaction: exact originating document/layer identity, canonical filter draft/original snapshots, bounded live range preview without history, batched Reset, guarded Apply, Cancel/Escape/backdrop rollback and idempotent modal/focus cleanup. Stale document callbacks, deleted/replaced layers and lock changes publish no history into another session; rollback may still restore the originating transient state when the exact target survives.

It deliberately does **not** own generic Properties mutation policy (`src/layers/property-command-controller.js`), persisted filter schema/ranges (`src/core/state.js`), control metadata (`src/ui/tool-config.js`) or pixel filtering (`src/core/render.js`). `src/main.js` only composes the controller and routes the Image menu action.

### `paths-controller.js`
Owns Saved Paths UI/state orchestration: selected path index, bounded Photoshop path-resource allocation, save/rename/duplicate/delete actions, accessible list/keyboard/context-menu wiring and applying a saved path as a vector mask through grouped explicit ports. The document model remains in core; existing target discovery/projection/hit-testing/control drawing/cursor feedback lives in `src/interaction/path-control-surface-controller.js`; existing anchor/handle drag transaction lives in `src/interaction/path-control-gesture-controller.js`; new Pen transient drafting lives in `src/interaction/pen-draft-gesture-controller.js`, final new-path publication lives in `src/interaction/pen-path-command-controller.js`, while the transient Saved Path edit index remains in `src/main.js`; PSD/PSB binary semantics remain in `src/formats/psd.js`.

### `color-management-controller.js`
Owns document-facing CMYK/ICC orchestration: preview/edit transform caches and invalidation, color-policy/profile transactions, asynchronous native-CMYK preview rebuild with active-document rollback, ICC profile load/remove actions and properties-panel control bindings. It receives state/color/pixel/IO/render/UI capabilities through explicit ports.

It deliberately does **not** own ICC parser/transform math (`src/core/color-management.js`), PixelBuffer math, the canonical document schema, or PSD/PSB binary resources (`src/formats/psd.js`). `src/main.js` keeps only narrow bridges needed by painting and PSD import preview.

### `smart-filter-controller.js`
Owns Smart Filter UI/orchestration as one feature boundary: stack/mask markup, reorder/toggle/remove/clear commands, selection-mask prepare-before-publish, properties-panel bindings and the add/edit modal lifecycle. Runtime/document/selection/render/DOM effects enter through narrow ports; stable Smart Filter state/geometry/config dependencies remain direct imports.

It deliberately does **not** own the persisted Smart Filter schema, sanitization or `MAX_SMART_FILTERS` definition (`src/core/state.js`), filter pixel application/mask composition (`src/core/render.js`), or the shared selection-mask rasterizer in `src/selection/mask-controller.js`. Smart Filter consumes that rasterizer through a narrow port but keeps its own mask mutation/publication transaction; async publication revalidates the originating document/layer after the await.

### `layer-blending-controller.js`
Owns the Blending Options / Layer Styles dialog as one UI transaction: draft blend mode/opacity/style edits, live preview on/off, preview-canvas crop/copy + resize cleanup, Apply/Cancel/Escape/backdrop lifecycle and stale document/layer rollback. It imports stable style/geometry/lock primitives directly and receives live document/history/render/DOM capabilities through narrow ports.

It deliberately does **not** own persisted Layer Styles schema/sanitization or pixel effects (`src/core/layer-styles.js` / `src/core/render.js`). Transient preview state is controller-owned, and closing or invalidating the dialog restores the originating exact layer rather than leaving preview values in an inactive document.

### `text-edit-controller.js`
Owns the Text tool add/edit UI transaction: hit resolution for visible text layers, exact-owner Apply guards, controller-owned transient draft, latest-wins async preview publication, preview canvas/observer lifecycle and narrow render/overlay read APIs. Generic modal construction remains in `modal-controller.js`; the modal shell exposes only generic per-instance mount/close hooks and does not own Text state.

It deliberately does **not** own persisted text-layer schema or render-only projection (`src/core/state.js`), text rasterization/font loading (`src/core/render.js`), PSD text semantics, or shared font/settings policy.

### `text-settings-controller.js`
Owns the shared Text typography/font UI policy used by both Text add/edit and Properties: canonical weight/style/alignment options, private local-font registry, permission-gated `queryLocalFonts()` discovery/filter/sort/cap, custom-font file cache/validation/loading bridge, modal field construction and form normalization/clamping.

It deliberately does **not** own persisted Text schema, Canvas text rendering or the renderer's FontFace cache. Properties markup, history commits and exact document/layer stale-publication guards remain runtime orchestration in `src/main.js`; custom font bytes are validated/prepared here and actual FontFace loading stays in `src/core/render.js`.

Future UI extractions should land here when they can be expressed as pure config/helpers or narrow controllers rather than adding more unrelated responsibility to `src/main.js`.

## Painting boundary — `src/painting/`

### `controller.js`
Owns reusable raster-edit state shared by brush/eraser/fill/line and retouch routing. Canvas8 and native high-depth/CMYK caches both bind exact document + exact layer identity; Canvas8 additionally captures the exact Canvas and native paint captures the exact typed working buffer. Both paths revalidate publication authority after async PNG preview encoding; see `RASTER_PERSISTENCE.md`.

It deliberately does **not** own tool choice, stroke routing, selection semantics, history commits, the application-wide pending-edit guard or the multi-layer selection batch transaction. `prepareHighDepthMutation()` / `applyHighDepthMutation()` are low-level mechanisms; callers that bypass the guarded current-layer persistence seam must prove their own publication boundary.

### `command-controller.js`
Owns bounded one-shot raster commands: flood fill, raster line, clearing pixels and Content-Aware Fill on the current raster layer. Content-Aware captures a frozen selection snapshot before async Canvas preparation, then publishes through the same exact-owner Canvas8 or native RGB/CMYK high-depth seams. Bounded donor-propagation math lives in `src/core/inpaint.js`; synthesized samples never become donor authority.

It deliberately does **not** own global pointer events, selection-shape state, history storage or the application-wide pending-edit flag. Multi-layer selection clearing used by merged Clipboard cut belongs to `src/selection/raster-mutation-controller.js` rather than this current-layer command controller.

### `gradient-command-controller.js`
Owns the persisted Gradient raster-layer transaction. `src/main.js` captures the exact originating document in the Gradient drag and keeps the visual preview; the command owner acquires the shared raster-persistence guard, prepares the selection-clipped Canvas using captured dimensions, awaits PNG serialization, revalidates exact document object identity and only then publishes the Raster layer + one history entry.

A switched/replaced document — including a same-ID replacement — is stale and receives no redirected publication. See `GRADIENT_COMMAND.md` before changing this path.

### `gesture-controller.js`
Owns the bounded lifecycle of one brush/eraser/retouch stroke: choose existing/new raster target, choose native high-depth/CMYK vs Canvas8 path, initialize per-stroke retouch state, route movement segments and persist on end. Every paint drag carries the exact originating document and layer object; native cache preparation, native paint callbacks and final persistence receive those captured objects so move/end cannot redirect to a same-ID replacement. Dependencies are grouped ports (`state`, `target`, `selection`, `tools`, `nativePaint`, `ui`) instead of a long flat callback list.

It deliberately does **not** own global pointer events/capture, `currentTool`, active document/session selection, selection/history state or the global pending-edit flag. Generic capture/active-pointer ownership lives in `src/interaction/pointer-lifecycle-router.js`; tool-specific routing and the other application state remain in `src/main.js`; Canvas8/native buffer and persistence authority stays in `src/painting/controller.js`; pixel math stays in core.

## Retouch boundary — `src/retouch/`

### `controller.js`
Owns destructive retouch mechanics for Canvas8 and native typed RGB/CMYK paths: clone/heal source + immutable per-stroke snapshots, smudge, blur, dodge/burn, private scratch canvases and high-depth retouch dispatch.

It does **not** own document/history/global pointer state or the shared raster edit buffer. Per-stroke routing lives in `src/painting/gesture-controller.js`; global event/transaction orchestration remains in `src/main.js`; shared paint state/persistence lives in `src/painting/controller.js`; pixel math remains in core.

## Document boundary — `src/document/`

### `smart-object-controller.js`
Owns generic Smart Object content lifecycle: convert selected layer, linked-copy/unlink, nested-content depth and source bounds, content-tab open/deduplication, save propagation to shared instances, parent/content stale-context guards, dirty/history/recovery publication and preview-cache invalidation.

Stable document/geometry helpers are direct dependencies. Browser preview rendering, workspace session bridges and Photoshop native embedded-resource rewrite are explicit narrow ports. Photoshop PSD/PSB serialization/resource bytes deliberately stay outside this controller so generic ZPE Smart Object behavior remains directly Node-testable.

### `psd-smart-object-resource.js`
Owns Photoshop-specific embedded Smart Object resource policy: PNG preview payload extraction, PSD/PSB re-encoding through prepared export data, bounded linked-layer block rewrite, explicit publish of prepared `liFD` blocks and per-target native baseline/fingerprint refresh.

Stable binary primitives stay in `src/formats/psd.js`; fingerprint/opaque-block decoding primitives stay in `psd-native-metadata-plans.js`. The owner receives PSD export preparation and the shared opaque-block-to-state bridge as narrow ports. Rewrite preparation does not mutate the parent document; the generic Smart Object controller revalidates content/parent identity after every await and only then calls the publish/update ports.

### `project-controller.js`
Owns native `.zpe` persistence orchestration. Open captures exact document/session/history-entry/change-serial authority before file IO, prepares JSON + sanitized state without mutation, then revalidates and publishes once. Save delegates Smart Object child sessions or runs regular JSON download + immediate recovery. Detailed contract: `NATIVE_PROJECT_IO.md`.

It does not classify incoming files, parse PSD/PSB, own recovery storage, or define the `.zpe` schema.

### `import-controller.js`
Owns incoming-file classification and image import orchestration: image/project detection, decode-and-validate-before-mutate transaction, empty-document sizing, anchor placement and routing to PSD/project callbacks. It does not own PSD parsing or native project persistence; those remain separate canonical owners.

### `ui/document-resize-controller.js`
Owns the user-facing Image Size / Canvas Size dialog contract: exact field schema, all nine Canvas anchors, open-time originating-document capture, repeated pending-edit guard on submit, delegation to the persisted command owner, and INVALID/REJECTED status/toast presentation. COMMITTED and semantic NOOP deliberately return normal modal-close semantics without duplicate UI publication.

It deliberately does **not** own resize math, history, transient geometry cleanup or generic modal DOM lifecycle. Those remain in `src/document/resize-command-controller.js` and `src/ui/modal-controller.js`.

### `resize-command-controller.js`
Owns synchronous persisted Image Size and Canvas Size commands. It receives the exact originating document captured by the UI owner, stages the full layer transform/shift plan through canonical `src/core/state.js` helpers, revalidates active ownership immediately before mutation, suppresses semantic no-ops, and publishes one history entry plus geometry transient cleanup only after a real change.

It deliberately does **not** own dialog schema/result presentation, Crop tool/pointer lifecycle, zoom/viewport state, document schema, or core size/scale/position limits. Those remain in `src/ui/document-resize-controller.js`, interaction owners and `src/core/state.js` respectively.

### `crop-command-controller.js`
Owns the synchronous persisted Crop geometry transaction. It receives the exact document captured by the crop gesture or selection command, validates finite rounded geometry and canonical canvas safety, stages every shifted layer position against `MAX_LAYER_POSITION`, revalidates active owner identity immediately before the first write, and publishes at most one `Кадрирование` history entry.

A full-document crop is a persisted semantic no-op: it completes the existing crop/selection/brush transient UI and viewport fit without fabricating Undo history. Invalid/stale requests leave both persisted and transient state untouched. Pointer begin/move/up/cancel semantics, the 10×10 gesture gate, crop overlay/grid and session-safe draft snapshot belong to `src/interaction/crop-gesture-controller.js`; tool routing and the separate selection 1×1 gate remain in `src/main.js`.

### `document-background-controller.js`
Owns the user-facing Document Background modal transaction. It captures the exact document at open time, samples the current primary color through an explicit port on every open, preserves the select schema/options, and hands delayed Apply to the persisted command with that exact owner. Only REJECTED is presented locally so COMMITTED/NOOP retain the generic modal-close behavior.

It deliberately does **not** own persisted mutation/history, generic modal DOM, background schema/defaults or rendering. Those remain in `background-command-controller.js`, `modal-controller.js` and core owners.

### `background-command-controller.js`
Owns the persisted Document Background command transaction. The UI owner passes the originating document object, the controller revalidates that exact object immediately before mutation, same-value Apply is a semantic no-op, and a real change publishes exactly one `Фон документа` history entry.

It deliberately does **not** own modal schema/options, background schema/defaults, renderer behavior, Crop or resize. Those stay in `document-background-controller.js`, `src/core/state.js`, render owners and `resize-command-controller.js`.

### `psd-import-controller.js`
Owns the import transaction from a PSD/PSB file to a canonical ZPE document after codec decode: size guard, decoded layer/group/path mapping, native high-depth/CMYK preservation, ICC preview policy, temporary-buffer budgeting, stale document/session checks and publish coordination. Stable core transforms are direct dependencies; binary decode, browser raster encoding, runtime publication and Photoshop semantics are explicit narrow ports.

### `psd-import-semantics.js`
Owns Photoshop-specific import interpretation below that transaction: solid-shape eligibility and native baselines, TySh text metadata snapshots, adjustment metadata baselines, Smart Object metadata/fingerprints and editable embedded PNG/JPEG/WebP/GIF/BMP/PSD/PSB content mapping. It imports stable core/domain transforms directly. Effectful codec/browser work plus shared vector-mask localization, opaque-resource conversion and Smart Object fingerprint primitives are explicit ports, so this owner stays directly testable without taking session/history/publication ownership or depending on the export-plan module.

### `psd-native-metadata-plans.js`
Owns Photoshop-native export compatibility decisions and bounded metadata rewrites for editable Text/TySh, solid vector Shape, Adjustment and Smart Object records. It imports public rewrite primitives from `src/formats/psd.js`, shared sanitizers from core and contains no browser/UI orchestration.

The planner also owns persisted opaque-block decoding plus Smart Object preview/embedded fingerprints used to prove native passthrough is still safe. Unsupported or stale metadata returns an explicit ineligible plan; raster fallback remains the export controller's responsibility.

### `export-controller.js`
Owns the user-facing Export transaction: open/submit pending-edit guards, exact submit-time detached document snapshot, PNG/JPEG/WebP quality + filename routing, PSD/PSB preparation/codec selection, ICC/resource-limit handoff and success/warning/error publication.

It receives mutable runtime state, raster rendering, PSD preparation, codecs and low-level IO only through narrow ports. After the detached snapshot is captured it must not consult the live document again, and no browser download is published before the selected render/encode path succeeds. See `DOCUMENT_EXPORT.md`.

### `psd-export-controller.js`
Owns document-to-PSD/PSB writer preparation: export bounds, group ancestry, native high-depth/CMYK eligibility, raster/native layer payloads, merged composite selection and bounded export warnings. Photoshop semantic plans are direct dependencies from `psd-native-metadata-plans.js`; browser rendering and the generic vector-mask bridge remain explicit ports so native preparation stays directly Node-testable. Binary PSD/PSB parsing/writing stays in `src/formats/psd.js`.

## Selection boundary — `src/selection/`

### `gesture-controller.js`
Owns transient selection gesture mechanics: active marquee type, rectangle/ellipse/free-lasso drag lifecycle, polygon draft completion/cancellation, magnetic-edge sampling/drafts and their overlay drawing. It receives canonical selection shape, rendered-canvas and UI operations through explicit ports and deliberately does not install global DOM listeners.

Generic pointer capture/active-pointer routing lives in `src/interaction/pointer-lifecycle-router.js`; tool/keyboard dispatch and canonical selection shape/session state remain in `src/main.js`; geometry math remains in `src/core/geometry.js`.

### `clipboard-copy-cut-controller.js`
Owns Selection Copy/Cut transaction orchestration: frozen exact document/session/selection/layer intent, selected-vs-merged PNG preparation, OS Clipboard image write, copy/cut command generation, post-await continuation ownership and destructive-port guard handoff. It does not own Paste or destructive pixel/history internals.

### `clipboard-controller.js`
Owns Paste/native-paste/fallback lifecycle and its independent `pasteGeneration`, while composing the copy/cut owner behind the stable public facade imported by `src/main.js`. Destructive clearing remains delegated to raster owners. See `SELECTION_CLIPBOARD.md`.

### `raster-mutation-controller.js`
Owns destructive selection-to-layer orchestration: merged cut across visible unlocked pixel layers, prepare-all-before-mutate staging, native high-depth clear publication, non-raster pixel-edit rasterization and the selected-layer rasterize command.

For merged multi-layer clearing, the publication gate is all-or-none: after every async preparation step completes, the controller revalidates the exact document/session and the whole exact source-layer set plus effective locks, derives slots by object identity, then publishes synchronously. Same-ID replacements, removals and late locks reject the batch before any persisted write or history publication. See `RASTER_PERSISTENCE.md`. It does not own selection shape/pointer state or Clipboard APIs.

### `mask-controller.js`
Owns selection-shape → raster layer-mask / Select & Mask orchestration: regular-layer local coordinates versus adjustment/document coordinates, bounded refine preparation, shared `selectionMaskDataUrl()`, add/remove mask commands, non-destructive preview lifecycle and final Apply publication.

Stable mask schema/lock/geometry/pixel primitives remain in core. Runtime state, render/source-canvas and modal/DOM/RAF effects enter as narrow ports. Every awaited mutation path revalidates the originating document, exact selected layer and lock state before publication; preview additionally uses a per-modal generation token so stale async work cannot attach listeners or repaint a foreign modal. Smart Filter reuses only the shared rasterizer and retains its own target/history transaction. Vector Mask/Pen semantics remain outside this owner.

### `vector-mask-controller.js`
Owns the selection-driven Vector Mask command/policy seam: exact rectangle and cubic-Bézier ellipse conversion, bounded generic selection-path conversion, document→layer localization for anchors/handles, boolean subpath publication, the 128-subpath guard and selected-mask edit-entry/toggle/invert/remove commands.

It deliberately does **not** own existing anchor/handle drag transaction, Pen target discovery/drawing/new-path draft, Saved Paths CRUD/UI or PSD/PSB vector-mask conversion. Those stay in the path-control surface/gesture owners, `src/interaction/pen-draft-gesture-controller.js`, `src/ui/paths-controller.js` and the runtime/format boundary respectively; the controller reaches Pen mode only through narrow begin/clear edit ports.

## Workspace boundary — `src/workspace/`

### `session-controller.js`
Owns document-tab/session lifecycle: session IDs and names, per-tab history/zoom/dirty/selection snapshots, tab rendering/actions, switching, close/rename/duplicate, and the parent-tab guard for open Smart Object content tabs.

It does **not** own raster/document internals. `src/main.js` supplies the live runtime state bridge and application callbacks; `src/core/state.js` remains the document model owner.

### `history-navigation-controller.js`
Owns synchronous Undo / Redo / jump-to-history runtime transactions. Each command resolves the current mutable HistoryStack binding at invocation time, runs the pending-edit guard before stack mutation, restores the selected snapshot, preserves command-specific transient cleanup, then publishes runtime refresh → dirty state → exact status.

It does **not** render the History panel, create/clone HistoryStack instances or own snapshot serialization. Stack mechanics stay in `src/core/history.js`; per-tab history binding stays in `session-controller.js`; history-row DOM plus menu/keyboard/button dispatch stay in `src/main.js`.

### `viewport-controller.js`
Owns canvas zoom command policy: canonical clamp/no-op semantics, active-session zoom synchronization, canvas/overlay refresh, one-frame pointer anchoring correction and fit-to-view with the established 90 px padding + scroll reset.

It receives live runtime/DOM geometry through narrow ports. Keyboard/menu/wheel dispatch and pan gestures remain in `src/main.js`; shell visibility and center preservation across panel toggles remain in `src/ui/workspace-layout-controller.js`. See `VIEWPORT_NAVIGATION.md`.

### `recovery-controller.js`
Owns workspace recovery orchestration: reload-stable per-window identity, debounce/cancellation, serialized writes/discard, dirty-tab snapshot collection, startup recovery selection and safe publication into document sessions.

It deliberately does **not** implement IndexedDB or project schemas. `src/core/recovery.js` owns record normalization/storage, while `src/main.js` only wires explicit storage/project/session/runtime/UI ports. Ownership is enforced in the controller too: a recovery record belonging to another live editor window cannot be discarded merely because UI returns an invalid action.

## Core — `src/core/`

- `state.js` — document/layer/group/smart-object models, sanitization and invariants.
- `render.js` — Canvas 2D render/composite/export bridge.
- `pixel-buffer.js` — typed RGB/CMYK 8/16/32-bit model and native destructive/composite primitives.
- `pixels.js` — RGBA8 pixel operations and masks.
- `color-management.js` — ICC parsing/transforms, CMYK preview/edit/proof policies.
- `color.js` — color helpers.
- `adjustments.js` — adjustment model sanitization/equality.
- `layer-styles.js` — layer style model/render helpers.
- `geometry.js` — selection/layer geometry and transforms.
- `history.js` — history stack.
- `io.js` — browser file/data-url/download helpers.
- `recovery.js` — low-level IndexedDB recovery record normalization/read/write/clear adapter; no session/UI orchestration.
- `pixel-worker.js` — bounded worker path for heavy pixel operations.

## Formats — `src/formats/`

### `psd.js`
PSD/PSB codec and Photoshop-compatibility boundary: parsing, writing, native metadata preservation/rewrite, high-depth/CMYK channels, text/shape/adjustment/smart-object structures.

Legacy `src/adapters/psd.js` only re-exports this module.

## Generated artifact

### `src/app.bundle.js`
Generated by `tools/build-bundle.mjs`. Required because the app must work directly under `file://`. Never hand-edit.

## Tests

Unit/contract tests live in `tests/*.test.mjs`; compatibility fixtures live under `tests/fixtures/`. Start from [../testing/TEST_MATRIX.md](../testing/TEST_MATRIX.md), not by opening every test.

## Tooling

- `tools/build-bundle.mjs` — explicit ordered browser bundle graph.
- `tools/browser-smoke.mjs` — real Chromium `file://` smoke through DevTools.
- other tools — fixture/corpus helpers.

## Documentation ownership

- `docs/PROJECT.md` — short start page.
- this file — code ownership.
- `BOUNDARIES.md` — dependency rules/invariants.
- `../development/AI_WORKFLOW.md` — work protocol.
- `../reference/PROJECT_HISTORY.md` — deep historical notes; consult only when a stage-specific compatibility detail is needed.

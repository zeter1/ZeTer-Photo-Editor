# Test matrix

Use the smallest relevant set while developing; finish source changes with the repository gate.

| Change area | Targeted tests / checks | Extra runtime gate |
|---|---|---|
| UI constants / toolbar math | `tests/tool-layout.test.mjs`, architecture test | browser smoke for drag/persistence |
| Workspace shell layout / sidebar collapse / canvas mode | `tests/workspace-layout-controller.test.mjs`, `tests/collapsible-panels.test.mjs`, architecture test | `npm run test:browser` for persistence + Tab hide/show integration |
| Layers panel/tree DOM + keyboard focus + layer/group DnD | `tests/layers-panel-controller.test.mjs`, `tests/layer-groups.test.mjs`, architecture/source guard | `npm run test:browser` after panel/composition-root wiring changes |
| Primitive layer/group command policy: recursive locks, stale modal owner, no-op history, create/delete/reorder/move publication | `tests/layer-group-command-controller.test.mjs`, `tests/layer-groups.test.mjs`, architecture/source guard | `npm run test:browser` after command/composition-root wiring changes |
| Discrete layer nudge/center/align/fit commands: stable owner/ID, recursive lock, transformability, canonical rotated geometry, no-op history | `tests/layer-transform-command-controller.test.mjs`, geometry/layer regressions, architecture/source guard | `npm run test:browser` after command/composition-root wiring changes |
| Interactive Move/Resize/Rotate gesture transaction: exact owner/identity, live preview, Shift/Alt/Ctrl modifiers, Smart Snap, final release, semantic no-op, recursive-lock/stale rejection and cancel rollback | `tests/layer-transform-gesture-controller.test.mjs`, `tests/pointer-release-tools.test.mjs`, `tests/editor-interactions.test.mjs`, architecture/source guard | `npm run test:browser` after gesture/composition-root wiring changes |
| Existing Bézier read-only edit surface (Shape / Vector Mask / Saved Path): Saved Path precedence, selected/visible target discovery, layer projection, recursive-lock hit rejection with locked rendering, handle-first hit priority, `8 / zoom`, open/closed tracing, source styling/zoom-stable metrics and idle Pen cursor guards | `tests/path-control-surface-controller.test.mjs`, `tests/advanced-tools-v120.test.mjs`, `tests/vector-masks.test.mjs`, architecture/source guard | `npm run test:browser` after surface/composition-root/bundle wiring changes |
| One-shot existing Bézier Alt-click anchor→corner command (Shape / Vector Mask / Saved Path): ignored intent vs rejected target, active owner, exact live-target resolution, recursive lock recheck, handle clearing, corner normalization, semantic no-op, exact status/history labels | `tests/path-control-command-controller.test.mjs`, `tests/path-control-surface-controller.test.mjs`, `tests/advanced-tools-v120.test.mjs`, architecture/source guard | `npm run test:browser` after command/composition-root/bundle wiring changes |
| Interactive existing Bézier anchor/handle gesture transaction (Shape / Vector Mask / Saved Path): exact owner/path/subpath/node identity, layer coordinates, Shift/Alt semantics, zoom-threshold rollback, final release, semantic no-op, exact history labels, recursive-lock/stale rejection and shared cancel rollback | `tests/path-control-gesture-controller.test.mjs`, `tests/pointer-release-tools.test.mjs`, `tests/advanced-tools-v120.test.mjs`, `tests/vector-masks.test.mjs`, architecture/source guard | `npm run test:browser` after gesture/composition-root/bundle wiring changes |
| Generic layer property command policy: exact owner, no-op history, filter/opacity live-preview baseline, discrete Color Correction/full-filter reset canonicalization, HDR stale callback, text/geometry validation | `tests/layer-property-command-controller.test.mjs`, `tests/high-depth-preview-controls.test.mjs`, text/high-depth/layer regressions, architecture/source guard | `npm run test:browser` after Properties/filter-reset/persistent-control composition wiring changes |
| Adjustment Layer persisted scalar/Levels/Curves/clipping commands: exact owner/target, recursive lock, path/Curves validation, canonical no-op and one-commit history | `tests/adjustment-command-controller.test.mjs`, `tests/adjustments.test.mjs`, `tests/psd-adjustment-layer.test.mjs`, architecture/source guard | `npm run test:browser` after Properties/composition wiring changes |
| Color Correction modal transaction: exact owner/target, control-range clamp, live preview/no-op, Reset, one-commit Apply, Cancel/Escape/backdrop rollback, stale/lock finalization and cleanup | `tests/color-correction-controller.test.mjs`, `tests/color-correction.test.mjs`, architecture/source guard | `npm run test:browser` after modal/composition-root wiring changes |
| Saved Paths panel / CRUD / selected-index bridge / vector-mask apply | `tests/paths-controller.test.mjs`, `tests/paths-panel.test.mjs`, `tests/workspace-session-controller.test.mjs`, `tests/vector-masks.test.mjs`, architecture test; existing edit-surface/live-target semantics live in `tests/path-control-surface-controller.test.mjs`, one-shot corner-command semantics in `tests/path-control-command-controller.test.mjs`, existing anchor/handle drag semantics in `tests/path-control-gesture-controller.test.mjs` | `npm run test:browser` for full file:// startup after wiring changes |
| Global overlay pointer lifecycle / capture / cancellation | `tests/pointer-lifecycle-router.test.mjs`, `tests/pointer-release-tools.test.mjs`, architecture test | `npm run test:browser` |
| Menu/tool-specific interaction | relevant interaction/selection/retouch tests | `npm run test:browser` |
| Selection gesture state / marquee / lasso / polygon / magnetic | `tests/selection-gesture-controller.test.mjs`, `tests/selection-types-v119.test.mjs`, `tests/pointer-release-tools.test.mjs`, architecture test | `npm run test:browser` when global pointer/keyboard wiring changes |
| Documents/layers/groups | core, layer-groups, document-tabs | browser smoke when UI path changes |
| Image Size / Canvas Size command policy: exact originating document, atomic plan, no-op/error history, nine anchors, transient cleanup | `tests/document-resize-command-controller.test.mjs`, core/document regressions, architecture/source guard | `npm run test:browser` after resize modal/composition-root wiring changes |
| Crop command policy: exact originating document, rounding, finite/canvas safety, atomic layer-position plan, full-bounds no-op completion and one real history publication | `tests/document-crop-command-controller.test.mjs`, `tests/pointer-release-tools.test.mjs`, workspace/session regressions, architecture/source guard | `npm run test:browser` after crop/composition-root wiring changes |
| Document Background command policy: exact originating document, replacement/stale rejection, same-value no-op, one history publication | `tests/document-background-command-controller.test.mjs`, architecture/source guard, document/session regressions | `npm run test:browser` after background modal/composition-root wiring changes |
| Smart Object content lifecycle / linked sources / content tabs | `tests/smart-object-controller.test.mjs`, `tests/linked-smart-objects.test.mjs`, PSD Smart Object round-trip tests, architecture/source guard | `npm run test:browser` after composition-root wiring changes |
| Photoshop Smart Object embedded resource rewrite / `liFD` prepare-publish / native baseline refresh | `tests/psd-smart-object-resource.test.mjs`, `tests/psd-smart-object-roundtrip.test.mjs`, `tests/psd-export-integration.test.mjs`, Smart Object async-race regressions | relevant Photoshop fixture round-trip + `npm run test:browser` after composition-root wiring changes |
| Smart Filter stack/mask UI + modal orchestration | `tests/smart-filter-controller.test.mjs`, `tests/smart-filters.test.mjs`, Smart Object/async-context regressions, architecture guard | `npm run test:browser` after controller/composition-root/dialog wiring changes |
| Layer Blending Options / Layer Styles dialog + transient preview | `tests/layer-blending-controller.test.mjs`, `tests/blending-preview.test.mjs`, `tests/layer-styles.test.mjs`, architecture guard | `npm run test:browser` after controller/modal/render-sync wiring changes |
| Text add/edit modal transaction + async live preview | `tests/text-edit-controller.test.mjs`, `tests/text-settings-controller.test.mjs`, `tests/text-font.test.mjs`, `tests/render-pipeline.test.mjs`, modal/architecture guards | `npm run test:browser` after controller/modal/render/overlay wiring changes |
| Text typography/font settings policy + local/custom font registry | `tests/text-settings-controller.test.mjs`, `tests/text-font.test.mjs`, architecture/source guards | `npm run test:browser` after Properties/modal/font-picker wiring changes |
| RGBA pixel operations | pixel/retouch tests | visual/runtime when pointer stroke changes |
| Raster edit state / paint buffer / preview / persistence | `tests/painting-controller.test.mjs`, raster-save-boundary, architecture test | browser smoke when startup/render wiring changes |
| Fill / raster line / current-layer selection clear commands | `tests/painting-command-controller.test.mjs`, selection-fill-line, high-depth-editing, raster-save-boundary, architecture test | `npm run test:browser` when click/release wiring changes |
| Merged selection cut / multi-layer clear / selected-layer rasterization | `tests/selection-raster-mutation-controller.test.mjs`, selection-clipboard, async-document-context, high-depth-editing, architecture test | `npm run test:browser` when menu/clipboard/rasterize wiring changes |
| Selection → raster layer mask / Select & Mask refine + preview + async Apply ownership | `tests/selection-mask-controller.test.mjs`, `tests/selection-refine.test.mjs`, `tests/smart-filter-controller.test.mjs`, architecture/source guard | `npm run test:browser` after modal/composition-root/bundle wiring changes |
| Selection → Vector Mask geometry/boolean/lifecycle owner | `tests/selection-vector-mask-controller.test.mjs`, `tests/vector-masks.test.mjs`, Saved Paths + PSD vector-mask/export regressions, architecture/source guard | `npm run test:browser` after composition-root/bundle wiring changes |
| Brush/eraser/retouch stroke gesture lifecycle | `tests/painting-gesture-controller.test.mjs`, brush-performance, retouch/high-depth tests, architecture test | `npm run test:browser` for pointer wiring |
| 16/32-bit editing/composite | high-depth-* tests | format round-trip when export changes |
| ICC/CMYK policy/profile UI orchestration + cache ownership | `tests/color-management-controller.test.mjs`, `tests/color-management.test.mjs`, `tests/color-profile.test.mjs`, `tests/color-compatibility-corpus.test.mjs`, architecture test | fixture-based verification + `npm run test:browser` when properties-panel wiring changes |
| PSD/PSB import transaction / decoded-payload mapping | `tests/psd-import-controller.test.mjs`, `tests/psd-export-integration.test.mjs`, `tests/high-depth-persistence.test.mjs`, async-document-context tests, architecture test | relevant PSD/high-depth/CMYK fixtures + `npm run test:browser` after composition-root wiring |
| Photoshop import semantics / Text-Shape-Adjustment-Smart Object / embedded assets | `tests/psd-import-semantics.test.mjs`, `tests/psd-export-integration.test.mjs`, architecture test | PSD compatibility fixtures + full `npm run check`; browser smoke only when composition wiring/browser ports change |
| Photoshop native Text/Shape/Adjustment/Smart Object export planning | `tests/psd-native-metadata-plans.test.mjs`, `tests/psd-export-integration.test.mjs`, architecture test | relevant real Photoshop fixture/golden tests before full gate |
| PSD/PSB export preparation / document mapping | `tests/psd-export-controller.test.mjs`, `tests/psd-export-integration.test.mjs`, architecture test | relevant PSD/high-depth/CMYK fixtures + `npm run test:browser` after composition-root wiring |
| PSD/PSB binary codec / Photoshop metadata rewrite | `tests/psd-*.test.mjs` | fixture/golden round-trip |
| Recovery/autosave orchestration | `tests/workspace-recovery-controller.test.mjs`, `tests/recovery-v110.test.mjs`, architecture test | browser smoke for startup/reload/visibility flows |
| Low-level IndexedDB recovery / IO | `tests/recovery-v110.test.mjs`, reliability/direct-open tests | browser smoke when browser storage or file IO changes |
| Bundle/source graph | architecture test + `npm run build` | CI generated-bundle diff |
| General source change | `npm run check` | `npm run test:browser` when browser contract involved |

## Repository gates

```bash
npm run build
npm test
npm run check
npm run test:browser
```

CI performs:
1. checkout + Node 24;
2. `npm run check`;
3. generated browser artifact parity: `git diff --exit-code -- src/app.bundle.js index.html version.json`;
4. real Chromium `file://` smoke;
5. `git diff --check`.

Do not weaken these gates to make a refactor pass.

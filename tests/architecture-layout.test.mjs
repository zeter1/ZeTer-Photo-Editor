import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [main, build, legacyPsd, legacyToolLayout, project, workspaceSessions, workspaceRecovery, toolbarController, menuController, modalController, workspaceLayoutController, layersPanelController, layerGroupCommandController, layerPropertyCommandController, adjustmentCommandController, layerTransformCommandController, colorCorrectionController, pathsController, colorManagementController, layerBlendingController, textEditController, textSettingsController, pointerLifecycleRouter, cropGestureController, layerTransformSurfaceController, layerTransformGestureController, pathControlSurfaceController, pathControlCommandController, pathControlGestureController, penDraftGestureController, penPathCommandController, selectionGestureController, selectionClipboardController, selectionRasterMutationController, documentImportController, documentBackgroundCommandController, documentCropCommandController, documentResizeCommandController, paintingController, paintCommandController, paintGestureController, retouchController, psdExportController, psdImportController, psdImportSemantics, psdNativeMetadataPlans] = await Promise.all([
  readFile(new URL('src/main.js', root), 'utf8'),
  readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
  readFile(new URL('src/adapters/psd.js', root), 'utf8'),
  readFile(new URL('src/core/tool-layout.js', root), 'utf8'),
  readFile(new URL('docs/PROJECT.md', root), 'utf8'),
  readFile(new URL('src/workspace/session-controller.js', root), 'utf8'),
  readFile(new URL('src/workspace/recovery-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/toolbar-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/menu-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/modal-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/workspace-layout-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/layers-panel-controller.js', root), 'utf8'),
  readFile(new URL('src/layers/command-controller.js', root), 'utf8'),
  readFile(new URL('src/layers/property-command-controller.js', root), 'utf8'),
  readFile(new URL('src/layers/adjustment-command-controller.js', root), 'utf8'),
  readFile(new URL('src/layers/transform-command-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/color-correction-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/paths-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/color-management-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/layer-blending-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/text-edit-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/text-settings-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/pointer-lifecycle-router.js', root), 'utf8'),
  readFile(new URL('src/interaction/crop-gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/layer-transform-surface-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/layer-transform-gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/path-control-surface-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/path-control-command-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/path-control-gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/pen-draft-gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/pen-path-command-controller.js', root), 'utf8'),
  readFile(new URL('src/selection/gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/selection/clipboard-controller.js', root), 'utf8'),
  readFile(new URL('src/selection/raster-mutation-controller.js', root), 'utf8'),
  readFile(new URL('src/document/import-controller.js', root), 'utf8'),
  readFile(new URL('src/document/background-command-controller.js', root), 'utf8'),
  readFile(new URL('src/document/crop-command-controller.js', root), 'utf8'),
  readFile(new URL('src/document/resize-command-controller.js', root), 'utf8'),
  readFile(new URL('src/painting/controller.js', root), 'utf8'),
  readFile(new URL('src/painting/command-controller.js', root), 'utf8'),
  readFile(new URL('src/painting/gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/retouch/controller.js', root), 'utf8'),
  readFile(new URL('src/document/psd-export-controller.js', root), 'utf8'),
  readFile(new URL('src/document/psd-import-controller.js', root), 'utf8'),
  readFile(new URL('src/document/psd-import-semantics.js', root), 'utf8'),
  readFile(new URL('src/document/psd-native-metadata-plans.js', root), 'utf8'),
]);

test('canonical UI and PSD boundaries stay out of legacy compatibility paths', () => {
  assert.match(main, /from '\.\/ui\/tool-config\.js'/);
  assert.match(toolbarController, /from '\.\/tool-layout\.js'/);
  assert.match(main, /from '\.\/formats\/psd\.js'/);
  assert.doesNotMatch(main, /^const TOOL_LABELS\s*=/m);

  assert.match(build, /'src\/ui\/tool-config\.js'/);
  assert.match(build, /'src\/ui\/tool-layout\.js'/);
  assert.match(build, /'src\/formats\/psd\.js'/);
  assert.doesNotMatch(build, /'src\/adapters\/psd\.js'/);

  assert.match(legacyPsd, /export \* from '\.\.\/formats\/psd\.js'/);
  assert.match(legacyToolLayout, /export \* from '\.\.\/ui\/tool-layout\.js'/);
  assert.match(project, /src\/formats\/psd\.js/);
  assert.match(project, /src\/ui\/tool-config\.js/);
  assert.match(main, /from '\.\/workspace\/session-controller\.js'/);
  assert.match(build, /'src\/workspace\/session-controller\.js'/);
  assert.match(workspaceSessions, /export function createDocumentSessionController/);
  assert.doesNotMatch(main, /function renderDocumentTabs\(\)/);
  assert.match(main, /from '\.\/workspace\/recovery-controller\.js'/);
  assert.match(build, /'src\/workspace\/recovery-controller\.js'/);
  assert.match(workspaceRecovery, /export function createRecoveryController/);
  assert.match(workspaceRecovery, /export function createRecoveryWindowKey/);
  assert.match(main, /createRecoveryController\(\{/);
  for (const name of ['createRecoveryKey','reportRecoveryFailure','cancelRecoveryTimer','discardRecovery']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.doesNotMatch(main, /let (?:recoveryTimer|recoveryGeneration|recoveryWritePromise|recoveryStorageAvailable|recoveryFailureNotified|unrestoredRecoveryDocuments)\b/);
  assert.doesNotMatch(main, /async function restoreRecoveryIfAvailable\(\)/);
  assert.match(main, /from '\.\/ui\/toolbar-controller\.js'/);
  assert.match(build, /'src\/ui\/toolbar-controller\.js'/);
  assert.match(toolbarController, /export function createToolbarController/);
  assert.doesNotMatch(main, /function initToolbarReorder\(\)/);
  assert.doesNotMatch(main, /function initTooltips\(\)/);
  assert.match(main, /from '\.\/ui\/menu-controller\.js'/);
  assert.match(build, /'src\/ui\/menu-controller\.js'/);
  assert.match(menuController, /export function createMenuController/);
  assert.ok(main.includes("menuButtons: $$('.menu-button')"));
  assert.doesNotMatch(main, /function populateMenu\(/);
  assert.doesNotMatch(main, /function openMenu\(/);
  assert.doesNotMatch(main, /function openContextMenu\(/);
  assert.doesNotMatch(main, /let openMenuKey = null/);
  assert.match(main, /from '\.\/ui\/modal-controller\.js'/);
  assert.match(build, /'src\/ui\/modal-controller\.js'/);
  assert.match(modalController, /export function createModalController/);
  assert.match(modalController, /export function normalizeNumberInput/);
  assert.match(modalController, /export function makeModalDraggable/);
  assert.doesNotMatch(main, /function normalizeNumberInput\(/);
  assert.doesNotMatch(main, /function showModal\(/);
  assert.doesNotMatch(main, /function makeModalDraggable\(/);
  assert.doesNotMatch(main, /function showInfoModal\(/);
  assert.doesNotMatch(main, /function showRecoveryModal\(/);
  assert.match(main, /from '\.\/ui\/workspace-layout-controller\.js'/);
  assert.match(build, /'src\/ui\/workspace-layout-controller\.js'/);
  assert.match(workspaceLayoutController, /export function createWorkspaceLayoutController/);
  assert.match(main, /const \{ initCollapsiblePanels, togglePanels \} = workspaceLayoutController/);
  for (const name of ['readCollapseState','persistCollapseState','setPanelCollapsed','initCollapsiblePanels','togglePanels']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.doesNotMatch(main, /const collapsedPanelIds = new Set/);
  assert.doesNotMatch(main, /let panelsVisible = true/);
  assert.match(main, /from '\.\/ui\/layers-panel-controller\.js'/);
  assert.match(build, /'src\/ui\/layers-panel-controller\.js'/);
  assert.match(layersPanelController, /export function createLayersPanelController/);
  assert.match(main, /createLayersPanelController\(\{/);
  assert.match(main, /layersPanelController\.render\(\)/);
  assert.match(main, /layersPanelController\.bind\(\)/);
  assert.match(main, /from '\.\/layers\/command-controller\.js'/);
  assert.match(build, /'src\/layers\/command-controller\.js'/);
  assert.match(layerGroupCommandController, /export function createLayerGroupCommandController/);
  assert.match(main, /createLayerGroupCommandController\(\{/);
  assert.match(main, /toggleVisibility: layerGroupCommandController\.toggleLayerVisibility/);
  assert.match(main, /moveLayerRelative: layerGroupCommandController\.moveLayerRelative/);
  assert.match(main, /from '\.\/layers\/property-command-controller\.js'/);
  assert.match(build, /'src\/layers\/property-command-controller\.js'/);
  assert.match(layerPropertyCommandController, /export function createLayerPropertyCommandController/);
  assert.match(main, /createLayerPropertyCommandController\(\{/);
  assert.match(main, /layerPropertyCommandController\.applyProperty\(/);
  assert.match(main, /layerPropertyCommandController\.setSelectedOpacity/);
  assert.match(main, /layerPropertyCommandController\.updateHighDepthPreview/);
  assert.match(main, /colorCorrectionKeys: COLOR_CORRECTION_KEYS/);
  assert.match(main, /layerPropertyCommandController\.resetSelectedColorCorrection\(\)/);
  assert.match(main, /layerPropertyCommandController\.resetSelectedFilters\(\)/);
  assert.match(main, /from '\.\/layers\/adjustment-command-controller\.js'/);
  assert.match(build, /'src\/layers\/adjustment-command-controller\.js'/);
  assert.match(adjustmentCommandController, /export function createAdjustmentLayerCommandController/);
  assert.match(main, /createAdjustmentLayerCommandController\(\{/);
  assert.match(main, /adjustmentLayerCommandController\.updateProperty\(owner,layerId/);
  assert.match(main, /adjustmentLayerCommandController\.updateCurveChannel\(owner,layerId/);
  assert.match(main, /adjustmentLayerCommandController\.setClipping\(owner,layerId/);
  assert.doesNotMatch(main, /function updateAdjustmentProperty\(/);
  assert.doesNotMatch(main, /function updateAdjustmentCurveChannel\(/);
  assert.match(main, /from '\.\/layers\/transform-command-controller\.js'/);
  assert.match(build, /'src\/layers\/transform-command-controller\.js'/);
  assert.match(layerTransformCommandController, /export function createLayerTransformCommandController/);
  assert.match(main, /createLayerTransformCommandController\(\{/);
  assert.match(main, /layerTransformCommandController\.nudge\(doc,l\.id,dx,dy\)/);
  assert.match(main, /layerTransformCommandController\.center\(doc,l\.id\)/);
  assert.match(main, /layerTransformCommandController\.align\(doc,l\.id,mode\)/);
  assert.match(main, /layerTransformCommandController\.fitToCanvas\(doc,l\.id\)/);
  assert.match(main, /from '\.\/interaction\/layer-transform-surface-controller\.js'/);
  assert.match(build, /'src\/interaction\/layer-transform-surface-controller\.js'/);
  assert.match(layerTransformSurfaceController, /export function createLayerTransformSurfaceController/);
  assert.match(layerTransformSurfaceController, /isLayerVisible\(owner, layer\)/);
  assert.match(layerTransformSurfaceController, /isLayerLocked\(owner, layer\)/);
  assert.match(layerTransformSurfaceController, /geometry\.hitLayerHandle\(hitPoint, layer, 10 \/ zoom\)/);
  assert.match(layerTransformSurfaceController, /geometry\.rotationHandlePoint\(layer, 30 \/ zoom\)/);
  assert.doesNotMatch(layerTransformSurfaceController, /\b(?:commit|addLayer|touch)\b/);
  assert.match(main, /createLayerTransformSurfaceController\(\{/);
  assert.match(main, /layerTransformSurface\.draw\(ctx\)/);
  assert.match(main, /layerTransformSurface\.movePointerIntent\(p\)/);
  assert.match(main, /layerTransformSurface\.idleCursor\(point\)/);
  assert.match(main, /layerTransformSurface\.isTransformableLayer\(selected\(\)\)/);
  for (const name of ['isTransformableLayer','topLayerAt','interactiveRotationHandlePoint','cursorForHandle']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /from '\.\/interaction\/layer-transform-gesture-controller\.js'/);
  assert.match(build, /'src\/interaction\/layer-transform-gesture-controller\.js'/);
  assert.match(layerTransformGestureController, /export function createLayerTransformGestureController/);
  assert.match(layerTransformGestureController, /state\.getDocument\(\) !== owner/);
  assert.match(layerTransformGestureController, /layer !== target/);
  assert.match(layerTransformGestureController, /isLayerLocked\(owner, layer\)/);
  assert.match(main, /createLayerTransformGestureController\(\{/);
  assert.match(main, /layerTransformGestures\.beginMove\(doc,intent\.layer\.id,p\)/);
  assert.match(main, /layerTransformGestures\.beginResize\(doc,intent\.layer\.id,intent\.handle,p\)/);
  assert.match(main, /from '\.\/interaction\/path-control-surface-controller\.js'/);
  assert.match(build, /'src\/interaction\/path-control-surface-controller\.js'/);
  assert.match(pathControlSurfaceController, /export function createPathControlSurfaceController/);
  assert.match(pathControlSurfaceController, /selectedLayer\(owner\)/);
  assert.match(pathControlSurfaceController, /isLayerVisible\(owner, layer\)/);
  assert.match(pathControlSurfaceController, /isLayerLocked\(owner, target\.layer\)/);
  assert.match(main, /createPathControlSurfaceController\(\{/);
  assert.match(main, /pathControlSurface\.hit\(p\)/);
  assert.match(main, /pathControlSurface\.draw\(ctx\)/);
  assert.match(main, /pathControlSurface\.updateCursor\(p\)/);
  assert.match(pathControlSurfaceController, /function resolveTarget\(target\)/);
  assert.doesNotMatch(main, /pathControlSurface\.targetPoints\(hit\)/);
  for (const name of ['selectedEditablePathTargets','pathTargetPoints','pathControlDocumentPoint','hitSelectedPathControl','traceEditablePathTarget','drawSelectedPathControls','updatePenCursor']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /from '\.\/interaction\/path-control-command-controller\.js'/);
  assert.match(build, /'src\/interaction\/path-control-command-controller\.js'/);
  assert.match(pathControlCommandController, /export function createPathControlCommandController/);
  assert.match(pathControlCommandController, /targets\.resolve\(target\)/);
  assert.match(pathControlCommandController, /isLayerLocked\(owner, resolved\.layer\)/);
  assert.match(main, /createPathControlCommandController\(\{/);
  assert.match(main, /pathControlCommands\.convertAnchorToCorner\(doc,hit,\{altKey:event\.altKey\}\)/);
  const pathControlBeginSource = main.slice(
    main.indexOf('function beginPathControlDrag('),
    main.indexOf('function setSelectionPreviewShape('),
  );
  assert.ok(pathControlBeginSource.includes('function beginPathControlDrag('));
  assert.doesNotMatch(pathControlBeginSource, /node\.handleIn=null;node\.handleOut=null;node\.kind='corner'/);
  assert.doesNotMatch(main, /Преобразовать Bézier-узел в угловой/);
  assert.doesNotMatch(main, /Преобразовать узел векторной маски/);
  assert.doesNotMatch(main, /Преобразовать узел сохранённого контура/);
  assert.match(main, /from '\.\/interaction\/path-control-gesture-controller\.js'/);
  assert.match(build, /'src\/interaction\/path-control-gesture-controller\.js'/);
  assert.match(pathControlGestureController, /export function createPathControlGestureController/);
  assert.match(pathControlGestureController, /state\.getDocument\(\) === owner/);
  assert.match(pathControlGestureController, /isLayerLocked\(gesture\.owner, layer\)/);
  assert.match(pathControlGestureController, /gesture\.pathId !== null/);
  assert.match(pathControlGestureController, /points\.indexOf\(gesture\.nodeTarget\)/);
  assert.match(pathControlGestureController, /distance <= 1 \/ zoom/);
  assert.match(main, /pathControlGestures\.begin\(doc,hit,point,\{shiftKey:event\.shiftKey\}\)/);
  assert.match(main, /pathControlGestures\.update\(drag,p,\{altKey:e\.altKey\}\)/);
  assert.match(main, /pathControlGestures\.finish\(d,canvasPoint\(e,\{clampToDocument:false\}\),\{altKey:e\.altKey\}\)/);
  assert.doesNotMatch(main, /function restorePathControlDrag\(/);
  assert.doesNotMatch(main, /if \(drag\.kind === 'path-control'\)/);
  assert.match(main, /from '\.\/interaction\/pen-draft-gesture-controller\.js'/);
  assert.match(build, /'src\/interaction\/pen-draft-gesture-controller\.js'/);
  assert.match(penDraftGestureController, /export function createPenDraftGestureController/);
  assert.match(penDraftGestureController, /4 \/ currentZoom\(\)/);
  assert.match(penDraftGestureController, /1 \/ currentZoom\(\)/);
  assert.match(penDraftGestureController, /resolved\.draft\.points\.splice\(gesture\.nodeIndex, 1\)/);
  assert.match(main, /penDraftGestures\.beginPoint\(p,\{finish:e\.detail>=2\}\)/);
  assert.match(main, /penDraftGestures\.update\(drag,p,\{altKey:e\.altKey\}\)/);
  assert.match(main, /penDraftGestures\.finish\(d,canvasPoint\(e\),\{altKey:e\.altKey\}\)/);
  assert.match(main, /penDraftGestures\.cancelPoint\(d\)/);
  assert.doesNotMatch(main, /let penDraft\s*=/);
  assert.doesNotMatch(main, /kind:'pen-handle'/);
  assert.doesNotMatch(main, /penDraft\.points\.splice/);
  assert.doesNotMatch(main, /function beginPenPoint\(/);
  assert.doesNotMatch(penDraftGestureController, /\b(?:commit|addLayer|createShapeLayer)\b/);
  assert.match(main, /from '\.\/interaction\/pen-path-command-controller\.js'/);
  assert.match(build, /'src\/interaction\/pen-path-command-controller\.js'/);
  assert.match(penPathCommandController, /export function createPenPathCommandController/);
  assert.match(penPathCommandController, /createShapeLayer/);
  assert.match(penPathCommandController, /addLayer/);
  assert.match(penPathCommandController, /Добавить Bézier-контур/);
  assert.match(main, /createPenPathCommandController\(\{/);
  assert.match(main, /penPathCommands\.publish\(doc,points,/);
  assert.doesNotMatch(main, /function penDraftBounds\(/);
  assert.doesNotMatch(main, /function localizePenNode\(/);
  const finishPenPathSource = main.slice(
    main.indexOf('function finishPenPath(){'),
    main.indexOf('function magicWandSelect('),
  );
  assert.ok(finishPenPathSource.includes('function finishPenPath(){'));
  assert.match(finishPenPathSource, /penDraftGestures\.consumePoints\(\)/);
  assert.match(finishPenPathSource, /PEN_PATH_COMMAND_RESULT\.COMMITTED/);
  assert.doesNotMatch(finishPenPathSource, /createShapeLayer|addLayer\(|commit\('Добавить Bézier-контур'\)/);
  assert.match(main, /layerTransformGestures\.beginRotate\(doc,intent\.layer\.id,p,intent\.center\)/);
  assert.match(main, /layerTransformGestures\.update\(drag,p,/);
  assert.match(main, /layerTransformGestures\.finish\(d,canvasPoint\(e,\{clampToDocument:false\}\),/);
  assert.match(main, /layerTransformGestures\.cancel\(d\)/);
  assert.doesNotMatch(main, /resizeLayerFromPoint\(/);
  assert.doesNotMatch(main, /rotationFromDrag\(/);
  assert.doesNotMatch(main, /snapLayerMove\(/);
  const imageMenuSource = main.match(/  image:\[[\s\S]*?\n  \],\n  select:\[/)?.[0] ?? '';
  assert.ok(imageMenuSource);
  assert.doesNotMatch(imageMenuSource, /\.filters\s*=/);
  assert.doesNotMatch(main, /\bsanitizeFilters\b/);
  assert.doesNotMatch(main, /function applyProperty\(/);
  assert.doesNotMatch(main, /function updateHighDepthPreviewSetting\(/);
  assert.doesNotMatch(main, /function resetSelectedLayerEffects\(/);
  assert.match(main, /from '\.\/ui\/color-correction-controller\.js'/);
  assert.match(build, /'src\/ui\/color-correction-controller\.js'/);
  assert.match(colorCorrectionController, /export function createColorCorrectionSession/);
  assert.match(colorCorrectionController, /export function createColorCorrectionController/);
  assert.match(main, /createColorCorrectionController\(\{/);
  assert.match(main, /colorCorrectionController\.open\(selected\(\)\)/);
  assert.doesNotMatch(main, /function openColorCorrectionDialog\(/);
  assert.doesNotMatch(main, /function moveLayerRelativeToTarget\(/);
  assert.doesNotMatch(main, /function moveLayerToRootTop\(/);
  assert.doesNotMatch(main, /function updateLayers\(/);
  assert.doesNotMatch(main, /function clearLayerDragDecorations\(/);
  assert.doesNotMatch(main, /\blet (?:layerDragId|groupDragId)\b/);
  assert.doesNotMatch(main, /els\.layers\.addEventListener\(['"]dragover/);
  assert.match(main, /from '\.\/ui\/paths-controller\.js'/);
  assert.match(build, /'src\/ui\/paths-controller\.js'/);
  assert.match(pathsController, /export function createPathsController/);
  assert.match(main, /selectedDocumentPathIndex: pathsController\.getSelectedIndex\(\)/);
  assert.doesNotMatch(main, /let selectedDocumentPathIndex =/);
  for (const name of ['pathFromCurrentSource','addDocumentPathFromCurrent','renameSelectedDocumentPath','duplicateSelectedDocumentPath','deleteSelectedDocumentPath','applySelectedDocumentPathAsVectorMask','pathContextMenu','updatePathsPanel']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /from '\.\/ui\/color-management-controller\.js'/);
  assert.match(build, /'src\/ui\/color-management-controller\.js'/);
  assert.match(colorManagementController, /export function createColorManagementController/);
  assert.match(main, /createColorManagementController\(\{/);
  assert.doesNotMatch(main, /let cmyk(?:Preview|Editing)TransformCache\b/);
  for (const name of ['colorManagementPolicyKey','rebuildDocumentCmykPreviews','updateDocumentColorManagement','loadDocumentProofProfile','loadDocumentDisplayProfile']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /from '\.\/ui\/layer-blending-controller\.js'/);
  assert.match(build, /'src\/ui\/layer-blending-controller\.js'/);
  assert.match(layerBlendingController, /export function createLayerBlendingController/);
  assert.match(layerBlendingController, /from '\.\/modal-controller\.js'/);
  assert.doesNotMatch(main, /let blendingPreview\s*=/);
  for (const name of ['blendingPreviewCrop','syncBlendingPreviewCanvas','openBlendingOptions']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /layerBlendingController\.syncPreviewCanvas\(\)/);

  assert.match(main, /from '\.\/ui\/text-edit-controller\.js'/);
  assert.match(build, /'src\/ui\/text-edit-controller\.js'/);
  assert.match(textEditController, /export function createTextEditController/);
  assert.match(textEditController, /from '\.\.\/core\/state\.js'/);
  assert.doesNotMatch(main, /let textDraft\s*=/);
  for (const name of ['openTextModal','attachTextPreview','syncTextPreviewCanvas','topTextLayerAt']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /textEditController\.documentWithPreview\(doc\)/);
  assert.match(main, /getDisplayLayer: owner => textEditController\.previewLayer\(owner\) \|\| selectedLayer\(owner\)/);
  assert.match(main, /textEditController\.syncPreviewCanvas\(\)/);
  assert.doesNotMatch(modalController, /attachTextPreview/);
  assert.doesNotMatch(modalController, /onModalClose/);

  assert.match(main, /from '\.\/ui\/text-settings-controller\.js'/);
  assert.match(build, /'src\/ui\/text-settings-controller\.js'/);
  assert.match(textSettingsController, /export function createTextSettingsController/);
  assert.match(textSettingsController, /from '\.\.\/core\/render\.js'/);
  assert.match(main, /createTextSettingsController\(\{/);
  assert.doesNotMatch(main, /\b(?:let|const) localTextFonts\b/);
  assert.doesNotMatch(main, /\bconst customFontReads\b/);
  for (const name of ['textFontOptions','loadComputerFonts','readCustomTextFont','loadCustomTextFont','textModalFields','textSettingsFromForm']) {
    assert.doesNotMatch(main, new RegExp(`(?:async\\s+)?function ${name}\\(`));
  }

  assert.match(main, /from '\.\/interaction\/pointer-lifecycle-router\.js'/);
  assert.match(build, /'src\/interaction\/pointer-lifecycle-router\.js'/);
  assert.match(pointerLifecycleRouter, /export function createPointerLifecycleRouter/);
  assert.match(pointerLifecycleRouter, /lostpointercapture/);
  assert.doesNotMatch(main, /\bactivePrimaryPointerId\b/);
  for (const eventName of ['pointerdown','pointermove','pointerup','pointercancel']) {
    assert.doesNotMatch(main, new RegExp(`els\\.overlay\\.addEventListener\\(['"]${eventName}['"]`));
  }
  assert.match(main, /pointerLifecycle = createPointerLifecycleRouter\(\{/);
  assert.match(main, /canContinue:\(\)=>pointerLifecycle\.isActivePointer\(e\.pointerId\)/);
  assert.match(main, /from '\.\/selection\/gesture-controller\.js'/);
  assert.match(build, /'src\/selection\/gesture-controller\.js'/);
  assert.match(selectionGestureController, /export function createSelectionGestureController/);
  assert.match(selectionGestureController, /function beginMarquee\(/);
  assert.match(selectionGestureController, /function updateMarquee\(/);
  assert.match(selectionGestureController, /function finishMarquee\(/);
  assert.match(selectionGestureController, /function findMagneticEdgePoint\(/);
  assert.match(main, /selectionGestures\.beginMarquee\(/);
  assert.match(main, /selectionGestures\.updateMarquee\(/);
  assert.match(main, /selectionGestures\.finishMarquee\(/);
  assert.doesNotMatch(main, /let (?:selectionType|polygonDraft|magneticDraft)\b/);
  for (const name of ['cancelPolygonDraft','finishPolygonSelection','setSelectionType','cycleSelectionType','findMagneticEdgePoint','magneticSegmentPoints','addMagneticPoint','finishMagneticSelection']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /from '\.\/selection\/clipboard-controller\.js'/);
  assert.match(build, /'src\/selection\/clipboard-controller\.js'/);
  assert.match(selectionClipboardController, /export function createSelectionClipboardController/);
  assert.doesNotMatch(main, /function copySelectionToClipboard\(/);
  assert.doesNotMatch(main, /function readClipboardImageFiles\(/);
  assert.doesNotMatch(main, /function armPasteShortcutFallback\(/);
  assert.doesNotMatch(main, /\bpasteGeneration\b/);
  assert.doesNotMatch(main, /\bpasteFallbackTimer\b/);
  assert.doesNotMatch(main, /\bopenMenuKey\b/);
  assert.match(main, /menuController\.isOpen\(\)/);
  assert.match(main, /from '\.\/document\/import-controller\.js'/);
  assert.match(main, /from '\.\/document\/background-command-controller\.js'/);
  assert.match(build, /'src\/document\/background-command-controller\.js'/);
  assert.match(documentBackgroundCommandController, /export function createDocumentBackgroundCommandController/);
  assert.match(documentBackgroundCommandController, /state\.getDocument\(\) === owner/);
  assert.match(documentBackgroundCommandController, /transaction\.commit\('Фон документа'\)/);
  assert.match(main, /createDocumentBackgroundCommandController\(\{/);
  assert.match(main, /const owner=doc;\s*showModal\(\{\s*title:'Фон документа'/);
  assert.match(main, /documentBackgroundCommandController\.setBackground\(owner,v\.background\)/);
  assert.doesNotMatch(main, /doc\.background\s*=/);
  assert.match(main, /from '\.\/interaction\/crop-gesture-controller\.js'/);
  assert.match(build, /'src\/interaction\/crop-gesture-controller\.js'/);
  assert.match(cropGestureController, /export function createCropGestureController/);
  assert.match(cropGestureController, /normalizeRect/);
  assert.match(cropGestureController, /state\.getDocument\(\) === gesture\?\.owner/);
  assert.match(cropGestureController, /CROP_GESTURE_MIN_SIZE = 10/);
  assert.doesNotMatch(cropGestureController, /transaction|commit\(/);
  assert.match(main, /createCropGestureController\(\{/);
  assert.match(main, /cropGestures\.begin\(doc,p\)/);
  assert.match(main, /cropGestures\.update\(drag,p\)/);
  assert.match(main, /cropGestures\.finish\(d,canvasPoint\(e\)\)/);
  assert.match(main, /cropRect: cropGestures\.snapshot\(\)/);
  assert.match(main, /cropGestures\.restore\(state\.cropRect\)/);
  assert.match(main, /cropGestures\.draw\(ctx, \{ zoom, width:doc\.width, height:doc\.height \}\)/);
  assert.doesNotMatch(main, /let cropRect\b/);
  assert.doesNotMatch(main, /fillStyle = '#0008'/);
  assert.match(main, /from '\.\/document\/crop-command-controller\.js'/);
  assert.match(build, /'src\/document\/crop-command-controller\.js'/);
  assert.match(documentCropCommandController, /export function createDocumentCropCommandController/);
  assert.match(documentCropCommandController, /checkedCanvasSize/);
  assert.match(documentCropCommandController, /MAX_LAYER_POSITION/);
  assert.match(documentCropCommandController, /state\.getDocument\(\) === owner/);
  assert.match(documentCropCommandController, /transaction\.commit\('Кадрирование'\)/);
  assert.match(main, /createDocumentCropCommandController\(\{/);
  assert.match(main, /documentCropCommandController\.crop\(owner,r\)/);
  assert.match(main, /applyCrop\(cropResult\.owner,cropResult\.rect\)/);
  assert.doesNotMatch(main, /commit\('Кадрирование'\)/);
  assert.match(main, /from '\.\/document\/resize-command-controller\.js'/);
  assert.match(build, /'src\/document\/resize-command-controller\.js'/);
  assert.match(documentResizeCommandController, /export function createDocumentResizeCommandController/);
  assert.match(documentResizeCommandController, /imageResizeTransforms/);
  assert.match(documentResizeCommandController, /MAX_LAYER_POSITION/);
  assert.match(main, /createDocumentResizeCommandController\(\{/);
  assert.match(main, /documentResizeCommandController\.resizeImage\(owner,v\)/);
  assert.match(main, /documentResizeCommandController\.resizeCanvas\(owner,v\)/);
  assert.doesNotMatch(main, /imageResizeTransforms\(/);
  assert.doesNotMatch(main, /MAX_LAYER_POSITION/);
  assert.match(build, /'src\/document\/import-controller\.js'/);
  assert.match(documentImportController, /export function createDocumentImportController/);
  assert.doesNotMatch(main, /function isImageFile\(/);
  assert.doesNotMatch(main, /function isProjectFile\(/);
  assert.doesNotMatch(main, /async function importImages\(/);
  assert.doesNotMatch(main, /async function handleIncomingFiles\(/);
  assert.match(main, /from '\.\/painting\/controller\.js'/);
  assert.match(build, /'src\/painting\/controller\.js'/);
  assert.match(paintingController, /export function createRasterEditController/);
  for (const name of [
    'ensureRasterBuffer','ensureNativeHighDepthPaintBuffer','prepareHighDepthMutation',
    'applyHighDepthMutation','persistNativeHighDepthPaintLayer','persistPaintLayer',
    'drawHighDepthRasterBase','schedulePaintPreview','cancelPaintPreview',
  ]) assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  assert.doesNotMatch(main, /let (?:brushCanvas|brushCtx|brushLayerId|highDepthPaintBuffer|highDepthPaintLayerId|highDepthPaintPreviewDirty|paintPreviewFrame|paintPreviewQueued)\b/);
  assert.match(main, /rasterEdit\.paintPreviewOverrides\(\)/);
  assert.match(main, /rasterEdit\.ensureRasterBuffer\(/);
  assert.match(main, /from '\.\/painting\/command-controller\.js'/);
  assert.match(build, /'src\/painting\/command-controller\.js'/);
  assert.match(paintCommandController, /export function createRasterCommandController/);
  assert.match(paintCommandController, /async function drawLine\(/);
  assert.match(paintCommandController, /async function fillAt\(/);
  assert.match(paintCommandController, /async function clearSelection\(/);
  assert.match(main, /drawLine: drawLineOnCurrentRaster/);
  assert.match(main, /fillAt: fillAtPoint/);
  assert.match(main, /clearSelection: clearSelectedPixels/);
  assert.doesNotMatch(main, /async function drawLineOnCurrentRaster\(/);
  assert.doesNotMatch(main, /async function fillAtPoint\(/);
  assert.doesNotMatch(main, /async function clearSelectedPixels\(/);
  assert.doesNotMatch(main, /function clearHighDepthPaintState\(/);
  assert.match(main, /from '\.\/selection\/raster-mutation-controller\.js'/);
  assert.match(build, /'src\/selection\/raster-mutation-controller\.js'/);
  assert.match(selectionRasterMutationController, /export function createSelectionRasterMutationController/);
  assert.match(selectionRasterMutationController, /async function clearAcrossVisibleLayers\(/);
  assert.match(selectionRasterMutationController, /async function rasterizeLayerForPixelEditing\(/);
  assert.match(selectionRasterMutationController, /async function rasterizeSelectedLayer\(/);
  assert.match(main, /clearAcrossVisibleLayers: clearSelectionAcrossVisibleLayers/);
  assert.doesNotMatch(main, /async function clearSelectionAcrossVisibleLayers\(/);
  assert.doesNotMatch(main, /async function rasterizeLayerForPixelEditing\(/);
  assert.doesNotMatch(main, /async function rasterizeSelectedLayer\(/);
  assert.match(main, /from '\.\/painting\/gesture-controller\.js'/);
  assert.match(build, /'src\/painting\/gesture-controller\.js'/);
  assert.match(paintGestureController, /export function createPaintGestureController/);
  assert.match(paintGestureController, /async function ensurePaintLayer\(/);
  assert.match(paintGestureController, /async function begin\(/);
  assert.match(paintGestureController, /function move\(/);
  assert.match(paintGestureController, /async function end\(/);
  assert.doesNotMatch(main, /async function ensurePaintLayer\(/);
  assert.doesNotMatch(main, /async function beginPaint\(/);
  assert.doesNotMatch(main, /function paintTo\(/);
  assert.doesNotMatch(main, /async function endPaint\(/);
  assert.match(main, /paintGesture\.begin\(/);
  assert.match(main, /paintGesture\.move\(/);
  assert.match(main, /paintGesture\.end\(/);

  assert.match(main, /from '\.\/retouch\/controller\.js'/);
  assert.match(build, /'src\/retouch\/controller\.js'/);
  assert.match(retouchController, /export function createRetouchController/);
  for (const name of [
    'prepareCloneStroke','applyCloneDab','cloneStrokeSegment',
    'applySmudgeDab','smudgeStrokeSegment','applyToneDab','toneStrokeSegment',
    'applyBlurDab','blurStrokeSegment','prepareNativeHighDepthCloneStroke',
    'applyNativeHighDepthCloneDab','nativeHighDepthCloneSegment',
    'applyNativeHighDepthSmudgeDab','nativeHighDepthSmudgeSegment',
    'applyNativeHighDepthToneDab','nativeHighDepthToneSegment',
    'applyNativeHighDepthBlurDab','nativeHighDepthBlurSegment',
  ]) assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  assert.doesNotMatch(main, /let (?:cloneSource|cloneSnapshotCanvas|highDepthCloneSnapshotBuffer|blurScratchCanvas|retouchScratchCanvas)\b/);
  assert.match(main, /from '\.\/document\/psd-export-controller\.js'/);
  assert.match(main, /from '\.\/document\/psd-native-metadata-plans\.js'/);
  assert.match(build, /'src\/document\/psd-native-metadata-plans\.js'/);
  assert.match(build, /'src\/document\/psd-export-controller\.js'/);
  assert.match(psdExportController, /from '\.\/psd-native-metadata-plans\.js'/);
  assert.doesNotMatch(psdExportController, /semantics:/);
  assert.match(psdExportController, /vectors: \{ exportPsdVectorMask \}/);
  assert.match(psdExportController, /export function createPsdExportController/);
  for (const name of [
    'psdTextNativePlan','psdShapeNativePlan','psdAdjustmentNativePlan',
    'psdSmartObjectRoundTripPlan','psdSmartObjectMetadataForExport',
    'psdOpaqueBlockFromState','psdPreviewFingerprint','psdEmbeddedDocumentFingerprint',
  ]) {
    assert.match(psdNativeMetadataPlans, new RegExp(`export function ${name}\\(`));
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.doesNotMatch(main, /function exportPsdShapePathMask\(/);
  assert.match(main, /createPsdExportController\(\{/);
  assert.match(main, /vectors: \{ exportPsdVectorMask \}/);
  assert.match(main, /prepareDocument: preparePsdExport/);
  for (const name of [
    'psdExportBounds','renderPsdLayerPixels','renderPsdMaskPixels',
    'nativeHighDepthPsdSource','highDepthCompositePlan','buildHighDepthComposite',
    'cmykNativeExportEligibility','buildNativeCmykComposite','preparePsdExport',
  ]) assert.doesNotMatch(main, new RegExp(`(?:async\\s+)?function ${name}\\(`));

  assert.match(main, /from '\.\/document\/psd-import-controller\.js'/);
  assert.match(build, /'src\/document\/psd-import-controller\.js'/);
  assert.match(psdImportController, /export function createPsdImportController/);
  assert.match(main, /createPsdImportController\(\{/);
  assert.match(main, /openPsd:psdImportController\.open/);
  assert.doesNotMatch(main, /async function openPsd\(file\)/);
  assert.match(psdImportController, /runtime\.getDocument\(\)!==targetDocument/);
  assert.match(psdImportController, /runtime\.publishDocument\(next,\{label:'Импорт PSD\/PSB'\}\)/);
  assert.match(main, /from '\.\/document\/psd-import-semantics\.js'/);
  assert.match(build, /'src\/document\/psd-import-semantics\.js'/);
  assert.match(psdImportSemantics, /export function createPsdImportSemantics/);
  assert.match(main, /const psdImportSemantics = createPsdImportSemantics\(\{/);
  assert.match(main, /semantics: psdImportSemantics/);
  for (const name of [
    'canMapPsdSolidShape','importPsdShapeMetadata','importPsdTextMetadata',
    'importPsdAdjustmentMetadata','psdEmbeddedAssetMime','importPsdNestedDocument',
    'importPsdEmbeddedAssetDocument','importPsdSmartObjectMetadata',
  ]) {
    assert.match(psdImportSemantics, new RegExp(`(?:async\\s+)?function ${name}\\(`));
    assert.doesNotMatch(main, new RegExp(`(?:async\\s+)?function ${name}\\(`));
  }
  assert.match(main, /function importPsdVectorMask\(/);
  assert.match(main, /function psdOpaqueBlockToState\(/);
  assert.doesNotMatch(psdImportSemantics, /function importPsdVectorMask\(/);
  assert.doesNotMatch(psdImportSemantics, /function psdOpaqueBlockToState\(/);
  assert.doesNotMatch(psdImportSemantics, /psd-native-metadata-plans\.js/);
  assert.match(main, /previewFingerprint: psdPreviewFingerprint/);
  assert.match(main, /embeddedDocumentFingerprint: psdEmbeddedDocumentFingerprint/);

});

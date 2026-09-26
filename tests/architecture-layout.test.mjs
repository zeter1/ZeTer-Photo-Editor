import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [main, build, legacyPsd, legacyToolLayout, project, workspaceSessions, workspaceRecovery, toolbarController, menuController, modalController, workspaceLayoutController, pathsController, colorManagementController, pointerLifecycleRouter, selectionGestureController, selectionClipboardController, selectionRasterMutationController, documentImportController, paintingController, paintCommandController, paintGestureController, retouchController, psdExportController, psdImportController] = await Promise.all([
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
  readFile(new URL('src/ui/paths-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/color-management-controller.js', root), 'utf8'),
  readFile(new URL('src/interaction/pointer-lifecycle-router.js', root), 'utf8'),
  readFile(new URL('src/selection/gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/selection/clipboard-controller.js', root), 'utf8'),
  readFile(new URL('src/selection/raster-mutation-controller.js', root), 'utf8'),
  readFile(new URL('src/document/import-controller.js', root), 'utf8'),
  readFile(new URL('src/painting/controller.js', root), 'utf8'),
  readFile(new URL('src/painting/command-controller.js', root), 'utf8'),
  readFile(new URL('src/painting/gesture-controller.js', root), 'utf8'),
  readFile(new URL('src/retouch/controller.js', root), 'utf8'),
  readFile(new URL('src/document/psd-export-controller.js', root), 'utf8'),
  readFile(new URL('src/document/psd-import-controller.js', root), 'utf8'),
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
  assert.match(build, /'src\/document\/psd-export-controller\.js'/);
  assert.match(psdExportController, /export function createPsdExportController/);
  assert.match(main, /createPsdExportController\(\{/);
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

});

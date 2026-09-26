import { HistoryStack } from './core/history.js';
import { fitZoom, layerFrame, frameBounds, hitLayerHandle, normalizeRect, constrainedRect, pointInLayer, layerPixelToDocumentPoint, resizeLayerFromPoint, rotationHandlePoint, rotationFromDrag, snapLineEnd, snapLayerMove, alignLayerToCanvas, selectionPixelBounds, selectionBounds, selectionPathPoints, pointInSelection, clamp } from './core/geometry.js';
import {
  createDocument, createRasterLayer, createShapeLayer, linkedSmartObjectLayers, createAdjustmentLayer, createVectorMask, createLayerGroup,
  addLayer, removeLayer, duplicateLayer, moveLayer, addLayerGroup, removeLayerGroup, moveLayerIntoGroup, moveLayerGroupIntoGroup, selectedLayer,
  snapshotDocument, restoreDocument, sanitizeProject, touch, checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION, DEFAULT_LAYER_FILTERS, FILTER_RANGES, sanitizeFilters, sanitizeHighDepthPreview, sanitizeColorManagement,
  isLayerVisible, isLayerLocked, isGroupLocked, groupDepth,
} from './core/state.js';
import { renderDocument, renderLayer, compositeToBlob, invalidateImageCache, clearImageCache } from './core/render.js';
import { readFileAsDataURL, readFileAsText, dimensionsFromDataUrl, canvasToDataURL, downloadBlob, downloadText, safeFilename, bytesToDataUrl, dataUrlToBytes } from './core/io.js';
import { hexToRgb } from './core/pixels.js';
import { pixelBufferToRgba8Preview, serializePixelBufferSource, deserializePixelBufferSource, pixelBufferToToneMappedRgba8Preview, clonePixelBuffer, pixelBufferWithStraightAlpha, pixelBufferByteLength, applyPixelBufferBrushDab, applyPixelBufferStrokeSegment, applyCmykPixelBufferBrushDab, applyCmykPixelBufferStrokeSegment, MAX_PIXEL_BUFFER_SOURCE_BYTES } from './core/pixel-buffer.js';
import { createCmykToSrgbTransform, createSrgbToCmykTransform, createCmykSoftProofTransform, inspectCmykIccProfile, inspectDisplayIccProfile, cmykPixelBufferToRgba8Preview } from './core/color-management.js';
import { saveRecoverySnapshot, loadRecoverySnapshots, clearRecoverySnapshot } from './core/recovery.js';
import {
  TOOL_LABELS, RASTER_BRUSH_TOOLS,
  SELECTION_TYPE_LABELS, SELECTION_TYPES, MIME_EXT,
  COLOR_CORRECTION_CONTROLS, COLOR_CORRECTION_KEYS,
  BASIC_EFFECT_CONTROLS, RASTER_EFFECT_CONTROLS,
  SMART_SNAP_STORAGE_KEY, TOOL_ORDER_STORAGE_KEY,
  NATIVE_HIGH_DEPTH_PAINT_TOOLS, NATIVE_CMYK_PAINT_TOOLS,
} from './ui/tool-config.js';
import { sanitizeAdjustmentModel, adjustmentModelEqual } from './core/adjustments.js';
import { decodePsd, encodePsdBlob, encodePsbBlob, isPsdFile } from './formats/psd.js';
import { createDocumentSessionController } from './workspace/session-controller.js';
import { createRecoveryController } from './workspace/recovery-controller.js';
import { createToolbarController } from './ui/toolbar-controller.js';
import { createWorkspaceLayoutController } from './ui/workspace-layout-controller.js';
import { createLayersPanelController } from './ui/layers-panel-controller.js';
import { createPathsController } from './ui/paths-controller.js';
import { createColorManagementController } from './ui/color-management-controller.js';
import { createSmartFilterController } from './ui/smart-filter-controller.js';
import { createLayerBlendingController } from './ui/layer-blending-controller.js';
import { createTextEditController } from './ui/text-edit-controller.js';
import { createTextSettingsController, TEXT_WEIGHT_OPTIONS, TEXT_STYLE_OPTIONS, TEXT_ALIGN_OPTIONS } from './ui/text-settings-controller.js';
import { createMenuController } from './ui/menu-controller.js';
import { createModalController } from './ui/modal-controller.js';
import { createPointerLifecycleRouter } from './interaction/pointer-lifecycle-router.js';
import { createSelectionGestureController, cloneSelectionShape } from './selection/gesture-controller.js';
import { createSelectionClipboardController } from './selection/clipboard-controller.js';
import { createSelectionRasterMutationController } from './selection/raster-mutation-controller.js';
import { createSelectionMaskController } from './selection/mask-controller.js';
import { createSelectionVectorMaskController } from './selection/vector-mask-controller.js';
import { createDocumentImportController } from './document/import-controller.js';
import { createSmartObjectController } from './document/smart-object-controller.js';
import { createPsdSmartObjectResource } from './document/psd-smart-object-resource.js';
import { createPsdImportController } from './document/psd-import-controller.js';
import { createPsdImportSemantics } from './document/psd-import-semantics.js';
import { createPsdExportController } from './document/psd-export-controller.js';
import { psdAdjustmentNativePlan, psdEmbeddedDocumentFingerprint, psdPreviewFingerprint, psdShapeNativePlan, psdTextNativePlan } from './document/psd-native-metadata-plans.js';
import { createRasterEditController } from './painting/controller.js';
import { createRasterCommandController } from './painting/command-controller.js';
import { createPaintGestureController } from './painting/gesture-controller.js';
import { createRetouchController } from './retouch/controller.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  canvas: $('#editorCanvas'), overlay: $('#overlayCanvas'), shell: $('#canvasShell'), viewport: $('#stageViewport'),
  title: $('#documentTitle'), tabs: $('#docTabs'), addTab: $('#addDocTabBtn'), dimensions: $('#docDimensions'), zoomLabel: $('#zoomLabel'), zoomRange: $('#zoomRange'),
  status: $('#statusText'), pointer: $('#pointerInfo'), layers: $('#layersList'), paths: $('#pathsList'), history: $('#historyList'), props: $('#propertiesContent'), effects: $('#effectsContent'), emptyDrop: $('#emptyDrop'),
  blend: $('#blendMode'), layerOpacity: $('#layerOpacity'), undo: $('#undoBtn'), redo: $('#redoBtn'),
  primaryColor: $('#primaryColor'), colorChip: $('#colorChip'), brushSize: $('#brushSize'), brushSizeValue: $('#brushSizeValue'), selectionType: $('#selectionType'), selectionCopyMode: $('#selectionCopyMode'),
  toolOpacity: $('#toolOpacity'), toolOpacityValue: $('#toolOpacityValue'), dodgeStrength: $('#dodgeStrength'), dodgeStrengthValue: $('#dodgeStrengthValue'), burnStrength: $('#burnStrength'), burnStrengthValue: $('#burnStrengthValue'), blurStrength: $('#blurStrength'), blurStrengthValue: $('#blurStrengthValue'), smudgeStrength: $('#smudgeStrength'), smudgeStrengthValue: $('#smudgeStrengthValue'), fillTolerance: $('#fillTolerance'), fillToleranceValue: $('#fillToleranceValue'), secondaryColor: $('#secondaryColor'), gradientType: $('#gradientType'), penClosed: $('#penClosed'), fontFamily: $('#fontFamily'), fontSize: $('#fontSize'), shapeKind: $('#shapeKind'),
  smartSnapToggle: $('#smartSnapToggle'),
  toolLabel: $('#toolLabel'), menu: $('#menuPopover'), modalRoot: $('#modalRoot'), fileInput: $('#fileInput'), projectInput: $('#projectInput'),
  dropOverlay: $('#dropOverlay'), toastRegion: $('#toastRegion'), workspace: $('.workspace'), toolbar: $('.toolbar'), rightPanel: $('.right-panel'),
};

let doc = createDocument();
let history = new HistoryStack(80);
let zoom = 0.75;
let documentSessions = [];
let activeSessionId = '';
let currentTool = 'move';
let renderVersion = 0;
let renderFrame = 0;
let renderBusy = false;
let renderPending = null;
const renderBuffer = document.createElement('canvas');
let dirty = false;
let documentChangeSerial = 0;
let drag = null;
let penDraft = null;
let vectorMaskEditLayerId = null;
let documentPathEditIndex = -1;
let spaceHeld = false;
let cropRect = null;
let selectionRect = null;
let selectionShape = null;
let selectionCopyMode = 'merged';
let dragDepth = 0;
let pointerLifecycle = null;
let paintPersisting = false;
let hoverPoint = null;
let smartSnapEnabled = true;
let smartGuides = { x:null, y:null };

function setStatus(message) { els.status.textContent = message; }

const colorManagementController = createColorManagementController({
  state: { getDocument: () => doc, commit },
  color: {
    sanitizeColorManagement,
    createCmykToSrgbTransform,
    createSrgbToCmykTransform,
    createCmykSoftProofTransform,
    inspectCmykIccProfile,
    inspectDisplayIccProfile,
  },
  pixels: { deserializePixelBufferSource, cmykPixelBufferToRgba8Preview },
  io: { dataUrlToBytes, bytesToDataUrl, rgbaPixelsToDataUrl },
  render: { invalidateImageCache },
  ui: { setStatus, toast, consoleRef:console },
  FileCtor: File,
});
const {
  profileBytes: colorProfileBytes,
  currentCmykPreviewTransform,
  rgb8ToDocumentCmyk,
  bindControls: bindColorManagementControls,
} = colorManagementController;

const selectionMaskController = createSelectionMaskController({
  state: {
    getDocument: () => doc,
    getSelectedLayer: selected,
    commit,
  },
  selection: {
    getSelectionShape: () => selectionShape ? cloneSelectionShape(selectionShape) : null,
    traceDocumentSelectionPath,
    selectionPolygonForLayer,
  },
  rendering: {
    renderLayer,
    getSourceCanvas: () => els.canvas,
  },
  ui: {
    showModal: options => showModal(options),
    setStatus,
    toast,
    documentRef: document,
    FormDataClass: FormData,
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id),
    consoleRef: console,
  },
});
const {
  selectionMaskDataUrl,
  addSelectedLayerMask,
  refineSelectionToLayerMask,
  removeSelectedLayerMask,
} = selectionMaskController;

const smartFilterController = createSmartFilterController({
  state: {
    getDocument: () => doc,
    getSelectedLayer: selected,
    commit,
    markDirty,
    blockPendingDocumentEdit,
  },
  selection: {
    getSelectionShape: () => selectionShape,
    selectionMaskDataUrl,
  },
  renderApi: {
    render,
    refreshInspectorPanels,
  },
  ui: {
    modalRoot: els.modalRoot,
    documentRef: document,
    setStatus,
    toast,
    escapeHtml,
    formatFilterValue,
  },
});
const {
  smartFilterStackMarkup,
  hasSmartFilterCapacity,
  moveSmartFilter,
  toggleSmartFilter,
  removeSmartFilter,
  clearSmartFilters,
  setSmartFilterMask,
  toggleSmartFilterMask,
  invertSmartFilterMask,
  removeSmartFilterMask,
  bindSmartFilterControls,
  openSmartFilterDialog,
} = smartFilterController;

const layerBlendingController = createLayerBlendingController({
  state: {
    getDocument: () => doc,
    commit,
    markTransientChange: () => { documentChangeSerial += 1; },
    blockPendingDocumentEdit,
  },
  renderApi: { render, updateLayerControls, getSourceCanvas: () => els.canvas },
  ui: {
    modalRoot: els.modalRoot,
    blendControl: els.blend,
    documentRef: document,
    windowTarget: window,
    ResizeObserverClass: globalThis.ResizeObserver,
    HTMLElementClass: globalThis.HTMLElement,
    setStatus,
    escapeHtml,
  },
});
const { openBlendingOptions } = layerBlendingController;

const workspaceLayoutController = createWorkspaceLayoutController({
  panelCards: $$('.panel-card[data-panel-id]'),
  workspace: els.workspace,
  toolbar: els.toolbar,
  rightPanel: els.rightPanel,
  viewport: els.viewport,
  overlay: els.overlay,
  getZoom: () => zoom,
  clientPointToCanvas,
  setStatus,
});
const { initCollapsiblePanels, togglePanels } = workspaceLayoutController;

const rasterEdit = createRasterEditController({
  getDocument: () => doc,
  getDrag: () => drag,
  getCmykPreviewTransform: () => currentCmykPreviewTransform(),
  renderPaintPreview: () => render({ paintPreview: true }),
  documentRef: document,
});

const rasterCommands = createRasterCommandController({
  rasterEdit,
  state: {
    getDocument: () => doc,
    isPersisting: () => paintPersisting,
    beginPersist: () => {
      if (paintPersisting) return false;
      paintPersisting = true;
      return true;
    },
    endPersist: () => { paintPersisting = false; },
    resetPaintState: () => {
      rasterEdit.clearHighDepthPaintState();
      retouchController.resetStroke();
    },
  },
  target: {
    selected,
    isEditableRasterLayer,
    atPoint: paintLayerAtPoint,
    toLocal: documentPointToLayerPixel,
  },
  selection: {
    hasActive: () => Boolean(selectionRect),
    containsPoint: pointInsideSelection,
    intersectsLayer: selectionIntersectsLayer,
    predicate: rasterSelectionPredicate,
    clipContext: clipContextToSelection,
  },
  tools: {
    primaryColor: () => els.primaryColor.value,
    brushSize: () => Number(els.brushSize.value) || 1,
    opacity: () => Number(els.toolOpacity.value) / 100,
    fillTolerance: () => Number(els.fillTolerance?.value) || 0,
    rgbToCmyk: rgb8ToDocumentCmyk,
  },
  ui: { setStatus, toast, render, commit },
});
const {
  drawLine: drawLineOnCurrentRaster,
  fillAt: fillAtPoint,
  clearSelection: clearSelectedPixels,
} = rasterCommands;

const selectionRasterMutations = createSelectionRasterMutationController({
  rasterEdit,
  state: {
    getDocument: () => doc,
    getActiveSessionId: () => activeSessionId,
    getSelectedLayer: selected,
    isPersisting: () => paintPersisting,
    beginPersist: () => {
      if (paintPersisting) return false;
      paintPersisting = true;
      return true;
    },
    endPersist: () => { paintPersisting = false; },
    blockPendingDocumentEdit,
  },
  selection: {
    hasActive: () => Boolean(selectionRect),
    intersectsLayer: selectionIntersectsLayer,
    predicate: rasterSelectionPredicate,
    clipContext: clipContextToSelection,
  },
  ui: { setStatus, toast, render, commit },
  documentRef: document,
});
const {
  clearAcrossVisibleLayers: clearSelectionAcrossVisibleLayers,
  rasterizeSelectedLayer,
} = selectionRasterMutations;

const toolbarController = createToolbarController({
  toolbar: els.toolbar,
  setStatus,
});
const { initReorder:initToolbarReorder, initTooltips } = toolbarController;
const menuController = createMenuController({
  menu: els.menu,
  viewport: els.viewport,
  menuButtons: $$('.menu-button'),
  getItems: key => menus[key] || [],
  escapeHtml,
  toast,
});
const { closeMenu, openContextMenu } = menuController;
menuController.init();

const layersPanelController = createLayersPanelController({
  container: els.layers,
  state: {
    getDocument: () => doc,
    selectLayer: (owner, layerId, { refresh = true } = {}) => {
      if (doc !== owner || !owner.layers.some(layer => layer.id === layerId)) return false;
      owner.selectedLayerId = layerId;
      if (refresh) updateAll();
      return true;
    },
  },
  actions: {
    layer: {
      toggleVisibility: (owner, layerId) => {
        if (doc !== owner) return false;
        const layer = owner.layers.find(item => item.id === layerId);
        if (!layer) return false;
        layer.visible = !layer.visible;
        commit(layer.visible ? 'Показать слой' : 'Скрыть слой');
        return true;
      },
      toggleLock: (owner, layerId) => {
        if (doc !== owner) return false;
        const layer = owner.layers.find(item => item.id === layerId);
        if (!layer) return false;
        const group = layer.groupId ? owner.groups?.find(item => item.id === layer.groupId) : null;
        if (group && isGroupLocked(owner, group)) return false;
        layer.locked = !layer.locked;
        commit(layer.locked ? 'Заблокировать слой' : 'Разблокировать слой');
        return true;
      },
      rename: (owner, layerId) => {
        if (doc !== owner) return false;
        const layer = owner.layers.find(item => item.id === layerId);
        if (!layer) return false;
        renameLayer(layer);
        return true;
      },
      remove: (owner, layerId) => {
        if (doc !== owner || blockPendingDocumentEdit()) return false;
        const layer = owner.layers.find(item => item.id === layerId);
        if (!layer) return false;
        if (isLayerLocked(owner, layer)) {
          setStatus('Слой или его группа заблокированы');
          return false;
        }
        removeLayer(owner, layer.id);
        commit('Удалить слой');
        return true;
      },
      openSmartObject: (owner, layerId) => {
        if (doc !== owner) return false;
        const layer = owner.layers.find(item => item.id === layerId);
        if (!layer) return false;
        openSmartObjectContents(layer);
        return true;
      },
      openContextMenu: (owner, layerId, event) => {
        if (doc !== owner || blockPendingDocumentEdit()) return false;
        const layer = owner.layers.find(item => item.id === layerId);
        if (!layer) return false;
        if (owner.selectedLayerId !== layerId) {
          owner.selectedLayerId = layerId;
          updateAll();
        }
        openContextMenu('layer:' + layerId, layerContextMenu(layerId), event, layersPanelController.getLayerRow(layerId));
        return true;
      },
    },
    group: {
      toggleVisibility: (owner, groupId) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group) return false;
        group.visible = group.visible === false;
        commit(group.visible ? 'Показать группу слоёв' : 'Скрыть группу слоёв');
        return true;
      },
      toggleLock: (owner, groupId) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group) return false;
        const parent = group.parentGroupId ? owner.groups?.find(item => item.id === group.parentGroupId) : null;
        if (parent && isGroupLocked(owner, parent)) return false;
        group.locked = !group.locked;
        commit(group.locked ? 'Заблокировать группу слоёв' : 'Разблокировать группу слоёв');
        return true;
      },
      rename: (owner, groupId) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group) return false;
        renameGroup(group);
        return true;
      },
      remove: (owner, groupId) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group) return false;
        deleteLayerGroup(group);
        return true;
      },
      openContextMenu: (owner, groupId, event, row) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group) return false;
        openContextMenu('group:' + groupId, groupContextMenu(groupId), event, row);
        return true;
      },
    },
    drag: {
      moveLayerRelative: (owner, layerId, targetId, aboveInDisplay) => {
        if (doc !== owner || !moveLayerRelativeToTarget(layerId, targetId, aboveInDisplay)) return false;
        commit('Изменить порядок слоёв');
        return true;
      },
      moveLayerIntoGroup: (owner, layerId, groupId) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group || !moveLayerIntoGroup(owner, layerId, groupId)) return false;
        group.collapsed = false;
        commit('Переместить слой в группу');
        return true;
      },
      moveGroupIntoGroup: (owner, groupId, targetGroupId) => {
        if (doc !== owner) return false;
        const target = owner.groups?.find(item => item.id === targetGroupId);
        if (!target || !moveLayerGroupIntoGroup(owner, groupId, targetGroupId)) return false;
        target.collapsed = false;
        commit('Переместить группу в группу');
        return true;
      },
      moveLayerToRoot: (owner, layerId) => {
        if (doc !== owner || !moveLayerToRootTop(layerId)) return false;
        commit('Вынести слой из группы');
        return true;
      },
      moveGroupToRoot: (owner, groupId) => {
        if (doc !== owner || !moveLayerGroupIntoGroup(owner, groupId, null)) return false;
        commit('Вынести группу на верхний уровень');
        return true;
      },
    },
  },
  ui: { setStatus, requestFrame: callback => requestAnimationFrame(callback), documentRef: document },
});


const textSettingsController = createTextSettingsController({
  fontFamilyControl: els.fontFamily,
  fontSizeControl: els.fontSize,
  primaryColorControl: els.primaryColor,
  windowTarget: window,
  documentRef: document,
  FileClass: File,
});

const modalController = createModalController({
  modalRoot: els.modalRoot,
  escapeHtml,
  setStatus,
  toast,
  loadComputerFonts: textSettingsController.loadComputerFonts,
});
const { showModal, showInfoModal, showRecoveryModal } = modalController;
const textEditController = createTextEditController({
  state: {
    getDocument: () => doc,
    getSelectedLayer: selected,
    selectLayer: (documentValue, layer) => { documentValue.selectedLayerId = layer.id; },
    addLayer,
    commit,
  },
  text: {
    fields: textSettingsController.modalFields,
    settingsFromForm: textSettingsController.settingsFromForm,
  },
  renderApi: {
    render,
    updateLayers: () => layersPanelController.render(),
    refreshInspectorPanels,
    drawOverlay,
    getSourceCanvas: () => renderBuffer,
    getZoom: () => zoom,
    getToolOpacity: () => Number(els.toolOpacity.value) / 100,
  },
  ui: {
    showModal,
    setStatus,
    toast,
    documentRef: document,
    windowTarget: window,
    ResizeObserverClass: window.ResizeObserver,
    FormDataClass: window.FormData,
  },
});

const selectionVectorMaskController = createSelectionVectorMaskController({
  state: {
    getDocument: () => doc,
    getSelectedLayer: selected,
    commit,
  },
  selection: {
    getSelectionShape: () => selectionShape,
  },
  geometry: {
    documentPointToLayer: documentPointToLayerPixel,
  },
  edit: {
    beginVectorMaskEdit: layerId => {
      documentPathEditIndex = -1;
      vectorMaskEditLayerId = layerId;
      setTool('pen');
      drawOverlay();
    },
    clearVectorMaskEdit: layerId => {
      if (layerId == null || vectorMaskEditLayerId === layerId) vectorMaskEditLayerId = null;
    },
  },
  ui: { setStatus, toast },
});
const {
  selectionVectorMaskDocumentNodes,
  applySelectionToVectorMask,
  editSelectedVectorMask,
  toggleSelectedVectorMask,
  invertSelectedVectorMask,
  removeSelectedVectorMask,
} = selectionVectorMaskController;

const pathsController = createPathsController({
  state: {
    getDocument: () => doc,
    getSelectedLayer: selected,
    getSelectionShape: () => selectionShape,
    isLayerLocked: layer => isLayerLocked(doc, layer),
    commit,
  },
  vectors: {
    exportVectorMask: exportPsdVectorMask,
    importVectorMask: importPsdVectorMask,
    layerPixelToDocumentPoint,
    selectionDocumentNodes: selectionVectorMaskDocumentNodes,
  },
  edit: {
    beginPathEdit: index => {
      vectorMaskEditLayerId = null;
      documentPathEditIndex = index;
      setTool('pen');
      documentPathEditIndex = index;
      drawOverlay();
    },
    syncPathEditSelection: index => {
      if (documentPathEditIndex >= 0 && currentTool === 'pen') documentPathEditIndex = index;
    },
    onPathDeleted: index => {
      if (documentPathEditIndex === index) documentPathEditIndex = -1;
      else if (documentPathEditIndex > index) documentPathEditIndex -= 1;
    },
    normalizePathEditIndex: pathCount => {
      if (documentPathEditIndex >= pathCount) documentPathEditIndex = -1;
    },
    clearVectorMaskEdit: () => { vectorMaskEditLayerId = null; },
    drawOverlay,
  },
  ui: {
    setStatus,
    toast,
    showModal,
    openContextMenu,
    pathList: els.paths,
    controls: {
      add: $('#addPathBtn'),
      edit: $('#editPathBtn'),
      applyMask: $('#applyPathMaskBtn'),
      rename: $('#renamePathBtn'),
      duplicate: $('#duplicatePathBtn'),
      delete: $('#deletePathBtn'),
    },
    documentRef: document,
  },
});
const { updatePathsPanel } = pathsController;

const psdExportController = createPsdExportController({
  vectors: { exportPsdVectorMask },
  rendering: {
    createCanvas: () => document.createElement('canvas'),
    renderLayer,
    renderDocument,
  },
});
const { prepareDocument: preparePsdExport } = psdExportController;

const psdSmartObjectResource = createPsdSmartObjectResource({
  prepareDocument: preparePsdExport,
  opaqueBlockToState: psdOpaqueBlockToState,
});

const psdImportSemantics = createPsdImportSemantics({
  decodePsd,
  rgbaPixelsToDataUrl,
  dimensionsFromDataUrl,
  importVectorMask: importPsdVectorMask,
  opaqueBlockToState: psdOpaqueBlockToState,
  previewFingerprint: psdPreviewFingerprint,
  embeddedDocumentFingerprint: psdEmbeddedDocumentFingerprint,
});

const psdImportController = createPsdImportController({
  codec: { decodePsd },
  runtime: {
    getDocument: () => doc,
    getActiveSessionId: () => activeSessionId,
    getHistoryEntry: () => history.current(),
    getChangeSerial: () => documentChangeSerial,
    canReplaceDocument,
    blockPendingDocumentEdit,
    publishDocument: (next,{label}) => {
      history=new HistoryStack(80);
      setDoc(next,{resetHistory:true,label});
      markDirty(true);
      queueRecovery({immediate:true});
      fitToView();
    },
  },
  profiles: { profileBytes: colorProfileBytes },
  rendering: { rgbaPixelsToDataUrl },
  semantics: psdImportSemantics,
  ui: { setStatus, toast, alert, consoleRef:console },
});

const documentImportController = createDocumentImportController({
  getDocument: () => doc,
  getActiveSessionId: () => activeSessionId,
  isPsdFile,
  readFileAsDataURL,
  dimensionsFromDataUrl,
  checkedCanvasSize,
  createRasterLayer,
  addLayer,
  blockPendingDocumentEdit,
  commit,
  setStatus,
  toast,
  fitToView,
  visibleCanvasCenter,
  openPsd:psdImportController.open,
  openProject,
  resetBrushBuffer: rasterEdit.clearBrushBuffer,
});
const { isImageFile, isProjectFile, importImages, handleIncomingFiles } = documentImportController;

const selectionClipboardController = createSelectionClipboardController({
  getDocument: () => doc,
  getActiveSessionId: () => activeSessionId,
  getSelectionRect: () => selectionRect,
  getCopyMode: () => selectionCopyMode,
  getSelectedLayer: selected,
  isEditableRasterLayer,
  clipContextToDocumentSelection,
  clearSelectionAcrossVisibleLayers,
  clearSelectedPixels,
  clearSelectionState,
  setTool,
  setStatus,
  toast,
  importImages,
  visibleCanvasCenter,
  isImageFile,
});
const { copySelection, cutSelection, pasteFromClipboard, armPasteShortcutFallback, handleNativePasteEvent } = selectionClipboardController;

const retouchController = createRetouchController({
  getBrushCanvas: () => rasterEdit.brushCanvas,
  getBrushContext: () => rasterEdit.brushContext,
  getDrag: () => drag,
  getHighDepthPaintBuffer: () => rasterEdit.highDepthPaintBuffer,
  getHighDepthPaintLayerId: () => rasterEdit.highDepthPaintLayerId,
  markHighDepthPreviewDirty: rasterEdit.markHighDepthPreviewDirty,
  brushWidthForPointer,
  rasterSelectionPredicate,
  schedulePaintPreview: rasterEdit.schedulePaintPreview,
  getToolOpacity: () => Number(els.toolOpacity.value) / 100,
  getSmudgeStrength: () => Number(els.smudgeStrength?.value || 45) / 100,
  getDodgeStrength: () => Number(els.dodgeStrength.value) / 100,
  getBurnStrength: () => Number(els.burnStrength.value) / 100,
  getBlurStrength: () => Number(els.blurStrength.value) / 100,
  documentRef: document,
});
const {
  getCloneSource:getRetouchCloneSource,
  setCloneSource:setRetouchCloneSource,
  resetStroke:resetRetouchStroke,
} = retouchController;

const paintGesture = createPaintGestureController({
  rasterEdit,
  retouch: retouchController,
  state: {
    getDocument: () => doc,
    getDrag: () => drag,
    setDrag: value => { drag = value; },
    beginPersist: () => {
      if (paintPersisting) return false;
      paintPersisting = true;
      return true;
    },
    endPersist: () => { paintPersisting = false; },
  },
  target: {
    selected,
    atPoint: paintLayerAtPoint,
    toLocal: documentPointToLayerPixel,
  },
  selection: {
    containsPoint: point => !selectionRect || pointInsideSelection(point),
    clipContext: clipContextToSelection,
  },
  tools: {
    brushWidth: brushWidthForPointer,
    primaryColor: () => els.primaryColor.value,
    opacity: () => Number(els.toolOpacity.value) / 100,
  },
  nativePaint: {
    dab: applyNativeHighDepthDab,
    segment: nativeHighDepthStrokeSegment,
  },
  ui: { setStatus, toast, render, commit },
});

function toast(message, tone = '') {
  const item = document.createElement('div');
  item.className = `toast${tone ? ` ${tone}` : ''}`;
  item.textContent = message;
  els.toastRegion.append(item);
  setTimeout(() => item.remove(), 3000);
}

function readSmartSnapState() {
  try {
    const saved = localStorage.getItem(SMART_SNAP_STORAGE_KEY);
    smartSnapEnabled = saved === null ? true : saved !== 'false';
  } catch (error) {
    console.warn('Could not restore smart snap setting', error);
    smartSnapEnabled = true;
  }
  if (els.smartSnapToggle) els.smartSnapToggle.checked = smartSnapEnabled;
}
function persistSmartSnapState() {
  try { localStorage.setItem(SMART_SNAP_STORAGE_KEY, String(smartSnapEnabled)); }
  catch (error) { console.warn('Could not persist smart snap setting', error); }
}
function clearSmartGuides() { smartGuides = { x:null, y:null }; }
const selectionGestures = createSelectionGestureController({
  selectionTypes: SELECTION_TYPES,
  selectionTypeLabels: SELECTION_TYPE_LABELS,
  geometry: { clamp, constrainedRect, normalizeRect, selectionBounds },
  selection: {
    getShape: () => selectionShape,
    setShape: shape => setSelectionShape(shape),
    setPreviewShape: shape => setSelectionPreviewShape(shape),
  },
  runtime: {
    getCurrentTool: () => currentTool,
    getZoom: () => zoom,
    getDocument: () => doc,
    getCanvasContext: () => els.canvas.getContext('2d', { alpha:true }),
  },
  ui: {
    setSelectionTypeValue: value => { if (els.selectionType) els.selectionType.value = value; },
    updateToolLabel: () => updateToolLabel(),
    setStatus,
    drawOverlay: () => drawOverlay(),
  },
});
let documentSessionController = null;
const recoveryController = createRecoveryController({
  storage: {
    save: saveRecoverySnapshot,
    loadAll: loadRecoverySnapshots,
    clear: clearRecoverySnapshot,
  },
  projects: {
    snapshot: snapshotDocument,
    sanitize: sanitizeProject,
  },
  sessions: {
    getAll: () => documentSessions,
    replaceAll: value => { documentSessions = value; },
    getActiveId: () => activeSessionId,
    setActiveId: value => { activeSessionId = value; },
    syncCurrent: () => documentSessionController?.syncCurrentSession(),
    build: (...args) => documentSessionController.buildSession(...args),
    load: session => documentSessionController.loadSession(session),
  },
  runtime: {
    updateAll,
    markDirty,
    startNewProject: () => createNewDialog(),
  },
  ui: {
    showRecoveryModal: (entries, options) => showRecoveryModal(entries, {
      ...options,
      onLoadProject: () => els.projectInput?.click(),
    }),
    setStatus,
    toast,
  },
});
const { queueRecovery, restoreRecoveryIfAvailable } = recoveryController;

documentSessionController = createDocumentSessionController({
  getSessions: () => documentSessions,
  getActiveSessionId: () => activeSessionId,
  setActiveSessionId: value => { activeSessionId = value; },
  getRuntimeState: () => ({
    doc, history, zoom, dirty, cropRect, selectionRect, selectionShape,
    selectedDocumentPathIndex: pathsController.getSelectedIndex(),
  }),
  applyRuntimeState: state => {
    doc = state.doc;
    history = state.history;
    zoom = state.zoom;
    dirty = state.dirty;
    cropRect = state.cropRect;
    selectionRect = state.selectionRect;
    selectionShape = state.selectionShape;
    pathsController.setSelectedIndex(state.selectedPathIndex);
    documentPathEditIndex = -1;
    vectorMaskEditLayerId = null;
    penDraft = null;
    selectionGestures.resetDrafts();
    drag = null;
    rasterEdit.reset();
    resetRetouchStroke();
    hoverPoint = null;
    pointerLifecycle?.releaseActivePointer();
    paintPersisting = false;
  },
  cloneSelectionShape,
  tabs: els.tabs,
  viewport: els.viewport,
  blockPendingDocumentEdit,
  updateAll,
  fitToView,
  setStatus,
  toast,
  queueRecovery,
  showModal,
  commit,
  openContextMenu,
});
const {
  currentSession,
  syncCurrentSession,
  loadSession,
  buildSession,
  renderDocumentTabs,
  activateDocumentTab,
  addDocumentTab,
  closeDocumentTab,
  renameDocumentTab,
  duplicateDocumentTab,
  documentTabMenu,
} = documentSessionController;


const smartObjectController = createSmartObjectController({
  runtime: {
    getDocument: () => doc,
    getActiveSessionId: () => activeSessionId,
    setActiveSessionId: value => { activeSessionId = value; },
    getSelectedLayer: selected,
    getZoom: () => zoom,
    blockPendingDocumentEdit,
    isLayerLocked,
    commit,
    updateAll,
    fitToView,
    queueRecovery,
    invalidateImageCache,
    setActiveDocument: value => { doc = value; },
    setDirty: value => { dirty = value; },
  },
  sessions: {
    getAll: () => documentSessions,
    current: currentSession,
    syncCurrent: syncCurrentSession,
    build: buildSession,
    load: loadSession,
    activate: activateDocumentTab,
    renderTabs: renderDocumentTabs,
  },
  rendering: {
    renderPreview: async embeddedDocument => {
      const canvas = document.createElement('canvas');
      await renderDocument(canvas, embeddedDocument, { checker:false });
      return canvasToDataURL(canvas, 'image/png');
    },
  },
  photoshop: {
    isLayer: layer => Boolean(layer?.psdSmartObject),
    sourceId: layer => layer?.psdSmartObject?.uniqueId || null,
    findLayers: (owner, uniqueId) => {
      if (!owner || !uniqueId) return [];
      return (owner.layers || []).filter(layer =>
        layer?.type === 'smart-object' && layer.psdSmartObject?.uniqueId === uniqueId
      );
    },
    rewriteEmbeddedSource: psdSmartObjectResource.rewriteEmbeddedSource,
    publishEmbeddedSourceRewrite: psdSmartObjectResource.publishEmbeddedSourceRewrite,
    updateTargetAfterRewrite: psdSmartObjectResource.updateTargetAfterRewrite,
  },
  ui: { setStatus, toast, consoleRef:console },
});
const {
  createLinkedCopy: createLinkedSmartObjectCopy,
  unlink: unlinkSmartObject,
  convertSelected: convertSelectedToSmartObject,
  openContents: openSmartObjectContents,
  saveContent: saveSmartObjectContent,
} = smartObjectController;


function isEditingTarget(target = document.activeElement) {
  const tag = target?.tagName;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target?.isContentEditable;
}
function isInteractiveControlTarget(target = document.activeElement) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a[href], [role=\"button\"], [role=\"menuitem\"], [role=\"option\"]'));
}
function markDirty(value = true) {
  if(value)documentChangeSerial+=1;
  dirty = value;
  const session = currentSession();
  if (session) session.dirty = value;
  renderDocumentTabs();
  if (value) queueRecovery();
}
function documentEditPending() {
  return paintPersisting || Boolean(drag && !['pan','marquee'].includes(drag.kind)) ||
    (pointerLifecycle?.hasActivePointer() && (RASTER_BRUSH_TOOLS.has(currentTool) || currentTool === 'fill'));
}
function blockPendingDocumentEdit() {
  if (!documentEditPending()) return false;
  const message = 'Дождитесь завершения операции редактирования и повторите команду';
  setStatus(message);
  toast(message, 'warn');
  return true;
}
function setDoc(next, { resetHistory = false, label = 'Состояние' } = {}) {
  doc = next;
  cropRect = null;
  pathsController.setSelectedIndex(-1);
  documentPathEditIndex = -1;
  vectorMaskEditLayerId = null;
  penDraft = null;
  clearSelectionState();
  rasterEdit.reset();
  if (resetHistory) { clearImageCache(); history.reset(label, snapshotDocument(doc)); }
  updateAll();
}
function commit(label) {
  touch(doc);
  const snapshot = snapshotDocument(doc);
  history.push(label, snapshot);
  markDirty(true);
  updateAll();
}
function selected() { return selectedLayer(doc); }
function isEditableRasterLayer(layer) { return !!layer && layer.type === 'raster' && !isLayerLocked(doc, layer); }
function findTopEditableRasterLayerAt(point) { return [...doc.layers].reverse().find(layer => isLayerVisible(doc, layer) && isEditableRasterLayer(layer) && pointInLayer(point, layer)) ?? null; }
function paintLayerAtPoint(point) {
  const layer = selected();
  return isEditableRasterLayer(layer) && isLayerVisible(doc, layer) && pointInLayer(point, layer) ? layer : null;
}
function documentPointToLayerPixel(point, layer) {
  const width = Math.max(1, Number(layer.width) || 1);
  const height = Math.max(1, Number(layer.height) || 1);
  const scaleX = Number(layer.scaleX) || 1;
  const scaleY = Number(layer.scaleY) || 1;
  const boundsWidth = width * scaleX;
  const boundsHeight = height * scaleY;
  const cx = layer.x + boundsWidth / 2;
  const cy = layer.y + boundsHeight / 2;
  const radians = -((layer.rotation ?? 0) * Math.PI / 180);
  const dx = point.x - cx;
  const dy = point.y - cy;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const unrotatedX = cx + dx * cos - dy * sin;
  const unrotatedY = cy + dx * sin + dy * cos;
  const localScaledX = unrotatedX - layer.x;
  const localScaledY = unrotatedY - layer.y;
  return {
    x: localScaledX / scaleX,
    y: localScaledY / scaleY,
  };
}

function selectedEditablePathTargets(){
  if(documentPathEditIndex>=0){
    const path=doc.paths?.[documentPathEditIndex];
    if(path?.subpaths?.length){
      return path.subpaths
        .map((subpath,subpathIndex)=>({
          layer:null,points:Array.isArray(subpath?.points)?subpath.points:[],
          source:'document-path',documentPathIndex:documentPathEditIndex,subpathIndex,
          closed:subpath?.closed!==false,operation:subpath?.operation||'add',
        }))
        .filter(target=>target.points.length);
    }
    documentPathEditIndex=-1;
  }
  const layer=selected();
  if(!layer||!isLayerVisible(doc,layer))return[];
  if(vectorMaskEditLayerId===layer.id&&layer.vectorMask?.subpaths?.length){
    return layer.vectorMask.subpaths
      .map((subpath,subpathIndex)=>({
        layer,points:Array.isArray(subpath?.points)?subpath.points:[],
        source:'vector-mask',documentPathIndex:null,subpathIndex,closed:subpath?.closed!==false,operation:subpath?.operation||'add',
      }))
      .filter(target=>target.points.length);
  }
  if(layer.type==='shape'&&layer.shape==='path'&&Array.isArray(layer.pathPoints)){
    return[{layer,points:layer.pathPoints,source:'shape',documentPathIndex:null,subpathIndex:null,closed:Boolean(layer.pathClosed),operation:'add'}];
  }
  return[];
}
function pathTargetPoints(layer,source='shape',subpathIndex=null,documentPathIndex=null){
  if(source==='document-path')return doc.paths?.[documentPathIndex]?.subpaths?.[subpathIndex]?.points??null;
  if(source==='vector-mask')return layer?.vectorMask?.subpaths?.[subpathIndex]?.points??null;
  return layer?.pathPoints??null;
}
function pathControlDocumentPoint(layer,node,control='anchor'){
  const local=control==='anchor'?node:node?.[control];
  if(!local)return null;
  return layer?layerPixelToDocumentPoint(local,layer):{x:local.x,y:local.y};
}
function hitSelectedPathControl(point,radius=8/zoom){
  for(const target of selectedEditablePathTargets()){
    if(target.layer&&isLayerLocked(doc,target.layer))continue;
    for(let index=0;index<target.points.length;index+=1){
      const node=target.points[index];
      for(const control of ['handleIn','handleOut']){
        const p=pathControlDocumentPoint(target.layer,node,control);
        if(p&&Math.hypot(point.x-p.x,point.y-p.y)<=radius)return{...target,nodeIndex:index,control};
      }
    }
    for(let index=0;index<target.points.length;index+=1){
      const node=target.points[index],p=pathControlDocumentPoint(target.layer,node,'anchor');
      if(p&&Math.hypot(point.x-p.x,point.y-p.y)<=radius)return{...target,nodeIndex:index,control:'anchor'};
    }
  }
  return null;
}
function traceEditablePathTarget(ctx,target){
  const points=target?.points||[];
  if(!points.length)return false;
  const documentNodes=points.map(node=>({
    ...pathControlDocumentPoint(target.layer,node,'anchor'),
    handleIn:pathControlDocumentPoint(target.layer,node,'handleIn'),
    handleOut:pathControlDocumentPoint(target.layer,node,'handleOut'),
  }));
  ctx.moveTo(documentNodes[0].x,documentNodes[0].y);
  const segment=(from,to)=>{
    if(from.handleOut||to.handleIn){
      const cp1=from.handleOut||from,cp2=to.handleIn||to;
      ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,to.x,to.y);
    }else ctx.lineTo(to.x,to.y);
  };
  for(let index=1;index<documentNodes.length;index+=1)segment(documentNodes[index-1],documentNodes[index]);
  if(target.closed&&documentNodes.length>1){segment(documentNodes.at(-1),documentNodes[0]);ctx.closePath();}
  return true;
}
function drawSelectedPathControls(ctx){
  if(currentTool!=='pen'||penDraft)return;
  const targets=selectedEditablePathTargets();
  if(!targets.length)return;
  ctx.save();ctx.setLineDash([]);ctx.lineWidth=1/zoom;ctx.fillStyle='#f8fbff';
  for(const target of targets){
    const locked=target.layer?isLayerLocked(doc,target.layer):false;
    const vector=target.source==='vector-mask';
    const saved=target.source==='document-path';
    ctx.strokeStyle=locked?'#aeb6c4':saved?'#77e3b1':vector?'#ff78cf':'#8fc0ff';
    if(vector||saved){
      ctx.save();ctx.setLineDash([5/zoom,3/zoom]);ctx.beginPath();traceEditablePathTarget(ctx,target);ctx.stroke();ctx.restore();
    }
    for(const node of target.points){
      const anchor=pathControlDocumentPoint(target.layer,node,'anchor');
      if(!anchor)continue;
      for(const control of ['handleIn','handleOut']){
        const handle=pathControlDocumentPoint(target.layer,node,control);
        if(!handle)continue;
        ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(handle.x,handle.y);ctx.stroke();
        const size=5/zoom;ctx.fillRect(handle.x-size/2,handle.y-size/2,size,size);ctx.strokeRect(handle.x-size/2,handle.y-size/2,size,size);
      }
      ctx.beginPath();ctx.arc(anchor.x,anchor.y,4/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }
  ctx.restore();
}
function updatePenCursor(point){
  if(currentTool!=='pen'||drag||penDraft)return;
  els.overlay.style.cursor=hitSelectedPathControl(point)?'pointer':'crosshair';
}
function restorePathControlDrag(d){
  const layer=d.pathSource==='document-path'?null:doc.layers.find(item=>item.id===d.layerId);
  const points=pathTargetPoints(layer,d.pathSource,d.subpathIndex,d.documentPathIndex);
  if(!points?.[d.nodeIndex])return false;
  points[d.nodeIndex]=structuredClone(d.initial);
  render();drawOverlay();return true;
}
function beginPathControlDrag(hit,point,event){
  const points=pathTargetPoints(hit.layer,hit.source,hit.subpathIndex,hit.documentPathIndex);
  const node=points?.[hit.nodeIndex];
  if(!node)return false;
  if(hit.control==='anchor'&&event.altKey){
    const changed=Boolean(node.handleIn||node.handleOut||node.kind==='smooth');
    node.handleIn=null;node.handleOut=null;node.kind='corner';
    if(changed)commit(hit.source==='document-path'?'Преобразовать узел сохранённого контура':hit.source==='vector-mask'?'Преобразовать узел векторной маски':'Преобразовать Bézier-узел в угловой');
    else setStatus('Bézier-узел уже угловой');
    return true;
  }
  const control=hit.control==='anchor'&&event.shiftKey?'handleOut':hit.control;
  drag={
    kind:'path-control',layerId:hit.layer?.id??null,nodeIndex:hit.nodeIndex,control,
    pathSource:hit.source,documentPathIndex:hit.documentPathIndex??null,subpathIndex:hit.subpathIndex,
    startLocal:hit.layer?documentPointToLayerPixel(point,hit.layer):{...point},
    initial:structuredClone(node),moved:false,
  };
  setStatus(hit.source==='document-path'
    ? 'Сохранённый контур: перетаскивайте anchors/handles; Alt разрывает симметрию'
    : hit.source==='vector-mask'
      ? 'Векторная маска: перетаскивайте anchors/handles; Alt разрывает симметрию'
      : control==='anchor'
      ? 'Перо: перетаскивайте anchor; Shift+drag создаёт smooth handles'
      : 'Перо: перетаскивайте handle; Alt разрывает симметрию');
  return true;
}

function setSelectionPreviewShape(shape) {
  selectionShape = cloneSelectionShape(shape);
  selectionRect = selectionBounds(selectionShape);
  return selectionShape;
}

function setSelectionShape(shape) {
  setSelectionPreviewShape(shape);
  if (!selectionRect || selectionRect.width < 1e-6 || selectionRect.height < 1e-6) {
    selectionShape = null;
    selectionRect = null;
  }
  return selectionShape;
}

function clearSelectionState() {
  selectionShape = null;
  selectionRect = null;
  selectionGestures.resetDrafts();
}

function pointInsideSelection(point) {
  if (!selectionShape) return true;
  return pointInSelection(point, selectionShape);
}

function selectionPolygonForLayer(layer, shape = selectionShape) {
  if (!shape) return null;
  const points = selectionPathPoints(shape, 72);
  if (points.length < 3) return null;
  return points.map(point => documentPointToLayerPixel(point, layer));
}

function traceDocumentSelectionPath(ctx, shape = selectionShape) {
  if (!shape) return false;
  if (shape.type === 'rect' || shape.type === 'ellipse') {
    const rect = selectionBounds(shape);
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    ctx.beginPath();
    if (shape.type === 'ellipse') ctx.ellipse(rect.x + rect.width/2, rect.y + rect.height/2, rect.width/2, rect.height/2, 0, 0, Math.PI*2);
    else ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.closePath();
    return true;
  }
  const points = selectionPathPoints(shape);
  if (points.length < 2) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i=1;i<points.length;i+=1) ctx.lineTo(points[i].x, points[i].y);
  if (points.length >= 3) ctx.closePath();
  return true;
}

function clipContextToDocumentSelection(ctx) {
  if (!selectionShape) return;
  if (traceDocumentSelectionPath(ctx)) ctx.clip();
}

function clipContextToSelection(ctx, layer) {
  const polygon = selectionPolygonForLayer(layer);
  if (!polygon) return;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i=1;i<polygon.length;i+=1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.clip();
}

function rasterSelectionPredicate(layer) {
  if (!selectionShape) return null;
  return (x,y) => pointInsideSelection(layerPixelToDocumentPoint({x:x+.5,y:y+.5},layer));
}

function selectionIntersectsLayer(layer) {
  if (!selectionRect) return false;
  const bounds=frameBounds(layer);
  return selectionRect.x < bounds.x+bounds.width && selectionRect.x+selectionRect.width > bounds.x && selectionRect.y < bounds.y+bounds.height && selectionRect.y+selectionRect.height > bounds.y;
}

function render({ paintPreview = false } = {}) {
  const version = ++renderVersion;
  renderPending = { paintPreview, version };
  if (renderBusy || renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    drainRenderQueue();
  });
}

async function drainRenderQueue() {
  if (renderBusy || !renderPending) return;
  const request = renderPending;
  renderPending = null;
  renderBusy = true;
  try {
    const rasterOverrides = request.paintPreview ? rasterEdit.paintPreviewOverrides() : null;
    const previewDoc = textEditController.documentWithPreview(doc);
    await renderDocument(renderBuffer, previewDoc, { checker: false, rasterOverrides });
    if (request.version !== renderVersion) return;
    if (els.canvas.width !== doc.width) els.canvas.width = doc.width;
    if (els.canvas.height !== doc.height) els.canvas.height = doc.height;
    const visibleCtx = els.canvas.getContext('2d', { alpha: true });
    visibleCtx.clearRect(0, 0, doc.width, doc.height);
    visibleCtx.drawImage(renderBuffer, 0, 0);
    textEditController.syncPreviewCanvas();
    layerBlendingController.syncPreviewCanvas();
    if (!request.paintPreview) {
      if (els.overlay.width !== doc.width) els.overlay.width = doc.width;
      if (els.overlay.height !== doc.height) els.overlay.height = doc.height;
      drawOverlay();
    }
  } catch (error) {
    console.error(error);
    setStatus(`Ошибка рендера: ${error.message}`);
  } finally {
    renderBusy = false;
    if (renderPending && !renderFrame) {
      renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        drainRenderQueue();
      });
    }
  }
}

function drawOverlay() {
  const ctx = els.overlay.getContext('2d');
  ctx.clearRect(0, 0, doc.width, doc.height);
  if (cropRect) {
    ctx.save();
    ctx.fillStyle = '#0008';
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([8 / zoom, 5 / zoom]);
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.globalAlpha = .72;
    ctx.setLineDash([4 / zoom, 5 / zoom]);
    for (const fraction of [1 / 3, 2 / 3]) {
      const x = cropRect.x + cropRect.width * fraction;
      const y = cropRect.y + cropRect.height * fraction;
      ctx.beginPath(); ctx.moveTo(x, cropRect.y); ctx.lineTo(x, cropRect.y + cropRect.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cropRect.x, y); ctx.lineTo(cropRect.x + cropRect.width, y); ctx.stroke();
    }
    ctx.restore();
  }
  if (selectionShape) {
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = '#000';
    ctx.setLineDash([6 / zoom, 6 / zoom]);
    ctx.lineDashOffset = 3 / zoom;
    if (traceDocumentSelectionPath(ctx)) ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineDashOffset = 0;
    if (traceDocumentSelectionPath(ctx)) ctx.stroke();
    ctx.restore();
  }
  selectionGestures.drawPolygonDraft(ctx);
  if(penDraft?.points?.length){
    const points=penDraft.points;
    ctx.save();ctx.lineWidth=1.5/zoom;ctx.strokeStyle='#72a7ff';ctx.fillStyle='#fff';ctx.setLineDash([]);
    ctx.beginPath();tracePenDraftPath(ctx,points,drag?.kind==='pen-handle'?null:penDraft.hover);ctx.stroke();
    ctx.lineWidth=1/zoom;ctx.strokeStyle='#8fc0ff';
    for(const point of points){
      for(const handle of [point.handleIn,point.handleOut]){
        if(!handle)continue;
        ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.lineTo(handle.x,handle.y);ctx.stroke();
        ctx.beginPath();ctx.arc(handle.x,handle.y,2.5/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }
    ctx.fillStyle='#fff';ctx.strokeStyle='#3976ea';
    for(const point of points){ctx.beginPath();ctx.arc(point.x,point.y,3/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.restore();
  } else {
    selectionGestures.drawMagneticDraft(ctx);
  }
  drawSelectedPathControls(ctx);
  if (RASTER_BRUSH_TOOLS.has(currentTool) && hoverPoint) {
    const paintLayer = paintLayerAtPoint(hoverPoint);
    const radius = Math.max(.5, Number(els.brushSize.value) / 2);
    const scaleX = Math.abs(Number(paintLayer?.scaleX) || 1);
    const scaleY = Math.abs(Number(paintLayer?.scaleY) || 1);
    const rotation = (Number(paintLayer?.rotation) || 0) * Math.PI / 180;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 3 / zoom;
    ctx.strokeStyle = '#000a';
    ctx.beginPath();ctx.ellipse(hoverPoint.x,hoverPoint.y,radius*scaleX,radius*scaleY,rotation,0,Math.PI*2);ctx.stroke();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();ctx.ellipse(hoverPoint.x,hoverPoint.y,radius*scaleX,radius*scaleY,rotation,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  const retouchCloneSource=getRetouchCloneSource();
  if ((currentTool === 'clone' || currentTool === 'heal') && retouchCloneSource?.documentPoint) {
    const point=retouchCloneSource.documentPoint;
    ctx.save();ctx.strokeStyle='#65d8ff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(point.x,point.y,7/zoom,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(point.x-10/zoom,point.y);ctx.lineTo(point.x+10/zoom,point.y);ctx.moveTo(point.x,point.y-10/zoom);ctx.lineTo(point.x,point.y+10/zoom);ctx.stroke();ctx.restore();
  }
  if (currentTool === 'move' && drag?.kind === 'move' && (smartGuides.x !== null || smartGuides.y !== null)) {
    ctx.save();
    ctx.strokeStyle = '#ff61d8';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    if (smartGuides.x !== null) {
      ctx.beginPath(); ctx.moveTo(smartGuides.x, 0); ctx.lineTo(smartGuides.x, doc.height); ctx.stroke();
    }
    if (smartGuides.y !== null) {
      ctx.beginPath(); ctx.moveTo(0, smartGuides.y); ctx.lineTo(doc.width, smartGuides.y); ctx.stroke();
    }
    ctx.restore();
  }
  const layer = textEditController.previewLayer(doc) || selected();
  if (!layer || !isLayerVisible(doc, layer) || !isTransformableLayer(layer)) return;
  const frame = layerFrame(layer);
  const moveMode=currentTool==='move';
  const accent=isLayerLocked(doc,layer)?'#aeb6c4':moveMode?'#69a0ff':'#5ee7ff';
  ctx.save();
  ctx.strokeStyle='#000c';ctx.lineWidth=4/zoom;ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(frame.corners[0].x, frame.corners[0].y);
  for (let i = 1; i < frame.corners.length; i += 1) ctx.lineTo(frame.corners[i].x, frame.corners[i].y);
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle=accent;ctx.lineWidth=1.5/zoom;ctx.setLineDash(moveMode?[6/zoom,4/zoom]:[]);ctx.stroke();
  if(moveMode&&!isLayerLocked(doc, layer)) {
    ctx.fillStyle = '#f8fbff'; ctx.strokeStyle = '#3976ea'; ctx.setLineDash([]);
    const size = 8 / zoom;
    for (const point of Object.values(frame.handles)) {
      ctx.fillRect(point.x-size/2, point.y-size/2, size, size);
      ctx.strokeRect(point.x-size/2, point.y-size/2, size, size);
    }
    const rotatePoint = interactiveRotationHandlePoint(layer);
    ctx.beginPath(); ctx.moveTo(frame.handles.n.x, frame.handles.n.y); ctx.lineTo(rotatePoint.x, rotatePoint.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(rotatePoint.x, rotatePoint.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }else{
    ctx.fillStyle=accent;ctx.strokeStyle='#071018';ctx.lineWidth=1/zoom;ctx.setLineDash([]);const radius=3.5/zoom;
    for(const point of frame.corners){ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
  }
  const label=String(layer.name||'Слой');ctx.font=`600 ${12/zoom}px Inter, Arial, sans-serif`;const paddingX=7/zoom,paddingY=5/zoom,labelWidth=ctx.measureText(label).width+paddingX*2,labelHeight=22/zoom;const bounds=frameBounds(layer);const labelX=clamp(bounds.x,2/zoom,Math.max(2/zoom,doc.width-labelWidth-2/zoom));const labelY=clamp(bounds.y-labelHeight-5/zoom,2/zoom,Math.max(2/zoom,doc.height-labelHeight-2/zoom));ctx.fillStyle='#101722ee';ctx.strokeStyle=accent;ctx.lineWidth=1/zoom;ctx.beginPath();ctx.roundRect(labelX,labelY,labelWidth,labelHeight,5/zoom);ctx.fill();ctx.stroke();ctx.fillStyle='#f6fbff';ctx.textBaseline='middle';ctx.fillText(label,labelX+paddingX,labelY+labelHeight/2);
  ctx.restore();
}

function updateCanvasSize() {
  els.shell.style.width = `${doc.width * zoom}px`;
  els.shell.style.height = `${doc.height * zoom}px`;
  els.canvas.style.width = `${doc.width * zoom}px`; els.canvas.style.height = `${doc.height * zoom}px`;
  els.overlay.style.width = `${doc.width * zoom}px`; els.overlay.style.height = `${doc.height * zoom}px`;
  els.canvas.style.imageRendering = zoom >= 4 ? 'pixelated' : 'auto';
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  els.zoomRange.value = String(Math.round(zoom * 100));
}

function updateAll() {
  syncCurrentSession();
  els.title.textContent = doc.name;
  els.dimensions.textContent = `${doc.width} × ${doc.height}`;
  els.undo.disabled = !history.canUndo(); els.redo.disabled = !history.canRedo();
  els.emptyDrop.hidden = doc.layers.length > 0;
  updateCanvasSize(); layersPanelController.render(); updatePathsPanel(); updateHistory(); refreshInspectorPanels(); updateLayerControls(); render();
  renderDocumentTabs();
}

function moveLayerRelativeToTarget(layerId, targetId, aboveInDisplay) {
  if (layerId === targetId) return false;
  const sourceIndex = doc.layers.findIndex(item => item.id === layerId);
  const targetLayer = doc.layers.find(item => item.id === targetId);
  if (sourceIndex < 0 || !targetLayer) return false;
  const beforeOrder = doc.layers.map(item => item.id).join('|');
  const source = doc.layers[sourceIndex];
  if (isLayerLocked(doc, source) || isLayerLocked(doc, targetLayer)) return false;
  const beforeGroupId = source.groupId ?? null;
  doc.layers.splice(sourceIndex, 1);
  const targetIndex = doc.layers.findIndex(item => item.id === targetId);
  if (targetIndex < 0) {
    doc.layers.splice(Math.min(sourceIndex, doc.layers.length), 0, source);
    return false;
  }
  source.groupId = targetLayer.groupId ?? null;
  const insertIndex = aboveInDisplay ? targetIndex + 1 : targetIndex;
  doc.layers.splice(insertIndex, 0, source);
  const changed = beforeOrder !== doc.layers.map(item => item.id).join('|') || beforeGroupId !== (source.groupId ?? null);
  if (changed) touch(doc);
  return changed;
}

function moveLayerToRootTop(layerId) {
  const index = doc.layers.findIndex(item => item.id === layerId);
  if (index < 0) return false;
  const layer = doc.layers[index];
  if (isLayerLocked(doc, layer)) return false;
  const beforeGroupId = layer.groupId ?? null;
  const alreadyTop = index === doc.layers.length - 1;
  if (beforeGroupId == null && alreadyTop) return false;
  doc.layers.splice(index, 1);
  layer.groupId = null;
  doc.layers.push(layer);
  touch(doc);
  return true;
}


function updateHistory() {
  els.history.replaceChildren();
  history.entries.forEach((entry, index) => {
    const row = document.createElement('button'); row.type='button'; row.className = `history-row${index === history.index ? ' current' : ''}`;
    row.textContent = `${index === history.index ? '● ' : ''}${entry.label}`;
    row.title = index === history.index ? 'Текущее состояние' : 'Перейти к этому состоянию';
    row.disabled = index === history.index;
    row.onclick = () => jumpToHistory(index);
    els.history.append(row);
  });
  els.history.scrollTop = els.history.scrollHeight;
}

function jumpToHistory(index) {
  if (blockPendingDocumentEdit()) return;
  const entry = history.jump(index);
  if (!entry) return;
  doc = restoreDocument(entry.snapshot);
  rasterEdit.clearBrushBuffer(); cropRect=null; clearSelectionState();
  updateAll(); markDirty(true); setStatus(`История → ${entry.label}`);
}

function updateLayerControls() {
  const layer = selected();
  const editable = Boolean(layer) && !isLayerLocked(doc, layer);
  els.blend.disabled = !editable; els.layerOpacity.disabled = !editable;
  for (const id of ['renameLayerBtn','duplicateLayerBtn','deleteLayerBtn','layerUpBtn','layerDownBtn','resetColorEffectsBtn']) {
    const control = $(`#${id}`);
    if (control) control.disabled = !editable;
  }
  if (layer) { els.blend.value = layer.blendMode || 'source-over'; els.layerOpacity.value = String(Math.round((layer.opacity ?? 1) * 100)); }
}

function propField(label, key, value, type='number', attrs='') {
  return `<label for="prop-${key}">${label}</label><input id="prop-${key}" data-prop="${key}" type="${type}" value="${String(value).replaceAll('"','&quot;')}" ${attrs}>`;
}
function propSelectField(label, key, value, options) {
  return `<label for="prop-${key}">${label}</label><select id="prop-${key}" data-prop="${key}">${options.map(([option, name]) => `<option value="${escapeAttr(option)}"${option === value ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>`;
}
function formatFilterValue(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (key === 'exposure') return `${number > 0 ? '+' : ''}${number.toFixed(2)} EV`;
  if (key === 'gamma') return number.toFixed(2);
  if (key === 'hue') return `${Math.round(number)}°`;
  if (key === 'blur') return `${Math.round(number)} px`;
  if (['brightness','contrast','saturate','grayscale','sepia','invert'].includes(key)) return `${Math.round(number)}%`;
  if (['temperature','tint','vibrance','highlights','shadows'].includes(key)) return `${number > 0 ? '+' : ''}${Math.round(number)}`;
  return String(Math.round(number * 100) / 100);
}
function propRangeField(label, key, value, attrs='') {
  const filterKey = key.startsWith('filters.') ? key.split('.')[1] : key;
  return `<label for="prop-${key}">${label}</label><div class="range-with-value"><input id="prop-${key}" data-prop="${key}" type="range" value="${escapeAttr(value)}" ${attrs}><output>${escapeHtml(formatFilterValue(filterKey,value))}</output></div>`;
}
function renderEffectControls(layer) {
  const controls = layer.type === 'raster' || layer.type === 'adjustment' ? RASTER_EFFECT_CONTROLS : BASIC_EFFECT_CONTROLS;
  let currentGroup = null;
  let html = '';
  for (const control of controls) {
    if (control.group && control.group !== currentGroup) {
      currentGroup = control.group;
      html += `<div class="prop-effect-group">${escapeHtml(currentGroup)}</div>`;
    }
    const fallback = DEFAULT_LAYER_FILTERS[control.key] ?? 0;
    const value = layer.filters?.[control.key] ?? fallback;
    html += propRangeField(control.label, `filters.${control.key}`, value, `min="${control.min}" max="${control.max}" step="${control.step}"`);
  }
  return html;
}

function bindPropertyInputs(root) {
  root?.querySelectorAll('[data-prop]').forEach(input => {
    if (input.type === 'range') {
      input.addEventListener('input', () => {
        const key = input.dataset.prop.startsWith('filters.') ? input.dataset.prop.split('.')[1] : input.dataset.prop;
        const output = input.closest('.range-with-value')?.querySelector('output');
        if (output) output.textContent = formatFilterValue(key, input.value);
        applyProperty(input.dataset.prop, input.value, input, false);
      });
      input.addEventListener('change', () => applyProperty(input.dataset.prop, input.value, input, true));
    } else if(input.type === 'number') {
      input.dataset.initialValue=input.value;
      input.addEventListener('change',()=>{normalizeNumberInput(input);applyProperty(input.dataset.prop,input.value,input,true);});
    } else {
      input.addEventListener('change', () => applyProperty(input.dataset.prop, input.value, input, true));
    }
  });
}
function refreshInspectorPanels() {
  updateProperties();
  updateEffectsPanel();
}
function resetSelectedLayerEffects() {
  const layer = selected();
  if (!layer || isLayerLocked(doc,layer)) return;
  const controls = layer.type === 'raster' || layer.type === 'adjustment' ? RASTER_EFFECT_CONTROLS : BASIC_EFFECT_CONTROLS;
  layer.filters = sanitizeFilters(layer.filters);
  let changed = false;
  for (const control of controls) {
    const fallback = DEFAULT_LAYER_FILTERS[control.key];
    if (layer.filters[control.key] !== fallback) {
      layer.filters[control.key] = fallback;
      changed = true;
    }
  }
  if (changed) commit('Сбросить цвет и эффекты');
  else setStatus('Цвет и эффекты уже сброшены');
}
function formatDisplayExposure(value){
  const ev=Number(value)||0;
  return `${ev>=0?'+':''}${ev.toFixed(1)} EV`;
}

function updateHighDepthPreviewSetting(layer,key,raw,shouldCommit=true){
  if(!layer?.highDepthSource||layer.type!=='raster'||isLayerLocked(doc,layer))return false;
  const current=sanitizeHighDepthPreview(layer.highDepthPreview);
  const candidate={...current,[key]:key==='displayExposure'?Number(raw):raw};
  layer.highDepthPreview=sanitizeHighDepthPreview(candidate);
  markDirty(true);
  if(shouldCommit)commit(key==='toneMap'?'Изменить HDR tone mapping':'Изменить HDR display exposure');
  else render();
  return true;
}

function resetHighDepthPreview(layer=selected()){
  if(!layer?.highDepthSource||layer.type!=='raster'||isLayerLocked(doc,layer))return false;
  layer.highDepthPreview=sanitizeHighDepthPreview();
  commit('Сбросить HDR preview');
  return true;
}

function bindHighDepthPreviewControls(root,layer){
  const toneMap=root?.querySelector('[data-high-depth-tone-map]');
  if(toneMap)toneMap.addEventListener('change',()=>updateHighDepthPreviewSetting(layer,'toneMap',toneMap.value,true));
  const exposure=root?.querySelector('[data-high-depth-display-exposure]');
  if(exposure){
    const output=root.querySelector('[data-high-depth-display-output]');
    exposure.addEventListener('input',()=>{
      if(output)output.textContent=formatDisplayExposure(exposure.value);
      updateHighDepthPreviewSetting(layer,'displayExposure',exposure.value,false);
    });
    exposure.addEventListener('change',()=>updateHighDepthPreviewSetting(layer,'displayExposure',exposure.value,true));
  }
  root?.querySelector('[data-high-depth-preview-reset]')?.addEventListener('click',()=>resetHighDepthPreview(layer));
}

function updateProperties() {
  const l = selected();
  if (!l) { els.props.className = 'panel-content muted'; els.props.textContent = 'Выберите слой'; return; }
  els.props.className = 'panel-content';
  if (l.type === 'adjustment') {
    const maskLabel=layerMaskSummary(l);
    const kindLabel=l.adjustment?.kind||'Generic ZPE';
    els.props.innerHTML = `<div class="prop-grid">
      <label>Имя</label><input data-prop="name" value="${escapeAttr(l.name)}">
      <label>Тип</label><span>Корректирующий слой · ${escapeHtml(kindLabel)}</span>
      <label>Область</label><span>Нижележащий стек</span>
      <label>Маски</label><span>${escapeHtml(maskLabel)}</span>
      ${adjustmentPropertiesMarkup(l)}
    </div>`;
    bindPropertyInputs(els.props);
    bindAdjustmentControls(els.props,l);
    if (isLayerLocked(doc,l)) els.props.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; });
    return;
  }
  let extra = '';
  if (l.type === 'text') {
    const nativeText=l.psdText?psdTextNativePlan(l):null;
    const nativeInfo=l.psdText?`<label>Photoshop Text</label><span>${nativeText?.eligible?'native TySh + EngineData round-trip':'raster fallback: '+escapeHtml(nativeText?.reason||'metadata unavailable')}</span>`:'';
    extra = `<label>Текст</label><textarea data-prop="text">${escapeHtml(l.text || '')}</textarea>${propSelectField('Шрифт', 'fontFamily', l.fontFamily, textSettingsController.fontOptions(l.fontFamily, l.fontLabel))}<label>Шрифты ПК</label><button type="button" class="mini-button" data-local-fonts>Показать список</button><label for="system-font-name">Или имя шрифта ПК</label><input id="system-font-name" type="text" placeholder="Например, Segoe UI"><label for="text-font-file">Свой шрифт</label><input id="text-font-file" type="file" accept=".woff,.woff2,.ttf,.otf" aria-label="Загрузить свой шрифт">${propField('Размер', 'fontSize', l.fontSize, 'number','min="6" max="500"')}${propSelectField('Начертание', 'fontWeight', l.fontWeight, TEXT_WEIGHT_OPTIONS)}${propSelectField('Стиль', 'fontStyle', l.fontStyle ?? 'normal', TEXT_STYLE_OPTIONS)}${propSelectField('Выравнивание', 'align', l.align, TEXT_ALIGN_OPTIONS)}${propField('Межстрочный', 'lineHeight', l.lineHeight ?? 1.18, 'number', 'min="0.8" max="3" step="0.01"')}${propField('Межбуквенный', 'letterSpacing', l.letterSpacing ?? 0, 'number', 'min="-5" max="20" step="0.5"')}${propSelectField('Подчёркивание', 'underline', l.underline ? 'yes' : 'no', [['no','Нет'],['yes','Да']])}${propSelectField('Зачёркивание', 'strikeThrough', l.strikeThrough ? 'yes' : 'no', [['no','Нет'],['yes','Да']])}${propField('Цвет','color',l.color,'color')}${nativeInfo}`;
  }
  if (l.type === 'shape') {
    const nativeShape=l.psdShape?psdShapeNativePlan(l):null;
    const nativeInfo=l.psdShape?`<label>Photoshop Shape</label><span>${nativeShape?.eligible?'native solid-fill + vector-mask round-trip':'raster fallback: '+escapeHtml(nativeShape?.reason||'metadata unavailable')}</span>`:'';
    extra = (l.shape === 'line'
      ? `${propField('Цвет линии','stroke',l.stroke === 'transparent' ? '#000000' : l.stroke,'color')}${propField('Толщина','strokeWidth',l.strokeWidth ?? 1,'number','min="1" max="1000"')}`
      : `${propField('Заливка','fill',l.fill,'color')}${propField('Обводка','stroke',l.stroke === 'transparent' ? '#000000' : l.stroke,'color')}${propField('Толщина','strokeWidth',l.strokeWidth ?? 0,'number','min="0" max="1000"')}`) + nativeInfo;
  }
  if (l.type === 'raster' && l.highDepthSource) {
    const source=l.highDepthSource;
    const sizeMb=(Number(source.rawBytes||0)/1024/1024).toFixed(1);
    if(source.model==='cmyk'){
      const policy=sanitizeColorManagement(doc.colorManagement);
      const intentOptions=[['perceptual','Perceptual'],['relative','Relative colorimetric'],['saturation','Saturation'],['absolute','Absolute colorimetric']];
      const intentSelect=intentOptions.map(([value,label])=>`<option value="${value}"${policy.renderingIntent===value?' selected':''}>${label}</option>`).join('');
      const proofIntentSelect=intentOptions.map(([value,label])=>`<option value="${value}"${policy.proofRenderingIntent===value?' selected':''}>${label}</option>`).join('');
      const proofName=doc.proofProfile?.name||'не выбран';
      const displayName=doc.displayProfile?.name||'sRGB (browser/OS)';
      extra = `<label>Нативный источник</label><span>${source.bitsPerChannel}-bit CMYK · ${sizeMb} МБ</span><label>Source intent</label><select data-cmyk-rendering-intent>${intentSelect}</select><label>Display target</label><span>${escapeHtml(displayName)}</span><label>Display ICC</label><input type="file" accept=".icc,.icm,application/vnd.iccprofile" data-cmyk-display-file><div class="wide"><button type="button" class="mini-button" data-cmyk-display-remove${doc.displayProfile?'':' disabled'}>Вернуть sRGB display</button></div><label>Soft proof</label><span><input type="checkbox" data-cmyk-soft-proof${policy.softProofEnabled?' checked':''}${doc.proofProfile?'':' disabled'}> ${escapeHtml(proofName)}</span><label>Proof intent</label><select data-cmyk-proof-intent>${proofIntentSelect}</select><label>Black Point Compensation</label><span><input type="checkbox" data-cmyk-bpc${policy.blackPointCompensation?' checked':''}> ICC BPC</span><label>Proof ICC</label><input type="file" accept=".icc,.icm,application/vnd.iccprofile" data-cmyk-proof-file><div class="wide"><button type="button" class="mini-button" data-cmyk-proof-remove${doc.proofProfile?'':' disabled'}>Удалить proof profile</button></div><label>Gamut warning</label><span><input type="checkbox" data-cmyk-gamut-warning${policy.gamutWarningEnabled?' checked':''}> magenta overlay</span><label>Gamut ΔE</label><input type="number" min="0.5" max="20" step="0.5" value="${policy.gamutWarningThreshold}" data-cmyk-gamut-threshold><label>Color management</label><span>CMYK ICC → PCS → optional proof ICC/BPC → RGB display ICC → browser/OS compositor</span><label>Редактирование</label><span>Brush, Eraser, Fill, Clear, Line, Blur, Clone/Heal, Smudge и Dodge/Burn сохраняют native CMYK source; Dodge уменьшает ink density, Burn усиливает K без RGB rasterization</span>`;
    }else if(Number(source.bitsPerChannel)>8){
      const preview=sanitizeHighDepthPreview(l.highDepthPreview);
      const resolvedAuto=source.bitsPerChannel===32?'ACES':'Clip';
      const displayLabel=formatDisplayExposure(preview.displayExposure);
      extra = `<label>Точность источника</label><span>${source.bitsPerChannel}-bit RGB · ${sizeMb} МБ</span><label>High-depth</label><span>Exposure/gamma/color работают до tone mapping; Canvas display — 8-bit</span><label>Tone map</label><select data-high-depth-tone-map><option value="auto"${preview.toneMap==='auto'?' selected':''}>Auto (${resolvedAuto})</option><option value="clip"${preview.toneMap==='clip'?' selected':''}>Clip</option><option value="aces"${preview.toneMap==='aces'?' selected':''}>ACES</option></select><label>Display exposure</label><span class="range-with-value"><input type="range" min="-6" max="6" step="0.1" value="${preview.displayExposure}" data-high-depth-display-exposure><output data-high-depth-display-output>${displayLabel}</output></span><div class="wide"><button type="button" class="mini-button" data-high-depth-preview-reset>Сбросить HDR preview</button></div>`;
    }
  }
  if (l.type === 'smart-object') {
    if(l.psdSmartObject){
      const sourceKind=l.psdSmartObject.asset?.kind==='external'?'External':l.psdSmartObject.asset?.kind==='data'?'Embedded':(l.psdSmartObject.kind==='linked'?'Linked':'Placed');
      const unique=l.psdSmartObject.uniqueId?escapeHtml(l.psdSmartObject.uniqueId):'не указан';
      const asset=l.psdSmartObject.asset;
      const assetLabel=asset?.filename?escapeHtml(asset.filename)+(asset.detectedFileType?' · '+escapeHtml(asset.detectedFileType.toUpperCase()):''):'payload не извлечён';
      const roundTrip=psdSmartObjectLayerUnchanged(l)?'native metadata + linked resource сохранятся':'слой/content изменён — PSD/PSB export растрирует preview';
      const edit=l.embeddedDocument?'<button type="button" class="mini-button" data-smart-object-edit>Редактировать извлечённое содержимое</button>':'<span>linked/unsupported payload остаётся opaque</span>';
      extra = `<label>Photoshop Smart Object</label><span>${sourceKind}</span><label>Placed ID</label><span>${unique}</span><label>Asset</label><span>${assetLabel}</span><label>Round-trip</label><span>${escapeHtml(roundTrip)}</span><label>Содержимое</label>${edit}${smartFilterStackMarkup(l)}`;
    }else{
      const linkedCount=l.linkedSourceId?linkedSmartObjectLayers(doc,l.linkedSourceId).length:0;
      const linkSummary=l.linkedSourceId?`Связанный источник · ${linkedCount} экз.`:'Независимый встроенный источник';
      extra = `<label>Содержимое</label><button type="button" class="mini-button" data-smart-object-edit>Редактировать содержимое</button><label>Источник</label><span>${l.embeddedDocument ? `${l.embeddedDocument.width} × ${l.embeddedDocument.height}` : 'недоступен'}</span><label>Связь</label><span>${escapeHtml(linkSummary)}</span><div class="wide smart-object-link-actions"><button type="button" class="mini-button" data-smart-object-link-copy>Создать связанную копию</button>${l.linkedSourceId?'<button type="button" class="mini-button" data-smart-object-unlink>Разорвать связь</button>':''}</div>${smartFilterStackMarkup(l)}`;
    }
  }
  els.props.innerHTML = `<div class="prop-grid">
    <label>Имя</label><input data-prop="name" value="${escapeAttr(l.name)}">
    ${propField('X','x',Math.round(l.x))}${propField('Y','y',Math.round(l.y))}
    ${propField('Ширина','width',Math.round(l.width),'number','min="1" max="12000"')}${propField('Высота','height',Math.round(l.height),'number','min="1" max="12000"')}
    ${propField('Масштаб X','scaleX',Number(l.scaleX ?? 1).toFixed(2),'number','step="0.01" min="0.01" max="100"')}
    ${propField('Масштаб Y','scaleY',Number(l.scaleY ?? 1).toFixed(2),'number','step="0.01" min="0.01" max="100"')}
    ${propField('Поворот','rotation',Math.round(l.rotation ?? 0),'number','step="1"')}
    <label>Маски</label><span>${escapeHtml(layerMaskSummary(l))}</span>
    ${extra}
  </div>`;
  bindPropertyInputs(els.props);
  if(l.type==='raster'&&l.highDepthSource?.model==='rgb'&&Number(l.highDepthSource.bitsPerChannel)>8)bindHighDepthPreviewControls(els.props,l);
  if(l.type==='raster'&&l.highDepthSource?.model==='cmyk')bindColorManagementControls(els.props);
  const smartObjectEdit=els.props.querySelector('[data-smart-object-edit]');
  if(smartObjectEdit)smartObjectEdit.addEventListener('click',()=>openSmartObjectContents(l));
  const smartObjectLinkCopy=els.props.querySelector('[data-smart-object-link-copy]');
  if(smartObjectLinkCopy)smartObjectLinkCopy.addEventListener('click',()=>createLinkedSmartObjectCopy(l));
  const smartObjectUnlink=els.props.querySelector('[data-smart-object-unlink]');
  if(smartObjectUnlink)smartObjectUnlink.addEventListener('click',()=>unlinkSmartObject(l));
  if(l.type==='smart-object')bindSmartFilterControls(els.props,l);
  const systemFontInput=els.props.querySelector('#system-font-name');
  if(systemFontInput)systemFontInput.addEventListener('change',()=>{
    const value=textSettingsController.registerSystemFont(systemFontInput.value);
    if(!value)return;
    applyProperty('fontFamily',value,systemFontInput,true);
  });
  const localFontsButton = els.props.querySelector('[data-local-fonts]');
  if (localFontsButton) localFontsButton.addEventListener('click', async () => {
    localFontsButton.disabled = true;
    try { const count = await textSettingsController.loadComputerFonts(els.props.querySelector('[data-prop="fontFamily"]')); setStatus(`Доступно шрифтов компьютера: ${count}`); }
    catch (error) { toast(error.message, 'warn'); setStatus(error.message); }
    finally { if (localFontsButton.isConnected) localFontsButton.disabled = false; }
  });
  const fontInput = els.props.querySelector('#text-font-file');
  if (fontInput) fontInput.addEventListener('change', async () => {
    const targetDoc = doc, targetLayer = l;
    fontInput.disabled = true;
    try {
      const custom = await textSettingsController.readCustomFont(fontInput.files?.[0]);
      if (!custom || doc !== targetDoc || selected() !== targetLayer || isLayerLocked(doc,targetLayer)) return;
      Object.assign(targetLayer, custom);
      commit('Изменить шрифт текста');
    } catch (error) { toast(error.message, 'error'); setStatus(error.message); }
    finally { if (fontInput.isConnected) fontInput.disabled = false; }
  });
  if (isLayerLocked(doc,l)) els.props.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; });
}
function updateEffectsPanel() {
  const l = selected();
  if (!l) {
    els.effects.className = 'panel-content muted';
    els.effects.textContent = 'Выберите слой';
    return;
  }
  els.effects.className = 'panel-content';
  els.effects.innerHTML = `<div class="prop-effects-grid">${renderEffectControls(l)}</div>`;
  bindPropertyInputs(els.effects);
  if (isLayerLocked(doc,l)) els.effects.querySelectorAll('input,textarea,select').forEach(control => { control.disabled = true; });
}
function escapeHtml(v) { const d=document.createElement('div'); d.textContent=v; return d.innerHTML; }
function escapeAttr(v) { return escapeHtml(v).replaceAll('"','&quot;'); }
function applyProperty(path, raw, input, shouldCommit = true) {
  const l = selected(); if (!l || isLayerLocked(doc,l)) return;
  const stringProps = ['name','text','color','fill','stroke','fontFamily','fontWeight','fontStyle','align','underline','strikeThrough'];
  let value = stringProps.includes(path) ? raw : Number(raw);
  if (!stringProps.includes(path) && !Number.isFinite(value)) {
    refreshInspectorPanels();
    setStatus('Некорректное числовое значение');
    return;
  }
  if (path.startsWith('filters.')) {
    const key = path.split('.')[1];
    const [min,max] = FILTER_RANGES[key] || [0,400];
    value = clamp(value, min, max);
    l.filters = sanitizeFilters(l.filters);
    l.filters[key] = value;
    markDirty(true);
    if (shouldCommit) commit('Изменить фильтр слоя'); else render();
    return;
  }
  if (path === 'width' || path === 'height') {
    value = clamp(value, 1, 12000);
    if (l.type === 'raster') {
      try {
        checkedCanvasSize(path === 'width' ? value : l.width, path === 'height' ? value : l.height, `Растровый слой «${l.name || 'Без имени'}»`);
      } catch (error) {
        refreshInspectorPanels();
        setStatus(error.message);
        toast(error.message, 'warn');
        return;
      }
    }
  }
  if (path === 'scaleX' || path === 'scaleY') value = clamp(value, .01, 100);
  if (path === 'x' || path === 'y') value = clamp(value, -120000, 120000);
  if (path === 'rotation') value = ((value % 360) + 360) % 360;
  if (path === 'fontSize') value = clamp(value, 6, 500);
  if (path === 'fontWeight' && !textSettingsController.isWeight(value)) return;
  if (path === 'fontStyle' && !textSettingsController.isStyle(value)) return;
  if (path === 'align' && !textSettingsController.isAlign(value)) return;
  if (path === 'fontFamily' && !textSettingsController.fontOptions(l.fontFamily).some(([option]) => option === value)) return;
  if (path === 'fontFamily' && value !== l.fontFamily) { l.fontData = null; l.fontLabel = ''; }
  if (path === 'lineHeight') value = clamp(value, 0.8, 3);
  if (path === 'letterSpacing') value = clamp(value, -5, 20);
  if (path === 'underline' || path === 'strikeThrough') value = value === 'yes';
  if (path === 'strokeWidth') value = clamp(value, 0, 1000);
  l[path] = value;
  markDirty(true);
  if (shouldCommit) commit(`Изменить ${path}`);
  else { render(); drawOverlay(); }
}

function updateToolLabel() {
  const selectionType = selectionGestures.getType();
  els.toolLabel.textContent = currentTool === 'marquee' ? (SELECTION_TYPE_LABELS[selectionType] || TOOL_LABELS.marquee) : (TOOL_LABELS[currentTool] || currentTool);
}

function setTool(tool) {
  if (tool !== currentTool && blockPendingDocumentEdit()) return;
  selectionGestures.prepareToolChange(tool);
  if(tool!=='pen'){penDraft=null;vectorMaskEditLayerId=null;documentPathEditIndex=-1;}
  currentTool = tool;
  $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  updateToolLabel();
  $$('.text-only').forEach(x => x.style.display = tool === 'text' ? '' : 'none');
  $$('.shape-only').forEach(x => x.style.display = tool === 'shape' ? '' : 'none');
  $$('.fill-only').forEach(x => x.style.display = tool === 'fill' ? '' : 'none');
  $$('.blur-only').forEach(x => x.style.display = tool === 'blur' ? '' : 'none');
  $$('.smudge-only').forEach(x => x.style.display = tool === 'smudge' ? '' : 'none');
  $$('.dodge-only').forEach(x => x.style.display = tool === 'dodge' ? '' : 'none');
  $$('.burn-only').forEach(x => x.style.display = tool === 'burn' ? '' : 'none');
  $$('.color-option, .opacity-option').forEach(x => x.style.display = ['dodge','burn','blur'].includes(tool) ? 'none' : '');
  $$('.gradient-only').forEach(x => x.style.display = tool === 'gradient' ? '' : 'none');
  $$('.pen-only').forEach(x => x.style.display = tool === 'pen' ? '' : 'none');
  $$('.marquee-only').forEach(x => x.style.display = tool === 'marquee' ? '' : 'none');
  $$('.move-only').forEach(x => x.style.display = tool === 'move' ? '' : 'none');
  els.overlay.style.cursor = defaultToolCursor();
  cropRect = null; hoverPoint = null; clearSmartGuides(); drawOverlay();
  if ((tool === 'clone' || tool === 'heal') && !getRetouchCloneSource()) setStatus(`${TOOL_LABELS[tool]}: Alt+клик по растровому слою задаёт источник`);
}

function canvasPoint(event, { clampToDocument = true } = {}) {
  const r = els.overlay.getBoundingClientRect();
  const x = (event.clientX - r.left) / zoom;
  const y = (event.clientY - r.top) / zoom;
  return clampToDocument ? { x: clamp(x, 0, doc.width), y: clamp(y, 0, doc.height) } : { x, y };
}
function isTransformableLayer(layer) { return Boolean(layer) && layer.type !== 'adjustment'; }
function topLayerAt(point) { return [...doc.layers].reverse().find(l => isTransformableLayer(l) && isLayerVisible(doc,l) && !isLayerLocked(doc,l) && pointInLayer(point,l)) ?? null; }
function updateTransformPropertyValues(layer) {
  const values = {
    x: Math.round(layer.x), y: Math.round(layer.y),
    scaleX: Number(layer.scaleX ?? 1).toFixed(2), scaleY: Number(layer.scaleY ?? 1).toFixed(2),
    rotation: Math.round(layer.rotation ?? 0),
  };
  for (const [key, value] of Object.entries(values)) {
    const input = els.props.querySelector(`[data-prop="${key}"]`);
    if (input) input.value = String(value);
  }
}
function interactiveRotationHandlePoint(layer) {
  const preferred = rotationHandlePoint(layer, 30 / zoom);
  const insetX = Math.min(Math.max(8 / zoom, 2), doc.width / 2);
  const insetY = Math.min(Math.max(8 / zoom, 2), doc.height / 2);
  return {
    x: clamp(preferred.x, insetX, Math.max(insetX, doc.width - insetX)),
    y: clamp(preferred.y, insetY, Math.max(insetY, doc.height - insetY)),
  };
}
function cursorForHandle(handle, layer) {
  const baseAngles = { e:0, se:45, s:90, sw:135, w:180, nw:225, n:270, ne:315 };
  const angle = ((baseAngles[handle] ?? 0) + (Number(layer.rotation) || 0) + 360) % 180;
  const bucket = Math.round(angle / 45) % 4;
  return ['ew-resize','nwse-resize','ns-resize','nesw-resize'][bucket];
}
function defaultToolCursor() {
  return currentTool === 'move' ? 'default' : currentTool === 'text' ? 'text' : currentTool === 'hand' ? 'grab' : currentTool === 'zoom' ? 'zoom-in' : RASTER_BRUSH_TOOLS.has(currentTool) ? 'none' : 'crosshair';
}
function brushWidthForPointer(event) {
  const base = Number(els.brushSize.value) || 1;
  if (event?.pointerType !== 'pen') return base;
  const pressure = clamp(Number(event.pressure) || 0, 0, 1);
  return base * (0.15 + pressure * 0.85);
}
function adjustBrushSize(direction, coarse = false) {
  const current = Number(els.brushSize.value) || 1;
  const step = coarse ? 10 : (current < 20 ? 2 : current < 80 ? 5 : 10);
  const next = clamp(current + Math.sign(direction) * step, Number(els.brushSize.min) || 1, Number(els.brushSize.max) || 160);
  els.brushSize.value = String(next);
  els.brushSizeValue.textContent = String(next);
  setStatus(`Размер кисти: ${next} px`);
}

function updateMoveCursor(point) {
  if (currentTool !== 'move' || drag) return;
  const layer = selected();
  if (isTransformableLayer(layer) && isLayerVisible(doc, layer) && !isLayerLocked(doc, layer)) {
    const rotatePoint = interactiveRotationHandlePoint(layer);
    if (Math.hypot(point.x - rotatePoint.x, point.y - rotatePoint.y) <= 10 / zoom) { els.overlay.style.cursor = 'grab'; return; }
    const handle = hitLayerHandle(point, layer, 10 / zoom);
    if (handle) { els.overlay.style.cursor = cursorForHandle(handle, layer); return; }
  }
  els.overlay.style.cursor = layer && isLayerVisible(doc, layer) && !isLayerLocked(doc, layer) && pointInLayer(point, layer) ? 'move' : 'default';
}

function visibleSnapTargetRects(layerId) {
  return doc.layers
    .filter(layer => layer.id !== layerId && isLayerVisible(doc, layer))
    .map(layer => frameBounds(layer));
}

function pointerWantsPan(event) {
  return event.button === 1 || (event.button === 0 && (spaceHeld || currentTool === 'hand'));
}

function shouldStartOverlayPointer(event) {
  if (!event.isPrimary || ![0, 1].includes(event.button)) return false;
  if (!pointerWantsPan(event) && paintPersisting && (RASTER_BRUSH_TOOLS.has(currentTool) || currentTool === 'fill' || currentTool === 'line' || currentTool === 'gradient')) {
    setStatus('Сохраняется предыдущая растровая операция…');
    return false;
  }
  return true;
}

async function onOverlayPointerDown(e) {
  const wantsPan = pointerWantsPan(e);
  if (e.button === 1) e.preventDefault();
  const p = canvasPoint(e);
  if (wantsPan) {
    drag = { kind:'pan', x:e.clientX, y:e.clientY, left:els.viewport.scrollLeft, top:els.viewport.scrollTop }; els.overlay.style.cursor='grabbing'; return;
  }
  if (e.button !== 0) return;
  if (currentTool === 'move') {
    let l = selected();
    if (isTransformableLayer(l) && isLayerVisible(doc,l) && !isLayerLocked(doc,l)) {
      const rotatePoint = interactiveRotationHandlePoint(l);
      if (Math.hypot(p.x - rotatePoint.x, p.y - rotatePoint.y) <= 10 / zoom) {
        const frame = layerFrame(l);
        drag = { kind:'rotate', layerId:l.id, moved:false, initialRotation:l.rotation ?? 0, center:frame.center, start:p, lastPointer:p };
        els.overlay.style.cursor = 'grabbing';
        return;
      }
      const handle = hitLayerHandle(p, l, 10 / zoom);
      if (handle) {
        drag = { kind:'resize', layerId:l.id, handle, moved:false, lastPointer:p, initial:{x:l.x,y:l.y,width:l.width,height:l.height,scaleX:l.scaleX,scaleY:l.scaleY,rotation:l.rotation} };
        els.overlay.style.cursor = cursorForHandle(handle, l);
        return;
      }
    }
    if (!isTransformableLayer(l) || isLayerLocked(doc,l) || !isLayerVisible(doc,l) || !pointInLayer(p,l)) l = topLayerAt(p);
    if (l) {
      doc.selectedLayerId = l.id;
      drag = { kind:'move', layerId:l.id, px:p.x, py:p.y, x:l.x, y:l.y, moved:false, lastPointer:p };
      els.overlay.style.cursor='move'; layersPanelController.render(); refreshInspectorPanels(); drawOverlay();
    }
    return;
  }
  if ((currentTool === 'clone' || currentTool === 'heal') && e.altKey) { await setCloneSource(p); return; }
  if (RASTER_BRUSH_TOOLS.has(currentTool)) { await paintGesture.begin({ point:p, pointerEvent:e, tool:currentTool, canContinue:()=>pointerLifecycle.isActivePointer(e.pointerId) }); return; }
  if (currentTool === 'fill') { await fillAtPoint(p); return; }
  if (currentTool === 'gradient') { drag={kind:'gradient',start:p,current:p};drawOverlay();return; }
  if (currentTool === 'wand') { magicWandSelect(p);return; }
  if (currentTool === 'pen') {
    const hit=!penDraft?hitSelectedPathControl(p):null;
    if(hit){beginPathControlDrag(hit,p,e);drawOverlay();return;}
    if(documentPathEditIndex>=0){
      setStatus('Сохранённый контур: перетаскивайте существующие anchors/handles; новые subpaths добавляются через маску/выделение и сохранение');
      return;
    }
    if(vectorMaskEditLayerId===selected()?.id){
      setStatus('Векторная маска: перетаскивайте существующие anchors/handles; новые контуры добавляются через выделение + Add');
      return;
    }
    beginPenPoint(p,e.detail>=2);return;
  }
  if (currentTool === 'magnetic') { selectionGestures.addMagneticPoint(p,{finish:e.detail>=2});return; }
  if (currentTool === 'marquee') {
    const result = selectionGestures.beginMarquee(p,{detail:e.detail});
    if (result?.preventDefault) e.preventDefault();
    if (result?.drag) drag = result.drag;
    return;
  }
  if (currentTool === 'line') { drag = { kind:'line', start:p, current:p }; previewLine(p,p); return; }
  if (currentTool === 'shape') { drag = { kind:'shape', start:p, current:p }; return; }
  if (currentTool === 'crop') { drag = { kind:'crop', start:p, current:p }; cropRect = {x:p.x,y:p.y,width:0,height:0}; drawOverlay(); return; }
  if (currentTool === 'text') { textEditController.open(p); return; }
  if (currentTool === 'eyedropper') { pickColor(p); return; }
  if (currentTool === 'zoom') { setZoomAtClientPoint(zoom*(e.altKey ? 1/1.5 : 1.5),e.clientX,e.clientY); return; }
}

function onOverlayPointerMove(e) {
  const allowOutside = drag && ['move','resize','rotate','paint','path-control'].includes(drag.kind);
  const p = canvasPoint(e, { clampToDocument: !allowOutside });
  if (drag && ['move','resize','rotate'].includes(drag.kind)) drag.lastPointer = p;
  els.pointer.textContent = `x: ${Math.round(p.x)} y: ${Math.round(p.y)}`;
  hoverPoint = p;
  if (!drag) {
    selectionGestures.updateIdleHover(p);
    if(penDraft&&currentTool==='pen')penDraft.hover=p;
    if (currentTool === 'zoom') els.overlay.style.cursor=e.altKey?'zoom-out':'zoom-in';
    else if(currentTool==='pen'&&!penDraft)updatePenCursor(p);
    else updateMoveCursor(p);
    drawOverlay(); return;
  }
  if (drag.kind === 'pan') { els.viewport.scrollLeft = drag.left - (e.clientX-drag.x); els.viewport.scrollTop = drag.top - (e.clientY-drag.y); return; }
  if (drag.kind === 'move') {
    const l = doc.layers.find(x=>x.id===drag.layerId); if (!l || isLayerLocked(doc,l)) return;
    let dx = p.x-drag.px;
    let dy = p.y-drag.py;
    let lockedAxis = null;
    if (e.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; lockedAxis = 'y'; }
      else { dx = 0; lockedAxis = 'x'; }
    }
    let nextX = drag.x + dx;
    let nextY = drag.y + dy;
    if (smartSnapEnabled && !e.ctrlKey && !e.metaKey) {
      const snapped = snapLayerMove(l, nextX, nextY, {
        docWidth: doc.width,
        docHeight: doc.height,
        targetRects: visibleSnapTargetRects(l.id),
        threshold: 8 / zoom,
      });
      nextX = lockedAxis === 'x' ? drag.x : snapped.x;
      nextY = lockedAxis === 'y' ? drag.y : snapped.y;
      smartGuides = {
        x: lockedAxis === 'x' ? null : snapped.guides.x,
        y: lockedAxis === 'y' ? null : snapped.guides.y,
      };
    } else clearSmartGuides();
    l.x = nextX; l.y = nextY;
    drag.moved = Math.abs(l.x-drag.x) > 1e-9 || Math.abs(l.y-drag.y) > 1e-9;
    render(); updateTransformPropertyValues(l); drawOverlay(); return;
  }
  if (drag.kind === 'resize') {
    const l = doc.layers.find(x=>x.id===drag.layerId); if (!l || isLayerLocked(doc,l)) return;
    const next = resizeLayerFromPoint({ ...l, ...drag.initial }, drag.handle, p, {
      minSize: Math.max(2, 6 / zoom),
      lockAspect: e.shiftKey,
      fromCenter: e.altKey,
    });
    l.x=next.x; l.y=next.y; l.scaleX=next.scaleX; l.scaleY=next.scaleY; drag.moved=true;
    render(); updateTransformPropertyValues(l); drawOverlay(); return;
  }
  if (drag.kind === 'rotate') {
    const l = doc.layers.find(x=>x.id===drag.layerId); if (!l || isLayerLocked(doc,l)) return;
    l.rotation = rotationFromDrag(drag.initialRotation, drag.center, drag.start, p, e.shiftKey ? 15 : 0);
    drag.moved = true;
    render(); updateTransformPropertyValues(l); drawOverlay(); return;
  }
  if (drag.kind === 'paint') {
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const event of events.length ? events : [e]) paintGesture.move(canvasPoint(event, { clampToDocument:false }), event);
    rasterEdit.schedulePaintPreview();
    drawOverlay();
    return;
  }
  if (drag.kind === 'marquee') { selectionGestures.updateMarquee(drag,p,{shiftKey:e.shiftKey}); return; }
  if (drag.kind === 'line') { drag.current=e.shiftKey?snapLineEnd(drag.start,p,45):p; previewLine(drag.start,drag.current); return; }
  if (drag.kind === 'shape') { drag.current=p; drag.lockAspect=e.shiftKey; const r=constrainedRect(drag.start,p,e.shiftKey); previewRect(r, els.primaryColor.value); return; }
  if (drag.kind === 'crop') { drag.current=p; cropRect=normalizeRect(drag.start,p); drawOverlay(); return; }
  if (drag.kind === 'gradient') { drag.current=p;previewGradient(drag.start,p);return; }
  if (drag.kind === 'path-control') {
    const layer=drag.pathSource==='document-path'?null:doc.layers.find(item=>item.id===drag.layerId);
    const points=pathTargetPoints(layer,drag.pathSource,drag.subpathIndex,drag.documentPathIndex);
    const node=points?.[drag.nodeIndex];
    if(!node||(layer&&isLayerLocked(doc,layer)))return;
    const local=layer?documentPointToLayerPixel(p,layer):p;
    const distance=Math.hypot(local.x-drag.startLocal.x,local.y-drag.startLocal.y);
    drag.moved=distance>1/zoom;
    if(drag.control==='anchor'){
      const dx=local.x-drag.startLocal.x,dy=local.y-drag.startLocal.y;
      node.x=drag.initial.x+dx;node.y=drag.initial.y+dy;
      node.handleIn=drag.initial.handleIn?{x:drag.initial.handleIn.x+dx,y:drag.initial.handleIn.y+dy}:null;
      node.handleOut=drag.initial.handleOut?{x:drag.initial.handleOut.x+dx,y:drag.initial.handleOut.y+dy}:null;
      node.kind=drag.initial.kind==='smooth'?'smooth':'corner';
    }else{
      node[drag.control]={x:local.x,y:local.y};
      const opposite=drag.control==='handleIn'?'handleOut':'handleIn';
      if(e.altKey)node.kind='corner';
      else{
        node.kind='smooth';
        node[opposite]={x:node.x-(local.x-node.x),y:node.y-(local.y-node.y)};
      }
    }
    render();drawOverlay();return;
  }
  if (drag.kind === 'pen-handle') {
    const node=penDraft?.points?.[drag.nodeIndex];
    if(!node)return;
    const dx=p.x-drag.anchor.x,dy=p.y-drag.anchor.y;
    const moved=Math.hypot(dx,dy)>1/zoom;
    drag.moved=moved;
    if(moved){
      node.handleOut={x:p.x,y:p.y};
      if(e.altKey){node.handleIn=null;node.kind='corner';}
      else{node.handleIn={x:drag.anchor.x-dx,y:drag.anchor.y-dy};node.kind='smooth';}
    }else{
      node.handleIn=null;node.handleOut=null;node.kind='corner';
    }
    penDraft.hover=p;drawOverlay();return;
  }
}
async function onOverlayPointerUp(e) {
  if (drag?.kind === 'pan') onOverlayPointerMove(e);
  else if (drag && ['move','resize','rotate'].includes(drag.kind)) {
    const releasePoint = canvasPoint(e, { clampToDocument:false });
    if (Math.hypot(releasePoint.x-drag.lastPointer.x, releasePoint.y-drag.lastPointer.y) > .01) onOverlayPointerMove(e);
  }
  if (!drag) return;
  if (drag.kind === 'paint') {
    const layer = doc.layers.find(item => item.id === drag.layerId);
    const releasePoint = canvasPoint(e, { clampToDocument:false });
    const localPoint = layer && documentPointToLayerPixel(releasePoint, layer);
    if (localPoint && Math.hypot(localPoint.x-drag.last.x, localPoint.y-drag.last.y) > .01) paintGesture.move(releasePoint, e);
  }
  const d = drag; drag = null;
  if (['marquee','line','shape','crop','gradient'].includes(d.kind)) d.current = canvasPoint(e);
  clearSmartGuides();
  if (d.kind === 'pan') els.overlay.style.cursor = (spaceHeld || currentTool === 'hand') ? 'grab' : defaultToolCursor();
  if (d.kind === 'move' && d.moved) commit('Перемещение слоя');
  if (d.kind === 'resize' && d.moved) commit('Изменить размер слоя');
  if (d.kind === 'rotate' && d.moved) commit('Повернуть слой');
  if (d.kind === 'paint') await paintGesture.end(d);
  if (d.kind === 'marquee') selectionGestures.finishMarquee(d,d.current,{shiftKey:e.shiftKey});
  if (d.kind === 'line') {
    const end=e.shiftKey?snapLineEnd(d.start,d.current,45):d.current;
    if(Math.hypot(end.x-d.start.x,end.y-d.start.y)>2)await drawLineOnCurrentRaster(d.start,end);
    else render();
  }
  if (d.kind === 'shape') {
    const r = constrainedRect(d.start,d.current,e.shiftKey||d.lockAspect);
    if (r.width > 2 && r.height > 2) { addLayer(doc, createShapeLayer({ x:r.x,y:r.y,width:r.width,height:r.height,shape:els.shapeKind.value,fill:els.primaryColor.value,opacity:Number(els.toolOpacity.value)/100 })); commit('Добавить фигуру'); }
    else render();
  }
  if (d.kind === 'crop') {
    const r = normalizeRect(d.start,d.current);
    if (r.width >= 10 && r.height >= 10) applyCrop(r); else { cropRect=null; drawOverlay(); }
  }
  if (d.kind === 'gradient') await applyGradient(d.start,d.current);
  if (d.kind === 'path-control') {
    if(d.moved){
      const vector=d.pathSource==='vector-mask';
      const saved=d.pathSource==='document-path';
      commit(saved
        ? (d.control==='anchor'?'Переместить узел сохранённого контура':'Изменить ручку сохранённого контура')
        : vector
          ? (d.control==='anchor'?'Переместить узел векторной маски':'Изменить ручку векторной маски')
          : (d.control==='anchor'?'Переместить Bézier-узел':'Изменить Bézier-ручку'));
    }else drawOverlay();
  }
  if (d.kind === 'pen-handle') {
    if(penDraft)penDraft.hover=canvasPoint(e);
    setStatus(d.moved
      ? (penDraft?.points?.[d.nodeIndex]?.kind==='smooth'?'Перо: гладкая точка с симметричными ручками':'Перо: угловая точка с независимой ручкой')
      : 'Перо: угловая точка');
    drawOverlay();
  }
  updateMoveCursor(canvasPoint(e));
}
els.overlay.addEventListener('pointerleave', () => { els.pointer.textContent='x: — y: —';hoverPoint=null;drawOverlay(); });
els.overlay.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
async function onOverlayPointerCancel(e) {
  if (!drag) return;
  const d=drag; drag=null; clearSmartGuides();
  if (d.kind==='paint') { await paintGesture.end(d); }
  else {
    if (d.kind==='move') {
      const l=doc.layers.find(x=>x.id===d.layerId); if(l){l.x=d.x;l.y=d.y;render();updateTransformPropertyValues(l);}
    }
    if (d.kind==='resize') {
      const l=doc.layers.find(x=>x.id===d.layerId); if(l){Object.assign(l,d.initial);render();updateTransformPropertyValues(l);}
    }
    if (d.kind==='rotate') {
      const l=doc.layers.find(x=>x.id===d.layerId); if(l){l.rotation=d.initialRotation;render();updateTransformPropertyValues(l);}
    }
    if (d.kind==='crop') cropRect=null;
    if (d.kind==='marquee') selectionGestures.cancelMarquee(d);
    if (d.kind==='pen-handle'&&penDraft){
      penDraft.points.splice(d.nodeIndex,1);
      if(!penDraft.points.length)penDraft=null;
    }
    if(d.kind==='path-control')restorePathControlDrag(d);
    if (d.kind==='pan') els.overlay.style.cursor=defaultToolCursor();
    rasterEdit.cancelPaintPreview(); drawOverlay(); setStatus('Действие отменено');
  }
}

pointerLifecycle = createPointerLifecycleRouter({
  target: els.overlay,
  shouldStartPointer: shouldStartOverlayPointer,
  onPointerDown: onOverlayPointerDown,
  onPointerMove: onOverlayPointerMove,
  onPointerUp: onOverlayPointerUp,
  onPointerCancel: onOverlayPointerCancel,
});

function previewRect(rect, color) {
  drawOverlay(); const ctx=els.overlay.getContext('2d'); ctx.save(); const opacity=Number(els.toolOpacity.value)/100; ctx.fillStyle=color; ctx.strokeStyle=color; ctx.lineWidth=2/zoom;
  if (els.shapeKind.value === 'ellipse') { ctx.beginPath(); ctx.ellipse(rect.x+rect.width/2,rect.y+rect.height/2,rect.width/2,rect.height/2,0,0,Math.PI*2); ctx.globalAlpha=opacity*.25; ctx.fill(); ctx.globalAlpha=opacity; ctx.stroke(); }
  else { ctx.globalAlpha=opacity*.25; ctx.fillRect(rect.x,rect.y,rect.width,rect.height); ctx.globalAlpha=opacity; ctx.strokeRect(rect.x,rect.y,rect.width,rect.height); } ctx.restore();
}

function previewLine(start,end) {
  drawOverlay();
  const ctx=els.overlay.getContext('2d');
  ctx.save();
  ctx.strokeStyle=els.primaryColor.value;
  ctx.globalAlpha=Number(els.toolOpacity.value)/100;
  ctx.lineWidth=Math.max(1,Number(els.brushSize.value)||1);
  ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.restore();
}

function previewGradient(start,end) {
  drawOverlay();
  const ctx=els.overlay.getContext('2d');
  const distance=Math.max(1,Math.hypot(end.x-start.x,end.y-start.y));
  const gradient=els.gradientType?.value==='radial'
    ? ctx.createRadialGradient(start.x,start.y,0,start.x,start.y,distance)
    : ctx.createLinearGradient(start.x,start.y,end.x,end.y);
  gradient.addColorStop(0,els.primaryColor.value);
  gradient.addColorStop(1,els.secondaryColor?.value||'#ffffff');
  ctx.save();
  clipContextToDocumentSelection(ctx);
  ctx.globalAlpha=.48;
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,doc.width,doc.height);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([5/zoom,4/zoom]);
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.fillStyle='#fff';ctx.setLineDash([]);
  for(const point of [start,end]){ctx.beginPath();ctx.arc(point.x,point.y,3/zoom,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

async function applyGradient(start,end){
  const distance=Math.hypot(end.x-start.x,end.y-start.y);if(distance<2){setStatus('Градиент: протяните линию по холсту');return false;}
  if(paintPersisting){setStatus('Сохраняется предыдущая растровая операция…');return false;}
  const canvas=document.createElement('canvas');canvas.width=doc.width;canvas.height=doc.height;const ctx=canvas.getContext('2d',{alpha:true});
  const gradient=els.gradientType?.value==='radial'?ctx.createRadialGradient(start.x,start.y,0,start.x,start.y,distance):ctx.createLinearGradient(start.x,start.y,end.x,end.y);
  gradient.addColorStop(0,els.primaryColor.value);gradient.addColorStop(1,els.secondaryColor?.value||'#ffffff');ctx.fillStyle=gradient;ctx.globalAlpha=Number(els.toolOpacity.value)/100;
  ctx.save();clipContextToDocumentSelection(ctx);ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  paintPersisting=true;
  try{const dataUrl=await canvasToDataURL(canvas,'image/png');addLayer(doc,createRasterLayer({name:'Градиент',x:0,y:0,width:doc.width,height:doc.height,dataUrl}));rasterEdit.clearBrushBuffer();commit('Добавить градиент');setStatus('Градиент добавлен на новый слой');return true;}catch(error){console.error(error);toast('Не удалось создать градиент','error');return false;}
  finally{paintPersisting=false;}
}

function tracePenDraftPath(ctx,points,hover=null){
  if(!Array.isArray(points)||!points.length)return false;
  ctx.moveTo(points[0].x,points[0].y);
  const segment=(from,to)=>{
    const out=from?.handleOut,incoming=to?.handleIn;
    if(out||incoming){
      const cp1=out||from,cp2=incoming||to;
      ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,to.x,to.y);
    }else ctx.lineTo(to.x,to.y);
  };
  for(let index=1;index<points.length;index+=1)segment(points[index-1],points[index]);
  if(hover){
    const last=points.at(-1);
    const cp1=last.handleOut||last;
    ctx.bezierCurveTo(cp1.x,cp1.y,hover.x,hover.y,hover.x,hover.y);
  }
  return true;
}
function beginPenPoint(point,finish=false){
  if(!penDraft)penDraft={points:[],hover:point};
  const last=penDraft.points.at(-1);
  const nearLast=last&&Math.hypot(point.x-last.x,point.y-last.y)<=4/zoom;
  if(finish&&nearLast){
    if(penDraft.points.length>=2)finishPenPath();
    else setStatus('Перо: для контура нужно минимум 2 точки');
    return false;
  }
  const node={x:point.x,y:point.y,handleIn:null,handleOut:null,kind:'corner'};
  penDraft.points.push(node);penDraft.hover=point;
  drag={kind:'pen-handle',nodeIndex:penDraft.points.length-1,anchor:{...point},moved:false};
  setStatus('Перо: клик — угловая точка, тяните — гладкая, Alt+drag — независимая ручка');
  drawOverlay();return true;
}
function penDraftBounds(points){
  const coords=[];
  for(const point of points||[]){
    coords.push({x:point.x,y:point.y});
    if(point.handleIn)coords.push(point.handleIn);
    if(point.handleOut)coords.push(point.handleOut);
  }
  if(!coords.length)return null;
  const xs=coords.map(point=>point.x),ys=coords.map(point=>point.y);
  const x=Math.min(...xs),y=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  return{x,y,width:right-x,height:bottom-y};
}
function localizePenNode(point,bounds){
  const local=position=>position?{x:position.x-bounds.x,y:position.y-bounds.y}:null;
  return{
    x:point.x-bounds.x,y:point.y-bounds.y,
    handleIn:local(point.handleIn),handleOut:local(point.handleOut),
    kind:point.kind==='smooth'?'smooth':'corner',
  };
}
function finishPenPath(){
  if(!penDraft||penDraft.points.length<2){penDraft=null;drag=null;drawOverlay();return false;}
  const points=penDraft.points;penDraft=null;
  if(drag?.kind==='pen-handle')drag=null;
  const bounds=penDraftBounds(points);
  if(!bounds||Math.max(bounds.width,bounds.height)<1)return false;
  const localPoints=points.map(point=>localizePenNode(point,bounds));
  addLayer(doc,createShapeLayer({
    name:'Контур',shape:'path',x:bounds.x,y:bounds.y,
    width:Math.max(1,bounds.width),height:Math.max(1,bounds.height),
    pathPoints:localPoints,pathClosed:Boolean(els.penClosed?.checked),
    fill:'transparent',stroke:els.primaryColor.value,
    strokeWidth:Math.max(1,Number(els.brushSize.value)||1),
    opacity:Number(els.toolOpacity.value)/100
  }));
  commit('Добавить Bézier-контур');setStatus('Bézier-контур добавлен');drawOverlay();return true;
}

function magicWandSelect(point){
  const width=els.canvas.width,height=els.canvas.height,total=width*height;if(total>8_000_000){toast('Волшебная палочка: изображение слишком большое для безопасного выделения','warn');setStatus('Уменьшите изображение до 8 МП для волшебной палочки');return false;}
  const x0=clamp(Math.floor(point.x),0,width-1),y0=clamp(Math.floor(point.y),0,height-1);const data=els.canvas.getContext('2d',{alpha:true}).getImageData(0,0,width,height).data;const seed=(y0*width+x0)*4;const target=[data[seed],data[seed+1],data[seed+2],data[seed+3]];const tolerance=(Number(els.fillTolerance?.value)||0)*4.42;const selectedMask=new Uint8Array(total);const queue=new Int32Array(total);let head=0,tail=0;queue[tail++]=y0*width+x0;selectedMask[y0*width+x0]=1;
  const similar=index=>{const i=index*4;return Math.abs(data[i]-target[0])+Math.abs(data[i+1]-target[1])+Math.abs(data[i+2]-target[2])+Math.abs(data[i+3]-target[3])<=tolerance;};while(head<tail){const index=queue[head++],x=index%width,y=(index/width)|0;const neighbors=[];if(x>0)neighbors.push(index-1);if(x+1<width)neighbors.push(index+1);if(y>0)neighbors.push(index-width);if(y+1<height)neighbors.push(index+width);for(const next of neighbors)if(!selectedMask[next]&&similar(next)){selectedMask[next]=1;queue[tail++]=next;}}
  const edges=new Map();const addEdge=(ax,ay,bx,by)=>{const key=`${ax},${ay}`;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({x:bx,y:by});};for(let index=0;index<total;index+=1){if(!selectedMask[index])continue;const x=index%width,y=(index/width)|0;if(y===0||!selectedMask[index-width])addEdge(x,y,x+1,y);if(x===width-1||!selectedMask[index+1])addEdge(x+1,y,x+1,y+1);if(y===height-1||!selectedMask[index+width])addEdge(x+1,y+1,x,y+1);if(x===0||!selectedMask[index-1])addEdge(x,y+1,x,y);}
  const first=edges.keys().next().value;if(!first)return false;const [sx,sy]=first.split(',').map(Number);const points=[{x:sx,y:sy}];let key=first;for(let guard=0;guard<edges.size+4;guard+=1){const list=edges.get(key);if(!list?.length)break;const next=list.pop();if(!list.length)edges.delete(key);points.push(next);key=`${next.x},${next.y}`;if(key===first)break;}const simplified=points.filter((point,index,array)=>{if(index===0||index===array.length-1)return true;const a=array[index-1],b=array[index+1];return (point.x-a.x)*(b.y-point.y)!==(point.y-a.y)*(b.x-point.x);});if(simplified.length<3)return false;setSelectionShape({type:'polygon',points:simplified});drawOverlay();setStatus(`Волшебная палочка: выделено ${tail.toLocaleString('ru-RU')} px`);return true;
}

function createLineLayerFromPoints(start,end) {
  const dx=end.x-start.x,dy=end.y-start.y;
  const absX=Math.abs(dx),absY=Math.abs(dy);
  let x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),width=Math.max(1,absX),height=Math.max(1,absY),lineMode='diag';
  if(absY<0.5){lineMode='horizontal';y=start.y-.5;height=1;}
  else if(absX<0.5){lineMode='vertical';x=start.x-.5;width=1;}
  return createShapeLayer({
    name:'Линия',shape:'line',fill:'transparent',stroke:els.primaryColor.value,
    strokeWidth:Math.max(1,Number(els.brushSize.value)||1),opacity:Number(els.toolOpacity.value)/100,
    x,y,width,height,lineMode,lineFlip:lineMode==='diag'&&dx*dy<0,
  });
}



function applyNativeHighDepthDab(layer,point,pointerEvent=null,erase=false){
  if(rasterEdit.highDepthPaintLayerId!==layer?.id||!rasterEdit.highDepthPaintBuffer)return false;
  const rgb=hexToRgb(els.primaryColor.value);
  const changed=rasterEdit.highDepthPaintBuffer.model==='cmyk'
    ? applyCmykPixelBufferBrushDab(rasterEdit.highDepthPaintBuffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),rgb8ToDocumentCmyk(rgb),{opacity:Number(els.toolOpacity.value)/100,erase,isAllowed:rasterSelectionPredicate(layer)})
    : applyPixelBufferBrushDab(rasterEdit.highDepthPaintBuffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),rgb,{opacity:Number(els.toolOpacity.value)/100,erase,isAllowed:rasterSelectionPredicate(layer)});
  if(changed){rasterEdit.markHighDepthPreviewDirty();rasterEdit.schedulePaintPreview();}
  return changed>0;
}

function nativeHighDepthStrokeSegment(layer,from,to,pointerEvent=null,erase=false){
  if(rasterEdit.highDepthPaintLayerId!==layer?.id||!rasterEdit.highDepthPaintBuffer)return false;
  const rgb=hexToRgb(els.primaryColor.value);
  const changed=rasterEdit.highDepthPaintBuffer.model==='cmyk'
    ? applyCmykPixelBufferStrokeSegment(rasterEdit.highDepthPaintBuffer,from,to,Math.max(.5,brushWidthForPointer(pointerEvent)/2),rgb8ToDocumentCmyk(rgb),{opacity:Number(els.toolOpacity.value)/100,erase,isAllowed:rasterSelectionPredicate(layer)})
    : applyPixelBufferStrokeSegment(rasterEdit.highDepthPaintBuffer,from,to,Math.max(.5,brushWidthForPointer(pointerEvent)/2),rgb,{opacity:Number(els.toolOpacity.value)/100,erase,isAllowed:rasterSelectionPredicate(layer)});
  if(changed){rasterEdit.markHighDepthPreviewDirty();rasterEdit.schedulePaintPreview();}
  return changed>0;
}



async function setCloneSource(point) {
  const layer=findTopEditableRasterLayerAt(point);
  if(!layer){setStatus(`${TOOL_LABELS[currentTool]}: источник должен находиться на растровом слое`);toast('Alt+кликните по растровому слою','warn');return false;}
  if(!layer.highDepthSource)await rasterEdit.ensureRasterBuffer(layer);
  setRetouchCloneSource({layerId:layer.id,documentPoint:{...point},localPoint:documentPointToLayerPixel(point,layer)});
  doc.selectedLayerId=layer.id;
  setStatus(`Источник для «${TOOL_LABELS[currentTool]}» задан. Рисуйте по этому же слою.`);
  drawOverlay();
  return true;}
function pickColor(p) {
  const ctx=els.canvas.getContext('2d', { alpha:true });
  const x=clamp(Math.floor(p.x),0,Math.max(0,doc.width-1));
  const y=clamp(Math.floor(p.y),0,Math.max(0,doc.height-1));
  const pixel=ctx.getImageData(x,y,1,1).data;
  if(pixel[3]===0){setStatus('Пипетка: прозрачный пиксель');return;}
  const hex='#'+[pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  els.primaryColor.value=hex;els.colorChip.style.background=hex;
  const alpha=pixel[3]===255?'':` • alpha ${Math.round(pixel[3]/255*100)}%`;
  setStatus(`Цвет: ${hex}${alpha}`);
}
function applyCrop(r) {
  const x=Math.round(r.x), y=Math.round(r.y), w=Math.max(1,Math.round(r.width)), h=Math.max(1,Math.round(r.height));
  doc.layers.forEach(l=>{l.x-=x;l.y-=y;}); doc.width=w; doc.height=h; cropRect=null; clearSelectionState(); rasterEdit.clearBrushBuffer(); commit('Кадрирование'); fitToView();
}

function selectAllPixels(){setSelectionShape({type:'rect',rect:{x:0,y:0,width:doc.width,height:doc.height}});drawOverlay();setStatus('Выделен весь холст');}
function deselectPixels(){if(!selectionRect&&!selectionGestures.hasPolygonDraft())return;clearSelectionState();drawOverlay();setStatus('Выделение снято');}
function cropToSelection(){if(!selectionRect){setStatus('Нет активного выделения');return;}if(selectionRect.width<1||selectionRect.height<1)return;applyCrop({...selectionRect});}

function canReplaceDocument() {
  return !dirty || window.confirm('В документе есть несохранённые изменения. Продолжить без сохранения?');
}

async function createNewDialog() {
  if (blockPendingDocumentEdit()) return;
  if (!canReplaceDocument()) return;
  showModal({title:'Новый документ',fields:[{name:'name',label:'Название',value:'Без имени'},{name:'width',label:'Ширина',type:'number',value:'1200',min:'1',max:'12000',required:true},{name:'height',label:'Высота',type:'number',value:'800',min:'1',max:'12000',required:true},{name:'background',label:'Фон',type:'select',value:'transparent',options:[['transparent','Прозрачный'],['#ffffff','Белый'],['#000000','Чёрный']] }],submitLabel:'Создать',onSubmit:async v=>{if(blockPendingDocumentEdit())return false;try{const next=createDocument({name:v.name||'Без имени',width:Number(v.width),height:Number(v.height),background:v.background});history=new HistoryStack(80);setDoc(next,{resetHistory:true,label:'Новый документ'});markDirty(false);queueRecovery({immediate:true});fitToView();}catch(error){toast(error.message,'error');setStatus(error.message);return false;}}});
}

function visibleCanvasCenter() {
  const vr=els.viewport.getBoundingClientRect();
  const cr=els.overlay.getBoundingClientRect();
  return {
    x: clamp((vr.left + vr.width / 2 - cr.left) / zoom, 0, doc.width),
    y: clamp((vr.top + vr.height / 2 - cr.top) / zoom, 0, doc.height),
  };
}
function clientPointToCanvas(clientX, clientY) {
  const r=els.overlay.getBoundingClientRect();
  return {
    x: clamp((clientX-r.left)/zoom, 0, doc.width),
    y: clamp((clientY-r.top)/zoom, 0, doc.height),
  };
}

async function rgbaPixelsToDataUrl(width,height,pixels,label='PSD слой'){
  const size=checkedCanvasSize(width,height,label);
  if(!(pixels instanceof Uint8Array)&&!(pixels instanceof Uint8ClampedArray))throw new Error(`${label}: отсутствуют RGBA-пиксели`);
  if(pixels.length!==size.width*size.height*4)throw new Error(`${label}: неверный размер RGBA-буфера`);
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  const imageData=ctx.createImageData(size.width,size.height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData,0,0);
  return canvasToDataURL(canvas,'image/png');
}

function importPsdVectorMask(sourceMask, layer) {
  if(!sourceMask?.subpaths?.length)return null;
  const localize=node=>{
    const anchor=documentPointToLayerPixel(node,layer);
    return{
      x:anchor.x,y:anchor.y,
      handleIn:node.handleIn?documentPointToLayerPixel(node.handleIn,layer):null,
      handleOut:node.handleOut?documentPointToLayerPixel(node.handleOut,layer):null,
      kind:node.kind==='smooth'?'smooth':'corner',
    };
  };
  return createVectorMask({
    enabled:sourceMask.enabled!==false,
    invert:sourceMask.invert===true,
    linked:sourceMask.linked!==false,
    fillStartsWithAllPixels:sourceMask.fillStartsWithAllPixels===true,
    subpaths:sourceMask.subpaths.map(subpath=>({
      operation:['add','subtract','intersect','exclude'].includes(subpath.operation)?subpath.operation:'add',
      closed:subpath.closed!==false,
      fillRule:subpath.fillRule==='even-odd'?'even-odd':'non-zero',
      points:(subpath.points||[]).map(localize),
    })).filter(subpath=>subpath.points.length>=2),
  });
}

function exportPsdVectorMask(layer) {
  const source=layer?.vectorMask;
  if(!source?.subpaths?.length)return null;
  const documentize=node=>{
    const anchor=layerPixelToDocumentPoint(node,layer);
    return{
      x:anchor.x,y:anchor.y,
      handleIn:node.handleIn?layerPixelToDocumentPoint(node.handleIn,layer):null,
      handleOut:node.handleOut?layerPixelToDocumentPoint(node.handleOut,layer):null,
      kind:node.kind==='smooth'?'smooth':'corner',
    };
  };
  return{
    enabled:source.enabled!==false,
    invert:source.invert===true,
    linked:source.linked!==false,
    fillStartsWithAllPixels:source.fillStartsWithAllPixels===true,
    subpaths:source.subpaths.map(subpath=>({
      operation:['add','subtract','intersect','exclude'].includes(subpath.operation)?subpath.operation:'add',
      closed:subpath.closed!==false,
      fillRule:subpath.fillRule==='even-odd'?'even-odd':'non-zero',
      points:(subpath.points||[]).map(documentize),
    })).filter(subpath=>subpath.points.length>=2),
  };
}

function psdOpaqueBlockToState(block){
  if(!block?.key||!(block.data instanceof Uint8Array))return null;
  return{
    signature:block.signature==='8B64'?'8B64':'8BIM',
    key:String(block.key).slice(0,4),
    dataUrl:bytesToDataUrl(block.data,'application/octet-stream'),
  };
}

function adjustmentNumberField(label,key,value,min,max,step='1') {
  return '<label>'+escapeHtml(label)+'</label><input type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+Number(value)+'" data-adjustment-prop="'+escapeAttr(key)+'">';
}

function levelRecordMarkup(label,prefix,record) {
  const value=record||{inputBlack:0,inputWhite:255,gamma:1,outputBlack:0,outputWhite:255};
  return '<label>'+escapeHtml(label)+'</label><span>Levels channel</span>'+
    adjustmentNumberField('Input black',prefix+'.inputBlack',value.inputBlack,0,253)+
    adjustmentNumberField('Input white',prefix+'.inputWhite',value.inputWhite,2,255)+
    adjustmentNumberField('Gamma',prefix+'.gamma',value.gamma,.1,9.99,'0.01')+
    adjustmentNumberField('Output black',prefix+'.outputBlack',value.outputBlack,0,255)+
    adjustmentNumberField('Output white',prefix+'.outputWhite',value.outputWhite,0,255);
}

function curvePointsInputValue(points) {
  return (Array.isArray(points)?points:[]).map(point=>Math.round(Number(point.input))+':'+Math.round(Number(point.output))).join(', ');
}

function adjustmentCurveField(label,id,points) {
  const value=points?.length?points:[{input:0,output:0},{input:255,output:255}];
  return '<label>'+escapeHtml(label)+'</label><input type="text" value="'+escapeAttr(curvePointsInputValue(value))+'" data-adjustment-curve-channel="'+id+'" title="Формат: input:output, например 0:0, 128:160, 255:255">';
}

function adjustmentPropertiesMarkup(layer) {
  const value=sanitizeAdjustmentModel(layer?.adjustment);
  if(!value)return'<label>Параметры</label><span>Generic ZPE filters</span>';
  const native=layer.psdAdjustment?psdAdjustmentNativePlan(layer):null;
  const nativeInfo=layer.psdAdjustment?'<label>Photoshop Adjustment</label><span>'+(native?.eligible?'native '+escapeHtml(value.kind)+' round-trip':'composite fallback: '+escapeHtml(native?.reason||'metadata unavailable'))+'</span>':'';
  const clipping='<label>Clipping</label><label><input type="checkbox" data-adjustment-clipping '+(layer.clipping?'checked':'')+'> к alpha нижележащего base layer</label>';
  if(value.kind==='brightness-contrast')return adjustmentNumberField('Яркость','brightness',value.brightness,-150,150)+adjustmentNumberField('Контраст','contrast',value.contrast,-100,100)+clipping+nativeInfo;
  if(value.kind==='exposure')return adjustmentNumberField('Exposure','exposure',value.exposure,-20,20,'0.05')+adjustmentNumberField('Offset','offset',value.offset,-2,2,'0.005')+adjustmentNumberField('Gamma','gamma',value.gamma,.1,10,'0.01')+clipping+nativeInfo;
  if(value.kind==='hue-saturation')return adjustmentNumberField('Hue','hue',value.hue,-180,180)+adjustmentNumberField('Saturation','saturation',value.saturation,-100,100)+adjustmentNumberField('Lightness','lightness',value.lightness,-100,100)+clipping+nativeInfo;
  if(value.kind==='invert')return '<label>Инверсия</label><span>Параметров нет</span>'+clipping+nativeInfo;
  if(value.kind==='posterize')return adjustmentNumberField('Уровни','levels',value.levels,2,255)+clipping+nativeInfo;
  if(value.kind==='threshold')return adjustmentNumberField('Порог','level',value.level,1,255)+clipping+nativeInfo;
  if(value.kind==='levels'){
    const byId=new Map((value.channels||[]).map(channel=>[channel.id,channel]));
    return levelRecordMarkup('Master','master',value.master)+
      levelRecordMarkup('Red','channels.1',byId.get(1))+
      levelRecordMarkup('Green','channels.2',byId.get(2))+
      levelRecordMarkup('Blue','channels.3',byId.get(3))+
      clipping+nativeInfo;
  }
  if(value.kind==='curves'){
    const byId=new Map((value.channels||[]).map(channel=>[channel.id,channel.points]));
    return '<label>Curves</label><span>2–19 точек; input должен возрастать 0..255</span>'+
      adjustmentCurveField('Master / RGB',0,byId.get(0))+
      adjustmentCurveField('Red',1,byId.get(1))+
      adjustmentCurveField('Green',2,byId.get(2))+
      adjustmentCurveField('Blue',3,byId.get(3))+
      clipping+nativeInfo;
  }
  return clipping+nativeInfo;
}

function updateAdjustmentProperty(layer,path,raw) {
  if(!layer||layer.type!=='adjustment'||isLayerLocked(doc,layer))return false;
  const current=structuredClone(sanitizeAdjustmentModel(layer.adjustment));
  if(!current)return false;
  const value=Number(raw);if(!Number.isFinite(value))return false;
  if(path.startsWith('master.')){
    if(!current.master)return false;
    current.master[path.split('.')[1]]=value;
  }else{
    const channelMatch=String(path).match(/^channels\.(\d+)\.(inputBlack|inputWhite|gamma|outputBlack|outputWhite)$/);
    if(channelMatch&&current.kind==='levels'){
      const id=Number(channelMatch[1]),key=channelMatch[2];
      let channel=(current.channels||[]).find(item=>item.id===id);
      if(!channel){
        channel={id,inputBlack:0,inputWhite:255,gamma:1,outputBlack:0,outputWhite:255};
        current.channels=[...(current.channels||[]),channel];
      }
      channel[key]=value;
    }else current[path]=value;
  }
  layer.adjustment=sanitizeAdjustmentModel(current);
  markDirty(true);commit('Изменить Photoshop adjustment');return true;
}

function parseCurvePointsInput(raw) {
  const tokens=String(raw||'').split(/[;,]+/).map(item=>item.trim()).filter(Boolean);
  if(tokens.length<2||tokens.length>19)return null;
  const points=tokens.map(token=>{
    const match=token.match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
    if(!match)return null;
    return{input:Number(match[1]),output:Number(match[2])};
  });
  if(points.some(point=>!point||point.input<0||point.input>255||point.output<0||point.output>255))return null;
  points.sort((a,b)=>a.input-b.input);
  for(let index=1;index<points.length;index+=1)if(points[index].input<=points[index-1].input)return null;
  return points;
}

function updateAdjustmentCurveChannel(layer,id,raw) {
  if(!layer||layer.type!=='adjustment'||isLayerLocked(doc,layer))return false;
  const current=structuredClone(sanitizeAdjustmentModel(layer.adjustment));
  if(current?.kind!=='curves')return false;
  const points=parseCurvePointsInput(raw);
  if(!points)return false;
  const channelId=Number(id);
  current.channels=(current.channels||[]).filter(channel=>channel.id!==channelId);
  current.channels.push({id:channelId,points});
  current.channels.sort((a,b)=>a.id-b.id);
  layer.adjustment=sanitizeAdjustmentModel(current);
  markDirty(true);commit('Изменить точки Photoshop Curves');return true;
}

function bindAdjustmentControls(root,layer) {
  root?.querySelectorAll('[data-adjustment-prop]').forEach(input=>input.addEventListener('change',()=>{
    if(!updateAdjustmentProperty(layer,input.dataset.adjustmentProp,input.value)){refreshInspectorPanels();setStatus('Некорректный параметр adjustment layer');}
  }));
  root?.querySelectorAll('[data-adjustment-curve-channel]').forEach(input=>input.addEventListener('change',()=>{
    if(!updateAdjustmentCurveChannel(layer,input.dataset.adjustmentCurveChannel,input.value)){refreshInspectorPanels();setStatus('Curves: используйте 2–19 точек в формате input:output, 0..255');}
  }));
  const clippingInput=root?.querySelector('[data-adjustment-clipping]');
  clippingInput?.addEventListener('change',()=>{
    if(isLayerLocked(doc,layer)){refreshInspectorPanels();return;}
    layer.clipping=clippingInput.checked;
    markDirty(true);commit('Изменить clipping adjustment layer');
  });
}
async function openProject(file) {
  if (blockPendingDocumentEdit()) return;
  if (!canReplaceDocument()) return;
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  const targetHistoryEntry=history.current();
  const targetChangeSerial=documentChangeSerial;
  try {
    const raw=await readFileAsText(file);
    const data=sanitizeProject(JSON.parse(raw));
    if(doc!==targetDocument||activeSessionId!==targetSessionId||
      history.current()!==targetHistoryEntry||documentChangeSerial!==targetChangeSerial){
      setStatus('Открытие отменено: документ изменился во время чтения файла');
      toast('Повторите открытие проекта в нужной вкладке','warn');
      return;
    }
    if(blockPendingDocumentEdit())return;
    history=new HistoryStack(80);
    setDoc(data,{resetHistory:true,label:'Открыть проект'});
    markDirty(false);
    queueRecovery({immediate:true});
    fitToView();
    setStatus('Проект открыт');
    toast('Открыт проект: '+file.name,'success');
  }catch(e){
    console.error(e);
    alert('Не удалось открыть проект: '+e.message);
    setStatus('Ошибка открытия проекта');
  }
}
function saveProject() { if(blockPendingDocumentEdit())return; const session=currentSession(); if(session?.smartObjectLink){saveSmartObjectContent(session);return;} const name=`${safeFilename(doc.name)}.zpe`; downloadText(JSON.stringify(doc,null,2),name,'application/json'); queueRecovery({immediate:true}); setStatus(`Скачивание ${name} запущено. Проверьте файл перед закрытием вкладки`); }

async function exportPsdDocument(exportDoc,{psb=false}={}){
  const format=psb?'PSB':'PSD';
  setStatus(`${format}: подготовка слоёв…`);
  const prepared=await preparePsdExport(exportDoc);
  setStatus(`${format}: упаковка ${prepared.colorMode.toUpperCase()} ${prepared.bitsPerChannel}-bit каналов…`);
  const encodeBlob=psb?encodePsbBlob:encodePsdBlob;
  const profile=exportDoc.colorProfile;
  const iccProfile=profile?.kind==='icc'&&profile.dataUrl
    ? dataUrlToBytes(profile.dataUrl,{maxBytes:4*1024*1024})
    : null;
  const blob=encodeBlob({
    width:exportDoc.width,height:exportDoc.height,
    layers:prepared.layers,groups:prepared.groups,paths:prepared.paths,linkedLayerBlocks:prepared.linkedLayerBlocks,composite:prepared.composite,
    compositePixelBuffer:prepared.compositePixelBuffer,bitsPerChannel:prepared.bitsPerChannel,colorMode:prepared.colorMode,
    iccProfile,iccUntagged:Boolean(profile?.untagged),
    maxPixels:48_000_000,maxLayers:500,
  });
  const filename=`${safeFilename(exportDoc.name)}.${psb?'psb':'psd'}`;
  downloadBlob(blob,filename);
  if(prepared.warnings.length){
    console.warn(`${format} export warnings`,prepared.warnings);
    setStatus(`Экспортирован ${filename} с ограничениями: ${prepared.warnings.length}`);
    toast(`${format} экспортирован с ограничениями: ${prepared.warnings.length}. Подробности — в консоли`,'warn');
  }else{
    setStatus(`Экспортирован ${filename}`);
    toast(`${format} экспортирован`,'success');
  }
}

async function exportDialog() { if(blockPendingDocumentEdit())return; showModal({title:'Экспорт изображения',fields:[{name:'format',label:'Формат',type:'select',value:'image/png',options:[['image/png','PNG'],['image/jpeg','JPEG'],['image/webp','WebP'],['image/vnd.adobe.photoshop','PSD — RGB/CMYK слои 8/16/32-bit'],['psb','PSB — RGB/CMYK Large Document 8/16/32-bit']]},{name:'quality',label:'Качество',type:'number',value:'92',min:'1',max:'100'}],submitLabel:'Экспорт',onSubmit:async v=>{if(blockPendingDocumentEdit())return false;try{setStatus('Экспорт…');const type=v.format;const exportDoc=restoreDocument(snapshotDocument(doc));if(type==='image/vnd.adobe.photoshop'){await exportPsdDocument(exportDoc);return;}if(type==='psb'){await exportPsdDocument(exportDoc,{psb:true});return;}const blob=await compositeToBlob(exportDoc,type,clamp(Number(v.quality)/100,.01,1));const filename=`${safeFilename(exportDoc.name)}.${MIME_EXT[type]}`;downloadBlob(blob,filename);setStatus(`Экспортирован ${filename}`);}catch(e){console.error(e);alert(e.message);setStatus('Ошибка экспорта');}}}); }

function toggleSelectedVisibility() {
  const l=selected(); if(!l)return;
  l.visible=!l.visible; commit(l.visible?'Показать слой':'Скрыть слой');
}
function toggleSelectedLock() {
  const l=selected(); if(!l)return;
  const group=l.groupId ? doc.groups?.find(item=>item.id===l.groupId) : null;
  if(group?.locked){setStatus('Слой заблокирован группой');return;}
  l.locked=!l.locked; commit(l.locked?'Заблокировать слой':'Разблокировать слой');
}
function nudgeSelected(dx,dy) {
  const l=selected(); if(!l || isLayerLocked(doc,l))return;
  l.x+=dx; l.y+=dy; commit('Сдвинуть слой');
}
function selectAdjacentLayer(direction) {
  if (!doc.layers.length) return;
  const index=Math.max(0,doc.layers.findIndex(l=>l.id===doc.selectedLayerId));
  const next=clamp(index+direction,0,doc.layers.length-1);
  doc.selectedLayerId=doc.layers[next].id; updateAll();
}

function centerSelectedLayer() {
  const l=selected();if(!isTransformableLayer(l)||isLayerLocked(doc,l))return;
  const frame=layerFrame(l);
  l.x += doc.width/2-frame.center.x;
  l.y += doc.height/2-frame.center.y;
  commit('Центрировать слой');
}
function alignSelectedLayer(mode) {
  const l=selected();
  if(!l){setStatus('Сначала выберите слой');return;}
  if(!isTransformableLayer(l)){setStatus('Корректирующий слой не имеет геометрической трансформации');return;}
  if(isLayerLocked(doc,l)){setStatus('Слой или его группа заблокированы');return;}
  const next=alignLayerToCanvas(l,mode,doc.width,doc.height);
  if(!next.changed){setStatus('Слой уже выровнен');return;}
  l.x=next.x;l.y=next.y;
  const labels={left:'по левому краю',hcenter:'по центру горизонтально',right:'по правому краю',top:'по верхнему краю',vcenter:'по центру вертикально',bottom:'по нижнему краю'};
  commit(`Выровнять слой ${labels[mode]||''}`.trim());
  setStatus(`Слой выровнен ${labels[mode]||''}`.trim());
}
function fitSelectedLayerToCanvas() {
  const l=selected();if(!isTransformableLayer(l)||isLayerLocked(doc,l))return;
  const bounds=frameBounds(l);
  if(bounds.width<=0||bounds.height<=0)return;
  const ratio=Math.min(doc.width/bounds.width,doc.height/bounds.height);
  if(!Number.isFinite(ratio)||ratio<=0)return;
  l.scaleX=(l.scaleX??1)*ratio;l.scaleY=(l.scaleY??1)*ratio;
  const frame=layerFrame(l);
  l.x += doc.width/2-frame.center.x;
  l.y += doc.height/2-frame.center.y;
  commit('Вписать слой в холст');
}

function setDocumentBackground() {
  showModal({title:'Фон документа',fields:[{name:'background',label:'Фон',type:'select',value:doc.background,options:[['transparent','Прозрачный'],['#ffffff','Белый'],['#000000','Чёрный'],[els.primaryColor.value,'Основной цвет']]}],submitLabel:'Применить',onSubmit:v=>{doc.background=v.background;commit('Фон документа');}});
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { console.warn(error); toast('Полноэкранный режим недоступен','error'); }
}
function showShortcuts() {
  showInfoModal('Горячие клавиши',`<div class="shortcut-list">
    <b>Ctrl+N</b><span>Новый документ</span><b>Ctrl+O</b><span>Открыть изображение</span>
    <b>Ctrl+S</b><span>Сохранить проект .zpe</span><b>Ctrl+Shift+S</b><span>Экспорт</span>
    <b>Ctrl+C / Ctrl+X</b><span>Копировать / вырезать активное выделение</span><b>Ctrl+V</b><span>Вставить изображение из буфера</span>
    <b>Ctrl+Z / Ctrl+Y</b><span>Отмена / повтор</span><b>Ctrl+A / Ctrl+D</b><span>Выделить всё / снять выделение</span>
    <b>V / M / B / E</b><span>Перемещение / выделение / кисть / ластик</span><b>Shift+M</b><span>Переключить тип выделения</span><b>R</b><span>Кисть размытия</span>
    <b>G / L / T / U</b><span>Заливка / линия / текст / фигура</span>
    <b>C / I / H / Z</b><span>Кадрирование / пипетка / рука / лупа</span><b>Delete</b><span>Очистить активное выделение на растровом слое</span>
    <b>Стрелки</b><span>Сдвинуть выбранный слой на 1 px (Shift — 10 px)</span><b>Shift + перетаскивание</b><span>Перемещать слой строго по горизонтали / вертикали</span>
    <b>Ctrl + перетаскивание</b><span>Временно отключить умную привязку</span><b>Shift + ручка</b><span>Изменить размер с сохранением пропорций</span><b>Alt + ручка</b><span>Масштабировать от центра</span>
    <b>Shift + поворот</b><span>Поворот с шагом 15°</span><b>Shift + выделение / фигура / линия</b><span>Квадрат / круг для прямоугольного/эллиптического выделения и фигур; линия с шагом 45°</span>
    <b>[ / ]</b><span>Уменьшить / увеличить размер кисти (Shift — крупнее шаг)</span><b>Перо</b><span>Нажим пера автоматически влияет на размер кисти/ластика</span>    <b>Space / средняя кнопка</b><span>Временно перемещать холст</span><b>Alt/Ctrl + колесо</b><span>Масштаб холста под курсором (до 1600%)</span>
    <b>Ctrl + / −</b><span>Увеличить / уменьшить масштаб</span><b>Ctrl+0 / Ctrl+1</b><span>Вписать в окно / 100%</span>
    <b>Tab</b><span>Режим холста: скрыть / показать боковые панели</span><b>F2</b><span>Переименовать выбранный слой</span>
    <b>Панель «Слои»</b><span>Кнопка группы создаёт папку; перетащите слой на заголовок группы, чтобы поместить его внутрь</span>
  </div>`);
}
function currentAppVersion(){
  return document.querySelector('meta[name="application-version"]')?.content?.trim() || 'dev';
}
function showAbout() {
  showInfoModal('О ZeTer Photo Editor',`<div class="about-copy"><strong>ZeTer Photo Editor ${escapeHtml(currentAppVersion())}</strong><p>Браузерный графический редактор со слоями, историей, умной привязкой, выделением, кистью, заливкой, линиями, текстом, фигурами и экспортом. Работает онлайн и локально; изображения обрабатываются в браузере.</p><p>Формат проекта: <code>.zpe</code>.</p><div class="developer-card"><span>Разработчик</span><strong>Дмитрий Колесниченко</strong><a href="mailto:zeter11@gmail.com">zeter11@gmail.com</a><a href="https://t.me/zeterchat" target="_blank" rel="noopener noreferrer">Telegram: @zeterchat</a></div></div>`);
}

function undo(){if(blockPendingDocumentEdit())return;const entry=history.undo();if(!entry)return;doc=restoreDocument(entry.snapshot);clearSelectionState();rasterEdit.clearBrushBuffer();updateAll();markDirty(true);setStatus(`Отменено → ${entry.label}`);}
function redo(){if(blockPendingDocumentEdit())return;const entry=history.redo();if(!entry)return;doc=restoreDocument(entry.snapshot);clearSelectionState();rasterEdit.clearBrushBuffer();updateAll();markDirty(true);setStatus(`Повторено → ${entry.label}`);}
function deleteSelected(){if(blockPendingDocumentEdit())return;const l=selected();if(!l)return;if(isLayerLocked(doc,l)){setStatus('Слой или его группа заблокированы');return;}removeLayer(doc,l.id);commit('Удалить слой');}
function duplicateSelected(){const l=selected();if(!l)return;if(isLayerLocked(doc,l)){setStatus('Слой или его группа заблокированы');return;}if(duplicateLayer(doc,l.id))commit('Дублировать слой');}
function renameLayer(layer){if(!layer||isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return;}showModal({title:'Переименовать слой',fields:[{name:'name',label:'Имя',value:layer.name,required:true}],submitLabel:'Переименовать',onSubmit:v=>{const name=String(v.name||'').trim();if(!name||name===layer.name)return;layer.name=name;commit('Переименовать слой');}});}
function addGroup(parentGroupId=null){
  const parent=parentGroupId?doc.groups?.find(group=>group.id===parentGroupId):null;
  if(parentGroupId&&!parent){setStatus('Родительская группа не найдена');return null;}
  if(parent&&isGroupLocked(doc,parent)){setStatus('Родительская группа заблокирована');return null;}
  const number=(doc.groups?.length||0)+1;
  const group=addLayerGroup(doc,createLayerGroup({name:`Группа ${number}`,parentGroupId:parent?.id??null}));
  if(parent)parent.collapsed=false;
  commit(parent?'Новая подгруппа':'Новая группа слоёв');
  setStatus(parent?`Создана подгруппа «${group.name}» в «${parent.name}»`:`Создана группа «${group.name}». Перетащите на неё нужные слои.`);
  return group;
}
const GROUP_BLEND_OPTIONS=[
  ['pass-through','Пропускать (Pass Through)'],
  ['source-over','Обычный (Normal)'],
  ['multiply','Умножение'],
  ['screen','Экран'],
  ['overlay','Перекрытие'],
  ['soft-light','Мягкий свет'],
  ['hard-light','Жёсткий свет'],
  ['darken','Затемнение'],
  ['lighten','Осветление'],
  ['color-dodge','Осветление основы'],
  ['color-burn','Затемнение основы'],
  ['difference','Разница'],
  ['exclusion','Исключение'],
];
function renameGroup(group){if(!group||isGroupLocked(doc,group)){setStatus('Группа или её родитель заблокированы');return;}showModal({title:'Переименовать группу',fields:[{name:'name',label:'Имя',value:group.name,required:true}],submitLabel:'Переименовать',onSubmit:v=>{const name=String(v.name||'').trim();if(!name||name===group.name)return;group.name=name;commit('Переименовать группу');}});}
function editGroupProperties(group){
  if(!group||isGroupLocked(doc,group)){setStatus('Группа или её родитель заблокированы');return;}
  showModal({
    title:'Параметры группы',
    fields:[
      {name:'blendMode',label:'Режим наложения',type:'select',value:group.blendMode||'pass-through',options:GROUP_BLEND_OPTIONS},
      {name:'opacity',label:'Непрозрачность, %',type:'number',value:Math.round(clamp(Number(group.opacity??1),0,1)*100),min:0,max:100,step:1,required:true},
    ],
    submitLabel:'Применить',
    onSubmit:v=>{
      const blendMode=GROUP_BLEND_OPTIONS.some(([value])=>value===v.blendMode)?v.blendMode:'pass-through';
      const opacity=clamp(Number(v.opacity)/100,0,1);
      if(group.blendMode===blendMode&&Math.abs(Number(group.opacity??1)-opacity)<1e-9)return;
      group.blendMode=blendMode;
      group.opacity=opacity;
      commit('Параметры группы');
    },
  });
}
function deleteLayerGroup(group){
  if(!group)return;
  if(isGroupLocked(doc,group)){setStatus('Сначала разблокируйте группу и её родителей');return;}
  if(removeLayerGroup(doc,group.id)){commit('Удалить группу слоёв');setStatus('Группа удалена, содержимое перенесено на уровень выше');}
}
function layerContextMenu(id) {
  const owner=doc;
  const target = () => doc===owner ? doc.layers.find(item => item.id === id) : null;
  const editable = () => Boolean(target()) && !isLayerLocked(doc, target());
  const selectedTarget = () => selected()?.id===id && Boolean(target());
  return [
    ['Параметры наложения…','',()=>openBlendingOptions(target()),editable],
    ['Редактировать содержимое смарт-объекта','',()=>openSmartObjectContents(target()),()=>Boolean(target())&&target().type==='smart-object'&&Boolean(target().embeddedDocument)],
    ['Создать связанную копию смарт-объекта','',()=>createLinkedSmartObjectCopy(target()),()=>Boolean(target())&&target().type==='smart-object'&&Boolean(target().embeddedDocument)&&!target().psdSmartObject&&editable()],
    ['Разорвать связь смарт-объекта','',()=>unlinkSmartObject(target()),()=>Boolean(target()?.linkedSourceId)&&editable()],
    ['Добавить смарт-фильтр…','',()=>openSmartFilterDialog(target()),()=>Boolean(target())&&target().type==='smart-object'&&editable()&&hasSmartFilterCapacity(target())],
    ['Очистить смарт-фильтры','',()=>clearSmartFilters(target()),()=>Boolean(target())&&target().type==='smart-object'&&editable()&&Boolean(target().smartFilters?.length)],
    ['Маска смарт-фильтров: показать всё','',()=>{void setSmartFilterMask(target(),false);},()=>Boolean(target())&&target().type==='smart-object'&&editable()&&Boolean(target().smartFilters?.length)&&!target().smartFilterMask],
    ['Маска смарт-фильтров из выделения','',()=>{void setSmartFilterMask(target(),true);},()=>Boolean(target())&&target().type==='smart-object'&&editable()&&Boolean(target().smartFilters?.length)&&Boolean(selectionShape)],
    ['Инвертировать маску смарт-фильтров','',()=>invertSmartFilterMask(target()),()=>Boolean(target()?.smartFilterMask)&&editable()],
    ['Включить / отключить маску смарт-фильтров','',()=>toggleSmartFilterMask(target()),()=>Boolean(target()?.smartFilterMask)&&editable()],
    ['Удалить маску смарт-фильтров','',()=>removeSmartFilterMask(target()),()=>Boolean(target()?.smartFilterMask)&&editable()],
    ['Преобразовать в смарт-объект','',()=>{if(selectedTarget())convertSelectedToSmartObject();},()=>selectedTarget()&&editable()&&!['smart-object','adjustment'].includes(target().type)],
    ['sep'],
    ['Переименовать…','F2',()=>renameLayer(target()),editable],
    ['Дублировать','Ctrl+J',()=>{if(selectedTarget())duplicateSelected();},()=>selectedTarget() && editable()],
    ['Удалить','Delete',()=>{if(selectedTarget())deleteSelected();},()=>selectedTarget() && editable()],
    ['sep'],
    ['Добавить маску (показать всё)','',()=>addSelectedLayerMask(false),()=>selectedTarget() && editable() && !target().mask],
    ['Добавить маску из выделения','',()=>addSelectedLayerMask(true),()=>selectedTarget() && editable() && !target().mask && Boolean(selectionShape)],
    ['Удалить маску','',removeSelectedLayerMask,()=>selectedTarget() && editable() && Boolean(target().mask)],
    ['sep'],
    ['Создать векторную маску из выделения','',()=>applySelectionToVectorMask('replace'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&!target().vectorMask],
    ['Заменить векторную маску выделением','',()=>applySelectionToVectorMask('replace'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Добавить выделение к векторной маске','',()=>applySelectionToVectorMask('add'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Вычесть выделение из векторной маски','',()=>applySelectionToVectorMask('subtract'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Пересечь векторную маску с выделением','',()=>applySelectionToVectorMask('intersect'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Исключить пересечение из векторной маски','',()=>applySelectionToVectorMask('exclude'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Редактировать векторную маску пером','',editSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['Инвертировать векторную маску','',invertSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['Включить / отключить векторную маску','',toggleSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['Удалить векторную маску','',removeSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['sep'],
    ['Показать / скрыть','',toggleSelectedVisibility,()=>Boolean(target())],
    ['Заблокировать / разблокировать','',toggleSelectedLock,()=>{const layer=target();const group=layer?.groupId?doc.groups?.find(item=>item.id===layer.groupId):null;return Boolean(layer)&&!(group&&isGroupLocked(doc,group));}],
    ['sep'],
    ['Поднять слой','',()=>{if(moveLayer(doc,id,1))commit('Поднять слой');},editable],
    ['Опустить слой','',()=>{if(moveLayer(doc,id,-1))commit('Опустить слой');},editable],
    ['Растеризовать','',rasterizeSelectedLayer,()=>editable() && target().type !== 'raster' && target().type !== 'adjustment'],
  ];
}
function groupContextMenu(id) {
  const owner=doc;
  const target = () => doc===owner ? doc.groups?.find(item => item.id === id) : null;
  return [
    ['Создать подгруппу','',()=>addGroup(id),()=>Boolean(target()) && !isGroupLocked(doc,target())],
    ['Параметры группы…','',()=>editGroupProperties(target()),()=>Boolean(target()) && !isGroupLocked(doc,target())],
    ['Переименовать…','',()=>renameGroup(target()),()=>Boolean(target()) && !isGroupLocked(doc,target())],
    ['Свернуть / развернуть','',()=>{const group=target();if(group){group.collapsed=!group.collapsed;layersPanelController.render();}},()=>Boolean(target())],
    ['Показать / скрыть','',()=>{const group=target();if(group){group.visible=group.visible===false;commit(group.visible?'Показать группу слоёв':'Скрыть группу слоёв');}},()=>Boolean(target())],
    ['Заблокировать / разблокировать','',()=>{const group=target();if(group&&!group.parentGroupId||group&&!isGroupLocked(doc,doc.groups?.find(item=>item.id===group.parentGroupId))){group.locked=!group.locked;commit(group.locked?'Заблокировать группу слоёв':'Разблокировать группу слоёв');}},()=>{const group=target();const parent=group?.parentGroupId?doc.groups?.find(item=>item.id===group.parentGroupId):null;return Boolean(group)&&!(parent&&isGroupLocked(doc,parent));}],
    ['sep'],
    ['Удалить группу (содержимое останется)','',()=>deleteLayerGroup(target()),()=>Boolean(target()) && !isGroupLocked(doc,target())],
  ];
}
function addBlankLayer(){addLayer(doc,createRasterLayer({name:'Новый слой',width:doc.width,height:doc.height,dataUrl:null}));rasterEdit.clearBrushBuffer();commit('Новый растровый слой');}

function addAdjustmentLayer(){
  const layer=createAdjustmentLayer({name:'Корректирующий слой',width:doc.width,height:doc.height});
  addLayer(doc,layer);commit('Новый корректирующий слой');
  setStatus('Корректирующий слой применяет цвет и эффекты ко всему нижележащему стеку');
}

function layerMaskSummary(layer){
  const parts=[];
  if(layer?.mask)parts.push(layer.mask.enabled===false?'растровая отключена':layer.mask.dataUrl?'растровая':'растровая: показать всё');
  if(layer?.vectorMask){
    const count=layer.vectorMask.subpaths?.length||0,state=layer.vectorMask.enabled===false?'отключена':layer.vectorMask.invert?'инвертирована':'включена';
    parts.push(`векторная: ${count} контур(ов), ${state}`);
  }
  if(layer?.smartFilterMask){
    const state=layer.smartFilterMask.enabled===false?'отключена':layer.smartFilterMask.invert?'инвертирована':'включена';
    parts.push(`смарт-фильтры: маска ${state}`);
  }
  return parts.join(' + ')||'нет';
}

function resizeImageDialog(){
  if(blockPendingDocumentEdit())return;
  showModal({title:'Размер изображения',fields:[
    {name:'width',label:'Ширина',type:'number',value:doc.width,min:'1',max:'12000',required:true},
    {name:'height',label:'Высота',type:'number',value:doc.height,min:'1',max:'12000',required:true}
  ],submitLabel:'Изменить',onSubmit:v=>{
    if(blockPendingDocumentEdit())return false;
    let size;try{size=checkedCanvasSize(Number(v.width)||doc.width,Number(v.height)||doc.height,'Размер изображения');}catch(error){toast(error.message,'error');setStatus(error.message);return false;}
    const {width,height}=size;
    if(width===doc.width&&height===doc.height)return;
    const sx=width/doc.width,sy=height/doc.height;
    let transforms;
    try{transforms=imageResizeTransforms(doc.layers,sx,sy);}catch(error){toast(error.message,'error');setStatus(error.message);return false;}
    doc.layers.forEach((layer,index)=>Object.assign(layer,transforms[index]));
    doc.width=width;doc.height=height;cropRect=null;clearSelectionState();rasterEdit.clearBrushBuffer();
    commit('Размер изображения');fitToView();
  }});
}

function setZoom(next, announce=true){
  const value=clamp(next,.1,16);
  if(Math.abs(value-zoom)<1e-6)return;
  zoom=value;const session=currentSession();if(session)session.zoom=zoom;updateCanvasSize();drawOverlay();
  if(announce)setStatus(`Масштаб ${Math.round(zoom*100)}%`);
}
function setZoomAtClientPoint(next, clientX, clientY){
  const point=clientPointToCanvas(clientX,clientY);
  const value=clamp(next,.1,16);
  if(Math.abs(value-zoom)<1e-6)return;
  zoom=value;const session=currentSession();if(session)session.zoom=zoom;updateCanvasSize();drawOverlay();
  requestAnimationFrame(()=>{
    const r=els.overlay.getBoundingClientRect();
    els.viewport.scrollLeft += r.left + point.x*zoom - clientX;
    els.viewport.scrollTop += r.top + point.y*zoom - clientY;
  });
  setStatus(`Масштаб ${Math.round(zoom*100)}%`);
}
function fitToView(){const r=els.viewport.getBoundingClientRect();setZoom(fitZoom(r.width,r.height,doc.width,doc.height,90));els.viewport.scrollTo({left:0,top:0});}

const menus={
  file:[
    ['Новый…','Ctrl+N',createNewDialog],
    ['Открыть изображение / PSD / PSB…','Ctrl+O',()=>els.fileInput.click()],
    ['Открыть проект…','',()=>els.projectInput.click()],
    ['Вставить изображение из буфера','Ctrl+V',pasteFromClipboard],
    ['sep'],
    ['Сохранить проект / обновить смарт-объект','Ctrl+S',saveProject],
    ['Экспорт…','Ctrl+Shift+S',exportDialog],
  ],
  edit:[
    ['Отменить','Ctrl+Z',undo,()=>history.canUndo()],
    ['Повторить','Ctrl+Y',redo,()=>history.canRedo()],
    ['sep'],
    ['Выделить всё','Ctrl+A',selectAllPixels],
    ['Снять выделение','Ctrl+D',deselectPixels,()=>Boolean(selectionRect)],
    ['Копировать выделение','Ctrl+C',copySelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||Boolean(selected()))],
    ['Вырезать выделение','Ctrl+X',cutSelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||isEditableRasterLayer(selected()))],
    ['Очистить выделенные пиксели','Delete',()=>clearSelectedPixels(),()=>Boolean(selectionRect)&&isEditableRasterLayer(selected())],
    ['sep'],
    ['Дублировать слой','Ctrl+J',duplicateSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Удалить слой','Delete',deleteSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Выбрать слой выше','Alt+↑',()=>selectAdjacentLayer(1),()=>doc.layers.length>1],
    ['Выбрать слой ниже','Alt+↓',()=>selectAdjacentLayer(-1),()=>doc.layers.length>1],
  ],
  layer:[
    ['Новый растровый слой','Ctrl+Shift+N',addBlankLayer],
    ['Новый корректирующий слой','',addAdjustmentLayer],
    ['Новая группа слоёв','',addGroup],
    ['Преобразовать в смарт-объект','',convertSelectedToSmartObject,()=>Boolean(selected())&&!['smart-object','adjustment'].includes(selected().type)&&!isLayerLocked(doc,selected())],
    ['Редактировать содержимое смарт-объекта','',()=>openSmartObjectContents(selected()),()=>selected()?.type==='smart-object'&&Boolean(selected()?.embeddedDocument)],
    ['Создать связанную копию смарт-объекта','',()=>createLinkedSmartObjectCopy(selected()),()=>selected()?.type==='smart-object'&&Boolean(selected()?.embeddedDocument)&&!isLayerLocked(doc,selected())],
    ['Разорвать связь смарт-объекта','',()=>unlinkSmartObject(selected()),()=>Boolean(selected()?.linkedSourceId)&&!isLayerLocked(doc,selected())],
    ['Добавить смарт-фильтр…','',()=>openSmartFilterDialog(selected()),()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&hasSmartFilterCapacity(selected())],
    ['Очистить смарт-фильтры','',()=>clearSmartFilters(selected()),()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&Boolean(selected()?.smartFilters?.length)],
    ['Маска смарт-фильтров: показать всё','',()=>{void setSmartFilterMask(selected(),false);},()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&Boolean(selected()?.smartFilters?.length)&&!selected()?.smartFilterMask],
    ['Маска смарт-фильтров из выделения','',()=>{void setSmartFilterMask(selected(),true);},()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&Boolean(selected()?.smartFilters?.length)&&Boolean(selectionShape)],
    ['Инвертировать маску смарт-фильтров','',()=>invertSmartFilterMask(selected()),()=>Boolean(selected()?.smartFilterMask)&&!isLayerLocked(doc,selected())],
    ['Включить / отключить маску смарт-фильтров','',()=>toggleSmartFilterMask(selected()),()=>Boolean(selected()?.smartFilterMask)&&!isLayerLocked(doc,selected())],
    ['Удалить маску смарт-фильтров','',()=>removeSmartFilterMask(selected()),()=>Boolean(selected()?.smartFilterMask)&&!isLayerLocked(doc,selected())],
    ['Переименовать слой','F2',()=>{const layer=selected();if(layer)renameLayer(layer);},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Дублировать слой','Ctrl+J',duplicateSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Удалить слой','Delete',deleteSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Растеризовать слой','',rasterizeSelectedLayer,()=>Boolean(selected())&&selected().type!=='raster'&&selected().type!=='adjustment'&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Добавить маску (показать всё)','',()=>addSelectedLayerMask(false),()=>Boolean(selected())&&!selected().mask&&!isLayerLocked(doc,selected())],
    ['Добавить маску из выделения','',()=>addSelectedLayerMask(true),()=>Boolean(selected())&&!selected().mask&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Уточнить выделение → маска…','',refineSelectionToLayerMask,()=>Boolean(selected())&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Удалить маску','',removeSelectedLayerMask,()=>Boolean(selected()?.mask)&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Создать векторную маску из выделения','',()=>applySelectionToVectorMask('replace'),()=>Boolean(selected())&&Boolean(selectionShape)&&!selected().vectorMask&&!isLayerLocked(doc,selected())],
    ['Заменить векторную маску выделением','',()=>applySelectionToVectorMask('replace'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Добавить выделение к векторной маске','',()=>applySelectionToVectorMask('add'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Вычесть выделение из векторной маски','',()=>applySelectionToVectorMask('subtract'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Пересечь векторную маску с выделением','',()=>applySelectionToVectorMask('intersect'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Исключить пересечение из векторной маски','',()=>applySelectionToVectorMask('exclude'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Редактировать векторную маску пером','',editSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['Инвертировать векторную маску','',invertSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['Включить / отключить векторную маску','',toggleSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['Удалить векторную маску','',removeSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Центрировать слой на холсте','',centerSelectedLayer,()=>isTransformableLayer(selected())&&!isLayerLocked(doc,selected())],
    ['Вписать слой в холст','',fitSelectedLayerToCanvas,()=>isTransformableLayer(selected())&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Показать / скрыть слой','',toggleSelectedVisibility,()=>Boolean(selected())],
    ['Заблокировать / разблокировать','',toggleSelectedLock,()=>{const layer=selected();return Boolean(layer)&&!doc.groups?.find(group=>group.id===layer.groupId)?.locked;}],
    ['sep'],
    ['Поднять слой','',()=>{if(moveLayer(doc,doc.selectedLayerId,1))commit('Поднять слой');},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Опустить слой','',()=>{if(moveLayer(doc,doc.selectedLayerId,-1))commit('Опустить слой');},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  image:[
    ['Цветокоррекция…','',openColorCorrectionDialog,()=>selected()?.type==='raster'&&!isLayerLocked(doc,selected())],
    ['Сбросить цветокоррекцию','',()=>{const l=selected();if(l?.type==='raster'&&!isLayerLocked(doc,l)){const current=sanitizeFilters(l.filters);for(const key of COLOR_CORRECTION_KEYS)current[key]=DEFAULT_LAYER_FILTERS[key];l.filters=current;commit('Сбросить цветокоррекцию');}},()=>selected()?.type==='raster'&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Размер изображения…','',resizeImageDialog],
    ['Размер холста…','',resizeCanvasDialog],
    ['Фон документа…','',setDocumentBackground],
    ['sep'],
    ['Сбросить все фильтры слоя','',()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.filters={...DEFAULT_LAYER_FILTERS};commit('Сбросить фильтры');}},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  select:[
    ['Выделить всё','Ctrl+A',selectAllPixels],
    ['Снять выделение','Ctrl+D',deselectPixels,()=>Boolean(selectionRect)],
    ['Копировать выделение','Ctrl+C',copySelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||Boolean(selected()))],
    ['Вырезать выделение','Ctrl+X',cutSelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||isEditableRasterLayer(selected()))],
    ['sep'],
    ['Очистить пиксели выделения','Delete',()=>clearSelectedPixels(),()=>Boolean(selectionRect)&&isEditableRasterLayer(selected())],
    ['Кадрировать по выделению','',cropToSelection,()=>Boolean(selectionRect)],
    ['sep'],
    ['Уточнить выделение → маска…','',refineSelectionToLayerMask,()=>Boolean(selectionShape)&&Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Создать / заменить векторную маску','',()=>applySelectionToVectorMask('replace'),()=>Boolean(selectionShape)&&Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  view:[
    ['Вписать в окно','0',fitToView],
    ['100%','1',()=>setZoom(1)],
    ['Увеличить','+',()=>setZoom(zoom+.1)],
    ['Уменьшить','-',()=>setZoom(zoom-.1)],
    ['sep'],
    ['Режим холста: панели','Tab',togglePanels],
    ['Полноэкранный режим','F11',toggleFullscreen],
  ],
  help:[
    ['Горячие клавиши','?',showShortcuts],
    ['О программе','',showAbout],
  ],
};
function openColorCorrectionDialog(){
  const layer=selected();
  if(!layer||layer.type!=='raster'){toast('Цветокоррекция доступна для растрового слоя','warn');setStatus('Выберите растровый слой');return;}
  if(isLayerLocked(doc,layer)){toast('Слой или его группа заблокированы','warn');return;}
  const layerId=layer.id;
  const original=sanitizeFilters(layer.filters);
  layer.filters={...original};
  const previousFocus=document.activeElement;
  const back=document.createElement('div');back.className='modal-backdrop';
  const modal=document.createElement('form');modal.className='modal color-correction-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Цветокоррекция');
  modal.innerHTML='<header>Цветокоррекция</header><div class="modal-body color-correction-body"><p class="muted color-correction-hint">Настройки применяются неразрушающе к выбранному растровому слою. Изменения сразу видны на холсте.</p></div><footer><button type="button" class="secondary-button" data-reset>Сбросить</button><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>';
  const body=modal.querySelector('.color-correction-body');
  let currentGroup='';
  for(const control of COLOR_CORRECTION_CONTROLS){
    if(control.group!==currentGroup){currentGroup=control.group;const heading=document.createElement('div');heading.className='color-correction-group';heading.textContent=currentGroup;body.append(heading);}
    const row=document.createElement('label');row.className='color-correction-row';
    const label=document.createElement('span');label.textContent=control.label;
    const input=document.createElement('input');input.type='range';input.name=control.key;input.min=String(control.min);input.max=String(control.max);input.step=String(control.step);input.value=String(layer.filters[control.key] ?? DEFAULT_LAYER_FILTERS[control.key]);
    const output=document.createElement('output');output.value=formatFilterValue(control.key,input.value);output.textContent=output.value;
    row.append(label,input,output);body.append(row);
    input.addEventListener('input',()=>{
      const target=doc.layers.find(item=>item.id===layerId);if(!target)return;
      const [min,max]=FILTER_RANGES[control.key]||[control.min,control.max];
      const value=clamp(Number(input.value),min,max);target.filters[control.key]=value;output.value=formatFilterValue(control.key,value);output.textContent=output.value;render();
    });
  }
  const close=()=>{els.modalRoot.replaceChildren();if(previousFocus instanceof HTMLElement)previousFocus.focus();};
  const restore=()=>{const target=doc.layers.find(item=>item.id===layerId);if(target){target.filters={...original};render();refreshInspectorPanels();}};
  back.append(modal);els.modalRoot.replaceChildren(back);
  modal.querySelector('[data-reset]').addEventListener('click',()=>{
    for(const control of COLOR_CORRECTION_CONTROLS){
      const input=modal.elements.namedItem(control.key);if(!(input instanceof HTMLInputElement))continue;
      input.value=String(DEFAULT_LAYER_FILTERS[control.key]);input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  modal.querySelector('[data-cancel]').addEventListener('click',()=>{restore();close();setStatus('Цветокоррекция отменена');});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();restore();close();setStatus('Цветокоррекция отменена');}});
  modal.addEventListener('submit',e=>{
    e.preventDefault();const target=doc.layers.find(item=>item.id===layerId);if(!target){close();return;}
    const changed=COLOR_CORRECTION_CONTROLS.some(control=>Math.abs((target.filters[control.key]??DEFAULT_LAYER_FILTERS[control.key])-(original[control.key]??DEFAULT_LAYER_FILTERS[control.key]))>1e-9);
    close();
    if(changed){commit('Цветокоррекция слоя');setStatus('Цветокоррекция применена');}
    else {target.filters={...original};render();setStatus('Цветокоррекция без изменений');}
  });
  modal.querySelector('input[type="range"]')?.focus();
}

function resizeCanvasDialog(){if(blockPendingDocumentEdit())return;showModal({title:'Размер холста',fields:[
  {name:'width',label:'Ширина',type:'number',value:doc.width,min:'1',max:'12000',required:true},
  {name:'height',label:'Высота',type:'number',value:doc.height,min:'1',max:'12000',required:true},
  {name:'anchor',label:'Якорь',type:'select',value:'center',options:[
    ['top-left','↖ Слева сверху'],['top','↑ Сверху'],['top-right','↗ Справа сверху'],
    ['left','← Слева'],['center','● По центру'],['right','→ Справа'],
    ['bottom-left','↙ Слева снизу'],['bottom','↓ Снизу'],['bottom-right','↘ Справа снизу']
  ]}
],submitLabel:'Изменить',onSubmit:v=>{
  if(blockPendingDocumentEdit())return false;
  let size;try{size=checkedCanvasSize(Number(v.width)||doc.width,Number(v.height)||doc.height,'Размер холста');}catch(error){toast(error.message,'error');setStatus(error.message);return false;}
  const {width,height}=size;
  if(width===doc.width&&height===doc.height)return;
  const anchors={
    'top-left':[0,0],top:[.5,0],'top-right':[1,0],left:[0,.5],center:[.5,.5],right:[1,.5],
    'bottom-left':[0,1],bottom:[.5,1],'bottom-right':[1,1]
  };
  const [ax,ay]=anchors[v.anchor]||anchors.center;
  const shiftX=(width-doc.width)*ax, shiftY=(height-doc.height)*ay;
  if(doc.layers.some(layer=>Math.abs(layer.x+shiftX)>MAX_LAYER_POSITION||Math.abs(layer.y+shiftY)>MAX_LAYER_POSITION)){
    const message='Размер холста выведет слой за допустимые пределы';toast(message,'error');setStatus(message);return false;
  }
  for(const layer of doc.layers){layer.x+=shiftX;layer.y+=shiftY;}
  doc.width=width;doc.height=height;cropRect=null;clearSelectionState();rasterEdit.clearBrushBuffer();commit('Размер холста');fitToView();
}});}
els.tabs.addEventListener('contextmenu',e=>{
  if(e.target!==els.tabs)return;
  e.preventDefault();
  openContextMenu('tabs-empty',[['Новая вкладка','',()=>addDocumentTab()]],e,els.addTab);
});
els.layers.addEventListener('contextmenu',e=>{
  if(e.target!==els.layers)return;
  e.preventDefault();
  if(blockPendingDocumentEdit())return;
  openContextMenu('layers-empty',[
    ['Новый растровый слой','Ctrl+Shift+N',addBlankLayer],
    ['Новая группа слоёв','',addGroup],
  ],e,els.layers);
});
els.viewport.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(blockPendingDocumentEdit())return;
  openContextMenu('canvas',[
    ['Отменить','Ctrl+Z',undo,()=>history.canUndo()],
    ['Повторить','Ctrl+Y',redo,()=>history.canRedo()],
    ['sep'],
    ['Вставить изображение','Ctrl+V',pasteFromClipboard],
    ['Снять выделение','Ctrl+D',deselectPixels,()=>Boolean(selectionRect)],
    ['Новый растровый слой','Ctrl+Shift+N',addBlankLayer],
    ['sep'],
    ['Вписать в окно','0',fitToView],
    ['Масштаб 100%','1',()=>setZoom(1)],
  ],e,els.viewport);
});
window.addEventListener('blur',()=>{closeMenu();spaceHeld=false;if(!drag)els.overlay.style.cursor=defaultToolCursor();});

$$('.tool').forEach(b=>b.onclick=()=>{if(toolbarController.isClickSuppressed())return;setTool(b.dataset.tool);});
els.primaryColor.oninput=()=>els.colorChip.style.background=els.primaryColor.value;
els.brushSize.oninput=()=>els.brushSizeValue.textContent=els.brushSize.value;
els.toolOpacity.oninput=()=>els.toolOpacityValue.textContent=`${els.toolOpacity.value}%`;
els.dodgeStrength.oninput=()=>els.dodgeStrengthValue.textContent=`${els.dodgeStrength.value}%`;
els.burnStrength.oninput=()=>els.burnStrengthValue.textContent=`${els.burnStrength.value}%`;
if(els.blurStrength)els.blurStrength.oninput=()=>els.blurStrengthValue.textContent=`${els.blurStrength.value}%`;
if(els.smudgeStrength)els.smudgeStrength.oninput=()=>els.smudgeStrengthValue.textContent=`${els.smudgeStrength.value}%`;
if(els.fillTolerance)els.fillTolerance.oninput=()=>els.fillToleranceValue.textContent=els.fillTolerance.value;
if(els.selectionType)els.selectionType.onchange=()=>selectionGestures.setType(els.selectionType.value);
if(els.selectionCopyMode)els.selectionCopyMode.onchange=()=>{selectionCopyMode=els.selectionCopyMode.value==='selected'?'selected':'merged';setStatus(selectionCopyMode==='merged'?'Выделение: копирование со всех видимых слоёв':'Выделение: копирование с выбранного слоя');};
if(els.smartSnapToggle)els.smartSnapToggle.onchange=()=>{smartSnapEnabled=els.smartSnapToggle.checked;persistSmartSnapState();clearSmartGuides();drawOverlay();setStatus(smartSnapEnabled?'Умная привязка включена':'Умная привязка выключена');};
$$('[data-align]').forEach(button=>button.addEventListener('click',()=>alignSelectedLayer(button.dataset.align)));
els.undo.onclick=undo;els.redo.onclick=redo;$('#exportQuickBtn').onclick=exportDialog;
$('#addRasterBtn').onclick=addBlankLayer;$('#addGroupBtn').onclick=()=>addGroup();$('#renameLayerBtn').onclick=()=>{const layer=selected();if(layer)renameLayer(layer);};$('#duplicateLayerBtn').onclick=duplicateSelected;$('#deleteLayerBtn').onclick=deleteSelected;
$('#layerUpBtn').onclick=()=>{if(moveLayer(doc,doc.selectedLayerId,1))commit('Поднять слой');};$('#layerDownBtn').onclick=()=>{if(moveLayer(doc,doc.selectedLayerId,-1))commit('Опустить слой');};
pathsController.bindControls();
layersPanelController.bind();
$('#clearHistoryBtn').onclick=()=>{history.clearToCurrent();updateHistory();updateAll();};
$('#resetColorEffectsBtn').onclick=resetSelectedLayerEffects;
els.addTab.onclick=()=>addDocumentTab();
els.blend.onchange=()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.blendMode=els.blend.value;commit('Режим наложения');}};
els.layerOpacity.oninput=()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.opacity=Number(els.layerOpacity.value)/100;markDirty(true);render();}};
els.layerOpacity.onchange=()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.opacity=Number(els.layerOpacity.value)/100;commit('Непрозрачность слоя');}};
$('#zoomOutBtn').onclick=()=>setZoom(zoom-.1);$('#zoomInBtn').onclick=()=>setZoom(zoom+.1);$('#fitBtn').onclick=fitToView;els.zoomRange.oninput=()=>setZoom(Number(els.zoomRange.value)/100,false);
els.fileInput.onchange=()=>{handleIncomingFiles(els.fileInput.files,null,'Импорт').catch(e=>{console.error(e);alert(e.message);});els.fileInput.value='';};
els.projectInput.onchange=()=>{const f=els.projectInput.files[0];if(f)openProject(f);els.projectInput.value='';};

function dragCarriesFiles(event) {
  const dt=event.dataTransfer;
  if(!dt)return false;
  if(dt.files?.length)return true;
  if([...(dt.items||[])].some(item=>item.kind==='file'))return true;
  return [...(dt.types||[])].some(type=>String(type).toLowerCase()==='files');
}
function showDropTarget() {
  dragDepth=Math.max(1,dragDepth);
  els.dropOverlay.hidden=false;
  els.viewport.classList.add('drop-active');
}
function hideDropTarget() {
  dragDepth=0;
  els.dropOverlay.hidden=true;
  els.viewport.classList.remove('drop-active');
}
// Capture on window so Windows Explorer drops are intercepted before the browser can navigate to the file.
window.addEventListener('dragenter',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();dragDepth+=1;showDropTarget();
},{capture:true});
window.addEventListener('dragover',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';showDropTarget();
},{capture:true});
window.addEventListener('dragleave',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();
  dragDepth=Math.max(0,dragDepth-1);
  if(dragDepth===0)hideDropTarget();
},{capture:true});
window.addEventListener('drop',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();hideDropTarget();
  const files=[...(e.dataTransfer?.files||[])];
  if(!files.length){toast('Windows передал событие перетаскивания без файла','error');return;}
  const r=els.overlay.getBoundingClientRect();
  const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  const anchor=inside?clientPointToCanvas(e.clientX,e.clientY):visibleCanvasCenter();
  handleIncomingFiles(files,anchor,'Перетаскивание').catch(error=>{console.error(error);toast(error.message||'Ошибка импорта','error');});
},{capture:true});

window.addEventListener('copy',e=>{
  if(isEditingTarget(e.target)||!selectionRect)return;
  e.preventDefault();
  copySelection().catch(error=>{console.error(error);toast(error.message||'Ошибка копирования','error');});
});
window.addEventListener('cut',e=>{
  if(isEditingTarget(e.target)||!selectionRect)return;
  e.preventDefault();
  cutSelection().catch(error=>{console.error(error);toast(error.message||'Ошибка вырезания','error');});
});

window.addEventListener('paste',e=>{
  if(isEditingTarget(e.target))return;
  handleNativePasteEvent(e);
});
els.viewport.addEventListener('wheel',e=>{
  if(!e.ctrlKey&&!e.altKey)return;
  e.preventDefault();
  const factor=e.deltaY<0?1.1:0.9;
  setZoomAtClientPoint(zoom*factor,e.clientX,e.clientY);
},{passive:false});

window.addEventListener('keydown',e=>{
  const editing=isEditingTarget();
  const interactive=isInteractiveControlTarget(e.target);
  if(e.code==='Space'&&!editing&&!interactive){spaceHeld=true;if(!drag)els.overlay.style.cursor='grab';e.preventDefault();}
  if(editing)return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'){
    if(menuController.isOpen()){e.preventDefault();closeMenu({restoreFocus:true});return;}
    if(drag && drag.kind!=='paint'){
      e.preventDefault();
      const d=drag;drag=null;pointerLifecycle?.releaseActivePointer();clearSmartGuides();
      if(d.kind==='move'){const l=doc.layers.find(x=>x.id===d.layerId);if(l){l.x=d.x;l.y=d.y;render();updateTransformPropertyValues(l);}}
      if(d.kind==='resize'){const l=doc.layers.find(x=>x.id===d.layerId);if(l){Object.assign(l,d.initial);render();updateTransformPropertyValues(l);}}
      if(d.kind==='rotate'){const l=doc.layers.find(x=>x.id===d.layerId);if(l){l.rotation=d.initialRotation;render();updateTransformPropertyValues(l);}}
      if(d.kind==='pen-handle'&&penDraft){penDraft.points.splice(d.nodeIndex,1);if(!penDraft.points.length)penDraft=null;}
      if(d.kind==='path-control')restorePathControlDrag(d);
      if(d.kind==='crop')cropRect=null;
      if(d.kind==='marquee')selectionGestures.cancelMarquee(d);
      els.overlay.style.cursor=defaultToolCursor();drawOverlay();setStatus('Действие отменено');return;
    }
    if(selectionGestures.hasPolygonDraft()){e.preventDefault();selectionGestures.cancelPolygonDraft({restorePrevious:true,announce:true});return;}
    if(penDraft){e.preventDefault();penDraft=null;drawOverlay();setStatus('Контур отменён');return;}
    if(selectionGestures.hasMagneticDraft()){e.preventDefault();selectionGestures.cancelMagneticDraft({announce:true});return;}
    if(cropRect){cropRect=null;drawOverlay();setStatus('Кадрирование отменено');return;}
    if(selectionRect){deselectPixels();return;}
  }
  if(e.target instanceof Node && els.modalRoot.contains(e.target))return;
  if(menuController.isOpen() && (els.menu.contains(e.target)||e.target.closest?.('.menu-button')))return;
  if(e.key==='Enter'&&selectionGestures.hasPolygonDraft()&&currentTool==='marquee'){e.preventDefault();selectionGestures.finishPolygonSelection();return;}
  if(e.key==='Enter'&&penDraft&&currentTool==='pen'){e.preventDefault();finishPenPath();return;}
  if(e.key==='Enter'&&selectionGestures.hasMagneticDraft()&&currentTool==='magnetic'){e.preventDefault();selectionGestures.finishMagneticSelection();return;}
  if(ctrl&&e.code==='Digit0'){e.preventDefault();fitToView();return;}
  if(ctrl&&e.code==='Digit1'){e.preventDefault();setZoom(1);return;}
  if(ctrl&&(e.code==='Equal'||e.code==='NumpadAdd')){e.preventDefault();setZoom(zoom+.1);return;}
  if(ctrl&&(e.code==='Minus'||e.code==='NumpadSubtract')){e.preventDefault();setZoom(zoom-.1);return;}
  if(ctrl&&e.code==='KeyC'){e.preventDefault();copySelection().catch(error=>{console.error(error);toast(error.message||'Ошибка копирования','error');});return;}
  if(ctrl&&e.code==='KeyX'){e.preventDefault();cutSelection().catch(error=>{console.error(error);toast(error.message||'Ошибка вырезания','error');});return;}
  if(ctrl&&e.code==='KeyV'){armPasteShortcutFallback();return;}
  if(ctrl&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(ctrl&&e.code==='KeyY'){e.preventDefault();redo();return;}
  if(ctrl&&e.code==='KeyS'){e.preventDefault();(e.shiftKey||e.altKey)?exportDialog():saveProject();return;}
  if(ctrl&&e.code==='KeyO'){e.preventDefault();els.fileInput.click();return;}
  if(ctrl&&e.code==='KeyN'){e.preventDefault();e.shiftKey?addBlankLayer():createNewDialog();return;}
  if(ctrl&&e.code==='KeyA'){e.preventDefault();selectAllPixels();return;}
  if(ctrl&&e.code==='KeyD'){e.preventDefault();deselectPixels();return;}
  if(ctrl&&e.code==='KeyJ'){e.preventDefault();duplicateSelected();return;}
  if(interactive)return;
  if(e.key==='Tab'&&!ctrl&&!e.altKey){e.preventDefault();togglePanels();return;}
  if(e.altKey&&e.code==='ArrowUp'){e.preventDefault();selectAdjacentLayer(1);return;}
  if(e.altKey&&e.code==='ArrowDown'){e.preventDefault();selectAdjacentLayer(-1);return;}
  if(e.code==='F2'){e.preventDefault();const l=selected();if(l)renameLayer(l);return;}
  if(e.key==='Delete'){e.preventDefault();if(selectionRect&&isEditableRasterLayer(selected()))clearSelectedPixels();else deleteSelected();return;}
  if(!ctrl&&!e.altKey&&(e.code==='BracketLeft'||e.code==='BracketRight')){e.preventDefault();adjustBrushSize(e.code==='BracketRight'?1:-1,e.shiftKey);return;}
  if(!ctrl&&!e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){
    e.preventDefault();const step=e.shiftKey?10:1;
    if(e.code==='ArrowLeft')nudgeSelected(-step,0);if(e.code==='ArrowRight')nudgeSelected(step,0);if(e.code==='ArrowUp')nudgeSelected(0,-step);if(e.code==='ArrowDown')nudgeSelected(0,step);return;
  }
  if(!ctrl&&!e.altKey&&e.shiftKey&&e.code==='KeyM'){e.preventDefault();if(currentTool!=='marquee')setTool('marquee');selectionGestures.cycleType();return;}
  if(!ctrl&&!e.altKey&&e.shiftKey&&e.code==='KeyO'){e.preventDefault();setTool('burn');return;}
  if(!ctrl&&!e.altKey&&e.shiftKey&&e.code==='KeyG'){e.preventDefault();setTool('gradient');return;}
  const map={KeyV:'move',KeyM:'marquee',KeyB:'brush',KeyS:'clone',KeyJ:'heal',KeyN:'smudge',KeyO:'dodge',KeyR:'blur',KeyE:'eraser',KeyG:'fill',KeyP:'pen',KeyA:'magnetic',KeyW:'wand',KeyL:'line',KeyT:'text',KeyU:'shape',KeyC:'crop',KeyI:'eyedropper',KeyH:'hand',KeyZ:'zoom'}; if(!ctrl&&!e.altKey&&map[e.code]){setTool(map[e.code]);return;}
  if(e.code==='Digit0'&&!ctrl){fitToView();return;}if(e.code==='Digit1'&&!ctrl){setZoom(1);return;}
  if((e.code==='Equal'||e.code==='NumpadAdd')&&!ctrl){e.preventDefault();setZoom(zoom+.1);return;}
  if((e.code==='Minus'||e.code==='NumpadSubtract')&&!ctrl){e.preventDefault();setZoom(zoom-.1);return;}
  if(e.code==='F11'){e.preventDefault();toggleFullscreen();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;if(!drag)els.overlay.style.cursor=defaultToolCursor();}});
window.addEventListener('resize',()=>{drawOverlay();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&documentSessions.some(session=>session.dirty))queueRecovery({immediate:true});});
window.addEventListener('beforeunload',e=>{syncCurrentSession();if(documentSessions.some(session=>session.dirty)||documentEditPending()){e.preventDefault();e.returnValue='';}});

async function bootstrap(){
  initToolbarReorder();
  initTooltips();
  initCollapsiblePanels();
  readSmartSnapState();
  const initialSession = buildSession(doc);
  documentSessions = [initialSession];
  activeSessionId = initialSession.id;
  loadSession(initialSession);
  markDirty(false);
  setTool('move');
  updateAll();
  const restored=await restoreRecoveryIfAvailable();
  requestAnimationFrame(fitToView);
  return restored;
}
bootstrap().then(()=>{
  window.__ZETER_BOOTED__=true;
  document.documentElement.dataset.appReady='true';
}).catch(error=>{
  console.error('ZeTer Photo Editor bootstrap failed',error);
  document.documentElement.dataset.appReady='error';
  const message=document.createElement('div');
  message.className='fatal-error';
  message.textContent=`Ошибка запуска редактора: ${error?.message||error}`;
  document.body.append(message);
});

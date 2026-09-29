import { HistoryStack } from './core/history.js';
import { frameBounds, normalizeRect, constrainedRect, pointInLayer, layerPixelToDocumentPoint, snapLineEnd, selectionPixelBounds, selectionBounds, selectionPathPoints, pointInSelection, clamp } from './core/geometry.js';
import {
  createDocument, createRasterLayer, createShapeLayer, linkedSmartObjectLayers, createAdjustmentLayer, createVectorMask,
  addLayer, selectedLayer,
  snapshotDocument, restoreDocument, sanitizeProject, touch, checkedCanvasSize, DEFAULT_LAYER_FILTERS, sanitizeHighDepthPreview, sanitizeColorManagement,
  isLayerVisible, isLayerLocked, isGroupLocked, groupDepth,
} from './core/state.js';
import { renderDocument, renderLayer, compositeToBlob, invalidateImageCache, clearImageCache } from './core/render.js';
import { readFileAsDataURL, readFileAsText, dimensionsFromDataUrl, canvasToDataURL, downloadBlob, downloadText, safeFilename, bytesToDataUrl, dataUrlToBytes } from './core/io.js';
import { hexToRgb } from './core/pixels.js';
import { pixelBufferToRgba8Preview, serializePixelBufferSource, deserializePixelBufferSource, pixelBufferToToneMappedRgba8Preview, clonePixelBuffer, pixelBufferWithStraightAlpha, pixelBufferByteLength, MAX_PIXEL_BUFFER_SOURCE_BYTES } from './core/pixel-buffer.js';
import { createCmykToSrgbTransform, createSrgbToCmykTransform, createCmykSoftProofTransform, inspectCmykIccProfile, inspectDisplayIccProfile, cmykPixelBufferToRgba8Preview } from './core/color-management.js';
import { saveRecoverySnapshot, loadRecoverySnapshots, clearRecoverySnapshot } from './core/recovery.js';
import {
  TOOL_LABELS, RASTER_BRUSH_TOOLS,
  SELECTION_TYPE_LABELS, SELECTION_TYPES, MIME_EXT,
  COLOR_CORRECTION_KEYS,
  BASIC_EFFECT_CONTROLS, RASTER_EFFECT_CONTROLS,
  SMART_SNAP_STORAGE_KEY, TOOL_ORDER_STORAGE_KEY,
  NATIVE_HIGH_DEPTH_PAINT_TOOLS, NATIVE_CMYK_PAINT_TOOLS,
} from './ui/tool-config.js';
import { sanitizeAdjustmentModel } from './core/adjustments.js';
import { decodePsd, encodePsdBlob, encodePsbBlob, isPsdFile } from './formats/psd.js';
import { createDocumentSessionController } from './workspace/session-controller.js';
import { createHistoryNavigationController } from './workspace/history-navigation-controller.js';
import { createViewportController } from './workspace/viewport-controller.js';
import { createRecoveryController } from './workspace/recovery-controller.js';
import { createToolbarController } from './ui/toolbar-controller.js';
import { createWorkspaceLayoutController } from './ui/workspace-layout-controller.js';
import { createLayersPanelController } from './ui/layers-panel-controller.js';
import { createLayerGroupCommandController } from './layers/command-controller.js';
import { createLayerPropertyCommandController } from './layers/property-command-controller.js';
import { ADJUSTMENT_COMMAND_RESULT, createAdjustmentLayerCommandController } from './layers/adjustment-command-controller.js';
import { LAYER_ALIGNMENT_LABELS, LAYER_TRANSFORM_COMMAND_RESULT, createLayerTransformCommandController } from './layers/transform-command-controller.js';
import { createColorCorrectionController } from './ui/color-correction-controller.js';
import { createPathsController } from './ui/paths-controller.js';
import { createColorManagementController } from './ui/color-management-controller.js';
import { createSmartFilterController } from './ui/smart-filter-controller.js';
import { createLayerBlendingController } from './ui/layer-blending-controller.js';
import { createTextEditController } from './ui/text-edit-controller.js';
import { createTextSettingsController, TEXT_WEIGHT_OPTIONS, TEXT_STYLE_OPTIONS, TEXT_ALIGN_OPTIONS } from './ui/text-settings-controller.js';
import { createMenuController } from './ui/menu-controller.js';
import { createModalController } from './ui/modal-controller.js';
import { createDocumentBackgroundController } from './ui/document-background-controller.js';
import { createDocumentResizeController } from './ui/document-resize-controller.js';
import { createLearningCenterController } from './ui/learning-center-controller.js';
import { createPointerLifecycleRouter } from './interaction/pointer-lifecycle-router.js';
import { createCropGestureController } from './interaction/crop-gesture-controller.js';
import { createLayerTransformSurfaceController } from './interaction/layer-transform-surface-controller.js';
import { createLayerTransformGestureController } from './interaction/layer-transform-gesture-controller.js';
import { createPathControlSurfaceController } from './interaction/path-control-surface-controller.js';
import { PATH_CONTROL_COMMAND_RESULT, createPathControlCommandController } from './interaction/path-control-command-controller.js';
import { createPathControlGestureController } from './interaction/path-control-gesture-controller.js';
import { PEN_DRAFT_BEGIN_RESULT, createPenDraftGestureController } from './interaction/pen-draft-gesture-controller.js';
import { PEN_PATH_COMMAND_RESULT, PEN_PATH_NOOP_REASON, createPenPathCommandController } from './interaction/pen-path-command-controller.js';
import { createSelectionGestureController, cloneSelectionShape } from './selection/gesture-controller.js';
import { createSelectionClipboardController } from './selection/clipboard-controller.js';
import { createSelectionRasterMutationController } from './selection/raster-mutation-controller.js';
import { createSelectionMaskController } from './selection/mask-controller.js';
import { createSelectionVectorMaskController } from './selection/vector-mask-controller.js';
import { createDocumentImportController } from './document/import-controller.js';
import { createNewDocumentController } from './document/new-document-controller.js';
import { createProjectController } from './document/project-controller.js';
import { createDocumentBackgroundCommandController } from './document/background-command-controller.js';
import { DOCUMENT_CROP_COMMAND_RESULT, createDocumentCropCommandController } from './document/crop-command-controller.js';
import { createDocumentResizeCommandController } from './document/resize-command-controller.js';
import { createSmartObjectController } from './document/smart-object-controller.js';
import { createPsdSmartObjectResource } from './document/psd-smart-object-resource.js';
import { createPsdImportController } from './document/psd-import-controller.js';
import { createPsdImportSemantics } from './document/psd-import-semantics.js';
import { createPsdExportController } from './document/psd-export-controller.js';
import { createDocumentExportController } from './document/export-controller.js';
import { psdAdjustmentNativePlan, psdEmbeddedDocumentFingerprint, psdPreviewFingerprint, psdShapeNativePlan, psdTextNativePlan } from './document/psd-native-metadata-plans.js';
import { createRasterEditController } from './painting/controller.js';
import { createRasterCommandController } from './painting/command-controller.js';
import { createGradientCommandController } from './painting/gradient-command-controller.js';
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
let vectorMaskEditLayerId = null;
let documentPathEditIndex = -1;
let spaceHeld = false;
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
    publishRefinedRasterOutput: async ({
      ownerDocument,
      sourceLayer,
      width,
      height,
      dataUrl,
      highDepthBuffer = null,
      expectedHighDepthSource = null,
      mask,
    }) => {
      const targetCurrent = () => (
        doc === ownerDocument &&
        selected() === sourceLayer &&
        !isLayerLocked(ownerDocument, sourceLayer) &&
        sourceLayer.highDepthSource === expectedHighDepthSource
      );
      if (!targetCurrent()) return null;
      if (ownerDocument.layers.indexOf(sourceLayer) < 0) return null;

      let outputDataUrl = dataUrl;
      let highDepthSource = null;
      let highDepthPreview = null;
      if (highDepthBuffer) {
        const usedBytes = ownerDocument.layers.reduce(
          (sum, item) => sum + Math.max(0, Number(item?.highDepthSource?.rawBytes) || 0),
          0,
        );
        const remainingBytes = Math.max(0, MAX_PIXEL_BUFFER_SOURCE_BYTES - usedBytes);
        if (pixelBufferByteLength(highDepthBuffer) > remainingBytes) {
          toast('Native Select & Mask не помещается в общий лимит PixelBuffer 48 MiB. Уменьшите слой или используйте вывод «Маска слоя».', 'warn');
          return null;
        }

        let mutation;
        try {
          mutation = await rasterEdit.prepareHighDepthMutation(
            sourceLayer,
            highDepthBuffer,
            { maxBytes:remainingBytes },
          );
        } catch (error) {
          toast(error?.message || 'Не удалось сериализовать native Select & Mask', 'warn');
          return null;
        }
        if (!targetCurrent()) return null;
        outputDataUrl = mutation.dataUrl;
        highDepthSource = mutation.highDepthSource;
        highDepthPreview = mutation.highDepthPreview;
      }

      if (!targetCurrent()) return null;
      const sourceIndex = ownerDocument.layers.indexOf(sourceLayer);
      if (sourceIndex < 0) return null;
      const outputLayer = createRasterLayer({
        name:`${sourceLayer.name || 'Слой'} — Select & Mask`,
        x:sourceLayer.x,
        y:sourceLayer.y,
        width,
        height,
        scaleX:sourceLayer.scaleX,
        scaleY:sourceLayer.scaleY,
        rotation:sourceLayer.rotation,
        opacity:sourceLayer.opacity,
        blendMode:sourceLayer.blendMode,
        clipping:Boolean(sourceLayer.clipping),
        groupId:sourceLayer.groupId ?? null,
        dataUrl:outputDataUrl,
        highDepthSource,
        highDepthPreview,
        mask,
      });
      sourceLayer.visible = false;
      ownerDocument.layers.splice(sourceIndex + 1, 0, outputLayer);
      ownerDocument.selectedLayerId = outputLayer.id;
      rasterEdit.clearBrushBuffer();
      return outputLayer;
    },
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
  toggleSelectedLayerMask,
  invertSelectedLayerMask,
  editSelectedLayerMaskProperties,
  toggleSelectedLayerMaskLink,
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

const viewportController = createViewportController({
  state: {
    getZoom: () => zoom,
    setZoom: value => { zoom = value; },
    getCurrentSession: () => documentSessionController?.currentSession?.() || null,
    getDocument: () => doc,
  },
  geometry: { clientPointToCanvas },
  view: {
    viewport: els.viewport,
    overlay: els.overlay,
    updateCanvasSize,
    drawOverlay,
    requestFrame: callback => requestAnimationFrame(callback),
  },
  ui: { setStatus },
});
const { setZoom, setZoomAtClientPoint, fitToView } = viewportController;

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
    captureSnapshot: () => selectionShape ? cloneSelectionShape(selectionShape) : null,
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
  contentAwareFill: contentAwareFillSelection,
  clearSelection: clearSelectedPixels,
} = rasterCommands;

const gradientCommands = createGradientCommandController({
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
  },
  runtime: { createCanvas: () => document.createElement('canvas') },
  selection: { clipContext: clipContextToDocumentSelection },
  tools: {
    type: () => els.gradientType?.value || 'linear',
    primaryColor: () => els.primaryColor.value,
    secondaryColor: () => els.secondaryColor?.value || '#ffffff',
    opacity: () => Number(els.toolOpacity.value) / 100,
  },
  io: { canvasToDataURL },
  transaction: { commit },
  ui: { setStatus, toast, consoleRef:console },
});

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
    captureSnapshot: () => selectionShape ? cloneSelectionShape(selectionShape) : null,
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

const layerGroupCommandController = createLayerGroupCommandController({
  state: { getDocument: () => doc },
  transaction: {
    commit,
    blockPendingEdit: blockPendingDocumentEdit,
  },
  ui: {
    showModal: options => showModal(options),
    setStatus,
  },
});

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
      toggleVisibility: layerGroupCommandController.toggleLayerVisibility,
      toggleLock: layerGroupCommandController.toggleLayerLock,
      rename: layerGroupCommandController.renameLayer,
      remove: layerGroupCommandController.deleteLayer,
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
      toggleVisibility: layerGroupCommandController.toggleGroupVisibility,
      toggleLock: layerGroupCommandController.toggleGroupLock,
      rename: layerGroupCommandController.renameGroup,
      remove: layerGroupCommandController.deleteGroup,
      openContextMenu: (owner, groupId, event, row) => {
        if (doc !== owner) return false;
        const group = owner.groups?.find(item => item.id === groupId);
        if (!group) return false;
        openContextMenu('group:' + groupId, groupContextMenu(groupId), event, row);
        return true;
      },
    },
    drag: {
      moveLayerRelative: layerGroupCommandController.moveLayerRelative,
      moveLayerIntoGroup: layerGroupCommandController.moveLayerIntoGroup,
      moveGroupIntoGroup: layerGroupCommandController.moveGroupIntoGroup,
      moveLayerToRoot: layerGroupCommandController.moveLayerToRoot,
      moveGroupToRoot: layerGroupCommandController.moveGroupToRoot,
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

const adjustmentLayerCommandController = createAdjustmentLayerCommandController({
  state: { getDocument: () => doc },
  transaction: { commit },
});

const layerTransformCommandController = createLayerTransformCommandController({
  state: { getDocument: () => doc },
  transaction: { commit },
});

const layerPropertyCommandController = createLayerPropertyCommandController({
  state: { getDocument: () => doc },
  transaction: {
    commit,
    markTransientChange: () => { documentChangeSerial += 1; },
  },
  rendering: { render, drawOverlay, refreshInspectorPanels },
  ui: { setStatus, toast },
  text: {
    isWeight: textSettingsController.isWeight,
    isStyle: textSettingsController.isStyle,
    isAlign: textSettingsController.isAlign,
    fontOptions: textSettingsController.fontOptions,
  },
  effects: {
    colorCorrectionKeys: COLOR_CORRECTION_KEYS,
    filterKeysForLayer: layer => (layer.type === 'raster' || layer.type === 'adjustment'
      ? RASTER_EFFECT_CONTROLS
      : BASIC_EFFECT_CONTROLS).map(control => control.key),
  },
});

const colorCorrectionController = createColorCorrectionController({
  state: { getDocument: () => doc },
  transaction: {
    commit,
    markTransientChange: () => { documentChangeSerial += 1; },
  },
  rendering: { render, refreshInspectorPanels },
  ui: {
    modalRoot: els.modalRoot,
    documentRef: document,
    HTMLElementClass: HTMLElement,
    setStatus,
    toast,
    formatFilterValue,
  },
});

const modalController = createModalController({
  modalRoot: els.modalRoot,
  escapeHtml,
  setStatus,
  toast,
  loadComputerFonts: textSettingsController.loadComputerFonts,
});
const { showModal, showInfoModal, showRecoveryModal } = modalController;
const learningCenterController = createLearningCenterController({
  showInfoModal,
  storage: window.localStorage,
  documentTarget: document,
  windowTarget: window,
});
const { show:showLearningCenter } = learningCenterController;
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

const documentExportController = createDocumentExportController({
  documentState: {
    getDocument: () => doc,
    blockPendingDocumentEdit,
    snapshotDocument,
    restoreDocument,
  },
  rendering: { compositeToBlob },
  psd: { prepareDocument: preparePsdExport },
  codec: { encodePsdBlob, encodePsbBlob },
  io: {
    downloadBlob,
    safeFilename,
    dataUrlToBytes,
    mimeExtensions: MIME_EXT,
  },
  ui: {
    showModal,
    setStatus,
    toast,
    alertUser: message => alert(message),
    consoleRef: console,
  },
});
const { showExportDialog: exportDialog } = documentExportController;

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

const newDocumentController = createNewDocumentController({
  documentState: {
    isDirty: () => dirty,
    blockPendingDocumentEdit,
    replaceHistory: () => { history = new HistoryStack(80); },
    setDocument: setDoc,
    markDirty,
  },
  documentFactory: { createDocument },
  recovery: { queueRecovery: options => queueRecovery(options) },
  view: { fitToView },
  ui: {
    showModal,
    confirmDiscard: message => window.confirm(message),
    setStatus,
    toast,
  },
});

const psdImportController = createPsdImportController({
  codec: { decodePsd },
  runtime: {
    getDocument: () => doc,
    getActiveSessionId: () => activeSessionId,
    getHistoryEntry: () => history.current(),
    getChangeSerial: () => documentChangeSerial,
    canReplaceDocument: newDocumentController.canReplaceDocument,
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

const projectController = createProjectController({
  documentState: {
    getDocument: () => doc,
    getActiveSessionId: () => activeSessionId,
    getHistoryEntry: () => history.current(),
    getDocumentChangeSerial: () => documentChangeSerial,
    canReplaceDocument: newDocumentController.canReplaceDocument,
    blockPendingDocumentEdit,
    sanitizeProject,
    replaceHistory: () => { history = new HistoryStack(80); },
    setDocument: setDoc,
    markDirty,
    getCurrentSession: () => currentSession(),
  },
  io: { readFileAsText, downloadText, safeFilename },
  smartObjects: { saveContent: session => saveSmartObjectContent(session) },
  recovery: { queueRecovery: options => queueRecovery(options) },
  view: { fitToView: () => fitToView() },
  ui: { setStatus, toast, alertUser: message => alert(message), consoleRef:console },
});
const { openProject, saveProject } = projectController;
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
  getSelectionShape: () => selectionShape,
  captureSelectionSnapshot: () => selectionShape ? cloneSelectionShape(selectionShape) : null,
  getCopyMode: () => selectionCopyMode,
  getSelectedLayer: selected,
  getCurrentTool: () => currentTool,
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
const layerTransformSurface = createLayerTransformSurfaceController({
  state: { getDocument: () => doc },
  runtime: {
    getCurrentTool: () => currentTool,
    getZoom: () => zoom,
    hasActiveInteraction: () => Boolean(drag),
    getDisplayLayer: owner => textEditController.previewLayer(owner) || selectedLayer(owner),
  },
});
const layerTransformGestures = createLayerTransformGestureController({
  state: { getDocument: () => doc },
  transaction: { commit },
  runtime: {
    getZoom: () => zoom,
    isSmartSnapEnabled: () => smartSnapEnabled,
    visibleSnapTargetRects: (owner, layerId) => visibleSnapTargetRects(owner, layerId),
    setSmartGuides: guides => { smartGuides = guides; },
    clearSmartGuides,
    refreshLayerPreview: layer => {
      render();
      updateTransformPropertyValues(layer);
      drawOverlay();
    },
    redrawOverlay: () => drawOverlay(),
  },
});
const cropGestures = createCropGestureController({
  state: { getDocument: () => doc },
});
const penDraftGestures = createPenDraftGestureController({
  runtime: { getZoom: () => zoom },
});
const penPathCommands = createPenPathCommandController({
  state: { getDocument: () => doc },
  transaction: { commit },
});
const pathControlSurface = createPathControlSurfaceController({
  state: {
    getDocument: () => doc,
    getDocumentPathEditIndex: () => documentPathEditIndex,
    setDocumentPathEditIndex: value => { documentPathEditIndex = value; },
    getVectorMaskEditLayerId: () => vectorMaskEditLayerId,
  },
  runtime: {
    getCurrentTool: () => currentTool,
    getZoom: () => zoom,
    hasPenDraft: () => penDraftGestures.hasDraft(),
    hasActiveInteraction: () => Boolean(drag),
    setCursor: cursor => { els.overlay.style.cursor = cursor; },
  },
  geometry: { layerToDocument: layerPixelToDocumentPoint },
});
const pathControlCommands = createPathControlCommandController({
  state: { getDocument: () => doc },
  targets: { resolve: target => pathControlSurface.resolveTarget(target) },
  transaction: { commit },
  ui: { setStatus },
});
const pathControlGestures = createPathControlGestureController({
  state: { getDocument: () => doc },
  transaction: { commit },
  runtime: {
    getZoom: () => zoom,
    refreshPreview: () => { render(); drawOverlay(); },
    redrawOverlay: () => drawOverlay(),
  },
  geometry: { documentPointToLayer: documentPointToLayerPixel },
});
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
const documentBackgroundCommandController = createDocumentBackgroundCommandController({
  state: { getDocument: () => doc },
  transaction: { commit },
});
const documentBackgroundController = createDocumentBackgroundController({
  documentState: {
    getDocument: () => doc,
    getPrimaryColor: () => els.primaryColor.value,
  },
  commands: {
    setBackground: (owner, value) => documentBackgroundCommandController.setBackground(owner, value),
  },
  ui: {
    showModal,
    setStatus,
  },
});
const documentCropCommandController = createDocumentCropCommandController({
  state: { getDocument: () => doc },
  transaction: { commit },
  runtime: {
    completeCropTransientState: () => {
      cropGestures.reset();
      clearSelectionState();
      rasterEdit.clearBrushBuffer();
    },
    fitToView,
  },
});
const documentResizeCommandController = createDocumentResizeCommandController({
  state: { getDocument: () => doc },
  transaction: { commit },
  runtime: {
    resetGeometryTransientState: () => {
      cropGestures.reset();
      clearSelectionState();
      rasterEdit.clearBrushBuffer();
    },
    fitToView,
  },
});
const documentResizeController = createDocumentResizeController({
  documentState: {
    getDocument: () => doc,
    blockPendingDocumentEdit,
  },
  commands: {
    resizeImage: (owner, values) => documentResizeCommandController.resizeImage(owner, values),
    resizeCanvas: (owner, values) => documentResizeCommandController.resizeCanvas(owner, values),
  },
  ui: {
    showModal,
    setStatus,
    toast,
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
    startNewProject: () => newDocumentController.open(),
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
    doc, history, zoom, dirty, cropRect: cropGestures.snapshot(), selectionRect, selectionShape,
    selectedDocumentPathIndex: pathsController.getSelectedIndex(),
  }),
  applyRuntimeState: state => {
    doc = state.doc;
    history = state.history;
    zoom = state.zoom;
    dirty = state.dirty;
    cropGestures.restore(state.cropRect);
    selectionRect = state.selectionRect;
    selectionShape = state.selectionShape;
    pathsController.setSelectedIndex(state.selectedPathIndex);
    documentPathEditIndex = -1;
    vectorMaskEditLayerId = null;
    penDraftGestures.reset();
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

const historyNavigationController = createHistoryNavigationController({
  state: {
    getHistory: () => history,
    setDocument: value => { doc = value; },
  },
  guard: { blockPendingDocumentEdit },
  restore: { restoreDocument },
  transient: {
    clearSelection: clearSelectionState,
    clearRasterEdit: () => rasterEdit.clearBrushBuffer(),
    resetCrop: () => cropGestures.reset(),
  },
  runtime: { updateAll, markDirty, setStatus },
});
const { undo, redo, jumpToHistory } = historyNavigationController;


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
  cropGestures.reset();
  pathsController.setSelectedIndex(-1);
  documentPathEditIndex = -1;
  vectorMaskEditLayerId = null;
  penDraftGestures.reset();
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

function beginPathControlDrag(hit,point,event){
  const commandResult=pathControlCommands.convertAnchorToCorner(doc,hit,{altKey:event.altKey});
  if(commandResult!==PATH_CONTROL_COMMAND_RESULT.IGNORED)return true;
  const gesture=pathControlGestures.begin(doc,hit,point,{shiftKey:event.shiftKey});
  if(!gesture)return false;
  drag=gesture;
  const control=gesture.control;
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

function pointInsideSelection(point, shape = selectionShape) {
  if (!shape) return true;
  return pointInSelection(point, shape);
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

function clipContextToDocumentSelection(ctx, shape = selectionShape) {
  if (!shape) return;
  if (traceDocumentSelectionPath(ctx, shape)) ctx.clip();
}

function clipContextToSelection(ctx, layer, shape = selectionShape) {
  const polygon = selectionPolygonForLayer(layer, shape);
  if (!polygon) return;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i=1;i<polygon.length;i+=1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.clip();
}

function rasterSelectionPredicate(layer, shape = selectionShape) {
  if (!shape) return null;
  return (x,y) => pointInsideSelection(layerPixelToDocumentPoint({x:x+.5,y:y+.5},layer), shape);
}

function selectionIntersectsLayer(layer, shape = selectionShape) {
  const selectionBoundsSnapshot = shape === selectionShape ? selectionRect : selectionBounds(shape);
  if (!selectionBoundsSnapshot) return false;
  const bounds=frameBounds(layer);
  return selectionBoundsSnapshot.x < bounds.x+bounds.width && selectionBoundsSnapshot.x+selectionBoundsSnapshot.width > bounds.x && selectionBoundsSnapshot.y < bounds.y+bounds.height && selectionBoundsSnapshot.y+selectionBoundsSnapshot.height > bounds.y;
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
  cropGestures.draw(ctx, { zoom, width:doc.width, height:doc.height });
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
  const penDraft=penDraftGestures.snapshot();
  if(penDraft?.points?.length){
    const points=penDraft.points;
    ctx.save();ctx.lineWidth=1.5/zoom;ctx.strokeStyle='#72a7ff';ctx.fillStyle='#fff';ctx.setLineDash([]);
    ctx.beginPath();tracePenDraftPath(ctx,points,penDraftGestures.isGesture(drag)?null:penDraft.hover);ctx.stroke();
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
  pathControlSurface.draw(ctx);
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
  layerTransformSurface.draw(ctx);
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

function bindPropertyInputs(root, owner = doc, layerId = owner?.selectedLayerId ?? null) {
  root?.querySelectorAll('[data-prop]').forEach(input => {
    if (input.type === 'range') {
      input.addEventListener('input', () => {
        const key = input.dataset.prop.startsWith('filters.') ? input.dataset.prop.split('.')[1] : input.dataset.prop;
        const output = input.closest('.range-with-value')?.querySelector('output');
        if (output) output.textContent = formatFilterValue(key, input.value);
        layerPropertyCommandController.applyProperty(owner, layerId, input.dataset.prop, input.value, { commit: false });
      });
      input.addEventListener('change', () => layerPropertyCommandController.applyProperty(owner, layerId, input.dataset.prop, input.value, { commit: true }));
    } else if(input.type === 'number') {
      input.dataset.initialValue=input.value;
      input.addEventListener('change',()=>{normalizeNumberInput(input);layerPropertyCommandController.applyProperty(owner, layerId, input.dataset.prop, input.value, { commit: true });});
    } else {
      input.addEventListener('change', () => layerPropertyCommandController.applyProperty(owner, layerId, input.dataset.prop, input.value, { commit: true }));
    }
  });
}
function refreshInspectorPanels() {
  updateProperties();
  updateEffectsPanel();
}
function formatDisplayExposure(value){
  const ev=Number(value)||0;
  return `${ev>=0?'+':''}${ev.toFixed(1)} EV`;
}

function bindHighDepthPreviewControls(root, owner, layerId){
  const toneMap=root?.querySelector('[data-high-depth-tone-map]');
  if(toneMap)toneMap.addEventListener('change',()=>layerPropertyCommandController.updateHighDepthPreview(owner,layerId,'toneMap',toneMap.value,{commit:true}));
  const exposure=root?.querySelector('[data-high-depth-display-exposure]');
  if(exposure){
    const output=root.querySelector('[data-high-depth-display-output]');
    exposure.addEventListener('input',()=>{
      if(output)output.textContent=formatDisplayExposure(exposure.value);
      layerPropertyCommandController.updateHighDepthPreview(owner,layerId,'displayExposure',exposure.value,{commit:false});
    });
    exposure.addEventListener('change',()=>layerPropertyCommandController.updateHighDepthPreview(owner,layerId,'displayExposure',exposure.value,{commit:true}));
  }
  root?.querySelector('[data-high-depth-preview-reset]')?.addEventListener('click',()=>layerPropertyCommandController.resetHighDepthPreview(owner,layerId));
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
    bindPropertyInputs(els.props,doc,l.id);
    bindAdjustmentControls(els.props,doc,l.id);
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
  const propertyOwner=doc, propertyLayerId=l.id;
  bindPropertyInputs(els.props,propertyOwner,propertyLayerId);
  if(l.type==='raster'&&l.highDepthSource?.model==='rgb'&&Number(l.highDepthSource.bitsPerChannel)>8)bindHighDepthPreviewControls(els.props,propertyOwner,propertyLayerId);
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
    layerPropertyCommandController.applyProperty(propertyOwner,propertyLayerId,'fontFamily',value,{commit:true});
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
    const targetDoc = propertyOwner, targetLayerId = propertyLayerId;
    fontInput.disabled = true;
    try {
      const custom = await textSettingsController.readCustomFont(fontInput.files?.[0]);
      if (!custom || doc !== targetDoc || selected()?.id !== targetLayerId) return;
      layerPropertyCommandController.applyCustomFont(targetDoc,targetLayerId,custom);
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
  bindPropertyInputs(els.effects,doc,l.id);
  if (isLayerLocked(doc,l)) els.effects.querySelectorAll('input,textarea,select').forEach(control => { control.disabled = true; });
}
function escapeHtml(v) { const d=document.createElement('div'); d.textContent=v; return d.innerHTML; }
function escapeAttr(v) { return escapeHtml(v).replaceAll('"','&quot;'); }
function updateToolLabel() {
  const selectionType = selectionGestures.getType();
  els.toolLabel.textContent = currentTool === 'marquee' ? (SELECTION_TYPE_LABELS[selectionType] || TOOL_LABELS.marquee) : (TOOL_LABELS[currentTool] || currentTool);
}

function setTool(tool) {
  if (tool !== currentTool && blockPendingDocumentEdit()) return;
  selectionGestures.prepareToolChange(tool);
  if(tool!=='pen'){penDraftGestures.reset();vectorMaskEditLayerId=null;documentPathEditIndex=-1;}
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
  cropGestures.reset(); hoverPoint = null; clearSmartGuides(); drawOverlay();
  if ((tool === 'clone' || tool === 'heal') && !getRetouchCloneSource()) setStatus(`${TOOL_LABELS[tool]}: Alt+клик по растровому слою задаёт источник`);
}

function canvasPoint(event, { clampToDocument = true } = {}) {
  const r = els.overlay.getBoundingClientRect();
  const x = (event.clientX - r.left) / zoom;
  const y = (event.clientY - r.top) / zoom;
  return clampToDocument ? { x: clamp(x, 0, doc.width), y: clamp(y, 0, doc.height) } : { x, y };
}
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
  const cursor = layerTransformSurface.idleCursor(point);
  if (cursor) els.overlay.style.cursor = cursor;
}

function visibleSnapTargetRects(owner, layerId) {
  return owner.layers
    .filter(layer => layer.id !== layerId && isLayerVisible(owner, layer))
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
    const intent = layerTransformSurface.movePointerIntent(p);
    if (intent?.kind === 'rotate') {
      drag = layerTransformGestures.beginRotate(doc,intent.layer.id,p,intent.center);
      els.overlay.style.cursor = 'grabbing';
      return;
    }
    if (intent?.kind === 'resize') {
      drag = layerTransformGestures.beginResize(doc,intent.layer.id,intent.handle,p);
      els.overlay.style.cursor = intent.cursor;
      return;
    }
    if (intent?.kind === 'move') {
      doc.selectedLayerId = intent.layer.id;
      drag = layerTransformGestures.beginMove(doc,intent.layer.id,p);
      els.overlay.style.cursor='move'; layersPanelController.render(); refreshInspectorPanels(); drawOverlay();
    }
    return;
  }
  if ((currentTool === 'clone' || currentTool === 'heal') && e.altKey) { await setCloneSource(p); return; }
  if (RASTER_BRUSH_TOOLS.has(currentTool)) { await paintGesture.begin({ point:p, pointerEvent:e, tool:currentTool, canContinue:()=>pointerLifecycle.isActivePointer(e.pointerId) }); return; }
  if (currentTool === 'fill') { await fillAtPoint(p); return; }
  if (currentTool === 'gradient') { drag={kind:'gradient',owner:doc,start:p,current:p};drawOverlay();return; }
  if (currentTool === 'wand') { magicWandSelect(p);return; }
  if (currentTool === 'pen') {
    const hit=!penDraftGestures.hasDraft()?pathControlSurface.hit(p):null;
    if(hit){beginPathControlDrag(hit,p,e);drawOverlay();return;}
    if(documentPathEditIndex>=0){
      setStatus('Сохранённый контур: перетаскивайте существующие anchors/handles; новые subpaths добавляются через маску/выделение и сохранение');
      return;
    }
    if(vectorMaskEditLayerId===selected()?.id){
      setStatus('Векторная маска: перетаскивайте существующие anchors/handles; новые контуры добавляются через выделение + Add');
      return;
    }
    const penResult=penDraftGestures.beginPoint(p,{finish:e.detail>=2});
    if(penResult.result===PEN_DRAFT_BEGIN_RESULT.FINISH_REQUESTED)finishPenPath();
    else{
      if(penResult.status)setStatus(penResult.status);
      if(penResult.result===PEN_DRAFT_BEGIN_RESULT.STARTED){drag=penResult.gesture;drawOverlay();}
    }
    return;
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
  if (currentTool === 'crop') { drag = cropGestures.begin(doc,p); drawOverlay(); return; }
  if (currentTool === 'text') { textEditController.open(p); return; }
  if (currentTool === 'eyedropper') { pickColor(p); return; }
  if (currentTool === 'zoom') { setZoomAtClientPoint(zoom*(e.altKey ? 1/1.5 : 1.5),e.clientX,e.clientY); return; }
}

function onOverlayPointerMove(e) {
  const allowOutside = layerTransformGestures.isGesture(drag) || pathControlGestures.isGesture(drag) || drag?.kind === 'paint';
  const p = canvasPoint(e, { clampToDocument: !allowOutside });
  els.pointer.textContent = `x: ${Math.round(p.x)} y: ${Math.round(p.y)}`;
  hoverPoint = p;
  if (!drag) {
    selectionGestures.updateIdleHover(p);
    if(currentTool==='pen')penDraftGestures.updateIdleHover(p);
    if (currentTool === 'zoom') els.overlay.style.cursor=e.altKey?'zoom-out':'zoom-in';
    else if(currentTool==='pen')pathControlSurface.updateCursor(p);
    else updateMoveCursor(p);
    drawOverlay(); return;
  }
  if (drag.kind === 'pan') { els.viewport.scrollLeft = drag.left - (e.clientX-drag.x); els.viewport.scrollTop = drag.top - (e.clientY-drag.y); return; }
  if (layerTransformGestures.isGesture(drag)) {
    layerTransformGestures.update(drag,p,{
      shiftKey:e.shiftKey,
      altKey:e.altKey,
      ctrlKey:e.ctrlKey,
      metaKey:e.metaKey,
    });
    return;
  }
  if (pathControlGestures.isGesture(drag)) {
    pathControlGestures.update(drag,p,{altKey:e.altKey});
    return;
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
  if (cropGestures.isGesture(drag)) { cropGestures.update(drag,p); drawOverlay(); return; }
  if (drag.kind === 'gradient') { drag.current=p;previewGradient(drag.start,p);return; }
  if (penDraftGestures.isGesture(drag)) {
    penDraftGestures.update(drag,p,{altKey:e.altKey});
    drawOverlay();return;
  }
}
async function onOverlayPointerUp(e) {
  if (drag?.kind === 'pan') onOverlayPointerMove(e);
  if (!drag) return;
  if (drag.kind === 'paint') {
    const layer = doc.layers.find(item => item.id === drag.layerId);
    const releasePoint = canvasPoint(e, { clampToDocument:false });
    const localPoint = layer && documentPointToLayerPixel(releasePoint, layer);
    if (localPoint && Math.hypot(localPoint.x-drag.last.x, localPoint.y-drag.last.y) > .01) paintGesture.move(releasePoint, e);
  }
  const d = drag; drag = null;
  if (['marquee','line','shape','gradient'].includes(d.kind)) d.current = canvasPoint(e);
  if (layerTransformGestures.isGesture(d)) {
    layerTransformGestures.finish(d,canvasPoint(e,{clampToDocument:false}),{
      shiftKey:e.shiftKey,
      altKey:e.altKey,
      ctrlKey:e.ctrlKey,
      metaKey:e.metaKey,
    });
  } else {
    clearSmartGuides();
    if (pathControlGestures.isGesture(d)) {
      pathControlGestures.finish(d,canvasPoint(e,{clampToDocument:false}),{altKey:e.altKey});
    }
  }
  if (d.kind === 'pan') els.overlay.style.cursor = (spaceHeld || currentTool === 'hand') ? 'grab' : defaultToolCursor();
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
  if (cropGestures.isGesture(d)) {
    const cropResult = cropGestures.finish(d,canvasPoint(e));
    if (cropResult.accepted) applyCrop(cropResult.owner,cropResult.rect);
    else drawOverlay();
  }
  if (d.kind === 'gradient') await gradientCommands.apply(d.owner,d.start,d.current);
  if (penDraftGestures.isGesture(d)) {
    const penResult=penDraftGestures.finish(d,canvasPoint(e),{altKey:e.altKey});
    if(penResult.status)setStatus(penResult.status);
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
    if (layerTransformGestures.isGesture(d)) layerTransformGestures.cancel(d);
    if (cropGestures.isGesture(d)) cropGestures.cancel(d);
    if (d.kind==='marquee') selectionGestures.cancelMarquee(d);
    if(penDraftGestures.isGesture(d))penDraftGestures.cancelPoint(d);
    if(pathControlGestures.isGesture(d))pathControlGestures.cancel(d);
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
function finishPenPath(){
  const points=penDraftGestures.consumePoints();
  if(penDraftGestures.isGesture(drag))drag=null;
  const outcome=penPathCommands.publish(doc,points,{
    pathClosed:Boolean(els.penClosed?.checked),
    stroke:els.primaryColor.value,
    strokeWidth:els.brushSize.value,
    opacity:Number(els.toolOpacity.value)/100,
  });
  if(outcome.result===PEN_PATH_COMMAND_RESULT.COMMITTED){
    setStatus('Bézier-контур добавлен');drawOverlay();return true;
  }
  if(outcome.result===PEN_PATH_COMMAND_RESULT.NOOP&&outcome.reason===PEN_PATH_NOOP_REASON.TOO_SHORT)drawOverlay();
  return false;
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



function applyNativeHighDepthDab(owner,layer,point,pointerEvent=null,erase=false){
  if(!rasterEdit.isNativeHighDepthPaintTarget(owner,layer))return false;
  const rgb=hexToRgb(els.primaryColor.value);
  const changed=rasterEdit.applyNativeHighDepthBrushDab(owner,layer,point,{
    radius:Math.max(.5,brushWidthForPointer(pointerEvent)/2),
    rgb,
    cmyk:layer.highDepthSource?.model==='cmyk'?rgb8ToDocumentCmyk(rgb):null,
    opacity:Number(els.toolOpacity.value)/100,
    erase,
    isAllowed:rasterSelectionPredicate(layer),
  });
  if(changed)rasterEdit.schedulePaintPreview();
  return changed>0;
}

function nativeHighDepthStrokeSegment(owner,layer,from,to,pointerEvent=null,erase=false){
  if(!rasterEdit.isNativeHighDepthPaintTarget(owner,layer))return false;
  const rgb=hexToRgb(els.primaryColor.value);
  const changed=rasterEdit.applyNativeHighDepthStrokeSegment(owner,layer,from,to,{
    radius:Math.max(.5,brushWidthForPointer(pointerEvent)/2),
    rgb,
    cmyk:layer.highDepthSource?.model==='cmyk'?rgb8ToDocumentCmyk(rgb):null,
    opacity:Number(els.toolOpacity.value)/100,
    erase,
    isAllowed:rasterSelectionPredicate(layer),
  });
  if(changed)rasterEdit.schedulePaintPreview();
  return changed>0;
}



async function setCloneSource(point) {
  const owner=doc;
  const layer=findTopEditableRasterLayerAt(point);
  if(!layer){setStatus(`${TOOL_LABELS[currentTool]}: источник должен находиться на растровом слое`);toast('Alt+кликните по растровому слою','warn');return false;}
  if(!layer.highDepthSource&&!await rasterEdit.ensureRasterBuffer(owner,layer))return false;
  if(doc!==owner||!owner.layers.includes(layer))return false;
  setRetouchCloneSource({layerId:layer.id,documentPoint:{...point},localPoint:documentPointToLayerPixel(point,layer)});
  owner.selectedLayerId=layer.id;
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
function applyCrop(owner,r) {
  const outcome=documentCropCommandController.crop(owner,r);
  if(outcome.result===DOCUMENT_CROP_COMMAND_RESULT.INVALID){
    const message=outcome.error?.message||'Не удалось кадрировать документ';
    toast(message,'error');setStatus(message);
  }else if(outcome.result===DOCUMENT_CROP_COMMAND_RESULT.REJECTED){
    setStatus('Документ изменился — кадрирование не применено');
  }
  return outcome;
}

function selectAllPixels(){setSelectionShape({type:'rect',rect:{x:0,y:0,width:doc.width,height:doc.height}});drawOverlay();setStatus('Выделен весь холст');}
function deselectPixels(){if(!selectionRect&&!selectionGestures.hasPolygonDraft())return;clearSelectionState();drawOverlay();setStatus('Выделение снято');}
function cropToSelection(){if(!selectionRect){setStatus('Нет активного выделения');return;}if(selectionRect.width<1||selectionRect.height<1)return;const owner=doc;applyCrop(owner,{...selectionRect});}

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

function handleAdjustmentCommandResult(result,invalidMessage='') {
  if(result===ADJUSTMENT_COMMAND_RESULT.COMMITTED)return true;
  refreshInspectorPanels();
  if(result===ADJUSTMENT_COMMAND_RESULT.INVALID&&invalidMessage)setStatus(invalidMessage);
  return false;
}

function bindAdjustmentControls(root,owner,layerId) {
  root?.querySelectorAll('[data-adjustment-prop]').forEach(input=>input.addEventListener('change',()=>{
    handleAdjustmentCommandResult(
      adjustmentLayerCommandController.updateProperty(owner,layerId,input.dataset.adjustmentProp,input.value),
      'Некорректный параметр adjustment layer',
    );
  }));
  root?.querySelectorAll('[data-adjustment-curve-channel]').forEach(input=>input.addEventListener('change',()=>{
    handleAdjustmentCommandResult(
      adjustmentLayerCommandController.updateCurveChannel(owner,layerId,input.dataset.adjustmentCurveChannel,input.value),
      'Curves: используйте 2–19 точек в формате input:output, 0..255',
    );
  }));
  const clippingInput=root?.querySelector('[data-adjustment-clipping]');
  clippingInput?.addEventListener('change',()=>{
    handleAdjustmentCommandResult(adjustmentLayerCommandController.setClipping(owner,layerId,clippingInput.checked));
  });
}
function toggleSelectedVisibility() { return layerGroupCommandController.toggleSelectedLayerVisibility(); }
function toggleSelectedLock() { return layerGroupCommandController.toggleSelectedLayerLock(); }
function nudgeSelected(dx,dy) {
  const l=selected();if(!l)return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
  return layerTransformCommandController.nudge(doc,l.id,dx,dy);
}
function selectAdjacentLayer(direction) {
  if (!doc.layers.length) return;
  const index=Math.max(0,doc.layers.findIndex(l=>l.id===doc.selectedLayerId));
  const next=clamp(index+direction,0,doc.layers.length-1);
  doc.selectedLayerId=doc.layers[next].id; updateAll();
}

function centerSelectedLayer() {
  const l=selected();if(!l)return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
  return layerTransformCommandController.center(doc,l.id);
}
function alignSelectedLayer(mode) {
  const l=selected();
  if(!l){setStatus('Сначала выберите слой');return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;}
  const result=layerTransformCommandController.align(doc,l.id,mode);
  if(result===LAYER_TRANSFORM_COMMAND_RESULT.NOOP){
    setStatus('Слой уже выровнен');
  }else if(result===LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED){
    setStatus(`Слой выровнен ${LAYER_ALIGNMENT_LABELS[mode]}`);
  }else if(result===LAYER_TRANSFORM_COMMAND_RESULT.REJECTED){
    if(!isTransformableLayer(l))setStatus('Корректирующий слой не имеет геометрической трансформации');
    else if(isLayerLocked(doc,l))setStatus('Слой или его группа заблокированы');
  }
  return result;
}
function fitSelectedLayerToCanvas() {
  const l=selected();if(!l)return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
  return layerTransformCommandController.fitToCanvas(doc,l.id);
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
  showInfoModal('О ZeTer Photo Editor',`<div class="about-copy"><strong>ZeTer Photo Editor ${escapeHtml(currentAppVersion())}</strong><p>Браузерный графический редактор со слоями, историей, умной привязкой, выделением, кистью, заливкой, линиями, текстом, фигурами и экспортом. Работает онлайн и локально; изображения обрабатываются в браузере.</p><p>Формат проекта: <code>.zpe</code>.</p><div class="developer-card"><span>Разработчик</span><strong>Дмитрий Колесниченко</strong><a href="mailto:zeter11@gmail.com">zeter11@gmail.com</a><a href="https://t.me/zeterchat" target="_blank" rel="noopener noreferrer">Telegram: @zeterchat</a><a href="https://github.com/zeter1" target="_blank" rel="noopener noreferrer">GitHub: @zeter1</a><a href="https://www.facebook.com/zeter1" target="_blank" rel="noopener noreferrer">Facebook: @zeter1</a><a href="https://www.instagram.com/zeter1992/" target="_blank" rel="noopener noreferrer">Instagram: @zeter1992</a></div></div>`);
}

function deleteSelected(){return layerGroupCommandController.deleteSelectedLayer();}
function duplicateSelected(){return layerGroupCommandController.duplicateSelectedLayer();}
function renameLayer(layer){return layer ? layerGroupCommandController.renameLayer(doc,layer.id) : false;}
function addGroup(parentGroupId=null){return layerGroupCommandController.createGroup(doc,parentGroupId);}
function renameGroup(group){return group ? layerGroupCommandController.renameGroup(doc,group.id) : false;}
function editGroupProperties(group){return group ? layerGroupCommandController.editGroupProperties(doc,group.id) : false;}
function deleteLayerGroup(group){return group ? layerGroupCommandController.deleteGroup(doc,group.id) : false;}
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
    ['Переименовать…','F2',()=>layerGroupCommandController.renameLayer(owner,id),editable],
    ['Дублировать','Ctrl+J',()=>layerGroupCommandController.duplicateLayer(owner,id),()=>selectedTarget() && editable()],
    ['Удалить','Delete',()=>layerGroupCommandController.deleteLayer(owner,id),()=>selectedTarget() && editable()],
    ['sep'],
    ['Добавить маску (показать всё)','',()=>addSelectedLayerMask(false),()=>selectedTarget() && editable() && !target().mask],
    ['Добавить маску из выделения','',()=>addSelectedLayerMask(true),()=>selectedTarget() && editable() && !target().mask && Boolean(selectionShape)],
    ['Параметры растровой маски…','',editSelectedLayerMaskProperties,()=>selectedTarget() && editable() && Boolean(target().mask)],
    ['Инвертировать растровую маску','',invertSelectedLayerMask,()=>selectedTarget() && editable() && Boolean(target().mask)],
    ['Включить / отключить растровую маску','',toggleSelectedLayerMask,()=>selectedTarget() && editable() && Boolean(target().mask)],
    ['Связать / отвязать растровую маску','',toggleSelectedLayerMaskLink,()=>selectedTarget() && editable() && Boolean(target().mask) && target().type!=='adjustment'],
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
    ['Показать / скрыть','',()=>layerGroupCommandController.toggleLayerVisibility(owner,id),()=>Boolean(target())],
    ['Заблокировать / разблокировать','',()=>layerGroupCommandController.toggleLayerLock(owner,id),()=>{const layer=target();const group=layer?.groupId?owner.groups?.find(item=>item.id===layer.groupId):null;return Boolean(layer)&&!(group&&isGroupLocked(owner,group));}],
    ['sep'],
    ['Поднять слой','',()=>layerGroupCommandController.moveLayer(owner,id,1),editable],
    ['Опустить слой','',()=>layerGroupCommandController.moveLayer(owner,id,-1),editable],
    ['Растеризовать','',rasterizeSelectedLayer,()=>editable() && target().type !== 'raster' && target().type !== 'adjustment'],
  ];
}
function groupContextMenu(id) {
  const owner=doc;
  const target = () => doc===owner ? doc.groups?.find(item => item.id === id) : null;
  return [
    ['Создать подгруппу','',()=>layerGroupCommandController.createGroup(owner,id),()=>Boolean(target()) && !isGroupLocked(owner,target())],
    ['Параметры группы…','',()=>layerGroupCommandController.editGroupProperties(owner,id),()=>Boolean(target()) && !isGroupLocked(owner,target())],
    ['Переименовать…','',()=>layerGroupCommandController.renameGroup(owner,id),()=>Boolean(target()) && !isGroupLocked(owner,target())],
    ['Свернуть / развернуть','',()=>{const group=target();if(group){group.collapsed=!group.collapsed;layersPanelController.render();}},()=>Boolean(target())],
    ['Показать / скрыть','',()=>layerGroupCommandController.toggleGroupVisibility(owner,id),()=>Boolean(target())],
    ['Заблокировать / разблокировать','',()=>layerGroupCommandController.toggleGroupLock(owner,id),()=>{const group=target();const parent=group?.parentGroupId?owner.groups?.find(item=>item.id===group.parentGroupId):null;return Boolean(group)&&!(parent&&isGroupLocked(owner,parent));}],
    ['sep'],
    ['Удалить группу (содержимое останется)','',()=>layerGroupCommandController.deleteGroup(owner,id),()=>Boolean(target()) && !isGroupLocked(owner,target())],
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
  if(layer?.mask){
    const mask=layer.mask;
    const state=mask.enabled===false?'отключена':mask.invert?'инвертирована':'включена';
    const density=Math.round((mask.density??1)*100);
    const feather=Number(mask.feather)||0;
    const linkage=mask.linked===false?'отвязана':'связана';
    parts.push(`растровая: ${state}, ${linkage}, плотность ${density}%, растушёвка ${feather}px${mask.dataUrl?'':' (показать всё)'}`);
  }
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

const menus={
  file:[
    ['Новый…','Ctrl+N',newDocumentController.open],
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
    ['Контент-заливка выделения','',contentAwareFillSelection,()=>Boolean(selectionShape)&&isEditableRasterLayer(selected())],
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
    ['Параметры растровой маски…','',editSelectedLayerMaskProperties,()=>Boolean(selected()?.mask)&&!isLayerLocked(doc,selected())],
    ['Инвертировать растровую маску','',invertSelectedLayerMask,()=>Boolean(selected()?.mask)&&!isLayerLocked(doc,selected())],
    ['Включить / отключить растровую маску','',toggleSelectedLayerMask,()=>Boolean(selected()?.mask)&&!isLayerLocked(doc,selected())],
    ['Связать / отвязать растровую маску','',toggleSelectedLayerMaskLink,()=>Boolean(selected()?.mask)&&selected()?.type!=='adjustment'&&!isLayerLocked(doc,selected())],
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
    ['Центрировать слой на холсте','',centerSelectedLayer,()=>layerTransformSurface.isTransformableLayer(selected())&&!isLayerLocked(doc,selected())],
    ['Вписать слой в холст','',fitSelectedLayerToCanvas,()=>layerTransformSurface.isTransformableLayer(selected())&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Показать / скрыть слой','',toggleSelectedVisibility,()=>Boolean(selected())],
    ['Заблокировать / разблокировать','',toggleSelectedLock,()=>{const layer=selected();const group=layer?.groupId?doc.groups?.find(item=>item.id===layer.groupId):null;return Boolean(layer)&&!(group&&isGroupLocked(doc,group));}],
    ['sep'],
    ['Поднять слой','',()=>layerGroupCommandController.moveSelectedLayer(1),()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Опустить слой','',()=>layerGroupCommandController.moveSelectedLayer(-1),()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  image:[
    ['Цветокоррекция…','',()=>colorCorrectionController.open(selected()),()=>selected()?.type==='raster'&&!isLayerLocked(doc,selected())],
    ['Сбросить цветокоррекцию','',()=>layerPropertyCommandController.resetSelectedColorCorrection(),()=>selected()?.type==='raster'&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Размер изображения…','',documentResizeController.showImageSizeDialog],
    ['Размер холста…','',documentResizeController.showCanvasSizeDialog],
    ['Фон документа…','',documentBackgroundController.showDocumentBackgroundDialog],
    ['sep'],
    ['Сбросить все фильтры слоя','',()=>layerPropertyCommandController.resetSelectedFilters(),()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
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
    ['Центр обучения','',showLearningCenter],
    ['Горячие клавиши','?',showShortcuts],
    ['sep'],
    ['О программе','',showAbout],
  ],
};
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
$('#layerUpBtn').onclick=()=>layerGroupCommandController.moveSelectedLayer(1);$('#layerDownBtn').onclick=()=>layerGroupCommandController.moveSelectedLayer(-1);
pathsController.bindControls();
layersPanelController.bind();
$('#clearHistoryBtn').onclick=()=>{history.clearToCurrent();updateHistory();updateAll();};
$('#resetColorEffectsBtn').onclick=layerPropertyCommandController.resetSelectedEffects;
els.addTab.onclick=()=>addDocumentTab();
els.blend.onchange=()=>layerPropertyCommandController.setSelectedBlendMode(els.blend.value);
els.layerOpacity.oninput=()=>layerPropertyCommandController.setSelectedOpacity(els.layerOpacity.value,{commit:false});
els.layerOpacity.onchange=()=>layerPropertyCommandController.setSelectedOpacity(els.layerOpacity.value,{commit:true});
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
      if(layerTransformGestures.isGesture(d))layerTransformGestures.cancel(d);
      if(penDraftGestures.isGesture(d))penDraftGestures.cancelPoint(d);
      if(pathControlGestures.isGesture(d))pathControlGestures.cancel(d);
      if(cropGestures.isGesture(d))cropGestures.cancel(d);
      if(d.kind==='marquee')selectionGestures.cancelMarquee(d);
      els.overlay.style.cursor=defaultToolCursor();drawOverlay();setStatus('Действие отменено');return;
    }
    if(selectionGestures.hasPolygonDraft()){e.preventDefault();selectionGestures.cancelPolygonDraft({restorePrevious:true,announce:true});return;}
    if(penDraftGestures.hasDraft()){e.preventDefault();penDraftGestures.cancelDraft();drawOverlay();setStatus('Контур отменён');return;}
    if(selectionGestures.hasMagneticDraft()){e.preventDefault();selectionGestures.cancelMagneticDraft({announce:true});return;}
    if(cropGestures.hasDraft()){cropGestures.reset();drawOverlay();setStatus('Кадрирование отменено');return;}
    if(selectionRect){deselectPixels();return;}
  }
  if(e.target instanceof Node && els.modalRoot.contains(e.target))return;
  if(menuController.isOpen() && (els.menu.contains(e.target)||e.target.closest?.('.menu-button')))return;
  if(e.key==='Enter'&&selectionGestures.hasPolygonDraft()&&currentTool==='marquee'){e.preventDefault();selectionGestures.finishPolygonSelection();return;}
  if(e.key==='Enter'&&penDraftGestures.hasDraft()&&currentTool==='pen'){e.preventDefault();finishPenPath();return;}
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
  if(ctrl&&e.code==='KeyN'){e.preventDefault();e.shiftKey?addBlankLayer():newDocumentController.open();return;}
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

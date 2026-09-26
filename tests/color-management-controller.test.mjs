import test from 'node:test';
import assert from 'node:assert/strict';
import { createColorManagementController } from '../src/ui/color-management-controller.js';

const DEFAULT_POLICY = {
  renderingIntent:'perceptual',
  proofRenderingIntent:'relative',
  displaySpace:'srgb',
  softProofEnabled:false,
  blackPointCompensation:true,
  gamutWarningEnabled:false,
  gamutWarningThreshold:4,
};

class FakeFile {
  constructor(name, bytes) {
    this.name = name;
    this.bytes = Uint8Array.from(bytes);
    this.size = this.bytes.byteLength;
  }
  async arrayBuffer() {
    return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength);
  }
}

function documentValue(overrides = {}) {
  return {
    colorManagement:{ ...DEFAULT_POLICY },
    colorProfile:null,
    proofProfile:null,
    displayProfile:null,
    layers:[],
    ...overrides,
  };
}

function harness(initialDocument, overrides = {}) {
  let activeDocument = initialDocument;
  const commits = [], statuses = [], toasts = [], errors = [], invalidated = [];
  let previewFactoryCalls = 0, editingFactoryCalls = 0;

  const controller = createColorManagementController({
    state:{
      getDocument:() => activeDocument,
      commit:label => commits.push(label),
    },
    color:{
      sanitizeColorManagement:value => ({ ...DEFAULT_POLICY, ...(value || {}) }),
      createCmykToSrgbTransform:(source, options) => {
        previewFactoryCalls += 1;
        return { kind:'preview', source, options, warning:'' };
      },
      createSrgbToCmykTransform:(source, options) => {
        editingFactoryCalls += 1;
        return { kind:'editing', source, options, apply:(r,g,b) => [r,g,b,0] };
      },
      createCmykSoftProofTransform:(source, proof, options) => {
        previewFactoryCalls += 1;
        return { kind:'proof', source, proof, options, warning:'' };
      },
      inspectCmykIccProfile:() => ({ colorSpace:'CMYK', pcs:'Lab ' }),
      inspectDisplayIccProfile:() => ({ colorSpace:'RGB ', pcs:'XYZ ' }),
      ...overrides.color,
    },
    pixels:{
      deserializePixelBufferSource:source => source.buffer,
      cmykPixelBufferToRgba8Preview:buffer => new Uint8ClampedArray(buffer.width * buffer.height * 4),
      ...overrides.pixels,
    },
    io:{
      dataUrlToBytes:dataUrl => Uint8Array.from([String(dataUrl).length & 255]),
      bytesToDataUrl:bytes => 'data:icc;base64,'+bytes.byteLength,
      rgbaPixelsToDataUrl:async () => 'data:image/png;base64,preview',
      ...overrides.io,
    },
    render:{
      invalidateImageCache:value => invalidated.push(value),
      ...overrides.render,
    },
    ui:{
      setStatus:value => statuses.push(value),
      toast:(message,tone) => toasts.push([message,tone]),
      consoleRef:{ error:error => errors.push(error) },
      ...overrides.ui,
    },
    FileCtor:FakeFile,
  });

  return {
    controller, commits, statuses, toasts, errors, invalidated,
    setActiveDocument:value => { activeDocument = value; },
    previewFactoryCalls:() => previewFactoryCalls,
    editingFactoryCalls:() => editingFactoryCalls,
  };
}

test('transform caches are controller-owned, reused and invalidated by policy changes', async () => {
  const doc = documentValue({ colorProfile:{ kind:'icc', dataUrl:'data:source' } });
  const h = harness(doc);

  const firstPreview = h.controller.currentCmykPreviewTransform();
  assert.equal(h.controller.currentCmykPreviewTransform(), firstPreview);
  assert.equal(h.previewFactoryCalls(), 1);

  const firstEditing = h.controller.currentSrgbToCmykTransform();
  assert.equal(h.controller.currentSrgbToCmykTransform(), firstEditing);
  assert.equal(h.editingFactoryCalls(), 1);

  assert.equal(await h.controller.updateDocumentRenderingIntent('absolute'), true);
  assert.equal(doc.colorManagement.renderingIntent, 'absolute');
  assert.equal(h.previewFactoryCalls(), 2);
  assert.equal(h.commits.at(-1), 'Изменить CMYK rendering intent');

  h.controller.currentSrgbToCmykTransform();
  assert.equal(h.editingFactoryCalls(), 2);

  h.controller.invalidateTransformCaches();
  h.controller.currentCmykPreviewTransform();
  h.controller.currentSrgbToCmykTransform();
  assert.equal(h.previewFactoryCalls(), 3);
  assert.equal(h.editingFactoryCalls(), 3);
});

test('stale document during async preview rebuild rolls policy back and never publishes pixels', async () => {
  const layer = {
    type:'raster',
    name:'CMYK',
    dataUrl:'data:image/png;base64,old',
    highDepthSource:{ model:'cmyk', buffer:{ width:1, height:1 } },
  };
  const target = documentValue({ layers:[layer] });
  const replacement = documentValue();
  let h;
  h = harness(target, {
    io:{
      rgbaPixelsToDataUrl:async () => {
        h.setActiveDocument(replacement);
        return 'data:image/png;base64,new';
      },
    },
  });

  const before = structuredClone(target.colorManagement);
  assert.equal(await h.controller.setDocumentGamutWarningEnabled(true), false);
  assert.deepEqual(target.colorManagement, before);
  assert.equal(layer.dataUrl, 'data:image/png;base64,old');
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.invalidated, []);
  assert.equal(h.statuses.at(-1), 'CMYK preview отменён: активный документ изменился');

  h.setActiveDocument(target);
  h.controller.currentCmykPreviewTransform();
  assert.equal(h.previewFactoryCalls(), 2, 'rollback must invalidate the stale transform cache');
});

test('proof profile loading validates ICC kind and enables soft proof through one transaction', async () => {
  const doc = documentValue();
  const h = harness(doc);
  const file = new FakeFile('press.icc', [1,2,3,4]);

  assert.equal(await h.controller.loadDocumentProofProfile(file), true);
  assert.equal(doc.colorManagement.softProofEnabled, true);
  assert.equal(doc.proofProfile.name, 'press.icc');
  assert.equal(doc.proofProfile.colorSpace, 'CMYK');
  assert.equal(doc.proofProfile.pcs, 'Lab ');
  assert.equal(h.commits.at(-1), 'Загрузить soft proof ICC profile');

  assert.equal(await h.controller.removeDocumentProofProfile(), true);
  assert.equal(doc.proofProfile, null);
  assert.equal(doc.colorManagement.softProofEnabled, false);
  assert.equal(h.commits.at(-1), 'Удалить soft proof ICC profile');
});

test('rendering-intent control restores disabled state and preserves existing error surface', async () => {
  const doc = documentValue();
  const expected = new Error('transform failed');
  let handler = null;
  const intent = {
    value:'relative',
    disabled:false,
    isConnected:true,
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      handler = listener;
    },
  };
  const root = {
    querySelector(selector) {
      return selector === '[data-cmyk-rendering-intent]' ? intent : null;
    },
  };
  const h = harness(doc, {
    color:{ sanitizeColorManagement:() => { throw expected; } },
  });

  h.controller.bindControls(root);
  assert.equal(typeof handler, 'function');
  await handler();

  assert.equal(intent.disabled, false);
  assert.equal(h.errors[0], expected);
  assert.deepEqual(h.toasts.at(-1), ['Не удалось пересчитать CMYK preview','error']);
  assert.equal(h.statuses.at(-1), 'Ошибка CMYK color management: transform failed');
});

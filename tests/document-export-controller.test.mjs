import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentExportController } from '../src/document/export-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function defaultPrepared(overrides = {}) {
  return {
    layers: [],
    groups: [],
    paths: [],
    linkedLayerBlocks: [],
    composite: new Uint8Array([1, 2, 3, 4]),
    compositePixelBuffer: null,
    bitsPerChannel: 8,
    colorMode: 'rgb',
    warnings: [],
    ...overrides,
  };
}

function makeHarness({
  documentValue = {
    name: 'My Project',
    width: 640,
    height: 480,
    layers: [{ id: 'layer-one' }],
    colorProfile: null,
  },
  pendingChecks = [],
  compositeToBlob,
  prepareDocument,
  prepared = defaultPrepared(),
} = {}) {
  const state = { documentValue };
  const calls = {
    snapshots: 0,
    restores: 0,
    composites: [],
    prepares: [],
    psdEncodes: [],
    psbEncodes: [],
    iccReads: [],
    downloads: [],
    statuses: [],
    toasts: [],
    alerts: [],
    warnings: [],
    errors: [],
  };
  let pendingIndex = 0;
  let modal = null;

  const controller = createDocumentExportController({
    documentState: {
      getDocument: () => state.documentValue,
      blockPendingDocumentEdit: () => Boolean(pendingChecks[pendingIndex++]),
      snapshotDocument: value => {
        calls.snapshots += 1;
        return structuredClone(value);
      },
      restoreDocument: value => {
        calls.restores += 1;
        return structuredClone(value);
      },
    },
    rendering: {
      compositeToBlob: compositeToBlob || (async (documentSnapshot, type, quality) => {
        calls.composites.push({ documentSnapshot, type, quality });
        return { type, quality };
      }),
    },
    psd: {
      prepareDocument: prepareDocument || (async documentSnapshot => {
        calls.prepares.push(documentSnapshot);
        return prepared;
      }),
    },
    codec: {
      encodePsdBlob: options => {
        calls.psdEncodes.push(options);
        return { kind: 'psd' };
      },
      encodePsbBlob: options => {
        calls.psbEncodes.push(options);
        return { kind: 'psb' };
      },
    },
    io: {
      downloadBlob: (blob, name) => calls.downloads.push({ blob, name }),
      safeFilename: value => String(value || 'image').replace(/\s+/g, '_'),
      dataUrlToBytes: (value, options) => {
        calls.iccReads.push({ value, options });
        return new Uint8Array([9, 8, 7]);
      },
      mimeExtensions: {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/vnd.adobe.photoshop': 'psd',
      },
    },
    ui: {
      showModal: options => { modal = options; },
      setStatus: message => calls.statuses.push(message),
      toast: (message, tone) => calls.toasts.push([message, tone]),
      alertUser: message => calls.alerts.push(message),
      consoleRef: {
        warn: (...args) => calls.warnings.push(args),
        error: (...args) => calls.errors.push(args),
      },
    },
  });

  return {
    controller,
    state,
    calls,
    getModal: () => modal,
  };
}

test('pending edit blocks opening the Export modal', () => {
  const harness = makeHarness({ pendingChecks: [true] });
  harness.controller.showExportDialog();
  assert.equal(harness.getModal(), null);
  assert.equal(harness.calls.snapshots, 0);
  assert.deepEqual(harness.calls.downloads, []);
});

test('Export modal preserves format schema and repeats the pending-edit guard on submit', async () => {
  const harness = makeHarness({ pendingChecks: [false, true] });
  harness.controller.showExportDialog();
  const modal = harness.getModal();

  assert.equal(modal.title, 'Экспорт изображения');
  assert.equal(modal.submitLabel, 'Экспорт');
  assert.deepEqual(modal.fields, [
    {
      name: 'format',
      label: 'Формат',
      type: 'select',
      value: 'image/png',
      options: [
        ['image/png', 'PNG'],
        ['image/jpeg', 'JPEG'],
        ['image/webp', 'WebP'],
        ['image/vnd.adobe.photoshop', 'PSD — RGB/CMYK слои 8/16/32-bit'],
        ['psb', 'PSB — RGB/CMYK Large Document 8/16/32-bit'],
      ],
    },
    {
      name: 'quality',
      label: 'Качество',
      type: 'number',
      value: '92',
      min: '1',
      max: '100',
    },
  ]);

  assert.equal(await modal.onSubmit({ format: 'image/png', quality: '92' }), false);
  assert.equal(harness.calls.snapshots, 0);
  assert.deepEqual(harness.calls.downloads, []);
});

test('raster export owns one detached submit-time document snapshot across async rendering', async () => {
  const gate = deferred();
  let receivedDocument;
  const harness = makeHarness({
    pendingChecks: [false, false],
    compositeToBlob: async (documentSnapshot, type, quality) => {
      receivedDocument = documentSnapshot;
      harness.calls.composites.push({ documentSnapshot, type, quality });
      return gate.promise;
    },
  });
  harness.controller.showExportDialog();
  const exporting = harness.getModal().onSubmit({ format: 'image/png', quality: '92' });

  harness.state.documentValue.name = 'Changed Later';
  harness.state.documentValue.layers.push({ id: 'layer-two' });
  assert.equal(receivedDocument.name, 'My Project');
  assert.deepEqual(receivedDocument.layers, [{ id: 'layer-one' }]);

  gate.resolve({ kind: 'png' });
  await exporting;

  assert.equal(harness.calls.snapshots, 1);
  assert.equal(harness.calls.restores, 1);
  assert.deepEqual(harness.calls.downloads, [{ blob: { kind: 'png' }, name: 'My_Project.png' }]);
  assert.equal(harness.calls.statuses.at(-1), 'Экспортирован My_Project.png');
});


for (const [format, extension] of [
  ['image/vnd.adobe.photoshop', 'psd'],
  ['psb', 'psb'],
]) {
  test(`${extension.toUpperCase()} export keeps a detached snapshot across async preparation and tab switch`, async () => {
    const prepareGate = deferred();
    const sourceDocument = {
      name: 'Source Master',
      width: 1200,
      height: 800,
      layers: [{ id: 'source-layer' }],
      colorProfile: {
        kind: 'icc',
        dataUrl: 'data:application/octet-stream;base64,AA==',
        untagged: true,
      },
    };
    const expectedSnapshot = structuredClone(sourceDocument);
    let preparedSnapshot;
    const harness = makeHarness({
      documentValue: sourceDocument,
      pendingChecks: [false, false],
      prepareDocument: async snapshot => {
        preparedSnapshot = snapshot;
        await prepareGate.promise;
        return defaultPrepared();
      },
    });

    harness.controller.showExportDialog();
    const exporting = harness.getModal().onSubmit({ format, quality: '92' });
    assert.notStrictEqual(preparedSnapshot, sourceDocument);
    assert.deepEqual(preparedSnapshot, expectedSnapshot);

    sourceDocument.name = 'Edited During Export';
    sourceDocument.width = 2000;
    sourceDocument.layers.push({ id: 'new-layer' });
    sourceDocument.colorProfile.dataUrl = 'data:application/octet-stream;base64,AQ==';
    sourceDocument.colorProfile.untagged = false;
    harness.state.documentValue = {
      name: 'Other Tab',
      width: 400,
      height: 300,
      layers: [],
      colorProfile: null,
    };
    assert.deepEqual(harness.calls.downloads, [], 'no download before preparation completes');

    prepareGate.resolve();
    await exporting;

    const encodes = extension === 'psd' ? harness.calls.psdEncodes : harness.calls.psbEncodes;
    const otherEncodes = extension === 'psd' ? harness.calls.psbEncodes : harness.calls.psdEncodes;
    assert.equal(harness.calls.snapshots, 1);
    assert.equal(harness.calls.restores, 1);
    assert.deepEqual(preparedSnapshot, expectedSnapshot);
    assert.equal(encodes.length, 1);
    assert.deepEqual(otherEncodes, []);
    assert.equal(encodes[0].width, 1200);
    assert.equal(encodes[0].height, 800);
    assert.deepEqual(encodes[0].iccProfile, new Uint8Array([9, 8, 7]));
    assert.equal(encodes[0].iccUntagged, true);
    assert.deepEqual(harness.calls.iccReads, [{
      value: 'data:application/octet-stream;base64,AA==',
      options: { maxBytes: 4 * 1024 * 1024 },
    }]);
    assert.deepEqual(harness.calls.downloads, [{
      blob: { kind: extension },
      name: `Source_Master.${extension}`,
    }]);
    assert.equal(harness.calls.statuses.at(-1), `Экспортирован Source_Master.${extension}`);
    assert.deepEqual(harness.calls.alerts, []);
    assert.deepEqual(harness.calls.errors, []);
  });
}

for (const [type, rawQuality, expectedQuality, extension] of [
  ['image/png', '92', 0.92, 'png'],
  ['image/jpeg', '500', 1, 'jpg'],
  ['image/webp', '0', 0.01, 'webp'],
]) {
  test(`${type} routes quality, extension and safe filename through raster export ports`, async () => {
    const harness = makeHarness({ pendingChecks: [false, false] });
    harness.controller.showExportDialog();
    await harness.getModal().onSubmit({ format: type, quality: rawQuality });

    assert.equal(harness.calls.composites.length, 1);
    assert.equal(harness.calls.composites[0].type, type);
    assert.equal(harness.calls.composites[0].quality, expectedQuality);
    assert.equal(harness.calls.downloads[0].name, `My_Project.${extension}`);
    assert.equal(harness.calls.prepares.length, 0);
    assert.equal(harness.calls.psdEncodes.length, 0);
    assert.equal(harness.calls.psbEncodes.length, 0);
  });
}

test('PSD export routes preparation, ICC bounds and writer resource limits without duplicating preparation', async () => {
  const harness = makeHarness({
    documentValue: {
      name: 'Print Master',
      width: 1200,
      height: 900,
      layers: [],
      colorProfile: { kind: 'icc', dataUrl: 'data:application/octet-stream;base64,AA==', untagged: true },
    },
    pendingChecks: [false, false],
  });
  harness.controller.showExportDialog();
  await harness.getModal().onSubmit({ format: 'image/vnd.adobe.photoshop', quality: '92' });

  assert.equal(harness.calls.prepares.length, 1);
  assert.equal(harness.calls.psdEncodes.length, 1);
  assert.equal(harness.calls.psbEncodes.length, 0);
  assert.equal(harness.calls.psdEncodes[0].width, 1200);
  assert.equal(harness.calls.psdEncodes[0].height, 900);
  assert.deepEqual(harness.calls.psdEncodes[0].iccProfile, new Uint8Array([9, 8, 7]));
  assert.equal(harness.calls.psdEncodes[0].iccUntagged, true);
  assert.equal(harness.calls.psdEncodes[0].maxPixels, 48_000_000);
  assert.equal(harness.calls.psdEncodes[0].maxLayers, 500);
  assert.deepEqual(harness.calls.iccReads, [{
    value: 'data:application/octet-stream;base64,AA==',
    options: { maxBytes: 4 * 1024 * 1024 },
  }]);
  assert.deepEqual(harness.calls.downloads, [{ blob: { kind: 'psd' }, name: 'Print_Master.psd' }]);
  assert.deepEqual(harness.calls.toasts.at(-1), ['PSD экспортирован', 'success']);
});

test('PSB export selects the PSB codec and preserves bounded warning publication', async () => {
  const harness = makeHarness({
    pendingChecks: [false, false],
    prepared: defaultPrepared({ warnings: ['fallback one', 'fallback two'], bitsPerChannel: 16 }),
  });
  harness.controller.showExportDialog();
  await harness.getModal().onSubmit({ format: 'psb', quality: '92' });

  assert.equal(harness.calls.psdEncodes.length, 0);
  assert.equal(harness.calls.psbEncodes.length, 1);
  assert.deepEqual(harness.calls.downloads, [{ blob: { kind: 'psb' }, name: 'My_Project.psb' }]);
  assert.equal(harness.calls.warnings.length, 1);
  assert.deepEqual(harness.calls.warnings[0], ['PSB export warnings', ['fallback one', 'fallback two']]);
  assert.equal(harness.calls.statuses.at(-1), 'Экспортирован My_Project.psb с ограничениями: 2');
  assert.deepEqual(
    harness.calls.toasts.at(-1),
    ['PSB экспортирован с ограничениями: 2. Подробности — в консоли', 'warn'],
  );
});

test('export failure remains observable and never publishes a partial download', async () => {
  const error = new Error('renderer failed');
  const harness = makeHarness({
    pendingChecks: [false, false],
    compositeToBlob: async () => { throw error; },
  });
  harness.controller.showExportDialog();
  await harness.getModal().onSubmit({ format: 'image/png', quality: '92' });

  assert.deepEqual(harness.calls.downloads, []);
  assert.equal(harness.calls.errors.length, 1);
  assert.strictEqual(harness.calls.errors[0][0], error);
  assert.deepEqual(harness.calls.alerts, ['renderer failed']);
  assert.equal(harness.calls.statuses.at(-1), 'Ошибка экспорта');
});

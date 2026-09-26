import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bytesToDataUrl } from '../src/core/io.js';
import { createPsdSmartObjectResource } from '../src/document/psd-smart-object-resource.js';
import { decodePsd, inspectPsdHeader } from '../src/formats/psd.js';

const fixtureRoot = new URL('./fixtures/photoshop-smart-objects/', import.meta.url);

function opaqueBlockToState(block) {
  if (!block?.key || !(block.data instanceof Uint8Array)) return null;
  return {
    signature:block.signature === '8B64' ? '8B64' : '8BIM',
    key:String(block.key).slice(0, 4),
    dataUrl:bytesToDataUrl(block.data, 'application/octet-stream'),
  };
}

function preparedRgbDocument(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  return {
    layers:[{
      name:'Embedded',
      x:0,
      y:0,
      width,
      height,
      pixels,
      opacity:1,
      blendMode:'source-over',
      visible:true,
    }],
    groups:[],
    paths:[],
    linkedLayerBlocks:[],
    composite:pixels.slice(),
    compositePixelBuffer:null,
    bitsPerChannel:8,
    colorMode:'rgb',
  };
}

function makeResource({ prepareDocument } = {}) {
  return createPsdSmartObjectResource({
    prepareDocument:prepareDocument || (async embedded => preparedRgbDocument(embedded.width, embedded.height)),
    opaqueBlockToState,
  });
}

test('embedded PNG serialization stays bounded to the preview payload and rejects unsupported types', async () => {
  const resource = makeResource();
  const preview = 'data:image/png;base64,iVBORw0KGgo=';
  const bytes = await resource.serializeEmbeddedAsset(
    { width:1, height:1 },
    { asset:{ detectedFileType:'PNG' } },
    preview,
  );
  assert.deepEqual([...bytes], [137,80,78,71,13,10,26,10]);

  await assert.rejects(
    resource.serializeEmbeddedAsset(
      { width:1, height:1 },
      { asset:{ detectedFileType:'jpeg' } },
      preview,
    ),
    /embedded PNG\/PSD\/PSB/,
  );
});

test('embedded PSD and PSB serialization selects the matching writer while preserving safety limits', async () => {
  const resource = makeResource();
  const embedded = { width:2, height:1, colorProfile:null };
  for (const [type, version] of [['psd', 1], ['psb', 2]]) {
    const bytes = await resource.serializeEmbeddedAsset(
      embedded,
      { asset:{ detectedFileType:type } },
      'data:image/png;base64,AA==',
    );
    const header = inspectPsdHeader(bytes);
    assert.equal(header.signature, '8BPS');
    assert.equal(header.version, version);
    assert.equal(header.width, 2);
    assert.equal(header.height, 1);
  }

  const source = await readFile(new URL('../src/document/psd-smart-object-resource.js', import.meta.url), 'utf8');
  assert.match(source, /MAX_EMBEDDED_ASSET_BYTES = 40 \* 1024 \* 1024/);
  assert.match(source, /MAX_ICC_PROFILE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(source, /MAX_LINKED_LAYER_BLOCK_BYTES = 128 \* 1024 \* 1024/);
  assert.match(source, /MAX_EMBEDDED_EXPORT_PIXELS = 12_000_000/);
  assert.match(source, /MAX_EMBEDDED_EXPORT_LAYERS = 200/);
  assert.match(source, /maxPixels:MAX_EMBEDDED_EXPORT_PIXELS/);
  assert.match(source, /maxLayers:MAX_EMBEDDED_EXPORT_LAYERS/);
});

test('rewrite eligibility fails before publication for unsafe Photoshop sources', async () => {
  const resource = makeResource();
  const embedded = { width:32, height:32 };
  const preview = 'data:image/png;base64,AA==';

  assert.deepEqual(
    await resource.rewriteEmbeddedSource(
      { psdLinkedLayerBlocks:[] },
      { psdSmartObject:{ uniqueId:'id', asset:{ kind:'external', detectedFileType:'png' }, baseline:{} } },
      embedded,
      preview,
    ),
    { rewritten:false, reason:'источник не является embedded Photoshop data asset' },
  );

  assert.deepEqual(
    await resource.rewriteEmbeddedSource(
      { psdLinkedLayerBlocks:[] },
      { psdSmartObject:{ uniqueId:'id', asset:{ kind:'data', detectedFileType:'png' } } },
      embedded,
      preview,
    ),
    { rewritten:false, reason:'нет import baseline для безопасного rewrite' },
  );

  assert.deepEqual(
    await resource.rewriteEmbeddedSource(
      { psdLinkedLayerBlocks:[] },
      {
        psdSmartObject:{
          uniqueId:'id',
          asset:{ kind:'data', detectedFileType:'png' },
          baseline:{ embeddedWidth:16, embeddedHeight:32 },
        },
      },
      embedded,
      preview,
    ),
    { rewritten:false, reason:'размер embedded документа изменён; PlLd transform пока не пересчитывается' },
  );
});

test('successful liFD rewrite prepares new linked blocks without mutating the parent document', async () => {
  const fixture = new Uint8Array(await readFile(new URL('psd-tools-smartobject-layer.psd', fixtureRoot)));
  const decoded = await decodePsd(fixture, { maxPixels:100_000, maxLayers:20 });
  const decodedLayer = decoded.layers[0];
  const parentDoc = {
    psdLinkedLayerBlocks:decoded.linkedLayerBlocks.map(opaqueBlockToState).filter(Boolean),
  };
  const before = structuredClone(parentDoc.psdLinkedLayerBlocks);
  const embedded = { name:'Inside', width:32, height:32, layers:[], groups:[] };
  const layer = {
    psdSmartObject:{
      ...decodedLayer.psdSmartObject,
      baseline:{ embeddedWidth:32, embeddedHeight:32 },
    },
  };
  const resource = makeResource();
  const preview = 'data:image/png;base64,iVBORw0KGgoBAgMEBQYHCAkKCww=';
  const rewrite = await resource.rewriteEmbeddedSource(parentDoc, layer, embedded, preview);

  assert.equal(rewrite.rewritten, true);
  assert.equal(rewrite.oldSize, 378);
  assert.equal(rewrite.newSize, 20);
  assert.equal(rewrite.sourceKey, 'lnk2');
  assert.equal(rewrite.type, 'png');
  assert.deepEqual(parentDoc.psdLinkedLayerBlocks, before);
  assert.notDeepEqual(rewrite.linkedLayerBlocks, before);

  resource.publishEmbeddedSourceRewrite(parentDoc, rewrite);
  assert.deepEqual(parentDoc.psdLinkedLayerBlocks, rewrite.linkedLayerBlocks);
});

test('missing matching UUID returns fallback without mutating the parent', async () => {
  const fixture = new Uint8Array(await readFile(new URL('psd-tools-smartobject-layer.psd', fixtureRoot)));
  const decoded = await decodePsd(fixture, { maxPixels:100_000, maxLayers:20 });
  const parentDoc = {
    psdLinkedLayerBlocks:decoded.linkedLayerBlocks.map(opaqueBlockToState).filter(Boolean),
  };
  const before = structuredClone(parentDoc);
  const resource = makeResource();
  const result = await resource.rewriteEmbeddedSource(
    parentDoc,
    {
      psdSmartObject:{
        uniqueId:'missing-resource-uuid',
        asset:{ kind:'data', detectedFileType:'png' },
        baseline:{ embeddedWidth:32, embeddedHeight:32 },
      },
    },
    { width:32, height:32 },
    'data:image/png;base64,AA==',
  );
  assert.deepEqual(result, { rewritten:false, reason:'liFD resource с matching UUID не найден' });
  assert.deepEqual(parentDoc, before);
});

test('target metadata publication preserves Photoshop source identity and refreshes baselines', () => {
  const resource = makeResource();
  const target = {
    psdSmartObject:{
      uniqueId:'source-uuid',
      kind:'embedded',
      asset:{ kind:'data', filename:'A.png', sourceKey:'old', dataSize:378 },
      baseline:{ x:4, y:5, embeddedWidth:32, embeddedHeight:32, previewFingerprint:'old' },
    },
  };
  const embedded = {
    name:'Edited',
    width:32,
    height:32,
    createdAt:'a',
    updatedAt:'b',
    layers:[],
    groups:[],
  };
  resource.updateTargetAfterRewrite(target, {
    rewrite:{ rewritten:true, newSize:20, sourceKey:'lnk2' },
    previewDataUrl:'data:image/png;base64,AA==',
    embedded,
  });

  assert.equal(target.psdSmartObject.uniqueId, 'source-uuid');
  assert.equal(target.psdSmartObject.kind, 'embedded');
  assert.equal(target.psdSmartObject.asset.kind, 'data');
  assert.equal(target.psdSmartObject.asset.filename, 'A.png');
  assert.equal(target.psdSmartObject.asset.sourceKey, 'lnk2');
  assert.equal(target.psdSmartObject.asset.dataSize, 20);
  assert.equal(target.psdSmartObject.baseline.x, 4);
  assert.equal(target.psdSmartObject.baseline.y, 5);
  assert.equal(target.psdSmartObject.baseline.embeddedWidth, 32);
  assert.equal(target.psdSmartObject.baseline.embeddedHeight, 32);
  assert.match(target.psdSmartObject.baseline.previewFingerprint, /^value:/);
  assert.match(target.psdSmartObject.baseline.embeddedFingerprint, /^value:/);
});

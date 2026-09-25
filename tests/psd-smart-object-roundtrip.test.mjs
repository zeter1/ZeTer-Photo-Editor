import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createSmartObjectLayer, createDocument, sanitizeProject } from '../src/core/state.js';
import { bytesToDataUrl } from '../src/core/io.js';
import { decodePsd, encodePsd, encodePsb, inspectPsdHeader, rewriteEmbeddedLinkedLayerAsset } from '../src/formats/psd.js';

const root=new URL('./fixtures/photoshop-smart-objects/',import.meta.url);
async function bytes(name){return new Uint8Array(await readFile(new URL(name,root)));}
async function json(name){return JSON.parse(await readFile(new URL(name,root),'utf8'));}
function sha256(value){return createHash('sha256').update(value).digest('hex');}
function blockMap(blocks){return new Map((blocks||[]).map(block=>[block.key,block]));}

test('Stage 14a pins a real external Photoshop Smart Object PSD fixture',async()=>{
  const [manifest,fixture]=await Promise.all([json('manifest.json'),bytes('psd-tools-smartobject-layer.psd')]);
  assert.equal(manifest.fixture.size,fixture.byteLength);
  assert.equal(sha256(fixture),manifest.fixture.sha256);
  assert.match(manifest.fixture.sourceCommit,/^[0-9a-f]{40}$/);
  assert.equal(manifest.fixture.sourceGitBlob,'b37b63466ecee1586b5d917e0b40fbf236b0e65d');
  assert.deepEqual(inspectPsdHeader(fixture),{signature:'8BPS',version:1,channels:3,width:32,height:32,bitsPerChannel:8,colorMode:3});
  const placed=await bytes(manifest.placedLayerFixture.file);
  assert.equal(placed.byteLength,manifest.placedLayerFixture.size);
  assert.equal(sha256(placed),manifest.placedLayerFixture.sha256);
  assert.equal(manifest.placedLayerFixture.sourceGitBlob,'707df934bb10bbcbb699c46d4bcde5580e48c036');
});

test('Stage 14a decodes PlLd/SoLd and linked-layer resources from a real Photoshop Smart Object',async()=>{
  const fixture=await bytes('psd-tools-smartobject-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:100000,maxLayers:20});
  assert.equal(decoded.layers.length,1);
  const layer=decoded.layers[0];
  assert.equal(layer.name,'Smart object');
  assert.ok(layer.psdSmartObject);
  assert.equal(layer.psdSmartObject.kind,'embedded');
  assert.equal(layer.psdSmartObject.placedVersion,3);
  assert.equal(layer.psdSmartObject.uniqueId,'fe5608a6-d2b4-3344-8959-a42156defed2');
  assert.deepEqual(layer.psdSmartObject.placedTransform,[0,0,32,0,32,32,0,32]);
  assert.equal(layer.psdSmartObject.descriptor.smartVersion,4);
  assert.equal(layer.psdSmartObject.descriptor.uniqueId,layer.psdSmartObject.uniqueId);
  assert.equal(layer.psdSmartObject.descriptor.resolution,72);
  assert.ok(layer.psdSmartObject.descriptor.descriptorKeys.includes('Idnt'));
  assert.equal(layer.psdSmartObject.asset.kind,'data');
  assert.equal(layer.psdSmartObject.asset.filename,'A.png');
  assert.equal(layer.psdSmartObject.asset.detectedFileType,'png');
  assert.equal(layer.psdSmartObject.asset.data.byteLength,378);
  assert.deepEqual([...layer.psdSmartObject.asset.data.slice(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(decoded.linkedLayerEntries.length,1);
  assert.equal(decoded.linkedLayerEntries[0].uuid,layer.psdSmartObject.uniqueId);
  const smartBlocks=blockMap(layer.psdSmartObject.blocks);
  assert.equal(smartBlocks.get('PlLd').data.byteLength,484);
  assert.equal(smartBlocks.get('SoLd').data.byteLength,1268);
  const linked=blockMap(decoded.linkedLayerBlocks);
  assert.equal(linked.get('lnk2').data.byteLength,580);
  assert.equal(linked.get('lnkE').data.byteLength,0);
});

test('Stage 14a preserves opaque Smart Object and linked-resource bytes through PSD and PSB writer round-trip',async()=>{
  const fixture=await bytes('psd-tools-smartobject-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:100000,maxLayers:20});
  const layer=decoded.layers[0];
  const options={
    width:decoded.width,height:decoded.height,bitsPerChannel:8,colorMode:3,
    layers:[{
      name:layer.name,x:layer.x,y:layer.y,width:layer.width,height:layer.height,
      pixelBuffer:layer.pixelBuffer,opacity:layer.opacity,blendMode:layer.blendMode,visible:layer.visible,
      psdSmartObject:layer.psdSmartObject,
    }],
    composite:new Uint8ClampedArray(decoded.width*decoded.height*4),
    iccProfile:decoded.iccProfile?.bytes||null,
    linkedLayerBlocks:decoded.linkedLayerBlocks,
  };
  for(const [label,encoded] of [['PSD',encodePsd(options)],['PSB',encodePsb(options)]]){
    const roundTrip=await decodePsd(encoded,{maxPixels:100000,maxLayers:20});
    assert.equal(roundTrip.layers.length,1,label);
    const before=blockMap(layer.psdSmartObject.blocks),after=blockMap(roundTrip.layers[0].psdSmartObject.blocks);
    assert.deepEqual(after.get('PlLd').data,before.get('PlLd').data,label+' PlLd');
    assert.deepEqual(after.get('SoLd').data,before.get('SoLd').data,label+' SoLd');
    const linkedBefore=blockMap(decoded.linkedLayerBlocks),linkedAfter=blockMap(roundTrip.linkedLayerBlocks);
    assert.deepEqual(linkedAfter.get('lnk2').data,linkedBefore.get('lnk2').data,label+' lnk2');
    assert.deepEqual(linkedAfter.get('lnkE').data,linkedBefore.get('lnkE').data,label+' lnkE');
  }
});

test('Stage 14a project sanitizer persists only bounded allow-listed Photoshop Smart Object metadata',()=>{
  const plld=new Uint8Array([0x70,0x6c,0x63,0x4c,0,0,0,3]);
  const linked=new Uint8Array([1,2,3,4]);
  const doc=createDocument({name:'Smart Object round-trip',width:32,height:32});
  const smart=createSmartObjectLayer({
    name:'Photoshop Smart object',x:5,y:5,width:22,height:23,
    previewDataUrl:'data:image/png;base64,AA==',
    psdSmartObject:{
      kind:'embedded',uniqueId:'fixture-id',placedVersion:3,
      baseline:{x:5,y:5,width:22,height:23,scaleX:1,scaleY:1,rotation:0,previewFingerprint:'value:26:12345678'},
      blocks:[
        {signature:'8BIM',key:'PlLd',dataUrl:bytesToDataUrl(plld,'application/octet-stream')},
        {signature:'8BIM',key:'NOPE',dataUrl:bytesToDataUrl(plld,'application/octet-stream')},
      ],
    },
  });
  doc.layers=[smart];doc.selectedLayerId=smart.id;doc.psdSmartObjectSourceCount=1;
  doc.psdLinkedLayerBlocks=[
    {signature:'8BIM',key:'lnk2',dataUrl:bytesToDataUrl(linked,'application/octet-stream')},
    {signature:'8BIM',key:'BAD!',dataUrl:bytesToDataUrl(linked,'application/octet-stream')},
  ];
  const safe=sanitizeProject(doc);
  assert.equal(safe.psdSmartObjectSourceCount,1);
  assert.equal(safe.layers[0].psdSmartObject.blocks.length,1);
  assert.equal(safe.layers[0].psdSmartObject.blocks[0].key,'PlLd');
  assert.equal(safe.psdLinkedLayerBlocks.length,1);
  assert.equal(safe.psdLinkedLayerBlocks[0].key,'lnk2');
});

test('Stage 14b parses embedded and external linked-layer records without reading external filesystem paths',async()=>{
  const fixture=await bytes('psd-tools-placedLayer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:100});
  assert.deepEqual(decoded.warnings,[]);
  const byName=new Map(decoded.layers.map(layer=>[layer.name,layer]));
  const linkedPng=byName.get('linked-png').psdSmartObject;
  const linkedPsd=byName.get('linked-psd').psdSmartObject;
  const embedded=byName.get('embedded-png').psdSmartObject;
  assert.equal(linkedPng.kind,'linked');
  assert.equal(linkedPng.asset.kind,'external');
  assert.equal(linkedPng.asset.filename,'linked-layer.png');
  assert.equal(linkedPng.asset.detectedFileType,'png');
  assert.equal(linkedPng.asset.data,null);
  assert.equal(linkedPng.asset.fileSize,17272);
  assert.equal(linkedPsd.asset.kind,'external');
  assert.equal(linkedPsd.asset.filename,'1layer.psd');
  assert.equal(linkedPsd.asset.detectedFileType,'psd');
  assert.equal(linkedPsd.asset.data,null);
  assert.equal(linkedPsd.asset.fileSize,6476);
  assert.equal(embedded.asset.kind,'data');
  assert.equal(embedded.asset.filename,'linked-layer.png');
  assert.equal(embedded.asset.detectedFileType,'png');
  assert.equal(embedded.asset.data.byteLength,17272);
  assert.ok(decoded.linkedLayerEntries.some(item=>item.sourceKey==='lnkE'&&item.kind==='external'));
});

test('Stage 14c rewrites a matching embedded liFD payload while preserving Smart Object UUID and other linked records',async()=>{
  const fixture=await bytes('psd-tools-smartobject-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:100000,maxLayers:20});
  const layer=decoded.layers[0];
  const replacement=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4,5,6,7,8,9,10,11,12]);
  const beforeBlocks=decoded.linkedLayerBlocks.map(block=>({signature:block.signature,key:block.key,data:block.data.slice()}));
  const rewritten=rewriteEmbeddedLinkedLayerAsset(decoded.linkedLayerBlocks,layer.psdSmartObject.uniqueId,replacement);
  assert.equal(rewritten.rewritten,1);
  assert.equal(rewritten.oldSize,378);
  assert.equal(rewritten.newSize,replacement.byteLength);
  assert.equal(rewritten.sourceKey,'lnk2');
  assert.deepEqual(decoded.linkedLayerBlocks,beforeBlocks,'rewrite must not mutate the caller-owned linked blocks');
  const options={
    width:decoded.width,height:decoded.height,bitsPerChannel:8,colorMode:3,
    layers:[{
      name:layer.name,x:layer.x,y:layer.y,width:layer.width,height:layer.height,
      pixelBuffer:layer.pixelBuffer,opacity:layer.opacity,blendMode:layer.blendMode,visible:layer.visible,
      psdSmartObject:layer.psdSmartObject,
    }],
    composite:new Uint8ClampedArray(decoded.width*decoded.height*4),
    iccProfile:decoded.iccProfile?.bytes||null,
    linkedLayerBlocks:rewritten.blocks,
  };
  const roundTrip=await decodePsd(encodePsd(options),{maxPixels:100000,maxLayers:20});
  assert.equal(roundTrip.layers[0].psdSmartObject.uniqueId,layer.psdSmartObject.uniqueId);
  assert.equal(roundTrip.layers[0].psdSmartObject.asset.dataSize,replacement.byteLength);
  assert.deepEqual(roundTrip.layers[0].psdSmartObject.asset.data,replacement);
  assert.equal(roundTrip.layers[0].psdSmartObject.asset.detectedFileType,'png');
  assert.equal(roundTrip.linkedLayerBlocks.some(block=>block.key==='lnkE'),true);
});


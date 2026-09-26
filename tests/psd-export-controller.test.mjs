import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';

function semantics() {
  return {
    psdSmartObjectRoundTripPlan: () => ({ eligible:false, imported:[], expected:0, reason:'none', linkedLayerBlocks:[] }),
    psdAdjustmentNativePlan: () => ({ eligible:false, reason:'none', metadata:null }),
    psdTextNativePlan: () => ({ eligible:false, reason:'none', block:null }),
    psdShapeNativePlan: () => ({ eligible:false, reason:'none', metadata:null, vectorMask:null }),
    exportPsdVectorMask: () => null,
    psdSmartObjectMetadataForExport: () => null,
  };
}
function nativeOnlyRendering() {
  const unexpected=name=>()=>{ throw new Error(`unexpected Canvas fallback: ${name}`); };
  return { createCanvas:unexpected('createCanvas'), renderLayer:unexpected('renderLayer'), renderDocument:unexpected('renderDocument') };
}

test('native 16-bit RGB preparation preserves typed precision and group lineage without Canvas fallback', async () => {
  const source=createPixelBuffer({
    width:2,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([65535,0,0,65535, 0,32768,65535,65535]),
  });
  const documentValue={
    width:2,height:1,background:'transparent',colorManagement:{},colorProfile:null,paths:[],
    groups:[{id:'g1',parentGroupId:null,name:'Native group',visible:true,collapsed:false,opacity:1,blendMode:'pass-through'}],
    layers:[{
      id:'l1',groupId:'g1',type:'raster',name:'Native 16-bit',visible:true,
      x:0,y:0,width:2,height:1,scaleX:1,scaleY:1,rotation:0,opacity:1,blendMode:'source-over',
      filters:{},styles:null,mask:null,vectorMask:null,highDepthSource:serializePixelBufferSource(source),
    }],
  };
  const prepared=await createPsdExportController({semantics:semantics(),rendering:nativeOnlyRendering()}).prepareDocument(documentValue);
  assert.equal(prepared.colorMode,'rgb');
  assert.equal(prepared.bitsPerChannel,16);
  assert.equal(prepared.layers.length,1);
  assert.equal(prepared.layers[0].pixelBuffer.model,'rgb');
  assert.equal(prepared.layers[0].pixelBuffer.bitsPerChannel,16);
  assert.equal(prepared.layers[0].groupKey,'g1');
  assert.deepEqual(prepared.groups,[{key:'g1',parentKey:null,name:'Native group',visible:true,collapsed:false,opacity:1,blendMode:'pass-through'}]);
  assert.ok(prepared.compositePixelBuffer);
  assert.equal(prepared.composite,null);
});

test('preparation rejects the bounded 48 MP temporary-buffer budget before rendering', async () => {
  const controller=createPsdExportController({semantics:semantics(),rendering:nativeOnlyRendering()});
  await assert.rejects(
    controller.prepareDocument({width:7000,height:7000,background:'transparent',colorManagement:{},colorProfile:null,paths:[],groups:[],layers:[]}),
    /48 МП временных RGBA-буферов/,
  );
});

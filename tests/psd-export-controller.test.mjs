import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';

function vectors() {
  return { exportPsdVectorMask: () => null };
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
  const prepared=await createPsdExportController({vectors:vectors(),rendering:nativeOnlyRendering()}).prepareDocument(documentValue);
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
  const controller=createPsdExportController({vectors:vectors(),rendering:nativeOnlyRendering()});
  await assert.rejects(
    controller.prepareDocument({width:7000,height:7000,background:'transparent',colorManagement:{},colorProfile:null,paths:[],groups:[],layers:[]}),
    /48 МП временных RGBA-буферов/,
  );
});

test('PSD export controller keeps newly created Levels and Curves editable instead of baking them into composite',async()=>{
  const {encodePsd,encodePsb,decodePsd}=await import('../src/formats/psd.js');
  let mergedRenders=0;
  const rendering={
    createCanvas:()=>({width:0,height:0,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(16)})})}),
    renderLayer:()=>{throw new Error('new native adjustment must not be rasterized');},
    renderDocument:async()=>{mergedRenders+=1;},
  };
  const documentValue={
    width:2,height:2,background:'transparent',colorManagement:{},colorProfile:null,paths:[],groups:[],
    layers:[
      {id:'levels',type:'adjustment',name:'Editable Levels',visible:true,opacity:1,blendMode:'source-over',groupId:null,clipping:false,filters:{},styles:null,
        adjustment:{kind:'levels',master:{inputBlack:8,inputWhite:235,outputBlack:3,outputWhite:240,gamma:1.32},channels:[]}},
      {id:'curves',type:'adjustment',name:'Editable Curves',visible:true,opacity:1,blendMode:'source-over',groupId:null,clipping:true,filters:{},styles:null,
        adjustment:{kind:'curves',channels:[{id:0,points:[{input:0,output:0},{input:140,output:155},{input:255,output:255}]}]}},
    ],
  };
  const prepared=await createPsdExportController({vectors:vectors(),rendering}).prepareDocument(documentValue);
  assert.equal(mergedRenders,1,'one display composite can coexist with native editable layers');
  assert.equal(prepared.layers.length,2,'must not add flattened Composite Preview layer');
  assert.ok(prepared.layers.every(layer=>layer.width===0&&layer.height===0&&layer.psdAdjustment));
  assert.equal(prepared.layers[0].clipping,true);
  assert.equal(prepared.layers[1].clipping,false);
  assert.ok(!prepared.warnings.some(message=>message.includes('composite fallback')));
  for(const [format,encode] of [['PSD',encodePsd],['PSB',encodePsb]]){
    const binary=encode({width:2,height:2,bitsPerChannel:prepared.bitsPerChannel,colorMode:3,layers:prepared.layers,composite:prepared.composite});
    const decoded=await decodePsd(binary,{maxPixels:100,maxLayers:20});
    assert.equal(decoded.adjustmentLayers.length,2,format+' preserves both native adjustments');
    assert.deepEqual(decoded.adjustmentLayers.map(layer=>layer.psdAdjustment.kind).sort(),['curves','levels']);
    assert.equal(decoded.adjustmentLayers.find(layer=>layer.psdAdjustment.kind==='curves').clipping,true);
  }
});

test('adjustment raster mask renders in document coordinates, not the canonical 1x1 layer space', async () => {
  const maskRenders=[];
  const transforms=[];
  const rendering={
    createCanvas:()=>{
      const canvas={width:0,height:0};
      canvas.getContext=()=>({
        setTransform:(...values)=>transforms.push(values),
        drawImage:()=>{},
        getImageData:()=>({data:new Uint8ClampedArray(canvas.width*canvas.height*4)}),
      });
      return canvas;
    },
    renderLayer:async(_ctx,layer)=>{
      maskRenders.push({width:layer.width,height:layer.height,x:layer.x,y:layer.y});
    },
    renderDocument:async canvas=>{canvas.width=4;canvas.height=4;},
  };
  const levels={
    id:'adj',type:'adjustment',name:'Masked Levels',visible:true,locked:false,
    x:10,y:20,width:1,height:1,scaleX:2,scaleY:2,rotation:0,
    opacity:1,blendMode:'source-over',groupId:null,clipping:false,
    adjustment:{kind:'levels',master:{inputBlack:0,inputWhite:255,gamma:2,outputBlack:0,outputWhite:255},channels:[]},
    mask:{
      enabled:true,dataUrl:'data:image/png;base64,AA==',
      density:1,feather:0,invert:false,
      transform:{a:1,b:0,c:0,d:1,e:1,f:2},
    },
  };
  const source={
    width:4,height:4,background:'transparent',colorManagement:{},colorProfile:null,
    paths:[],groups:[],layers:[levels],
  };
  const prepared=await createPsdExportController({vectors:vectors(),rendering}).prepareDocument(source);
  assert.equal(prepared.layers.length,1);
  assert.equal(prepared.layers[0].width,0,'native Levels must remain zero-bounds');
  assert.equal(prepared.layers[0].mask.width,4,'exported adjustment mask spans the document');
  assert.equal(prepared.layers[0].mask.height,4);
  assert.deepEqual(maskRenders,[{width:4,height:4,x:0,y:0}],
    'source mask rendering must not use adjustment canonical layer 1x1 geometry');
  assert.deepEqual(transforms[0],[1,0,0,1,1,2],
    'document-space raster mask transform must not inherit adjustment layer transform');
});
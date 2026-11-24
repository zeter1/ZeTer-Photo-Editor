import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, compositePixelBufferLayers, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
import { encodePsd, encodePsb, decodePsd } from '../src/formats/psd.js';

const buffer = values => createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(values)});
const bottom = () => buffer([15000,30000,45000,65535]);
const top = () => buffer([60000,10000,10000,65535]);
const layer = (id, source, blendMode) => ({id,name:id,type:'raster',visible:true,groupId:null,clipping:false,x:0,y:0,width:1,height:1,scaleX:1,scaleY:1,rotation:0,opacity:1,blendMode,filters:{},styles:null,mask:null,vectorMask:null,highDepthSource:serializePixelBufferSource(source)});
const doc = () => ({width:1,height:1,background:'transparent',groups:[],paths:[],layers:[layer('bottom',bottom(),'source-over'),layer('top',top(),'luminosity')]});
const controller = () => createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{createCanvas(){throw new Error('unexpected Canvas fallback');},renderLayer(){throw new Error('unexpected rasterization');},renderDocument(){throw new Error('unexpected display composite');}}});

test('native RGB16 Luminosity transfers source luminance at backdrop hue and saturation without rounding to 8-bit',()=>{
  const out=compositePixelBufferLayers(1,1,[{buffer:bottom()},{buffer:top(),blendMode:'luminosity'}],{bitsPerChannel:16});
  assert.deepEqual([...out.data],[12850,27850,42850,65535]);
  assert.ok(out.data instanceof Uint16Array);
  const masked=compositePixelBufferLayers(1,1,[{buffer:bottom()},{buffer:top(),blendMode:'luminosity',opacity:.5,maskPixels:Uint8ClampedArray.of(255,255,255,128)}],{bitsPerChannel:16});
  assert.deepEqual([...masked.data],[14460,29460,44460,65535]);
});

test('native RGB16 Luminosity has independent exact-word gamut and alpha oracles',()=>{
  const cases=[
    [[10000,20000,20000,65535],[1000,1000,1000,65535],[0,1429,1429,65535]],
    [[60000,50000,50000,65535],[65000,65000,65000,65535],[65535,64771,64771,65535]],
    [[32768,32768,32768,65535],[60000,10000,10000,65535],[25000,25000,25000,65535]],
    [[15000,30000,45000,65535],[0,0,0,65535],[0,0,0,65535]],
    [[15000,30000,45000,65535],[65535,65535,65535,65535],[65535,65535,65535,65535]],
    [[15000,30000,45000,16384],[60000,10000,10000,32768],[41570,17570,23570,40960]],
    [[15000,30000,45000,65535],[65535,0,0,0],[15000,30000,45000,65535]],
    [[0,0,0,0],[60000,10000,10000,32768],[60000,10000,10000,32768]],
  ];
  for(const [base,source,expected] of cases){
    const b=buffer(base), t=buffer(source);
    const out=compositePixelBufferLayers(1,1,[{buffer:b},{buffer:t,blendMode:'luminosity'}],{bitsPerChannel:16});
    assert.deepEqual([...out.data],expected,JSON.stringify([base,source]));
    assert.deepEqual([...b.data],base);assert.deepEqual([...t.data],source);
  }
});

test('RGB16 flat Luminosity preserves native layer words, composite and editable blend key in PSD and PSB',async()=>{
  const value=doc(), before=JSON.stringify(value);
  const prepared=await controller().prepareDocument(value);
  assert.equal(prepared.bitsPerChannel,16);
  assert.equal(prepared.composite,null);
  assert.deepEqual([...prepared.compositePixelBuffer.data],[12850,27850,42850,65535]);
  assert.equal(prepared.layers.length,2);
  for(const encode of [encodePsd,encodePsb]){
    const binary=encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:prepared.layers,compositePixelBuffer:prepared.compositePixelBuffer});
    const parsed=await decodePsd(binary,{maxPixels:16,maxLayers:8});
    assert.equal(parsed.bitsPerChannel,16);
    const bytes=new Uint8Array(binary);
    const merged=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
    assert.deepEqual([0,2,4,6,8].map(i=>merged.getUint16(i,false)),[0,12850,27850,42850,65535]);
    const edited=parsed.layers.find(l=>l.name==='top');
    assert.equal(edited.blendMode,'luminosity');
    assert.deepEqual([...edited.pixelBuffer.data.slice(0,3)],[60000,10000,10000]);
  }
  assert.equal(JSON.stringify(value),before);
});

test('unsupported RGB16 Luminosity topology fails closed before Canvas or mutation',async()=>{
  for(const mutate of [v=>{v.groups=[{id:'g',blendMode:'pass-through'}];v.layers[1].groupId='g';},v=>{v.groups=[{id:'g',blendMode:'luminosity'}];v.layers[1].groupId='g';v.layers[1].blendMode='source-over';},v=>{v.layers[1].clipping=true;},v=>{v.layers[0].rotation=5;},v=>{v.layers[0].vectorMask={enabled:true,subpaths:[{}]};},v=>{delete v.layers[0].highDepthSource;},v=>{v.colorProfile={kind:'icc'};}]){
    const value=doc();mutate(value);const before=JSON.stringify(value);
    await assert.rejects(controller().prepareDocument(value),/native high-depth/);
    assert.equal(JSON.stringify(value),before);
  }
});

test('RGB16 Luminosity, Saturation, Hue and Color coexist in one flat native document',async()=>{
  const value=doc();
  value.layers.splice(1,0,layer('color',buffer([15000,30000,45000,65535]),'color'),layer('hue',buffer([15000,30000,45000,65535]),'hue'),layer('sat',buffer([15000,30000,45000,65535]),'saturation'));
  const prepared=await controller().prepareDocument(value);
  assert.deepEqual([...prepared.compositePixelBuffer.data],[12850,27850,42850,65535]);
  assert.equal(prepared.layers.length,5);
});

test('RGB16 Luminosity rejects non-sRGB sources and non-RGB16 destinations',()=>{
  const linear=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'linear-rgb-unmanaged'});
  assert.throws(()=>compositePixelBufferLayers(1,1,[{buffer:linear,blendMode:'luminosity'}],{bitsPerChannel:16}),/Luminosity/);
  assert.throws(()=>compositePixelBufferLayers(1,1,[{buffer:top(),blendMode:'luminosity'}],{bitsPerChannel:32}),/Luminosity/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, compositePixelBufferLayers, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
import { encodePsd, encodePsb, decodePsd } from '../src/formats/psd.js';

const buffer = values => createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(values)});
const bottom = () => buffer([32768,32768,32768,65535]);
const top = () => buffer([10000,20000,30000,65535]);
const layer = (id, source, blendMode) => ({id,name:id,type:'raster',visible:true,groupId:null,clipping:false,x:0,y:0,width:1,height:1,scaleX:1,scaleY:1,rotation:0,opacity:1,blendMode,filters:{},styles:null,mask:null,vectorMask:null,highDepthSource:serializePixelBufferSource(source)});
const doc = () => ({width:1,height:1,background:'transparent',groups:[],paths:[],layers:[layer('bottom',bottom(),'source-over'),layer('top',top(),'color')]});
const controller = () => createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{createCanvas(){throw new Error('unexpected Canvas fallback');},renderLayer(){throw new Error('unexpected rasterization');},renderDocument(){throw new Error('unexpected display composite');}}});

test('native RGB16 Color transfers source chroma without rounding to 8-bit',()=>{
  const out=compositePixelBufferLayers(1,1,[{buffer:bottom()},{buffer:top(),blendMode:'color'}],{bitsPerChannel:16});
  assert.deepEqual([...out.data],[24668,34668,44668,65535]);
  assert.ok(out.data instanceof Uint16Array);
  const masked=compositePixelBufferLayers(1,1,[{buffer:bottom()},{buffer:top(),blendMode:'color',opacity:.5,maskPixels:Uint8ClampedArray.of(255,255,255,128)}],{bitsPerChannel:16});
  assert.deepEqual([...masked.data],[30735,33245,35755,65535]);
});

test('native RGB16 Color clips extreme chroma and preserves transparent source and backdrop',()=>{
  const black=buffer([0,0,0,65535]), white=buffer([65535,65535,65535,65535]), red=buffer([65535,0,0,65535]);
  for(const base of [black,white]) assert.deepEqual([...compositePixelBufferLayers(1,1,[{buffer:base},{buffer:red,blendMode:'color'}],{bitsPerChannel:16}).data],[...base.data]);
  assert.deepEqual([...compositePixelBufferLayers(1,1,[{buffer:top(),blendMode:'color'}],{bitsPerChannel:16}).data],[...top().data]);
  assert.deepEqual([...compositePixelBufferLayers(1,1,[{buffer:bottom()},{buffer:buffer([65535,0,0,0]),blendMode:'color'}],{bitsPerChannel:16}).data],[...bottom().data]);
});

test('RGB16 flat Color preserves native layer words, composite and editable blend key in PSD and PSB',async()=>{
  const value=doc(), before=JSON.stringify(value);
  const prepared=await controller().prepareDocument(value);
  assert.equal(prepared.bitsPerChannel,16);
  assert.equal(prepared.composite,null);
  assert.deepEqual([...prepared.compositePixelBuffer.data],[24668,34668,44668,65535]);
  assert.equal(prepared.layers.length,2);
  for(const encode of [encodePsd,encodePsb]){
    const binary=encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:prepared.layers,compositePixelBuffer:prepared.compositePixelBuffer});
    const parsed=await decodePsd(binary,{maxPixels:16,maxLayers:8});
    assert.equal(parsed.bitsPerChannel,16);
    const bytes=new Uint8Array(binary);
    const merged=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
    assert.deepEqual([0,2,4,6,8].map(i=>merged.getUint16(i,false)),[0,24668,34668,44668,65535]);
    const edited=parsed.layers.find(l=>l.name==='top');
    assert.equal(edited.blendMode,'color');
    assert.deepEqual([...edited.pixelBuffer.data.slice(0,3)],[10000,20000,30000]);
  }
  assert.equal(JSON.stringify(value),before);
});

test('unsupported RGB16 Color topology fails closed before Canvas or mutation',async()=>{
  for(const mutate of [v=>{v.groups=[{id:'g',blendMode:'pass-through'}];v.layers[1].groupId='g';},v=>{v.layers[1].clipping=true;},v=>{v.layers[0].rotation=5;},v=>{v.layers[0].vectorMask={enabled:true,subpaths:[{}]};},v=>{delete v.layers[0].highDepthSource;},v=>{v.layers[0].scaleX=2;}]){
    const value=doc();mutate(value);const before=JSON.stringify(value);
    await assert.rejects(controller().prepareDocument(value),/native high-depth/);
    assert.equal(JSON.stringify(value),before);
  }
});

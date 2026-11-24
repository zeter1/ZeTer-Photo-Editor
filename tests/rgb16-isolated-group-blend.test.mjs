import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
import { encodePsd, encodePsb, decodePsd } from '../src/formats/psd.js';

const layer=(id,values,groupId=null,blendMode='source-over')=>({
  id,name:id,type:'raster',visible:true,groupId,clipping:false,x:0,y:0,width:1,height:1,scaleX:1,scaleY:1,rotation:0,opacity:1,blendMode,filters:{},styles:null,
  highDepthSource:serializePixelBufferSource(createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(values)}))
});
const make=()=>({width:1,height:1,background:'transparent',paths:[],
  groups:[{id:'g',name:'g',blendMode:'source-over',visible:true,opacity:.5}],
  layers:[layer('outer',[20000,20000,20000,65535]),layer('inner',[15000,30000,45000,65535],'g'),layer('light',[60000,10000,10000,65535],'g','luminosity')]
});
const controller=()=>createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{createCanvas(){throw Error('unexpected Canvas fallback');},renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}}});
test('isolated normal RGB16 group blends internally, then applies group opacity once',async()=>{
  const doc=make(), before=JSON.stringify(doc);
  const out=await controller().prepareDocument(doc);
  // Internal luminosity [12850,27850,42850]; 50% source-over onto [20000,20000,20000].
  assert.deepEqual([...out.compositePixelBuffer.data],[16425,23925,31425,65535]);
  assert.equal(out.composite,null);assert.equal(out.bitsPerChannel,16);
  assert.equal(out.groups.length,1);assert.equal(out.groups[0].opacity,.5);
  for(const encode of [encodePsd,encodePsb]){
    const data=encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:out.layers,groups:out.groups,compositePixelBuffer:out.compositePixelBuffer});
    const bytes=new Uint8Array(data), raw=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
    assert.deepEqual([0,2,4,6,8].map(i=>raw.getUint16(i,false)),[0,16425,23925,31425,65535]);
    const parsed=await decodePsd(data,{maxPixels:16,maxLayers:16});
    assert.equal(parsed.bitsPerChannel,16);
    const edited=parsed.layers.find(l=>l.name==='light');
    assert.equal(edited.blendMode,'luminosity');assert.deepEqual([...edited.pixelBuffer.data.slice(0,3)],[60000,10000,10000]);
  }
  assert.equal(JSON.stringify(doc),before);
});
test('isolated group opacity zero and hidden group exclude children',async()=>{
  for(const change of [d=>d.groups[0].opacity=0,d=>d.groups[0].visible=false]){
    const doc=make();change(doc);const out=await controller().prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],[20000,20000,20000,65535]);
  }
});
test('unsupported RGB16 group topology fails closed',async()=>{
  for(const change of [d=>d.groups[0].blendMode='pass-through',d=>d.groups[0].blendMode='luminosity',d=>d.groups[0].parentGroupId='g',d=>d.layers.push(layer('other',[1,2,3,65535],'unknown')),d=>d.layers.splice(2,0,layer('interleaved',[1,2,3,65535])),d=>d.layers[1].clipping=true]){
    const doc=make();change(doc);const before=JSON.stringify(doc);
    await assert.rejects(controller().prepareDocument(doc),/native high-depth/);
    assert.equal(JSON.stringify(doc),before);
  }
});

test('isolated RGB16 group applies the prepared raster mask once and preserves its metadata',async()=>{
  // Mask renderer is a white single-pixel canvas; invert makes its alpha zero.
  const maskController=createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{
    createCanvas(){return {getContext(){return {fillRect(){},getImageData(){return {data:Uint8ClampedArray.of(255,255,255,255)};}};}};},
    renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}
  }});
  for(const [enabled,density,expected,maskAlpha] of [[true,1,[20000,20000,20000,65535],0],[false,1,[16425,23925,31425,65535],0],[true,.5,[18205,21970,25735,65535],128]]){
    const doc=make();doc.groups[0].mask={enabled,invert:true,density};
    const before=JSON.stringify(doc);
    const out=await maskController.prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],expected);
    assert.equal(out.groups[0].mask.disabled,!enabled);
    assert.equal(out.groups[0].mask.pixels[3],maskAlpha);
    assert.equal(JSON.stringify(doc),before);
  }
});
test('isolated RGB16 group remains behind the following root raster',async()=>{
  const doc=make();doc.layers.push(layer('above',[12345,23456,34567,65535]));
  const out=await controller().prepareDocument(doc);
  assert.deepEqual([...out.compositePixelBuffer.data],[12345,23456,34567,65535]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, deserializePixelBufferSource, forEachSerializedPixelBufferTile,
  PIXEL_BUFFER_SOURCE_KIND, PIXEL_BUFFER_TILED_SOURCE_KIND, sanitizeSerializedPixelBufferSource,
  serializePixelBufferSourceAdaptive, serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

function rgb16(width,height){
  const data=new Uint16Array(width*height*3);
  for(let i=0;i<data.length;i+=1)data[i]=(i*997+31)&0xffff;
  return createPixelBuffer({width,height,model:'rgb',channels:3,bitsPerChannel:16,colorSpace:'srgb',data});
}

test('Stage 17a tiled source round-trips odd RGB16 tile edges exactly',()=>{
  const source=rgb16(5,3),packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  assert.equal(packed.kind,PIXEL_BUFFER_TILED_SOURCE_KIND);
  assert.equal(packed.tileSize,2);
  assert.equal(packed.tiles.length,6);
  assert.equal('dataUrl' in packed,false);
  assert.deepEqual(packed.tiles.map(t=>[t.x,t.y,t.width,t.height]),[[0,0,2,2],[2,0,2,2],[4,0,1,2],[0,2,2,1],[2,2,2,1],[4,2,1,1]]);
  assert.deepEqual([...deserializePixelBufferSource(packed).data],[...source.data]);
});

test('Stage 17a visitor decodes one bounded tile at a time and can reconstruct the plane',()=>{
  const source=rgb16(5,3),packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const reconstructed=new Uint16Array(source.data.length);
  const count=forEachSerializedPixelBufferTile(packed,({x,y,width,height,buffer})=>{
    assert.ok(width<=2&&height<=2);
    for(let row=0;row<height;row+=1){
      const src=row*width*source.channels,dst=((y+row)*source.width+x)*source.channels;
      reconstructed.set(buffer.data.subarray(src,src+width*source.channels),dst);
    }
  });
  assert.equal(count,6);
  assert.deepEqual([...reconstructed],[...source.data]);
});

test('Stage 17a adaptive serializer keeps small sources v1 and promotes large sources to v2',()=>{
  const source=rgb16(4,4);
  assert.equal(serializePixelBufferSourceAdaptive(source,{tiledThresholdBytes:1_000_000}).kind,PIXEL_BUFFER_SOURCE_KIND);
  assert.equal(serializePixelBufferSourceAdaptive(source,{tiledThresholdBytes:1,tileSize:2}).kind,PIXEL_BUFFER_TILED_SOURCE_KIND);
});

test('Stage 17a sanitizer rejects reordered resized and byte-budget-tampered grids',()=>{
  const packed=serializeTiledPixelBufferSource(rgb16(5,3),{tileSize:2});
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,tiles:[packed.tiles[1],packed.tiles[0],...packed.tiles.slice(2)]}),null);
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,tiles:packed.tiles.map((t,i)=>i?t:{...t,width:t.width+1})}),null);
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,rawBytes:packed.rawBytes+2}),null);
});

test('Stage 17a tiled Float32 CMYK round-trip preserves values and metadata',()=>{
  const source=createPixelBuffer({width:2,height:2,model:'cmyk',channels:4,bitsPerChannel:32,colorSpace:'device-cmyk',profileName:'Fixture CMYK',
    data:new Float32Array([.1,.2,.3,.4,.5,.6,.7,.8,1.2,.9,.05,.33,.01,.02,.03,.04])});
  const restored=deserializePixelBufferSource(serializeTiledPixelBufferSource(source,{tileSize:1}));
  assert.deepEqual([...restored.data],[...source.data]);
  assert.equal(restored.model,'cmyk');
  assert.equal(restored.profileName,'Fixture CMYK');
});

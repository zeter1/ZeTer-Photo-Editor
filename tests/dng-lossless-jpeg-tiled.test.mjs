import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {tiledLosslessJpegDngFixture} from './fixtures/dng-lossless-jpeg-fixture.mjs';

const rendered = bytes => [...decodeDng(bytes).rgba];
function ifdEntry(buffer,tag,le=true){
  const v=new DataView(buffer);
  for(let i=0;i<v.getUint16(8,le);i++){
    const p=10+i*12;
    if(v.getUint16(p,le)===tag)return p;
  }
  throw Error('missing IFD tag '+tag);
}
const mutate=(base,edit)=>{const result=base.slice(0);edit(new DataView(result));return result;};

test('TIFF lossless-JPEG tile mapping stitches original sensor phase across tiles, including edges',()=>{
  for(const le of [true,false])for(const components of [1,2,4])
    for(const bits of [8,12,16]){
      const width=9,height=7, tileWidth=4,tileLength=3;
      const sample=(x,y,c)=>(bits===8?30:500)+x*9+y*5+c*13;
      const props={le,width,height,samples:sample,orientation:6,
        defaultCropOrigin:[1.5,0],defaultCropSize:[6,6],whiteLevel:2**bits-1};
      const raw=tiledLosslessJpegDngFixture({...props,bits,tileWidth,tileLength,
        components,restartInterval:3});
      const original=new Uint8Array(raw).slice();
      const source=inspectDng(raw);
      assert.equal(source.compression,7);
      assert.deepEqual([...source.compressedSamples],
        Array.from({length:width*height},(_,i)=>sample(i%width,Math.floor(i/width),
          [0,1,1,2][((Math.floor(i/width)&1)*2)+(i%width&1)])));
      const baseline=fixture({...props,bits:bits===8?8:16});
      assert.deepEqual(rendered(raw),rendered(baseline),
        'tile mapping '+(le?'II':'MM')+' '+components+' components '+bits+' bit');
      assert.deepEqual(new Uint8Array(raw),original,'source DNG is immutable');
    }
});

test('single TIFF JPEG tile uses inline TileOffsets/TileByteCounts',()=>{
  const values=(x,y,c)=>700+x*10+y*4+c*18;
  const raw=tiledLosslessJpegDngFixture({width:4,height:4,tileWidth:4,tileLength:4,
    samples:values,components:4,whiteLevel:4095});
  assert.deepEqual(rendered(raw),rendered(fixture({width:4,height:4,bits:16,
    samples:values,whiteLevel:4095})));
});

test('malformed or incomplete TIFF TileWidth/Length/Offsets/ByteCounts fail closed',()=>{
  const valid=tiledLosslessJpegDngFixture({bits:16,width:8,height:6,tileWidth:4,tileLength:3});
  const change=(tag,fn)=>mutate(valid,v=>fn(v,ifdEntry(valid,tag)));
  assert.throws(()=>inspectDng(change(322,(v,p)=>v.setUint32(p+8,0,true))),/Tile|tile/i);
  assert.throws(()=>inspectDng(change(323,(v,p)=>v.setUint32(p+8,0,true))),/Tile|tile/i);
  assert.throws(()=>inspectDng(change(324,(v,p)=>v.setUint32(p+4,3,true))),/Tile|tile/i);
  assert.throws(()=>inspectDng(change(325,(v,p)=>v.setUint16(p,123,true))),/Tile|tile/i);
  assert.throws(()=>inspectDng(change(325,(v,p)=>v.setUint16(p+2,65535,true))),/Tile|tile/i);
  assert.throws(()=>inspectDng(change(325,(v,p)=>v.setUint32(p+4,16000001,true))),/Tile|tile/i);
  assert.throws(()=>inspectDng(change(259,(v,p)=>v.setUint16(p+8,1,true))),/Tile|tile/i);
});

test('invalid tile offset / truncated payload never degrades to silent strip import',()=>{
  const valid=tiledLosslessJpegDngFixture({width:8,height:6,tileWidth:4,tileLength:3});
  const le=true;
  const p=ifdEntry(valid,324),table=new DataView(valid).getUint32(p+8,le);
  assert.throws(()=>inspectDng(mutate(valid,v=>v.setUint32(table,0,le))),/Tile|SOI|tile/i);
  assert.throws(()=>inspectDng(valid.slice(0,-1)),/Tile|TIFF|усечён|JPEG|EOI/i);
});

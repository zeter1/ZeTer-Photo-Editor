import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng, inspectDng, developDng} from '../src/formats/dng.js';

import {fixture} from './fixtures/dng-fixture.mjs';

test('uncompressed 8-bit RGGB DNG demosaics to visible RGBA with alpha',()=>{
  const b=fixture();
  const source=inspectDng(b);
  assert.deepEqual([source.width,source.height,source.bits,source.pattern.join(',')],[4,4,8,'0,1,1,2']);
  const developed=developDng(source);
  assert.equal(developed.rgba.length,64);
  assert.equal(developed.rgba[3],255);
  assert.ok(developed.rgba[0]>developed.rgba[1] && developed.rgba[1]>developed.rgba[2]);
  assert.ok(developed.rgba[0]>0);
});
test('16-bit big-endian CFA and distinct WB/exposure produce new pixels without changing source',()=>{
  const bytes=fixture({le:false,bits:16,pattern:[2,1,1,0]});
  const original=bytes.slice(0);
  const decoded=decodeDng(bytes);
  const warmer=decodeDng(bytes,{exposure:1,wbRed:1.5,wbBlue:0.5});
  assert.deepEqual(new Uint8Array(bytes),new Uint8Array(original));
  assert.ok(warmer.rgba[0]>decoded.rgba[0]);
  assert.ok(warmer.rgba[2]<decoded.rgba[2]*2);
  assert.equal(warmer.rgba[3],255);
});
test('rejects compressed, truncated, TIFF without DNG version and unsupported CFA',()=>{
  assert.throws(()=>inspectDng(fixture({compression:7})),/сжатые DNG/);
  assert.throws(()=>inspectDng(fixture({truncated:true})),/усечённая|некорректная/);
  const notDng=fixture();
  new DataView(notDng).setUint16(10+12*12,50705,true);
  assert.throws(()=>inspectDng(notDng),/не DNG/);
  assert.throws(()=>inspectDng(fixture({pattern:[0,0,1,2]})),/2×2 Bayer/);
});
test('rejects invalid exposure/white balance without editing RAW',()=>{
  const source=inspectDng(fixture());
  assert.throws(()=>developDng(source,{exposure:99}),/параметры/);
  assert.throws(()=>developDng(source,{wbRed:NaN}),/параметры/);
});

function pixelAt(image,x,y) {
  return Array.from(image.rgba.slice((y*image.width+x)*4,(y*image.width+x)*4+4));
}
test('DNG ActiveArea crops after sensor-phase demosaic; all 8 TIFF orientations map exact pixels',()=>{
  const width=6,height=4,activeArea=[1,1,4,5];
  const original=fixture({width,height});
  const full=decodeDng(original);
  const coords=(o,x,y,w,h)=>{
    switch(o){
      case 1:return [x,y];
      case 2:return [w-1-x,y];
      case 3:return [w-1-x,h-1-y];
      case 4:return [x,h-1-y];
      case 5:return [y,x];
      case 6:return [h-1-y,x];
      case 7:return [h-1-y,w-1-x];
      case 8:return [y,w-1-x];
    }
  };
  for(let orientation=1;orientation<=8;orientation++){
    const bytes=fixture({width,height,activeArea,orientation});
    const snapshot=bytes.slice(0);
    const source=inspectDng(bytes);
    const rotated=developDng(source);
    const w=activeArea[3]-activeArea[1],h=activeArea[2]-activeArea[0];
    assert.deepEqual([rotated.width,rotated.height],orientation>=5?[h,w]:[w,h],
      'output dimensions for Orientation '+orientation);
    assert.deepEqual([source.width,source.height],[width,height],'sensor provenance remains native');
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const [dx,dy]=coords(orientation,x,y,w,h);
      assert.deepEqual(pixelAt(rotated,dx,dy),pixelAt(full,x+activeArea[1],y+activeArea[0]),
        'sensor-phase pixel mapping for Orientation '+orientation);
    }
    assert.deepEqual(new Uint8Array(bytes),new Uint8Array(snapshot),'source immutable');
  }
});
test('DNG malformed ActiveArea and invalid Orientation fail closed',()=>{
  for(const activeArea of [[0,0,5,4],[3,1,3,4],[0,5,4,6],[1,1,4,1]]){
    assert.throws(()=>inspectDng(fixture({width:6,height:4,activeArea})),/ActiveArea/);
  }
  for(const orientation of [0,9]){
    assert.throws(()=>inspectDng(fixture({orientation})),/Orientation/);
  }
});

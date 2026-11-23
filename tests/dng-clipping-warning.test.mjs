import test from 'node:test';
import assert from 'node:assert/strict';
import {markDisplayClippingWarning,markDisplayClippingWarningOnCanvas} from '../src/formats/dng-clipping-warning.js';

test('marks saturated display channels and neutral shadow clipping without changing alpha', () => {
  const pixels=new Uint8ClampedArray([
    255,40,60,255,
    0,0,0,255,
    22,42,80,255,
    255,255,255,0,
    253,253,253,255,
    0,0,0,100,
  ]);
  const original=pixels.slice();
  const summary=markDisplayClippingWarning(pixels);
  assert.deepEqual(summary,{highlights:1,shadows:1,eligible:4});
  assert.deepEqual([...pixels.slice(0,4)],[255,20,158,255]);
  assert.deepEqual([...pixels.slice(4,8)],[0,128,128,255]);
  assert.deepEqual([...pixels.slice(8,12)],[...original.slice(8,12)]);
  assert.deepEqual([...pixels.slice(12)],[...original.slice(12)]);
});

test('rejects invalid RGBA input and does not treat colored dark pixels as shadow clipping', () => {
  assert.throws(()=>markDisplayClippingWarning([0,0,0,255]),/RGBA/);
  assert.throws(()=>markDisplayClippingWarning(new Uint8ClampedArray(3)),/RGBA/);
  const rgba=new Uint8ClampedArray([0,0,22,255, 254,0,0,255]);
  assert.deepEqual(markDisplayClippingWarning(rgba),{highlights:1,shadows:0,eligible:2});
});

test('overlay changes only a caller-owned display buffer and never its source copy', () => {
  const source=new Uint8ClampedArray([255,255,255,255,0,0,0,255]);
  const display=source.slice();
  markDisplayClippingWarning(display);
  assert.deepEqual([...source],[255,255,255,255,0,0,0,255]);
  assert.notDeepEqual([...display],[...source]);
});


test('tiles a >8 MP display canvas with bounded RGBA reads and exact clipping counts', async () => {
  const width=3001,height=3001;
  const reads=[],writes=[];
  let yields=0;
  const context={
    getImageData(x,y,w,h) {
      assert.ok(w*h<=262144,'each readback must fit a 1 MiB RGBA tile');
      reads.push({x,y,w,h});
      const data=new Uint8ClampedArray(w*h*4);
      data.set([255,0,12,255, 0,0,0,255]);
      return {data,width:w,height:h};
    },
    putImageData(image,x,y) {
      writes.push({x,y,high:[...image.data.slice(0,4)],low:[...image.data.slice(4,8)]});
    },
  };
  const result=await markDisplayClippingWarningOnCanvas(context,{
    width,height,yieldFrame:async()=>{yields++;}
  });
  assert.ok(reads.length>1);
  assert.equal(reads.reduce((sum,r)=>sum+r.w*r.h,0),width*height);
  assert.deepEqual(result,{highlights:reads.length,shadows:reads.length,eligible:2*reads.length});
  assert.equal(writes.length,reads.length);
  assert.deepEqual(writes[0].high,[255,0,134,255]);
  assert.deepEqual(writes[0].low,[0,128,128,255]);
  assert.equal(yields,reads.length-1);
});

test('cancels stale tiled display marking before another canvas write', async () => {
  let current=true;
  let reads=0,writes=0;
  const context={
    getImageData(x,y,w,h) {
      reads++;
      const data=new Uint8ClampedArray(w*h*4);
      data.set([255,0,0,255]);
      return {data,width:w,height:h};
    },
    putImageData(){writes++;}
  };
  const summary=await markDisplayClippingWarningOnCanvas(context,{
    width:1000,height:1000,maxTilePixels:250000,
    shouldContinue:()=>current,
    yieldFrame:async()=>{current=false;}
  });
  assert.equal(summary,null);
  assert.equal(reads,1);
  assert.equal(writes,1);
});

test('rejects invalid geometry and readback interfaces before touching the canvas', async () => {
  await assert.rejects(markDisplayClippingWarningOnCanvas({}, {width:0,height:10}),/dimensions/);
  await assert.rejects(markDisplayClippingWarningOnCanvas({}, {width:10,height:10}),/getImageData/);
});

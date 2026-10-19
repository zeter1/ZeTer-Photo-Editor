import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedPhotoshopNativeLayers,verifyPhotoshopBrowserReceipt}
  from '../tools/browser-photocraft-import.mjs';
import {PHOTOCRAFT_CASES} from '../tools/verify-photocraft-candidates.mjs';

const spec=PHOTOCRAFT_CASES[0];
const samples=new Uint16Array([0,1024,32768,65535,1,2,3,65535]);
const expected=expectedPhotoshopNativeLayers({layers:[{
  name:'External native raster',width:2,height:1,
  pixelBuffer:{bitsPerChannel:16,model:'rgb',data:samples},
}]},16);
function receipt() {
  return {
    protocol:'file:',fileSha256:spec.sha256,fileSize:spec.size,
    sourceWidth:2,sourceHeight:1,canvasWidth:2,canvasHeight:1,
    importedRowCount:1,bitsPerChannel:16,nativeLayers:structuredClone(expected),
  };
}

test('002B/2a raw native raster reference is byte-exact and deterministic',()=>{
  assert.equal(expected.length,1);
  assert.match(expected[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal(expected[0].rawBytes,samples.byteLength);
  const second=expectedPhotoshopNativeLayers({layers:[{
    name:'External native raster',width:2,height:1,
    pixelBuffer:{bitsPerChannel:16,model:'rgb',data:new Uint16Array(samples)},
  }]},16);
  assert.deepEqual(second,expected);
  assert.equal(verifyPhotoshopBrowserReceipt(receipt(),spec,expected),true);
});

test('002B/2a refuses missing or changed native source and fake browser claims',()=>{
  for(const mutate of [
    r=>r.protocol='https:',
    r=>r.fileSha256='0'.repeat(64),
    r=>r.fileSize++,
    r=>r.importedRowCount=0,
    r=>r.nativeLayers=[],
    r=>r.nativeLayers[0].sha256='0'.repeat(64),
    r=>r.nativeLayers[0].bitsPerChannel=8,
    r=>r.canvasWidth++,
    r=>r.bitsPerChannel=32,
  ]) {
    const value=receipt();mutate(value);
    assert.throws(()=>verifyPhotoshopBrowserReceipt(value,spec,expected));
  }
  assert.throws(()=>verifyPhotoshopBrowserReceipt(receipt(),spec,[]));
});

test('002B/2a original Photoshop layers must use precise typed RGBA samples',()=>{
  for(const pixelBuffer of [
    {bitsPerChannel:8,model:'rgb',data:samples},
    {bitsPerChannel:16,model:'cmyk',data:samples},
    {bitsPerChannel:16,model:'rgb',data:new Float32Array(8)},
  ]) assert.throws(()=>expectedPhotoshopNativeLayers({layers:[{
    name:'Invalid',width:2,height:1,pixelBuffer,
  }]},16));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,sanitizeProject,snapshotDocument} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';

const gamma=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
const pixels=(img,x,y)=>Array.from(img.rgba.slice((y*img.width+x)*4,(y*img.width+x)*4+4));

test('optional edge-aware green keeps the correct side of a high-contrast vertical Bayer boundary',()=>{
  for(const le of [true,false])for(const pattern of [[0,1,1,2],[2,1,1,0],[1,0,2,1],[1,2,0,1]]){
    const bytes=fixture({le,pattern,width:8,height:8,activeArea:[0,0,8,8],
      defaultCropOrigin:[2,2],defaultCropSize:[4,4],
      samples:(x)=>x<4?20:180});
    const original=new Uint8Array(bytes).slice();
    const legacy=decodeDng(bytes);
    const explicit=decodeDng(bytes,{demosaic:'bilinear'});
    const improved=decodeDng(bytes,{demosaic:'edge-aware-green'});
    assert.deepEqual(explicit.rgba,legacy.rgba,'bilinear remains the legacy default');
    assert.deepEqual([improved.width,improved.height],[4,4]);
    // At sensor x=4,y=4 and x=3,y=3 the Bayer center must not be green
    // for the first two patterns. For the others check a non-green center.
    const centers=pattern[0]===1 ? [[4,3,2,1],[3,4,1,2]] : [[4,4,2,2],[3,3,1,1]];
    for(const [sx,sy,dx,dy] of centers){
      const site=pattern[(sy&1)*2+(sx&1)];
      if(site===1)continue;
      const expected=gamma(sx<4?0.1:0.9);
      assert.equal(pixels(improved,dx,dy)[1],expected,
        'edge-directed G at '+[sx,sy]+' pattern '+pattern+' must follow the same-side pixels');
    }
    assert.deepEqual(new Uint8Array(bytes),original,'native RAW bytes preserved');
    assert.equal(improved.development.demosaic,'edge-aware-green');
    assert.equal(legacy.development.demosaic,undefined,'legacy output omits optional mode');
  }
});

test('invalid demosaic values reject; edge-aware choice survives .zpe while old projects remain bilinear',()=>{
  const bytes=fixture({width:8,height:8});
  for(const value of ['edge',null,0,{},'nearest'])assert.throws(
    ()=>decodeDng(bytes,{demosaic:value}),/параметры RAW|demosaic/);
  const image=decodeDng(bytes,{demosaic:'edge-aware-green'});
  const doc=createDocument({width:8,height:8});
  addLayer(doc,createRasterLayer({width:8,height:8,dataUrl:'data:image/png;base64,AAAA',
    rawDng:{dataUrl:bytesToDataUrl(bytes,'application/x-adobe-dng'),width:8,height:8,
      development:image.development}}));
  const saved=JSON.parse(snapshotDocument(doc));
  const reopened=sanitizeProject(saved);
  assert.equal(reopened.layers[0].rawDng.development.demosaic,'edge-aware-green');
  assert.equal(reopened.layers[0].rawDng.dataUrl,saved.layers[0].rawDng.dataUrl);
  const legacy=structuredClone(saved);
  delete legacy.layers[0].rawDng.development.demosaic;
  assert.equal(sanitizeProject(legacy).layers[0].rawDng.development.demosaic,undefined);
  const bad=structuredClone(saved);
  bad.layers[0].rawDng.development.demosaic='made-up';
  assert.equal(sanitizeProject(bad).layers[0].rawDng,null);
});

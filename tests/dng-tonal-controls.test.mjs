import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDngTonalControls} from '../src/formats/dng-color.js';
import {decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,sanitizeProject,snapshotDocument} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';

const close=(actual,expected,tolerance=1e-9)=>
  assert.ok(Math.abs(actual-expected)<tolerance,`expected ${expected}, received ${actual}`);

test('linear luminance shadows lift dark grays and highlights compress bright grays',()=>{
  const shadow=applyDngTonalControls([0.2,0.2,0.2],{shadows:1});
  shadow.forEach(v=>close(v,0.328));
  const highlight=applyDngTonalControls([0.8,0.8,0.8],{highlights:-1});
  highlight.forEach(v=>close(v,0.672));
  close(applyDngTonalControls([0.2,0.2,0.2],{highlights:-1})[0],0.168);
  close(applyDngTonalControls([0.8,0.8,0.8],{shadows:1})[0],0.832);
});

test('tone curve is monotonic and fixes black and display white at extreme controls',()=>{
  for(const highlights of [-1,0,1])for(const shadows of [-1,0,1]){
    let last=-1;
    for(let i=0;i<=1000;i++){
      const x=i/1000;
      const y=applyDngTonalControls([x,x,x],{highlights,shadows})[0];
      assert.ok(y>=last-1e-9,`non-monotone: ${x}, ${last}, ${y}`);
      last=y;
    }
    close(applyDngTonalControls([0,0,0],{highlights,shadows})[0],0);
    close(applyDngTonalControls([1,1,1],{highlights,shadows})[0],1);
  }
});

test('linear tint ratios remain stable before display clipping and zero controls are exact identity',()=>{
  const rgb=[0.08,0.16,0.32];
  assert.deepEqual(applyDngTonalControls(rgb),rgb);
  const adjusted=applyDngTonalControls(rgb,{highlights:0.6,shadows:-0.5});
  adjusted.forEach((v,i)=>close(v/rgb[i],adjusted[0]/rgb[0]));
  assert.deepEqual(applyDngTonalControls([1.5,0.2,-0.1]),[1.5,0.2,-0.1]);
});

test('RAW develop applies new tonal controls before sRGB transfer and preserves native DNG',()=>{
  const dark=fixture({samples:[45,45,45]});
  const copy=dark.slice(0);
  const before=decodeDng(dark),after=decodeDng(dark,{shadows:1});
  assert.ok(after.rgba[0]>before.rgba[0]+10,'shadows must affect RAW bitmap');
  assert.equal(after.development.shadows,1);
  assert.equal(after.development.highlights,0);
  const bright=fixture({samples:[150,150,150]});
  assert.ok(decodeDng(bright,{highlights:-1}).rgba[0]<decodeDng(bright).rgba[0]-8,
    'highlights must affect RAW bitmap');
  assert.deepEqual(new Uint8Array(dark),new Uint8Array(copy),'native RAW unchanged');
  for(const options of [{shadows:1.1},{highlights:-1.1},{shadows:NaN},{highlights:Infinity}])
    assert.throws(()=>decodeDng(dark,options),/параметры RAW/);
});

test('RAW highlights/shadows persist through .zpe, with legacy defaults and rejection of invalid values',()=>{
  const raw=fixture();
  const doc=createDocument({width:4,height:4});
  const source=decodeDng(raw,{highlights:-0.4,shadows:0.75});
  const layer=createRasterLayer({width:4,height:4,dataUrl:'data:image/png;base64,AAAA',rawDng:{
    dataUrl:bytesToDataUrl(raw,'application/x-adobe-dng'),width:4,height:4,
    development:source.development,colorPipeline:source.colorPipeline,
  }});
  addLayer(doc,layer);
  const saved=JSON.parse(snapshotDocument(doc));
  const reopened=sanitizeProject(saved);
  assert.deepEqual(reopened.layers[0].rawDng.development,source.development);
  assert.equal(reopened.layers[0].rawDng.dataUrl,layer.rawDng.dataUrl);
  const legacy=structuredClone(saved);
  delete legacy.layers[0].rawDng.development.highlights;
  delete legacy.layers[0].rawDng.development.shadows;
  assert.deepEqual(sanitizeProject(legacy).layers[0].rawDng.development,
    {exposure:0,wbRed:1,wbBlue:1,highlights:0,shadows:0,contrast:0});
  const invalid=structuredClone(saved);
  invalid.layers[0].rawDng.development.shadows=2;
  assert.equal(sanitizeProject(invalid).layers[0].rawDng,null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,sanitizeProject,snapshotDocument} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';

const srgb=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
const pixel=(image,x,y)=>Array.from(image.rgba.slice((y*image.width+x)*4,(y*image.width+x)*4+4));

test('green-guided R/B interpolation preserves constant chroma across a luminance edge for all Bayer phases and endianness',()=>{
  for(const le of [true,false])for(const pattern of [[0,1,1,2],[2,1,1,0],[1,0,2,1],[1,2,0,1]]){
    const bytes=fixture({le,pattern,width:10,height:10,activeArea:[0,0,10,10],
      defaultCropOrigin:[2,2],defaultCropSize:[6,6],
      samples:(x,y,c)=>(x<5?50:130)+(c===0?30:c===2?-20:0)});
    const untouched=Array.from(new Uint8Array(bytes));
    const legacy=decodeDng(bytes);
    const greenOnly=decodeDng(bytes,{demosaic:'edge-aware-green'});
    const guided=decodeDng(bytes,{demosaic:'edge-aware-rgb'});
    assert.equal(guided.development.demosaic,'edge-aware-rgb');
    assert.deepEqual([guided.width,guided.height],[6,6]);
    assert.deepEqual(decodeDng(bytes,{demosaic:'bilinear'}).rgba,legacy.rgba);
    let improved=0;
    for(const x of [3,4,5,6])for(const y of [3,4,5,6]){
      const g=x<5?50:130;
      const expected=[srgb((g+30)/200),srgb(g/200),srgb((g-20)/200),255];
      const actual=pixel(guided,x-2,y-2);
      assert.deepEqual(actual,expected,'sensor '+[x,y]+' phase '+pattern+' LE='+le);
      const old=pixel(greenOnly,x-2,y-2);
      if(old[0]!==expected[0]||old[2]!==expected[2])improved++;
    }
    assert.ok(improved>0,'the new mode changes chroma pixels beyond existing green-only mode');
    assert.deepEqual(Array.from(new Uint8Array(bytes)),untouched,'original DNG source bytes immutable');
  }
});

test('new chroma mode fails closed on invalid enum and survives native .zpe round-trip',()=>{
  const raw=fixture({width:10,height:10});
  for(const mode of ['nearest','edge-aware-red',null,23,{}])
    assert.throws(()=>decodeDng(raw,{demosaic:mode}),/параметры RAW|demosaic/);
  const decoded=decodeDng(raw,{demosaic:'edge-aware-rgb'});
  const doc=createDocument({width:10,height:10});
  addLayer(doc,createRasterLayer({width:10,height:10,dataUrl:'data:image/png;base64,AAAA',
    rawDng:{dataUrl:bytesToDataUrl(raw,'application/x-adobe-dng'),width:10,height:10,
      development:decoded.development}}));
  const saved=JSON.parse(snapshotDocument(doc));
  const reopened=sanitizeProject(saved);
  assert.equal(reopened.layers[0].rawDng.development.demosaic,'edge-aware-rgb');
  assert.equal(reopened.layers[0].rawDng.dataUrl,saved.layers[0].rawDng.dataUrl);
  const corrupt=structuredClone(saved);
  corrupt.layers[0].rawDng.development.demosaic='edge-aware-rgb-invalid';
  assert.equal(sanitizeProject(corrupt).layers[0].rawDng,null,'unsupported .zpe modes fail closed');
  delete saved.layers[0].rawDng.development.demosaic;
  assert.equal(sanitizeProject(saved).layers[0].rawDng.development.demosaic,undefined);
});

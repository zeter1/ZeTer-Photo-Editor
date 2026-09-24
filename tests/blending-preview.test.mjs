import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const source=main.slice(main.indexOf('function blendingPreviewCrop('),main.indexOf('function attachTextPreview('));

test('blending preview copies the accepted composite around the layer and follows resize',()=>{
  const draws=[];
  const context={clearRect(){},drawImage(...args){draws.push(args);}};
  const sourceCanvas={width:1000,height:800};
  const previewCanvas={clientWidth:500,clientHeight:200,width:0,height:0,isConnected:true,getContext:()=>context};
  const layer={id:'layer-1',scaleX:1,scaleY:1};
  const documentValue={width:1000,height:800,layers:[layer]};
  const sandbox={
    doc:documentValue,els:{canvas:sourceCanvas},window:{devicePixelRatio:1.5},
    frameBounds:(_layer,padding)=>({x:400-padding,y:300-padding,width:200+padding*2,height:80+padding*2}),
    clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),
  };
  vm.runInNewContext(`${source}\nconst crop=blendingPreviewCrop(doc,doc.layers[0]);globalThis.runPreview=syncBlendingPreviewCanvas;globalThis.setPreview=value=>{blendingPreview=value};globalThis.getCrop=()=>crop;`,sandbox);
  sandbox.setPreview({document:documentValue,layer,canvas:previewCanvas,crop:sandbox.getCrop()});
  sandbox.runPreview();
  assert.equal(draws.length,1);
  assert.equal(draws[0][0],sourceCanvas);
  assert.equal(draws[0][1],220);
  assert.equal(draws[0][2],120);
  assert.equal(draws[0][3],560);
  assert.equal(draws[0][4],440);
  assert.equal(previewCanvas.width,750);
  assert.equal(previewCanvas.height,300);
  previewCanvas.clientWidth=600;
  previewCanvas.clientHeight=300;
  sandbox.runPreview();
  assert.equal(draws.length,2);
  assert.equal(previewCanvas.width,900);
  assert.equal(previewCanvas.height,450);
  documentValue.layers=[];
  sandbox.runPreview();
  assert.equal(draws.length,2);
});
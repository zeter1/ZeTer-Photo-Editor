import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSamPrompts,mergeSamMask} from '../src/ai/sam-preprocess.js';
import {createObjectRemovalController} from '../src/painting/object-removal-controller.js';
import {createBackgroundModels} from '../src/ai/background-models.js';
import {SAM2_ARTIFACTS,SAM_ARTIFACTS} from '../src/ai/sam-assets.js';
import {createSamEngine} from '../src/ai/sam-runtime.js';
function fixture(){const data=new Uint8ClampedArray(256*256*4).fill(128),mask=new Uint8Array(65536);for(let y=110;y<140;y++)for(let x=110;x<140;x++)mask[y*256+x]=1;return {width:256,height:256,data,mask};}
function output(){const masks=new Float32Array(3*65536).fill(-8);for(let k=0;k<3;k++)for(let y=40;y<210;y++)for(let x=70;x<190;x++)masks[k*65536+y*256+x]=8;return {masks,scores:new Float32Array([.1,.9,.4])};}
test('wide approximate paint avoids accidental thin background fringe',()=>{
 const f=fixture();f.mask.fill(0);for(let y=60;y<200;y++)for(let x=60;x<200;x++)f.mask[y*256+x]=1;for(let x=200;x<255;x++)f.mask[130*256+x]=1;
 const p=prepareSamPrompts(f);assert.ok(p.points.length>=4);for(let i=0;i<p.points.length;i+=2){const x=p.points[i]/4,y=p.points[i+1]/4;assert.ok(x>70&&x<190&&y>70&&y<190,'deep interior seed');}
});
test('negative hints get zero labels; negative-only draft fails',()=>{const f=fixture();for(let y=20;y<40;y++)for(let x=20;x<40;x++)f.mask[y*256+x]=2;const p=prepareSamPrompts(f);assert.ok(p.labels.includes(0));assert.ok(p.labels.includes(1));f.mask.fill(2);assert.throws(()=>prepareSamPrompts(f),/Сохранить объект/);});
test('small separate explicit foreground hint survives beside broad body paint',()=>{const f=fixture();f.mask.fill(0);for(let y=40;y<180;y++)for(let x=40;x<180;x++)f.mask[y*256+x]=1;for(let y=220;y<225;y++)for(let x=220;x<225;x++)f.mask[y*256+x]=1;const p=prepareSamPrompts(f);assert.ok(Array.from(p.points).some((v,i)=>i%2===0&&v/4>=220));});
test('SAM2 square preprocessing differs from SlimSAM padding',()=>{const f={width:128,height:256,data:new Uint8ClampedArray(128*256*4).fill(255),mask:new Uint8Array(128*256)};f.mask[128*128+64]=1;const a=prepareSamPrompts(f),b=prepareSamPrompts(f,{square:true});assert.equal(a.resizedWidth,512);assert.equal(b.resizedWidth,1024);assert.equal(b.points[0],a.points[0]*2);});
test('cleanup fills tiny pinholes, removes speckles, preserves substantial holes',()=>{
 const f=fixture(),p=prepareSamPrompts(f),o=output();for(let k=0;k<3;k++){o.masks[k*65536+80*256+100]=-8;o.masks[k*65536+20*256+20]=8;for(let y=160;y<180;y++)for(let x=130;x<150;x++)o.masks[k*65536+y*256+x]=-8;}
 const r=mergeSamMask(f,p,o,{feather:1}),alpha=(x,y)=>r[(y*256+x)*4+3];assert.equal(alpha(100,80),128);assert.equal(alpha(20,20),0);assert.equal(alpha(140,170),0);
});
test('negative hint rejects a higher-confidence wrong candidate',()=>{const f=fixture();f.mask[80*256+100]=2;const p=prepareSamPrompts(f),o=output();o.scores.set([.95,.9,.8]);for(let y=70;y<90;y++)for(let x=90;x<110;x++)o.masks[65536+y*256+x]=-8;const r=mergeSamMask(f,p,o);assert.equal(r[(80*256+100)*4+3],0);assert.equal(r[(120*256+120)*4+3],128);});
test('negative strokes overwrite positives; cancellation restores original labels',()=>{
 const layer={width:20,height:20},doc={layers:[layer]},c=createObjectRemovalController({state:{getDocument:()=>doc,getSerial:()=>0,selected:()=>layer,isEditable:()=>true},geometry:{toLocal:p=>p,toDocument:p=>p}});
 c.begin({x:8,y:8},5,1);c.finish({x:8,y:8},5);const a=c.snapshot();c.begin({x:8,y:8},5,2);assert.equal(c.snapshot().data[168],2);c.cancel();assert.deepEqual(c.snapshot(),a);
});
test('catalog offers only verified quality model and rejects weak saved choices',()=>{
 const engines=[],saved=[];const catalog=createBackgroundModels({storage:{getItem:()=> 'slimsam',setItem:(...v)=>saved.push(v)},engineFactory:options=>{const e={options,isReady:()=>e.ready,ready:false};engines.push(e);return e;}});
 assert.equal(catalog.models.length,1);assert.equal(catalog.models[0].id,'sam2');assert.equal(catalog.selectedId(),'sam2');const capture=catalog.capture();engines[0].ready=true;assert.equal(catalog.isReady(),true);assert.equal(capture.model.square,true);assert.equal(capture.engine,engines[0]);assert.throws(()=>catalog.select('slimsam'));assert.throws(()=>catalog.select('arbitrary-url'));catalog.select('sam2');assert.equal(saved.length,1);
});
test('SAM2 request supplies checked external data and negative labels, cancel retains verified assets',async()=>{
 let request,terminated=0;const engine=createSamEngine({square:true,cache:{remove:async()=>true},load:async(_d,o)=>{o.onCacheResult(true);return new ArrayBuffer(1);},workerFactory:()=>({postMessage:r=>request=r,terminate:()=>terminated++})});await engine.prepare();const abort=new AbortController(),p=engine.run({input:new Float32Array(1),points:new Float32Array([1,2,3,4]),labels:new Int32Array([1,0])},{signal:abort.signal});
 assert.equal(request.square,true);assert.ok(request.encoderData instanceof ArrayBuffer);assert.ok(request.decoderData instanceof ArrayBuffer);assert.deepEqual(Array.from(request.labels),[1,0]);abort.abort();await assert.rejects(p);assert.ok(terminated);assert.equal(engine.isReady(),true);assert.equal(SAM2_ARTIFACTS.length,7);assert.notEqual(SAM2_ARTIFACTS[3].id,SAM_ARTIFACTS[3].id);
});

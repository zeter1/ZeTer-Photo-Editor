import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSamPrompts,prepareSamImage,mergeSamMask } from '../src/ai/sam-preprocess.js';
import { createBackgroundRemovalCommandController } from '../src/painting/background-removal-command-controller.js';
import { createObjectRemovalController } from '../src/painting/object-removal-controller.js';
import { SAM_ARTIFACTS } from '../src/ai/sam-assets.js';
import { createSamEngine } from '../src/ai/sam-runtime.js';
import { createLamaArtifactCache } from '../src/ai/asset-cache.js';
import { createEditorSettingsController } from '../src/ui/editor-settings-controller.js';

function fixture(){
  const width=256,height=256,data=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
  for(let i=0;i<mask.length;i++)data.set([30,90,170,128],i*4);
  for(let y=110;y<140;y++)for(let x=110;x<140;x++)mask[y*width+x]=1;
  return {width,height,data,mask};
}
function neuralOutput(){
  const masks=new Float32Array(3*256*256).fill(-8),scores=new Float32Array([.1,.9,.4]);
  for(let k=0;k<3;k++)for(let y=40;y<210;y++)for(let x=70;x<190;x++)masks[k*256*256+y*256+x]=8;
  return {masks,scores};
}
test('approximate strokes give bounded positive points; transparent pixels are excluded',()=>{
  const f=fixture(),p=prepareSamPrompts(f);assert.ok(p.points.length<=16);
  for(let i=0;i<p.points.length;i+=2){const x=p.points[i]/4,y=p.points[i+1]/4;assert.equal(f.mask[y*256+x],1);}
  f.data.fill(0);assert.throws(()=>prepareSamPrompts(f));assert.throws(()=>prepareSamPrompts({...f,width:9000,height:9000}));
});
test('normalization pads AFTER normalization and uses exact RGB/alpha values',()=>{
  const input=prepareSamImage(new Uint8ClampedArray([255,0,0,255,20,30,40,0]),2,1),n=1024*1024;
  assert.ok(Math.abs(input[0]-(1-.485)/.229)<1e-5);assert.ok(Math.abs(input[n]-(0-.456)/.224)<1e-5);
  assert.ok(Math.abs(input[1]-(1-.485)/.229)<1e-5);assert.equal(input[2],0);assert.equal(input[1024],0);
});
test('neural contour preserves WHOLE object outside brush and removes background alpha only',()=>{
  const f=fixture(),p=prepareSamPrompts(f),r=mergeSamMask(f,p,neuralOutput());
  assert.equal(f.mask[80*256+100],0);assert.equal(r[(80*256+100)*4+3],128);
  assert.equal(r[(10*256+10)*4+3],0);assert.equal(r[(120*256+120)*4+3],128);
  for(let i=0;i<r.length;i++)if(i%4!==3)assert.equal(r[i],f.data[i]);else assert.ok(r[i]<=f.data[i]);
});
test('malformed, nonfinite, empty, full-layer and wrong-object output fail closed',()=>{
  const f=fixture(),p=prepareSamPrompts(f);
  assert.throws(()=>mergeSamMask(f,p,{masks:new Float32Array(1),scores:new Float32Array(3)}));
  for(const value of [NaN,Infinity,-8,8]){const o=neuralOutput();o.masks.fill(value);assert.throws(()=>mergeSamMask(f,p,o));}
});
test('non-square sources ignore padded model space',()=>{
  const width=128,height=256,data=new Uint8ClampedArray(width*height*4).fill(255),mask=new Uint8Array(width*height);mask[120*width+90]=1;
  const f={width,height,data,mask},p=prepareSamPrompts(f),o=neuralOutput();
  assert.equal(p.resizedWidth,512);assert.equal(p.resizedHeight,1024);
  const result=mergeSamMask(f,p,o);assert.equal(result[(120*width+90)*4+3],255);assert.equal(result[(10*width+10)*4+3],0);
});
function harness(){
  const f=fixture(),layer={width:256,height:256},doc={layers:[layer]},other={dataUrl:'unchanged'};doc.layers.push(other);
  let current=true,busy=false,writes=0,persists=0,commits=[],resolve,persistGate=null;
  const c=createBackgroundRemovalCommandController({state:{getDocument:()=>doc,beginPersist:()=>busy?false:(busy=true),endPersist:()=>busy=false},
    documentRef:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(1024*1024*4)})})})},
    rasterEdit:{ensureRasterBuffer:async()=>({canvas:{width:256,height:256},ctx:{getImageData:()=>({data:f.data.slice()}),putImageData(){writes++;}}}),persistPaintLayer:async(_d,_l,{isContinuationCurrent})=>{if(persistGate)await persistGate;if(!isContinuationCurrent())return false;persists++;return true;},clearBrushBuffer(){}},
    engine:{run:()=>new Promise(r=>resolve=r)},ui:{commit:label=>commits.push(label),render(){},setStatus(){}}});
  return {c,f,doc,layer,other,args:()=>({ownerDocument:doc,ownerLayer:layer,mask:{width:256,height:256,data:f.mask},isCurrent:()=>current}),stale(){current=false;},resolve:()=>resolve(neuralOutput()),persistWait:p=>persistGate=p,counts:()=>({busy,writes,persists,commits})};
}
test('success publishes one alpha edit/history on captured layer; other layer remains unchanged',async()=>{
  const h=harness(),p=h.c.remove(h.args());await new Promise(r=>setImmediate(r));h.resolve();assert.equal(await p,true);
  assert.deepEqual(h.counts(),{busy:false,writes:1,persists:1,commits:['Удалить фон']});assert.equal(h.other.dataUrl,'unchanged');
});
for(const action of ['stale','replacement','abort'])test(`late neural result cannot publish after ${action}`,async()=>{
  const h=harness(),abort=new AbortController(),p=h.c.remove({...h.args(),signal:abort.signal});await new Promise(r=>setImmediate(r));
  if(action==='stale')h.stale();if(action==='replacement')h.doc.layers[0]={...h.layer};if(action==='abort')abort.abort();h.resolve();
  assert.equal(await p,false);assert.deepEqual(h.counts(),{busy:false,writes:0,persists:0,commits:[]});
});
test('context loss during PNG persistence never publishes history',async()=>{
  const h=harness();let release;h.persistWait(new Promise(r=>release=r));const p=h.c.remove(h.args());await new Promise(r=>setImmediate(r));h.resolve();await new Promise(r=>setImmediate(r));h.stale();release();assert.equal(await p,false);assert.equal(h.counts().persists,0);assert.deepEqual(h.counts().commits,[]);
});
test('high depth stays untouched without tensor or inference',async()=>{const h=harness();h.layer.highDepthSource={};assert.equal(await h.c.remove(h.args()),false);assert.equal(h.counts().writes,0);assert.equal(h.counts().busy,false);});
test('shared brush lifecycle supplies background history and keeps strokes after cancel',async()=>{
  const layer={width:20,height:20},doc={layers:[layer]};let label;
  const c=createObjectRemovalController({toolName:'Кисть удаления фона',historyLabel:'Удалить фон',state:{getDocument:()=>doc,getSerial:()=>0,selected:()=>layer,isEditable:()=>true},geometry:{toLocal:p=>p,toDocument:p=>p},commands:{remove:async args=>{label=args.historyLabel;return false;}}});
  c.begin({x:8,y:8},5);c.finish({x:8,y:8},5);await c.remove();assert.equal(label,'Удалить фон');assert.equal(c.hasMask(),true);
});
test('SAM installer uses fixed five assets and release-on-abort worker lifecycle',async()=>{
  let request,terminated=0;
  const engine=createSamEngine({cache:{remove:async()=>true},load:async(d,opt)=>{opt.onCacheResult(true);return new ArrayBuffer(1);},workerFactory:()=>({postMessage:r=>request=r,terminate:()=>terminated++})});
  await engine.prepare();assert.equal(engine.isReady(),true);const abort=new AbortController();const p=engine.run({input:new Float32Array(1),points:new Float32Array([1,2])},{signal:abort.signal});
  assert.ok(request.encoder instanceof ArrayBuffer);assert.ok(request.decoder instanceof ArrayBuffer);assert.equal(request.points.length,2);await assert.rejects(engine.remove());abort.abort();await assert.rejects(p);assert.ok(terminated>=1);await engine.remove();assert.equal(engine.isReady(),false);assert.equal(SAM_ARTIFACTS.length,5);
});
test('background cache deletion touches only its five owned keys in separate database',async()=>{
  const records=new Map([...SAM_ARTIFACTS.map(a=>[a.id,'model']),['sentinel','keep']]),deleted=[];
  const indexedDB={open(name){assert.equal(name,'zeter-background-removal-model-v1');const req={};queueMicrotask(()=>{req.result={close(){},transaction(){const tx={objectStore:()=>({delete:id=>deleted.push(id)})};queueMicrotask(()=>{for(const id of deleted)records.delete(id);tx.oncomplete();});return tx;}};req.onsuccess();});return req;}};
  const cache=createLamaArtifactCache({indexedDB,databaseName:'zeter-background-removal-model-v1',artifacts:SAM_ARTIFACTS});assert.equal(await cache.remove(),true);assert.deepEqual(deleted,SAM_ARTIFACTS.map(a=>a.id));assert.deepEqual([...records],[['sentinel','keep']]);
});

test('native settings module composes both model owners and routes background install/uninstall',async()=>{
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',value:'',scrollIntoView(){}});return nodes.get(id);};
  const dialog={open:false,querySelector:selector=>node(selector.slice(1)),querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;}};
  let ready=false,backgroundStates=[],objectPrepared=0;
  const engine={isReady:()=>false,isStored:()=>false,isBusy:()=>false,prepare:async()=>{objectPrepared++;throw new Error('missing');}};
  const backgroundEngine={isReady:()=>ready,isStored:()=>true,isBusy:()=>false,prepare:async opt=>{if(opt.cachedOnly)throw new Error('missing');ready=true;},remove:async()=>{ready=false;}};
  const settings=createEditorSettingsController({dialog,engine,backgroundEngine,storage:{getItem:()=>null},preferences:{setBrush(){},getSnap:()=>true},onBackgroundModelState:value=>backgroundStates.push(value)});
  await new Promise(r=>setImmediate(r));assert.ok(node('backgroundModelStatus').textContent.startsWith('Не установлена'));
  await settings.openForBackgroundInstall();assert.equal(dialog.open,true);assert.equal(node('backgroundModelInstall').hidden,true);assert.equal(backgroundStates.at(-1),true);assert.equal(objectPrepared,1);
  await node('backgroundModelRemove').onclick();assert.equal(node('backgroundModelInstall').hidden,false);assert.equal(backgroundStates.at(-1),false);assert.equal(objectPrepared,1);
});

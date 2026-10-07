import test from 'node:test';
import assert from 'node:assert/strict';
import { createLamaEngine } from '../src/ai/lama-runtime.js';
import { createLamaArtifactCache } from '../src/ai/asset-cache.js';
import { LAMA_ARTIFACTS } from '../src/ai/lama-assets.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
const make=(cache,load=async(_d,opt)=>{opt.onCacheResult(true);return new ArrayBuffer(1);},workerFactory)=>createLamaEngine({cache,load,workerFactory});
test('successful and repeated removal release ready state and allow reinstall',async()=>{
  let deletes=0;const engine=make({remove:async()=>{deletes++;return true;}});
  await engine.prepare();assert.equal(engine.isReady(),true);assert.equal(engine.isStored(),true);
  await engine.remove();assert.equal(engine.isReady(),false);assert.equal(engine.isStored(),false);
  await engine.remove();assert.equal(deletes,2);await engine.prepare();assert.equal(engine.isReady(),true);
});
test('cache failure retains resident model and allows later removal',async()=>{
  let success=false;const engine=make({remove:async()=>success});await engine.prepare();
  await assert.rejects(engine.remove(),/не разрешил/);assert.equal(engine.isReady(),true);assert.equal(engine.isStored(),true);assert.equal(engine.isBusy(),false);
  success=true;await engine.remove();assert.equal(engine.isReady(),false);
});
test('pending deletion blocks fast-path prepare, run and repeated deletion',async()=>{
  const gate=deferred(),engine=make({remove:()=>gate.promise});await engine.prepare();const removing=engine.remove();
  assert.equal(engine.isBusy(),true);await assert.rejects(engine.prepare());await assert.rejects(engine.run(new Float32Array(1)));await assert.rejects(engine.remove());
  assert.equal(engine.isReady(),true);gate.resolve(true);await removing;assert.equal(engine.isReady(),false);
});
test('preparation and live inference exclude removal; cancellation releases exclusion',async()=>{
  const gate=deferred();let loaded=0,deletes=0;
  const engine=make({remove:async()=>{deletes++;return true;}},async(_d,opt)=>{if(!loaded++)await gate.promise;opt.onCacheResult(true);return new ArrayBuffer(1);},()=>({postMessage(){},terminate(){}}));
  const preparing=engine.prepare();await assert.rejects(engine.remove());assert.equal(deletes,0);gate.resolve();await preparing;
  const abort=new AbortController(),running=engine.run(new Float32Array(1),{signal:abort.signal});await assert.rejects(engine.remove());abort.abort();await assert.rejects(running);await engine.remove();assert.equal(deletes,1);
});
function fakeIDB({abort=false,blocked=false}={}){
  const deleted=[],records=new Map([...LAMA_ARTIFACTS.map(a=>[a.id,'model']),['unrelated','keep']]);let transaction;
  return {records,deleted,idb:{open(name,version){assert.equal(name,'zeter-object-removal-model-v1');assert.equal(version,1);const request={};queueMicrotask(()=>{
    if(blocked){request.onblocked();return;}
    request.result={close(){},transaction(store,mode){assert.equal(store,'artifacts');assert.equal(mode,'readwrite');
      transaction={objectStore:()=>({delete(id){deleted.push(id);return {};}}),abort(){transaction.onabort();}};
      queueMicrotask(()=>{if(abort)transaction.onabort();else{deleted.forEach(id=>records.delete(id));transaction.oncomplete();}});return transaction;}};
    request.onsuccess();});return request;}}};
}
test('cache removal deletes precisely four owned keys and commits before reporting success',async()=>{
  const f=fakeIDB(),cache=createLamaArtifactCache({indexedDB:f.idb});assert.equal(await cache.remove(),true);
  assert.deepEqual(f.deleted,LAMA_ARTIFACTS.map(a=>a.id));assert.deepEqual([...f.records],[['unrelated','keep']]);
});
test('transaction abort and blocked open report failure with records retained',async()=>{
  for(const option of [{abort:true},{blocked:true}]){const f=fakeIDB(option);assert.equal(await createLamaArtifactCache({indexedDB:f.idb}).remove(),false);assert.equal(f.records.size,5);}
});
test('unavailable IndexedDB has no cache to delete; open error reports failure',async()=>{
  assert.equal(await createLamaArtifactCache({indexedDB:null}).remove(),true);
  assert.equal(await createLamaArtifactCache({indexedDB:{open(){throw new Error('denied');}}}).remove(),false);
});

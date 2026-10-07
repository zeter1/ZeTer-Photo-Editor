import { LAMA_ARTIFACTS } from './lama-assets.js';

// This database stores only four public artifacts. Never stores images, masks or tensors.
export function createLamaArtifactCache({indexedDB=globalThis.indexedDB,storage=globalThis.navigator?.storage,databaseName='zeter-object-removal-model-v1',artifacts=LAMA_ARTIFACTS}={}) {
  async function access(id,bytes) {
    if(!indexedDB)return null;
    if(bytes){const estimate=await storage?.estimate?.();if(!estimate?.quota||estimate.quota-(estimate.usage||0)<bytes.byteLength+64*1024*1024)return null;}
    return new Promise(resolve=>{
      let db,done=false,tx;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(value);};
      const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(null);},5000);
      const open=indexedDB.open(databaseName,1);
      open.onupgradeneeded=()=>{open.result.createObjectStore('artifacts');};
      open.onerror=open.onblocked=()=>finish(null);
      open.onsuccess=()=>{
        db=open.result;if(done){db.close();return;}
        tx=db.transaction('artifacts',bytes?'readwrite':'readonly');
        let value=null;
        const request=bytes?tx.objectStore('artifacts').put(bytes,id):tx.objectStore('artifacts').get(id);
        request.onsuccess=()=>{value=bytes?true:request.result??null;};
        tx.oncomplete=()=>finish(value);tx.onerror=tx.onabort=()=>finish(null);
      };
    });
  }
  // Delete only owned public artifacts, including a canceled installation's partial cache.
  async function remove() {
    if(!indexedDB)return true;
    return new Promise(resolve=>{
      let db,tx,done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(value);};
      const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(false);},5000);
      try {
        const open=indexedDB.open(databaseName,1);
        open.onupgradeneeded=()=>{open.result.createObjectStore('artifacts');};
        open.onerror=open.onblocked=()=>finish(false);
        open.onsuccess=()=>{
          db=open.result;if(done){db.close();return;}
          try {
            tx=db.transaction('artifacts','readwrite');
            tx.oncomplete=()=>finish(true);tx.onerror=tx.onabort=()=>finish(false);
            const store=tx.objectStore('artifacts');
            for(const artifact of artifacts)store.delete(artifact.id);
          } catch {try{tx?.abort();}catch{}finish(false);}
        };
      } catch {finish(false);}
    });
  }
  return {get:id=>access(id),put:(id,bytes)=>access(id,bytes),remove};
}

export async function loadLamaArtifact(descriptor,{signal,onProgress,onCacheResult,cache,cachedOnly=false,fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto}={}) {
  const aborted=()=>{if(signal?.aborted)throw new DOMException('Удаление отменено','AbortError');};
  const verify=async bytes=>{
    if(!(bytes instanceof ArrayBuffer)||bytes.byteLength!==descriptor.size)return false;
    const digest=new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes));
    return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')===descriptor.sha256;
  };
  if(!cryptoImpl?.subtle)throw new Error('Нужен современный браузер и HTTPS или локальное открытие редактора');
  aborted();
  let cached;try{cached=await cache?.get(descriptor.id);}catch{cached=null;}
  aborted();
  if(cached&&await verify(cached)){aborted();onCacheResult?.(true);return cached;}
  if(cachedOnly)throw new Error('Модель ещё не установлена');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,180000);
  try {
    aborted();
    const response=await fetchImpl(descriptor.url,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error(`Загрузка модели: HTTP ${response.status}`);
    const length=response.headers.get('content-length');
    if(length&&Number(length)>descriptor.size)throw new Error('Размер загрузки не совпадает с проверенной моделью');
    if(!response.body)throw new Error('Браузер не поддерживает загрузку модели');
    const reader=response.body.getReader(),bytes=new Uint8Array(descriptor.size);let offset=0;
    try {
      while(true){const {done,value}=await reader.read();if(done)break;aborted();if(offset+value.byteLength>bytes.length)throw new Error('Модель превышает допустимый размер');bytes.set(value,offset);offset+=value.byteLength;onProgress?.(offset);}
    } finally {try{await reader.cancel();}catch{}reader.releaseLock();}
    if(offset!==bytes.length||!await verify(bytes.buffer))throw new Error('Проверка целостности модели не пройдена');
    aborted();
    let stored=false;
    try{stored=await cache?.put(descriptor.id,bytes.buffer)===true;}catch{/* Cache is optional; recovery is never cleared to make space. */}
    onCacheResult?.(stored);
    aborted();return bytes.buffer;
  } catch(error) {
    aborted();
    if(controller.signal.aborted)throw new Error('Загрузка модели заняла слишком долго. Проверьте интернет и повторите.');
    throw error;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

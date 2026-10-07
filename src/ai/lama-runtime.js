import { LAMA_ARTIFACTS } from './lama-assets.js';
import { createLamaArtifactCache, loadLamaArtifact } from './asset-cache.js';

// Serialized into an owned Blob worker, after all executable artifacts pass SHA-256.
function lamaWorkerEntry() {
  self.onmessage=async ({data})=>{
    let stage="runtime";
    try {
      // No network requests are permitted from the inference worker.
      self.fetch=()=>Promise.reject(new Error('Inference network access disabled'));
      ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      // file:// has opaque origins: create the module URL in its own worker context.
      const moduleUrl=URL.createObjectURL(new Blob([data.mjs],{type:'text/javascript'}));
      ort.env.wasm.wasmPaths={mjs:moduleUrl};ort.env.wasm.wasmBinary=new Uint8Array(data.wasm);
      self.postMessage({type:'progress',stage:'initialize',message:'Подготовка нейросети на устройстве…'});
      const providers=data.gpu&&self.navigator?.gpu?['webgpu','wasm']:['wasm'];
      stage="session";
      const session=await ort.InferenceSession.create(new Uint8Array(data.model),{executionProviders:providers});
      if(session.inputNames.length!==1||session.inputNames[0]!=='input'||session.outputNames.length!==1||session.outputNames[0]!=='output')throw new Error('Unexpected model contract');
      self.postMessage({type:'progress',stage:'inference',message:'Восстановление фона на устройстве…'});
      const tensor=new ort.Tensor('float32',data.input,[1,4,512,512]);
      stage="inference";
      const result=await session.run({input:tensor});
      const output=result.output;
      if(output.type!=='float32'||output.dims.join(',')!=='1,3,512,512'||output.data.length!==3*512*512)throw new Error('Unexpected model output');
      const values=new Float32Array(output.data);
      await session.release();
      URL.revokeObjectURL(moduleUrl);
      self.postMessage({type:'result',output:values},[values.buffer]);
    } catch(error) {self.postMessage({type:'error',stage,reason:String(error?.message||'').slice(0,300)});}
  };
}

export function createLamaEngine({gpu=()=>true,cache=createLamaArtifactCache(),load=loadLamaArtifact,workerFactory=url=>new Worker(url),artifactList=LAMA_ARTIFACTS,workerEntry=lamaWorkerEntry,makeRequest=null}={}) {
  let active=false,assets=null,preparing=null,stored=false,deleting=false;
  const inferenceDurations=new Map();
  async function prepare({signal,onProgress,cachedOnly=false}={}) {
    if(deleting)throw new Error('Дождитесь удаления нейросети');
    if(assets)return assets;
    if(preparing)return preparing;
    preparing=(async()=>{
      const candidate=[],total=artifactList.reduce((s,a)=>s+a.size,0);let loaded=0,allStored=true;
      for(const descriptor of artifactList){
        candidate.push(await load(descriptor,{signal,cache,cachedOnly,onCacheResult:value=>{allStored=allStored&&value;},onProgress:bytes=>onProgress?.({percent:Math.floor((loaded+bytes)/total*100),loaded:loaded+bytes,total})}));
        loaded+=descriptor.size;if(signal?.aborted)throw new DOMException('Удаление отменено','AbortError');
        onProgress?.({percent:Math.floor(loaded/total*100),loaded,total});
      }
      assets=candidate;stored=allStored;return assets;
    })();
    try{return await preparing;}finally{preparing=null;}
  }
  async function run(input,{signal,onProgress}={}) {
    if(deleting||preparing)throw new Error('Дождитесь завершения работы с моделью');
    if(active)throw new Error('Удаление объекта уже выполняется');
    active=true;let worker;const urls=[];
    const mode=typeof gpu==='function'?gpu():gpu;let inferenceStarted=null;
    const aborted=()=>{if(signal?.aborted)throw new DOMException('Удаление отменено','AbortError');};
    try {
      aborted();
      if(!assets)throw new Error('Сначала установите модель в настройках редактора');
      const [runtime,mjs,wasm,model]=assets;
      const workerUrl=URL.createObjectURL(new Blob([runtime,'\n;(',workerEntry.toString(),')();'],{type:'text/javascript'}));urls.push(workerUrl);
      worker=workerFactory(workerUrl);
      return await new Promise((resolve,reject)=>{
        let done=false;
        const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(value);};
        const abort=()=>finish(null,new DOMException('Удаление отменено','AbortError'));
        const timer=setTimeout(()=>finish(null,new Error('Обработка заняла слишком долго. Попробуйте меньшую область.')),180000);
        signal?.addEventListener('abort',abort,{once:true});
        worker.onerror=event=>{event.preventDefault?.();finish(null,new Error('Не удалось запустить нейросеть в этом браузере'));};
        worker.onmessage=({data})=>{
          if(done)return;
          if(data.type==='progress'){
            if(data.stage==='inference')inferenceStarted=performance.now();
            onProgress?.({stage:data.stage,message:data.message,estimatedSeconds:inferenceDurations.get(mode)});
          }
          else if(data.type==='result'){
            if(inferenceStarted!==null)inferenceDurations.set(mode,Math.max(.5,(performance.now()-inferenceStarted)/1000));
            finish(data.output);
          }
          else if(data.type==='error'){console.warn('LaMa '+data.stage+': '+data.reason);finish(null,new Error('Ошибка нейросети ('+data.stage+'). Используйте актуальный Chrome или Edge и повторите.'));}
        };
        if(signal?.aborted){abort();return;}
        const request=makeRequest?makeRequest(input,assets,mode):{payload:{input,mjs,wasm,model,gpu:mode},transfer:[input.buffer]};
        worker.postMessage(request.payload,request.transfer);
      });
    } finally {worker?.terminate();for(const url of urls)URL.revokeObjectURL(url);active=false;}
  }
  async function remove() {
    if(active||preparing||deleting)throw new Error('Дождитесь завершения обработки или установки нейросети');
    deleting=true;
    try {
      if(await cache.remove()!==true)throw new Error('Браузер не разрешил удалить файлы нейросети. Модель сохранена; попробуйте ещё раз.');
      assets=null;stored=false;inferenceDurations.clear();
    } finally {deleting=false;}
  }
  return {run,prepare,remove,isBusy:()=>Boolean(active||preparing||deleting),isReady:()=>Boolean(assets),isStored:()=>stored};
}

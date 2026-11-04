// 003X/6c-9: opt-in genuine Chrome file:// Blob Worker profile on the exact
// native fixture used by the History A/B run. This is NOT a full UI Worker path,
// and worker.terminate() is NOT evidence of in-kernel cancellation.
export async function verifyBrowserHistoryNativeWorker(client, { evaluate, expectedNativeHash }) {
  const result = await evaluate(client, `(async () => {
    const started=performance.now();
    const input=document.querySelector('#zpe-history-profile-input');
    if(!input?.files?.[0])throw Error('Original .zpe File input missing');
    const doc=JSON.parse(await input.files[0].text());
    const source=doc.layers.find(layer=>layer.highDepthSource)?.highDepthSource;
    if(!source?.tiles?.length || !source.tiles.every(tile=>typeof tile.dataUrl==='string'))
      throw Error('Native source tiles missing');
    const digest=s=>{let hash=2166136261;
      for(const tile of s.tiles)for(let i=0;i<tile.dataUrl.length;i++)
        hash=Math.imul(hash^tile.dataUrl.charCodeAt(i),16777619);
      return hash>>>0;};
    const originalHash=digest(source);
    if(originalHash!==${expectedNativeHash})throw Error('Input native bit fingerprint changed');
    if(typeof globalThis.__zpeTiledInpaintWorkerSource!=='string'){
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script'),timer=setTimeout(()=>reject(Error('Worker supplier timeout')),10000);
        script.onload=()=>{clearTimeout(timer);resolve();};
        script.onerror=()=>{clearTimeout(timer);reject(Error('Worker supplier load failed'));};
        script.src=new URL('./src/core/tiled-inpaint-worker-source.js',document.baseURI).href;
        document.head.append(script);
      });
    }
    const code=globalThis.__zpeTiledInpaintWorkerSource;
    if(typeof code!=='string'||code.length<10000)throw Error('Missing real browser Worker source');
    const blobUrl=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    const selected=Math.floor(source.height/2)*source.width+Math.floor(source.width/2);
    const request=id=>({id,source,selectedIndices:Uint32Array.of(selected),
      halo:2,maxLayerPixels:source.width*source.height});
    async function run(id,terminateAfterDispatch){
      const worker=new Worker(blobUrl);
      let sent=false,lateMessages=0;
      const workerStarted=performance.now();
      try{
        return await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('Native Worker reply timeout')),30000);
          worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message||'Worker error'));};
          worker.onmessageerror=()=>{clearTimeout(timer);reject(Error('Worker messageerror'));};
          worker.onmessage=e=>{
            if(e.data?.ready===true){
              if(sent)return;
              sent=true;
              const dispatch=performance.now();
              worker.postMessage(request(id));
              if(terminateAfterDispatch){
                worker.terminate();
                setTimeout(()=>{clearTimeout(timer);resolve({
                  terminatedAfterDispatch:true,lateMessages,postTerminateObservationMs:performance.now()-dispatch,
                  startMs:dispatch-workerStarted
                });},100);
              }
              return;
            }
            if(terminateAfterDispatch){lateMessages++;return;}
            if(e.data?.id!==id)return;
            clearTimeout(timer);
            const response=e.data;
            resolve({terminatedAfterDispatch:false,ok:response.ok===true,
              filled:response.result?.filled??null,
              changedTiles:response.result?.changedTiles??null,
              sourceChanged:response.result?.source?.tiles?.some((tile,i)=>
                tile.dataUrl!==source.tiles[i]?.dataUrl)??false,
              error:response.error??null,
              roundTripMs:performance.now()-workerStarted});
          };
        });
      } finally {worker.terminate();}
    }
    try{
      const cancelled=await run(911,true);
      if(!cancelled.terminatedAfterDispatch||cancelled.lateMessages!==0)
        throw Error('Terminated Worker produced unexpected reply');
      const completed=await run(912,false);
      if(!completed.ok||completed.filled!==1||completed.changedTiles!==1||
         !completed.sourceChanged)throw Error('Real native Worker computation failed: '+JSON.stringify(completed));
      if(digest(source)!==originalHash)throw Error('Worker mutated original native URLs');
      return {input:'original .zpe File from Chrome file://',kind:source.kind,
        width:source.width,height:source.height,tiles:source.tiles.length,
        nativeHash:originalHash,nativeDataUrlChars:source.tiles.reduce((sum,t)=>sum+t.dataUrl.length,0),
        cancelled,completed,wholeProbeMs:performance.now()-started,
        limitations:'terminate immediately after postMessage (not in-kernel); direct Blob Worker protocol, not UI session; no isolated Worker RSS/peak'};
    } finally {URL.revokeObjectURL(blobUrl);}
  })()`);
  if(!result || result.nativeHash!==expectedNativeHash || result.completed?.ok!==true ||
     result.cancelled?.lateMessages!==0)throw Error('Chrome native Worker profile failed');
  return result;
}

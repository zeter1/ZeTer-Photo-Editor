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
    // The Worker must preserve EVERY untouched native byte, including Float32
    // sNaN payloads, signed zero and selected-pixel alpha. A URL hash of only
    // the input and a count of changed tiles cannot prove this output contract.
    function verifyWorkerOutput(edited) {
      if(!edited || edited.tiles?.length!==source.tiles.length)
        throw Error('Worker output source/tile count mismatch');
      const selectedX=selected%source.width,selectedY=Math.floor(selected/source.width);
      const bytesPerSample=source.bitsPerChannel/8;
      const pixelBytes=source.channels*bytesPerSample;
      let changedColorBytes=0,verifiedRawBytes=0,changedTileIndex=-1;
      for(let index=0;index<source.tiles.length;index++){
        const before=source.tiles[index],after=edited.tiles[index];
        if(!after || before.x!==after.x || before.y!==after.y ||
           before.width!==after.width || before.height!==after.height ||
           before.rawBytes!==after.rawBytes)
          throw Error('Worker changed native tile geometry');
        const containsSelected=selectedX>=before.x && selectedX<before.x+before.width &&
          selectedY>=before.y && selectedY<before.y+before.height;
        if(!containsSelected){
          if(after.dataUrl!==before.dataUrl)throw Error('Worker changed an untouched native tile');
          continue;
        }
        if(changedTileIndex!==-1)throw Error('Selection belongs to multiple tiles');
        changedTileIndex=index;
        const original=atob(before.dataUrl.slice(before.dataUrl.indexOf(',')+1));
        const output=atob(after.dataUrl.slice(after.dataUrl.indexOf(',')+1));
        if(original.length!==before.rawBytes || output.length!==original.length)
          throw Error('Worker changed native tile byte length');
        const pixelStart=((selectedY-before.y)*before.width+selectedX-before.x)*pixelBytes;
        const colorEnd=pixelStart+(source.channels-1)*bytesPerSample;
        for(let byte=0;byte<original.length;byte++){
          if(original.charCodeAt(byte)===output.charCodeAt(byte))continue;
          if(byte<pixelStart || byte>=colorEnd)
            throw Error('Worker changed unselected color or alpha native bits');
          changedColorBytes++;
        }
        verifiedRawBytes+=original.length;
      }
      if(changedTileIndex<0 || changedColorBytes===0)
        throw Error('Worker failed to change exactly one selected native pixel');
      return {changedTileIndex,changedColorBytes,verifiedRawBytes,
        untouchedTilesVerified:source.tiles.length-1};
    }
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
            const roundTripMs=performance.now()-workerStarted;
            let nativeBitOracle=null;
            try {
              if(response.ok===true)nativeBitOracle=verifyWorkerOutput(response.result?.source);
            } catch(error) { reject(error); return; }
            resolve({terminatedAfterDispatch:false,ok:response.ok===true,
              filled:response.result?.filled??null,
              changedTiles:response.result?.changedTiles??null,
              sourceChanged:nativeBitOracle!==null,
              nativeBitOracle,error:response.error??null,roundTripMs});
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

// 003X/6c-9: real file:// UI, history, and IndexedDB restore using public controls.
// No private app bundle scope or stub HistoryStack.
export async function verifyBrowserHistoryUiRecovery(client, { evaluate, fixturePath, expectedNativeHash }) {
  const assert = (value,label) => { if(!value) throw Error('History UI/IDB: '+label); };
  async function waitFor(label,predicate,timeoutMs=45000) {
    const deadline=Date.now()+timeoutMs;
    let lastError=null;
    while(Date.now()<deadline) {
      try { const result=await predicate(); if(result)return result; }
      catch(error) {lastError=error;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('History UI/IDB timeout: '+label+(lastError?': '+lastError.message:''));
  }
  const summary = [
    '(() => ({',
    'name:document.querySelector("#docTabs .doc-tab[aria-selected=true] .doc-tab-title")?.textContent?.trim(),',
    'layers:document.querySelectorAll("#layersList .layer-row").length,',
    'historyLength:document.querySelectorAll("#historyList .history-row").length,',
    'tabs:document.querySelectorAll("#docTabs .doc-tab").length,',
    'undoDisabled:document.querySelector("#undoBtn")?.disabled,',
    'redoDisabled:document.querySelector("#redoBtn")?.disabled',
    '}))()',
  ].join('\n');
  const inspect=()=>evaluate(client,summary);
  const captureHook=[
    '(() => {',
    'if(globalThis.__zpeHistorySaved)return true;',
    'const original=URL.createObjectURL.bind(URL);',
    'globalThis.__zpeHistorySaved=[];',
    'URL.createObjectURL=function(blob){',
    'if(blob instanceof Blob && blob.type==="application/json")',
    'blob.text().then(text=>globalThis.__zpeHistorySaved.push(text));',
    'return original(blob);',
    '};return true;})()',
  ].join('\n');
  function checkDocument(saved,label,expectedLayers) {
    assert(saved&&saved.name==='history-profile',label+': wrong saved name');
    const native=saved.layers.find(layer=>layer.highDepthSource)?.highDepthSource;
    assert(native&&Array.isArray(native.tiles),label+': saved native source missing');
    let hash=2166136261;
    for(const tile of native.tiles)for(let i=0;i<tile.dataUrl.length;i++)
      hash=Math.imul(hash^tile.dataUrl.charCodeAt(i),16777619);
    assert((hash>>>0)===expectedNativeHash,label+': native URL changed');
    assert(saved.layers.length===expectedLayers,label+': incorrect layer count');
    return {name:saved.name,nativeHash:hash>>>0,layers:saved.layers.length};
  }
  async function saveAndCheck(label,expectedLayers) {
    await evaluate(client,captureHook);
    const before=await evaluate(client,'globalThis.__zpeHistorySaved.length');
    await evaluate(client,'window.dispatchEvent(new KeyboardEvent("keydown",{key:"s",code:"KeyS",ctrlKey:true,bubbles:true,cancelable:true}));true');
    const savedText=await waitFor(label+' UI download',()=>evaluate(client,'globalThis.__zpeHistorySaved['+before+'] || null'));
    return checkDocument(JSON.parse(savedText),label,expectedLayers);
  }
  async function importUsingUi() {
    const root=await client.send('DOM.getDocument');
    const input=await client.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#projectInput'});
    assert(input.nodeId,'public .zpe input missing');
    await client.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixturePath]});
    await evaluate(client,'document.querySelector("#projectInput").dispatchEvent(new Event("change",{bubbles:true}));true');
    const state=await waitFor('native project UI import',async()=>{
      const value=await inspect();
      return value.name==='history-profile'&&value.layers===1&&value.historyLength===1&&value;
    });
    return {state,saved:await saveAndCheck('import',1)};
  }
  async function editAndNavigate() {
    const before=await inspect();
    assert(before.layers===1&&before.historyLength===1,'unexpected initial history');
    assert(await evaluate(client,'(() => {const b=document.querySelector("#addRasterBtn");if(!b)return false;b.click();return true;})()'),'Add Raster Layer button missing');
    const edited=await waitFor('real UI commit',async()=>{
      const value=await inspect();return value.layers===2&&value.historyLength===2&&value;
    });
    const editSaved=await saveAndCheck('edit',2);
    await evaluate(client,'document.querySelector("#undoBtn").click();true');
    const undone=await waitFor('real UI Undo',async()=>{
      const value=await inspect();return value.layers===1&&value.historyLength===2&&value;
    });
    const undoSaved=await saveAndCheck('undo',1);
    await evaluate(client,'document.querySelector("#redoBtn").click();true');
    const redone=await waitFor('real UI Redo',async()=>{
      const value=await inspect();return value.layers===2&&value.historyLength===2&&value;
    });
    const redoSaved=await saveAndCheck('redo',2);
    return {edited,undone,redone,editSaved,undoSaved,redoSaved};
  }
  const firstImport=await importUsingUi();
  const firstHistory=await editAndNavigate();
  await evaluate(client,'document.querySelector("#addDocTabBtn").click();true');
  await waitFor('second document tab',async()=>(await inspect()).tabs===2);
  const secondImport=await importUsingUi();
  const secondHistory=await editAndNavigate();
  const readIdb=[
    '(async () => {',
    'const key=sessionStorage.getItem("zeter-photo-editor.recovery-window.v1");',
    'if(!key)return null;',
    'const db=await new Promise((resolve,reject)=>{',
    'const r=indexedDB.open("zeter-photo-editor",1);',
    'r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});',
    'try {',
    'const record=await new Promise((resolve,reject)=>{',
    'const tx=db.transaction("recovery","readonly");',
    'const r=tx.objectStore("recovery").get(key);',
    'r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});',
    'if(!record)return null;',
    'const docs=record.documents.map(item=>{',
    'const d=JSON.parse(item.snapshot),native=d.layers.find(x=>x.highDepthSource)?.highDepthSource;',
    'let hash=2166136261;',
    'if(native?.tiles)for(const tile of native.tiles)',
    'for(let i=0;i<tile.dataUrl.length;i++)hash=Math.imul(hash^tile.dataUrl.charCodeAt(i),16777619);',
    'return {name:d.name,nativeHash:hash>>>0,layers:d.layers.length};',
    '});return {key,activeIndex:record.activeIndex,version:record.version,docs};',
    '} finally {db.close();}',
    '})()',
  ].join('\n');
  const idb=await waitFor('two real dirty tabs persisted in IndexedDB',async()=>{
    const value=await evaluate(client,readIdb);
    return value?.docs?.length===2&&value;
  },30000);
  assert(idb.version===2&&idb.docs.every(item=>
    item.name==='history-profile'&&item.nativeHash===expectedNativeHash&&item.layers===2),
  'IndexedDB two-tab snapshots changed native URLs');
  await client.send('Page.reload',{ignoreCache:true});
  await waitFor('recovery modal after browser reload',()=>
    evaluate(client,'Boolean(document.querySelector("#modalRoot .recovery-modal [data-restore]"))'));
  assert(await evaluate(client,
    '(() => {const b=document.querySelector("#modalRoot .recovery-modal [data-restore]");if(!b)return false;b.click();return true;})()'),
    'public Restore button missing');
  const restored=await waitFor('UI restored two tabs',async()=>{
    const value=await inspect();
    return value.tabs===2&&value.name==='history-profile'&&value.layers===2&&value;
  });
  const restoredSaved=await saveAndCheck('restored active tab',2);
  await evaluate(client,'document.querySelectorAll("#docTabs .doc-tab")[0].click();true');
  const firstRestored=await waitFor('first restored tab',async()=>{
    const value=await inspect();
    return value.name==='history-profile'&&value.layers===2&&value;
  });
  const firstSaved=await saveAndCheck('restored first tab',2);
  return {firstImport,secondImport,firstHistory,secondHistory,idb,
    restored,restoredSaved,firstRestored,firstSaved,
    limitations:'App pooled History only; UI generic comparison and Worker peak/RSS not measured'};
}

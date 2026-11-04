// 003X/6c-9: fresh-process real Chromium file:// History A/B. Not whole-app RSS.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import * as pixels from '../src/core/pixel-buffer.js';
import * as state from '../src/core/state.js';
import { createHistorySharingFixture, historySourceFingerprint, validateHistoryProfileConfig } from './history-sharing-fixture.mjs';
import { verifyBrowserHistoryUiRecovery } from './browser-history-ui-recovery-smoke.mjs';
import { verifyBrowserHistoryNativeWorker } from './browser-history-native-worker-smoke.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const INDEX_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const WIDTH = Number(process.env.ZPE_PROFILE_WIDTH || 1025);
const HEIGHT = Number(process.env.ZPE_PROFILE_HEIGHT || WIDTH);
const REPEATS = Number(process.env.ZPE_PROFILE_REPEATS || 2);
const config = validateHistoryProfileConfig({ width:WIDTH, height:HEIGHT, repeats:REPEATS, sessions:2, positions:4 });

function browserExecutable() {
  const candidates = [process.env.CHROME_BIN];
  if (process.platform === 'win32') for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
    candidates.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe'));
  }
  candidates.push('/usr/bin/google-chrome','/usr/bin/chromium','google-chrome','chromium','chrome.exe','msedge.exe');
  for (const exe of candidates.filter(Boolean)) {
    if (path.isAbsolute(exe) && !existsSync(exe)) continue;
    const probe = spawnSync(exe, ['--version'], { timeout:4000, encoding:'utf8', windowsHide:true });
    if (!probe.error && probe.status === 0) return exe;
  }
  throw new Error('Chromium unavailable: set CHROME_BIN');
}
function waitForDebugger(browser, stderr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('DevTools startup timeout: '+stderr.text.slice(-2000))), 25000);
    function finish(error, url) { clearTimeout(timer); browser.stderr.off('data', onData); browser.off('exit', onExit); error ? reject(error) : resolve(url); }
    function onData(chunk) { stderr.text += String(chunk); const match = stderr.text.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) finish(null, match[1]); }
    function onExit(code) { finish(new Error('Chrome exited before DevTools: '+code)); }
    browser.stderr.on('data', onData); browser.once('exit', onExit);
  });
}class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const packet = JSON.parse(String(event.data));
      const pending = this.pending.get(packet.id);
      if (!pending) return;
      this.pending.delete(packet.id); clearTimeout(pending.timer);
      packet.error ? pending.reject(new Error(pending.method+': '+packet.error.message)) : pending.resolve(packet.result);
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP closed')); }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('CDP connection timeout')), 10000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once:true });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')); }, { once:true });
    });
    return new Cdp(ws);
  }
  send(method, params={}) {
    const id = ++this.id;
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(method+' timed out')); }, 45000);
      this.pending.set(id, {resolve,reject,timer,method});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  close() { this.ws.close(); }
}
async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {expression,awaitPromise:true,returnByValue:true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
async function pageTarget(browserWs) {
  const endpoint = new URL(browserWs), origin = 'http://'+endpoint.hostname+':'+endpoint.port;
  for (let tries=0;tries<100;tries++) {
    const response = await fetch(origin+'/json/list');
    if (response.ok) {
      const targets = await response.json(), target = targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
      if (target) return target.webSocketDebuggerUrl;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('No Chrome page target');
}
function sourceHash(source) {
  let hash=2166136261;
  for (const tile of source.tiles) for(let i=0;i<tile.dataUrl.length;i++) hash=Math.imul(hash^tile.dataUrl.charCodeAt(i),16777619);
  return hash>>>0;
}
// Windows fallback when CDP does not expose per-process privateMemory.
// Exact same-PID census; private committed bytes are NOT physical RSS.
function windowsProcessSample(processes) {
  if(process.platform!=='win32') return {available:false,reason:'not-windows'};
  try {
    const ids=processes?.map(p=>p.id);
    if(!ids?.length || ids.some(id=>!Number.isSafeInteger(id)||id<=0) || new Set(ids).size!==ids.length) {
      throw new Error('invalid Chrome PID census');
    }
    const script='$ErrorActionPreference="Stop";$ids=@('+ids.join(',')+');'+
      '@(Get-Process -Id $ids | ForEach-Object { [pscustomobject]@{'+
      'id=$_.Id;privateBytes=$_.PrivateMemorySize64;workingSetBytes=$_.WorkingSet64;'+
      'startUtc=$_.StartTime.ToUniversalTime().ToString("o")}}) | ConvertTo-Json -Compress';
    const proc=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],
      {encoding:'utf8',timeout:15000,windowsHide:true});
    if(proc.error||proc.status!==0) throw new Error(String(proc.error?.message||proc.stderr||proc.status));
    const rows=JSON.parse(proc.stdout), items=Array.isArray(rows)?rows:[rows];
    if(items.length!==ids.length||items.some(r=>!ids.includes(r.id) ||
       !Number.isSafeInteger(r.privateBytes)||r.privateBytes<0 ||
       !Number.isSafeInteger(r.workingSetBytes)||r.workingSetBytes<0)) {
      throw new Error('Windows OS PID census incomplete');
    }
    return {available:true,privateBytes:items.reduce((s,r)=>s+r.privateBytes,0),
      workingSetSumBytes:items.reduce((s,r)=>s+r.workingSetBytes,0),processes:items};
  } catch(error) { return {available:false,reason:String(error.message)}; }
}
async function runCase({ model, shared, repetition, fixturePath, sourceDigest, snapshotLength, chromium, historySource }) {
  const profileDir = await mkdtemp(path.join(ROOT, '.zpe-history-chrome-'));
  const args = ['--headless=new','--remote-debugging-port=0','--user-data-dir='+profileDir,
    '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',
    '--disable-default-apps','--disable-dev-shm-usage','about:blank'];
  if (process.getuid?.()===0 || (process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true')) args.unshift('--no-sandbox');
  const browser = spawn(chromium,args,{stdio:['ignore','ignore','pipe'],windowsHide:true});
  const stderr={text:''};
  let client, browserClient;
  try {
    const browserWs=await waitForDebugger(browser,stderr);
    browserClient=await Cdp.connect(browserWs);
    client=await Cdp.connect(await pageTarget(browserWs));
    await Promise.all([client.send('Runtime.enable'),client.send('Page.enable'),client.send('HeapProfiler.enable')]);
    const nav=await client.send('Page.navigate',{url:INDEX_URL});
    if (nav.errorText) throw new Error('file:// navigation: '+nav.errorText);
    let ready=false;
    for(let i=0;i<100;i++) {
      ready=await evaluate(client,"document.documentElement?.dataset.appReady === 'true'");
      if (ready) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(ready,'file:// editor did not bootstrap');
    const source=historySource.replace(/^export /gm,'');
    assert.equal(await evaluate(client,'(() => {\n'+source+'\nglobalThis.__ZpeProfileHistory=HistoryStack;return true;})()'),true);
    assert.equal(await evaluate(client,"(() => {const i=document.createElement('input');i.type='file';i.id='zpe-history-profile-input';document.body.appendChild(i);return true;})()"),true);
    const root=await client.send('DOM.getDocument');
    const input=await client.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#zpe-history-profile-input'});
    assert(input.nodeId,'fixture input missing');
    await client.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixturePath]});
    const loaded=await evaluate(client,"(async()=>{globalThis.__zpeProfileInput=await document.querySelector('#zpe-history-profile-input').files[0].text();return __zpeProfileInput.length;})()");
    assert.equal(loaded,snapshotLength,'Chrome read a different real .zpe snapshot');

    async function memory(phase) {
      const start=performance.now();
      await client.send('HeapProfiler.collectGarbage');
      const gcRoundTripMs=performance.now()-start;
      const heap=await client.send('Runtime.getHeapUsage');
      let processes=null, processError=null;
      try {
        const info=await browserClient.send('SystemInfo.getProcessInfo');
        processes=(info.processInfo||[]).map(p=>({id:p.id,type:p.type,privateMemory:p.privateMemory??null}));
      } catch(error) { processError=String(error.message); }
      const privateBytes=processes?.length && processes.every(p=>Number.isSafeInteger(p.privateMemory)&&p.privateMemory>=0)
        ? processes.reduce((sum,p)=>sum+p.privateMemory,0) : null;
      const windowsOs=windowsProcessSample(processes);
      return {phase,gcRoundTripMs,jsHeapUsedBytes:heap.usedSize,jsHeapTotalBytes:heap.totalSize,
        embedderHeapUsedBytes:heap.embedderHeapUsedSize??null,processPrivateBytes:privateBytes,
        processCount:processes?.length??null,processError,windowsOs};
    }
    const baseline=await memory('loaded-fixture-before-history');
    const setup=await evaluate(client,'(() => {\n'+
      'const doc=JSON.parse(globalThis.__zpeProfileInput),sessions=[],pushMs=[];\n'+
      'for(let s=0;s<2;s++){const h=new globalThis.__ZpeProfileHistory(80,128*1048576,{shareNativeDataUrls:'+JSON.stringify(shared)+'});'+
      'for(let i=0;i<4;i++){doc.name="profile-"+s+"-"+i;const snap=JSON.stringify(doc);const t=performance.now();h.push("metadata-"+i,snap);pushMs.push(performance.now()-t);}' +
      'sessions.push(h);}\n'+
      'globalThis.__zpeProfileHistory=sessions;delete globalThis.__zpeProfileInput;'+
      'return {pushMs,owners:sessions.map(h=>({positions:h.entries.length,logicalBytes:h.totalBytes(),pooledBytes:h.pooledNativeDataUrlChars(),nativeChars:h.retainedNativeDataUrlChars()}))};})()');
    assert(setup.owners.every(x=>x.positions===4),'History evicted a required Undo slot');
    const retained=await memory('retained-four-undo-two-sessions');
    const navigation=await evaluate(client,'(() => {\n'+
      'const getDigest=s=>{let h=2166136261;for(const tile of s.tiles)for(let i=0;i<tile.dataUrl.length;i++)h=Math.imul(h^tile.dataUrl.charCodeAt(i),16777619);return h>>>0;};'+
      'const result={getMs:[],parseMs:[],positions:[]};for(const [s,h] of globalThis.__zpeProfileHistory.entries()){'+
      'for(const i of [0,3,1]){const t=performance.now(),text=h.entries[i].snapshot;result.getMs.push(performance.now()-t);'+
      'const t2=performance.now(),doc=JSON.parse(text);result.parseMs.push(performance.now()-t2);'+
      'if(doc.name!=="profile-"+s+"-"+i||getDigest(doc.layers[0].highDepthSource)!=='+sourceDigest+')throw Error("Native URL/history mismatch");}'+
      'if(h.jump(0)===null||h.jump(3)===null||h.undo()===null||h.redo()===null||h.index!==3)throw Error("History navigation regression");'+
      'result.positions.push(h.entries.length); }return result;})()');
    assert.deepEqual(navigation.positions,[4,4]);
    const afterNavigation=await memory('after-native-navigation');
    await evaluate(client,'globalThis.__zpeProfileHistory=null;true');
    const released=await memory('after-history-release');
    const workerBefore = process.env.ZPE_PROFILE_WORKER === '1' && shared && repetition === 0
      ? await memory('before-real-native-worker') : null;
    const nativeWorker = workerBefore
      ? await verifyBrowserHistoryNativeWorker(client, {evaluate,expectedNativeHash:sourceDigest}) : null;
    const workerAfter = workerBefore ? await memory('after-real-native-worker') : null;
    const uiRecovery = process.env.ZPE_PROFILE_UI === '1' && shared && repetition === 0
      ? await verifyBrowserHistoryUiRecovery(client, {
        evaluate, fixturePath, expectedNativeHash:sourceDigest,
      }) : null;
    return { model, shared, repetition, config, sourceDigest, snapshotLength,
      input:'production zpe snapshot and HistoryStack, Chrome file:// fresh process',
      setup, navigation, memory:[baseline,retained,afterNavigation,released],
      nativeWorker,workerMemory:workerBefore?[workerBefore,workerAfter]:null,uiRecovery };
  } finally {
    client?.close(); browserClient?.close(); browser.kill();
    await new Promise(resolve=>{if(browser.exitCode!==null||browser.signalCode!==null)return resolve();
      const timer=setTimeout(resolve,3500);browser.once('exit',()=>{clearTimeout(timer);resolve();});});
    try { await rm(profileDir,{recursive:true,force:true,maxRetries:5,retryDelay:250}); }
    catch(error) { console.warn('Browser temp profile cleanup incomplete:',error.message); }
  }
}async function main() {
  const chromium=browserExecutable();
  const historySource=await readFile(path.join(ROOT,'src/core/history.js'),'utf8');
  const fixtureDir=await mkdtemp(path.join(ROOT,'.zpe-history-fixtures-'));
  const output={ date:new Date().toISOString(), executable:chromium, fileUrl:INDEX_URL,
    config, method:'fresh Chrome process per sample; alternated baseline/pool; CDP forced GC and Runtime.getHeapUsage',
    limitations:['JS heap is not whole Chrome RAM/RSS','CDP collectGarbage round trip is not exclusive GC time',
      process.env.ZPE_PROFILE_UI === '1'
        ? 'UI import/Undo/Redo/IndexedDB restore probed only in pooled app History; not UI generic A/B'
        : 'Node-generated genuine snapshot loaded via real browser File API; UI document/IDB restore not tested',
      process.env.ZPE_PROFILE_WORKER === '1'
        ? 'Native original-file source run through actual Blob Worker in pooled sample 0; immediate terminate is not kernel cancel; Worker PID/RSS/peak unmeasured'
        : 'Real native Worker sample requires ZPE_PROFILE_WORKER=1',
      'Chromium privateMemory may be unavailable; Windows per-PID private commit is not physical RSS',
      'Chrome CDP process census does not establish Worker PID attribution; sum of working sets double-counts shared pages'],
    cases:[] };
  try {
    for(const model of ['rgb','cmyk']) {
      const fixture=createHistorySharingFixture({...pixels,...state},{model,width:WIDTH,height:HEIGHT});
      const snapshot=state.snapshotDocument(fixture.doc);
      const parsed=JSON.parse(snapshot), digest=sourceHash(parsed.layers[0].highDepthSource);
      assert.deepEqual(historySourceFingerprint({...pixels,...state},parsed.layers[0].highDepthSource),
        historySourceFingerprint({...pixels,...state},fixture.source));
      const fixturePath=path.join(fixtureDir,'history-'+model+'.zpe');
      await writeFile(fixturePath,snapshot,'utf8');
      for(let repetition=0;repetition<REPEATS;repetition++) {
        const order=repetition%2===0?[false,true]:[true,false];
        for(const shared of order) {
          const item=await runCase({model,shared,repetition,fixturePath,sourceDigest:digest,
            snapshotLength:snapshot.length,chromium,historySource});
          output.cases.push(item);
          console.log(JSON.stringify({model,shared,repetition,
            usedMiB:+(item.memory[1].jsHeapUsedBytes/1048576).toFixed(2),
            getMs:+(item.navigation.getMs.reduce((a,b)=>a+b,0)/item.navigation.getMs.length).toFixed(2)}));
        }
      }
    }
    assert.equal(output.cases.length,REPEATS*4);
    const out=path.join(ROOT,process.env.ZPE_PROFILE_OUTPUT ||
      (process.env.ZPE_PROFILE_WORKER === '1'
        ? 'task/evidence/003x6c9-native-worker-chrome.json'
        : process.env.ZPE_PROFILE_UI === '1'
          ? 'task/evidence/003x6c9-real-ui-idb.json'
          : 'task/evidence/003x6c9-chrome-history-ab.json'));
    await writeFile(out,JSON.stringify(output,null,2)+'\n','utf8');
    console.log('CHROME_HISTORY_AB_PASS '+out);
  } finally { await rm(fixtureDir,{recursive:true,force:true,maxRetries:5,retryDelay:250}); }
}
main().catch(error=>{console.error('CHROME_HISTORY_AB_FAIL',error.stack||error);process.exitCode=1;});

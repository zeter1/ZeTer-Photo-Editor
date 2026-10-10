import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_URL = process.env.ZPE_SMOKE_URL || pathToFileURL(path.join(ROOT, 'index.html')).href;
const POLL_MS = 50;
const CONDITION_TIMEOUT_MS = 8_000;
// Hosted runners occasionally need more than 10s to expose the DevTools endpoint even when Chrome starts normally.
const DEVTOOLS_TIMEOUT_MS = 20_000;

function fail(message, details = '') {
  const error = new Error(details ? `${message}\n${details}` : message);
  error.name = 'BrowserSmokeError';
  throw error;
}

function commandWorks(candidate) {
  if (!candidate) return false;
  if (path.isAbsolute(candidate) && !existsSync(candidate)) return false;
  const result = spawnSync(candidate, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 4_000,
  });
  return !result.error && result.status === 0;
}

function browserCandidates() {
  const candidates = [process.env.CHROME_BIN].filter(Boolean);
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      candidates.push(
        path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(base, 'Chromium', 'Application', 'chrome.exe'),
        path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      );
    }
    candidates.push('chrome.exe', 'msedge.exe');
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'google-chrome',
      'chromium',
      'chromium-browser',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
    );
  }
  return [...new Set(candidates)];
}

function findBrowser() {
  for (const candidate of browserCandidates()) {
    if (commandWorks(candidate)) return candidate;
  }
  fail('Chrome/Chromium browser not found', 'Set CHROME_BIN to a Chromium-based browser executable.');
}

function waitForDevTools(browser, stderrState) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for DevTools endpoint.\n${stderrState.text.slice(-4_000)}`));
    }, DEVTOOLS_TIMEOUT_MS);

    const onData = chunk => {
      stderrState.text += chunk.toString();
      if (stderrState.text.length > 20_000) stderrState.text = stderrState.text.slice(-20_000);
      const match = stderrState.text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      cleanup();
      resolve(match[1]);
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Browser exited before DevTools was ready (code=${code}, signal=${signal}).\n${stderrState.text.slice(-4_000)}`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      browser.stderr.off('data', onData);
      browser.off('exit', onExit);
    };

    browser.stderr.on('data', onData);
    browser.once('exit', onExit);
  });
}

async function waitFor(label, predicate, timeoutMs = CONDITION_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  fail(`Timed out waiting for ${label}`, lastError?.stack || lastError?.message || '');
}

async function waitForPageTarget(browserWs) {
  const endpoint = new URL(browserWs);
  const origin = `http://${endpoint.hostname}:${endpoint.port}`;
  return waitFor('page target', async () => {
    const response = await fetch(`${origin}/json/list`);
    if (!response.ok) return null;
    const targets = await response.json();
    return targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl) || null;
  });
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Set();
    ws.addEventListener('message', event => this.#onMessage(event));
    ws.addEventListener('close', () => {
      for (const request of this.pending.values()) request.reject(new Error('DevTools WebSocket closed'));
      this.pending.clear();
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to DevTools WebSocket')), 5_000);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      ws.addEventListener('error', event => {
        clearTimeout(timer);
        reject(event.error || new Error('DevTools WebSocket error'));
      }, { once: true });
    });
    return new CdpClient(ws);
  }

  #onMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result);
      return;
    }
    for (const handler of this.eventHandlers) handler(message.method, message.params || {});
  }

  onEvent(handler) {
    this.eventHandlers.add(handler);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for DevTools response: ${method}`));
      }, 8_000);
      this.pending.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

function exceptionText(details = {}) {
  return details.exception?.description || details.text || 'Unknown runtime exception';
}

function consoleText(args = []) {
  return args.map(arg => arg.value ?? arg.description ?? arg.type).join(' ');
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (response.exceptionDetails) fail('Browser evaluation failed', exceptionText(response.exceptionDetails));
  return response.result?.value;
}

function assert(condition, message, details = '') {
  if (!condition) fail(message, details);
}

function assertNoBrowserErrors(errors, stderrState) {
  if (!errors.length) return;
  fail('Browser reported runtime errors', `${errors.join('\n')}\n\nBrowser stderr tail:\n${stderrState.text.slice(-3_000)}`);
}


async function verifyRecoveryIndexedDb(client) {
  // Real production storage + controller sources inside the file:// Chromium page.
  // The fixture's session ports are synthetic; IndexedDB transactions are not.
  const sources = await Promise.all([
    readFile(path.join(ROOT, 'src/core/recovery.js'), 'utf8'),
    readFile(path.join(ROOT, 'src/workspace/recovery-controller.js'), 'utf8'),
  ]);
  const storageSource = sources[0].replace(/^export /gm, '');
  const recoverySource = sources.map(source => source.replace(/^export /gm, '')).join('\n');
  async function browserRecoveryProbe() {
    const key = 'workspace:zpe-smoke-recovery-current';
    const foreignKey = 'workspace:zpe-smoke-recovery-foreign';
    const initialSnapshot = name => [{ name, snapshot: JSON.stringify({ name }) }];
    await saveRecoverySnapshot(initialSnapshot('До отказа'), { activeIndex:0 }, { key });
    await saveRecoverySnapshot(initialSnapshot('Соседний документ'), { activeIndex:0 }, { key:foreignKey });

    const originalTransaction = IDBDatabase.prototype.transaction;
    let abortNext = true;
    let writes = 0;
    const warnings = [];
    let currentTime = 100_000;
    const documentState = { name:'Первая несохранённая правка' };
    IDBDatabase.prototype.transaction = function(storeNames, mode, ...rest) {
      const transaction = originalTransaction.call(this, storeNames, mode, ...rest);
      if (this.name === 'zeter-photo-editor' && mode === 'readwrite') {
        writes += 1;
        if (abortNext) {
          abortNext = false;
          queueMicrotask(() => transaction.abort());
        }
      }
      return transaction;
    };
    try {
      const controller = createRecoveryController({
        storage: { save:saveRecoverySnapshot, loadAll:loadRecoverySnapshots, clear:clearRecoverySnapshot },
        projects: { snapshot:doc => JSON.stringify({ name:doc.name }), sanitize:doc => doc },
        sessions: {
          getAll:() => [{ id:'smoke-session', dirty:true, doc:documentState }],
          replaceAll:() => {}, getActiveId:() => 'smoke-session',
          setActiveId:() => {}, syncCurrent:() => {}, build:() => ({}), load:() => {},
        },
        ui: { toast:(message, type) => warnings.push({ message, type }) },
        createKey:() => key, now:() => currentTime, consoleRef: { warn:() => {} },
      });
      controller.queueRecovery({ immediate:true });
      await controller.whenIdle();
      const afterAbort = (await loadRecoverySnapshots()).find(item => item.key === key)?.record;
      const unavailable = !controller.isStorageAvailable();
      const afterAbortName = JSON.parse(afterAbort.documents[0].snapshot).name;
      documentState.name = 'Правка до cooldown';
      controller.queueRecovery({ immediate:true });
      await controller.whenIdle();
      const noEarlyRetry = writes === 1;
      currentTime += RECOVERY_RETRY_COOLDOWN_MS + 1;
      await new Promise(resolve => setTimeout(resolve, 60));
      const noBackgroundRetry = writes === 1;
      documentState.name = 'После восстановления записи';
      controller.queueRecovery({ immediate:true });
      await controller.whenIdle();
      const afterRetry = await loadRecoverySnapshots();
      const current = afterRetry.find(item => item.key === key)?.record;
      const foreign = afterRetry.find(item => item.key === foreignKey)?.record;
      return {
        unavailable, afterAbortName, noEarlyRetry, noBackgroundRetry,
        availableAgain:controller.isStorageAvailable(), writes,
        savedName:JSON.parse(current.documents[0].snapshot).name,
        foreignName:JSON.parse(foreign.documents[0].snapshot).name, warnings,
      };
    } finally {
      IDBDatabase.prototype.transaction = originalTransaction;
    }
  }
  console.log('Recovery IndexedDB browser probe: transaction abort and retry');
  const initial = await evaluate(client, '(async () => {\n' + recoverySource + '\nreturn (' + browserRecoveryProbe.toString() + ')();\n})()');
  assert(initial.unavailable && initial.afterAbortName === 'До отказа',
    'Aborted IndexedDB transaction must preserve previous recovery record', JSON.stringify(initial));
  assert(initial.noEarlyRetry && initial.noBackgroundRetry && initial.writes === 2,
    'Recovery must await a new dirty event after cooldown without an automatic retry loop', JSON.stringify(initial));
  assert(initial.availableAgain && initial.savedName === 'После восстановления записи',
    'Authorized dirty change must replace recovery after cooldown', JSON.stringify(initial));
  assert(initial.foreignName === 'Соседний документ' && initial.warnings.filter(item => item.type === 'warn').length === 1,
    'Abort must preserve other window key and warn only once', JSON.stringify(initial));

  console.log('Recovery IndexedDB browser probe: retry passed; checking reload');
  let sawPageLoad = false;
  let reloadDialogError = null;
  client.onEvent((method, params) => {
    if (method === 'Page.loadEventFired') sawPageLoad = true;
    if (method === 'Page.javascriptDialogOpening' && params.type === 'beforeunload') {
      client.send('Page.handleJavaScriptDialog', { accept:true }).catch(error => { reloadDialogError = error; });
    }
  });
  // Unlike Runtime.evaluate(location.reload()), Page.reload does not await a
  // promise in a JS execution context that is about to be destroyed.
  await client.send('Page.reload', { ignoreCache:true });
  await waitFor('recovery IndexedDB fixture reload', () => {
    if (reloadDialogError) throw reloadDialogError;
    return sawPageLoad;
  });
  async function browserRecoveryReadbackProbe() {
    const entries = await loadRecoverySnapshots();
    const current = entries.find(item => item.key === 'workspace:zpe-smoke-recovery-current')?.record;
    const foreign = entries.find(item => item.key === 'workspace:zpe-smoke-recovery-foreign')?.record;
    const currentName = current && JSON.parse(current.documents[0].snapshot).name;
    const foreignName = foreign && JSON.parse(foreign.documents[0].snapshot).name;
    await clearRecoverySnapshot({ key:'workspace:zpe-smoke-recovery-current' });
    await clearRecoverySnapshot({ key:'workspace:zpe-smoke-recovery-foreign' });
    return { currentName, foreignName };
  }
  const persisted = await evaluate(client, '(async () => {\n' + storageSource + '\nreturn (' + browserRecoveryReadbackProbe.toString() + ')();\n})()');
  assert(persisted.currentName === 'После восстановления записи' && persisted.foreignName === 'Соседний документ',
    'Recovery and separate window key must survive file:// reload', JSON.stringify(persisted));
}

const editControlStateExpression = `(() => {
  const ids = ['blendMode','layerOpacity','renameLayerBtn','duplicateLayerBtn','deleteLayerBtn','layerUpBtn','layerDownBtn','resetColorEffectsBtn'];
  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.disabled ?? null]));
})()`;

const layerMenuStateExpression = `(() => {
  const layerButton = document.querySelector('.menu-button[data-menu="layer"]');
  layerButton?.click();
  return Object.fromEntries([...document.querySelectorAll('#menuPopover .menu-item')].map(button => [
    button.querySelector('span')?.textContent || '',
    button.disabled,
  ]));
})()`;

async function runSmoke() {
  const browserExecutable = findBrowser();
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'zpe-browser-smoke-'));
  const stderrState = { text: '' };
  const browserArgs = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    'about:blank',
  ];
  const runningInGithubActionsLinux = process.platform === 'linux' && process.env.GITHUB_ACTIONS === 'true';
  if (process.getuid?.() === 0 || runningInGithubActionsLinux) browserArgs.unshift('--no-sandbox');

  const browser = spawn(browserExecutable, browserArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  const errors = [];
  let client = null;

  try {
    const browserWs = await waitForDevTools(browser, stderrState);
    const target = await waitForPageTarget(browserWs);
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    client.onEvent((method, params) => {
      if (method === 'Runtime.exceptionThrown') errors.push(`exception: ${exceptionText(params.exceptionDetails)}`);
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') errors.push(`console.error: ${consoleText(params.args)}`);
    });

    await Promise.all([
      client.send('Runtime.enable'),
      client.send('Page.enable'),
    ]);
    const navigation = await client.send('Page.navigate', { url: INDEX_URL });
    if (navigation.errorText) fail('Browser could not open the editor', `${navigation.errorText}: ${INDEX_URL}`);

    const bootstrapState = await waitFor('editor bootstrap', async () => {
      if (errors.length) return 'runtime-error';
      return evaluate(client, `(() => {
        const state=document.documentElement?.dataset.appReady;
        return state === 'true' || state === 'error' ? state : '';
      })()`);
    });
    if (bootstrapState === 'runtime-error') {
      fail('Editor runtime failed before bootstrap', `${errors.join('\n')}\n\nBrowser stderr tail:\n${stderrState.text.slice(-3_000)}`);
    }
    if (bootstrapState === 'error') {
      const fatalText = await evaluate(client, `document.querySelector('.fatal-error')?.textContent || 'Unknown bootstrap failure'`);
      fail('Editor bootstrap failed', `${fatalText}\n${errors.join('\n')}\n\nBrowser stderr tail:\n${stderrState.text.slice(-3_000)}`);
    }
    assertNoBrowserErrors(errors, stderrState);

    const blobWorkerProbe = await evaluate(client, `(async () => {
      if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL?.createObjectURL !== 'function') {
        return { supported:false, ok:false, error:'Worker/Blob API unavailable' };
      }
      const url=URL.createObjectURL(new Blob(['self.onmessage=e=>self.postMessage(e.data+1)'],{type:'text/javascript'}));
      try {
        const value=await new Promise((resolve,reject)=>{
          const worker=new Worker(url);
          const timer=setTimeout(()=>{worker.terminate();reject(new Error('blob worker timeout'));},3000);
          worker.onmessage=e=>{clearTimeout(timer);worker.terminate();resolve(e.data);};
          worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message||'blob worker error'));};
          worker.postMessage(41);
        });
        return { supported:true, ok:value===42, value };
      } catch (error) {
        return { supported:true, ok:false, error:String(error && (error.stack || error.message) || error) };
      } finally {
        URL.revokeObjectURL(url);
      }
    })()`);
    assert(blobWorkerProbe.supported && blobWorkerProbe.ok, 'Blob Worker must work from the real file:// editor', JSON.stringify(blobWorkerProbe));

    // Stage 003: verify real detached tiled compute, not only a trivial Blob
    // Worker. The supplier is a classic file:// script; the Worker itself has
    // no file:// imports, dynamic fetch or module loader dependency.
    const tiledWorkerProbe = await evaluate(client, `(async () => {
      let worker=null, url=null;
      try {
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          const timer=setTimeout(()=>reject(new Error('Worker supplier script timed out')),5000);
          script.onload=()=>{clearTimeout(timer);resolve();};
          script.onerror=()=>{clearTimeout(timer);reject(new Error('Worker supplier script failed to load'));};
          script.src=new URL('./src/core/tiled-inpaint-worker-source.js',document.baseURI).href;
          document.head.append(script);
        });
        const code=globalThis.__zpeTiledInpaintWorkerSource;
        if(typeof code!=='string'||code.length<10000)throw new Error('Missing classic Worker source');
        const w=8,h=8,raw=new Uint8Array(w*h*4);
        for(let i=0;i<w*h;i++)raw.set([20,40,60,255],i*4);
        raw.set([250,0,0,255],(4*w+4)*4);
        const dataUrl='data:application/x-zeter-pixel-buffer-tile;base64,'+btoa(String.fromCharCode(...raw));
        const source={
          kind:'zpe-pixel-buffer-source-v2',width:w,height:h,model:'rgb',
          channels:4,bitsPerChannel:8,colorSpace:'srgb',alphaMode:'straight',
          profileName:'',rawBytes:raw.byteLength,tileSize:w,
          tiles:[{x:0,y:0,width:w,height:h,rawBytes:raw.byteLength,dataUrl}],
        };
        url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
        worker=new Worker(url);
        const reply=await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Tiled Worker compute timed out')),6000);
          worker.onmessage=event=>{
            if(event.data?.ready===true){
              worker.postMessage({id:17,source,selectedIndices:Uint32Array.of(4*w+4),halo:2,maxLayerPixels:128});
              return;
            }
            if(event.data?.id!==17)return;
            clearTimeout(timer);
            resolve(event.data);
          };
          worker.onerror=event=>{clearTimeout(timer);reject(new Error(event.message||'Tiled Worker startup error'));};
          worker.onmessageerror=()=>{clearTimeout(timer);reject(new Error('Tiled Worker messageerror'));};
        });
        return {ok:reply.ok===true&&reply.result?.filled===1&&reply.result?.changedTiles===1
          &&reply.result?.source?.tiles?.[0]?.dataUrl!==dataUrl,
          filled:reply.result?.filled,changedTiles:reply.result?.changedTiles,
          error:reply.error};
      }catch(error){
        return {ok:false,error:String(error?.message||error)};
      }finally{
        worker?.terminate();
        if(url)URL.revokeObjectURL(url);
      }
    })()`);
    assert(tiledWorkerProbe.ok, 'Real CMYK/RGB tiled compute must work inside file:// Blob Worker', JSON.stringify(tiledWorkerProbe));


    const initial = await evaluate(client, `(() => ({
      title: document.title,
      rows: document.querySelectorAll('.layer-row').length,
      controls: ${editControlStateExpression}
    }))()`);
    assert(initial.title.includes('ZeTer Photo Editor'), 'Unexpected document title', JSON.stringify(initial));
    assert(initial.rows === 0, 'Fresh profile should start without layer rows', JSON.stringify(initial));
    assert(Object.values(initial.controls).every(value => value === true), 'Layer edit controls must be disabled when no layer is selected', JSON.stringify(initial.controls));

    const learningInitial = await evaluate(client, `(() => {
      localStorage.removeItem('zeter-photo-editor.learning-center.v1');
      const help=document.querySelector('.menu-button[data-menu="help"]');
      help?.click();
      const item=[...document.querySelectorAll('#menuPopover .menu-item')].find(button=>button.querySelector('span')?.textContent==='Центр обучения');
      item?.click();
      const modal=document.querySelector('.learning-center-modal');
      return {
        title:modal?.getAttribute('aria-label')||'',
        lessons:modal?.querySelectorAll('[data-learning-lesson-id]').length||0,
        progress:modal?.querySelector('[data-learning-progress-text]')?.textContent||'',
        practice:modal?.querySelector('[data-learning-practice-progress]')?.textContent||'',
        quizzes:modal?.querySelector('[data-learning-quiz-progress]')?.textContent||'',
        practiceSteps:modal?.querySelectorAll('[data-learning-checklist="practice"]').length||0,
        quizQuestions:modal?.querySelectorAll('[data-learning-quiz-question]').length||0,
        completeDisabled:Boolean(modal?.querySelector('[data-learning-action="toggle-complete"]')?.disabled),
        focused:document.activeElement?.dataset?.learningAction||'',
      };
    })()`);
    assert(learningInitial.title === 'Центр обучения', 'Learning Center must open from Help', JSON.stringify(learningInitial));
    assert(learningInitial.lessons === 10, 'Learning Center must expose the full 10-lesson curriculum', JSON.stringify(learningInitial));
    assert(learningInitial.progress.includes('0 / 10'), 'Fresh Learning Center progress must start at zero', JSON.stringify(learningInitial));
    assert(learningInitial.practice.startsWith('0/'), 'Fresh Learning Center practice evidence must start at zero', JSON.stringify(learningInitial));
    assert(learningInitial.quizzes === '0/10', 'Fresh Learning Center quiz evidence must start at zero', JSON.stringify(learningInitial));
    assert(learningInitial.practiceSteps === 4 && learningInitial.quizQuestions === 2, 'First lesson must expose real practice and a knowledge check', JSON.stringify(learningInitial));
    assert(learningInitial.completeDisabled, 'Lesson credit must be gated until practice, mastery and quiz are complete', JSON.stringify(learningInitial));
    assert(learningInitial.focused === 'continue', 'Learning Center should focus its primary continue action', JSON.stringify(learningInitial));

    const learningMastered = await evaluate(client, `(() => {
      for(let index=0;index<4;index+=1){
        const input=document.querySelector('[data-learning-checklist="practice"][data-learning-index="'+index+'"]');
        if(!input)return {error:'practice-'+index};
        input.click();
      }
      for(let index=0;index<3;index+=1){
        const input=document.querySelector('[data-learning-checklist="mastery"][data-learning-index="'+index+'"]');
        if(!input)return {error:'mastery-'+index};
        input.click();
      }
      const q0=document.querySelector('[data-learning-quiz-question="0"] input[data-learning-answer-index="1"]');
      const q1=document.querySelector('[data-learning-quiz-question="1"] input[data-learning-answer-index="0"]');
      if(!q0||!q1)return {error:'quiz-options'};
      q0.click();
      q1.click();
      document.querySelector('[data-learning-action="check-quiz"]')?.click();
      const completion=document.querySelector('[data-learning-action="toggle-complete"]');
      const readyDisabled=Boolean(completion?.disabled);
      const quizPassed=Boolean(document.querySelector('.learning-quiz-passed'));
      completion?.click();
      const modal=document.querySelector('.learning-center-modal');
      return {
        readyDisabled,
        quizPassed,
        progress:modal?.querySelector('[data-learning-progress-text]')?.textContent||'',
        practice:modal?.querySelector('[data-learning-practice-progress]')?.textContent||'',
        quizzes:modal?.querySelector('[data-learning-quiz-progress]')?.textContent||'',
        stored:JSON.parse(localStorage.getItem('zeter-photo-editor.learning-center.v1')||'null'),
      };
    })()`);
    assert(!learningMastered.error, 'Learning Center mastery scenario must reach every checkpoint', JSON.stringify(learningMastered));
    assert(!learningMastered.readyDisabled && learningMastered.quizPassed, 'Practice + mastery + correct knowledge check must unlock lesson credit', JSON.stringify(learningMastered));
    assert(learningMastered.progress.includes('1 / 10'), 'Mastering a lesson must update Learning Center progress', JSON.stringify(learningMastered));
    assert(learningMastered.practice.startsWith('4/'), 'Hands-on practice evidence must be persisted', JSON.stringify(learningMastered));
    assert(learningMastered.quizzes === '1/10', 'Knowledge-check pass must be persisted', JSON.stringify(learningMastered));
    assert(learningMastered.stored?.version === 2, 'Learning Center must persist the v2 evidence schema', JSON.stringify(learningMastered));
    assert(learningMastered.stored?.completed?.includes('start'), 'Learning Center completion must persist locally', JSON.stringify(learningMastered));
    assert(learningMastered.stored?.practice?.start?.length === 4, 'Learning Center practice checklist must persist locally', JSON.stringify(learningMastered));
    assert(learningMastered.stored?.mastery?.start?.length === 3, 'Learning Center mastery checklist must persist locally', JSON.stringify(learningMastered));
    assert(learningMastered.stored?.quizPassed?.includes('start'), 'Learning Center quiz pass must persist locally', JSON.stringify(learningMastered));

    const learningRestored = await evaluate(client, `(() => {
      document.querySelector('.learning-center-modal [data-close]')?.click();
      const help=document.querySelector('.menu-button[data-menu="help"]');
      help?.click();
      const item=[...document.querySelectorAll('#menuPopover .menu-item')].find(button=>button.querySelector('span')?.textContent==='Центр обучения');
      item?.click();
      const modal=document.querySelector('.learning-center-modal');
      const progress=modal?.querySelector('[data-learning-progress-text]')?.textContent||'';
      const quizzes=modal?.querySelector('[data-learning-quiz-progress]')?.textContent||'';
      const firstLessonComplete=Boolean(modal?.querySelector('[data-learning-lesson-id="start"]')?.classList.contains('is-complete'));
      modal?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      const focusReturned=document.activeElement===help;
      localStorage.removeItem('zeter-photo-editor.learning-center.v1');
      return {progress,quizzes,firstLessonComplete,closed:!document.querySelector('.learning-center-modal'),focusReturned};
    })()`);
    assert(learningRestored.progress.includes('1 / 10'), 'Learning Center progress must survive close/reopen', JSON.stringify(learningRestored));
    assert(learningRestored.quizzes === '1/10' && learningRestored.firstLessonComplete, 'Learning evidence must survive close/reopen', JSON.stringify(learningRestored));
    assert(learningRestored.closed, 'Escape must close the Learning Center', JSON.stringify(learningRestored));
    assert(learningRestored.focusReturned, 'Closing Learning Center must restore focus to Help', JSON.stringify(learningRestored));
    assertNoBrowserErrors(errors, stderrState);
    await client.send('Emulation.setDeviceMetricsOverride', { width:1280, height:900, deviceScaleFactor:1, mobile:false });
    await waitFor('desktop two-column toolbar', async () => evaluate(client, `getComputedStyle(document.querySelector('.toolbar')).gridTemplateColumns.trim().split(/\\s+/).length === 2`));
    const toolbarBefore = await evaluate(client, `[...document.querySelectorAll('.toolbar .tool')].map(button => button.dataset.tool)`);
    assert(toolbarBefore.length > 3, 'Toolbar must expose draggable tools', JSON.stringify(toolbarBefore));
    const dragResult = await evaluate(client, `(() => {
      const toolbar=document.querySelector('.toolbar');
      const tools=[...toolbar.querySelectorAll('.tool')];
      const source=tools.at(-1);
      const first=tools[0].getBoundingClientRect();
      const second=tools[1].getBoundingClientRect();
      const gapWidth=Math.max(0,second.left-first.right);
      const gapX=first.right+gapWidth*0.75;
      const gapY=first.top+first.height/2;
      const dt=new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:source.getBoundingClientRect().left+4,clientY:source.getBoundingClientRect().top+4}));
      toolbar.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:gapX,clientY:gapY}));
      toolbar.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:gapX,clientY:gapY}));
      source.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:gapX,clientY:gapY}));
      return {
        gapWidth,
        source:source.dataset.tool,
        order:[...toolbar.querySelectorAll('.tool')].map(button=>button.dataset.tool),
        saved:JSON.parse(localStorage.getItem('zeter-photo-editor.tool-order.v1')||'null'),
      };
    })()`);
    const expectedDraggedOrder = [toolbarBefore[0], toolbarBefore.at(-1), ...toolbarBefore.slice(1, -1)];
    assert(dragResult.gapWidth > 0, 'Desktop toolbar regression requires a measurable gap between grid cells', JSON.stringify(dragResult));
    assert(JSON.stringify(dragResult.order) === JSON.stringify(expectedDraggedOrder), 'Dropping into a toolbar gap must place the tool in that exact grid slot', JSON.stringify({toolbarBefore,dragResult,expectedDraggedOrder}));
    assert(JSON.stringify(dragResult.saved) === JSON.stringify(expectedDraggedOrder), 'Drag/drop toolbar order must persist immediately', JSON.stringify(dragResult));
    await evaluate(client, `document.documentElement.dataset.appReady='reloading'; location.reload(); true`);
    await waitFor('persisted dragged toolbar order after reload', async () => evaluate(client, `document.documentElement?.dataset.appReady === 'true'
      && JSON.stringify([...document.querySelectorAll('.toolbar .tool')].map(button => button.dataset.tool)) === ${JSON.stringify(JSON.stringify(expectedDraggedOrder))}`));
    assertNoBrowserErrors(errors, stderrState);

    const layoutState = await evaluate(client, `(() => {
      const panel=document.querySelector('[data-panel-id="history"]');
      const toggle=panel?.querySelector(':scope > header .panel-toggle');
      toggle?.click();
      const stored=JSON.parse(localStorage.getItem('zeter-photo-editor.ui-collapse.v1')||'{}');
      return { collapsed:Boolean(panel?.classList.contains('is-collapsed')), expanded:toggle?.getAttribute('aria-expanded'), stored:stored.panels||[] };
    })()`);
    assert(layoutState.collapsed && layoutState.expanded === 'false', 'Sidebar panel collapse must update DOM and aria-expanded', JSON.stringify(layoutState));
    assert(layoutState.stored.includes('history'), 'Sidebar panel collapse must persist in localStorage', JSON.stringify(layoutState));
    await evaluate(client, `document.documentElement.dataset.appReady='reloading'; location.reload(); true`);
    await waitFor('persisted collapsed panel after reload', async () => evaluate(client, `document.documentElement?.dataset.appReady === 'true' && document.querySelector('[data-panel-id="history"]')?.classList.contains('is-collapsed')`));
    await evaluate(client, `document.querySelector('[data-panel-id="history"] .panel-toggle')?.click(); true`);
    const canvasMode = await evaluate(client, `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',code:'Tab',bubbles:true,cancelable:true}));
      return { hidden:document.querySelector('.workspace')?.classList.contains('panels-hidden'), toolbarHidden:document.querySelector('.toolbar')?.getAttribute('aria-hidden'), rightHidden:document.querySelector('.right-panel')?.getAttribute('aria-hidden') };
    })()`);
    assert(canvasMode.hidden && canvasMode.toolbarHidden === 'true' && canvasMode.rightHidden === 'true', 'Canvas mode must hide both editor chrome panels', JSON.stringify(canvasMode));
    await evaluate(client, `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',code:'Tab',bubbles:true,cancelable:true})); true`);
    await waitFor('canvas mode restores panels', async () => evaluate(client, `!document.querySelector('.workspace')?.classList.contains('panels-hidden')`));
    assertNoBrowserErrors(errors, stderrState);

    await evaluate(client, `document.querySelector('#addRasterBtn').click(); true`);
    await waitFor('new raster layer', async () => evaluate(client, `document.querySelectorAll('.layer-row').length === 1 && Boolean(document.querySelector('.layer-row.selected'))`));

    const unlocked = await evaluate(client, editControlStateExpression);
    assert(Object.values(unlocked).every(value => value === false), 'Editable layer controls must be enabled for an unlocked selected layer', JSON.stringify(unlocked));

    await evaluate(client, `document.querySelector('.layer-row.selected .layer-lock').click(); true`);
    await waitFor('locked layer controls', async () => evaluate(client, `Object.values(${editControlStateExpression}).every(Boolean)`));

    const lockedMenu = await evaluate(client, layerMenuStateExpression);
    assert(lockedMenu['Переименовать слой'] === true, 'Rename menu item must be disabled for a locked layer', JSON.stringify(lockedMenu));
    assert(lockedMenu['Дублировать слой'] === true, 'Duplicate menu item must be disabled for a locked layer', JSON.stringify(lockedMenu));
    assert(lockedMenu['Удалить слой'] === true, 'Delete menu item must be disabled for a locked layer', JSON.stringify(lockedMenu));
    assert(lockedMenu['Поднять слой'] === true, 'Move-up menu item must be disabled for a locked layer', JSON.stringify(lockedMenu));
    assert(lockedMenu['Опустить слой'] === true, 'Move-down menu item must be disabled for a locked layer', JSON.stringify(lockedMenu));
    assert(lockedMenu['Показать / скрыть слой'] === false, 'Visibility must remain available for a locked layer', JSON.stringify(lockedMenu));
    assert(lockedMenu['Заблокировать / разблокировать'] === false, 'Own lock toggle must remain available for a directly locked layer', JSON.stringify(lockedMenu));

    await evaluate(client, `document.querySelector('.menu-button[data-menu="layer"]').click(); document.querySelector('.layer-row.selected .layer-lock').click(); true`);
    await waitFor('unlocked layer controls', async () => evaluate(client, `Object.values(${editControlStateExpression}).every(value => value === false)`));

    const finalState = await evaluate(client, `(() => ({
      lockLabel: document.querySelector('.layer-row.selected .layer-lock')?.getAttribute('aria-label'),
      controls: ${editControlStateExpression}
    }))()`);
    assert(finalState.lockLabel === 'Заблокировать', 'Layer lock button should return to unlocked state', JSON.stringify(finalState));
    assertNoBrowserErrors(errors, stderrState);

    // Exercise the new tool through real mouse input on a known-color raster.
    const removalPoint = await evaluate(client, `(() => {
      const c=document.querySelector('#editorCanvas'), r=c.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2,px:Math.floor(c.width/2),py:Math.floor(c.height/2)};
    })()`);
    const removalPixelExpression = `Array.from(document.querySelector('#editorCanvas').getContext('2d').getImageData(${removalPoint.px},${removalPoint.py},1,1).data)`;
    const mouse = (type) => client.send('Input.dispatchMouseEvent', {
      type, x:removalPoint.x, y:removalPoint.y, button:'left', buttons:type==='mousePressed'?1:0, clickCount:1,
    });
    await evaluate(client, `document.querySelector('#primaryColor').value='#285078'; document.querySelector('[data-tool="fill"]').click(); true`);
    await mouse('mousePressed'); await mouse('mouseReleased');
    await waitFor('solid raster fill', async () => evaluate(client, `${removalPixelExpression}.join(',')==='40,80,120,255'`));
    await evaluate(client, `document.querySelector('#primaryColor').value='#ed2828'; document.querySelector('#brushSize').value='24'; document.querySelector('[data-tool="brush"]').click(); true`);
    await mouse('mousePressed');
    await waitFor('red object brush preview', async () => evaluate(client, `${removalPixelExpression}.join(',')==='237,40,40,255'`));
    await mouse('mouseReleased');
    await waitFor('object stroke committed', async () => evaluate(client, `document.querySelector('#statusText').textContent==='Готово'`));
    await evaluate(client, `document.querySelector('#brushSize').value='48'; document.querySelector('[data-tool="remove-object"]').click(); true`);
    assert(await evaluate(client, `document.querySelector('#removeObjectApply').hidden`), 'Removal action stays hidden before a mask is painted');
    await mouse('mousePressed'); await mouse('mouseReleased');
    await waitFor('removal action above brush', async () => evaluate(client, `!document.querySelector('#removeObjectApply').hidden && !document.querySelector('#removeObjectApply').disabled`));
    assert(await evaluate(client, `${removalPixelExpression}.join(',')==='237,40,40,255'`), 'Painting the mask must not change source pixels');
    await evaluate(client, `document.querySelector('#removeObjectApply').click(); true`);
    await waitFor('model installation guidance', async () => evaluate(client, `document.querySelector('#editorSettings').open && document.querySelector('#modelStatus').textContent.includes('Не установлена')`));
    assert(await evaluate(client, `${removalPixelExpression}.join(',')==='237,40,40,255'`), 'Missing model must preserve the source');
    assert(await evaluate(client, `document.querySelector('#modelInstall').textContent==='Установить нейросеть' && !document.querySelector('#modelInstall').disabled`), 'Settings explains and offers explicit model installation');
    await evaluate(client, `document.querySelector('#settingsClose').click(); document.querySelector('#removeObjectReset').click(); true`);
    assert(await evaluate(client, `document.querySelector('#removeObjectApply').hidden`), 'Reset removes only the mask');
    assertNoBrowserErrors(errors, stderrState);

    await new Promise(resolve => setTimeout(resolve, 1_800)); // Let editor autosave quiesce.
    await verifyRecoveryIndexedDb(client);
    assertNoBrowserErrors(errors, stderrState);

    console.log(`Browser smoke passed: ${browserExecutable}`);
    console.log(`Verified file URL: ${INDEX_URL}`);
  } finally {
    try { client?.close(); } catch {}
    if (browser.exitCode === null && !browser.killed) browser.kill('SIGTERM');
    await new Promise(resolve => {
      if (browser.exitCode !== null) return resolve();
      const timer = setTimeout(() => {
        if (browser.exitCode === null && !browser.killed) browser.kill('SIGKILL');
        resolve();
      }, 2_000);
      browser.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
}

runSmoke().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

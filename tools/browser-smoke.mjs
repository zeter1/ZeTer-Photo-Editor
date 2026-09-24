import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_URL = process.env.ZPE_SMOKE_URL || pathToFileURL(path.join(ROOT, 'index.html')).href;
const POLL_MS = 50;
const CONDITION_TIMEOUT_MS = 8_000;
const DEVTOOLS_TIMEOUT_MS = 10_000;

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
  if (process.getuid?.() === 0) browserArgs.unshift('--no-sandbox');

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

    await waitFor('editor bootstrap', async () => evaluate(client, `document.documentElement?.dataset.appReady === 'true'`));
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

    const initial = await evaluate(client, `(() => ({
      title: document.title,
      rows: document.querySelectorAll('.layer-row').length,
      controls: ${editControlStateExpression}
    }))()`);
    assert(initial.title.includes('ZeTer Photo Editor'), 'Unexpected document title', JSON.stringify(initial));
    assert(initial.rows === 0, 'Fresh profile should start without layer rows', JSON.stringify(initial));
    assert(Object.values(initial.controls).every(value => value === true), 'Layer edit controls must be disabled when no layer is selected', JSON.stringify(initial.controls));

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

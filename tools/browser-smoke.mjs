import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
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
  const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 4_000 });
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
      'google-chrome', 'chromium', 'chromium-browser',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
      'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    );
  }
  return [...new Set(candidates)];
}

function findBrowser() {
  for (const candidate of browserCandidates()) if (commandWorks(candidate)) return candidate;
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
      for (const { reject } of this.pending.values()) reject(new Error('DevTools WebSocket closed'));
      this.pending.clear();
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to DevTools WebSocket')), 5_000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener('error', event => { clearTimeout(timer); reject(event.error || new Error('DevTools WebSocket error')); }, { once: true });
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

  onEvent(handler) { this.eventHandlers.add(handler); }

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

  close() { this.ws.close(); }
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

async function runSmoke() {
  const browserExecutable = findBrowser();
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'zpe-browser-smoke-'));
  const stderrState = { text: '' };
  const browserArgs = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-default-apps', '--disable-dev-shm-usage', 'about:blank',
  ];
  if (process.getuid?.() === 0) browserArgs.unshift('--no-sandbox');

  const browser = spawn(browserExecutable, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let client = null;
  const errors = [];

  try {
    const browserWs = await waitForDevTools(browser, stderrState);
    const target = await waitForPageTarget(browserWs);
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    client.onEvent((method, params) => {
      if (method === 'Runtime.exceptionThrown') errors.push(`exception: ${exceptionText(params.exceptionDetails)}`);
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') errors.push(`console.error: ${consoleText(params.args)}`);
      if (method === 'Log.entryAdded' && params.entry?.level === 'error') errors.push(`log.error: ${params.entry.text}`);
    });
    await Promise.all([client.send('Runtime.enable'), client.send('Page.enable'), client.send('Log.enable')]);
    await client.send('Page.navigate', { url: INDEX_URL });

    await waitFor('editor startup', async () => evaluate(client, `document.readyState === 'complete' && Boolean(document.querySelector('#app')) && Boolean(document.querySelector('#layersList'))`));
    assertNoBrowserErrors(errors, stderrState);

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
    await waitFor('locked layer UI state', async () => evaluate(client, `document.querySelectorx œ¹±…å•ÈµÉ½Ü¹Í•±•Ñ•€¹±…å•Èµ±½¬œ¤ü¹Ñ•áÑ½¹Ñ•¹Ð¹¥¹±Õ‘•Ì ŸÂ~RHœ¤€˜˜‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ‰±•¹‘5½‘”œ¤¹‘¥Í…‰±•‘€¤¤ì(€€€½¹ÍÐ±½­•€ô…Ý…¥Ð•Ù…±Õ…Ñ”¡±¥•¹Ð°€  ¤€ôø€¡ì(€€€€€½¹ÑÉ½±Ìè€‘í•‘¥Ñ½¹ÑÉ½±MÑ…Ñ•áÁÉ•ÍÍ¥½¹ô°(€€€€€•å•¥Í…‰±•è‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹±…å•ÈµÉ½Ü¹Í•±•Ñ•€¹±…å•Èµ•å”œ¤ü¹‘¥Í…‰±•€üü¹Õ±°°(€€€€€±½­¥Í…‰±•è‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹±…å•ÈµÉ½Ü¹Í•±•Ñ•€¹±…å•Èµ±½¬œ¤ü¹‘¥Í…‰±•€üü¹Õ±°°(€€€€€…‘‘I…ÍÑ•É¥Í…‰±•è‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ…‘‘I…ÍÑ•É	Ñ¸œ¤ü¹‘¥Í…‰±•€üü¹Õ±°°(€€€€€…‘‘É½ÕÁ¥Í…‰±•è‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ…‘‘É½ÕÁ	Ñ¸œ¤ü¹‘¥Í…‰±•€üü¹Õ±°(€€€ô¤¤ ¥€¤ì(€€€…ÍÍ•ÉÐ¡=‰©•Ð¹Ù…±Õ•Ì¡±½­•¹½¹ÑÉ½±Ì¤¹•Ù•Éä¡Ù…±Õ”€ôøÙ…±Õ”€ôôôÑÉÕ”¤°€1½­•±…å•È•‘¥Ð½¹ÑÉ½±ÌµÕÍÐ‰”‘¥Í…‰±•œ°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•¤¤ì(€€€…ÍÍ•ÉÐ¡±½­•¹•å•¥Í…‰±•€ôôô™…±Í”°€1…å•ÈÙ¥Í¥‰¥±¥ÑäµÕÍÐÍÑ…ä…Ù…¥±…‰±”Ý¡¥±”Ñ¡”±…å•È¥Ì±½­•œ°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•¤¤ì(€€€…ÍÍ•ÉÐ¡±½­•¹±½­¥Í…‰±•€ôôô™…±Í”°€¥É•Ñ±ä±½­•±…å•ÈµÕÍÐÍÑ¥±°…±±½ÜÕ¹±½­¥¹œœ°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•¤¤ì(€€€…ÍÍ•ÉÐ¡±½­•¹…‘‘I…ÍÑ•É¥Í…‰±•€ôôô™…±Í”€˜˜±½­•¹…‘‘É½ÕÁ¥Í…‰±•€ôôô™…±Í”°€É•…Ñ¥¹œ„¹•Ü±…å•È½É½ÕÀµÕÍÐÍÑ…ä…Ù…¥±…‰±”Ý¡¥±”Ñ¡”Í•±•Ñ•±…å•È¥Ì±½­•œ°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•¤¤ì((€€€…Ý…¥Ð•Ù…±Õ…Ñ”¡±¥•¹Ð°‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹µ•¹Ôµ‰ÕÑÑ½¹m‘…Ñ„µµ•¹Ôô‰±…å•È‰tœ¤¹±¥¬ ¤ìÑÉÕ•€¤ì(€€€½¹ÍÐ±½­•‘5•¹Ô€ô…Ý…¥Ð•Ù…±Õ…Ñ”¡±¥•¹Ð°€  ¤€ôø=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡l¸¸¹‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° œµ•¹ÕA½Á½Ù•È€¹µ•¹Ôµ¥Ñ•´œ¥t¹µ…À¡‰ÕÑÑ½¸€ôøm‰ÕÑÑ½¸¹ÅÕ•ÉåM•±•Ñ½È ÍÁ…¸œ¤ü¹Ñ•áÑ½¹Ñ•¹Ð°‰ÕÑÑ½¸¹‘¥Í…‰±•‘t¤¤¤ ¥€¤ì(€€€™½È€¡½¹ÍÐ±…‰•°½˜lŸBB×FB×BãBóB×B÷BûBËBÃFF0ƒFBïBûBäœ°ŸBSFBÇBïBãFBûBËBÃFF0ƒFBïBûBäœ°ŸBBÓBÃBïBãFF0ƒFBïBûBäœ°ŸBƒBÃFFB×FBãBßBûBËBÃFF0ƒFBïBûBäœ°ŸB›B×B÷FFBãFBûBËBÃFF0ƒFBïBûBäƒB÷BÀƒFBûBïFFBÔœ°ŸBKBÿBãFBÃFF0ƒFBïBûBäƒBÈƒFBûBïFFœ°ŸBBûBÓB÷F?FF0ƒFBïBûBäœ°ŸB{BÿFFFBãFF0ƒFBïBûBät¤ì(€€€€€…ÍÍ•ÉÐ¡±½­•‘5•¹Õm±…‰•±t€ôôôÑÉÕ”°1½­•±…å•Èµ•¹Ô¥Ñ•´µÕÍÐ‰”‘¥Í…‰±•è€‘í±…‰•±õ€°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•‘5•¹Ô¤¤ì(€€€ô(€€€…ÍÍ•ÉÐ¡±½­•‘5•¹ÕlŸBBûBëBÃBßBÃFF0€¼ƒFBëFF/FF0ƒFBïBûBät€ôôô™…±Í”°€Y¥Í¥‰¥±¥Ñäµ•¹Ô¥Ñ•´µÕÍÐÍÑ…ä•¹…‰±•™½È„±½­•±…å•Èœ°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•‘5•¹Ô¤¤ì(€€€…ÍÍ•ÉÐ¡±½­•‘5•¹ÕlŸB_BÃBÇBïBûBëBãFBûBËBÃFF0€¼ƒFBÃBßBÇBïBûBëBãFBûBËBÃFF0t€ôôô™…±Í”°€¥É•Ñ±ä±½­•±…å•ÈµÕÍÐ…±±½ÜÕ¹±½­¥¹œ™É½´Ñ¡”µ•¹Ôœ°)M=8¹ÍÑÉ¥¹¥™ä¡±½­•‘5•¹Ô¤¤ì((€€€…Ý…¥Ð•Ù…±Õ…Ñ”¡±¥•¹Ð°‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹µ•¹Ôµ‰ÕÑÑ½¹m‘…Ñ„µµ•¹Ôô‰±…å•È‰tœ¤¹±¥¬ ¤ì‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹±…å•ÈµÉ½Ü¹Í•±•Ñ•€¹±…å•Èµ±½¬œ¤¹±¥¬ ¤ìÑÉÕ•€¤ì(€€€…Ý…¥ÐÝ…¥Ñ½È Õ¹±½­•±…å•ÈU$ÍÑ…Ñ”œ°…Íå¹Œ€ ¤€ôø•Ù…±Õ…Ñ”¡±¥•¹Ð°€…‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹±…å•ÈµÉ½Ü¹Í•±•Ñ•€¹±…å•Èµ±½¬œ¤ü¹Ñ•áÑ½¹Ñ•¹Ð¹¥¹±Õ‘•Ì ŸÂ~RHœ¤€˜˜€…‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È œ‰±•¹‘5½‘”œ¤¹‘¥Í…‰±•‘€¤¤ì(€€€½¹ÍÐÕ¹±½­•‘…¥¸€ô…Ý…¥Ð•Ù…±Õ…Ñ”¡±¥•¹Ð°•‘¥Ñ½¹ÑÉ½±MÑ…Ñ•áÁÉ•ÍÍ¥½¸¤ì(€€€…ÍÍ•ÉÐ¡=‰©•Ð¹Ù…±Õ•Ì¡Õ¹±½­•‘…¥¸¤¹•Ù•Éä¡Ù…±Õ”€ôøÙ…±Õ”€ôôô™…±Í”¤°€1…å•È•‘¥Ð½¹ÑÉ½±ÌµÕÍÐÉ”µ•¹…‰±”…™Ñ•ÈÕ¹±½­¥¹œœ°)M=8¹ÍÑÉ¥¹¥™ä¡Õ¹±½­•‘…¥¸¤¤ì((€€€…ÍÍ•ÉÑ9½	É½ÝÍ•ÉÉÉ½ÉÌ¡•ÉÉ½ÉÌ°ÍÑ‘•ÉÉMÑ…Ñ”¤ì(€€€½¹Í½±”¹±½œ¡‰É½ÝÍ•ÈÍµ½­”AMLè€‘í‰É½ÝÍ•Éá•ÕÑ…‰±•õ€¤ì(€€€½¹Í½±”¹±½œ Ù•É¥™¥•è™¥±”è¼¼ÍÑ…ÉÑÕÀ°±½¬½Õ¹±½¬=4ÍÑ…Ñ”°±½­•±…å•Èµ•¹ÔÕ…É‘Ì°¹¼ÉÕ¹Ñ¥µ”½¹Í½±”½•á•ÁÑ¥½¸•ÉÉ½ÉÌœ¤ì(€ô™¥¹…±±äì(€€€ÑÉäì±¥•¹Ðü¹±½Í” ¤ìô…Ñ íô(€€€¥˜€ …‰É½ÝÍ•È¹­¥±±•¤‰É½ÝÍ•È¹­¥±° M%QI4œ¤ì(€€€…Ý…¥Ð¹•ÜAÉ½µ¥Í”¡É•Í½±Ù”€ôøì(€€€€€¥˜€¡‰É½ÝÍ•È¹•á¥Ñ½‘”€„ôô¹Õ±°¤É•ÑÕÉ¸É•Í½±Ù” ¤ì(€€€€€½¹ÍÐÑ¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøìÑÉäì‰É½ÝÍ•È¹­¥±° M%-%10œ¤ìô…Ñ íôÉ•Í½±Ù” ¤ìô°€É|ÀÀÀ¤ì(€€€€€‰É½ÝÍ•È¹½¹” •á¥Ðœ°€ ¤€ôøì±•…ÉQ¥µ•½ÕÐ¡Ñ¥µ•È¤ìÉ•Í½±Ù” ¤ìô¤ì(€€€ô¤ì(€€€…Ý…¥ÐÉ´¡ÁÉ½™¥±•¥È°ìÉ•ÕÉÍ¥Ù”èÑÉÕ”°™½É”èÑÉÕ”ô¤ì(€ô)ô()ÉÕ¹Mµ½­” ¤¹…Ñ ¡•ÉÉ½È€ôøì(€½¹Í½±”¹•ÉÉ½È¡•ÉÉ½È¹ÍÑ…¬ñð•ÉÉ½È¹µ•ÍÍ…”ñð•ÉÉ½È¤ì(€ÁÉ½•ÍÌ¹•á¥Ñ½‘”€ô€Äì)ô¤ì(
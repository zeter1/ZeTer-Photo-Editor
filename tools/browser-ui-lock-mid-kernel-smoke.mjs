import { createBrowserHighDepthFixture } from './browser-high-depth-fixtures.mjs';
import { createBrowserRendererHeapSampler } from './browser-renderer-heap-sampler.mjs';
import { instrumentBrowserKernelSource } from './browser-inpaint-mid-kernel-smoke.mjs';

/**
 * 010D, test-only. Reload so the application's lazy Worker controller has NOT
 * cached its supplier. The real editor UI then imports a ZeTer-generated PSD16,
 * starts native tiled fill and locks the live layer after a real kernel write.
 * The instrumentation only changes the in-memory classic Worker supplier in
 * this terminal browser-smoke phase; neither production assets nor app code
 * are patched. Sampled browser memory is not a true peak or isolated Worker RSS.
 */
export async function verifyBrowserUiLockMidKernel(client, {
  evaluate, waitFor, assert, browserClient = null,
} = {}) {
  const fixture = createBrowserHighDepthFixture('rgb16large');
  const sampler = createBrowserRendererHeapSampler(client, { processClient:browserClient });
  // All earlier UI tests are complete before this final, isolated reload.
  await client.send('Page.reload', { ignoreCache:true });
  await waitFor('010D editor reload', () => evaluate(client,
    "document.readyState==='complete' && !!document.querySelector('#fileInput') && !!document.querySelector('#editorCanvas')"), 15_000);
  await sampler.start();
  let stopped = false;
  try {
    const metadata = {
      filename:fixture.filename, defectX:fixture.defectX, defectY:fixture.defectY,
      width:fixture.width, height:fixture.height, damaged:fixture.damaged,
    };
    await evaluate(client, 'window.__zpe010dParts=[];window.__zpe010dMeta=' + JSON.stringify(metadata) + ';true');
    const encoded = Buffer.from(fixture.bytes).toString('base64');
    for (let offset = 0; offset < encoded.length; offset += 192 * 1024) {
      await evaluate(client, '(() => {const data=atob(' + JSON.stringify(encoded.slice(offset, offset + 192 * 1024)) +
        ');window.__zpe010dParts.push(Uint8Array.from(data,c=>c.charCodeAt(0)));return true;})()');
    }
    function dispatchPsd() {
      const transfer = new DataTransfer();
      const parts = window.__zpe010dParts;
      const count = parts.reduce((sum, part) => sum + part.byteLength, 0);
      transfer.items.add(new File(parts, window.__zpe010dMeta.filename, {
        type:'image/vnd.adobe.photoshop',
      }));
      const input = document.querySelector('#fileInput');
      input.files = transfer.files;
      const filename = input.files[0]?.name;
      delete window.__zpe010dParts;
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      try { input.dispatchEvent(new Event('change', { bubbles:true })); }
      finally { window.confirm = originalConfirm; }
      return { filename, count };
    }
    const dispatched = await evaluate(client, '(' + dispatchPsd.toString() + ')()');
    assert(dispatched.filename === fixture.filename && dispatched.count === fixture.bytes.length,
      '010D real PSD16 file input must receive every byte', JSON.stringify(dispatched));
    function imported() {
      const f = window.__zpe010dMeta, canvas = document.querySelector('#editorCanvas');
      return canvas.width === f.width && canvas.height === f.height &&
        document.querySelector('.layer-row.selected .layer-lock') &&
        document.querySelector('#statusText')?.textContent?.startsWith('PSD/PSB импортирован');
    }
    function defectPixel() {
      const f = window.__zpe010dMeta;
      return document.querySelector('#editorCanvas').getContext('2d')
        .getImageData(f.defectX,f.defectY,1,1).data[0];
    }
    await waitFor('010D real PSD16 import', () => evaluate(client,'(' + imported.toString() + ')()'), 45_000);
    await waitFor('010D native defect preview', () => evaluate(client,'(' + defectPixel.toString() + ')() > 100'), 30_000);
    await sampler.snapshot('010d-imported-psd16');

    // Save Project is the public export boundary for checking exact 16-bit
    // sample bytes; do not read mutable private application state.
    async function readNativeSave() {
      const old = URL.createObjectURL;
      let blob = null;
      URL.createObjectURL = function(value,...args) {
        if (value instanceof Blob && value.type === 'application/json') blob = value;
        return old.call(URL,value,...args);
      };
      try {
        document.querySelector('.menu-button[data-menu="file"]').click();
        const save = [...document.querySelectorAll('#menuPopover .menu-item')]
          .find(item => item.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
        if (!save || save.disabled) return { error:'Save Project is disabled' };
        save.click();
        if (!blob) return { error:'Missing native project blob' };
        const project = JSON.parse(await blob.text());
        const source = project.layers.find(layer => layer.name === 'Stage 003 native layer')?.highDepthSource;
        if (!source) return { error:'Missing native source' };
        const f = window.__zpe010dMeta;
        const tile = source.tiles.find(t => f.defectX >= t.x && f.defectY >= t.y &&
          f.defectX < t.x + t.width && f.defectY < t.y + t.height);
        if (!tile) return { error:'Missing defect tile' };
        const bytes = Uint8Array.from(atob(tile.dataUrl.split(',')[1]), c => c.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        const offset = ((f.defectY - tile.y) * tile.width + f.defectX - tile.x) * 8;
        return { kind:source.kind, rawBytes:source.rawBytes, tiles:source.tiles.length,
          damaged:Array.from({length:4},(_,i)=>view.getUint16(offset+i*2,true)) };
      } finally { URL.createObjectURL = old; }
    }
    const before = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(before.kind === 'zpe-pixel-buffer-source-v2' &&
      before.rawBytes === fixture.width*fixture.height*8 && before.tiles > 1 &&
      JSON.stringify(before.damaged) === JSON.stringify(fixture.damaged),
      '010D preflight must preserve native PSD16 v2 samples', JSON.stringify(before));

    function setupMarquee() {
      const f = window.__zpe010dMeta;
      const zoom = document.querySelector('#zoomRange');
      zoom.value = '50'; zoom.dispatchEvent(new Event('input', { bubbles:true }));
      document.querySelector('[data-tool="marquee"]').click();
      const type = document.querySelector('#selectionType');
      type.value = 'rect'; type.dispatchEvent(new Event('change', { bubbles:true }));
      document.querySelector('#canvasShell').scrollIntoView({block:'center',inline:'center'});
      const viewport = document.querySelector('#stageViewport');
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth)/2;
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight)/2;
      const rect = document.querySelector('#editorCanvas').getBoundingClientRect();
      const point = (x,y) => ({x:rect.left + rect.width*x/f.width,
        y:rect.top + rect.height*y/f.height});
      const start = point(f.defectX-12,f.defectY-12);
      const end = point(f.defectX+12,f.defectY+12);
      const center = point(f.defectX,f.defectY);
      const top = document.elementFromPoint(center.x,center.y);
      return { start,end,hit:top?.id,topElement:top?.outerHTML?.slice(0,500),
        dialogs:[...document.querySelectorAll('[role="dialog"], dialog[open], #modalRoot > *')]
          .filter(el=>el.getBoundingClientRect().width > 0)
          .map(el=>el.outerHTML.slice(0,300)),
        visible:start.x>0 && start.y>0 && end.x<innerWidth && end.y<innerHeight };
    }
    const view = await evaluate(client,'(' + setupMarquee.toString() + ')()');
    assert(view.visible && view.hit === 'overlayCanvas',
      '010D marquee must target the actual UI overlay', JSON.stringify(view));
    const mouse = (type,p,buttons) => client.send('Input.dispatchMouseEvent',{
      type,x:p.x,y:p.y,button:'left',buttons,clickCount:1,
    });
    await mouse('mouseMoved',view.start,0);
    await mouse('mousePressed',view.start,1);
    await mouse('mouseMoved',view.end,1);
    await mouse('mouseReleased',view.end,0);

    async function installProbe() {
      const name = '__zpeTiledInpaintWorkerSource';
      if (typeof globalThis[name] !== 'string') {
        const script = document.createElement('script');
        script.src = new URL('./src/core/tiled-inpaint-worker-source.js', document.baseURI).href;
        await new Promise((resolve,reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('010D supplier script unavailable'));
          document.head.appendChild(script);
        });
        script.remove();
      }
      const descriptor = Object.getOwnPropertyDescriptor(globalThis,name);
      if (typeof descriptor?.value !== 'string' || !descriptor.configurable) {
        throw new Error('010D generated Worker supplier unavailable or immutable');
      }
      Object.defineProperty(globalThis,name,{
        configurable:true,value:instrumentBrowserKernelSource(descriptor.value),
      });
      const post = Worker.prototype.postMessage;
      const terminate = Worker.prototype.terminate;
      const state = { jobs:0, probes:0, terminations:0, firstWriteSample:null,
        probeAt:null, firstTerminationAt:null };
      window.__zpe010d = state;
      Worker.prototype.postMessage = function(value,...args) {
        if (value?.selectedIndices instanceof Uint32Array &&
            value?.source?.kind === 'zpe-pixel-buffer-source-v2') {
          state.jobs += 1;
          this.addEventListener('message',event=>{
            if (event.data?.probe === 'zpe-test-native-kernel-write') {
              state.probes += 1;
              state.firstWriteSample ??= event.data.changedSample;
              state.probeAt ??= performance.now();
            }
          });
        }
        return post.call(this,value,...args);
      };
      Worker.prototype.terminate = function(...args) {
        state.terminations += 1;
        state.firstTerminationAt ??= performance.now();
        return terminate.apply(this,args);
      };
      window.__zpe010dRestore = () => {
        Worker.prototype.postMessage = post;
        Worker.prototype.terminate = terminate;
        Object.defineProperty(globalThis,name,descriptor);
        delete window.__zpe010dRestore;
      };
      return true;
    }
    const probeSource = instrumentBrowserKernelSource.toString();
    await evaluate(client, '(async () => {\n' + probeSource + '\nreturn (' + installProbe.toString() + ')();\n})()');

    function startFill() {
      document.querySelector('.menu-button[data-menu="edit"]').click();
      const item = [...document.querySelectorAll('#menuPopover .menu-item')]
        .find(x=>x.querySelector('span')?.textContent==='Контент-заливка выделения');
      const enabled = Boolean(item && !item.disabled);
      if (enabled) item.click();
      return enabled;
    }
    assert(await evaluate(client,'(' + startFill.toString() + ')()'),
      '010D menu must allow fill before layer lock');
    await waitFor('010D first true kernel pixel write', () => evaluate(client,
      'window.__zpe010d?.probes===1 && window.__zpe010d?.jobs===1'), 30_000);
    const first = await evaluate(client,'({ ...window.__zpe010d })');
    assert(first.firstWriteSample < 59_000 && first.terminations === 0,
      '010D must observe native synthesis before revocation', JSON.stringify(first));
    await sampler.snapshot('010d-kernel-write');
    const lockStarted = Date.now();
    await evaluate(client,"document.querySelector('.layer-row.selected .layer-lock').click();true");
    await waitFor('010D CPU-bound Worker stopped by UI layer lock', () => evaluate(client,
      'window.__zpe010d?.terminations>=1'), 4_500);
    const lockLatencyMs = Date.now() - lockStarted;
    await sampler.snapshot('010d-after-stale-worker');
    const locked = await evaluate(client,'(() => ({state:{...window.__zpe010d},' +
      'pixel:(' + defectPixel.toString() + ')(),' +
      'history:[...document.querySelectorAll("#historyList .history-row")].map(r=>r.textContent),' +
      'lockLabel:document.querySelector(".layer-row.selected .layer-lock")?.getAttribute("aria-label")}))()');
    assert(locked.state.terminations===1 && locked.state.jobs===1 &&
      locked.state.firstTerminationAt-locked.state.probeAt < 6000 &&
      locked.pixel>100 && locked.lockLabel === 'Разблокировать' &&
      locked.history.every(value=>!value.includes('Контент-заливка')),
      '010D stale UI lock must stop CPU-bound Worker without pixels or History',JSON.stringify(locked));
    const afterCancel = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(JSON.stringify(afterCancel) === JSON.stringify(before),
      '010D layer lock must preserve native 16-bit samples and tile topology',
      JSON.stringify({before,afterCancel}));

    await evaluate(client,"document.querySelector('.layer-row.selected .layer-lock').click();true");
    assert(await evaluate(client,'(' + startFill.toString() + ')()'),
      '010D unlocked successor command must be enabled');
    await waitFor('010D successor real Worker and visible preview', () => evaluate(client,
      'window.__zpe010d?.jobs===2 && (' + defectPixel.toString() + ')() < 150'), 60_000);
    const recovered = await evaluate(client,'(() => ({state:{...window.__zpe010d},' +
      'pixel:(' + defectPixel.toString() + ')(),' +
      'history:[...document.querySelectorAll("#historyList .history-row")].map(r=>r.textContent)}))()');
    assert(recovered.state.jobs===2 && recovered.state.probes===2 &&
      recovered.state.terminations===2 && recovered.pixel<150 &&
      recovered.history.filter(value=>value.includes('Контент-заливка')).length===1,
      '010D successor must publish exactly one visible edit and History entry',JSON.stringify(recovered));
    const afterRecovery = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(afterRecovery.kind === before.kind && afterRecovery.tiles === before.tiles &&
      JSON.stringify(afterRecovery.damaged) !== JSON.stringify(before.damaged),
      '010D successor must change real 16-bit native samples',JSON.stringify(afterRecovery));
    await sampler.snapshot('010d-successor-committed');
    const memory = await sampler.stop(); stopped=true;
    console.log('Stage 003 010D real PSD16 UI mid-kernel layer-lock:',JSON.stringify({
      source:'ZeTer-generated, NOT independent Adobe reference',
      realWorkerJobs:recovered.state.jobs, kernelWriteProbes:recovered.state.probes,
      terminations:recovered.state.terminations, lockLatencyMs,
      unchangedNativeAfterLock:true, recoveredHistoryEntries:1,
      memory:{type:'sampled renderer JS heap and optional all-process private memory; not peak RSS',...memory},
    }));
    return { ok:true, lockLatencyMs, recovered:true };
  } finally {
    if (!stopped) await sampler.stop().catch(()=>{});
    await evaluate(client,'window.__zpe010dRestore?.();delete window.__zpe010dMeta;true').catch(()=>{});
  }
}

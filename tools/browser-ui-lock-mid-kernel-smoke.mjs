import { createBrowserHighDepthFixture } from './browser-high-depth-fixtures.mjs';
import { createBrowserRendererHeapSampler } from './browser-renderer-heap-sampler.mjs';
import { instrumentBrowserKernelSource } from './browser-inpaint-mid-kernel-smoke.mjs';

/**
 * 010D, test-only. Reload so the application's lazy Worker controller has NOT
 * cached its supplier. The real editor UI then imports a ZeTer-generated
 * high-depth PSD16/PSB32, starts native tiled fill and switches to another tab
 * after a real kernel write.
 * The instrumentation only changes the in-memory classic Worker supplier in
 * this terminal browser-smoke phase; neither production assets nor app code
 * are patched. Sampled browser memory is not a true peak or isolated Worker RSS.
 */
export async function verifyBrowserUiLockMidKernel(client, {
  evaluate, waitFor, assert, browserClient = null, fixtureKey = 'rgb16large',
  secondNativeFixtureKey = null,
} = {}) {
  if (!['rgb16large','rgb32psblarge'].includes(fixtureKey))
    throw new RangeError('Unsupported 010D browser fixture: ' + fixtureKey);
  if (secondNativeFixtureKey &&
      (fixtureKey !== 'rgb32psblarge' || secondNativeFixtureKey !== 'rgb32psblarge-alt'))
    throw new RangeError('010D-D requires two distinct large PSB32 Float32 fixtures');
  const fixture = createBrowserHighDepthFixture(fixtureKey);
  const secondFixture = secondNativeFixtureKey
    ? createBrowserHighDepthFixture(secondNativeFixtureKey) : null;
  const format = fixture.version === 2 ? 'PSB32 Float32' : 'PSD16 Uint16';
  const sampler = createBrowserRendererHeapSampler(client, { processClient:browserClient });
  // All earlier UI tests are complete before this final, isolated reload.
  await client.send('Page.reload', { ignoreCache:true });
  await waitFor('010D editor reload', () => evaluate(client,
    "document.readyState==='complete' && !!document.querySelector('#fileInput') && !!document.querySelector('#editorCanvas')"), 15_000);
  // A previous smoke scenario wrote a genuine recovery snapshot. On reload
  // startup may show a blocking recovery dialog; exercise its public "new
  // project" action before importing our isolated PSD16 fixture.
  await new Promise(resolve => setTimeout(resolve, 400));
  await evaluate(client, "(() => {const newProject=document.querySelector('#modalRoot .recovery-modal [data-new-project]');if(newProject)newProject.click();return true;})()");
  await waitFor('010D recovery prompt acknowledged', () => evaluate(client,
    "!document.querySelector('#modalRoot .recovery-modal')"), 10_000);
  // "Start new project" deliberately opens the ordinary New Document modal.
  // Cancel that draft through its real button: our next action is PSD import.
  await evaluate(client, "(() => {document.querySelector('#modalRoot [data-cancel]')?.click();return true;})()");
  await waitFor('010D unobstructed editor', () => evaluate(client,
    "!document.querySelector('#modalRoot [role=dialog]')"), 10_000);
  await sampler.start();
  let stopped = false;
  try {
    const metadata = {
      filename:fixture.filename, defectX:fixture.defectX, defectY:fixture.defectY,
      width:fixture.width, height:fixture.height, damaged:fixture.damaged,
      normal:fixture.normal, bitsPerChannel:fixture.bitsPerChannel,
      channels:fixture.channels,
    };
    const secondMetadata = secondFixture ? {
      filename:secondFixture.filename, defectX:secondFixture.defectX, defectY:secondFixture.defectY,
      width:secondFixture.width, height:secondFixture.height,
      damaged:secondFixture.damaged, normal:secondFixture.normal,
      bitsPerChannel:secondFixture.bitsPerChannel, channels:secondFixture.channels,
    } : null;
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
        function sample(x,y) {
          const tile = source.tiles.find(t => x >= t.x && y >= t.y &&
            x < t.x + t.width && y < t.y + t.height);
          if (!tile) return null;
          const bytes = Uint8Array.from(atob(tile.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
          const view = new DataView(bytes.buffer);
          const bytesPerChannel = f.bitsPerChannel / 8;
          const offset = ((y - tile.y) * tile.width + x - tile.x) *
            f.channels * bytesPerChannel;
          return {
            values:Array.from({length:f.channels},(_,i)=>f.bitsPerChannel===16
              ?view.getUint16(offset+i*bytesPerChannel,true)
              :view.getFloat32(offset+i*bytesPerChannel,true)),
            words:Array.from({length:f.channels},(_,i)=>f.bitsPerChannel===16
              ?view.getUint16(offset+i*bytesPerChannel,true)
              :view.getUint32(offset+i*bytesPerChannel,true)),
          };
        }
        return { kind:source.kind, bits:source.bitsPerChannel, rawBytes:source.rawBytes,
          tiles:source.tiles.length, normal:sample(0,0),
          damaged:sample(f.defectX,f.defectY) };
      } finally { URL.createObjectURL = old; }
    }
    const before = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(before.kind === 'zpe-pixel-buffer-source-v2' &&
      before.bits === fixture.bitsPerChannel &&
      before.rawBytes === fixture.width*fixture.height*fixture.channels*(fixture.bitsPerChannel/8) &&
      before.tiles > 1 && JSON.stringify(before.normal?.values) === JSON.stringify(fixture.normal) &&
      JSON.stringify(before.damaged?.values) === JSON.stringify(fixture.damaged),
      '010D preflight must preserve native PSD/PSB v2 sample values and bit patterns',
      JSON.stringify({format,before}));


    // 010D-B: keep two real document sessions alive and switch mid-kernel.
    function prepareTabs() {
      const tabs = () => [...document.querySelectorAll('#docTabs .doc-tab')];
      if (tabs().length !== 1) return {error:'Expected isolated single tab',count:tabs().length};
      const firstTitle = tabs()[0].querySelector('.doc-tab-title')?.textContent;
      document.querySelector('#addDocTabBtn').click();
      const count = tabs().length;
      const secondTitle = tabs()[1]?.querySelector('.doc-tab-title')?.textContent;
      const second = {
        title:document.querySelector('#documentTitle')?.textContent,
        dimensions:document.querySelector('#docDimensions')?.textContent,
        history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent),
        layerNames:[...document.querySelectorAll('.layer-row .layer-name')].map(r=>r.textContent),
      };
      tabs()[0]?.click();
      return {
        count,firstTitle,secondTitle,second,
        firstSelected:tabs()[0]?.getAttribute('aria-selected'),
        restoredTitle:document.querySelector('#documentTitle')?.textContent,
      };
    }
    const tabSetup = await evaluate(client,'(' + prepareTabs.toString() + ')()');
    assert(tabSetup.count === 2 && tabSetup.firstSelected === 'true' &&
      tabSetup.firstTitle && tabSetup.secondTitle &&
      tabSetup.restoredTitle === tabSetup.firstTitle &&
      tabSetup.second.dimensions === '1200 × 800',
      '010D-B0 must prepare two independent real document tabs',JSON.stringify(tabSetup));
    // 010D-D: replace the ordinary second tab via its public file input with
    // a different native PSB32; the first native session remains live.
    let secondNativeBefore = null;
    let secondUiBaseline = tabSetup.second;
    let secondEditedSnapshot = null;
    let secondAfterRedo = null;
    if (secondFixture) {
      const selected = await evaluate(client, "(() => {document.querySelectorAll('#docTabs .doc-tab')[1]?.click();return [...document.querySelectorAll('#docTabs .doc-tab')].map(x=>x.getAttribute('aria-selected')).join(',');})()");
      assert(selected === 'false,true', '010D-D must activate second tab before PSB32 import',selected);
      await evaluate(client,'window.__zpe010dParts=[];window.__zpe010dMeta=' +
        JSON.stringify(secondMetadata) + ';true');
      const otherEncoded = Buffer.from(secondFixture.bytes).toString('base64');
      for (let offset = 0; offset < otherEncoded.length; offset += 192 * 1024) {
        await evaluate(client, '(() => {const data=atob(' +
          JSON.stringify(otherEncoded.slice(offset,offset + 192 * 1024)) +
          ');window.__zpe010dParts.push(Uint8Array.from(data,c=>c.charCodeAt(0)));return true;})()');
      }
      const otherDispatched = await evaluate(client,'(' + dispatchPsd.toString() + ')()');
      assert(otherDispatched.filename === secondFixture.filename &&
        otherDispatched.count === secondFixture.bytes.length,
        '010D-D second native PSB32 must enter the real file input intact',
        JSON.stringify(otherDispatched));
      await waitFor('010D-D independent second PSB32 import', () =>
        evaluate(client,'(' + imported.toString() + ')()'), 60_000);
      secondNativeBefore = await evaluate(client,'(' + readNativeSave.toString() + ')()');
      assert(secondNativeBefore.kind === 'zpe-pixel-buffer-source-v2' &&
        secondNativeBefore.bits === 32 && secondNativeBefore.tiles > 1 &&
        secondNativeBefore.rawBytes === secondFixture.width*secondFixture.height*16 &&
        JSON.stringify(secondNativeBefore.normal?.values) === JSON.stringify(secondFixture.normal) &&
        JSON.stringify(secondNativeBefore.damaged?.values) === JSON.stringify(secondFixture.damaged) &&
        JSON.stringify(secondNativeBefore.normal?.words) !== JSON.stringify(before.normal?.words) &&
        JSON.stringify(secondNativeBefore.damaged?.words) !== JSON.stringify(before.damaged?.words),
        '010D-D two native documents must have independent exact Float32 words',
        JSON.stringify({before,secondNativeBefore}));
      secondUiBaseline = await evaluate(client,"(() => ({title:document.querySelector('#documentTitle')?.textContent,dimensions:document.querySelector('#docDimensions')?.textContent,history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent),layerNames:[...document.querySelectorAll('.layer-row .layer-name')].map(r=>r.textContent)}))()");
      await sampler.snapshot('010d-d-two-native-psb32-imported');
      await evaluate(client,"(() => {document.querySelectorAll('#docTabs .doc-tab')[0]?.click();window.__zpe010dMeta=" +
        JSON.stringify(metadata) + ";return true;})()");
    }
    const tabsNativeBefore = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(JSON.stringify(tabsNativeBefore) === JSON.stringify(before),
      '010D-B0 initial tab round trip must preserve native samples',JSON.stringify(tabsNativeBefore));

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

    // 010D-B: a real click must now activate the second session DURING
    // the stalled native Worker kernel. Revocation must terminate the Worker,
    // not publish bytes/History into either document.
    const switchStarted = Date.now();
    function switchWhileWorkerRuns() {
      const tabs = [...document.querySelectorAll('#docTabs .doc-tab')];
      tabs[1]?.click();
      return {
        active:[...document.querySelectorAll('#docTabs .doc-tab')].map(tab=>tab.getAttribute('aria-selected')),
        history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent),
        probe:window.__zpe010d?.probes,
        terminations:window.__zpe010d?.terminations,
      };
    }
    const switched = await evaluate(client,'(' + switchWhileWorkerRuns.toString() + ')()');
    assert(switched.active.join(',') === 'false,true' &&
      switched.probe === 1 && switched.terminations === 1 &&
      switched.history.every(value=>!value.includes('Контент-заливка')),
      '010D-B active tab switch must terminate native Worker and preserve History',
      JSON.stringify(switched));
    const switchLatencyMs = Date.now() - switchStarted;
    assert(switched.terminations === 1, '010D-B must cancel exactly one Worker');
    await sampler.snapshot('010d-active-mid-kernel-tab-switch');

    // Once the stale native job has settled, both real tabs must be usable.
    // Compare a public UI snapshot, not a private editor state singleton.
    function selectSecondTab() {
      const tabs = [...document.querySelectorAll('#docTabs .doc-tab')];
      tabs[1]?.click();
      return {
        active:[...document.querySelectorAll('#docTabs .doc-tab')].map(tab=>tab.getAttribute('aria-selected')),
        title:document.querySelector('#documentTitle')?.textContent,
        dimensions:document.querySelector('#docDimensions')?.textContent,
        history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent),
        layerNames:[...document.querySelectorAll('.layer-row .layer-name')].map(r=>r.textContent),
      };
    }
    const secondSession = await waitFor('010D-B0 other tab after cancellation',async()=>{
      const result = await evaluate(client,'(' + selectSecondTab.toString() + ')()');
      return result.active.join(',')==='false,true' ? result : null;
    },5_000);
    assert(JSON.stringify({
      title:secondSession.title,dimensions:secondSession.dimensions,
      history:secondSession.history,layerNames:secondSession.layerNames,
    }) === JSON.stringify(secondUiBaseline),
      '010D second tab content/history must survive cancelled native job',
      JSON.stringify({before:secondUiBaseline,after:secondSession}));
    if (secondFixture) {
      await evaluate(client,'window.__zpe010dMeta=' + JSON.stringify(secondMetadata) + ';true');
      const unchanged = await evaluate(client,'(' + readNativeSave.toString() + ')()');
      assert(JSON.stringify(unchanged) === JSON.stringify(secondNativeBefore),
        '010D-D cancelled first Worker must not touch second native bytes',
        JSON.stringify({secondNativeBefore,unchanged}));
      // Complete a second, independent Worker transaction in the destination
      // native session, including native-word Undo/Redo before returning.
      const secondView = await evaluate(client,'(' + setupMarquee.toString() + ')()');
      assert(secondView.visible && secondView.hit === 'overlayCanvas',
        '010D-D second native selection must use real overlay',JSON.stringify(secondView));
      await mouse('mouseMoved',secondView.start,0);
      await mouse('mousePressed',secondView.start,1);
      await mouse('mouseMoved',secondView.end,1);
      await mouse('mouseReleased',secondView.end,0);
      assert(await evaluate(client,'(' + startFill.toString() + ')()'),
        '010D-D second high-depth tab must launch its own Worker Fill');
      await waitFor('010D-D second native Worker finishes', () => evaluate(client,
        "window.__zpe010d?.jobs===2 && window.__zpe010d?.probes===2 && [...document.querySelectorAll('#historyList .history-row')].filter(r=>r.textContent.includes('Контент-заливка')).length===1"), 90_000);
      const edited = await evaluate(client,'(' + readNativeSave.toString() + ')()');
      assert(edited.tiles === secondNativeBefore.tiles &&
        JSON.stringify(edited.normal?.words) === JSON.stringify(secondNativeBefore.normal?.words) &&
        JSON.stringify(edited.damaged?.words) !== JSON.stringify(secondNativeBefore.damaged?.words),
        '010D-D second Worker must commit only second selected native samples',
        JSON.stringify({secondNativeBefore,edited}));
      const secondDonorPreview = await evaluate(client,
        "document.querySelector('#editorCanvas').getContext('2d').getImageData(0,0,1,1).data[0]");
      await evaluate(client,"document.querySelector('#undoBtn').click();true");
      await waitFor('010D-D second native Undo preview', () => evaluate(client,
        '(' + defectPixel.toString() + ')() > ' + (secondDonorPreview + 20)), 30_000);
      const undone = await evaluate(client,'(' + readNativeSave.toString() + ')()');
      assert(JSON.stringify(undone) === JSON.stringify(secondNativeBefore),
        '010D-D second native Undo restores exact source Float32 words',
        JSON.stringify({secondNativeBefore,undone}));
      await evaluate(client,"document.querySelector('#redoBtn').click();true");
      await waitFor('010D-D second native Redo preview', () => evaluate(client,
        '(' + defectPixel.toString() + ')() < ' + (secondDonorPreview + 20)), 30_000);
      secondAfterRedo = await evaluate(client,'(' + readNativeSave.toString() + ')()');
      assert(JSON.stringify(secondAfterRedo) === JSON.stringify(edited),
        '010D-D second native Redo restores exact committed words',
        JSON.stringify({edited,secondAfterRedo}));
      const secondDone = await evaluate(client,'(' + selectSecondTab.toString() + ')()');
      secondEditedSnapshot = {
        title:secondDone.title,dimensions:secondDone.dimensions,
        history:secondDone.history,layerNames:secondDone.layerNames,
      };
      await sampler.snapshot('010d-d-second-worker-native-undo-redo');
      await evaluate(client,'window.__zpe010dMeta=' + JSON.stringify(metadata) + ';true');
    }
    function selectFirstTab() {
      const tabs = [...document.querySelectorAll('#docTabs .doc-tab')];
      tabs[0]?.click();
      return {
        active:[...document.querySelectorAll('#docTabs .doc-tab')].map(tab=>tab.getAttribute('aria-selected')),
        title:document.querySelector('#documentTitle')?.textContent,
      };
    }
    const restoredTab = await evaluate(client,'(' + selectFirstTab.toString() + ')()');
    assert(restoredTab.active.join(',')==='true,false' &&
      restoredTab.title === tabSetup.firstTitle,
      '010D-B0 original PSD16 tab must reactivate after stale termination',JSON.stringify(restoredTab));
    const afterRoundTrip = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(JSON.stringify(afterRoundTrip) === JSON.stringify(before),
      '010D-B0 first tab native sample/tile topology changed across session switch',
      JSON.stringify({before,afterRoundTrip}));
    await sampler.snapshot('010d-two-sessions-preserved');

    assert(await evaluate(client,'(' + startFill.toString() + ')()'),
      '010D-B original tab must permit successor Content-Aware Fill');
    await waitFor('010D successor real Worker and visible preview', () => evaluate(client,
      'window.__zpe010d?.jobs===2 && (' + defectPixel.toString() + ')() < 150'), 60_000);
    const recovered = await evaluate(client,'(() => ({state:{...window.__zpe010d},' +
      'pixel:(' + defectPixel.toString() + ')(),' +
      'history:[...document.querySelectorAll("#historyList .history-row")].map(r=>r.textContent)}))()');
    const expectedJobs = secondFixture ? 3 : 2;
    assert(recovered.state.jobs===expectedJobs && recovered.state.probes===expectedJobs &&
      recovered.state.terminations===expectedJobs && recovered.pixel<150 &&
      recovered.history.filter(value=>value.includes('Контент-заливка')).length===1,
      '010D successor must publish exactly one visible edit and History entry',JSON.stringify(recovered));
    const afterRecovery = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(afterRecovery.kind === before.kind && afterRecovery.tiles === before.tiles &&
      JSON.stringify(afterRecovery.damaged) !== JSON.stringify(before.damaged) &&
      JSON.stringify(afterRecovery.damaged?.words) !== JSON.stringify(before.damaged?.words) &&
      JSON.stringify(afterRecovery.normal?.words) === JSON.stringify(before.normal?.words),
      '010D successor must change only selected native 16/32-bit samples',
      JSON.stringify({format,afterRecovery}));
    await sampler.snapshot('010d-successor-committed');

    // 010D-C: Undo and Redo must restore the *native little-endian words*,
    // not merely an 8-bit canvas preview. A second live session remains
    // unchanged throughout both history transactions and the round trip.
    await evaluate(client,"document.querySelector('#undoBtn').click();true");
    await waitFor('010D native Undo preview', () => evaluate(client,
      '(' + defectPixel.toString() + ')() > 100'), 30_000);
    const afterUndo = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(JSON.stringify(afterUndo) === JSON.stringify(before),
      '010D Undo must restore exact native tile topology, words and values',
      JSON.stringify({format,before,afterUndo}));
    await evaluate(client,"document.querySelector('#redoBtn').click();true");
    await waitFor('010D native Redo preview', () => evaluate(client,
      '(' + defectPixel.toString() + ')() < 150'), 30_000);
    const afterRedo = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(JSON.stringify(afterRedo) === JSON.stringify(afterRecovery),
      '010D Redo must restore the exact committed native 16/32-bit words',
      JSON.stringify({format,afterRecovery,afterRedo}));
    const otherAfterRedo = await evaluate(client,'(' + selectSecondTab.toString() + ')()');
    assert(JSON.stringify({
      title:otherAfterRedo.title,dimensions:otherAfterRedo.dimensions,
      history:otherAfterRedo.history,layerNames:otherAfterRedo.layerNames,
    }) === JSON.stringify(secondEditedSnapshot || secondUiBaseline),
      '010D second session must survive original document Undo/Redo',
      JSON.stringify({format,otherAfterRedo}));
    if (secondFixture) {
      await evaluate(client,'window.__zpe010dMeta=' + JSON.stringify(secondMetadata) + ';true');
      const secondFinal = await evaluate(client,'(' + readNativeSave.toString() + ')()');
      assert(JSON.stringify(secondFinal) === JSON.stringify(secondAfterRedo),
        '010D-D first document Undo/Redo cannot change second PSB32 native words',
        JSON.stringify({secondAfterRedo,secondFinal}));
      await evaluate(client,'window.__zpe010dMeta=' + JSON.stringify(metadata) + ';true');
    }
    await evaluate(client,'(' + selectFirstTab.toString() + ')()');
    const afterHistorySwitch = await evaluate(client,'(' + readNativeSave.toString() + ')()');
    assert(JSON.stringify(afterHistorySwitch) === JSON.stringify(afterRecovery),
      '010D original native words must survive a post-Redo session switch',
      JSON.stringify({format,afterHistorySwitch}));
    await sampler.snapshot('010d-native-undo-redo-session-roundtrip');
    const memory = await sampler.stop(); stopped=true;
    console.log('Stage 003 010D-C real '+format+' UI active mid-kernel switch:',JSON.stringify({
      source:'ZeTer-generated, NOT independent Adobe reference',
      fixtureKey,bitsPerChannel:fixture.bitsPerChannel,rawBytes:before.rawBytes,
      nativeUndoRedoWordParity:true,secondSessionPreservedAfterHistory:true,
      independentSecondNativePsb32:Boolean(secondFixture),secondNativeWorkerWordParity:Boolean(secondAfterRedo),
      realWorkerJobs:recovered.state.jobs, kernelWriteProbes:recovered.state.probes,
      terminations:recovered.state.terminations, switchLatencyMs,
      unchangedNativeAfterSwitch:true, midKernelTabSwitchActive:true,
      bothTabsPreservedAfterCancel:true, recoveredHistoryEntries:1,
      memory:{type:'sampled renderer JS heap and optional all-process private memory; not peak RSS',...memory},
    }));
    return { ok:true, switchLatencyMs, recovered:true, independentSecondNative:Boolean(secondFixture) };
  } finally {
    if (!stopped) await sampler.stop().catch(()=>{});
    await evaluate(client,'window.__zpe010dRestore?.();delete window.__zpe010dMeta;true').catch(()=>{});
  }
}

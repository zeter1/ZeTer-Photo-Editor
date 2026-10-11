/**
 * Test-only Chromium file:// regression. Modifies only an isolated Worker Blob,
 * never the production supplier. A probe is emitted AFTER a real kernel write;
 * a bounded CPU spin keeps that same worker inside the kernel until terminate().
 */
export function instrumentBrowserKernelSource(source) {
  const marker = '    pending[index] = 0;\n    donorIndex[index] = bestDonor;\n    filled += 1;';
  if (typeof source !== 'string' ||
      !source.startsWith('/* ZeTer tiled Content-Aware Worker.') ||
      source.indexOf(marker) < 0 || source.indexOf(marker) !== source.lastIndexOf(marker)) {
    throw new Error('Stage 003 browser probe: native kernel write anchor changed');
  }
  const addition = [
    '    if (width >= 40 && filled === 1) {',
    '      self.postMessage({probe:"zpe-test-native-kernel-write",',
    '        filled, changedSample:Number(data[targetOffset])});',
    '      const probeDeadline = performance.now() + 6000;',
    '      while (performance.now() < probeDeadline) {}',
    '    }',
  ].join('\n');
  return source.replace(marker, marker + '\n' + addition);
}

export async function verifyBrowserMidKernelCancellation(client, { evaluate, moduleSource }) {
  async function browserProbe() {
    const name = '__zpeTiledInpaintWorkerSource';
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    if (typeof descriptor?.value !== 'string') {
      throw new Error('Generated file:// Worker supplier unavailable');
    }
    // The supplier uses a non-writable configurable property; restore the exact
    // descriptor, not an assignment, even on test failure.
    Object.defineProperty(globalThis, name, {
      configurable:true, value:instrumentBrowserKernelSource(descriptor.value),
    });
    let created = 0, terminated = 0, replies = 0, probes = 0;
    let signal;
    let progress;
    const resetProgress = () => {
      progress = new Promise(resolve => { signal = resolve; });
    };
    resetProgress();
    class ObservedWorker extends Worker {
      constructor(url) {
        super(url);
        created += 1;
        this.addEventListener('message', event => {
          if (event.data?.probe === 'zpe-test-native-kernel-write') {
            probes += 1;
            signal(event.data);
          }
          if (event.data?.ok === true) replies += 1;
        });
      }
      terminate() {
        terminated += 1;
        return super.terminate();
      }
    }
    let controller;
    try {
      controller = createBrowserTiledInpaintWorkerController({
        WorkerType:ObservedWorker, loadTimeoutMs:5000,
      });
      function fixture(size, large) {
        const raw = new Uint8Array(size * size * 8), view = new DataView(raw.buffer);
        const selectedIndices = [];
        for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
          const selected = large ? (x >= 12 && x < 52 && y >= 12 && y < 52)
            : x === 4 && y === 4;
          if (selected) selectedIndices.push(y * size + x);
          const samples = selected ? [60000,0,0,65535] : [1000,2000,3000,65535];
          const offset = (y * size + x) * 8;
          for (let c = 0; c < 4; c += 1) view.setUint16(offset + c * 2, samples[c], true);
        }
        let bytes = '';
        for (let i = 0; i < raw.length; i += 8192) {
          bytes += String.fromCharCode(...raw.subarray(i, i + 8192));
        }
        const dataUrl = 'data:application/x-zeter-pixel-buffer-tile;base64,' + btoa(bytes);
        const source = {
          kind:'zpe-pixel-buffer-source-v2', width:size, height:size, model:'rgb',
          channels:4, bitsPerChannel:16, colorSpace:'srgb', alphaMode:'straight',
          profileName:'', tileSize:size, rawBytes:raw.length,
          tiles:[{x:0,y:0,width:size,height:size,rawBytes:raw.length,dataUrl}],
        };
        return {
          source, selectedIndices:Uint32Array.from(selectedIndices),
          halo:2, maxLayerPixels:size*size, maxFillPixels:large?2000:8,
        };
      }
      async function waitProgress() {
        let timer;
        try {
          return await Promise.race([
            progress,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('No native kernel write was observed')), 4000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      const large = fixture(64,true);
      const snapshot = JSON.stringify(large.source);
      const first = controller.run(large);
      const firstProgress = await waitProgress();
      if (firstProgress.filled !== 1 || firstProgress.changedSample >= 60000) {
        throw new Error('First probe was not emitted after native synthesis');
      }
      if (!controller.cancel() || (await first)?.cancelled !== true) {
        throw new Error('Explicit cancellation published an in-flight result');
      }
      resetProgress();
      let current = true;
      const second = controller.run(large,{isCurrent:()=>current});
      const secondProgress = await waitProgress();
      if (secondProgress.filled !== 1 || secondProgress.changedSample >= 60000) {
        throw new Error('Second probe was not emitted after native synthesis');
      }
      current = false;
      let pollTimer;
      let secondResult;
      try {
        secondResult = await Promise.race([
          second,
          new Promise((_, reject) => {
            pollTimer = setTimeout(() => reject(new Error('Owner polling failed to terminate kernel')), 3000);
          }),
        ]);
      } finally {
        clearTimeout(pollTimer);
      }
      if (secondResult?.cancelled !== true) {
        throw new Error('Stale owner published an in-flight result');
      }
      const small = fixture(8,false);
      const recovered = await controller.run(small);
      if (recovered?.filled !== 1 || recovered?.changedTiles !== 1 ||
          recovered?.source?.tiles?.[0]?.dataUrl === small.source.tiles[0].dataUrl) {
        throw new Error('Native 16-bit successor did not recover');
      }
      if (JSON.stringify(large.source) !== snapshot ||
          probes !== 2 || created !== 3 || terminated !== 3 || replies !== 1) {
        throw new Error('Worker lifecycle, source immutability, or stale reply failure: ' +
          JSON.stringify({probes,created,terminated,replies}));
      }
      return {
        ok:true, probes, created, terminated, replies,
        directCancelled:true, staleOwnerCancelled:true, successorFilled:recovered.filled,
        sourceImmutable:true, protocol:document.location.protocol,
        note:'Test-only CPU stall inside native kernel, not a measured browser peak RSS',
      };
    } finally {
      controller?.cancel();
      Object.defineProperty(globalThis, name, descriptor);
    }
  }
  // Runs inside the real Chromium file:// editor with the real browser adapter.
  return evaluate(client, '(async () => {\n' + moduleSource + '\n' +
    instrumentBrowserKernelSource.toString() + '\nreturn (' +
    browserProbe.toString() + ')();\n})()');
}

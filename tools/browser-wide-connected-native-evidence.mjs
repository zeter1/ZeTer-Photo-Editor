// 036A: test-only exact native evidence for a genuinely wide connected ROI.
// Synthetic ZeTer background only: never claim Adobe or external-image fidelity.
// The oracle deliberately decodes the public persisted .zpe tile payload, not
// the inpaint engine or the 8-bit display canvas.
import { measureKnownNativeConnectedRoiQuality } from './complex-roi-native-quality.mjs';
import { inspectNativeSelectedPixelChanges } from './browser-native-selection-integrity.mjs';

const TILE_PREFIX = 'data:application/x-zeter-pixel-buffer-tile;base64,';
const MAX_PIXELS = 2_000_000;

export function createWideConnectedRoiIndices(width, height, { x = 0, y = 0 } = {}) {
  if (![width,height,x,y].every(Number.isSafeInteger) ||
      x < 0 || y < 0 || width < x + 240 || height < y + 240 ||
      width * height > MAX_PIXELS) {
    throw new RangeError('036 wide ROI: invalid bounds');
  }
  const indices = [];
  // Two 64x64 islands joined by a one-pixel, 8-connected diagonal corridor.
  // Exactly 8192 + 96 = 8288 pixels; not a rectangular substitute.
  for (let localY = 16; localY < 240; localY++) {
    for (let localX = 16; localX < 240; localX++) {
      const islandA = localX < 80 && localY < 80;
      const islandB = localX >= 176 && localY >= 176;
      const bridge = localX >= 80 && localX < 176 && localX === localY;
      if (islandA || islandB || bridge) indices.push((localY + y) * width + localX + x);
    }
  }
  return Uint32Array.from(indices);
}

function decodeNativeSource(source) {
  const fail = message => { throw new TypeError('036 native tiles: ' + message); };
  if (!source || source.kind !== 'zpe-pixel-buffer-source-v2' ||
      !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) ||
      source.width < 1 || source.height < 1 || source.width * source.height > MAX_PIXELS ||
      source.channels !== 4 || ![16,32].includes(source.bitsPerChannel) ||
      !Number.isSafeInteger(source.tileSize) || source.tileSize < 1 ||
      !Array.isArray(source.tiles) || source.tiles.length < 2 ||
      source.tiles.length > source.width * source.height) fail('invalid source topology');
  const pixels=source.width * source.height, bytes=source.bitsPerChannel / 8;
  const stride=source.channels * bytes;
  if (source.rawBytes !== pixels * stride) fail('invalid source byte budget');
  const Type=source.bitsPerChannel === 16 ? Uint16Array : Float32Array;
  const values=new Type(pixels * source.channels);
  const coverage=new Uint8Array(pixels);
  for (const tile of source.tiles) {
    if (!tile || ![tile.x,tile.y,tile.width,tile.height,tile.rawBytes].every(Number.isSafeInteger) ||
        tile.x < 0 || tile.y < 0 || tile.width < 1 || tile.height < 1 ||
        tile.x + tile.width > source.width || tile.y + tile.height > source.height ||
        tile.width > source.tileSize || tile.height > source.tileSize ||
        tile.rawBytes !== tile.width * tile.height * stride ||
        typeof tile.dataUrl !== 'string' || !tile.dataUrl.startsWith(TILE_PREFIX)) {
      fail('invalid tile geometry');
    }
    const encoded=tile.dataUrl.slice(TILE_PREFIX.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      fail('invalid tile base64');
    }
    const raw=Buffer.from(encoded,'base64');
    if (raw.length !== tile.rawBytes || raw.toString('base64') !== encoded)
      fail('noncanonical or truncated native tile');
    const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    for (let localY=0;localY<tile.height;localY++) {
      for (let localX=0;localX<tile.width;localX++) {
        const pixel=(localY+tile.y)*source.width+localX+tile.x;
        if (coverage[pixel]++) fail('overlapping native tiles');
        const offset=(localY*tile.width+localX)*stride;
        for (let channel=0;channel<source.channels;channel++) {
          const value=source.bitsPerChannel===16
            ? view.getUint16(offset+channel*bytes,true)
            : view.getFloat32(offset+channel*bytes,true);
          if (!Number.isFinite(value)) fail('non-finite native sample');
          values[pixel*source.channels+channel]=value;
        }
      }
    }
  }
  if (coverage.some(value=>value!==1)) fail('missing native tile coverage');
  return values;
}

function assertEqualNativeTiles(before, after, label) {
  const fail = message => { throw new TypeError('036 '+label+': '+message); };
  if (!after || before.kind !== after.kind ||
      ['width','height','model','channels','bitsPerChannel','tileSize','rawBytes',
        'colorSpace','alphaMode','profileName'].some(field=>before[field]!==after[field]) ||
      !Array.isArray(after.tiles) || after.tiles.length !== before.tiles.length) {
    fail('source metadata or tile topology differs');
  }
  for(let i=0;i<before.tiles.length;i++) {
    const a=before.tiles[i],b=after.tiles[i];
    if (!b || ['x','y','width','height','rawBytes'].some(field=>a[field]!==b[field]) ||
        a.dataUrl!==b.dataUrl) fail('native tile bytes differ');
  }
}

export function verifyWideConnectedNativeRoundTrip({
  original, filled, undone, redone, selectedIndices, clean, offsetX = 0, offsetY = 0,
} = {}) {
  if (!original || !filled || !undone || !redone ||
      !(selectedIndices instanceof Uint32Array) ||
      !Array.isArray(clean) || clean.length !== 4 ||
      clean.some(value=>!Number.isFinite(value))) {
    throw new TypeError('036 wide ROI: missing native round-trip evidence');
  }
  const expected=createWideConnectedRoiIndices(original.width,original.height,{x:offsetX,y:offsetY});
  if (selectedIndices.length!==8288 ||
      selectedIndices.length!==expected.length ||
      selectedIndices.some((index,i)=>index!==expected[i])) {
    throw new TypeError('036 wide ROI: frozen selection is not the full connected shape');
  }
  const fields=['kind','width','height','model','channels','bitsPerChannel','tileSize',
    'rawBytes','colorSpace','alphaMode','profileName'];
  if (fields.some(key=>original[key]!==filled[key]) ||
      original.model!=='rgb' || original.channels!==4 ||
      ![16,32].includes(original.bitsPerChannel)) {
    throw new TypeError('036 wide ROI: native Fill source metadata changed');
  }
  const beforeData=decodeNativeSource(original);
  const afterData=decodeNativeSource(filled);
  // Exact byte comparison here covers the entire source, not only selected indices.
  const changes=inspectNativeSelectedPixelChanges(original,filled,selectedIndices);
  if (changes.changedSelectedPixels < 1 || changes.changedTiles < 2)
    throw new TypeError('036 wide ROI: no multi-tile native Fill was observed');
  const quality=measureKnownNativeConnectedRoiQuality({
    before:beforeData,after:afterData,selectedIndices,clean,
    channels:4,bitsPerChannel:original.bitsPerChannel,alphaChannel:3,
  });
  if (!(quality.repaired.mae < quality.baseline.mae &&
        quality.repaired.rmse < quality.baseline.rmse)) {
    throw new TypeError('036 wide ROI: Fill did not improve the known native reference');
  }
  decodeNativeSource(undone);
  decodeNativeSource(redone);
  assertEqualNativeTiles(original,undone,'Undo');
  assertEqualNativeTiles(filled,redone,'Redo');
  return {
    kind:'zpe-browser-wide-connected-native-evidence-v1',
    reference:'ZeTer-authored constant native clean background; not Photoshop',
    bitsPerChannel:original.bitsPerChannel,
    selectedPixels:selectedIndices.length,
    changedSelectedPixels:changes.changedSelectedPixels,
    changedTiles:changes.changedTiles,
    scoredSamples:quality.scoredSamples,
    baseline:quality.baseline,
    repaired:quality.repaired,
    outsideSelectionAndAlphaUnchanged:true,
    undoNativeBytesExact:true,
    redoNativeBytesExact:true,
  };
}

// Snapshot observations are not a process operation peak or Worker→PID evidence.
export function validateWideConnectedBrowserSampling({
  milestonesMs, renderer, linux, workerPidMapping, operationPeakRssBytes,
} = {}) {
  const fail = message => { throw new TypeError('036 browser sampling: '+message); };
  const stages=['imported','selected','filled','previewed','undone','redone'];
  if (!milestonesMs || Object.keys(milestonesMs).length!==stages.length ||
      stages.some(stage=>!Number.isFinite(milestonesMs[stage]) || milestonesMs[stage]<0) ||
      stages.some((stage,i)=>i>0 && milestonesMs[stage]<milestonesMs[stages[i-1]])) {
    fail('missing, unordered or invalid operation milestones');
  }
  for(const [name,entry] of [['renderer',renderer],['linux',linux]]) {
    if (!entry || !Number.isSafeInteger(entry.attempts) || entry.attempts<1 ||
        !Number.isSafeInteger(entry.observed) || entry.observed<0 ||
        entry.observed>entry.attempts ||
        !['complete','partial','unavailable'].includes(entry.coverage) ||
        entry.coverage !== (entry.observed===0?'unavailable':
          entry.observed===entry.attempts?'complete':'partial') ||
        (entry.lastObservedBytes!==null &&
          (!Number.isSafeInteger(entry.lastObservedBytes) || entry.lastObservedBytes<0)) ||
        (entry.observed===0 && entry.lastObservedBytes!==null)) {
      fail('invalid '+name+' sample coverage');
    }
  }
  if (workerPidMapping!=='unknown' || operationPeakRssBytes!==null)
    fail('unproven Worker PID mapping or operation peak');
  return true;
}

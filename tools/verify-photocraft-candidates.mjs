// Stage 002B: an independent PSD merged-composite pixel oracle for pinned,
// externally published Photoshop files. No ZeTer PSD writer or renderer is used
// to derive the reference. This does NOT prove full Photoshop render parity.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { decodePsd } from '../src/formats/psd.js';

export const PHOTOCRAFT_REVISION = 'b2e1dcba8954efa9ad0e7944c258cc0e9a5efc1e';
export const PHOTOCRAFT_CASES = Object.freeze([
  {
    id:'photoshop-rgb16-baseline', file:'rgb16/baseline-layer-copy.psd',
    sha256:'f31e10d19689df9dba71ebdc60652b28eb364ad8da9040a80bc5aeffcf34228e',
    size:80540, bitsPerChannel:16, layered:true,
  },
  {
    id:'photoshop-rgb16-levels', file:'rgb16/levels.psd',
    sha256:'fbb18d1cfa5fc74cf1c4777b99acdc2465b2920574bd9069b5a2ac129c8151d9',
    size:79020, bitsPerChannel:16, layered:true,
  },
  {
    id:'photoshop-rgb32-baseline', file:'rgb32/baseline-layer-copy.psd',
    sha256:'73199414108280d7717cc5c908a76f51c5e3091d7471e21e7d0bac1a75734f32',
    size:143536, bitsPerChannel:32, layered:true,
  },
]);

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function requireRange(bytes, start, length, label) {
  assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(length) &&
    start >= 0 && length >= 0 && start <= bytes.length - length,
    'Photoshop oracle: ' + label + ' outside input');
}
function mergedLayout(bytes, spec) {
  requireRange(bytes, 0, 26, 'header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = offset => { requireRange(bytes, offset, 2, 'u16'); return view.getUint16(offset, false); };
  const u32 = offset => { requireRange(bytes, offset, 4, 'u32'); return view.getUint32(offset, false); };
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString('ascii'), '8BPS', 'PSD signature');
  assert.equal(u16(4), 1, 'PSD (not PSB) version');
  assert.ok(bytes.subarray(6, 12).every(byte => byte === 0), 'PSD reserved bytes');
  const channels = u16(12), height = u32(14), width = u32(18);
  const bits = u16(22), mode = u16(24);
  assert.equal(bits, spec.bitsPerChannel, 'PSD depth');
  assert.equal(mode, 3, 'RGB only: not proof of ICC/CMYK parity');
  assert.ok(channels === 3 || channels === 4, 'RGB / RGBA expected');
  assert.ok(width > 0 && height > 0 && width <= 4096 && height <= 4096 &&
    width * height <= 1_000_000, 'bounded Photoshop corpus dimensions');
  if (spec.width !== undefined) assert.equal(width, spec.width);
  if (spec.height !== undefined) assert.equal(height, spec.height);
  let offset = 26;
  for (const section of ['color data', 'image resources', 'layer and mask']) {
    const length = u32(offset);
    offset += 4;
    requireRange(bytes, offset, length, section);
    if (section === 'layer and mask' && spec.layered) assert.ok(length > 0, 'layer section exists');
    if (section === 'layer and mask') var layerSection = { start:offset - 4, length };
    offset += length;
  }
  const compression = u16(offset);
  assert.ok(compression >= 0 && compression <= 3, 'known PSD image compression');
  return { channels, height, width, bits, compression, imageOffset:offset + 2, layerSection };
}

function unpackRow(bytes, from, count, expected) {
  requireRange(bytes, from, count, 'PackBits row');
  const result = new Uint8Array(expected);
  let pos = from, dest = 0;
  while (pos < from + count) {
    const op = (bytes[pos++] << 24) >> 24;
    if (op >= 0) {
      const n = op + 1;
      assert.ok(pos + n <= from + count && dest + n <= expected, 'PackBits literal length');
      result.set(bytes.subarray(pos, pos + n), dest);
      pos += n; dest += n;
    } else if (op !== -128) {
      const n = 1 - op;
      assert.ok(pos < from + count && dest + n <= expected, 'PackBits repeat length');
      result.fill(bytes[pos++], dest, dest + n);
      dest += n;
    }
  }
  assert.equal(dest, expected, 'PackBits row pixel width');
  return result;
}

function undoPrediction(bytes, width, height, bits) {
  const stride = width * bits / 8;
  const result = Uint8Array.from(bytes);
  if (bits === 16) {
    const view = new DataView(result.buffer);
    for (let y = 0; y < height; y++) {
      let previous = view.getUint16(y * stride, false);
      for (let x = 1; x < width; x++) {
        const pos = y * stride + 2 * x;
        previous = (previous + view.getUint16(pos, false)) & 0xffff;
        view.setUint16(pos, previous, false);
      }
    }
  } else {
    const restored = new Uint8Array(bytes.length);
    for (let y = 0; y < height; y++) {
      const start = y * stride;
      for (let x = 1; x < stride; x++) result[start + x] = (result[start + x] + result[start + x - 1]) & 255;
      for (let x = 0; x < width; x++) {
        for (let b = 0; b < 4; b++) restored[start + x * 4 + b] = result[start + b * width + x];
      }
    }
    return restored;
  }
  return result;
}

// Read merged image independently of ZeTer's codec, without layer parsing.
// Adobe's Maximize Compatibility preview is an independent stored golden
// for *composite decode*, NOT proof ZeTer can render Photoshop layer effects.
export function referenceMergedSamples(bytes, layout) {
  const { channels, width, height, bits, compression } = layout;
  const stride = width * bits / 8;
  const planeSize = stride * height;
  const expectedBytes = planeSize * channels;
  let offset = layout.imageOffset;
  let planar;
  if (compression === 0) {
    requireRange(bytes, offset, expectedBytes, 'raw merged planes');
    assert.equal(offset + expectedBytes, bytes.length, 'raw merged image consumes file');
    planar = bytes.subarray(offset, offset + expectedBytes);
  } else if (compression === 1) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const rowCounts = [];
    requireRange(bytes, offset, channels * height * 2, 'RLE row table');
    for (let i = 0; i < channels * height; i++) {
      rowCounts.push(view.getUint16(offset, false));
      offset += 2;
    }
    planar = new Uint8Array(expectedBytes);
    for (let channel = 0; channel < channels; channel++) {
      for (let y = 0; y < height; y++) {
        const count = rowCounts[channel * height + y];
        planar.set(unpackRow(bytes, offset, count, stride), channel * planeSize + y * stride);
        offset += count;
      }
    }
    assert.equal(offset, bytes.length, 'RLE merged image consumes file');
  } else {
    const zip = inflateSync(bytes.subarray(offset), { maxOutputLength: expectedBytes + 1 });
    assert.equal(zip.length, expectedBytes, 'ZIP merged image decoded byte size');
    planar = new Uint8Array(expectedBytes);
    for (let channel = 0; channel < channels; channel++) {
      const plane = zip.subarray(channel * planeSize, (channel + 1) * planeSize);
      planar.set(compression === 3 ? undoPrediction(plane, width, height, bits) : plane,
        channel * planeSize);
    }
  }
  const Samples = bits === 16 ? Uint16Array : Float32Array;
  const result = new Samples(width * height * 4);
  const view = new DataView(planar.buffer, planar.byteOffset, planar.byteLength);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < channels; c++) {
      const pos = c * planeSize + i * bits / 8;
      result[i * 4 + c] = bits === 16 ? view.getUint16(pos, false) : view.getFloat32(pos, false);
    }
    if (channels === 3) result[i * 4 + 3] = bits === 16 ? 65535 : 1;
  }
  return result;
}

export async function verifyPhotoshopCandidateBytes(bytes, spec) {
  assert.ok(bytes instanceof Uint8Array, 'candidate must be binary bytes');
  assert.equal(bytes.byteLength, spec.size, 'pinned source size');
  assert.equal(hash(bytes), spec.sha256, 'pinned upstream SHA-256');
  const layout = mergedLayout(bytes, spec);
  const reference = referenceMergedSamples(bytes, layout);
  // Erase only the layer/mask section in a detached view of the same Photoshop
  // bytes. ZeTer must use the original embedded composite, not its own writer.
  const { start, length } = layout.layerSection;
  const flat = new Uint8Array(bytes.byteLength - length);
  flat.set(bytes.subarray(0, start), 0);
  flat.set(bytes.subarray(start + 4 + length), start + 4);
  const decoded = await decodePsd(flat);
  assert.equal(decoded.width, layout.width);
  assert.equal(decoded.height, layout.height);
  const actual = decoded.compositePixelBuffer;
  assert.ok(actual, 'flattened imported PSD must expose native composite');
  assert.equal(actual.bitsPerChannel, layout.bits, 'no implicit 8-bit downsample');
  assert.equal(actual.model, 'rgb');
  assert.ok(actual.data instanceof (layout.bits === 16 ? Uint16Array : Float32Array));
  assert.equal(actual.data.length, reference.length);
  for (let i = 0; i < reference.length; i++) {
    assert.ok(Object.is(actual.data[i], reference[i]),
      'native Photoshop composite mismatch at sample ' + i);
  }
  let layers = null;
  if (spec.layered) {
    const original = await decodePsd(bytes);
    layers = (original.layers?.length ?? 0) +
      (original.adjustmentLayers?.length ?? 0) + (original.groups?.length ?? 0);
    assert.ok(layers > 0, 'original Photoshop file must retain editable layers');
  }
  return {
    id:spec.id, sha256:spec.sha256, width:layout.width, height:layout.height,
    channels:layout.channels, bitsPerChannel:layout.bits, compression:layout.compression,
    layeredEntries:layers, nativeReferenceSha256:hash(new Uint8Array(reference.buffer)),
    nativeCompositeParity:'exact', source:'Photoshop embedded merged composite',
  };
}

export async function verifyPhotoshopCandidateDirectory(dir) {
  const cases = [];
  for (const spec of PHOTOCRAFT_CASES) {
    const bytes = await readFile(resolve(dir, spec.file));
    cases.push(await verifyPhotoshopCandidateBytes(bytes, spec));
  }
  return {
    schema:'zpe-photocraft-psd16-psd32-oracle-v1', upstreamRevision:PHOTOCRAFT_REVISION,
    passed:true, cases,
    limitations:'Upstream Photoshop authorship/license are publisher claims; embedded composite verifies decoding, not rendered layer parity. PSD32 is not PSB32; no PSB32, ICC accuracy, browser file:// or external Photoshop application comparison is covered.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--dir') {
    console.error('Usage: node tools/verify-photocraft-candidates.mjs --dir /abs/corpus');
    process.exitCode = 2;
  } else {
    verifyPhotoshopCandidateDirectory(process.argv[3])
      .then(report => process.stdout.write(JSON.stringify(report, null, 2) + '\\n'))
      .catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
  }
}

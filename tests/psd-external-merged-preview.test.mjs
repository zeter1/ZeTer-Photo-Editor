import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodePsd } from '../src/formats/psd.js';

// All source files are independently authored psd-tools fixtures, pinned by their
// upstream SHA-256 manifests. Unlike the generated round-trip corpus, this oracle
// reads the ORIGINAL file's merged image bytes, not pixels emitted by ZPE's writer.
const cases = [
  {
    name: 'external Photoshop Shape Layer (transparent RGBA PSD)',
    root: './fixtures/photoshop-shapes/',
    file: 'psd-tools-shape-layer.psd',
    checksum: '1efeb945',
    expectedVersion: 1,
    expectedChannels: 4,
    sample: { x: 16, y: 16, rgba: [0, 255, 255, 255] },
    minColors: 2,
  },
  {
    name: 'external nested-group PSB (opaque RGB)',
    root: './fixtures/color-management/',
    file: 'psd-tools-group.psb',
    checksum: 'c0eb0dda',
    expectedVersion: 2,
    expectedChannels: 3,
    sample: { x: 50, y: 100, rgba: [255, 255, 255, 255] },
    minColors: 2,
  },
  {
    name: 'external masked Adjustment Layer (RGB PSD)',
    root: './fixtures/photoshop-adjustments/',
    file: 'adjustment-mask.psd',
    checksum: '4bec9dc5',
    expectedVersion: 1,
    expectedChannels: 3,
    sample: { x: 256, y: 256, rgba: [255, 255, 255, 255] },
    minColors: 1,
  },
];

function readBe(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    u16: offset => view.getUint16(offset, false),
    u32: offset => view.getUint32(offset, false),
    u64: offset => {
      const n = view.getBigUint64(offset, false);
      assert.ok(n <= BigInt(Number.MAX_SAFE_INTEGER), 'oversized PSB section');
      return Number(n);
    },
  };
}

function mergedImageLayout(bytes) {
  const { u16, u32, u64 } = readBe(bytes);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString('ascii'), '8BPS');
  const version = u16(4);
  assert.ok(version === 1 || version === 2);
  const channels = u16(12);
  const height = u32(14);
  const width = u32(18);
  assert.equal(u16(22), 8, 'oracle supports 8-bit fixtures only');
  assert.equal(u16(24), 3, 'oracle supports RGB fixtures only');
  assert.ok(width > 0 && height > 0 && width * height <= 1_000_000);
  assert.ok(channels === 3 || channels === 4, 'RGB/RGBA composite expected');

  let offset = 26;
  for (let i = 0; i < 2; i += 1) { // color-mode data, image resources
    const length = u32(offset);
    offset += 4 + length;
    assert.ok(offset <= bytes.length, 'truncated PSD section');
  }
  const layerMaskOffset = offset;
  const lengthBytes = version === 2 ? 8 : 4;
  const layerMaskLength = version === 2 ? u64(offset) : u32(offset);
  offset += lengthBytes + layerMaskLength;
  assert.ok(offset + 2 <= bytes.length, 'truncated merged image');
  assert.equal(u16(offset), 1, 'oracle intentionally supports PackBits RLE only');
  return { version, channels, width, height, layerMaskOffset, lengthBytes, layerMaskLength, imageOffset: offset + 2 };
}

// Independent, deliberately small PSD PackBits reader. It only decodes the
// image-data section and has NO dependency on src/formats/psd.js internals.
function referenceMergedRgba(bytes, layout) {
  const { channels, width, height, version } = layout;
  const { u16, u32 } = readBe(bytes);
  const rowByteCounts = [];
  let offset = layout.imageOffset;
  for (let channel = 0; channel < channels; channel += 1) {
    const counts = [];
    for (let y = 0; y < height; y += 1) {
      counts.push(version === 2 ? u32(offset) : u16(offset));
      offset += version === 2 ? 4 : 2;
    }
    rowByteCounts.push(counts);
  }
  const planes = Array.from({ length: channels }, () => new Uint8Array(width * height));
  for (let channel = 0; channel < channels; channel += 1) {
    for (let y = 0; y < height; y += 1) {
      const end = offset + rowByteCounts[channel][y];
      assert.ok(end <= bytes.length, 'RLE row exceeds input');
      let x = 0;
      while (offset < end) {
        const command = (bytes[offset++] << 24) >> 24;
        if (command >= 0) {
          const count = command + 1;
          assert.ok(offset + count <= end && x + count <= width, 'invalid literal run');
          planes[channel].set(bytes.subarray(offset, offset + count), y * width + x);
          offset += count;
          x += count;
        } else if (command !== -128) {
          const count = 1 - command;
          assert.ok(offset < end && x + count <= width, 'invalid repeated run');
          planes[channel].fill(bytes[offset++], y * width + x, y * width + x + count);
          x += count;
        }
      }
      assert.equal(offset, end, 'RLE row length');
      assert.equal(x, width, 'RLE decoded row width');
    }
  }
  assert.equal(offset, bytes.length, 'no unaccounted merged-image bytes');
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    for (let c = 0; c < 3; c += 1) rgba[4 * i + c] = planes[c][i];
    rgba[4 * i + 3] = channels === 4 ? planes[3][i] : 255;
  }
  return rgba;
}

function fnv1a32(bytes) {
  let value = 2166136261;
  for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0;
  return value.toString(16).padStart(8, '0');
}

function removeLayerSectionButPreserveMergedImage(bytes, layout) {
  // Do not touch the original fixture: construct a separate, valid flattened
  // *view* so the existing codec's opt-in-by-no-bitmap-layers path can expose
  // the original merged pixels. PSD uses a 4-byte length; PSB uses 8 bytes.
  const { layerMaskOffset, lengthBytes, layerMaskLength } = layout;
  assert.ok(layerMaskLength > 0, 'fixture must contain a layer/mask section');
  const flattened = new Uint8Array(bytes.length - layerMaskLength);
  flattened.set(bytes.subarray(0, layerMaskOffset));
  flattened.set(bytes.subarray(layerMaskOffset + lengthBytes + layerMaskLength), layerMaskOffset + lengthBytes);
  return flattened;
}

test('external PSD/PSB corpus: independent merged-preview pixels match codec import', async t => {
  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const root = new URL(fixture.root, import.meta.url);
      const manifestFile = fixture.root.includes('photoshop-shapes')
        ? 'manifest.json'
        : fixture.root.includes('color-management')
          ? 'corpus-manifest.json'
          : 'manifest.json';
      const manifest = JSON.parse(await readFile(new URL(manifestFile, root), 'utf8'));
      const item = (manifest.fixtures ?? [manifest.fixture]).find(entry => entry.file === fixture.file);
      assert.ok(item, 'fixture provenance must be in the existing manifest');
      const bytes = new Uint8Array(await readFile(new URL(fixture.file, root)));
      assert.equal(bytes.length, item.size);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);

      const layout = mergedImageLayout(bytes);
      assert.equal(layout.version, fixture.expectedVersion);
      assert.equal(layout.channels, fixture.expectedChannels);
      const oracle = referenceMergedRgba(bytes, layout);
      assert.equal(fnv1a32(oracle), fixture.checksum, 'pinned external merged-preview checksum');
      const { x, y, rgba } = fixture.sample;
      assert.deepEqual(Array.from(oracle.subarray(4 * (y * layout.width + x), 4 * (y * layout.width + x) + 4)), rgba);
      const uniqueColors = new Set();
      for (let i = 0; i < oracle.length; i += 4) uniqueColors.add(oracle.subarray(i, i + 4).join(','));
      assert.ok(uniqueColors.size >= fixture.minColors, 'oracle must include expected pixel variety');

      const original = await decodePsd(bytes);
      assert.ok(original.layers.length + original.adjustmentLayers.length + original.groups.length > 0,
        'fixture must really be layered; no generated ZPE round-trip input');
      const flattened = removeLayerSectionButPreserveMergedImage(bytes, layout);
      const decoded = await decodePsd(flattened);
      assert.equal(decoded.width, layout.width);
      assert.equal(decoded.height, layout.height);
      assert.ok(decoded.compositePixelBuffer, 'codec must decode the external merged image');
      assert.equal(Buffer.compare(Buffer.from(decoded.compositePixelBuffer.data), Buffer.from(oracle)), 0,
        'every imported RGBA sample must match the independent RLE preview oracle');
    });
  }
});

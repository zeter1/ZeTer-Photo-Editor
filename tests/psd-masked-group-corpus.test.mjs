import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodePsd, encodePsd, encodePsb, inspectPsdHeader } from '../src/formats/psd.js';

const documentWidth = 2;
const documentHeight = 2;
const mask = (...alpha) => ({
  pixels: Uint8Array.from(alpha.flatMap(value => [255, 255, 255, value])),
  width: documentWidth,
  height: documentHeight,
  x: 0,
  y: 0,
  defaultColor: 255,
});
const rgba = (...pixels) => Uint8Array.from(pixels.flat());
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const alpha = pixels => Array.from(pixels).filter((_, index) => index % 4 === 3);

// Deterministic self-generated PSD/PSB fixture. The adjustment blocks are taken
// from an independently sourced MIT fixture, not produced by ZPE's writer.
async function makeFixture() {
  const source = await readFile(new URL('./fixtures/photoshop-adjustments/brightness-contrast.psd', import.meta.url));
  const imported = await decodePsd(new Uint8Array(source));
  const adjustment = imported.adjustmentLayers[0];
  assert.equal(adjustment.psdAdjustment.kind, 'brightness-contrast');
  const ink = rgba([23, 87, 170, 255], [14, 30, 220, 180], [210, 70, 5, 0], [90, 100, 110, 240]);
  const base = rgba([255, 20, 30, 255], [0, 250, 20, 255], [80, 70, 60, 255], [10, 20, 30, 255]);
  return {
    width: documentWidth,
    height: documentHeight,
    composite: base,
    groups: [
      { key: 'outer', name: 'Outer', visible: true, collapsed: false, opacity: 1, blendMode: 'pass-through' },
      { key: 'inner', parentKey: 'outer', name: 'Inner', visible: false, collapsed: true, opacity: 0.6, blendMode: 'multiply' },
    ],
    layers: [
      { name: 'Ink masked', groupKey: 'inner', x: 0, y: 0, width: 2, height: 2,
        pixels: ink, mask: mask(0, 96, 200, 255), opacity: 0.55,
        blendMode: 'screen', visible: true },
      { name: 'Clipped adjustment', groupKey: 'inner', opacity: 1,
        blendMode: 'source-over', visible: true, clipping: true,
        mask: mask(255, 120, 0, 220),
        psdAdjustment: { kind: adjustment.psdAdjustment.kind,
          blocks: adjustment.psdAdjustment.blocks, channelIds: adjustment.channelIds } },
      { name: 'Outer masked', groupKey: 'outer', x: 0, y: 0, width: 2, height: 2,
        pixels: base, mask: { ...mask(40, 120, 200, 255), disabled: true },
        opacity: 1, blendMode: 'multiply', visible: true },
      { name: 'Ungrouped', x: 0, y: 0, width: 2, height: 2,
        pixels: base, opacity: 1, blendMode: 'source-over', visible: true },
    ],
  };
}

function semanticSnapshot(decoded) {
  const byKey = new Map(decoded.groups.map(group => [group.key, group.name]));
  return {
    groups: decoded.groups.map(group => ({
      name: group.name,
      parent: byKey.get(group.parentKey) ?? null,
      visible: group.visible,
      collapsed: group.collapsed,
      opacity: Math.round(group.opacity * 255),
      blendMode: group.blendMode,
    })),
    layers: [...decoded.layers, ...decoded.adjustmentLayers]
      .sort((a, b) => a.stackIndex - b.stackIndex)
      .map(layer => ({
        name: layer.name,
        group: byKey.get(layer.groupKey) ?? null,
        visible: layer.visible,
        opacity: Math.round(layer.opacity * 255),
        blendMode: layer.blendMode,
        clipping: layer.clipping,
        pixels: layer.psdAdjustment ? null : Array.from(layer.pixelBuffer.data),
        mask: layer.mask ? {
          disabled: layer.mask.disabled,
          alpha: alpha(layer.mask.pixels),
        } : null,
        adjustment: layer.psdAdjustment ? {
          kind: layer.psdAdjustment.kind,
          parsed: layer.psdAdjustment.parsed,
          blocks: layer.psdAdjustment.blocks.map(block => ({
            key: block.key,
            signature: block.signature,
            sha256: sha256(block.data),
          })),
        } : null,
      })),
  };
}

function reencodeOptions(decoded) {
  return {
    width: decoded.width,
    height: decoded.height,
    composite: rgba([0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]),
    groups: decoded.groups.map(group => ({
      key: group.key, parentKey: group.parentKey, name: group.name,
      visible: group.visible, collapsed: group.collapsed,
      opacity: group.opacity, blendMode: group.blendMode,
    })),
    layers: [...decoded.layers, ...decoded.adjustmentLayers]
      .sort((a, b) => a.stackIndex - b.stackIndex)
      .map(layer => ({
        name: layer.name, groupKey: layer.groupKey, opacity: layer.opacity,
        blendMode: layer.blendMode, visible: layer.visible, clipping: layer.clipping,
        ...(layer.psdAdjustment ? {
          psdAdjustment: {
            kind: layer.psdAdjustment.kind, blocks: layer.psdAdjustment.blocks,
            channelIds: layer.channelIds,
          },
        } : {
          x: layer.x, y: layer.y, width: layer.width, height: layer.height,
          pixels: layer.pixelBuffer.data,
        }),
        ...(layer.mask ? {
          mask: { ...mask(...alpha(layer.mask.pixels)), disabled: layer.mask.disabled },
        } : {}),
      })),
  };
}

test('PSD/PSB compatibility corpus: nested groups, enabled/disabled masks and native clipped adjustment are semantically stable', async () => {
  const fixture = await makeFixture();
  let crossFormat = null;
  for (const [extension, encode, version] of [['PSD', encodePsd, 1], ['PSB', encodePsb, 2]]) {
    const bytes = encode(fixture);
    assert.equal(inspectPsdHeader(bytes).version, version, extension);
    assert.equal(sha256(bytes), sha256(encode(fixture)), extension + ' deterministic generated fixture');
    const first = await decodePsd(bytes);
    assert.equal(first.layers.length, 3, extension);
    assert.equal(first.adjustmentLayers.length, 1, extension);
    assert.deepEqual(first.groups.find(group => group.name === 'Inner').path, ['Outer', 'Inner']);
    assert.deepEqual(alpha(first.layers.find(layer => layer.name === 'Ink masked').mask.pixels), [0, 96, 200, 255]);
    assert.deepEqual(alpha(first.adjustmentLayers[0].mask.pixels), [255, 120, 0, 220]);
    assert.equal(first.layers.find(layer => layer.name === 'Outer masked').mask.disabled, true);
    assert.equal(first.adjustmentLayers[0].clipping, true);
    const snapshot = semanticSnapshot(first);
    const again = await decodePsd(encode(reencodeOptions(first)));
    assert.deepEqual(semanticSnapshot(again), snapshot, extension + ' semantic round-trip');
    if (crossFormat) assert.deepEqual(snapshot, crossFormat, 'PSD/PSB semantic parity');
    else crossFormat = snapshot;
  }
});


// Independent PSD/PSB *wire format* oracle. Do not reuse decoder internals:
// encoder + decoder can agree on the same malformed bytes and pass round-trip.
function nativeLayerRecords(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = offset => view.getUint16(offset, false);
  const i16 = offset => view.getInt16(offset, false);
  const u32 = offset => view.getUint32(offset, false);
  const i32 = offset => view.getInt32(offset, false);
  const textAt = (offset, length) => Buffer.from(bytes.subarray(offset, offset + length)).toString('latin1');
  const version = u16(4);
  assert.equal(textAt(0, 4), '8BPS');
  assert.ok(version === 1 || version === 2);
  assert.equal(u16(22), 8, 'oracle reads 8-bit source only');
  const wide = version === 2;
  const lengthAt = offset => {
    if (!wide) return u32(offset);
    const length = view.getBigUint64(offset, false);
    assert.ok(length <= BigInt(Number.MAX_SAFE_INTEGER));
    return Number(length);
  };
  const lengthBytes = wide ? 8 : 4;
  let pos = 26;
  for (let section = 0; section < 2; section += 1) {
    const count = u32(pos);
    pos += 4 + count; // color mode and image resources
    assert.ok(pos <= bytes.length);
  }
  const layerMaskLength = lengthAt(pos);
  pos += lengthBytes;
  const layerMaskEnd = pos + layerMaskLength;
  assert.ok(layerMaskEnd <= bytes.length);
  const layerInfoLength = lengthAt(pos);
  pos += lengthBytes;
  const layerInfoEnd = pos + layerInfoLength;
  assert.ok(layerInfoEnd <= layerMaskEnd);
  const count = Math.abs(i16(pos));
  pos += 2;
  assert.equal(count, 8, 'four layers + two nested group start/end pairs');

  const records = [];
  for (let index = 0; index < count; index += 1) {
    const rect = [i32(pos), i32(pos + 4), i32(pos + 8), i32(pos + 12)];
    pos += 16;
    const channels = [];
    const channelCount = u16(pos);
    pos += 2;
    for (let channel = 0; channel < channelCount; channel += 1) {
      channels.push({ id: i16(pos), length: lengthAt(pos + 2) });
      pos += 2 + lengthBytes;
    }
    assert.equal(textAt(pos, 4), '8BIM');
    const blendKey = textAt(pos + 4, 4);
    const opacity = bytes[pos + 8];
    const clipping = bytes[pos + 9];
    const flags = bytes[pos + 10];
    pos += 12;
    const extraEnd = pos + 4 + u32(pos);
    pos += 4;
    const maskLength = u32(pos);
    pos += 4;
    let mask = null;
    if (maskLength) {
      assert.equal(maskLength, 20, 'simple Photoshop raster mask header');
      mask = {
        rect: [i32(pos), i32(pos + 4), i32(pos + 8), i32(pos + 12)],
        defaultColor: bytes[pos + 16],
        flags: bytes[pos + 17],
      };
    }
    pos += maskLength;
    pos += 4 + u32(pos); // blending ranges
    const nameStart = pos;
    const nameSize = bytes[pos++];
    const name = textAt(pos, nameSize);
    pos = nameStart + Math.ceil((nameSize + 1) / 4) * 4;
    let sectionDivider = 0;
    while (pos < extraEnd) {
      assert.ok(pos + 12 <= extraEnd);
      assert.ok(['8BIM', '8B64'].includes(textAt(pos, 4)));
      const key = textAt(pos + 4, 4);
      const size = textAt(pos, 4) === '8B64' ? Number(view.getBigUint64(pos + 8, false)) : u32(pos + 8);
      const dataStart = pos + (textAt(pos, 4) === '8B64' ? 16 : 12);
      assert.ok(Number.isSafeInteger(size) && dataStart + size <= extraEnd);
      if (key === 'lsct') sectionDivider = u32(dataStart);
      pos = dataStart + size + (size & 1);
    }
    assert.equal(pos, extraEnd);
    records.push({ name, rect, channels, blendKey, opacity, clipping, flags, mask, sectionDivider });
  }

  // Native channel byte ranges follow *all* layer-record metadata, not
  // individual records. Verify PackBits rows in the -2 channel independently.
  for (const record of records) {
    for (const channel of record.channels) {
      const start = pos;
      pos += channel.length;
      assert.ok(pos <= layerInfoEnd, 'channel must stay inside layer info');
      if (channel.id !== -2) continue;
      assert.ok(record.mask, 'mask channel requires an extra-data mask header');
      const [top, left, bottom, right] = record.mask.rect;
      const width = right - left;
      const height = bottom - top;
      assert.ok(width > 0 && height > 0 && width * height <= 16);
      assert.equal(u16(start), 1, 'mask uses PackBits');
      const rowSizes = [];
      let cursor = start + 2;
      for (let y = 0; y < height; y += 1) {
        rowSizes.push(wide ? u32(cursor) : u16(cursor));
        cursor += wide ? 4 : 2;
      }
      const samples = [];
      for (const rowSize of rowSizes) {
        const rowEnd = cursor + rowSize;
        assert.ok(rowEnd <= pos);
        const row = [];
        while (cursor < rowEnd) {
          const command = (bytes[cursor++] << 24) >> 24;
          if (command >= 0) {
            const count = command + 1;
            assert.ok(cursor + count <= rowEnd);
            row.push(...bytes.subarray(cursor, cursor + count));
            cursor += count;
          } else if (command !== -128) {
            assert.ok(cursor < rowEnd);
            const sample = bytes[cursor++];
            for (let repeat = 0; repeat < 1 - command; repeat += 1) row.push(sample);
          }
        }
        assert.equal(row.length, width);
        samples.push(...row);
      }
      assert.equal(cursor, pos, 'mask channel must consume precisely its own rows');
      channel.samples = samples;
    }
  }
  return records;
}

test('PSD/PSB mask corpus: native layer metadata and PackBits alpha agree with independent byte oracle', async () => {
  const fixture = await makeFixture();
  for (const [kind, encode] of [['PSD', encodePsd], ['PSB', encodePsb]]) {
    const records = nativeLayerRecords(encode(fixture));
    assert.deepEqual(records.map(record => [record.name, record.sectionDivider]), [
      ['</Layer group>', 3],
      ['</Layer group>', 3],
      ['Ink masked', 0],
      ['Clipped adjustment', 0],
      ['Inner', 2],
      ['Outer masked', 0],
      ['Outer', 1],
      ['Ungrouped', 0],
    ], kind + ' native group boundaries');

    const expectedMasks = new Map([
      ['Ink masked', [0, 96, 200, 255]],
      ['Clipped adjustment', [255, 120, 0, 220]],
      ['Outer masked', [40, 120, 200, 255]],
    ]);
    for (const record of records) {
      const expected = expectedMasks.get(record.name);
      const channel = record.channels.find(entry => entry.id === -2);
      if (!expected) {
        assert.equal(record.mask, null, record.name + ' must not have a mask');
        assert.equal(channel, undefined, record.name + ' must not have a mask channel');
        continue;
      }
      assert.deepEqual(record.mask.rect, [0, 0, 2, 2], record.name);
      assert.equal(record.mask.defaultColor, 255, record.name);
      assert.equal(Boolean(record.mask.flags & 0x02), record.name === 'Outer masked', record.name + ' disabled flag');
      assert.deepEqual(channel?.samples, expected, record.name + ' direct channel pixels');
    }
    assert.equal(records.find(record => record.name === 'Clipped adjustment').clipping, 1);
    assert.equal(records.find(record => record.name === 'Inner').opacity, 153);
    assert.equal(records.find(record => record.name === 'Inner').flags & 0x02, 0x02, 'hidden inner group');
    assert.equal(records.find(record => record.name === 'Outer').flags & 0x02, 0, 'visible outer group');
  }
});

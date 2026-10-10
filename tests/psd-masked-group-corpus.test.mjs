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

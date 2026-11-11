import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePsd, encodePsb, decodePsd, PsdImportError } from '../src/formats/psd.js';

const layers = [{
  name: 'Raster', x: 0, y: 0, width: 1, height: 1,
  pixels: Uint8Array.from([128, 64, 32, 255]),
  opacity: 1, blendMode: 'source-over', visible: true,
}];
const base = {
  width: 1, height: 1, layers,
  composite: Uint8Array.from([128, 64, 32, 255]),
};
const path = index => ({
  name: `Path ${index}`,
  subpaths: [{ closed: true, operation: 'add', points: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
  ] }],
});

test('PSD/PSB must reject more saved paths than 2000..2997 can represent, never silently discard', () => {
  const paths = Array.from({ length: 999 }, (_, index) => path(index));
  for (const encode of [encodePsd, encodePsb]) {
    assert.throws(() => encode({ ...base, paths }), error =>
      error instanceof PsdImportError && error.code === 'PSD_EXPORT_PATH_RESOURCE_LIMIT');
  }
});

test('PSD/PSB accept all 998 distinct saved path resources without truncation', async () => {
  const paths = Array.from({ length: 998 }, (_, index) => path(index));
  for (const encode of [encodePsd, encodePsb]) {
    const decoded = await decodePsd(encode({ ...base, paths }));
    assert.equal(decoded.paths.length, 998);
    assert.equal(decoded.paths[0].name, 'Path 0');
    assert.equal(decoded.paths.at(-1).name, 'Path 997');
  }
});

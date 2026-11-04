import test from 'node:test';
import assert from 'node:assert/strict';
import { instrumentBrowserKernelSource } from '../tools/browser-inpaint-mid-kernel-smoke.mjs';

const MARKER = '    pending[index] = 0;\n    donorIndex[index] = bestDonor;\n    filled += 1;';
const SUPPLIER = '/* ZeTer tiled Content-Aware Worker. Generated; do not edit. */\n' +
  'function* inpaintSelectedSamplesSteps() {\n' + MARKER + '\n}';

test('010B: test-only browser probe anchors strictly AFTER the real native kernel write', () => {
  const result = instrumentBrowserKernelSource(SUPPLIER);
  assert.ok(result.includes(MARKER), 'original pixel write and ownership updates are preserved');
  assert.ok(result.indexOf('zpe-test-native-kernel-write') > result.indexOf(MARKER));
  assert.ok(result.includes('changedSample:Number(data[targetOffset])'));
  assert.ok(result.includes('performance.now() + 6000'));
  assert.ok(result.includes('width >= 40'), 'small post-cancel successor does not stall');
  assert.equal((result.match(/zpe-test-native-kernel-write/g) || []).length, 1);
  const uiSized = instrumentBrowserKernelSource(SUPPLIER,{minimumWidth:9});
  assert.ok(uiSized.includes('width >= 9 && filled === 1'));
  assert.throws(() => instrumentBrowserKernelSource(SUPPLIER,{minimumWidth:0}),/invalid minimum width/);
  assert.throws(() => instrumentBrowserKernelSource(SUPPLIER,{minimumWidth:1.5}),/invalid minimum width/);
  assert.equal(SUPPLIER.includes('zpe-test-native-kernel-write'), false,
    'the original generated Worker source must be unchanged');
});

test('010B: fail closed if the production kernel write anchor changes or duplicates', () => {
  assert.throws(() => instrumentBrowserKernelSource(SUPPLIER.replace(MARKER, 'filled++;')),
    /kernel write anchor changed/);
  assert.throws(() => instrumentBrowserKernelSource(SUPPLIER + '\n' + MARKER),
    /kernel write anchor changed/);
  assert.throws(() => instrumentBrowserKernelSource('unknown Worker source\n' + MARKER),
    /kernel write anchor changed/);
});

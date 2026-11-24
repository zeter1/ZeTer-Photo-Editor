import test from 'node:test';
import assert from 'node:assert/strict';
import * as adjustments from '../src/core/adjustments.js';

const rgba = (...values) => ({data: Uint8ClampedArray.from(values)});

for (const [mode, expected] of [
  ['difference', [51,161,177,160]],
  ['exclusion', [61,170,188,160]],
]) {
  test(mode + ' clipping stack blends once over translucent backdrop', () => {
    const target = rgba(64,179,219,128);
    const source = rgba(32,223,223,64);
    adjustments.compositeClippingStackPixels(target, source, mode);
    assert.deepEqual([...target.data], expected);
    assert.deepEqual([...source.data], [32,223,223,64]);
  });

  test(mode + ' clipping stack preserves transparent and opaque boundaries', () => {
    const target = rgba(64,179,219,128, 0,0,0,0, 10,20,30,255);
    const source = rgba(255,255,255,0, 32,223,223,64, 255,0,255,255);
    adjustments.compositeClippingStackPixels(target, source, mode);
    assert.deepEqual([...target.data], [64,179,219,128, 32,223,223,64, 245,20,225,255]);
  });
}


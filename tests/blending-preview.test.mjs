import test from 'node:test';
import assert from 'node:assert/strict';
import { blendingPreviewCrop, syncBlendingPreviewCanvas } from '../src/ui/layer-blending-controller.js';

test('blending preview crop stays centered, padded and bounded by the document', () => {
  const documentValue = { width:1000, height:800 };
  const layer = { x:400, y:300, width:200, height:80, scaleX:1, scaleY:1, rotation:0 };
  assert.deepEqual(blendingPreviewCrop(documentValue, layer), { x:220, y:120, width:560, height:440 });
  const oversized = blendingPreviewCrop(
    { width:120, height:90 },
    { x:-500, y:-500, width:400, height:400, scaleX:1, scaleY:1, rotation:0 },
  );
  assert.deepEqual(oversized, { x:0, y:0, width:120, height:90 });
});

test('blending preview copies the accepted composite around the layer and follows resize', () => {
  const draws = [];
  const context = { clearRect(){}, drawImage(...args){ draws.push(args); } };
  const sourceCanvas = { width:1000, height:800 };
  const previewCanvas = { clientWidth:500, clientHeight:200, width:0, height:0, isConnected:true, getContext:() => context };
  const layer = { id:'layer-1' };
  const documentValue = { width:1000, height:800, layers:[layer] };
  const preview = { document:documentValue, layer, canvas:previewCanvas, crop:{ x:220, y:120, width:560, height:440 } };
  const windowTarget = { devicePixelRatio:1.5 };
  assert.equal(syncBlendingPreviewCanvas(preview, { documentValue, sourceCanvas, windowTarget }), true);
  assert.equal(draws.length, 1);
  assert.equal(draws[0][0], sourceCanvas);
  assert.deepEqual(draws[0].slice(1, 5), [220, 120, 560, 440]);
  assert.equal(previewCanvas.width, 750);
  assert.equal(previewCanvas.height, 300);
  previewCanvas.clientWidth = 600; previewCanvas.clientHeight = 300;
  assert.equal(syncBlendingPreviewCanvas(preview, { documentValue, sourceCanvas, windowTarget }), true);
  assert.equal(previewCanvas.width, 900);
  assert.equal(previewCanvas.height, 450);
  documentValue.layers = [];
  assert.equal(syncBlendingPreviewCanvas(preview, { documentValue, sourceCanvas, windowTarget }), false);
  assert.equal(draws.length, 2);
});

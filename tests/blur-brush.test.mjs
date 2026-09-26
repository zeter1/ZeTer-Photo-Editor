import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const retouch = await readFile(new URL('../src/retouch/controller.js', import.meta.url), 'utf8');
const toolConfig = await readFile(new URL('../src/ui/tool-config.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('blur brush is exposed as a first-class tool with strength control and shortcut', () => {
  assert.match(index, /data-tool="blur"/);
  assert.match(index, /id="blurStrength"/);
  assert.match(toolConfig, /blur: 'Кисть размытия'/);
  assert.match(main, /KeyR:'blur'/);
  assert.match(main, /tool === 'blur'/);
});

test('blur brush edits only an existing editable raster layer', () => {
  const ensurePaintLayer = main.match(/async function ensurePaintLayer\(point, canContinue = \(\) => true\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(ensurePaintLayer, 'ensurePaintLayer function not found');
  assert.match(ensurePaintLayer, /\['eraser','blur',[\s\S]*?\]\.includes\(currentTool\)[\s\S]*?l = rasterAtPoint;[\s\S]*?if \(!l\) return null/);
});

test('blur brush uses localized buffers and a feathered edge instead of reprocessing the full layer', () => {
  const dab = retouch.match(/function applyBlurDab\(layer, point, pointerEvent = null\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(dab, 'applyBlurDab function not found');
  assert.match(dab, /ensureBlurScratch\(width, height\)/);
  assert.match(dab, /softenedCtx\.filter\s*=\s*`blur\(\$\{blurRadius\}px\)`/);
  assert.match(dab, /applyBlurBrushPixels\(/);
  assert.match(dab, /imageData\.data,blurredData\.data/);
  assert.match(dab, /strokeCoverage:drag\?\.blurCoverage/);
  assert.doesNotMatch(dab, /canvasToDataURL|toDataURL|toBlob/);
});

test('blur stroke is continuous and history receives a dedicated label', () => {
  assert.match(retouch, /function blurStrokeSegment\(layer, from, to, pointerEvent = null\)/);
  assert.match(main, /Math\.ceil\(distance \/ spacing\)/);
  assert.match(main, /drag\.tool === 'blur'/);
  assert.match(main, /blur:'Размытие кистью'/);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION } from '../src/core/state.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Function ${name} not found`);
  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `Function ${name} has no body`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = bodyStart; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Function ${name} body is not balanced`);
}

const imageDialog = extractNamedFunction(main, 'resizeImageDialog');
const canvasDialog = extractNamedFunction(main, 'resizeCanvasDialog');

for (const [name, source] of [['изображения', imageDialog], ['холста', canvasDialog]]) {
  test(`изменение размера ${name} ждёт завершения правки и снимает старое выделение`, () => {
    let pending = true;
    let modal;
    let selectionClears = 0;
    let commits = 0;
    const context = {
      doc: { width:10, height:10, layers:[{ x:2, y:3, width:5, height:5, scaleX:1, scaleY:1 }] },
      showModal: options => { modal = options; },
      blockPendingDocumentEdit: () => pending,
      checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION,
      clearSelectionState: () => { selectionClears++; },
      commit: () => { commits++; }, fitToView: () => {}, toast: () => {}, setStatus: () => {},
      brushCanvas: null, brushCtx: null, brushLayerId: null, cropRect: null,
    };
    const functionName = name === 'изображения' ? 'resizeImageDialog' : 'resizeCanvasDialog';
    runInNewContext(`${source}\nglobalThis.dialog = ${functionName};`, context);
    context.dialog();
    assert.equal(modal, undefined);
    pending = false;
    context.dialog();
    assert.ok(modal);
    pending = true;
    assert.equal(modal.onSubmit({ width:'20', height:'20', anchor:'center' }), false);
    assert.equal(context.doc.width,10);
    pending = false;
    modal.onSubmit({ width:'20', height:'20', anchor:'center' });
    assert.equal(context.doc.width,20);
    assert.equal(selectionClears,1);
    assert.equal(commits,1);
  });
}
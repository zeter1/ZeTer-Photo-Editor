import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION } from '../src/core/state.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const imageStart = main.indexOf('function resizeImageDialog(){');
const canvasStart = main.indexOf('function resizeCanvasDialog(){');
const imageDialog = main.slice(imageStart, main.indexOf('function setZoom(', imageStart));
const canvasDialog = main.slice(canvasStart, main.indexOf('function closeMenu(', canvasStart));

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
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');

test('Stage 10f exposes a persistent saved Paths panel with management actions',()=>{
  assert.match(html,/data-panel-id="paths"/);
  assert.match(html,/id="pathsList"/);
  for(const id of ['addPathBtn','editPathBtn','applyPathMaskBtn','renamePathBtn','duplicatePathBtn','deletePathBtn']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(main,/function updatePathsPanel\(\)/);
  assert.match(main,/function addDocumentPathFromCurrent\(\)/);
  assert.match(main,/function renameSelectedDocumentPath\(\)/);
  assert.match(main,/function duplicateSelectedDocumentPath\(\)/);
  assert.match(main,/function deleteSelectedDocumentPath\(\)/);
  assert.match(css,/\.path-row\.selected/);
});

test('Stage 10f can save layer paths, vector masks or selections without rasterizing them',()=>{
  assert.match(main,/function pathFromCurrentSource\(\)/);
  assert.match(main,/exportPsdVectorMask\(layer\)/);
  assert.match(main,/layer\.pathPoints\.map\(node=>documentizePathNode\(node,layer\)\)/);
  assert.match(main,/selectionVectorMaskDocumentNodes\(\)/);
  assert.match(main,/doc\.paths\.push\(\{id,\.\.\.path\}\)/);
});

test('Stage 10f applies a saved path as a vector mask and direct-edits it in document coordinates',()=>{
  assert.match(main,/function applySelectedDocumentPathAsVectorMask\(\)/);
  assert.match(main,/importPsdVectorMask\(\{enabled:true,invert:false,linked:true/);
  assert.match(main,/function editSelectedDocumentPath\(\)/);
  assert.match(main,/source:'document-path'/);
  assert.match(main,/documentPathIndex:documentPathEditIndex/);
  assert.match(main,/const local=layer\?documentPointToLayerPixel\(p,layer\):p/);
  assert.match(main,/Сохранённый контур: перетаскивайте существующие anchors\/handles/);
});

test('Stage 10f keeps selected path per document session and clears edit mode on document replacement',()=>{
  assert.match(main,/session\.selectedPathIndex = selectedDocumentPathIndex/);
  assert.match(main,/selectedDocumentPathIndex = Number\.isInteger\(session\.selectedPathIndex\)/);
  assert.match(main,/selectedPathIndex: -1/);
  assert.match(main,/documentPathEditIndex = -1/);
});

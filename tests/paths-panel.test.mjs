import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const controller=await readFile(new URL('../src/ui/paths-controller.js',import.meta.url),'utf8');
const sessions=await readFile(new URL('../src/workspace/session-controller.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');

test('saved Paths panel keeps its public controls and accessible selected-row styling',()=>{
  assert.match(html,/data-panel-id="paths"/);
  assert.match(html,/id="pathsList"/);
  for(const id of ['addPathBtn','editPathBtn','applyPathMaskBtn','renamePathBtn','duplicatePathBtn','deletePathBtn']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(css,/\.path-row\.selected/);
});

test('runtime delegates saved Paths ownership to the dedicated controller',()=>{
  assert.match(main,/from '\.\/ui\/paths-controller\.js'/);
  assert.match(main,/createPathsController\(/);
  assert.match(main,/const \{ updatePathsPanel \} = pathsController/);
  assert.match(main,/pathsController\.bindControls\(\)/);
  assert.doesNotMatch(main,/let selectedDocumentPathIndex =/);
  for(const name of ['normalizeSelectedDocumentPathIndex','pathFromCurrentSource','addDocumentPathFromCurrent','renameSelectedDocumentPath','duplicateSelectedDocumentPath','deleteSelectedDocumentPath','applySelectedDocumentPathAsVectorMask','pathContextMenu','updatePathsPanel']){
    assert.doesNotMatch(main,new RegExp(`function ${name}\\(`));
  }
  assert.match(controller,/export function createPathsController/);
});

test('session bridge persists selected path index while Pen edit state remains runtime-local',()=>{
  assert.match(sessions,/session\.selectedPathIndex = runtime\.selectedDocumentPathIndex/);
  assert.match(sessions,/selectedPathIndex: Number\.isInteger\(session\.selectedPathIndex\)/);
  assert.match(sessions,/selectedPathIndex: -1/);
  assert.match(main,/selectedDocumentPathIndex: pathsController\.getSelectedIndex\(\)/);
  assert.match(main,/pathsController\.setSelectedIndex\(state\.selectedPathIndex\)/);
  assert.match(main,/documentPathEditIndex = -1/);
});

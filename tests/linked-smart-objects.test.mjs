import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDocument, createSmartObjectLayer, createSmartObjectLinkId, linkedSmartObjectLayers,
  addLayer, duplicateLayer, sanitizeProject, snapshotDocument,
} from '../src/core/state.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');

test('linked smart-object source IDs survive project round-trip and remain bounded',()=>{
  const doc=createDocument({name:'linked',width:100,height:100});
  const linkedSourceId=createSmartObjectLinkId();
  addLayer(doc,createSmartObjectLayer({
    name:'Linked A',width:20,height:20,previewDataUrl:'data:image/png;base64,AAAA',
    embeddedDocument:createDocument({name:'embedded',width:20,height:20}),linkedSourceId,
  }));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(safe.layers[0].linkedSourceId,linkedSourceId);
  const malformed=sanitizeProject({
    version:1,name:'bounded',width:20,height:20,background:'transparent',
    layers:[{id:'so',type:'smart-object',name:'SO',width:10,height:10,linkedSourceId:'x'.repeat(400)}],
  });
  assert.equal(malformed.layers[0].linkedSourceId.length,160);
});

test('linked smart-object duplication preserves shared source but independent layer/document identity',()=>{
  const doc=createDocument({name:'parent',width:100,height:100});
  const linkedSourceId=createSmartObjectLinkId();
  const source=addLayer(doc,createSmartObjectLayer({
    name:'Source',width:20,height:20,linkedSourceId,
    embeddedDocument:createDocument({name:'inside',width:20,height:20}),
  }));
  const copy=duplicateLayer(doc,source.id);
  assert.ok(copy);
  assert.notEqual(copy.id,source.id);
  assert.equal(copy.linkedSourceId,linkedSourceId);
  assert.notEqual(copy.embeddedDocument,source.embeddedDocument);
  assert.equal(linkedSmartObjectLayers(doc,linkedSourceId).length,2);
});

test('unlinked smart-object copies remain independent until user explicitly creates a linked copy',()=>{
  const doc=createDocument({name:'parent',width:100,height:100});
  const source=addLayer(doc,createSmartObjectLayer({name:'Source',width:20,height:20}));
  const copy=duplicateLayer(doc,source.id);
  assert.equal(source.linkedSourceId,null);
  assert.equal(copy.linkedSourceId,null);
  assert.deepEqual(linkedSmartObjectLayers(doc,null),[]);
});

test('Linked Smart Objects Stage 11c wires shared content tabs, propagation, unlink and UI commands',()=>{
  assert.ok(main.includes('function createLinkedSmartObjectCopy(layer=selected())'));
  assert.ok(main.includes('function unlinkSmartObject(layer=selected())'));
  assert.ok(main.includes('session.smartObjectLink?.linkedSourceId===linkedSourceId'));
  assert.ok(main.includes('linkedSmartObjectLayers(parentSession.doc,linkedSourceId)'));
  assert.ok(main.includes("parentSession.history.push(liveTargets.length>1?'Обновить связанные смарт-объекты':'Обновить смарт-объект'"));
  assert.ok(main.includes('Создать связанную копию смарт-объекта'));
  assert.ok(main.includes('Разорвать связь смарт-объекта'));
  assert.ok(main.includes('data-smart-object-link-copy'));
  assert.ok(main.includes('data-smart-object-unlink'));
});

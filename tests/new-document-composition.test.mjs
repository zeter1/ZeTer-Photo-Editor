import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [main, build, owner] = await Promise.all([
  readFile(new URL('src/main.js', root), 'utf8'),
  readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
  readFile(new URL('src/document/new-document-controller.js', root), 'utf8'),
]);

test('New Document lifecycle stays in its canonical owner', () => {
  assert.match(main, /from '\.\/document\/new-document-controller\.js'/);
  assert.match(owner, /export function createNewDocumentController/);
  assert.match(main, /const newDocumentController = createNewDocumentController\(\{/);
  assert.match(main, /getDocument: \(\) => doc,/);
  assert.match(main, /getActiveSessionId: \(\) => activeSessionId,/);
  assert.match(main, /getDocumentChangeSerial: \(\) => documentChangeSerial,/);
  assert.doesNotMatch(main, /function createNewDialog\(/);
  assert.doesNotMatch(main, /function canReplaceDocument\(/);
  assert.match(main, /\['Новый…','Ctrl\+N',newDocumentController\.open\]/);
  assert.match(main, /e\.shiftKey\?addBlankLayer\(\):newDocumentController\.open\(\)/);
  assert.match(main, /startNewProject: \(\) => newDocumentController\.open\(\)/);
  assert.equal((main.match(/canReplaceDocument: newDocumentController\.canReplaceDocument/g) || []).length, 2);
});

test('classic file bundle places New Document owner before main', () => {
  const ownerIndex = build.indexOf("'src/document/new-document-controller.js'");
  const mainIndex = build.indexOf("'src/main.js'");
  assert.ok(ownerIndex >= 0, 'New Document owner is missing from bundle graph');
  assert.ok(mainIndex >= 0, 'main.js is missing from bundle graph');
  assert.ok(ownerIndex < mainIndex, 'New Document owner must evaluate before main.js');
});

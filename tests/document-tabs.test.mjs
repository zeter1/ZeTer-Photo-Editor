import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const smartObjects = await readFile(new URL("../src/document/smart-object-controller.js", import.meta.url), "utf8");
const sessions = await readFile(new URL("../src/workspace/session-controller.js", import.meta.url), "utf8");
const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("stage header exposes a tablist and add-tab button", () => {
  assert.match(html, /id="docTabs"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-label="Документы"/);
  assert.match(html, /id="addDocTabBtn"/);
});

test("editor maintains switchable document sessions for multiple tabs", () => {
  assert.match(main, /let documentSessions = \[\]/);
  assert.match(main, /let activeSessionId = ''/);
  assert.match(sessions, /function renderDocumentTabs\(\)/);
  assert.match(sessions, /function activateDocumentTab\(id/);
  assert.match(sessions, /function addDocumentTab\(/);
  assert.match(sessions, /function closeDocumentTab\(id\)/);
  assert.match(sessions, /session\.history = runtime\.history/);
  assert.match(sessions, /session\.zoom = runtime\.zoom/);
  assert.match(sessions, /session\.dirty = runtime\.dirty/);
  assert.match(main, /documentSessions\.some\(session=>session\.dirty\)/);
});

test("tabs UI styles keep the add button directly after the last tab", () => {
  assert.match(css, /\.doc-tabs-strip \{ flex: 0 1 auto; width: max-content; max-width: calc\(100% - 30px\)/);
  assert.match(css, /\.doc-tab-shell\.active/);
  assert.match(css, /\.doc-tab-close/);
  assert.match(css, /\.doc-tab-add/);
  assert.match(html, /id="docTabs"[^>]*><\/div>\s*<button id="addDocTabBtn"/);
});

test("smart object content tabs link to parent sessions and save back through parent history", () => {
  assert.match(sessions, /smartObjectLink: smartObjectLink \? \{ \.\.\.smartObjectLink \} : null/);
  assert.match(smartObjects, /function openContents\(/);
  assert.match(smartObjects, /smartObjectLink:\{/);
  assert.match(smartObjects, /parentSessionId,/);
  assert.match(smartObjects, /layerId:layer\.id/);
  assert.match(smartObjects, /function saveContent\(/);
  assert.match(smartObjects, /parentSession\.history\.push\(/);
  assert.match(smartObjects, /parentSession\.dirty = true/);
  assert.match(smartObjects, /session\.dirty = false/);
  assert.match(main, /openContents: openSmartObjectContents/);
  assert.match(main, /saveContent: saveSmartObjectContent/);
});

test("smart object parent tab cannot close while linked content tabs remain open", () => {
  assert.match(sessions, /item => item\.smartObjectLink\?\.parentSessionId === session\.id/);
  assert.match(sessions, /Сначала закройте вкладки содержимого смарт-объектов этого документа/);
});

test("smart object workflow is bounded and respects layer locks", () => {
  assert.match(smartObjects, /function sessionDepth\(/);
  assert.match(smartObjects, /sessionDepth\(\) >= maxNestedDepth/);
  assert.match(smartObjects, /Смарт-объект или его группа заблокированы/);
  assert.match(smartObjects, /Родительский смарт-объект заблокирован/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
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
  assert.match(main, /function renderDocumentTabs\(\)/);
  assert.match(main, /function activateDocumentTab\(id/);
  assert.match(main, /function addDocumentTab\(/);
  assert.match(main, /function closeDocumentTab\(id\)/);
  assert.match(main, /session\.history = history/);
  assert.match(main, /session\.zoom = zoom/);
  assert.match(main, /session\.dirty = dirty/);
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
  assert.match(main, /smartObjectLink: smartObjectLink \? \{ \.\.\.smartObjectLink \} : null/);
  assert.match(main, /function openSmartObjectContents\(/);
  assert.match(main, /smartObjectLink:\{parentSessionId,layerId:layer\.id,linkedSourceId,photoshopSourceId\}/);
  assert.match(main, /function saveSmartObjectContent\(/);
  assert.match(main, /parentSession\.history\.push\(liveTargets\.length>1\?'Обновить общий источник смарт-объектов':'Обновить смарт-объект'/);
  assert.match(main, /parentSession\.dirty=true/);
  assert.match(main, /session\.dirty=false;dirty=false/);
});

test("smart object parent tab cannot close while linked content tabs remain open", () => {
  assert.match(main, /item=>item\.smartObjectLink\?\.parentSessionId===session\.id/);
  assert.match(main, /Сначала закройте вкладки содержимого смарт-объектов этого документа/);
});

test("smart object workflow is bounded and respects layer locks", () => {
  assert.match(main, /function smartObjectSessionDepth\(/);
  assert.match(main, /smartObjectSessionDepth\(\)>=3/);
  assert.match(main, /Смарт-объект или его группа заблокированы/);
  assert.match(main, /Родительский смарт-объект заблокирован/);
});

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
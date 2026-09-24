import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const render=await readFile(new URL('../src/core/render.js',import.meta.url),'utf8');
const state=await readFile(new URL('../src/core/state.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');

test('requested advanced tools have dedicated vector icons and toolbar controls',()=>{
  for(const tool of ['heal','smudge','gradient','pen','magnetic','wand'])assert.match(html,new RegExp(`data-tool="${tool}"`));
  for(const icon of ['heal','smudge','gradient','pen','magnetic-lasso','wand'])assert.match(html,new RegExp(`id="icon-${icon}"`));
  assert.match(html,/id="smudgeStrength"/);assert.match(html,/id="gradientType"/);assert.match(html,/id="penClosed"/);
});

test('desktop toolbar uses a readable two-column layout with a compact narrow-screen fallback',()=>{
  assert.match(css,/grid-template-columns: 86px minmax\(0, 1fr\) 286px/);
  assert.match(css,/\.toolbar \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css,/@media \(max-width: 900px\)/);
});

test('every toolbar tool receives a rich accessible tooltip instead of a short native title',()=>{
  assert.match(main,/const TOOL_HELP = \{/);
  for(const tool of ['move','marquee','brush','clone','heal','smudge','dodge','burn','blur','eraser','fill','gradient','pen','magnetic','wand','line','text','shape','crop','eyedropper','hand','zoom'])assert.match(main,new RegExp(`${tool}:\\{shortcut:`));
  assert.match(main,/button\.removeAttribute\('title'\)/);
  assert.match(main,/button\.setAttribute\('aria-describedby',tooltip\.id\)/);
  assert.match(css,/\.tool-tooltip \{/);
});

test('about dialog identifies the developer and exposes safe contact links',()=>{
  assert.match(main,/Дмитрий Колесниченко/);
  assert.match(main,/href="mailto:zeter11@gmail\.com"/);
  assert.match(main,/href="https:\/\/t\.me\/zeterchat" target="_blank" rel="noopener noreferrer"/);
  assert.match(css,/\.developer-card \{/);
});

test('selected layer is highlighted on canvas outside move mode with corners and a name badge',()=>{
  assert.match(main,/if \(!layer \|\| !isLayerVisible\(doc, layer\) \|\| !isTransformableLayer\(layer\)\) return/);
  assert.match(main,/function isTransformableLayer\(layer\) \{ return Boolean\(layer\) && layer\.type !== 'adjustment'; \}/);
  assert.doesNotMatch(main,/!layer \|\| currentTool !== 'move' \|\| !isLayerVisible/);
  assert.match(main,/const moveMode=currentTool==='move'/);
  assert.match(main,/for\(const point of frame\.corners\)/);
  assert.match(main,/const label=String\(layer\.name\|\|'Слой'\)/);
  assert.match(main,/ctx\.roundRect\(labelX,labelY,labelWidth,labelHeight/);
});

test('smudge strength, healing source, gradient, edge snapping and wand selection are wired',()=>{
  assert.match(main,/function applySmudgeDab\(from,to,pointerEvent=null\)/);
  assert.match(main,/els\.smudgeStrength\?\.value/);
  assert.match(main,/healing\?'soft-light':'source-over'/);
  assert.match(main,/async function applyGradient\(start,end\)/);
  assert.match(main,/function findMagneticEdgePoint\(point\)/);
  assert.match(main,/function magicWandSelect\(point\)/);
  assert.match(main,/const selectedMask=new Uint8Array\(total\)/);
});

test('pen creates backward-compatible cubic Bezier paths with draggable handles',()=>{
  assert.match(main,/function beginPenPoint\(point,finish=false\)/);
  assert.match(main,/kind:'pen-handle'/);
  assert.match(main,/handleIn/);
  assert.match(main,/handleOut/);
  assert.match(main,/function tracePenDraftPath/);
  assert.match(main,/bezierCurveTo/);
  assert.match(main,/shape:'path'/);
  assert.match(render,/function traceLayerBezierPath/);
  assert.match(render,/ctx\.bezierCurveTo/);
  assert.match(state,/\['rect', 'ellipse', 'line', 'path'\]/);
  assert.match(state,/sanitizePathPoint/);
});

test('gradient and crop provide useful live previews before committing',()=>{
  assert.match(main,/function previewGradient\(start,end\)/);
  assert.match(main,/ctx\.fillStyle=gradient/);
  assert.match(main,/drag\.kind === 'gradient'[\s\S]*?previewGradient\(drag\.start,p\)/);
  assert.match(main,/for \(const fraction of \[1 \/ 3, 2 \/ 3\]\)/);
});
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createDocument, createTextLayer, addLayer, snapshotDocument, sanitizeProject, documentWithTextPreview } from '../src/core/state.js';
import { ensureTextFont, renderLayer } from '../src/core/render.js';

test('custom text font and typography survive project reopening', () => {
  const doc = createDocument();
  addLayer(doc, createTextLayer({
    text: 'Пример', fontFamily: 'ZPE-font-example', fontData: 'data:font/woff2;base64,AA==',
    fontLabel: 'Мой шрифт.woff2', fontWeight: '700', fontStyle: 'italic', align: 'center', lineHeight: 1.6,
    letterSpacing: 2, underline: true, strikeThrough: true,
  }));
  const reopened = sanitizeProject(JSON.parse(snapshotDocument(doc))).layers[0];
  assert.equal(reopened.fontFamily, 'ZPE-font-example');
  assert.equal(reopened.fontData, 'data:font/woff2;base64,AA==');
  assert.equal(reopened.fontLabel, 'Мой шрифт.woff2');
  assert.equal(reopened.fontWeight, '700');
  assert.equal(reopened.fontStyle, 'italic');
  assert.equal(reopened.align, 'center');
  assert.equal(reopened.lineHeight, 1.6);
  assert.equal(reopened.letterSpacing, 2);
  assert.equal(reopened.underline, true);
  assert.equal(reopened.strikeThrough, true);
});

test('live text preview replaces or adds a render layer without editing the document', () => {
  const doc=createDocument();
  const original=addLayer(doc,createTextLayer({text:'До'}));
  const replacement=createTextLayer({...original,text:'После'});
  const edited=documentWithTextPreview(doc,{document:doc,originalId:original.id,layer:replacement});
  assert.equal(edited.layers.length,1);
  assert.equal(edited.layers[0].text,'После');
  assert.equal(doc.layers[0].text,'До');
  assert.equal(documentWithTextPreview(doc,null),doc);
  const draft=createTextLayer({text:'Новый'});
  const created=documentWithTextPreview(doc,{document:doc,originalId:null,layer:draft});
  assert.equal(created.layers.length,2);
  assert.equal(doc.layers.length,1);
  assert.equal(documentWithTextPreview(createDocument(),{document:doc,originalId:null,layer:draft}).layers.length,0);
});

test('invalid embedded fonts and text settings are rejected on open', () => {
  const doc = createDocument();
  addLayer(doc, createTextLayer({
    fontData: 'https://example.com/font.woff2', fontLabel: 'bad', fontWeight: '900',
    fontStyle: 'something', align: 'other', lineHeight: 100,
  }));
  const reopened = sanitizeProject(JSON.parse(snapshotDocument(doc))).layers[0];
  assert.equal(reopened.fontData, null);
  assert.equal(reopened.fontLabel, '');
  assert.equal(reopened.fontWeight, '400');
  assert.equal(reopened.fontStyle, 'normal');
  assert.equal(reopened.align, 'left');
  assert.equal(reopened.lineHeight, 3);
});

test('embedded font loads once before canvas use', async () => {
  const previousFace = globalThis.FontFace;
  const previousDocument = globalThis.document;
  const calls = [];
  globalThis.FontFace = class {
    constructor(family, source) { calls.push([family, source]); }
    async load() { return this; }
  };
  globalThis.document = { fonts: { add(face) { calls.push(face); } } };
  try {
    await Promise.all([
      ensureTextFont('ZPE-font-test', 'data:font/woff2;base64,AA=='),
      ensureTextFont('ZPE-font-test', 'data:font/woff2;base64,AA=='),
    ]);
    assert.equal(calls.filter(item => Array.isArray(item)).length, 1);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.FontFace = previousFace;
    globalThis.document = previousDocument;
  }
});

test('text rendering applies typography and decorations to every line', async () => {
  const drawn=[];
  const context={
    letterSpacing:'0px', save(){}, restore(){}, translate(){}, rotate(){}, scale(){},
    measureText(text){return {width:text.length*20};},
    fillText(text,x,y){drawn.push(['text',text,x,y]);},
    fillRect(x,y,width,height){drawn.push(['line',x,y,width,height]);},
  };
  await renderLayer(context,createTextLayer({text:'Раз\nДва',fontSize:20,fontWeight:'700',fontStyle:'italic',
    lineHeight:2,letterSpacing:3,underline:true,strikeThrough:true,width:200}));
  assert.match(context.font,/italic 700 20px/);
  assert.equal(context.letterSpacing,'3px');
  assert.deepEqual(drawn.filter(item=>item[0]==='text').map(item=>item[3]),[0,40]);
  assert.equal(drawn.filter(item=>item[0]==='line').length,4);
});

test('bundled typefaces contain offline Cyrillic and Latin WOFF2 data with licenses', async () => {
  const families=['roboto','opensans','montserrat','notosans','notoserif','rubik',
    'oswald','ptsans','ptserif','lobster','manrope','merriweather'];
  for(const family of families){
    const base=new URL(`../assets/fonts/${family}/`,import.meta.url);
    const [css,license]=await Promise.all([
      readFile(new URL('embedded.css',base),'utf8'),
      readFile(new URL('OFL.txt',base),'utf8'),
    ]);
    assert.match(css,/\/\* cyrillic \*\//);
    assert.match(css,/\/\* latin \*\//);
    assert.doesNotMatch(css,/url\(https?:/);
    const data=css.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/)?.[1];
    assert.ok(data,`${family} has embedded font data`);
    assert.equal(Buffer.from(data,'base64').toString('ascii',0,4),'wOF2');
    assert.match(license,/SIL OPEN FONT LICENSE/);
  }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTextSettingsController } from '../src/ui/text-settings-controller.js';

class FakeFile {
  constructor(name, size = 12) { this.name = name; this.size = size; }
}
function makeSelect(entries = [], value = '') {
  const options = entries.map(([optionValue, textContent]) => ({ value: optionValue, textContent }));
  return { options, value, append(option) { options.push(option); } };
}
function setup({ queryLocalFonts, readFilePort = async () => 'data:application/octet-stream;base64,QQ==', loadFont = async () => {}, createFontFamily = () => 'ZPE-font-test' } = {}) {
  const fontFamilyControl = makeSelect([['Arial, sans-serif', 'Arial']], 'Arial, sans-serif');
  const fontSizeControl = { value:'42' };
  const primaryColorControl = { value:'#123456' };
  const controller = createTextSettingsController({
    fontFamilyControl, fontSizeControl, primaryColorControl,
    documentRef:{ createElement:() => ({ value:'', textContent:'' }) },
    windowTarget:typeof queryLocalFonts === 'function' ? { queryLocalFonts } : {},
    FileClass:FakeFile, readFile:readFilePort, loadFont, createFontFamily,
  });
  return { controller, fontFamilyControl, fontSizeControl, primaryColorControl };
}
function formValues(overrides = {}) {
  return { text:'Пример', fontFamily:'Arial, sans-serif', systemFontName:'', fontFile:null, fontSize:'48', fontWeight:'400', fontStyle:'normal', align:'left', lineHeight:'1.18', letterSpacing:'0', underline:'no', strikeThrough:'no', width:'240', color:'#abcdef', ...overrides };
}

test('local font discovery reports unsupported and permission-denied paths', async () => {
  await assert.rejects(() => setup().controller.loadComputerFonts(makeSelect()), { message:'Этот браузер не показывает список шрифтов компьютера. Можно загрузить файл шрифта ниже.' });
  const denied=setup({queryLocalFonts:async()=>{throw new Error('denied');}}).controller;
  await assert.rejects(() => denied.loadComputerFonts(makeSelect()), { message:'Браузер не разрешил доступ к шрифтам компьютера. Разрешите доступ или загрузите файл шрифта.' });
});

test('local font discovery filters, de-duplicates, ru-sorts and caps at 1000', async () => {
  const names=Array.from({length:1005},(_,index)=>'Шрифт '+String(index).padStart(4,'0'));
  const faces=[...names.map(family=>({family})),{family:names[0]},{family:'   '},{family:'x'.repeat(161)},{family:123}];
  const {controller}=setup({queryLocalFonts:async()=>faces});
  assert.equal(await controller.loadComputerFonts(makeSelect()),1000);
  const expected=[...new Set(names)].sort((a,b)=>a.localeCompare(b,'ru')).slice(0,1000);
  const actual=controller.fontOptions().filter(([value])=>value.startsWith('"Шрифт ')).map(([,label])=>label);
  assert.deepEqual(actual,expected);
});

test('select population preserves selection and does not duplicate existing options', async () => {
  const beta=JSON.stringify('Beta'), alpha=JSON.stringify('Alpha');
  const select=makeSelect([[beta,'Beta']],beta);
  const {controller}=setup({queryLocalFonts:async()=>[{family:'Beta'},{family:'Alpha'},{family:'Beta'}]});
  assert.equal(await controller.loadComputerFonts(select),2);
  assert.equal(select.value,beta);
  assert.equal(select.options.filter(option=>option.value===beta).length,1);
  assert.equal(select.options.filter(option=>option.value===alpha).length,1);
});

test('manual system fonts are normalized, de-duplicated, bounded and reused by option sets', () => {
  const {controller}=setup();
  const first=controller.registerSystemFont('  Segoe UI  ');
  assert.equal(first,JSON.stringify('Segoe UI'));
  assert.equal(controller.registerSystemFont('Segoe UI'),first);
  assert.equal(controller.fontOptions().filter(([value])=>value===first).length,1);
  for(let index=0;index<1001;index+=1)controller.registerSystemFont('Manual '+index);
  const options=controller.fontOptions();
  assert.ok(options.filter(([,label])=>label.startsWith('Manual ')).length<=1000);
  assert.ok(options.some(([value])=>value===JSON.stringify('Manual 1000')));
});

test('custom font validation rejects invalid, empty and oversized files', async () => {
  const {controller}=setup();
  const expected=/Выберите файл WOFF, WOFF2, TTF или OTF размером до 5 МБ/;
  await assert.rejects(()=>controller.readCustomFont(new FakeFile('font.txt',12)),expected);
  await assert.rejects(()=>controller.readCustomFont(new FakeFile('font.woff2',0)),expected);
  await assert.rejects(()=>controller.readCustomFont(new FakeFile('font.otf',5_000_001)),expected);
});

test('custom font reads reuse the in-flight and completed cache entry', async () => {
  let reads=0, loads=0, release;
  const gate=new Promise(resolve=>{release=resolve;});
  const {controller}=setup({
    readFilePort:async()=>{reads+=1;return 'data:application/octet-stream;base64,QQ==';},
    loadFont:async()=>{loads+=1;await gate;},
  });
  const file=new FakeFile('font.woff2');
  const first=controller.readCustomFont(file), second=controller.readCustomFont(file);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reads,1); assert.equal(loads,1);
  release();
  const [a,b]=await Promise.all([first,second]);
  assert.deepEqual(a,b);
  await controller.readCustomFont(file);
  assert.equal(reads,1); assert.equal(loads,1);
});

test('failed custom font loads evict cache so the same File can retry', async () => {
  let reads=0, attempts=0;
  const {controller}=setup({
    readFilePort:async()=>{reads+=1;return 'data:application/octet-stream;base64,QQ==';},
    loadFont:async()=>{attempts+=1;if(attempts===1)throw new Error('bad font');},
  });
  const file=new FakeFile('retry.ttf');
  await assert.rejects(()=>controller.readCustomFont(file),/Не удалось открыть файл шрифта/);
  const loaded=await controller.readCustomFont(file);
  assert.equal(loaded.fontFamily,'ZPE-font-test');
  assert.equal(reads,2); assert.equal(attempts,2);
});

test('form normalization preserves embedded font metadata when family is unchanged', async () => {
  const {controller}=setup();
  const layer={fontFamily:'Embedded Family',fontData:'data:font/woff2;base64,AA==',fontLabel:'Embedded.woff2',width:320,color:'#010203'};
  const settings=await controller.settingsFromForm(formValues({fontFamily:'Embedded Family',color:'',width:''}),layer);
  assert.equal(settings.fontData,layer.fontData);
  assert.equal(settings.fontLabel,layer.fontLabel);
  assert.equal(settings.width,320); assert.equal(settings.color,'#010203');
});

test('custom font keeps precedence over system name and system font is registered otherwise', async () => {
  const {controller}=setup();
  const custom=await controller.settingsFromForm(formValues({fontFile:new FakeFile('custom.otf'),systemFontName:'Segoe UI',fontFamily:'Fallback'}));
  assert.equal(custom.fontFamily,'ZPE-font-test');
  assert.match(custom.fontData,/^data:font\/otf;base64,/);
  assert.equal(custom.fontLabel,'custom.otf');
  const system=await controller.settingsFromForm(formValues({fontFile:null,systemFontName:'Segoe UI',fontFamily:'Fallback'}));
  assert.equal(system.fontFamily,JSON.stringify('Segoe UI'));
  assert.ok(controller.fontOptions().some(([value])=>value===JSON.stringify('Segoe UI')));
});

test('typography normalization preserves clamps and option fallbacks', async () => {
  const {controller}=setup();
  const settings=await controller.settingsFromForm(formValues({text:'',fontSize:'999',fontWeight:'900',fontStyle:'oblique',align:'justify',lineHeight:'0.2',letterSpacing:'99',width:'99999',underline:'yes',strikeThrough:'yes'}));
  assert.equal(settings.text,'Текст');
  assert.equal(settings.fontSize,500); assert.equal(settings.fontWeight,'400');
  assert.equal(settings.fontStyle,'normal'); assert.equal(settings.align,'left');
  assert.equal(settings.lineHeight,0.8); assert.equal(settings.letterSpacing,20);
  assert.equal(settings.width,12000); assert.equal(settings.underline,true); assert.equal(settings.strikeThrough,true);
});

test('modal fields read live toolbar defaults instead of copying them into controller state', () => {
  const {controller,fontFamilyControl,fontSizeControl,primaryColorControl}=setup();
  fontFamilyControl.value='Live Font'; fontSizeControl.value='73'; primaryColorControl.value='#fedcba';
  const fields=Object.fromEntries(controller.modalFields(null,321).map(field=>[field.name,field]));
  assert.equal(fields.fontFamily.value,'Live Font');
  assert.equal(fields.fontSize.value,'73');
  assert.equal(fields.color.value,'#fedcba');
  assert.equal(fields.width.value,321);
});

test('text settings policy has one canonical owner and Properties keeps async stale guards', async () => {
  const [main,source,build,modal]=await Promise.all([
    readFile(new URL('../src/main.js',import.meta.url),'utf8'),
    readFile(new URL('../src/ui/text-settings-controller.js',import.meta.url),'utf8'),
    readFile(new URL('../tools/build-bundle.mjs',import.meta.url),'utf8'),
    readFile(new URL('../src/ui/modal-controller.js',import.meta.url),'utf8'),
  ]);
  assert.match(main,/from '\.\/ui\/text-settings-controller\.js'/);
  assert.match(main,/createTextSettingsController\(\{/);
  assert.match(main,/loadComputerFonts: textSettingsController\.loadComputerFonts/);
  assert.match(main,/fields: textSettingsController\.modalFields/);
  assert.match(main,/settingsFromForm: textSettingsController\.settingsFromForm/);
  assert.match(build,/'src\/ui\/text-settings-controller\.js'/);
  assert.match(source,/const customFontReads = new WeakMap\(\)/);
  assert.doesNotMatch(modal,/customFontReads|localTextFonts/);
  assert.doesNotMatch(main,/\b(?:let|const) localTextFonts\b/);
  assert.doesNotMatch(main,/\bconst customFontReads\b/);
  for(const name of ['textFontOptions','loadComputerFonts','readCustomTextFont','loadCustomTextFont','textModalFields','textSettingsFromForm']){
    assert.doesNotMatch(main,new RegExp('(?:async\\s+)?function '+name+'\\('));
  }
  assert.match(main,/const targetDoc = doc, targetLayer = l;[\s\S]*?await textSettingsController\.readCustomFont\(fontInput\.files\?\.\[0\]\);[\s\S]*?doc !== targetDoc \|\| selected\(\) !== targetLayer \|\| isLayerLocked\(doc,targetLayer\)/);
});

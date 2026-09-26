import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addLayer, createDocument, createTextLayer } from '../src/core/state.js';
import { createTextEditController, createTextPreviewSession, syncTextPreviewCanvas } from '../src/ui/text-edit-controller.js';

const typography = (text, width = 180) => ({
  text, fontFamily:'Inter, Arial, sans-serif', fontData:null, fontLabel:'',
  fontSize:24, fontWeight:'400', fontStyle:'normal', align:'left', lineHeight:1.2,
  letterSpacing:0, underline:false, strikeThrough:false, width, color:'#ffffff',
});
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('async text preview is latest-wins and does not mutate persisted document', async () => {
  const owner = createDocument({ width:500, height:300 });
  const pending = [], published = [];
  const session = createTextPreviewSession({
    owner, point:{x:20,y:30},
    getSettings:values=>{const item=deferred();pending.push({...item,values});return item.promise;},
    getToolOpacity:()=>0.65, publish:draft=>published.push(draft),
  });
  const older=session.update({text:'старый'}), newer=session.update({text:'новый'});
  pending[1].resolve(typography('новый')); await newer;
  pending[0].resolve(typography('старый')); await older;
  assert.equal(published.length,1);
  assert.equal(published[0].layer.text,'новый');
  assert.equal(published[0].layer.opacity,0.65);
  assert.equal(published[0].layer.x,20); assert.equal(published[0].layer.y,30);
  assert.equal(owner.layers.length,0);
});

test('stale document and closed preview session reject late async publication', async () => {
  const owner=createDocument(); let activeDocument=owner; const published=[];
  const first=deferred();
  const stale=createTextPreviewSession({
    owner,getDocument:()=>activeDocument,getSettings:()=>first.promise,publish:draft=>published.push(draft),
  });
  const staleUpdate=stale.update({}); activeDocument=createDocument();
  first.resolve(typography('stale')); await staleUpdate; assert.deepEqual(published,[]);
  activeDocument=owner; const second=deferred();
  const closed=createTextPreviewSession({
    owner,getDocument:()=>activeDocument,getSettings:()=>second.promise,publish:draft=>published.push(draft),
  });
  const closedUpdate=closed.update({}); closed.close();
  second.resolve(typography('closed')); await closedUpdate; assert.deepEqual(published,[]);
});

test('edit Apply revalidates exact selection and commits only a valid target', async () => {
  const owner=createDocument({width:400,height:300});
  const textLayer=addLayer(owner,createTextLayer({x:10,y:10,width:120,height:60,text:'До'}));
  const other=addLayer(owner,createTextLayer({x:220,y:10,width:100,height:60,text:'Другой'}));
  owner.selectedLayerId=textLayer.id; let modalSpec=null; const commits=[];
  const controller=createTextEditController({
    state:{
      getDocument:()=>owner,
      getSelectedLayer:()=>owner.layers.find(layer=>layer.id===owner.selectedLayerId)??null,
      selectLayer:(documentValue,layer)=>{documentValue.selectedLayerId=layer.id;},
      addLayer,commit:label=>commits.push(label),
    },
    text:{fields:()=>[],settingsFromForm:async values=>typography(values.text)},
    ui:{showModal:spec=>{modalSpec=spec;}},
  });
  assert.equal(controller.open({x:20,y:20}),true);
  assert.equal(modalSpec.title,'Редактировать текст');
  owner.selectedLayerId=other.id;
  assert.equal(await modalSpec.onSubmit({text:'Не должно примениться'},()=>true),false);
  assert.equal(textLayer.text,'До'); assert.deepEqual(commits,[]);
  owner.selectedLayerId=textLayer.id;
  await modalSpec.onSubmit({text:'После'},()=>true);
  assert.equal(textLayer.text,'После');
  assert.deepEqual(commits,['Редактировать текст']);
});

test('locked text target is selected but cannot open an edit transaction', () => {
  const owner=createDocument();
  const textLayer=addLayer(owner,createTextLayer({x:0,y:0,width:100,height:50,locked:true}));
  let opened=false; const statuses=[];
  const controller=createTextEditController({
    state:{getDocument:()=>owner,selectLayer:(documentValue,layer)=>{documentValue.selectedLayerId=layer.id;}},
    renderApi:{updateLayers(){},refreshInspectorPanels(){},drawOverlay(){}},
    ui:{showModal:()=>{opened=true;},setStatus:value=>statuses.push(value),toast(){}},
  });
  assert.equal(controller.open({x:10,y:10}),false);
  assert.equal(owner.selectedLayerId,textLayer.id); assert.equal(opened,false);
  assert.match(statuses.at(-1),/заблокирован/);
});

test('Add Apply creates exactly one text layer and one history commit', async () => {
  const owner=createDocument({width:800,height:600}); let modalSpec=null; const commits=[];
  const controller=createTextEditController({
    state:{getDocument:()=>owner,addLayer,commit:label=>commits.push(label)},
    text:{
      fields:(_layer,width)=>[{width}],
      settingsFromForm:async values=>typography(values.text,Number(values.width)||300),
    },
    renderApi:{getToolOpacity:()=>0.4},
    ui:{showModal:spec=>{modalSpec=spec;}},
  });
  assert.equal(controller.open({x:100,y:80}),true);
  assert.equal(modalSpec.title,'Добавить текст');
  await modalSpec.onSubmit({text:'Новый',width:300},()=>true);
  assert.equal(owner.layers.length,1); assert.equal(owner.layers[0].text,'Новый');
  assert.equal(owner.layers[0].opacity,0.4); assert.equal(owner.layers[0].x,100); assert.equal(owner.layers[0].y,80);
  assert.deepEqual(commits,['Добавить текст']);
});

test('preview canvas keeps DPR, zoom, alignment and background offsets', () => {
  const owner=createDocument({width:600,height:400});
  const layer=createTextLayer({x:100,y:80,width:200,height:60,align:'center'});
  const calls=[]; const props=new Map();
  const context={
    clearRect:(...args)=>calls.push(['clearRect',...args]),
    setTransform:(...args)=>calls.push(['setTransform',...args]),
    drawImage:(...args)=>calls.push(['drawImage',...args]),
  };
  const canvas={
    isConnected:true,clientWidth:120,clientHeight:70,width:0,height:0,getContext:()=>context,
    style:{setProperty:(key,value)=>props.set(key,value)},
  };
  const sourceCanvas={width:600,height:400};
  const draft={document:owner,originalId:null,layer,previewCanvas:canvas};
  assert.equal(syncTextPreviewCanvas(draft,{
    documentValue:owner,sourceCanvas,zoom:1.5,windowTarget:{devicePixelRatio:2},
  }),true);
  assert.equal(canvas.width,240); assert.equal(canvas.height,140);
  assert.equal(calls.filter(call=>call[0]==='drawImage').length,1);
  assert.equal(calls.find(call=>call[0]==='drawImage')[1],sourceCanvas);
  assert.match(props.get('--preview-bg-x'),/px$/); assert.match(props.get('--preview-bg-y'),/px$/);
});

test('text edit transaction has one controller owner and generic modal shell stays feature-neutral', async () => {
  const [main,controller,modal,build]=await Promise.all([
    readFile(new URL('../src/main.js',import.meta.url),'utf8'),
    readFile(new URL('../src/ui/text-edit-controller.js',import.meta.url),'utf8'),
    readFile(new URL('../src/ui/modal-controller.js',import.meta.url),'utf8'),
    readFile(new URL('../tools/build-bundle.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(main,/createTextEditController/);
  assert.match(main,/textEditController\.documentWithPreview\(doc\)/);
  assert.match(main,/textEditController\.syncPreviewCanvas\(\)/);
  assert.match(main,/textEditController\.previewLayer\(doc\)/);
  assert.match(build,/'src\/ui\/text-edit-controller\.js'/);
  assert.match(controller,/from '\.\.\/core\/state\.js'/);
  assert.doesNotMatch(main,/let textDraft\s*=/);
  for(const name of ['openTextModal','attachTextPreview','syncTextPreviewCanvas','topTextLayerAt']){
    assert.doesNotMatch(main,new RegExp(`function ${name}\\(`));
  }
  assert.doesNotMatch(modal,/attachTextPreview/);
  assert.doesNotMatch(modal,/onModalClose/);
  assert.match(modal,/onClose\?\.\(\{modal\}\)/);
});

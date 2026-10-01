import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathsController } from '../src/ui/paths-controller.js';

function savedPath(name,id){
  return {id,name,fillStartsWithAllPixels:false,subpaths:[{operation:'add',closed:true,fillRule:'non-zero',points:[{x:1,y:2},{x:3,y:4},{x:5,y:6}]}]};
}
function makeElement(tagName){
  const attributes=new Map();
  return {
    tagName:String(tagName).toUpperCase(),type:'',className:'',textContent:'',disabled:false,children:[],focused:false,
    setAttribute(name,value){attributes.set(name,String(value));},
    getAttribute(name){return attributes.get(name)??null;},
    append(...items){this.children.push(...items);},
    focus(){this.focused=true;},
  };
}
function makeList(){
  return {
    children:[],
    replaceChildren(){this.children=[];},
    append(value){this.children.push(value);},
    querySelectorAll(selector){return selector==='.path-row'?this.children.filter(value=>String(value.className).split(/\s+/).includes('path-row')):[];},
  };
}

test('saved path CRUD keeps Photoshop resource IDs bounded and selection controller-owned',()=>{
  const doc={paths:[savedPath('Existing',2000)]};
  const layer={type:'shape',shape:'path',name:'Logo',pathClosed:true,pathPoints:[
    {x:1,y:2,handleOut:{x:2,y:2},kind:'corner'},
    {x:6,y:7,handleIn:{x:5,y:7},kind:'smooth'},
  ]};
  const commits=[],deleted=[];
  const controller=createPathsController({
    state:{getDocument:()=>doc,getSelectedLayer:()=>layer,commit:label=>commits.push(label)},
    vectors:{layerPixelToDocumentPoint:point=>({x:point.x+10,y:point.y+20})},
    edit:{onPathDeleted:index=>deleted.push(index)},
  });

  assert.equal(controller.addDocumentPathFromCurrent(),true);
  assert.equal(doc.paths[1].id,2001);
  assert.equal(doc.paths[1].name,'Logo — путь');
  assert.deepEqual(doc.paths[1].subpaths[0].points[0],{x:11,y:22,handleIn:null,handleOut:{x:12,y:22},kind:'corner'});
  assert.equal(controller.getSelectedIndex(),1);

  assert.equal(controller.duplicateSelectedDocumentPath(),true);
  assert.equal(doc.paths[2].id,2002);
  assert.equal(doc.paths[2].name,'Logo — путь — копия');
  assert.equal(controller.getSelectedIndex(),2);

  assert.equal(controller.deleteSelectedDocumentPath(),true);
  assert.deepEqual(deleted,[2]);
  assert.equal(controller.getSelectedIndex(),1);
  assert.deepEqual(commits,['Сохранить контур','Дублировать контур','Удалить контур']);
});

test('saved path limit is enforced before mutation',()=>{
  const doc={paths:Array.from({length:998},(_,index)=>savedPath(`P${index}`,2000+index))};
  const statuses=[],toasts=[];
  const controller=createPathsController({
    state:{getDocument:()=>doc},
    ui:{setStatus:value=>statuses.push(value),toast:(value,kind)=>toasts.push([value,kind])},
  });
  assert.equal(controller.addDocumentPathFromCurrent(),false);
  assert.equal(doc.paths.length,998);
  assert.match(statuses.at(-1),/998/);
  assert.equal(toasts.at(-1)?.[1],'warn');
});

test('applying a saved path preserves adjustment and lock guards before vector-mask publication',()=>{
  const doc={paths:[savedPath('Mask',2000)]};
  let layer={type:'adjustment',vectorMask:null},locked=false,cleared=0;
  const statuses=[],commits=[];
  const controller=createPathsController({
    state:{
      getDocument:()=>doc,
      getSelectedLayer:()=>layer,
      isLayerLocked:()=>locked,
      commit:label=>commits.push(label),
    },
    vectors:{importVectorMask:value=>({...value,imported:true})},
    edit:{clearVectorMaskEdit:()=>{cleared+=1;}},
    ui:{setStatus:value=>statuses.push(value)},
  });
  controller.setSelectedIndex(0);
  assert.equal(controller.applySelectedDocumentPathAsVectorMask(),false);
  assert.match(statuses.at(-1),/adjustment layer/);

  layer={type:'raster',vectorMask:null};locked=true;
  assert.equal(controller.applySelectedDocumentPathAsVectorMask(),false);
  assert.match(statuses.at(-1),/заблокированы/);

  locked=false;
  assert.equal(controller.applySelectedDocumentPathAsVectorMask(),true);
  assert.equal(layer.vectorMask.imported,true);
  assert.equal(cleared,1);
  assert.deepEqual(commits,['Применить контур как векторную маску']);
});

test('panel rendering keeps option semantics, keyboard selection, context menu and controls accessible',()=>{
  const doc={paths:[savedPath('One',2000),savedPath('Two',2001)]};
  const layer={type:'raster',vectorMask:{subpaths:[{}]}};
  const list=makeList();
  const controls=Object.fromEntries(['add','edit','applyMask','rename','duplicate','delete'].map(key=>[key,{disabled:true,onclick:null}]));
  const opened=[],synced=[];let draws=0;
  const controller=createPathsController({
    state:{getDocument:()=>doc,getSelectedLayer:()=>layer},
    vectors:{exportVectorMask:()=>({subpaths:[]}),importVectorMask:()=>({})},
    edit:{syncPathEditSelection:index=>synced.push(index),drawOverlay:()=>{draws+=1;}},
    ui:{
      pathList:list,
      controls,
      documentRef:{createElement:makeElement},
      requestFrame:callback=>callback(),
      openContextMenu:(key,items)=>opened.push([key,items]),
    },
  });

  assert.deepEqual(controller.updatePathsPanel(),{selectedIndex:0,count:2});
  assert.equal(list.children[0].getAttribute('role'),'option');
  assert.equal(list.children[0].getAttribute('aria-selected'),'true');
  assert.equal(list.children[1].getAttribute('aria-selected'),'false');
  assert.equal(controls.edit.disabled,false);
  assert.equal(controls.duplicate.disabled,false);

  list.children[0].onclick();
  assert.deepEqual(synced,[0]);

  list.children[0].onkeydown({key:'ArrowDown',preventDefault(){}});
  assert.equal(controller.getSelectedIndex(),1);
  assert.equal(list.children[1].focused,true);
  assert.ok(draws>=2);

  list.children[1].oncontextmenu({preventDefault(){},stopPropagation(){}});
  assert.equal(opened.at(-1)?.[0],'path:1');
  assert.equal(opened.at(-1)?.[1]?.length,6);

  assert.equal(controller.bindControls(),6);
  assert.equal(typeof controls.add.onclick,'function');
  assert.equal(typeof controls.delete.onclick,'function');
});

test('rename modal preserves trim, cap, no-op and exact history semantics',()=>{
  const doc={paths:[savedPath('Old',2000)]};
  let modal=null;const commits=[];
  const controller=createPathsController({
    state:{getDocument:()=>doc,commit:label=>commits.push(label)},
    ui:{showModal:value=>{modal=value;}},
  });
  controller.setSelectedIndex(0);
  assert.equal(controller.renameSelectedDocumentPath(),true);
  assert.equal(modal.title,'Переименовать контур');

  assert.equal(modal.onSubmit({name:'   '}),false);
  assert.equal(modal.onSubmit({name:'  Old  '}),false);
  assert.deepEqual(commits,[]);

  const longName='N'.repeat(250);
  assert.equal(modal.onSubmit({name:`  ${longName}  `}),true);
  assert.equal(doc.paths[0].name,longName.slice(0,240));
  assert.deepEqual(commits,['Переименовать контур']);
});

test('rename modal rejects a stale document owner instead of redirecting by numeric index',()=>{
  const docA={paths:[savedPath('A path',2000)]};
  const docB={paths:[savedPath('B path',2000)]};
  let activeDoc=docA,modal=null;const commits=[];
  const controller=createPathsController({
    state:{getDocument:()=>activeDoc,commit:label=>commits.push(label)},
    ui:{showModal:value=>{modal=value;}},
  });
  controller.setSelectedIndex(0);
  assert.equal(controller.renameSelectedDocumentPath(),true);

  activeDoc=docB;
  assert.equal(modal.onSubmit({name:'Wrong target'}),false);
  assert.equal(docA.paths[0].name,'A path');
  assert.equal(docB.paths[0].name,'B path');
  assert.deepEqual(commits,[]);
});

test('rename modal follows the same exact Saved Path across reordering by stable ID and object identity',()=>{
  const other=savedPath('Other',2000);
  const target=savedPath('Target',2001);
  const doc={paths:[other,target]};
  let modal=null;const commits=[];
  const controller=createPathsController({
    state:{getDocument:()=>doc,commit:label=>commits.push(label)},
    ui:{showModal:value=>{modal=value;}},
  });
  controller.setSelectedIndex(1);
  assert.equal(controller.renameSelectedDocumentPath(),true);

  doc.paths=[target,other];
  assert.equal(modal.onSubmit({name:'Renamed'}),true);
  assert.equal(target.name,'Renamed');
  assert.equal(other.name,'Other');
  assert.equal(controller.getSelectedIndex(),0);
  assert.deepEqual(commits,['Переименовать контур']);
});

test('rename modal rejects a removed or same-ID replacement target',()=>{
  const original=savedPath('Original',2000);
  const replacement=savedPath('Replacement',2000);
  const doc={paths:[original]};
  let modal=null;const commits=[];
  const controller=createPathsController({
    state:{getDocument:()=>doc,commit:label=>commits.push(label)},
    ui:{showModal:value=>{modal=value;}},
  });
  controller.setSelectedIndex(0);
  assert.equal(controller.renameSelectedDocumentPath(),true);

  doc.paths[0]=replacement;
  assert.equal(modal.onSubmit({name:'Must not apply'}),false);
  assert.equal(original.name,'Original');
  assert.equal(replacement.name,'Replacement');
  assert.deepEqual(commits,[]);
});

test('rename modal falls back to exact object identity when a sanitized Saved Path has no stable resource ID',()=>{
  const target=savedPath('No ID',null);
  const other=savedPath('Other',2000);
  const doc={paths:[target,other]};
  let modal=null;const commits=[];
  const controller=createPathsController({
    state:{getDocument:()=>doc,commit:label=>commits.push(label)},
    ui:{showModal:value=>{modal=value;}},
  });
  controller.setSelectedIndex(0);
  assert.equal(controller.renameSelectedDocumentPath(),true);

  doc.paths=[other,target];
  assert.equal(modal.onSubmit({name:'Exact fallback'}),true);
  assert.equal(target.name,'Exact fallback');
  assert.equal(other.name,'Other');
  assert.equal(controller.getSelectedIndex(),1);
  assert.deepEqual(commits,['Переименовать контур']);
});

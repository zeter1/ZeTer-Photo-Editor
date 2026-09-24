import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRect, constrainedRect, fitZoom, resizeFromHandle, layerFrame, frameBounds, hitLayerHandle, pointInLayer, resizeLayerFromPoint, rotationHandlePoint, rotationFromDrag, snapLayerMove, alignLayerToCanvas } from '../src/core/geometry.js';
import { HistoryStack } from '../src/core/history.js';
import { PROJECT_VERSION, createDocument, createShapeLayer, createAdjustmentLayer, createLayerMask, addLayer, duplicateLayer, moveLayer, moveLayerToIndex, removeLayer, snapshotDocument, restoreDocument, sanitizeProject, imageResizeTransforms } from '../src/core/state.js';

test('normalizeRect handles reverse drags', () => {
  assert.deepEqual(normalizeRect({x:20,y:30},{x:5,y:10}), {x:5,y:10,width:15,height:20});
});

test('fitZoom stays inside supported range', () => {
  assert.equal(fitZoom(100,100,10000,10000), .1);
  assert.equal(fitZoom(5000,5000,100,100), 16);
});

test('resizeFromHandle keeps minimum size', () => {
  const next=resizeFromHandle({x:0,y:0,width:20,height:20},'nw',50,50,12);
  assert.equal(next.width,12); assert.equal(next.height,12);
});

test('history truncates redo branch after new change', () => {
  const h=new HistoryStack(); h.push('a','1');h.push('b','2');h.push('c','3');
  assert.equal(h.undo().snapshot,'2');h.push('x','x');assert.equal(h.canRedo(),false);assert.equal(h.current().label,'x');
});

test('layer operations preserve selection and ordering', () => {
  const doc=createDocument(); const a=addLayer(doc,createShapeLayer({name:'a'})); const b=addLayer(doc,createShapeLayer({name:'b'}));
  const c=duplicateLayer(doc,b.id); assert.equal(doc.selectedLayerId,c.id); assert.equal(doc.layers.length,3);
  assert.equal(moveLayer(doc,c.id,-1),true); assert.equal(doc.layers[1].id,c.id);
  removeLayer(doc,c.id); assert.equal(doc.layers.length,2); assert.ok(doc.layers.some(l=>l.id===doc.selectedLayerId));
  assert.equal(a.name,'a');
});

test('document snapshot round trips and sanitizes unsafe bounds', () => {
  const doc=createDocument({width:500,height:400});addLayer(doc,createShapeLayer({x:12,y:15}));
  const restored=restoreDocument(snapshotDocument(doc));assert.equal(restored.width,500);assert.equal(restored.layers.length,1);
  const dirty={...restored,width:999999,height:-5,layers:[{...restored.layers[0],opacity:5,scaleX:0}]};
  const safe=sanitizeProject(dirty);assert.equal(safe.width,12000);assert.equal(safe.height,1);assert.equal(safe.layers[0].opacity,1);assert.equal(safe.layers[0].scaleX,.01);
});

test('project loading rejects unknown format versions while keeping legacy versionless JSON compatible', () => {
  const legacy={name:'legacy',width:640,height:480,background:'transparent',layers:[]};
  assert.equal(sanitizeProject(legacy).version,PROJECT_VERSION);
  assert.equal(sanitizeProject({...legacy,version:'1'}).version,PROJECT_VERSION);
  assert.throws(()=>sanitizeProject({...legacy,version:2}),/Неподдерживаемая версия проекта: 2/);
  assert.throws(()=>sanitizeProject({...legacy,version:'future'}),/Неподдерживаемая версия проекта/);
  assert.throws(()=>restoreDocument(JSON.stringify({...legacy,version:2})),/Неподдерживаемая версия проекта: 2/);
});

test('image resize rejects transforms that would change after reopening the project', () => {
  const doc=createDocument({width:10,height:10});
  const layer=addLayer(doc,createShapeLayer({x:2,y:3,width:10,height:10}));
  assert.throws(()=>imageResizeTransforms(doc.layers,1200,1),/допустимые пределы/);
  assert.equal(layer.scaleX,1);
  const transforms=imageResizeTransforms(doc.layers,5,5);
  Object.assign(layer,transforms[0]);
  doc.width=50;doc.height=50;
  const reopened=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(reopened.layers[0].x,layer.x);
  assert.equal(reopened.layers[0].scaleX,layer.scaleX);
  assert.equal(reopened.layers[0].width*reopened.layers[0].scaleX,layer.width*layer.scaleX);
  layer.rotation=90;
  assert.throws(()=>imageResizeTransforms(doc.layers,2,1),/повёрнутому слою/);
  assert.doesNotThrow(()=>imageResizeTransforms(doc.layers,2,2));
});


test('history prunes old large snapshots to stay inside its memory budget', () => {
  const h = new HistoryStack(80, 120);
  h.push('a', 'x'.repeat(40)); // ~80 bytes in UTF-16
  h.push('b', 'y'.repeat(40));
  h.push('c', 'z'.repeat(40));
  assert.ok(h.totalBytes() <= 120 || h.entries.length === 1);
  assert.equal(h.current().label, 'c');
});


test('rotated layer hit testing follows the transformed layer instead of its axis-aligned box', () => {
  const layer=createShapeLayer({x:100,y:80,width:200,height:100,rotation:35});
  const frame=layerFrame(layer);
  assert.equal(pointInLayer(frame.center,layer),true);
  assert.equal(hitLayerHandle(frame.handles.ne,layer,2),'ne');
  const outside={x:frame.center.x+400,y:frame.center.y+400};
  assert.equal(pointInLayer(outside,layer),false);
});

test('rotated resize preserves the opposite handle and supports proportional resize', () => {
  const layer=createShapeLayer({x:100,y:80,width:200,height:100,rotation:30});
  const before=layerFrame(layer);
  const target={
    x:before.handles.se.x+60*before.ux.x+20*before.uy.x,
    y:before.handles.se.y+60*before.ux.y+20*before.uy.y,
  };
  const resized=resizeLayerFromPoint(layer,'se',target,{minSize:2});
  const after=layerFrame({...layer,...resized});
  assert.ok(Math.hypot(after.handles.nw.x-before.handles.nw.x,after.handles.nw.y-before.handles.nw.y)<1e-8);
  const locked=resizeLayerFromPoint(layer,'se',target,{minSize:2,lockAspect:true});
  assert.ok(Math.abs((layer.width*locked.scaleX)/(layer.height*locked.scaleY)-2)<1e-8);
});

test('Alt-style resize keeps the transformed layer center fixed', () => {
  const layer={x:80,y:55,width:140,height:90,scaleX:1.2,scaleY:.8,rotation:31};
  const before=layerFrame(layer);
  const target={
    x:before.handles.se.x+55*before.ux.x+35*before.uy.x,
    y:before.handles.se.y+55*before.ux.y+35*before.uy.y,
  };
  const resized=resizeLayerFromPoint(layer,'se',target,{minSize:2,fromCenter:true});
  const after=layerFrame({...layer,...resized});
  assert.ok(Math.hypot(after.center.x-before.center.x,after.center.y-before.center.y)<1e-8);
  assert.ok(after.width>before.width);
  assert.ok(after.height>before.height);

  const locked=resizeLayerFromPoint(layer,'se',target,{minSize:2,fromCenter:true,lockAspect:true});
  const lockedFrame=layerFrame({...layer,...locked});
  assert.ok(Math.hypot(lockedFrame.center.x-before.center.x,lockedFrame.center.y-before.center.y)<1e-8);
  assert.ok(Math.abs(lockedFrame.width/lockedFrame.height-before.width/before.height)<1e-8);
});

test('constrainedRect creates a square in every drag direction', () => {
  assert.deepEqual(constrainedRect({x:10,y:10},{x:40,y:30},true),{x:10,y:10,width:30,height:30});
  assert.deepEqual(constrainedRect({x:10,y:10},{x:-10,y:0},true),{x:-10,y:-10,width:20,height:20});
  assert.deepEqual(constrainedRect({x:10,y:10},{x:20,y:40},false),{x:10,y:10,width:10,height:30});
});

test('moveLayerToIndex supports direct layer reordering', () => {
  const doc=createDocument();
  const a=addLayer(doc,createShapeLayer({name:'a'}));
  const b=addLayer(doc,createShapeLayer({name:'b'}));
  const c=addLayer(doc,createShapeLayer({name:'c'}));
  assert.equal(moveLayerToIndex(doc,c.id,0),true);
  assert.deepEqual(doc.layers.map(l=>l.name),['c','a','b']);
  assert.equal(moveLayerToIndex(doc,c.id,0),false);
});

test('project sanitizer repairs malformed transform data, duplicate ids, and unsupported blend modes', () => {
  const safe=sanitizeProject({
    version:1,name:'x',width:'640',height:'480',background:'transparent',selectedLayerId:'dup',
    layers:[
      {id:'dup',type:'shape',name:'a',x:'oops',y:2,width:-4,height:20,scaleX:'bad',scaleY:2,opacity:'bad',blendMode:'not-a-mode'},
      {id:'dup',type:'text',name:'b',text:'hello',fontSize:9999,align:'weird'},
    ],
  });
  assert.equal(safe.width,640); assert.equal(safe.height,480);
  assert.equal(safe.layers[0].x,0); assert.equal(safe.layers[0].width,1); assert.equal(safe.layers[0].scaleX,1);
  assert.equal(safe.layers[0].opacity,1); assert.equal(safe.layers[0].blendMode,'source-over');
  assert.notEqual(safe.layers[0].id,safe.layers[1].id);
  assert.equal(safe.layers[1].fontSize,500); assert.equal(safe.layers[1].align,'left');
});


test('rotation handle sits above the transformed top edge and drag rotation can snap', () => {
  const layer=createShapeLayer({x:100,y:80,width:200,height:100,rotation:30});
  const frame=layerFrame(layer);
  const handle=rotationHandlePoint(layer,40);
  const distance=Math.hypot(handle.x-frame.handles.n.x,handle.y-frame.handles.n.y);
  assert.ok(Math.abs(distance-40)<1e-8);
  const start={x:frame.center.x+100,y:frame.center.y};
  const current={x:frame.center.x,y:frame.center.y+100};
  assert.equal(rotationFromDrag(30,frame.center,start,current,0),120);
  assert.equal(rotationFromDrag(30,frame.center,start,current,15),120);
});

test('frameBounds contains every rotated corner and optional padding', () => {
  const layer=createShapeLayer({x:40,y:60,width:180,height:90,rotation:37});
  const frame=layerFrame(layer);
  const bounds=frameBounds(layer,5);
  for(const point of frame.corners){
    assert.ok(point.x>=bounds.x+5-1e-8 && point.x<=bounds.x+bounds.width-5+1e-8);
    assert.ok(point.y>=bounds.y+5-1e-8 && point.y<=bounds.y+bounds.height-5+1e-8);
  }
});

test('smart move snapping uses document edges and center without snapping beyond threshold', () => {
  const layer={x:43,y:40,width:20,height:20,scaleX:1,scaleY:1,rotation:0};
  const centered=snapLayerMove(layer,41,40,{docWidth:100,docHeight:100,threshold:2});
  assert.equal(centered.x,40);
  assert.equal(centered.guides.x,50);
  const far=snapLayerMove(layer,35,40,{docWidth:100,docHeight:100,threshold:2});
  assert.equal(far.x,35);
  assert.equal(far.guides.x,null);
});

test('smart move snapping can align to another visible layer frame', () => {
  const layer={x:0,y:0,width:20,height:20,scaleX:1,scaleY:1,rotation:0};
  const snapped=snapLayerMove(layer,79,31,{
    docWidth:300,docHeight:200,threshold:2,
    targetRects:[{x:100,y:30,width:50,height:40}],
  });
  assert.equal(snapped.x,80);
  assert.equal(snapped.y,30);
  assert.equal(snapped.guides.x,100);
  assert.equal(snapped.guides.y,30);
});

test('canvas alignment shifts transformed bounds to all six canvas anchors', () => {
  const layer={x:25,y:40,width:80,height:40,scaleX:1,scaleY:1,rotation:30};
  for (const mode of ['left','hcenter','right','top','vcenter','bottom']) {
    const next=alignLayerToCanvas(layer,mode,300,200);
    const bounds=frameBounds({...layer,x:next.x,y:next.y});
    if(mode==='left') assert.ok(Math.abs(bounds.x)<1e-8);
    if(mode==='hcenter') assert.ok(Math.abs(bounds.x+bounds.width/2-150)<1e-8);
    if(mode==='right') assert.ok(Math.abs(bounds.x+bounds.width-300)<1e-8);
    if(mode==='top') assert.ok(Math.abs(bounds.y)<1e-8);
    if(mode==='vcenter') assert.ok(Math.abs(bounds.y+bounds.height/2-100)<1e-8);
    if(mode==='bottom') assert.ok(Math.abs(bounds.y+bounds.height-200)<1e-8);
  }
});

test('history can jump directly to an earlier or later state', () => {
  const h=new HistoryStack();h.push('a','1');h.push('b','2');h.push('c','3');
  assert.equal(h.jump(0).label,'a');
  assert.equal(h.canRedo(),true);
  assert.equal(h.jump(2).snapshot,'3');
  assert.equal(h.jump(2),null);
});


test('center resize keeps the transformed layer center fixed and can preserve aspect ratio', () => {
  const layer=createShapeLayer({x:120,y:90,width:180,height:120,rotation:28});
  const before=layerFrame(layer);
  const target={
    x:before.handles.se.x+70*before.ux.x+35*before.uy.x,
    y:before.handles.se.y+70*before.ux.y+35*before.uy.y,
  };
  const resized=resizeLayerFromPoint(layer,'se',target,{minSize:2,fromCenter:true,lockAspect:true});
  const after=layerFrame({...layer,...resized});
  assert.ok(Math.hypot(after.center.x-before.center.x,after.center.y-before.center.y)<1e-8);
  assert.ok(Math.abs((layer.width*resized.scaleX)/(layer.height*resized.scaleY)-1.5)<1e-8);
});


test('constrainedRect makes a square in every drag direction when Shift-style locking is enabled', () => {
  assert.deepEqual(constrainedRect({x:10,y:10},{x:40,y:25},true), {x:10,y:10,width:30,height:30});
  assert.deepEqual(constrainedRect({x:10,y:10},{x:-5,y:-30},true), {x:-30,y:-30,width:40,height:40});
  assert.deepEqual(constrainedRect({x:10,y:10},{x:40,y:25},false), {x:10,y:10,width:30,height:15});
});

test('adjustment layers and layer masks survive project sanitization without changing project version', () => {
  const doc=createDocument({width:320,height:200});
  const adjustment=addLayer(doc,createAdjustmentLayer({
    width:320,height:200,
    filters:{brightness:125,exposure:1},
    mask:createLayerMask({dataUrl:'data:image/png;base64,AAAA'}),
  }));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(safe.version,PROJECT_VERSION);
  assert.equal(safe.layers[0].type,'adjustment');
  assert.equal(safe.layers[0].filters.brightness,125);
  assert.equal(safe.layers[0].filters.exposure,1);
  assert.equal(safe.layers[0].mask.enabled,true);
  assert.equal(safe.layers[0].mask.dataUrl,'data:image/png;base64,AAAA');
  assert.equal(safe.layers[0].x,0);
  assert.equal(safe.layers[0].scaleX,1);
  assert.equal(adjustment.type,'adjustment');
});

test('project sanitizer drops malformed mask payloads but keeps the owning layer', () => {
  const safe=sanitizeProject({
    version:PROJECT_VERSION,name:'mask',width:32,height:32,background:'transparent',
    layers:[{id:'shape',type:'shape',name:'shape',width:10,height:10,mask:{enabled:false,dataUrl:'javascript:bad'}}],
  });
  assert.equal(safe.layers.length,1);
  assert.equal(safe.layers[0].mask.enabled,false);
  assert.equal(safe.layers[0].mask.dataUrl,null);
});


test('path sanitizer preserves legacy straight nodes and accepts Bezier handles', () => {
  const safe=sanitizeProject({
    version:PROJECT_VERSION,name:'paths',width:200,height:120,background:'transparent',
    layers:[{
      id:'path',type:'shape',name:'path',shape:'path',width:100,height:80,
      pathPoints:[
        {x:0,y:10},
        {x:50,y:30,handleIn:{x:35,y:0},handleOut:{x:65,y:60},kind:'smooth'},
        {x:100,y:70,handleIn:{x:90,y:40},kind:'corner'},
      ],
    }],
  });
  const [legacy,smooth,corner]=safe.layers[0].pathPoints;
  assert.deepEqual(legacy,{x:0,y:10,handleIn:null,handleOut:null,kind:'corner'});
  assert.deepEqual(smooth.handleIn,{x:35,y:0});
  assert.deepEqual(smooth.handleOut,{x:65,y:60});
  assert.equal(smooth.kind,'smooth');
  assert.deepEqual(corner.handleIn,{x:90,y:40});
  assert.equal(corner.handleOut,null);
  assert.equal(corner.kind,'corner');
});

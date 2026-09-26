import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, constrainedRect, normalizeRect, selectionBounds } from '../src/core/geometry.js';
import { createSelectionGestureController } from '../src/selection/gesture-controller.js';

const TYPES = ['rect','ellipse','lasso','polygon'];
const LABELS = {
  rect:'Прямоугольное выделение',
  ellipse:'Эллиптическое выделение',
  lasso:'Свободное лассо',
  polygon:'Многоугольное лассо',
};

function clone(value) {
  return value == null ? null : structuredClone(value);
}

function setup({ shape = null, tool = 'marquee', zoom = 1 } = {}) {
  let selectionShape = clone(shape);
  let currentTool = tool;
  const statuses = [];
  const typeValues = [];
  let draws = 0;
  const context = {
    getImageData: (_x,_y,width,height) => ({ data:new Uint8ClampedArray(width*height*4) }),
  };
  const controller = createSelectionGestureController({
    selectionTypes:TYPES,
    selectionTypeLabels:LABELS,
    geometry:{clamp,constrainedRect,normalizeRect,selectionBounds},
    selection:{
      getShape:()=>selectionShape,
      setShape:value=>{selectionShape=clone(value);return selectionShape;},
      setPreviewShape:value=>{selectionShape=clone(value);return selectionShape;},
    },
    runtime:{
      getCurrentTool:()=>currentTool,
      getZoom:()=>zoom,
      getDocument:()=>({width:64,height:64}),
      getCanvasContext:()=>context,
    },
    ui:{
      setSelectionTypeValue:value=>typeValues.push(value),
      updateToolLabel:()=>{},
      setStatus:message=>statuses.push(message),
      drawOverlay:()=>{draws+=1;},
    },
  });
  return {
    controller,
    statuses,
    typeValues,
    getShape:()=>selectionShape,
    getDraws:()=>draws,
    setTool:value=>{currentTool=value;},
  };
}

test('rectangle marquee owns preview, release geometry and status without DOM listeners', () => {
  const state=setup();
  const started=state.controller.beginMarquee({x:10,y:10});
  assert.equal(started.drag.kind,'marquee');
  assert.equal(started.drag.selectionType,'rect');
  state.controller.updateMarquee(started.drag,{x:25,y:20});
  assert.deepEqual(state.getShape(),{type:'rect',rect:{x:10,y:10,width:15,height:10}});
  state.controller.finishMarquee(started.drag,{x:40,y:35});
  assert.deepEqual(state.getShape(),{type:'rect',rect:{x:10,y:10,width:30,height:25}});
  assert.match(state.statuses.at(-1),/30 × 25 px/);
});

test('Shift marquee keeps an aspect-locked square through release', () => {
  const state=setup();
  state.controller.setType('ellipse',{announce:false});
  const started=state.controller.beginMarquee({x:8,y:8});
  state.controller.updateMarquee(started.drag,{x:28,y:18},{shiftKey:true});
  state.controller.finishMarquee(started.drag,{x:32,y:20},{shiftKey:true});
  assert.deepEqual(state.getShape(),{type:'ellipse',rect:{x:8,y:8,width:24,height:24}});
});

test('polygon draft cancellation restores the previous selection and completion publishes a polygon', () => {
  const previous={type:'rect',rect:{x:1,y:2,width:8,height:9}};
  const state=setup({shape:previous});
  state.controller.setType('polygon',{announce:false});

  const first=state.controller.beginMarquee({x:5,y:5});
  assert.equal(first.preventDefault,true);
  assert.equal(state.controller.hasPolygonDraft(),true);
  assert.equal(state.getShape(),null);
  state.controller.cancelPolygonDraft({restorePrevious:true,draw:false});
  assert.deepEqual(state.getShape(),previous);

  state.controller.beginMarquee({x:5,y:5});
  state.controller.beginMarquee({x:30,y:5});
  state.controller.beginMarquee({x:30,y:30});
  assert.equal(state.controller.finishPolygonSelection(),true);
  assert.deepEqual(state.getShape(),{
    type:'polygon',
    points:[{x:5,y:5},{x:30,y:5},{x:30,y:30}],
  });
  assert.equal(state.controller.hasPolygonDraft(),false);
});

test('free lasso samples movement and publishes only a bounded final shape', () => {
  const state=setup();
  state.controller.setType('lasso',{announce:false});
  const started=state.controller.beginMarquee({x:2,y:2});
  state.controller.updateMarquee(started.drag,{x:12,y:2});
  state.controller.updateMarquee(started.drag,{x:12,y:14});
  state.controller.finishMarquee(started.drag,{x:2,y:14});
  assert.equal(state.getShape().type,'lasso');
  assert.deepEqual(selectionBounds(state.getShape()),{x:2,y:2,width:10,height:12});
});

test('tool/session resets clear both polygon and magnetic drafts without leaking draft state', () => {
  const state=setup({shape:{type:'rect',rect:{x:0,y:0,width:10,height:10}}});
  state.controller.setType('polygon',{announce:false});
  state.controller.beginMarquee({x:4,y:4});
  assert.equal(state.controller.hasPolygonDraft(),true);
  state.controller.prepareToolChange('move');
  assert.equal(state.controller.hasPolygonDraft(),false);
  assert.deepEqual(state.getShape(),{type:'rect',rect:{x:0,y:0,width:10,height:10}});

  state.setTool('magnetic');
  state.controller.addMagneticPoint({x:10,y:10});
  assert.equal(state.controller.hasMagneticDraft(),true);
  state.controller.resetDrafts();
  assert.equal(state.controller.hasMagneticDraft(),false);
  assert.equal(state.controller.hasPolygonDraft(),false);
});

test('magnetic selection traces intermediate edge points and finishes through the same shape port', () => {
  const state=setup({tool:'magnetic'});
  state.controller.addMagneticPoint({x:10,y:10});
  state.controller.addMagneticPoint({x:42,y:10});
  state.controller.addMagneticPoint({x:42,y:42},{finish:true});
  assert.equal(state.controller.hasMagneticDraft(),false);
  assert.equal(state.getShape().type,'polygon');
  assert.ok(state.getShape().points.length>=3);
});

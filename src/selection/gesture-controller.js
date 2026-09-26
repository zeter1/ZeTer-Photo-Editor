export function cloneSelectionShape(shape) {
  if (!shape) return null;
  if (shape.rect) return { ...shape, rect:{...shape.rect} };
  if (Array.isArray(shape.points)) return { ...shape, points:shape.points.map(point=>({...point})) };
  return { ...shape };
}

export function createSelectionGestureController({
  selectionTypes = [],
  selectionTypeLabels = {},
  geometry = {},
  selection = {},
  runtime = {},
  ui = {},
} = {}) {
  const { clamp, constrainedRect, normalizeRect, selectionBounds } = geometry;
  for (const [name, fn] of Object.entries({ clamp, constrainedRect, normalizeRect, selectionBounds })) {
    if (typeof fn !== 'function') throw new TypeError(`Selection gesture controller requires geometry.${name}`);
  }

  let selectionType = selectionTypes.includes('rect') ? 'rect' : (selectionTypes[0] || 'rect');
  let polygonDraft = null;
  let magneticDraft = null;

  const currentTool = () => runtime.getCurrentTool?.() || '';
  const zoom = () => Math.max(0.01, Number(runtime.getZoom?.()) || 1);
  const documentState = () => runtime.getDocument?.() || { width:0, height:0 };
  const selectionShape = () => selection.getShape?.() ?? null;
  const setSelectionShape = shape => selection.setShape?.(shape) ?? null;
  const setPreviewShape = shape => selection.setPreviewShape?.(shape) ?? setSelectionShape(shape);
  const setStatus = message => ui.setStatus?.(message);
  const drawOverlay = () => ui.drawOverlay?.();

  function getType() {
    return selectionType;
  }

  function hasPolygonDraft() {
    return Boolean(polygonDraft);
  }

  function hasMagneticDraft() {
    return Boolean(magneticDraft);
  }

  function cancelPolygonDraft({ restorePrevious = true, announce = false, draw = true } = {}) {
    if (!polygonDraft) return false;
    const previous = polygonDraft.previousSelection;
    polygonDraft = null;
    if (restorePrevious) setSelectionShape(previous);
    if (draw) drawOverlay();
    if (announce) setStatus('Многоугольное выделение отменено');
    return true;
  }

  function finishPolygonSelection() {
    if (!polygonDraft) return false;
    const points = polygonDraft.points || [];
    const previousSelection = polygonDraft.previousSelection;
    polygonDraft = null;
    if (points.length < 3) {
      setSelectionShape(previousSelection);
      drawOverlay();
      setStatus('Для многоугольного выделения нужно минимум 3 точки');
      return false;
    }
    setSelectionShape({type:'polygon',points});
    drawOverlay();
    setStatus(`Многоугольное выделение: ${points.length} точек`);
    return true;
  }

  function setType(type, { announce = true } = {}) {
    const fallback = selectionTypes.includes('rect') ? 'rect' : selectionType;
    const next = selectionTypes.includes(type) ? type : fallback;
    if (polygonDraft) cancelPolygonDraft({restorePrevious:true});
    selectionType = next;
    ui.setSelectionTypeValue?.(next);
    ui.updateToolLabel?.();
    if (announce && currentTool() === 'marquee') setStatus(`Тип выделения: ${selectionTypeLabels[next] || next}`);
    drawOverlay();
    return next;
  }

  function cycleType() {
    const index = Math.max(0, selectionTypes.indexOf(selectionType));
    return setType(selectionTypes[(index + 1) % Math.max(1, selectionTypes.length)] || selectionType);
  }

  function prepareToolChange(nextTool) {
    if (nextTool !== 'marquee' && polygonDraft) cancelPolygonDraft({restorePrevious:true, draw:false});
    if (nextTool !== 'magnetic') magneticDraft = null;
  }

  function resetDrafts() {
    polygonDraft = null;
    magneticDraft = null;
  }

  function beginMarquee(point, { detail = 1 } = {}) {
    const previousSelection = cloneSelectionShape(selectionShape());
    if (selectionType === 'polygon') {
      if (!polygonDraft) {
        polygonDraft = { points:[{...point}], hover:{...point}, previousSelection };
        setPreviewShape(null);
        setStatus('Многоугольное лассо: ставьте точки, двойной щелчок или Enter — завершить');
      } else {
        const first = polygonDraft.points[0];
        const nearFirst = polygonDraft.points.length >= 3 && Math.hypot(point.x-first.x,point.y-first.y) <= 10/zoom();
        const last = polygonDraft.points.at(-1);
        if (!last || Math.hypot(point.x-last.x,point.y-last.y) > 1/zoom()) polygonDraft.points.push({...point});
        polygonDraft.hover = {...point};
        if (nearFirst || detail >= 2) finishPolygonSelection();
      }
      drawOverlay();
      return { drag:null, preventDefault:true };
    }

    const drag = {
      kind:'marquee',
      selectionType,
      start:{...point},
      current:{...point},
      previousSelection,
      points:selectionType === 'lasso' ? [{...point}] : null,
      lockAspect:false,
    };
    const shape = selectionType === 'lasso'
      ? {type:'lasso',points:[{...point}]}
      : {type:selectionType,rect:{x:point.x,y:point.y,width:0,height:0}};
    setPreviewShape(shape);
    drawOverlay();
    return { drag, preventDefault:false };
  }

  function updateIdleHover(point) {
    if (polygonDraft && currentTool() === 'marquee' && selectionType === 'polygon') polygonDraft.hover = {...point};
    if (magneticDraft && currentTool() === 'magnetic') magneticDraft.hover = findMagneticEdgePoint(point);
  }

  function updateMarquee(drag, point, { shiftKey = false } = {}) {
    if (!drag || drag.kind !== 'marquee') return false;
    drag.current = {...point};
    if (drag.selectionType === 'lasso') {
      const last = drag.points.at(-1);
      const minDistance = Math.max(.5,1.5/zoom());
      if (!last || Math.hypot(point.x-last.x,point.y-last.y) >= minDistance) drag.points.push({...point});
      setPreviewShape({type:'lasso',points:drag.points.map(item=>({...item}))});
    } else {
      drag.lockAspect = Boolean(shiftKey);
      const rect = shiftKey ? constrainedRect(drag.start,point,true) : normalizeRect(drag.start,point);
      setPreviewShape({type:drag.selectionType,rect});
    }
    drawOverlay();
    return true;
  }

  function finishMarquee(drag, point, { shiftKey = false } = {}) {
    if (!drag || drag.kind !== 'marquee') return false;
    drag.current = {...point};
    if (drag.selectionType === 'lasso') {
      const last = drag.points.at(-1);
      if (!last || Math.hypot(point.x-last.x,point.y-last.y) > 1/zoom()) drag.points.push({...point});
      const shape = {type:'lasso',points:drag.points.map(item=>({...item}))};
      const bounds = selectionBounds(shape);
      if (drag.points.length >= 3 && bounds && bounds.width >= 1 && bounds.height >= 1) setSelectionShape(shape);
      else setSelectionShape(null);
    } else {
      const rect = (shiftKey || drag.lockAspect) ? constrainedRect(drag.start,drag.current,true) : normalizeRect(drag.start,drag.current);
      if (rect.width >= 1 && rect.height >= 1) setSelectionShape({type:drag.selectionType,rect});
      else setSelectionShape(null);
    }
    drawOverlay();
    const active = selectionShape();
    const bounds = active ? selectionBounds(active) : null;
    const label = selectionTypeLabels[drag.selectionType] || 'Выделение';
    setStatus(bounds ? `${label}: ${Math.round(bounds.width)} × ${Math.round(bounds.height)} px` : 'Выделение снято');
    return true;
  }

  function cancelMarquee(drag, { draw = false } = {}) {
    if (!drag || drag.kind !== 'marquee') return false;
    setSelectionShape(drag.previousSelection);
    if (draw) drawOverlay();
    return true;
  }

  function drawPolygonDraft(ctx) {
    if (!polygonDraft?.points?.length) return false;
    const points = polygonDraft.points;
    const z = zoom();
    ctx.save();
    ctx.lineWidth = 1/z;
    ctx.setLineDash([5/z,4/z]);
    ctx.strokeStyle = '#79a7ff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(points[0].x,points[0].y);
    for (let i=1;i<points.length;i+=1) ctx.lineTo(points[i].x,points[i].y);
    if (polygonDraft.hover) ctx.lineTo(polygonDraft.hover.x,polygonDraft.hover.y);
    ctx.stroke();
    const radius = 3/z;
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x,point.y,radius,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  function findMagneticEdgePoint(point) {
    const ctx = runtime.getCanvasContext?.();
    const documentValue = documentState();
    if (!ctx || documentValue.width < 3 || documentValue.height < 3) return {...point};
    const radius = Math.max(4,Math.round(10/zoom()));
    const cx = Math.round(point.x), cy = Math.round(point.y);
    const left = clamp(cx-radius,1,Math.max(1,documentValue.width-2));
    const top = clamp(cy-radius,1,Math.max(1,documentValue.height-2));
    const right = clamp(cx+radius,2,documentValue.width-1);
    const bottom = clamp(cy+radius,2,documentValue.height-1);
    const width = right-left+1, height = bottom-top+1;
    if (width < 3 || height < 3) return {...point};
    const data = ctx.getImageData(left-1,top-1,width+2,height+2).data;
    const stride = width+2;
    const luminance = (x,y) => {
      const index = (y*stride+x)*4;
      return data[index]*.2126 + data[index+1]*.7152 + data[index+2]*.0722;
    };
    let best = {x:cx,y:cy,score:-1};
    for (let y=1;y<=height;y+=1) {
      for (let x=1;x<=width;x+=1) {
        const gx = Math.abs(luminance(x+1,y)-luminance(x-1,y));
        const gy = Math.abs(luminance(x,y+1)-luminance(x,y-1));
        const candidateX = left+x-1, candidateY = top+y-1;
        const score = gx+gy-Math.hypot(candidateX-point.x,candidateY-point.y)*1.5;
        if (score > best.score) best = {x:candidateX,y:candidateY,score};
      }
    }
    return {x:best.x,y:best.y};
  }

  function magneticSegmentPoints(from,to) {
    const distance = Math.hypot(to.x-from.x,to.y-from.y);
    const step = Math.max(5,12/zoom());
    const steps = Math.min(256,Math.max(1,Math.ceil(distance/step)));
    const result = [];
    for (let index=1;index<=steps;index+=1) {
      const t = index/steps;
      const snapped = findMagneticEdgePoint({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});
      const previous = result.at(-1) || from;
      if (Math.hypot(snapped.x-previous.x,snapped.y-previous.y) > 1/zoom()) result.push(snapped);
    }
    return result;
  }

  function addMagneticPoint(point, { finish = false } = {}) {
    const snapped = findMagneticEdgePoint(point);
    if (!magneticDraft) magneticDraft = {points:[],hover:snapped};
    const last = magneticDraft.points.at(-1);
    if (last) magneticDraft.points.push(...magneticSegmentPoints(last,snapped));
    else magneticDraft.points.push(snapped);
    magneticDraft.hover = snapped;
    if (finish && magneticDraft.points.length >= 3) return finishMagneticSelection();
    setStatus(`Магнитное лассо: ${magneticDraft.points.length} точек • Enter или двойной щелчок — завершить`);
    drawOverlay();
    return true;
  }

  function finishMagneticSelection() {
    if (!magneticDraft || magneticDraft.points.length < 3) return false;
    const points = magneticDraft.points;
    magneticDraft = null;
    setSelectionShape({type:'polygon',points});
    drawOverlay();
    setStatus(`Магнитное выделение: ${points.length} точек`);
    return true;
  }

  function cancelMagneticDraft({ announce = false, draw = true } = {}) {
    if (!magneticDraft) return false;
    magneticDraft = null;
    if (draw) drawOverlay();
    if (announce) setStatus('Магнитное выделение отменено');
    return true;
  }

  function drawMagneticDraft(ctx) {
    if (!magneticDraft?.points?.length) return false;
    const points = magneticDraft.points;
    const z = zoom();
    ctx.save();
    ctx.lineWidth = 1.5/z;
    ctx.strokeStyle = '#ff5fa8';
    ctx.fillStyle = '#fff';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x,points[0].y);
    for (let i=1;i<points.length;i+=1) ctx.lineTo(points[i].x,points[i].y);
    if (magneticDraft.hover) ctx.lineTo(magneticDraft.hover.x,magneticDraft.hover.y);
    ctx.stroke();
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x,point.y,2.5/z,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  }

  return {
    getType,
    setType,
    cycleType,
    prepareToolChange,
    resetDrafts,
    hasPolygonDraft,
    hasMagneticDraft,
    cancelPolygonDraft,
    finishPolygonSelection,
    beginMarquee,
    updateIdleHover,
    updateMarquee,
    finishMarquee,
    cancelMarquee,
    addMagneticPoint,
    finishMagneticSelection,
    cancelMagneticDraft,
    drawPolygonDraft,
    drawMagneticDraft,
  };
}

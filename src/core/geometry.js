export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function selectionPixelBounds(rect, docWidth, docHeight) {
  if (!rect) return null;
  const width = Math.max(0, Number(docWidth) || 0);
  const height = Math.max(0, Number(docHeight) || 0);
  if (!width || !height) return null;
  const x1 = Math.min(Number(rect.x) || 0, (Number(rect.x) || 0) + (Number(rect.width) || 0));
  const y1 = Math.min(Number(rect.y) || 0, (Number(rect.y) || 0) + (Number(rect.height) || 0));
  const x2 = Math.max(Number(rect.x) || 0, (Number(rect.x) || 0) + (Number(rect.width) || 0));
  const y2 = Math.max(Number(rect.y) || 0, (Number(rect.y) || 0) + (Number(rect.height) || 0));
  const left = clamp(Math.floor(x1), 0, width);
  const top = clamp(Math.floor(y1), 0, height);
  const right = clamp(Math.ceil(x2), 0, width);
  const bottom = clamp(Math.ceil(y2), 0, height);
  if (right <= left || bottom <= top) return null;
  return { x:left, y:top, width:right-left, height:bottom-top };
}

export function selectionBounds(selection) {
  if (!selection) return null;
  if (selection.type === 'rect' || selection.type === 'ellipse') {
    const rect = selection.rect;
    if (!rect) return null;
    const x1 = Math.min(Number(rect.x) || 0, (Number(rect.x) || 0) + (Number(rect.width) || 0));
    const y1 = Math.min(Number(rect.y) || 0, (Number(rect.y) || 0) + (Number(rect.height) || 0));
    const x2 = Math.max(Number(rect.x) || 0, (Number(rect.x) || 0) + (Number(rect.width) || 0));
    const y2 = Math.max(Number(rect.y) || 0, (Number(rect.y) || 0) + (Number(rect.height) || 0));
    return { x:x1, y:y1, width:x2-x1, height:y2-y1 };
  }
  const points = Array.isArray(selection.points) ? selection.points : [];
  if (!points.length) return null;
  const xs = points.map(point => Number(point.x)).filter(Number.isFinite);
  const ys = points.map(point => Number(point.y)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const left = Math.min(...xs); const right = Math.max(...xs);
  const top = Math.min(...ys); const bottom = Math.max(...ys);
  return { x:left, y:top, width:right-left, height:bottom-top };
}

export function selectionPathPoints(selection, ellipseSegments = 64) {
  if (!selection) return [];
  if (selection.type === 'rect') {
    const rect = selectionBounds(selection);
    if (!rect) return [];
    return [
      {x:rect.x,y:rect.y},
      {x:rect.x+rect.width,y:rect.y},
      {x:rect.x+rect.width,y:rect.y+rect.height},
      {x:rect.x,y:rect.y+rect.height},
    ];
  }
  if (selection.type === 'ellipse') {
    const rect = selectionBounds(selection);
    if (!rect) return [];
    const count = Math.max(12, Math.min(256, Math.round(Number(ellipseSegments) || 64)));
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const rx = rect.width / 2;
    const ry = rect.height / 2;
    return Array.from({length:count}, (_, index) => {
      const angle = index / count * Math.PI * 2;
      return { x:cx + Math.cos(angle) * rx, y:cy + Math.sin(angle) * ry };
    });
  }
  return (Array.isArray(selection.points) ? selection.points : [])
    .filter(point => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
    .map(point => ({x:Number(point.x),y:Number(point.y)}));
}

export function pointInPolygon(point, points) {
  if (!point || !Array.isArray(points) || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]; const b = points[j];
    const ax = Number(a.x); const ay = Number(a.y);
    const bx = Number(b.x); const by = Number(b.y);
    const px = Number(point.x); const py = Number(point.y);
    const cross = (px-ax)*(by-ay) - (py-ay)*(bx-ax);
    const dot = (px-ax)*(px-bx) + (py-ay)*(py-by);
    if (Math.abs(cross) <= 1e-8 && dot <= 1e-8) return true;
    const intersects = ((ay > py) !== (by > py)) && (px < (bx-ax) * (py-ay) / ((by-ay) || Number.EPSILON) + ax);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInSelection(point, selection) {
  if (!selection) return false;
  const bounds = selectionBounds(selection);
  if (!bounds) return false;
  if (selection.type === 'rect') return pointInRect(point, bounds);
  if (selection.type === 'ellipse') {
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    const rx = bounds.width / 2; const ry = bounds.height / 2;
    const cx = bounds.x + rx; const cy = bounds.y + ry;
    const dx = (Number(point.x) - cx) / rx;
    const dy = (Number(point.y) - cy) / ry;
    return dx*dx + dy*dy <= 1 + 1e-9;
  }
  return pointInPolygon(point, selectionPathPoints(selection));
}

export function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function rotatePoint(point, center, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function layerBounds(layer) {
  const width = Math.max(1, Number(layer.width) || 1);
  const height = Math.max(1, Number(layer.height) || 1);
  const scaleX = Math.max(0.01, Number(layer.scaleX) || 1);
  const scaleY = Math.max(0.01, Number(layer.scaleY) || 1);
  return {
    x: Number(layer.x) || 0,
    y: Number(layer.y) || 0,
    width: width * scaleX,
    height: height * scaleY,
  };
}

export function layerFrame(layer) {
  const bounds = layerBounds(layer);
  const radians = (Number(layer.rotation) || 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const ux = { x: cos, y: sin };
  const uy = { x: -sin, y: cos };
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const offset = (du, dv) => ({
    x: center.x + ux.x * du + uy.x * dv,
    y: center.y + ux.y * du + uy.y * dv,
  });
  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;
  const handles = {
    nw: offset(-halfW, -halfH), n: offset(0, -halfH), ne: offset(halfW, -halfH),
    e: offset(halfW, 0), se: offset(halfW, halfH), s: offset(0, halfH),
    sw: offset(-halfW, halfH), w: offset(-halfW, 0),
  };
  return {
    ...bounds,
    center,
    radians,
    ux,
    uy,
    handles,
    corners: [handles.nw, handles.ne, handles.se, handles.sw],
  };
}


export function frameBounds(layer, padding = 0) {
  const frame = layerFrame(layer);
  const xs = frame.corners.map(point => point.x);
  const ys = frame.corners.map(point => point.y);
  const pad = Math.max(0, Number(padding) || 0);
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  const right = Math.max(...xs) + pad;
  const bottom = Math.max(...ys) + pad;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function snapLayerMove(layer, x, y, {
  docWidth = 0,
  docHeight = 0,
  targetRects = [],
  threshold = 8,
} = {}) {
  const candidate = { ...layer, x:Number(x) || 0, y:Number(y) || 0 };
  const bounds = frameBounds(candidate);
  const limit = Math.max(0, Number(threshold) || 0);

  const movingX = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
  const movingY = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];
  const targetX = [0, Number(docWidth) / 2, Number(docWidth)];
  const targetY = [0, Number(docHeight) / 2, Number(docHeight)];

  for (const rect of targetRects || []) {
    if (!rect) continue;
    const left = Number(rect.x) || 0;
    const top = Number(rect.y) || 0;
    const width = Math.max(0, Number(rect.width) || 0);
    const height = Math.max(0, Number(rect.height) || 0);
    targetX.push(left, left + width / 2, left + width);
    targetY.push(top, top + height / 2, top + height);
  }

  const closest = (moving, targets) => {
    let best = null;
    for (const source of moving) {
      for (const target of targets) {
        if (!Number.isFinite(source) || !Number.isFinite(target)) continue;
        const delta = target - source;
        const distance = Math.abs(delta);
        if (distance > limit || (best && distance >= best.distance)) continue;
        best = { delta, distance, target };
      }
    }
    return best;
  };

  const bestX = closest(movingX, targetX);
  const bestY = closest(movingY, targetY);
  return {
    x: candidate.x + (bestX?.delta || 0),
    y: candidate.y + (bestY?.delta || 0),
    guides: {
      x: bestX ? bestX.target : null,
      y: bestY ? bestY.target : null,
    },
  };
}

export function alignLayerToCanvas(layer, mode, docWidth, docHeight) {
  const bounds = frameBounds(layer);
  let dx = 0;
  let dy = 0;
  if (mode === 'left') dx = -bounds.x;
  else if (mode === 'hcenter') dx = Number(docWidth) / 2 - (bounds.x + bounds.width / 2);
  else if (mode === 'right') dx = Number(docWidth) - (bounds.x + bounds.width);
  else if (mode === 'top') dy = -bounds.y;
  else if (mode === 'vcenter') dy = Number(docHeight) / 2 - (bounds.y + bounds.height / 2);
  else if (mode === 'bottom') dy = Number(docHeight) - (bounds.y + bounds.height);
  else return { x:layer.x, y:layer.y, changed:false };
  return {
    x: (Number(layer.x) || 0) + dx,
    y: (Number(layer.y) || 0) + dy,
    changed: Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9,
  };
}

export function rotationHandlePoint(layer, distance = 28) {
  const frame = layerFrame(layer);
  const offset = Math.max(0, Number(distance) || 0);
  return {
    x: frame.handles.n.x - frame.uy.x * offset,
    y: frame.handles.n.y - frame.uy.y * offset,
  };
}

export function rotationFromDrag(initialRotation, center, startPoint, currentPoint, snapDegrees = 0) {
  const start = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
  const current = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x);
  let next = (Number(initialRotation) || 0) + (current - start) * 180 / Math.PI;
  if (snapDegrees > 0) next = Math.round(next / snapDegrees) * snapDegrees;
  return ((next % 360) + 360) % 360;
}

function distanceToSegment(point, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq <= 1e-12) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / lengthSq, 0, 1);
  const x = a.x + vx * t;
  const y = a.y + vy * t;
  return Math.hypot(point.x - x, point.y - y);
}

export function pointInLayer(point, layer) {
  const frame = layerFrame(layer);
  const local = rotatePoint(point, frame.center, -frame.radians);
  if (layer?.type === 'shape' && layer?.shape === 'line') {
    let a; let b;
    if (layer.lineMode === 'horizontal') { a = { x: frame.x, y: frame.y + frame.height / 2 }; b = { x: frame.x + frame.width, y: frame.y + frame.height / 2 }; }
    else if (layer.lineMode === 'vertical') { a = { x: frame.x + frame.width / 2, y: frame.y }; b = { x: frame.x + frame.width / 2, y: frame.y + frame.height }; }
    else if (layer.lineFlip) { a = { x: frame.x, y: frame.y + frame.height }; b = { x: frame.x + frame.width, y: frame.y }; }
    else { a = { x: frame.x, y: frame.y }; b = { x: frame.x + frame.width, y: frame.y + frame.height }; }
    const tolerance = Math.max(6, (Number(layer.strokeWidth) || 1) * Math.max(Math.abs(Number(layer.scaleX) || 1), Math.abs(Number(layer.scaleY) || 1)) / 2 + 3);
    return distanceToSegment(local, a, b) <= tolerance;
  }
  return pointInRect(local, frame);
}

export function hitLayerHandle(point, layer, radius = 8) {
  const handles = layerFrame(layer).handles;
  let best = null;
  let bestDistance = Infinity;
  for (const [name, handle] of Object.entries(handles)) {
    const distance = Math.hypot(point.x - handle.x, point.y - handle.y);
    if (distance <= radius && distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

export function resizeLayerFromPoint(layer, handle, point, { minSize = 4, lockAspect = false, fromCenter = false } = {}) {
  const frame = layerFrame(layer);
  const baseWidth = Math.max(1, Number(layer.width) || 1);
  const baseHeight = Math.max(1, Number(layer.height) || 1);
  const project = (p, axis) => p.x * axis.x + p.y * axis.y;
  const cu = project(frame.center, frame.ux);
  const cv = project(frame.center, frame.uy);
  let left = cu - frame.width / 2;
  let right = cu + frame.width / 2;
  let top = cv - frame.height / 2;
  let bottom = cv + frame.height / 2;
  const pu = project(point, frame.ux);
  const pv = project(point, frame.uy);

  if (fromCenter) {
    if (handle.includes('e') || handle.includes('w')) {
      const halfWidth = Math.max(minSize / 2, Math.abs(pu - cu));
      left = cu - halfWidth;
      right = cu + halfWidth;
    }
    if (handle.includes('s') || handle.includes('n')) {
      const halfHeight = Math.max(minSize / 2, Math.abs(pv - cv));
      top = cv - halfHeight;
      bottom = cv + halfHeight;
    }
  } else {
    if (handle.includes('e')) right = Math.max(left + minSize, pu);
    if (handle.includes('w')) left = Math.min(right - minSize, pu);
    if (handle.includes('s')) bottom = Math.max(top + minSize, pv);
    if (handle.includes('n')) top = Math.min(bottom - minSize, pv);
  }

  const isCorner = handle.length === 2;
  if (lockAspect && isCorner) {
    const aspect = frame.width / Math.max(frame.height, 1e-9);
    if (fromCenter) {
      let width = Math.max(minSize, right - left);
      let height = Math.max(minSize, bottom - top);
      if (width / height > aspect) height = width / aspect;
      else width = height * aspect;
      left = cu - width / 2;
      right = cu + width / 2;
      top = cv - height / 2;
      bottom = cv + height / 2;
    } else {
      const fixedU = handle.includes('e') ? left : right;
      const fixedV = handle.includes('s') ? top : bottom;
      const signU = handle.includes('e') ? 1 : -1;
      const signV = handle.includes('s') ? 1 : -1;
      let width = Math.max(minSize, Math.abs((handle.includes('e') ? right : left) - fixedU));
      let height = Math.max(minSize, Math.abs((handle.includes('s') ? bottom : top) - fixedV));
      if (width / height > aspect) height = width / aspect;
      else width = height * aspect;
      if (handle.includes('e')) right = fixedU + signU * width; else left = fixedU + signU * width;
      if (handle.includes('s')) bottom = fixedV + signV * height; else top = fixedV + signV * height;
    }
  }

  const width = Math.max(minSize, right - left);
  const height = Math.max(minSize, bottom - top);
  const nextCu = (left + right) / 2;
  const nextCv = (top + bottom) / 2;
  const center = {
    x: frame.ux.x * nextCu + frame.uy.x * nextCv,
    y: frame.ux.y * nextCu + frame.uy.y * nextCv,
  };
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    scaleX: width / baseWidth,
    scaleY: height / baseHeight,
  };
}

export function constrainedRect(start, current, lockAspect = false) {
  if (!lockAspect) return normalizeRect(start, current);
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const end = {
    x: start.x + (dx < 0 ? -side : side),
    y: start.y + (dy < 0 ? -side : side),
  };
  return normalizeRect(start, end);
}


export function snapLineEnd(start, current, stepDegrees = 45) {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const length = Math.hypot(dx, dy);
  const step = Math.max(0, Number(stepDegrees) || 0);
  if (!length || !step) return { x: current.x, y: current.y };
  const angle = Math.atan2(dy, dx);
  const increment = step * Math.PI / 180;
  const snapped = Math.round(angle / increment) * increment;
  return {
    x: start.x + Math.cos(snapped) * length,
    y: start.y + Math.sin(snapped) * length,
  };
}

export function fitZoom(viewWidth, viewHeight, docWidth, docHeight, padding = 80) {
  if (!docWidth || !docHeight) return 1;
  const usableWidth = Math.max(1, viewWidth - padding);
  const usableHeight = Math.max(1, viewHeight - padding);
  return clamp(Math.min(usableWidth / docWidth, usableHeight / docHeight), 0.1, 16);
}

export function resizeFromHandle(bounds, handle, dx, dy, minSize = 12) {
  let { x, y, width, height } = bounds;
  if (handle.includes('e')) width = Math.max(minSize, width + dx);
  if (handle.includes('s')) height = Math.max(minSize, height + dy);
  if (handle.includes('w')) {
    const next = Math.max(minSize, width - dx);
    x += width - next;
    width = next;
  }
  if (handle.includes('n')) {
    const next = Math.max(minSize, height - dy);
    y += height - next;
    height = next;
  }
  return { x, y, width, height };
}
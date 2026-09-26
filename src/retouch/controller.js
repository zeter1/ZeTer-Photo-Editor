import { clamp } from '../core/geometry.js';
import { applyBlurBrushPixels, applyToneBrushPixels } from '../core/pixels.js';
import {
  clonePixelBuffer,
  applyPixelBufferToneDab,
  applyPixelBufferBlurDab,
  applyPixelBufferCloneDab,
  applyPixelBufferSmudgeDab,
  applyCmykPixelBufferToneDab,
  applyCmykPixelBufferBlurDab,
  applyCmykPixelBufferCloneDab,
  applyCmykPixelBufferSmudgeDab,
} from '../core/pixel-buffer.js';

/**
 * Destructive retouch mechanics and their private per-stroke scratch state.
 *
 * Document/history/pointer state stays in the runtime. Pixel math stays in
 * core/pixels.js and core/pixel-buffer.js.
 */
export function createRetouchController({
  getBrushCanvas,
  getBrushContext,
  getDrag,
  getHighDepthPaintBuffer,
  getHighDepthPaintLayerId,
  markHighDepthPreviewDirty,
  brushWidthForPointer,
  rasterSelectionPredicate,
  schedulePaintPreview,
  getToolOpacity,
  getSmudgeStrength,
  getDodgeStrength,
  getBurnStrength,
  getBlurStrength,
  documentRef = globalThis.document,
}) {
  let cloneSource = null;
  let cloneSnapshotCanvas = null;
  let highDepthCloneSnapshotBuffer = null;
  let blurScratchCanvas = null;
  let blurScratchCtx = null;
  let retouchScratchCanvas = null;
  let retouchScratchCtx = null;

  const copyPoint = point => point ? { x:point.x, y:point.y } : null;
  const copyCloneSource = source => source ? {
    layerId:source.layerId,
    documentPoint:copyPoint(source.documentPoint),
    localPoint:copyPoint(source.localPoint),
  } : null;

  function getCloneSource() {
    return copyCloneSource(cloneSource);
  }

  function setCloneSource(source) {
    cloneSource = copyCloneSource(source);
    return getCloneSource();
  }

  function resetStroke() {
    cloneSnapshotCanvas = null;
    highDepthCloneSnapshotBuffer = null;
  }

  function ensureRetouchScratch(width, height) {
    if (!retouchScratchCanvas) retouchScratchCanvas = documentRef.createElement('canvas');
    if (retouchScratchCanvas.width !== width || retouchScratchCanvas.height !== height) {
      retouchScratchCanvas.width = width;
      retouchScratchCanvas.height = height;
      retouchScratchCtx = retouchScratchCanvas.getContext('2d', { alpha:true });
    } else if (!retouchScratchCtx) {
      retouchScratchCtx = retouchScratchCanvas.getContext('2d', { alpha:true });
    }
    retouchScratchCtx.setTransform(1,0,0,1,0,0);
    retouchScratchCtx.globalAlpha = 1;
    retouchScratchCtx.globalCompositeOperation = 'source-over';
    retouchScratchCtx.filter = 'none';
    retouchScratchCtx.clearRect(0,0,width,height);
    return { canvas:retouchScratchCanvas, ctx:retouchScratchCtx };
  }

  function ensureBlurScratch(width, height) {
    if (!blurScratchCanvas) blurScratchCanvas = documentRef.createElement('canvas');
    if (blurScratchCanvas.width !== width || blurScratchCanvas.height !== height) {
      blurScratchCanvas.width = width;
      blurScratchCanvas.height = height;
      blurScratchCtx = blurScratchCanvas.getContext('2d', { alpha:true });
    } else if (!blurScratchCtx) {
      blurScratchCtx = blurScratchCanvas.getContext('2d', { alpha:true });
    }
    return { canvas:blurScratchCanvas, ctx:blurScratchCtx };
  }

  function applyFeatherMask(ctx, centerX, centerY, radius) {
    const gradient = ctx.createRadialGradient(
      centerX, centerY, Math.max(0, radius*.55),
      centerX, centerY, Math.max(.5, radius),
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.restore();
  }

  function prepareCloneStroke(layer, destinationPoint) {
    const brushCanvas = getBrushCanvas();
    if (!cloneSource || cloneSource.layerId !== layer?.id || !brushCanvas) return false;
    cloneSnapshotCanvas = documentRef.createElement('canvas');
    cloneSnapshotCanvas.width = brushCanvas.width;
    cloneSnapshotCanvas.height = brushCanvas.height;
    cloneSnapshotCanvas.getContext('2d', { alpha:true }).drawImage(brushCanvas,0,0);
    return {
      x:cloneSource.localPoint.x-destinationPoint.x,
      y:cloneSource.localPoint.y-destinationPoint.y,
    };
  }

  function applyCloneDab(point, offset, pointerEvent = null, healing = false) {
    const brushCtx = getBrushContext();
    if (!cloneSnapshotCanvas || !brushCtx || !offset) return false;
    const radius = Math.max(.5, brushWidthForPointer(pointerEvent)/2);
    const padding = 2;
    const left = Math.floor(point.x-radius-padding);
    const top = Math.floor(point.y-radius-padding);
    const size = Math.max(2, Math.ceil(radius*2+padding*2));
    const { canvas:scratch, ctx:scratchCtx } = ensureRetouchScratch(size,size);
    scratchCtx.drawImage(cloneSnapshotCanvas,-left-offset.x,-top-offset.y);
    applyFeatherMask(scratchCtx, point.x-left, point.y-top, radius);
    brushCtx.save();
    brushCtx.globalAlpha = clamp(getToolOpacity(),0,1) * (healing ? .68 : 1);
    brushCtx.globalCompositeOperation = healing ? 'soft-light' : 'source-over';
    brushCtx.drawImage(scratch,left,top);
    brushCtx.restore();
    return true;
  }

  function cloneStrokeSegment(from, to, offset, pointerEvent = null, healing = false) {
    const spacing = Math.max(1,brushWidthForPointer(pointerEvent)*.18);
    const distance = Math.hypot(to.x-from.x,to.y-from.y);
    const steps = Math.max(1,Math.ceil(distance/spacing));
    for (let index=1; index<=steps; index+=1) {
      const t = index/steps;
      applyCloneDab(
        {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},
        offset,pointerEvent,healing,
      );
    }
  }

  function applySmudgeDab(from, to, pointerEvent = null) {
    const brushCanvas = getBrushCanvas();
    const brushCtx = getBrushContext();
    if (!brushCanvas || !brushCtx) return false;
    const radius = Math.max(.5,brushWidthForPointer(pointerEvent)/2);
    const left = Math.max(0,Math.floor(from.x-radius-2));
    const top = Math.max(0,Math.floor(from.y-radius-2));
    const right = Math.min(brushCanvas.width,Math.ceil(from.x+radius+2));
    const bottom = Math.min(brushCanvas.height,Math.ceil(from.y+radius+2));
    const width = right-left, height = bottom-top;
    if (width<=0 || height<=0) return false;
    const { canvas:scratch, ctx:scratchCtx } = ensureBlurScratch(width,height);
    scratchCtx.setTransform(1,0,0,1,0,0);
    scratchCtx.globalCompositeOperation = 'source-over';
    scratchCtx.clearRect(0,0,width,height);
    scratchCtx.drawImage(brushCanvas,left,top,width,height,0,0,width,height);
    applyFeatherMask(scratchCtx,from.x-left,from.y-top,radius);
    brushCtx.save();
    brushCtx.globalAlpha = clamp(getSmudgeStrength(),.01,1);
    brushCtx.globalCompositeOperation = 'source-over';
    brushCtx.drawImage(
      scratch,0,0,width,height,
      to.x-(from.x-left),to.y-(from.y-top),width,height,
    );
    brushCtx.restore();
    return true;
  }

  function smudgeStrokeSegment(from, to, pointerEvent = null) {
    const spacing = Math.max(1,brushWidthForPointer(pointerEvent)*.14);
    const distance = Math.hypot(to.x-from.x,to.y-from.y);
    const steps = Math.max(1,Math.ceil(distance/spacing));
    let previous = from;
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      const point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
      applySmudgeDab(previous,point,pointerEvent);
      previous=point;
    }
  }

  function applyToneDab(layer, point, pointerEvent = null, brighten = true) {
    const brushCanvas = getBrushCanvas();
    const brushCtx = getBrushContext();
    if (!brushCanvas || !brushCtx || !layer) return false;
    const radius = Math.max(.5,brushWidthForPointer(pointerEvent)/2);
    const left = Math.max(0,Math.floor(point.x-radius));
    const top = Math.max(0,Math.floor(point.y-radius));
    const right = Math.min(brushCanvas.width,Math.ceil(point.x+radius));
    const bottom = Math.min(brushCanvas.height,Math.ceil(point.y+radius));
    const width=right-left, height=bottom-top;
    if (width<=0 || height<=0) return false;
    const strength = brighten ? getDodgeStrength() : getBurnStrength();
    const imageData = brushCtx.getImageData(left,top,width,height);
    const selectionAllows = rasterSelectionPredicate(layer);
    const drag = getDrag();
    const changed = applyToneBrushPixels(
      imageData.data,width,height,point.x-left,point.y-top,radius,strength,
      {
        brighten,
        isAllowed:selectionAllows ? (x,y)=>selectionAllows(left+x,top+y) : null,
        strokeCoverage:drag?.toneCoverage,
        originX:left,originY:top,
      },
    );
    if (changed) brushCtx.putImageData(imageData,left,top);
    return changed>0;
  }

  function toneStrokeSegment(layer, from, to, pointerEvent = null, brighten = true) {
    const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);
    const distance=Math.hypot(to.x-from.x,to.y-from.y);
    const steps=Math.max(1,Math.ceil(distance/spacing));
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      applyToneDab(
        layer,
        {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},
        pointerEvent,brighten,
      );
    }
  }

  function applyBlurDab(layer, point, pointerEvent = null) {
    const brushCanvas = getBrushCanvas();
    const brushCtx = getBrushContext();
    if (!brushCanvas || !brushCtx || !layer) return false;
    const diameter = Math.max(1,brushWidthForPointer(pointerEvent));
    const radius = diameter/2;
    const blurRadius = 5;
    const margin = Math.ceil(blurRadius*3+2);
    const left = Math.max(0,Math.floor(point.x-radius-margin));
    const top = Math.max(0,Math.floor(point.y-radius-margin));
    const right = Math.min(brushCanvas.width,Math.ceil(point.x+radius+margin));
    const bottom = Math.min(brushCanvas.height,Math.ceil(point.y+radius+margin));
    const width=right-left, height=bottom-top;
    if (width<=0 || height<=0) return false;

    const { canvas:scratch, ctx:scratchCtx } = ensureBlurScratch(width,height);
    scratchCtx.save();
    scratchCtx.setTransform(1,0,0,1,0,0);
    scratchCtx.globalAlpha=1;
    scratchCtx.globalCompositeOperation='source-over';
    scratchCtx.filter='none';
    scratchCtx.clearRect(0,0,width,height);
    scratchCtx.drawImage(brushCanvas,left,top,width,height,0,0,width,height);
    scratchCtx.restore();

    const { ctx:softenedCtx } = ensureRetouchScratch(width,height);
    softenedCtx.save();
    softenedCtx.filter = `blur(${blurRadius}px)`;
    softenedCtx.drawImage(scratch,0,0);
    softenedCtx.restore();
    const imageData=brushCtx.getImageData(left,top,width,height);
    const blurredData=softenedCtx.getImageData(0,0,width,height);
    const selectionAllows=rasterSelectionPredicate(layer);
    const drag=getDrag();
    const changed=applyBlurBrushPixels(
      imageData.data,blurredData.data,width,height,
      point.x-left,point.y-top,radius,getBlurStrength(),
      {
        isAllowed:selectionAllows ? (x,y)=>selectionAllows(left+x,top+y) : null,
        strokeCoverage:drag?.blurCoverage,
        originX:left,originY:top,
      },
    );
    if (changed) brushCtx.putImageData(imageData,left,top);
    return changed>0;
  }

  function blurStrokeSegment(layer, from, to, pointerEvent = null) {
    const diameter=Math.max(1,brushWidthForPointer(pointerEvent));
    const spacing=Math.max(1,diameter*.22);
    const distance=Math.hypot(to.x-from.x,to.y-from.y);
    const steps=Math.max(1,Math.ceil(distance/spacing));
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      applyBlurDab(
        layer,
        {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},
        pointerEvent,
      );
    }
  }

  function activeHighDepthBuffer(layer) {
    const buffer=getHighDepthPaintBuffer();
    return getHighDepthPaintLayerId()===layer?.id && buffer ? buffer : null;
  }

  function markNativeHighDepthRetouchChanged(changed) {
    if (changed>0) {
      markHighDepthPreviewDirty();
      schedulePaintPreview();
      return true;
    }
    return false;
  }

  function applyNativeHighDepthToneDab(layer, point, pointerEvent = null, brighten = true) {
    const buffer=activeHighDepthBuffer(layer);
    if (!buffer) return false;
    const strength=brighten ? getDodgeStrength() : getBurnStrength();
    const fn=buffer.model === 'cmyk' ? applyCmykPixelBufferToneDab : applyPixelBufferToneDab;
    const changed=fn(
      buffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),strength,
      {
        brighten,
        isAllowed:rasterSelectionPredicate(layer),
        strokeCoverage:getDrag()?.toneCoverage,
      },
    );
    return markNativeHighDepthRetouchChanged(changed);
  }

  function nativeHighDepthToneSegment(layer, from, to, pointerEvent = null, brighten = true) {
    const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);
    const distance=Math.hypot(to.x-from.x,to.y-from.y);
    const steps=Math.max(1,Math.ceil(distance/spacing));
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      applyNativeHighDepthToneDab(
        layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},
        pointerEvent,brighten,
      );
    }
  }

  function applyNativeHighDepthBlurDab(layer, point, pointerEvent = null) {
    const buffer=activeHighDepthBuffer(layer);
    if (!buffer) return false;
    const fn=buffer.model === 'cmyk' ? applyCmykPixelBufferBlurDab : applyPixelBufferBlurDab;
    const changed=fn(
      buffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),getBlurStrength(),
      {
        sampleRadius:3,
        isAllowed:rasterSelectionPredicate(layer),
        strokeCoverage:getDrag()?.blurCoverage,
      },
    );
    return markNativeHighDepthRetouchChanged(changed);
  }

  function nativeHighDepthBlurSegment(layer, from, to, pointerEvent = null) {
    const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.22);
    const distance=Math.hypot(to.x-from.x,to.y-from.y);
    const steps=Math.max(1,Math.ceil(distance/spacing));
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      applyNativeHighDepthBlurDab(
        layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},
        pointerEvent,
      );
    }
  }

  function prepareNativeHighDepthCloneStroke(layer, destinationPoint) {
    const buffer=activeHighDepthBuffer(layer);
    if (!cloneSource || cloneSource.layerId!==layer?.id || !buffer) return false;
    highDepthCloneSnapshotBuffer=clonePixelBuffer(buffer);
    return {
      x:cloneSource.localPoint.x-destinationPoint.x,
      y:cloneSource.localPoint.y-destinationPoint.y,
    };
  }

  function applyNativeHighDepthCloneDab(
    layer, point, offset, pointerEvent = null, healing = false,
  ) {
    const buffer=activeHighDepthBuffer(layer);
    if (!buffer || !highDepthCloneSnapshotBuffer || !offset) return false;
    const fn=buffer.model === 'cmyk' ? applyCmykPixelBufferCloneDab : applyPixelBufferCloneDab;
    const changed=fn(
      buffer,highDepthCloneSnapshotBuffer,
      point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),offset,
      {
        opacity:getToolOpacity(),
        healing,
        isAllowed:rasterSelectionPredicate(layer),
      },
    );
    return markNativeHighDepthRetouchChanged(changed);
  }

  function nativeHighDepthCloneSegment(
    layer, from, to, offset, pointerEvent = null, healing = false,
  ) {
    const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);
    const distance=Math.hypot(to.x-from.x,to.y-from.y);
    const steps=Math.max(1,Math.ceil(distance/spacing));
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      applyNativeHighDepthCloneDab(
        layer,
        {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},
        offset,pointerEvent,healing,
      );
    }
  }

  function applyNativeHighDepthSmudgeDab(layer, from, to, pointerEvent = null) {
    const buffer=activeHighDepthBuffer(layer);
    if (!buffer) return false;
    const fn=buffer.model === 'cmyk' ? applyCmykPixelBufferSmudgeDab : applyPixelBufferSmudgeDab;
    const changed=fn(
      buffer,from,to,Math.max(.5,brushWidthForPointer(pointerEvent)/2),getSmudgeStrength(),
      {isAllowed:rasterSelectionPredicate(layer)},
    );
    return markNativeHighDepthRetouchChanged(changed);
  }

  function nativeHighDepthSmudgeSegment(layer, from, to, pointerEvent = null) {
    const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.14);
    const distance=Math.hypot(to.x-from.x,to.y-from.y);
    const steps=Math.max(1,Math.ceil(distance/spacing));
    let previous=from;
    for (let index=1; index<=steps; index+=1) {
      const t=index/steps;
      const point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
      applyNativeHighDepthSmudgeDab(layer,previous,point,pointerEvent);
      previous=point;
    }
  }

  return {
    getCloneSource,
    setCloneSource,
    resetStroke,
    prepareCloneStroke,
    applyCloneDab,
    cloneStrokeSegment,
    applySmudgeDab,
    smudgeStrokeSegment,
    applyToneDab,
    toneStrokeSegment,
    applyBlurDab,
    blurStrokeSegment,
    applyNativeHighDepthToneDab,
    nativeHighDepthToneSegment,
    applyNativeHighDepthBlurDab,
    nativeHighDepthBlurSegment,
    prepareNativeHighDepthCloneStroke,
    applyNativeHighDepthCloneDab,
    nativeHighDepthCloneSegment,
    applyNativeHighDepthSmudgeDab,
    nativeHighDepthSmudgeSegment,
  };
}

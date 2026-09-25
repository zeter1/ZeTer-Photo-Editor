import { clamp } from './geometry.js';


function maskLineExtreme(length, radius, getValue, setValue, useMax) {
  const r = Math.max(0, Math.trunc(radius));
  if (!length) return;
  if (!r) {
    for (let i = 0; i < length; i += 1) setValue(i, getValue(i));
    return;
  }
  const capacity = length + r * 2 + 2;
  const indices = new Int32Array(capacity);
  const values = new Uint8Array(capacity);
  let head = 0;
  let tail = 0;
  const dominates = useMax
    ? (a, b) => a <= b
    : (a, b) => a >= b;

  for (let i = -r; i < length + r; i += 1) {
    const value = i >= 0 && i < length ? getValue(i) : 0;
    while (tail > head && dominates(values[tail - 1], value)) tail -= 1;
    indices[tail] = i;
    values[tail] = value;
    tail += 1;
    const minimum = i - r * 2;
    while (tail > head && indices[head] < minimum) head += 1;
    if (i >= r) {
      const target = i - r;
      if (target < length) setValue(target, values[head]);
    }
  }
}

function maskExtremeFilter(source, width, height, radius, useMax) {
  const r = Math.max(0, Math.trunc(radius));
  if (!r) return new Uint8ClampedArray(source);
  const horizontal = new Uint8ClampedArray(source.length);
  const output = new Uint8ClampedArray(source.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    maskLineExtreme(
      width, r,
      x => source[row + x],
      (x, value) => { horizontal[row + x] = value; },
      useMax,
    );
  }
  for (let x = 0; x < width; x += 1) {
    maskLineExtreme(
      height, r,
      y => horizontal[y * width + x],
      (y, value) => { output[y * width + x] = value; },
      useMax,
    );
  }
  return output;
}

function maskBoxBlur(source, width, height, radius) {
  const r = Math.max(0, Math.trunc(radius));
  if (!r) return new Uint8ClampedArray(source);
  const window = r * 2 + 1;
  const horizontal = new Uint8ClampedArray(source.length);
  const output = new Uint8ClampedArray(source.length);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let x = -r; x <= r; x += 1) if (x >= 0 && x < width) sum += source[row + x];
    horizontal[row] = Math.round(sum / window);
    for (let x = 1; x < width; x += 1) {
      const remove = x - r - 1;
      const add = x + r;
      if (remove >= 0) sum -= source[row + remove];
      if (add < width) sum += source[row + add];
      horizontal[row + x] = Math.round(sum / window);
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -r; y <= r; y += 1) if (y >= 0 && y < height) sum += horizontal[y * width + x];
    output[x] = Math.round(sum / window);
    for (let y = 1; y < height; y += 1) {
      const remove = y - r - 1;
      const add = y + r;
      if (remove >= 0) sum -= horizontal[remove * width + x];
      if (add < height) sum += horizontal[add * width + x];
      output[y * width + x] = Math.round(sum / window);
    }
  }
  return output;
}


const MASK_EDGE_DIRECTIONS = [
  [1,0],[-1,0],[0,1],[0,-1],
  [1,1],[1,-1],[-1,1],[-1,-1],
];

function meanCoreSample(rgba, coreMask, width, height, x, y, desired, maxDistance) {
  let red=0,green=0,blue=0,alpha=0,count=0;
  for (const [dx,dy] of MASK_EDGE_DIRECTIONS) {
    for (let step=1;step<=maxDistance;step+=1) {
      const nx=x+dx*step,ny=y+dy*step;
      if(nx<0||ny<0||nx>=width||ny>=height)break;
      const index=ny*width+nx;
      if(coreMask[index]!==desired)continue;
      const offset=index*4;
      red+=rgba[offset];green+=rgba[offset+1];blue+=rgba[offset+2];alpha+=rgba[offset+3];
      count+=1;
      break;
    }
  }
  return count?[
    red/count,green/count,blue/count,alpha/count,
  ]:null;
}

function rgbaDistanceToMean(rgba, offset, mean) {
  const dr=rgba[offset]-mean[0];
  const dg=rgba[offset+1]-mean[1];
  const db=rgba[offset+2]-mean[2];
  const da=(rgba[offset+3]-mean[3])*.5;
  return dr*dr+dg*dg+db*db+da*da;
}

export function refineMaskEdgeAware(alpha, rgba, width, height, {
  radius = 0,
  strength = 60,
  smart = true,
} = {}) {
  if (!(alpha instanceof Uint8Array || alpha instanceof Uint8ClampedArray)) {
    throw new TypeError('Ожидался 8-bit alpha mask');
  }
  if (!(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray)) {
    throw new TypeError('Для уточнения края требуется RGBA source');
  }
  const w=Math.max(0,Math.trunc(width));
  const h=Math.max(0,Math.trunc(height));
  const pixels=w*h;
  if(!w||!h||alpha.length<pixels||rgba.length<pixels*4)return new Uint8ClampedArray();
  const edgeRadius=clamp(Math.round(Number(radius)||0),0,12);
  const amount=clamp(Number(strength)||0,0,100)/100;
  const output=new Uint8ClampedArray(alpha.slice(0,pixels));
  if(!edgeRadius||!amount)return output;

  const binary=new Uint8ClampedArray(pixels);
  for(let index=0;index<pixels;index+=1)binary[index]=alpha[index]>=128?255:0;
  const insideCore=maskExtremeFilter(binary,w,h,edgeRadius,false);
  const expanded=maskExtremeFilter(binary,w,h,edgeRadius,true);
  const maxDistance=Math.min(24,Math.max(2,edgeRadius*2));

  for(let y=0;y<h;y+=1){
    for(let x=0;x<w;x+=1){
      const index=y*w+x;
      if(expanded[index]===0||insideCore[index]===255)continue;
      const inside=meanCoreSample(rgba,insideCore,w,h,x,y,255,maxDistance);
      const outside=meanCoreSample(rgba,expanded,w,h,x,y,0,maxDistance);
      if(!inside||!outside)continue;
      const offset=index*4;
      const distanceInside=rgbaDistanceToMean(rgba,offset,inside);
      const distanceOutside=rgbaDistanceToMean(rgba,offset,outside);
      const total=distanceInside+distanceOutside;
      if(total<16)continue;
      const target=clamp(Math.round(255*distanceOutside/total),0,255);
      const confidence=Math.abs(distanceOutside-distanceInside)/(total+1);
      const localAmount=amount*(smart?clamp(confidence*1.5,0,1):1);
      if(localAmount<=0)continue;
      output[index]=clamp(Math.round(alpha[index]*(1-localAmount)+target*localAmount),0,255);
    }
  }
  return output;
}

export function refineMaskAlpha(alpha, width, height, {
  smooth = 0,
  shift = 0,
  edgeRadius = 0,
  edgeStrength = 60,
  smartRadius = true,
  sourceRgba = null,
  feather = 0,
  contrast = 0,
  invert = false,
} = {}) {
  if (!(alpha instanceof Uint8Array || alpha instanceof Uint8ClampedArray)) {
    throw new TypeError('Ожидался 8-bit alpha mask');
  }
  const w = Math.max(0, Math.trunc(width));
  const h = Math.max(0, Math.trunc(height));
  if (!w || !h || alpha.length < w * h) return new Uint8ClampedArray();
  let output = new Uint8ClampedArray(alpha.slice(0, w * h));

  const smoothRadius = clamp(Math.round(Number(smooth) || 0), 0, 32);
  if (smoothRadius > 0) {
    output = maskBoxBlur(output, w, h, smoothRadius);
    for (let i = 0; i < output.length; i += 1) output[i] = output[i] >= 128 ? 255 : 0;
  }

  const edgeShift = clamp(Math.round(Number(shift) || 0), -64, 64);
  if (edgeShift > 0) output = maskExtremeFilter(output, w, h, edgeShift, true);
  else if (edgeShift < 0) output = maskExtremeFilter(output, w, h, -edgeShift, false);

  const detectionRadius = clamp(Math.round(Number(edgeRadius) || 0), 0, 12);
  if (detectionRadius > 0) {
    if (!(sourceRgba instanceof Uint8Array || sourceRgba instanceof Uint8ClampedArray) || sourceRgba.length < w*h*4) {
      throw new TypeError('Для радиуса обнаружения края требуется RGBA source');
    }
    output = refineMaskEdgeAware(output, sourceRgba, w, h, {
      radius:detectionRadius,
      strength:edgeStrength,
      smart:smartRadius !== false,
    });
  }

  const featherRadius = clamp(Number(feather) || 0, 0, 64);
  if (featherRadius > 0) {
    const radius = Math.max(1, Math.round(featherRadius / 2));
    output = maskBoxBlur(output, w, h, radius);
    output = maskBoxBlur(output, w, h, radius);
  }

  const edgeContrast = clamp(Number(contrast) || 0, 0, 100);
  if (edgeContrast > 0) {
    const slope = 1 + edgeContrast / 25;
    for (let i = 0; i < output.length; i += 1) {
      output[i] = clamp(Math.round(128 + (output[i] - 128) * slope), 0, 255);
    }
  }

  if (invert) {
    for (let i = 0; i < output.length; i += 1) output[i] = 255 - output[i];
  }
  return output;
}

export function hexToRgb(hex) {
  const value = String(hex || '').trim();
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  if (short) {
    return short[1].split('').map(part => Number.parseInt(part + part, 16));
  }
  const full = /^#([0-9a-f]{6})$/i.exec(value);
  if (full) {
    return [0, 2, 4].map(offset => Number.parseInt(full[1].slice(offset, offset + 2), 16));
  }
  throw new Error('Некорректный цвет');
}

function smoothBrushFalloff(distance, radius) {
  const normalized = clamp(distance / Math.max(radius, 0.001), 0, 1);
  if (normalized <= 0.55) return 1;
  const edge = (normalized - 0.55) / 0.45;
  return 1 - edge * edge * (3 - 2 * edge);
}

// Store the strongest exposure reached by each pixel during this stroke. Sparse
// tiles keep short strokes cheap even when the raster layer is very large.
function strokeIncrement(coverage, x, y, localStrength) {
  if (!coverage) return localStrength;
  const tileX = Math.floor(x / 128);
  const tileY = Math.floor(y / 128);
  const tileKey = tileY * Math.ceil(coverage.width / 128) + tileX;
  let tile = coverage.tiles.get(tileKey);
  if (!tile) {
    tile = new Uint8Array(128 * 128);
    coverage.tiles.set(tileKey, tile);
  }
  const index = (y % 128) * 128 + x % 128;
  const previous = tile[index];
  const next = Math.max(previous, Math.round(localStrength * 255));
  if (next === previous) return 0;
  tile[index] = next;
  return (next - previous) / (255 - previous);
}

export function applyToneBrushPixels(data, width, height, centerX, centerY, radius, amount, { brighten = true, isAllowed = null, strokeCoverage = null, originX = 0, originY = 0 } = {}) {
  if (!(data instanceof Uint8ClampedArray)) throw new TypeError('Ожидался Uint8ClampedArray');
  const w = Math.max(0, Math.trunc(width));
  const h = Math.max(0, Math.trunc(height));
  if (!w || !h || data.length < w * h * 4) return 0;
  const brushRadius = Math.max(0.5, Number(radius) || 0.5);
  const strength = clamp(Number(amount) || 0, 0, 1);
  if (strength <= 0) return 0;
  const left = clamp(Math.floor(centerX - brushRadius), 0, w - 1);
  const right = clamp(Math.ceil(centerX + brushRadius), 0, w - 1);
  const top = clamp(Math.floor(centerY - brushRadius), 0, h - 1);
  const bottom = clamp(Math.ceil(centerY + brushRadius), 0, h - 1);
  let changed = 0;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (isAllowed && !isAllowed(x, y)) continue;
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      if (distance > brushRadius) continue;
      const offset = (y * w + x) * 4;
      if (data[offset + 3] === 0) continue;
      const localStrength = strength * smoothBrushFalloff(distance, brushRadius);
      if (localStrength <= 0) continue;
      const increment = strokeIncrement(strokeCoverage, originX + x, originY + y, localStrength);
      if (increment <= 0) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = data[offset + channel];
        data[offset + channel] = Math.round(brighten
          ? value + (255 - value) * increment
          : value * (1 - increment));
      }
      changed += 1;
    }
  }
  return changed;
}

export function applyBlurBrushPixels(data, blurred, width, height, centerX, centerY, radius, amount, { isAllowed = null, strokeCoverage = null, originX = 0, originY = 0 } = {}) {
  if (!(data instanceof Uint8ClampedArray) || !(blurred instanceof Uint8ClampedArray)) throw new TypeError('Ожидался Uint8ClampedArray');
  const w = Math.max(0, Math.trunc(width));
  const h = Math.max(0, Math.trunc(height));
  if (!w || !h || data.length < w * h * 4 || blurred.length < w * h * 4) return 0;
  const brushRadius = Math.max(0.5, Number(radius) || 0.5);
  const strength = clamp(Number(amount) || 0, 0, 1);
  if (strength <= 0) return 0;
  const left = clamp(Math.floor(centerX - brushRadius), 0, w - 1);
  const right = clamp(Math.ceil(centerX + brushRadius), 0, w - 1);
  const top = clamp(Math.floor(centerY - brushRadius), 0, h - 1);
  const bottom = clamp(Math.ceil(centerY + brushRadius), 0, h - 1);
  let changed = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (isAllowed && !isAllowed(x, y)) continue;
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      if (distance > brushRadius) continue;
      const offset = (y * w + x) * 4;
      if (data[offset + 3] === 0) continue;
      const localStrength = strength * smoothBrushFalloff(distance, brushRadius);
      if (localStrength <= 0) continue;
      const increment = strokeIncrement(strokeCoverage, originX + x, originY + y, localStrength);
      if (increment <= 0) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(data[offset + channel] * (1 - increment) + blurred[offset + channel] * increment);
      }
      changed += 1;
    }
  }
  return changed;
}

function channelDistanceSq(data, offset, target) {
  const dr = data[offset] - target[0];
  const dg = data[offset + 1] - target[1];
  const db = data[offset + 2] - target[2];
  const da = data[offset + 3] - target[3];
  return dr * dr + dg * dg + db * db + da * da;
}

function blendSourceOver(data, offset, color, opacity) {
  const sourceAlpha = clamp(opacity, 0, 1);
  if (sourceAlpha <= 0) return;
  const destAlpha = data[offset + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) {
    data[offset] = data[offset + 1] = data[offset + 2] = data[offset + 3] = 0;
    return;
  }
  const destFactor = destAlpha * (1 - sourceAlpha);
  data[offset] = Math.round((color[0] * sourceAlpha + data[offset] * destFactor) / outAlpha);
  data[offset + 1] = Math.round((color[1] * sourceAlpha + data[offset + 1] * destFactor) / outAlpha);
  data[offset + 2] = Math.round((color[2] * sourceAlpha + data[offset + 2] * destFactor) / outAlpha);
  data[offset + 3] = Math.round(outAlpha * 255);
}

function bitIsSet(bits, index) {
  return (bits[index >> 3] & (1 << (index & 7))) !== 0;
}

function setBit(bits, index) {
  bits[index >> 3] |= 1 << (index & 7);
}

export function floodFillPixels(data, width, height, startX, startY, color, { tolerance = 0, opacity = 1, isAllowed = null } = {}) {
  if (!(data instanceof Uint8ClampedArray)) throw new TypeError('Ожидался Uint8ClampedArray');
  const w = Math.max(0, Math.trunc(width));
  const h = Math.max(0, Math.trunc(height));
  if (!w || !h || data.length < w * h * 4) return 0;
  const sx = clamp(Math.trunc(startX), 0, w - 1);
  const sy = clamp(Math.trunc(startY), 0, h - 1);
  const rgb = color.map(value => clamp(Math.round(Number(value) || 0), 0, 255)).slice(0, 3);
  if (rgb.length < 3) throw new Error('Для заливки нужен RGB-цвет');
  const alpha = clamp(Number(opacity) || 0, 0, 1);
  if (alpha <= 0) return 0;

  if (isAllowed && !isAllowed(sx, sy)) return 0;

  const startOffset = (sy * w + sx) * 4;
  const target = [data[startOffset], data[startOffset + 1], data[startOffset + 2], data[startOffset + 3]];
  const normalizedTolerance = clamp(Number(tolerance) || 0, 0, 100);
  const threshold = (normalizedTolerance / 100 * 255) ** 2 * 4;
  const visited = new Uint8Array(Math.ceil(w * h / 8));
  const stack = [[sx, sy]];
  let filled = 0;

  const matches = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const index = y * w + x;
    if (bitIsSet(visited, index)) return false;
    if (isAllowed && !isAllowed(x, y)) return false;
    return channelDistanceSq(data, index * 4, target) <= threshold;
  };

  while (stack.length) {
    const [seedX, y] = stack.pop();
    if (!matches(seedX, y)) continue;

    let left = seedX;
    while (left > 0 && matches(left - 1, y)) left -= 1;

    let spanAbove = false;
    let spanBelow = false;
    for (let x = left; x < w && matches(x, y); x += 1) {
      const index = y * w + x;
      setBit(visited, index);
      blendSourceOver(data, index * 4, rgb, alpha);
      filled += 1;

      if (y > 0) {
        const aboveMatches = matches(x, y - 1);
        if (aboveMatches && !spanAbove) stack.push([x, y - 1]);
        spanAbove = aboveMatches;
      }
      if (y + 1 < h) {
        const belowMatches = matches(x, y + 1);
        if (belowMatches && !spanBelow) stack.push([x, y + 1]);
        spanBelow = belowMatches;
      }
    }
  }
  return filled;
}
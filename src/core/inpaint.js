export const CONTENT_AWARE_MAX_LAYER_PIXELS = 8_000_000;
export const CONTENT_AWARE_MAX_FILL_PIXELS = 2_000_000;
export const CONTENT_AWARE_PATCHMATCH_MAX_FILL_PIXELS = 250_000;

function positiveInteger(value, label) {
  const number = Math.trunc(Number(value));
  if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${label} должен быть положительным целым числом`);
  return number;
}

function boundedInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function isNumericTypedArray(value) {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function megapixels(value) {
  return (value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits:1 });
}

function sampleScale(data) {
  if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) return 255;
  if (data instanceof Int8Array) return 127;
  if (data instanceof Uint16Array) return 65535;
  if (data instanceof Int16Array) return 32767;
  if (data instanceof Uint32Array) return 4294967295;
  if (data instanceof Int32Array) return 2147483647;
  return 0;
}

function normalizedDifference(left, right, scale) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const delta = a - b;
  if (scale > 0) return delta / scale;
  return delta / Math.max(1, Math.abs(a), Math.abs(b));
}

function hash32(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function deterministicOffset(seed, radius) {
  const span = radius * 2 + 1;
  return (hash32(seed) % span) - radius;
}

function patchMatchRefine(data, width, height, channels, selectedMask, donorIndex, bounds, {
  patchRadius,
  passes,
  randomSearchSteps,
  alphaChannel,
} = {}) {
  if (!bounds || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) return;
  const radius = boundedInteger(patchRadius, 1, 1, 3);
  const passCount = boundedInteger(passes, 2, 1, 4);
  const randomSteps = boundedInteger(randomSearchSteps, 4, 0, 8);
  const scale = sampleScale(data);
  const comparedChannels = alphaChannel < 0 ? channels : alphaChannel;
  const maxDimension = Math.max(width, height);

  const validDonor = index => index >= 0 && index < selectedMask.length && selectedMask[index] === 0;

  const scoreDonor = (targetIndex, donor) => {
    if (!validDonor(donor)) return Number.POSITIVE_INFINITY;
    const targetX = targetIndex % width;
    const targetY = Math.floor(targetIndex / width);
    const donorX = donor % width;
    const donorY = Math.floor(donor / width);
    let score = 0;
    let weightTotal = 0;

    for (let dy = -radius; dy <= radius; dy += 1) {
      const ty = targetY + dy;
      const sy = donorY + dy;
      if (ty < 0 || ty >= height || sy < 0 || sy >= height) continue;
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!dx && !dy) continue;
        const tx = targetX + dx;
        const sx = donorX + dx;
        if (tx < 0 || tx >= width || sx < 0 || sx >= width) continue;
        const targetNeighbor = ty * width + tx;
        const sourceNeighbor = sy * width + sx;
        if (selectedMask[sourceNeighbor]) continue;
        const contextWeight = selectedMask[targetNeighbor] ? 0.35 : 1;
        const spatialWeight = contextWeight / (1 + dx * dx + dy * dy);
        const targetOffset = targetNeighbor * channels;
        const sourceOffset = sourceNeighbor * channels;
        let local = 0;
        for (let channel = 0; channel < comparedChannels; channel += 1) {
          const delta = normalizedDifference(data[targetOffset + channel], data[sourceOffset + channel], scale);
          local += delta * delta;
        }
        score += local * spatialWeight;
        weightTotal += spatialWeight * comparedChannels;
      }
    }

    const dx = donorX - targetX;
    const dy = donorY - targetY;
    const distancePenalty = (dx * dx + dy * dy) / Math.max(1, width * width + height * height);
    if (weightTotal <= 1e-12) return distancePenalty;
    return score / weightTotal + distancePenalty * 1e-6;
  };

  const copyDonor = (targetIndex, donor) => {
    const targetOffset = targetIndex * channels;
    const donorOffset = donor * channels;
    for (let channel = 0; channel < channels; channel += 1) data[targetOffset + channel] = data[donorOffset + channel];
  };

  const propagatedDonor = (targetIndex, neighborIndex) => {
    if (neighborIndex < 0 || neighborIndex >= donorIndex.length || !selectedMask[neighborIndex]) return -1;
    const neighborDonor = donorIndex[neighborIndex];
    if (!validDonor(neighborDonor)) return -1;
    const tx = targetIndex % width;
    const ty = Math.floor(targetIndex / width);
    const nx = neighborIndex % width;
    const ny = Math.floor(neighborIndex / width);
    const sx = (neighborDonor % width) + (tx - nx);
    const sy = Math.floor(neighborDonor / width) + (ty - ny);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return -1;
    const candidate = sy * width + sx;
    return validDonor(candidate) ? candidate : -1;
  };

  for (let pass = 0; pass < passCount; pass += 1) {
    const forward = pass % 2 === 0;
    const yStart = forward ? bounds.minY : bounds.maxY;
    const yEnd = forward ? bounds.maxY : bounds.minY;
    const yStep = forward ? 1 : -1;
    const xStart = forward ? bounds.minX : bounds.maxX;
    const xEnd = forward ? bounds.maxX : bounds.minX;
    const xStep = forward ? 1 : -1;

    for (let y = yStart; forward ? y <= yEnd : y >= yEnd; y += yStep) {
      for (let x = xStart; forward ? x <= xEnd : x >= xEnd; x += xStep) {
        const index = y * width + x;
        if (!selectedMask[index]) continue;
        let bestDonor = donorIndex[index];
        if (!validDonor(bestDonor)) continue;
        let bestScore = scoreDonor(index, bestDonor);

        const neighbors = forward
          ? [x > 0 ? index - 1 : -1, y > 0 ? index - width : -1]
          : [x + 1 < width ? index + 1 : -1, y + 1 < height ? index + width : -1];
        for (const neighbor of neighbors) {
          const candidate = propagatedDonor(index, neighbor);
          if (candidate < 0) continue;
          const score = scoreDonor(index, candidate);
          if (score < bestScore - 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && candidate < bestDonor)) {
            bestDonor = candidate;
            bestScore = score;
          }
        }

        let searchRadius = Math.max(1, Math.floor(maxDimension / 2));
        for (let step = 0; step < randomSteps && searchRadius >= 1; step += 1) {
          const bestX = bestDonor % width;
          const bestY = Math.floor(bestDonor / width);
          const seed = hash32(index ^ Math.imul(pass + 1, 0x9e3779b1) ^ Math.imul(step + 1, 0x85ebca6b));
          const sx = bestX + deterministicOffset(seed ^ 0x68bc21eb, searchRadius);
          const sy = bestY + deterministicOffset(seed ^ 0x02e5be93, searchRadius);
          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const candidate = sy * width + sx;
            if (validDonor(candidate)) {
              const score = scoreDonor(index, candidate);
              if (score < bestScore - 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && candidate < bestDonor)) {
                bestDonor = candidate;
                bestScore = score;
              }
            }
          }
          searchRadius = Math.floor(searchRadius / 2);
        }

        donorIndex[index] = bestDonor;
        copyDonor(index, bestDonor);
      }
    }
  }
}

/**
 * Deterministic bounded inpainting for a selected pixel region.
 *
 * Stage 1 grows from the selection boundary inward and always resolves each
 * synthesized pixel back to an immutable donor outside the original selection.
 * Stage 2 performs bounded PatchMatch-style propagation + deterministic random
 * search for smaller selections, copying exact source samples from the best
 * texture neighborhood. Large fills keep the linear boundary synthesis path so
 * the operation remains memory/time bounded.
 */
export function inpaintSelectedSamples(data, width, height, channels, {
  isAllowed,
  sampleRadius = 2,
  maxLayerPixels = CONTENT_AWARE_MAX_LAYER_PIXELS,
  maxFillPixels = CONTENT_AWARE_MAX_FILL_PIXELS,
  patchMatchMaxFillPixels = CONTENT_AWARE_PATCHMATCH_MAX_FILL_PIXELS,
  patchRadius = 1,
  patchMatchPasses = 2,
  randomSearchSteps = 4,
  alphaChannel = channels === 4 ? 3 : channels === 5 ? 4 : -1,
} = {}) {
  width = positiveInteger(width, 'width');
  height = positiveInteger(height, 'height');
  channels = positiveInteger(channels, 'channels');
  if (!Number.isInteger(alphaChannel) || (alphaChannel !== -1 && alphaChannel !== channels - 1)) {
    throw new RangeError('Контент-заливка: некорректный индекс alpha-канала');
  }
  if (!isNumericTypedArray(data)) throw new TypeError('Контент-заливка требует typed pixel buffer');
  const total = width * height;
  if (!Number.isSafeInteger(total)) throw new RangeError('Контент-заливка: размер слоя выходит за безопасный диапазон');
  if (data.length !== total * channels) throw new RangeError('Контент-заливка: размер pixel buffer не совпадает с геометрией слоя');
  if (typeof isAllowed !== 'function') throw new TypeError('Контент-заливка требует frozen selection predicate');

  maxLayerPixels = positiveInteger(maxLayerPixels, 'maxLayerPixels');
  maxFillPixels = positiveInteger(maxFillPixels, 'maxFillPixels');
  patchMatchMaxFillPixels = positiveInteger(patchMatchMaxFillPixels, 'patchMatchMaxFillPixels');
  if (total > maxLayerPixels) {
    throw new RangeError(`Контент-заливка: слой ${megapixels(total)} МП превышает безопасный лимит ${megapixels(maxLayerPixels)} МП`);
  }

  const pending = new Uint8Array(total);
  const selectedMask = new Uint8Array(total);
  const donorIndex = new Int32Array(total);
  donorIndex.fill(-1);
  let selected = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0, index = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, index += 1) {
      if (isAllowed(x, y)) {
        pending[index] = 1;
        selectedMask[index] = 1;
        selected += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else {
        donorIndex[index] = index;
      }
    }
  }

  if (!selected) return 0;
  if (selected === total) return 0;
  if (selected > maxFillPixels) {
    throw new RangeError(`Контент-заливка: выделено ${megapixels(selected)} МП, безопасный лимит — ${megapixels(maxFillPixels)} МП`);
  }

  const queue = new Int32Array(selected);
  const queued = new Uint8Array(total);
  let head = 0;
  let tail = 0;

  const hasKnownNeighbor = index => {
    const x = index % width;
    const y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        if (!pending[yy * width + xx]) return true;
      }
    }
    return false;
  };

  for (let index = 0; index < total; index += 1) {
    if (pending[index] && hasKnownNeighbor(index)) {
      queue[tail++] = index;
      queued[index] = 1;
    }
  }

  const radius = boundedInteger(sampleRadius, 2, 1, 6);
  const sums = new Float64Array(channels);
  const alphaScale = sampleScale(data) || 1;
  let filled = 0;

  while (head < tail) {
    const index = queue[head++];
    if (!pending[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    sums.fill(0);
    let weightTotal = 0;
    let alphaWeightTotal = 0;
    let bestDonor = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let dy = -radius; dy <= radius; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const neighbor = yy * width + xx;
        if (pending[neighbor]) continue;
        const donor = donorIndex[neighbor];
        if (donor < 0) continue;

        const donorX = donor % width;
        const donorY = Math.floor(donor / width);
        const ddx = donorX - x;
        const ddy = donorY - y;
        const distanceSquared = ddx * ddx + ddy * ddy;
        const weight = 1 / (1 + distanceSquared);
        const donorOffset = donor * channels;
        // Straight-alpha donors: invisible RGB/CMYK must not tint the replacement.
        const donorAlpha = alphaChannel < 0 ? 1 : Math.max(0, Math.min(1,
          Number(data[donorOffset + alphaChannel]) / alphaScale || 0));
        for (let channel = 0; channel < channels; channel += 1) {
          const channelWeight = channel === alphaChannel ? weight : weight * donorAlpha;
          sums[channel] += Number(data[donorOffset + channel]) * channelWeight;
        }
        weightTotal += weight;
        alphaWeightTotal += weight * donorAlpha;
        if (distanceSquared < bestDistance || (distanceSquared === bestDistance && (bestDonor < 0 || donor < bestDonor))) {
          bestDistance = distanceSquared;
          bestDonor = donor;
        }
      }
    }

    if (bestDonor < 0 || weightTotal <= 0) continue;
    const targetOffset = index * channels;
    for (let channel = 0; channel < channels; channel += 1) {
      const denominator = alphaChannel < 0 || channel === alphaChannel ? weightTotal : alphaWeightTotal;
      data[targetOffset + channel] = denominator > 0 ? sums[channel] / denominator : 0;
    }
    pending[index] = 0;
    donorIndex[index] = bestDonor;
    filled += 1;

    for (let dy = -1; dy <= 1; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const neighbor = yy * width + xx;
        if (pending[neighbor] && !queued[neighbor]) {
          queued[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
  }

  if (filled === selected && filled > 1 && selected <= patchMatchMaxFillPixels && width >= 3 && height >= 3) {
    patchMatchRefine(data, width, height, channels, selectedMask, donorIndex, { minX, minY, maxX, maxY }, {
      patchRadius,
      passes:patchMatchPasses,
      randomSearchSteps,
      alphaChannel,
    });
  }

  return filled;
}

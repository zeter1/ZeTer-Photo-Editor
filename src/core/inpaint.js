export const CONTENT_AWARE_MAX_LAYER_PIXELS = 8_000_000;
export const CONTENT_AWARE_MAX_FILL_PIXELS = 2_000_000;

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

/**
 * Deterministic bounded inpainting for a selected pixel region.
 *
 * The fill grows from the selection boundary inward. Each synthesized target
 * resolves back to an immutable donor outside the selection, so later pixels
 * never recursively sample already synthesized values. The same math works on
 * Uint8/Uint16/Float32 samples without changing RGB/CMYK sample domains.
 */
export function inpaintSelectedSamples(data, width, height, channels, {
  isAllowed,
  sampleRadius = 2,
  maxLayerPixels = CONTENT_AWARE_MAX_LAYER_PIXELS,
  maxFillPixels = CONTENT_AWARE_MAX_FILL_PIXELS,
} = {}) {
  width = positiveInteger(width, 'width');
  height = positiveInteger(height, 'height');
  channels = positiveInteger(channels, 'channels');
  if (!isNumericTypedArray(data)) throw new TypeError('Контент-заливка требует typed pixel buffer');
  const total = width * height;
  if (!Number.isSafeInteger(total)) throw new RangeError('Контент-заливка: размер слоя выходит за безопасный диапазон');
  if (data.length !== total * channels) throw new RangeError('Контент-заливка: размер pixel buffer не совпадает с геометрией слоя');
  if (typeof isAllowed !== 'function') throw new TypeError('Контент-заливка требует frozen selection predicate');

  maxLayerPixels = positiveInteger(maxLayerPixels, 'maxLayerPixels');
  maxFillPixels = positiveInteger(maxFillPixels, 'maxFillPixels');
  if (total > maxLayerPixels) {
    throw new RangeError(`Контент-заливка: слой ${megapixels(total)} МП превышает безопасный лимит ${megapixels(maxLayerPixels)} МП`);
  }

  const pending = new Uint8Array(total);
  const donorIndex = new Int32Array(total);
  donorIndex.fill(-1);
  let selected = 0;

  for (let y = 0, index = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, index += 1) {
      if (isAllowed(x, y)) {
        pending[index] = 1;
        selected += 1;
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
  let filled = 0;

  while (head < tail) {
    const index = queue[head++];
    if (!pending[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    sums.fill(0);
    let weightTotal = 0;
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
        for (let channel = 0; channel < channels; channel += 1) {
          sums[channel] += Number(data[donorOffset + channel]) * weight;
        }
        weightTotal += weight;
        if (distanceSquared < bestDistance || (distanceSquared === bestDistance && (bestDonor < 0 || donor < bestDonor))) {
          bestDistance = distanceSquared;
          bestDonor = donor;
        }
      }
    }

    if (bestDonor < 0 || weightTotal <= 0) continue;
    const targetOffset = index * channels;
    for (let channel = 0; channel < channels; channel += 1) {
      data[targetOffset + channel] = sums[channel] / weightTotal;
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

  return filled;
}

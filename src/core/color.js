const clampColor01 = value => Math.min(1, Math.max(0, Number(value) || 0));

export function colorAdjustmentSignature(filters = {}) {
  return [
    Number(filters.exposure ?? 0).toFixed(3),
    Number(filters.temperature ?? 0).toFixed(2),
    Number(filters.tint ?? 0).toFixed(2),
    Number(filters.vibrance ?? 0).toFixed(2),
    Number(filters.gamma ?? 1).toFixed(3),
    Number(filters.highlights ?? 0).toFixed(2),
    Number(filters.shadows ?? 0).toFixed(2),
  ].join('|');
}

export function hasAdvancedColorAdjustments(filters = {}) {
  return Math.abs(Number(filters.exposure) || 0) > 1e-6
    || Math.abs(Number(filters.temperature) || 0) > 1e-6
    || Math.abs(Number(filters.tint) || 0) > 1e-6
    || Math.abs(Number(filters.vibrance) || 0) > 1e-6
    || Math.abs((Number(filters.gamma) || 1) - 1) > 1e-6
    || Math.abs(Number(filters.highlights) || 0) > 1e-6
    || Math.abs(Number(filters.shadows) || 0) > 1e-6;
}

function compileColorAdjustments(filters = {}) {
  const exposure = Math.max(-4, Math.min(4, Number(filters.exposure) || 0));
  const gamma = Math.max(0.1, Math.min(5, Number(filters.gamma) || 1));
  const multiplier = 2 ** exposure;
  const power = 1 / gamma;
  const base = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = Math.min(1, ((i / 255) * multiplier)) ** power;

  return {
    base,
    temperature: Math.max(-1, Math.min(1, (Number(filters.temperature) || 0) / 100)),
    tint: Math.max(-1, Math.min(1, (Number(filters.tint) || 0) / 100)),
    vibrance: Math.max(-1, Math.min(1, (Number(filters.vibrance) || 0) / 100)),
    highlights: Math.max(-1, Math.min(1, (Number(filters.highlights) || 0) / 100)),
    shadows: Math.max(-1, Math.min(1, (Number(filters.shadows) || 0) / 100)),
  };
}

function adjustRgbPackedCompiled(r, g, b, compiled) {
  let red = compiled.base[r];
  let green = compiled.base[g];
  let blue = compiled.base[b];

  const temperature = compiled.temperature;
  if (temperature > 0) {
    red += (1 - red) * temperature * 0.16;
    green += (1 - green) * temperature * 0.025;
    blue *= 1 - temperature * 0.14;
  } else if (temperature < 0) {
    const cool = -temperature;
    blue += (1 - blue) * cool * 0.16;
    green += (1 - green) * cool * 0.02;
    red *= 1 - cool * 0.14;
  }

  const tint = compiled.tint;
  if (tint > 0) {
    red += (1 - red) * tint * 0.07;
    blue += (1 - blue) * tint * 0.07;
    green *= 1 - tint * 0.11;
  } else if (tint < 0) {
    const towardGreen = -tint;
    green += (1 - green) * towardGreen * 0.11;
    red *= 1 - towardGreen * 0.06;
    blue *= 1 - towardGreen * 0.06;
  }

  let luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const shadows = compiled.shadows;
  if (shadows) {
    const shadowWeight = 1 - luminance;
    const strength = Math.abs(shadows) * shadowWeight * shadowWeight * 0.72;
    if (shadows > 0) {
      red += (1 - red) * strength; green += (1 - green) * strength; blue += (1 - blue) * strength;
    } else {
      const factor = 1 - strength; red *= factor; green *= factor; blue *= factor;
    }
  }

  luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const highlights = compiled.highlights;
  if (highlights) {
    const strength = Math.abs(highlights) * luminance * luminance * 0.72;
    if (highlights > 0) {
      red += (1 - red) * strength; green += (1 - green) * strength; blue += (1 - blue) * strength;
    } else {
      const factor = 1 - strength; red *= factor; green *= factor; blue *= factor;
    }
  }

  const vibrance = compiled.vibrance;
  if (vibrance) {
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const factor = Math.max(0, 1 + vibrance * (1 - (maxChannel - minChannel)) * 0.85);
    const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    red = gray + (red - gray) * factor;
    green = gray + (green - gray) * factor;
    blue = gray + (blue - gray) * factor;
  }

  const outR = Math.round(Math.min(1, Math.max(0, red)) * 255);
  const outG = Math.round(Math.min(1, Math.max(0, green)) * 255);
  const outB = Math.round(Math.min(1, Math.max(0, blue)) * 255);
  return (outR << 16) | (outG << 8) | outB;
}

export function adjustRgb(r, g, b, filters = {}) {
  const packed = adjustRgbPackedCompiled(r, g, b, compileColorAdjustments(filters));
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
}

export function applyAdvancedColorAdjustments(imageData, filters = {}) {
  if (!imageData?.data || !hasAdvancedColorAdjustments(filters)) return imageData;
  const data = imageData.data;
  const compiled = compileColorAdjustments(filters);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const packed = adjustRgbPackedCompiled(data[i], data[i + 1], data[i + 2], compiled);
    data[i] = (packed >>> 16) & 255;
    data[i + 1] = (packed >>> 8) & 255;
    data[i + 2] = packed & 255;
  }
  return imageData;
}
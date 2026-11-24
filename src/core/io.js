
// Count retained ASCII data-URL characters before any binary-string/Base64
// allocation. This is not a JS heap/RSS byte measurement.
export function encodedDataUrlChars(byteLength, mime = 'application/octet-stream') {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError('Binary data URL требует корректный размер байтов');
  }
  const count = `data:${String(mime || 'application/octet-stream')};base64,`.length
    + 4 * Math.ceil(byteLength / 3);
  if (!Number.isSafeInteger(count)) throw new RangeError('Binary data URL length overflow');
  return count;
}

export function bytesToDataUrl(value, mime = 'application/octet-stream', { maxDataUrlChars = null } = {}) {
  const bytes = value instanceof Uint8Array
    ? value
    : ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : null;
  if (!bytes) throw new TypeError('Ожидался бинарный буфер');
  const mediaType = String(mime || 'application/octet-stream');
  const requiredChars = encodedDataUrlChars(bytes.byteLength, mediaType);
  if (maxDataUrlChars !== null &&
      (!Number.isSafeInteger(maxDataUrlChars) || maxDataUrlChars < requiredChars)) {
    throw new RangeError('Binary data URL превышает maxDataUrlChars');
  }
  if (typeof btoa !== 'function') throw new Error('Base64 encoder недоступен');
  // A multiple of three keeps Base64 groups aligned. Never join all source
  // bytes into a second full-size binary string before calling btoa.
  // Join the prefix and encoded chunks ONCE into the final URL. Joining
  // Base64 first and then interpolating it retains an unnecessary full-length
  // intermediate string at this synchronous serialization boundary.
  const chunks = [`data:${mediaType};base64,`];
  const chunkSize = 0x6000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    chunks.push(btoa(String.fromCharCode(...chunk)));
  }
  return chunks.join('');
}

export function dataUrlToBytes(dataUrl, { maxBytes = 4 * 1024 * 1024 } = {}) {
  const source = String(dataUrl || '');
  // Match only the MIME header; avoid capturing a full-length Base64 substring.
  const header = /^data:([^;,]+)?;base64,/i.exec(source);
  if (!header) throw new Error('Некорректный binary data URL');
  const start = header[0].length;
  const encodedLength = source.length - start;
  const padding = source.endsWith('==') ? 2 : source.endsWith('=') ? 1 : 0;
  const estimated = Math.max(0, Math.floor(encodedLength * 3 / 4) - padding);
  if (estimated > maxBytes) throw new Error(`Binary data URL превышает лимит ${maxBytes} байт`);

  // Validate the full alphabet and padding before allocating the decoded output.
  // No regexp capture or atob call owns the complete Base64 payload.
  if (encodedLength % 4 === 1 || (padding && encodedLength % 4 !== 0)) {
    throw new Error('Некорректный binary data URL');
  }
  let firstPadding = -1;
  for (let index = start; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    if (code === 61) {
      if (firstPadding === -1) firstPadding = index;
    } else if (firstPadding !== -1 ||
      !((code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57) || code === 43 || code === 47)) {
      throw new Error('Некорректный binary data URL');
    }
  }
  if (firstPadding !== -1 && source.length - firstPadding !== padding) {
    throw new Error('Некорректный binary data URL');
  }
  if (typeof atob !== 'function') throw new Error('Base64 decoder недоступен');

  const bytes = new Uint8Array(estimated);
  // Input chunks are 32 KiB Base64 chars (multiple of 4). Each atob result
  // is at most 24 KiB, rather than a complete native binary string.
  // This does not imply a global JS heap, Worker or process RSS limit.
  const chunkChars = 0x8000;
  let written = 0;
  for (let index = start; index < source.length; index += chunkChars) {
    const binary = atob(source.slice(index, Math.min(index + chunkChars, source.length)));
    for (let i = 0; i < binary.length; i += 1) bytes[written++] = binary.charCodeAt(i);
  }
  if (written !== estimated) throw new Error('Некорректный binary data URL');
  return bytes;
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Ошибка чтения файла'));
    reader.readAsText(file);
  });
}


export function canvasToDataURL(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    if (!canvas?.toBlob) {
      try { resolve(canvas.toDataURL(type, quality)); }
      catch (error) { reject(error); }
      return;
    }
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Не удалось сохранить растровый слой')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Ошибка кодирования изображения'));
      reader.readAsDataURL(blob);
    }, type, quality);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text, filename, type = 'application/json') {
  downloadBlob(new Blob([text], { type }), filename);
}

export async function dimensionsFromDataUrl(dataUrl) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    image.src = dataUrl;
  });
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function safeFilename(name) {
  return String(name || 'image').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'image';
}
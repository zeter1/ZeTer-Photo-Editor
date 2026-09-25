
export function bytesToDataUrl(value, mime = 'application/octet-stream') {
  const bytes = value instanceof Uint8Array
    ? value
    : ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : null;
  if (!bytes) throw new TypeError('Ожидался бинарный буфер');
  if (typeof btoa !== 'function') throw new Error('Base64 encoder недоступен');
  const chunks = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    chunks.push(String.fromCharCode(...chunk));
  }
  return `data:${String(mime || 'application/octet-stream')};base64,${btoa(chunks.join(''))}`;
}

export function dataUrlToBytes(dataUrl, { maxBytes = 4 * 1024 * 1024 } = {}) {
  const match = /^data:([^;,]+)?;base64,([a-z\d+/=]*)$/i.exec(String(dataUrl || ''));
  if (!match) throw new Error('Некорректный binary data URL');
  const base64 = match[2];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const estimated = Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
  if (estimated > maxBytes) throw new Error(`Binary data URL превышает лимит ${maxBytes} байт`);
  if (typeof atob !== 'function') throw new Error('Base64 decoder недоступен');
  const binary = atob(base64);
  if (binary.length > maxBytes) throw new Error(`Binary data URL превышает лимит ${maxBytes} байт`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 255;
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
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
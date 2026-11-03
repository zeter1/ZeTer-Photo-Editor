const NATIVE_SOURCE_PREFIX = 'data:application/x-zeter-pixel-buffer';
const NATIVE_SOURCE_BASE64 = ';base64,';
const NATIVE_TILE_BASE64 = '-tile;base64,';

function base64Code(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) || code === 43 || code === 47 || code === 61;
}

// Count *retained characters*, not browser heap bytes. Scan the original JSON
// without extracting large Base64 substrings or decoding native pixel data.
function countNativeDataUrlChars(snapshot) {
  let text;
  if (typeof snapshot === 'string') text = snapshot;
  else {
    try { text = JSON.stringify(snapshot); } catch { return 0; }
  }
  if (typeof text !== 'string') return 0;
  let chars = 0, offset = 0;
  while (offset < text.length) {
    const start = text.indexOf(NATIVE_SOURCE_PREFIX, offset);
    if (start === -1) break;
    const suffix = start + NATIVE_SOURCE_PREFIX.length;
    const header = text.startsWith(NATIVE_TILE_BASE64, suffix)
      ? NATIVE_TILE_BASE64.length
      : text.startsWith(NATIVE_SOURCE_BASE64, suffix) ? NATIVE_SOURCE_BASE64.length : 0;
    if (!header) { offset = suffix; continue; }
    let end = suffix + header;
    const payloadStart = end;
    while (end < text.length && base64Code(text.charCodeAt(end))) end++;
    if (end > payloadStart) chars += end - start;
    offset = Math.max(end, suffix);
  }
  return chars;
}

export class HistoryStack {
  constructor(limit = 60, byteLimit = 128 * 1024 * 1024,
    { maxRetainedNativeDataUrlChars = null } = {}) {
    if (maxRetainedNativeDataUrlChars !== null &&
        (!Number.isSafeInteger(maxRetainedNativeDataUrlChars) ||
          maxRetainedNativeDataUrlChars < 0)) {
      throw new RangeError('invalid maxRetainedNativeDataUrlChars');
    }
    this.limit = limit;
    this.byteLimit = byteLimit;
    // Opt-in: bounds the sum of native v1/v2 Data URL *characters* in
    // retained History snapshots. Never evict the current/only Undo point.
    this.maxRetainedNativeDataUrlChars = maxRetainedNativeDataUrlChars;
    this.entries = [];
    this.index = -1;
    // Immutable JSON strings retain their byte estimate across totalBytes calls.
    this._stringByteSizes = new WeakMap();
    this._nativeDataUrlChars = new WeakMap();
  }

  push(label, snapshot) {
    const entry = { label, snapshot, timestamp: Date.now() };
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(entry);
    while (this.entries.length > this.limit) this.entries.shift();
    while (this.entries.length > 1 &&
        (this.totalBytes() > this.byteLimit ||
          (this.maxRetainedNativeDataUrlChars !== null &&
            this.retainedNativeDataUrlChars() > this.maxRetainedNativeDataUrlChars))) {
      this.entries.shift();
    }
    this.index = this.entries.length - 1;
    return entry;
  }

  undo() {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return this.entries[this.index];
  }

  redo() {
    if (!this.canRedo()) return null;
    this.index += 1;
    return this.entries[this.index];
  }

  jump(index) {
    const next = Math.trunc(Number(index));
    if (!Number.isFinite(next) || next < 0 || next >= this.entries.length || next === this.index) return null;
    this.index = next;
    return this.entries[this.index];
  }

  retainedNativeDataUrlChars() {
    return this.entries.reduce((sum, entry) => {
      if (typeof entry.snapshot !== 'string') return sum + countNativeDataUrlChars(entry.snapshot);
      const cached = this._nativeDataUrlChars.get(entry);
      if (cached && cached.snapshot === entry.snapshot) return sum + cached.chars;
      const chars = countNativeDataUrlChars(entry.snapshot);
      this._nativeDataUrlChars.set(entry, { snapshot:entry.snapshot, chars });
      return sum + chars;
    }, 0);
  }

  totalBytes() {
    return this.entries.reduce((sum, entry) => {
      // Object snapshots may be mutated by callers; never cache their size.
      if (typeof entry.snapshot !== 'string') return sum + this.snapshotBytes(entry.snapshot);
      let bytes = this._stringByteSizes.get(entry);
      if (bytes === undefined) {
        bytes = this.snapshotBytes(entry.snapshot);
        this._stringByteSizes.set(entry, bytes);
      }
      return sum + bytes;
    }, 0);
  }

  snapshotBytes(snapshot) {
    try {
      const encoded = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
      if (typeof encoded !== 'string') return 0;
      // V8 stores Latin-1 JSON snapshots with one byte per character. PSD/PSB
      // native tile base64 is Latin-1; charging two bytes falsely evicted the
      // only pre-Fill Undo point for 2.03M-pixel 32-bit sources. Conservatively
      // charge two bytes per char when ANY wide character is present.
      return /[^\x00-\xff]/.test(encoded) ? encoded.length * 2 : encoded.length;
    } catch { return 0; }
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index >= 0 && this.index < this.entries.length - 1; }
  current() { return this.entries[this.index] ?? null; }

  reset(label, snapshot) {
    this.entries = [{ label, snapshot, timestamp: Date.now() }];
    this.index = 0;
  }

  clearToCurrent() {
    const current = this.current();
    if (!current) return;
    this.entries = [current];
    this.index = 0;
  }
}

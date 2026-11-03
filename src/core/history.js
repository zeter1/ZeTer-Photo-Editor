const NATIVE_SOURCE_PREFIX = 'data:application/x-zeter-pixel-buffer';
const NATIVE_SOURCE_BASE64 = ';base64,';
const NATIVE_TILE_BASE64 = '-tile;base64,';

function base64Code(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) || code === 43 || code === 47 || code === 61;
}

function* nativeUrlSpans(text) {
  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf(NATIVE_SOURCE_PREFIX, offset);
    if (start === -1) return;
    const suffix = start + NATIVE_SOURCE_PREFIX.length;
    const header = text.startsWith(NATIVE_TILE_BASE64, suffix)
      ? NATIVE_TILE_BASE64.length
      : text.startsWith(NATIVE_SOURCE_BASE64, suffix) ? NATIVE_SOURCE_BASE64.length : 0;
    if (!header) { offset = suffix; continue; }
    let end = suffix + header;
    const payloadStart = end;
    while (end < text.length && base64Code(text.charCodeAt(end))) end++;
    if (end > payloadStart) yield [start, end];
    offset = Math.max(end, suffix);
  }
}

// Count retained *characters*, not browser heap bytes. No Base64 decoding.
function countNativeDataUrlChars(snapshot) {
  let text;
  if (typeof snapshot === 'string') text = snapshot;
  else {
    try { text = JSON.stringify(snapshot); } catch { return 0; }
  }
  if (typeof text !== 'string') return 0;
  let chars = 0;
  for (const [start, end] of nativeUrlSpans(text)) chars += end - start;
  return chars;
}

// A typed code-unit copy cannot retain the original large JSON string as a
// dependent substring; it also preserves even malformed UTF-16 verbatim.
function toUnits(text, start, end) {
  const units = new Uint16Array(end - start);
  for (let i = start; i < end; i++) units[i - start] = text.charCodeAt(i);
  return units;
}
function fromUnits(units) {
  const chunks = [];
  for (let i = 0; i < units.length; i += 8192) {
    chunks.push(String.fromCharCode(...units.subarray(i, i + 8192)));
  }
  return chunks.join('');
}
function urlHash(text, start, end) {
  let hash = 2166136261;
  for (let i = start; i < end; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16) + ':' + (end - start);
}

export class HistoryStack {
  constructor(limit = 60, byteLimit = 128 * 1024 * 1024,
    { maxRetainedNativeDataUrlChars = null, shareNativeDataUrls = false } = {}) {
    if (maxRetainedNativeDataUrlChars !== null &&
        (!Number.isSafeInteger(maxRetainedNativeDataUrlChars) ||
          maxRetainedNativeDataUrlChars < 0)) {
      throw new RangeError('invalid maxRetainedNativeDataUrlChars');
    }
    if (typeof shareNativeDataUrls !== 'boolean') throw new TypeError('invalid shareNativeDataUrls');
    this.limit = limit;
    this.byteLimit = byteLimit;
    // Existing opt-in cap is *logical* URL characters; never evict only point.
    this.maxRetainedNativeDataUrlChars = maxRetainedNativeDataUrlChars;
    // Opt-in: string snapshots with native URLs use private pooled ASCII bytes.
    // All external entry.snapshot reads still return the exact original text.
    this.shareNativeDataUrls = shareNativeDataUrls;
    this.entries = [];
    this.index = -1;
    this._stringByteSizes = new WeakMap();
    this._nativeDataUrlChars = new WeakMap();
    this._sharedEntries = new WeakMap();
    this._nativeUrlPool = new Map();
  }

  _internUrl(text, start, end) {
    // Hash collision is harmless: verify *all* bytes before sharing owners.
    const key = urlHash(text, start, end);
    let bucket = this._nativeUrlPool.get(key);
    if (!bucket) { bucket = []; this._nativeUrlPool.set(key, bucket); }
    let owner = bucket.find(item => {
      if (item.bytes.length !== end - start) return false;
      for (let i = start; i < end; i++) {
        if (item.bytes[i - start] !== text.charCodeAt(i)) return false;
      }
      return true;
    });
    if (!owner) {
      const bytes = new Uint8Array(end - start);
      for (let i = start; i < end; i++) bytes[i - start] = text.charCodeAt(i);
      owner = { key, bytes, refs:0 };
      bucket.push(owner);
    }
    owner.refs++;
    return owner;
  }

  _releaseOwners(owners) {
    for (const owner of owners) {
      owner.refs--;
      if (owner.refs !== 0) continue;
      const bucket = this._nativeUrlPool.get(owner.key);
      if (!bucket) continue;
      const i = bucket.indexOf(owner);
      if (i !== -1) bucket.splice(i, 1);
      if (!bucket.length) this._nativeUrlPool.delete(owner.key);
    }
  }

  _releaseEntry(entry) {
    const meta = this._sharedEntries.get(entry);
    if (!meta) return;
    this._sharedEntries.delete(entry);
    this._releaseOwners(meta.owners);
  }
  _releaseEntries(entries) {
    for (const entry of entries) this._releaseEntry(entry);
  }

  _makeEntry(label, snapshot) {
    const entry = { label, snapshot, timestamp:Date.now() };
    if (!this.shareNativeDataUrls || typeof snapshot !== 'string') return entry;
    const parts = [], owners = [];
    let cursor = 0, nativeChars = 0;
    try {
      for (const [start, end] of nativeUrlSpans(snapshot)) {
        parts.push({ units:toUnits(snapshot, cursor, start) });
        const owner = this._internUrl(snapshot, start, end);
        owners.push(owner);
        parts.push({ owner });
        nativeChars += end - start;
        cursor = end;
      }
      if (!owners.length) return entry;
      parts.push({ units:toUnits(snapshot, cursor, snapshot.length) });
      const meta = { parts, owners, nativeChars, logicalBytes:this.snapshotBytes(snapshot) };
      // A getter does not hold a second permanent materialized JSON string.
      // External writes retain the legacy mutable entry.snapshot contract.
      Object.defineProperty(entry, 'snapshot', {
        enumerable:true, configurable:true,
        get:() => parts.map(part => part.owner
          ? fromUnits(part.owner.bytes) : fromUnits(part.units)).join(''),
        set:(value) => {
          this._releaseEntry(entry);
          Object.defineProperty(entry, 'snapshot', {
            value, writable:true, enumerable:true, configurable:true,
          });
        },
      });
      this._sharedEntries.set(entry, meta);
      return entry;
    } catch (error) {
      this._releaseOwners(owners);
      throw error;
    }
  }

  push(label, snapshot) {
    // Prepare before mutating the current or redo branch: failure is atomic.
    const entry = this._makeEntry(label, snapshot);
    this._releaseEntries(this.entries.slice(this.index + 1));
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(entry);
    while (this.entries.length > this.limit) this._releaseEntry(this.entries.shift());
    while (this.entries.length > 1 &&
        (this.totalBytes() > this.byteLimit ||
          (this.maxRetainedNativeDataUrlChars !== null &&
            this.retainedNativeDataUrlChars() > this.maxRetainedNativeDataUrlChars))) {
      this._releaseEntry(this.entries.shift());
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
      const shared = this._sharedEntries.get(entry);
      if (shared) return sum + shared.nativeChars;
      if (typeof entry.snapshot !== 'string') return sum + countNativeDataUrlChars(entry.snapshot);
      const cached = this._nativeDataUrlChars.get(entry);
      if (cached && cached.snapshot === entry.snapshot) return sum + cached.chars;
      const chars = countNativeDataUrlChars(entry.snapshot);
      this._nativeDataUrlChars.set(entry, { snapshot:entry.snapshot, chars });
      return sum + chars;
    }, 0);
  }

  // Exactly allocated unique native ASCII URL payload bytes, NOT JS heap/RSS.
  pooledNativeDataUrlChars() {
    let bytes = 0;
    for (const bucket of this._nativeUrlPool.values()) {
      for (const owner of bucket) bytes += owner.bytes.length;
    }
    return bytes;
  }

  totalBytes() {
    return this.entries.reduce((sum, entry) => {
      const shared = this._sharedEntries.get(entry);
      if (shared) return sum + shared.logicalBytes;
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
      // V8 often holds Latin-1 JSON strings in one byte/char. Conservatively
      // count two bytes/char if any wide code unit occurs.
      return /[^\x00-\xff]/.test(encoded) ? encoded.length * 2 : encoded.length;
    } catch { return 0; }
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index >= 0 && this.index < this.entries.length - 1; }
  current() { return this.entries[this.index] ?? null; }

  reset(label, snapshot) {
    const entry = this._makeEntry(label, snapshot);
    this._releaseEntries(this.entries);
    this.entries = [entry];
    this.index = 0;
  }
  clearToCurrent() {
    const current = this.current();
    if (!current) return;
    this._releaseEntries(this.entries.filter(entry => entry !== current));
    this.entries = [current];
    this.index = 0;
  }
}

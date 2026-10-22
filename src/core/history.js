export class HistoryStack {
  constructor(limit = 60, byteLimit = 128 * 1024 * 1024) {
    this.limit = limit;
    this.byteLimit = byteLimit;
    this.entries = [];
    this.index = -1;
    // Immutable JSON strings retain their byte estimate across totalBytes calls.
    this._stringByteSizes = new WeakMap();
  }

  push(label, snapshot) {
    const entry = { label, snapshot, timestamp: Date.now() };
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(entry);
    while (this.entries.length > this.limit) this.entries.shift();
    while (this.entries.length > 1 && this.totalBytes() > this.byteLimit) this.entries.shift();
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
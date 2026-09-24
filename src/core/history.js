export class HistoryStack {
  constructor(limit = 60, byteLimit = 128 * 1024 * 1024) {
    this.limit = limit;
    this.byteLimit = byteLimit;
    this.entries = [];
    this.index = -1;
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
    return this.entries.reduce((sum, entry) => sum + this.snapshotBytes(entry.snapshot), 0);
  }

  snapshotBytes(snapshot) {
    if (typeof snapshot === 'string') return snapshot.length * 2;
    try { return JSON.stringify(snapshot).length * 2; } catch { return 0; }
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
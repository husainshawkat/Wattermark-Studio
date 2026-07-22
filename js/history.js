/* ============================================================
   history.js — undo/redo stack for the active fabric canvas.
   Stores lightweight JSON snapshots; capped to avoid runaway
   memory on very long editing sessions.
   ============================================================ */
'use strict';

HWS.History = class History {
  constructor(canvas, { limit = 60, onChange } = {}) {
    this.canvas = canvas;
    this.limit = limit;
    this.onChange = onChange || (() => {});
    this.stack = [];
    this.pointer = -1;
    this._suspend = false;
  }

  /** Call after every meaningful mutation to push a new snapshot. */
  snapshot() {
    if (this._suspend) return;
    const json = JSON.stringify(
      this.canvas.toJSON(['selectable', 'evented', 'watermarkType', 'watermarkMeta', 'locked'])
    );
    // Drop any redo branch
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(json);
    if (this.stack.length > this.limit) this.stack.shift();
    this.pointer = this.stack.length - 1;
    this.onChange(this.canUndo(), this.canRedo());
  }

  canUndo() {
    return this.pointer > 0;
  }
  canRedo() {
    return this.pointer < this.stack.length - 1;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.pointer -= 1;
    await this._restore(this.stack[this.pointer]);
    this.onChange(this.canUndo(), this.canRedo());
  }

  async redo() {
    if (!this.canRedo()) return;
    this.pointer += 1;
    await this._restore(this.stack[this.pointer]);
    this.onChange(this.canUndo(), this.canRedo());
  }

  _restore(json) {
    this._suspend = true;
    return new Promise((resolve) => {
      this.canvas.loadFromJSON(json, () => {
        this.canvas.renderAll();
        this._suspend = false;
        resolve();
      });
    });
  }

  reset() {
    this.stack = [];
    this.pointer = -1;
    this.snapshot();
  }
};

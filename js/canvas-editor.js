/* ============================================================
   canvas-editor.js — wraps Fabric.js into the app's editing
   surface: image loading, infinite zoom/pan, grid, snapping,
   selection tracking and history hookup.
   ============================================================ */
'use strict';

HWS.Editor = class Editor {
  constructor() {
    this.canvasEl = document.getElementById('mainCanvas');
    this.wrap = document.getElementById('canvasWrap');
    this.scrollEl = document.getElementById('canvasScroll');
    this.emptyEl = document.getElementById('canvasEmpty');

    this.fabric = new fabric.Canvas(this.canvasEl, {
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: '#00000000',
    });

    this.zoom = 1;
    this.baseImage = null;      // fabric.Image of the loaded photo
    this.sourceMeta = null;     // { file, name, width, height, exif }
    this.gridOn = false;
    this.guidesOn = true;

    this.history = new HWS.History(this.fabric, {
      onChange: (canUndo, canRedo) => this._onHistoryChange(canUndo, canRedo),
    });

    this._bindCanvasEvents();
    this._bindZoomControls();
    this._bindPanAndPinch();
  }

  // ---------------------------------------------------------
  // Loading an image onto the stage
  // ---------------------------------------------------------
  async loadFromFile(file) {
    const dataUrl = await HWS.utils.readAsDataURL(file);
    const img = await HWS.utils.loadImage(dataUrl);
    const exif = await HWS.exifReader.read(file);

    this.sourceMeta = { file, name: file.name, width: img.width, height: img.height, exif, dataUrl };
    this._setStageSize(img.width, img.height);

    this.fabric.clear();
    const fImg = new fabric.Image(img, {
      left: 0, top: 0, selectable: false, evented: false, hasControls: false,
    });
    fImg.scaleToWidth(img.width);
    this.baseImage = fImg;
    this.fabric.add(fImg);
    this.fabric.sendToBack(fImg);
    this.fabric.renderAll();

    this.fitToScreen();
    this.history.reset();
    this.emptyEl.classList.add('hidden');
    document.getElementById('editorFilename').textContent = file.name;
    return this.sourceMeta;
  }

  _setStageSize(w, h) {
    this.fabric.setWidth(w);
    this.fabric.setHeight(h);
    this.wrap.style.width = `${w}px`;
    this.wrap.style.height = `${h}px`;
  }

  // ---------------------------------------------------------
  // Zoom / pan / fit
  // ---------------------------------------------------------
  setZoom(z, opts = {}) {
    this.zoom = HWS.utils.clamp(z, 0.1, 10);
    this.wrap.style.transform = `scale(${this.zoom})`;
    document.getElementById('zoomReadout').textContent = `${Math.round(this.zoom * 100)}%`;
    if (!opts.silent) this._centerIfSmaller();
  }

  zoomBy(factor) {
    this.setZoom(this.zoom * factor);
  }

  fitToScreen() {
    if (!this.sourceMeta) return;
    const pad = 96;
    const availW = this.scrollEl.clientWidth - pad;
    const availH = this.scrollEl.clientHeight - pad;
    const scale = Math.min(availW / this.sourceMeta.width, availH / this.sourceMeta.height, 1);
    this.setZoom(scale > 0 ? scale : 1);
  }

  _centerIfSmaller() {
    // Flex centering on .canvas-scroll already handles this visually.
  }

  _bindZoomControls() {
    document.getElementById('btnZoomIn').addEventListener('click', () => this.zoomBy(1.2));
    document.getElementById('btnZoomOut').addEventListener('click', () => this.zoomBy(1 / 1.2));
    document.getElementById('btnZoomFit').addEventListener('click', () => this.fitToScreen());

    this.scrollEl.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
      },
      { passive: false }
    );

    document.getElementById('btnToggleGrid').addEventListener('click', (e) => {
      this.gridOn = !this.gridOn;
      e.currentTarget.setAttribute('aria-pressed', String(this.gridOn));
      this.wrap.style.backgroundImage = this.gridOn
        ? 'linear-gradient(rgba(201,162,39,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.25) 1px, transparent 1px)'
        : '';
      this.wrap.style.backgroundSize = this.gridOn ? '40px 40px' : '';
    });

    document.getElementById('btnToggleGuides').addEventListener('click', (e) => {
      this.guidesOn = !this.guidesOn;
      e.currentTarget.setAttribute('aria-pressed', String(this.guidesOn));
    });
  }

  // Pinch-to-zoom + one-finger pan on touch devices
  _bindPanAndPinch() {
    let lastDist = null;
    this.scrollEl.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const [a, b] = e.touches;
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          if (lastDist != null) {
            const delta = dist / lastDist;
            this.zoomBy(delta);
          }
          lastDist = dist;
        }
      },
      { passive: false }
    );
    this.scrollEl.addEventListener('touchend', () => (lastDist = null));
  }

  // ---------------------------------------------------------
  // Snapping guide lines (simple center/edge snap)
  // ---------------------------------------------------------
  _bindCanvasEvents() {
    this.fabric.on('object:added', (e) => {
      if (e.target !== this.baseImage) this._afterMutate();
    });
    this.fabric.on('object:modified', () => this._afterMutate());
    this.fabric.on('object:removed', () => this._afterMutate());

    this.fabric.on('object:moving', (e) => {
      if (!this.guidesOn) return;
      this._snapToCenter(e.target);
    });

    this.fabric.on('selection:created', () => this._onSelectionChange());
    this.fabric.on('selection:updated', () => this._onSelectionChange());
    this.fabric.on('selection:cleared', () => this._onSelectionChange());
  }

  _snapToCenter(obj) {
    const cw = this.fabric.getWidth();
    const ch = this.fabric.getHeight();
    const threshold = 8 / this.zoom;
    const objCenter = obj.getCenterPoint();
    if (Math.abs(objCenter.x - cw / 2) < threshold) {
      obj.setPositionByOrigin(new fabric.Point(cw / 2, objCenter.y), 'center', 'center');
    }
    if (Math.abs(objCenter.y - ch / 2) < threshold) {
      obj.setPositionByOrigin(new fabric.Point(objCenter.x, ch / 2), 'center', 'center');
    }
  }

  _afterMutate() {
    this.history.snapshot();
    if (window.HWS.layersPanel) window.HWS.layersPanel.refresh();
    if (window.HWS.app) window.HWS.app.scheduleAutosave();
  }

  _onSelectionChange() {
    if (window.HWS.layersPanel) window.HWS.layersPanel.syncSelection();
    const active = this.fabric.getActiveObject();
    const qb = document.getElementById('layerQuickbar');
    qb.style.display = active && active !== this.baseImage ? 'flex' : 'none';
  }

  _onHistoryChange(canUndo, canRedo) {
    document.getElementById('btnUndo').disabled = !canUndo;
    document.getElementById('btnRedo').disabled = !canRedo;
  }

  // ---------------------------------------------------------
  // Public helpers used by watermark modules
  // ---------------------------------------------------------
  addObject(obj, { select = true } = {}) {
    this.fabric.add(obj);
    if (select) this.fabric.setActiveObject(obj);
    this.fabric.renderAll();
    this._afterMutate();
    return obj;
  }

  getSelected() {
    const o = this.fabric.getActiveObject();
    return o && o !== this.baseImage ? o : null;
  }

  deleteSelected() {
    const o = this.getSelected();
    if (!o) return;
    this.fabric.remove(o);
    this.fabric.discardActiveObject();
    this.fabric.renderAll();
  }

  duplicateSelected() {
    const o = this.getSelected();
    if (!o) return;
    o.clone((clone) => {
      clone.set({ left: o.left + 20, top: o.top + 20 });
      this.addObject(clone);
    });
  }
};

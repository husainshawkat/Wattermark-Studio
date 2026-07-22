/* ============================================================
   adjustments.js — brightness/contrast/saturation/temperature/
   vignette applied to the base photo using Fabric's built-in
   WebGL-accelerated filter pipeline, plus rotate/flip.
   ============================================================ */
'use strict';

HWS.adjustments = (() => {
  let editor = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    ['adjBrightness', 'adjContrast', 'adjSaturation', 'adjTemperature', 'adjVignette'].forEach((id) =>
      $(id).addEventListener('input', HWS.utils.debounce(apply, 40))
    );
    $('btnAdjReset').addEventListener('click', reset);
    $('btnRotate90').addEventListener('click', () => rotateBase(90));
    $('btnFlipH').addEventListener('click', flipBase);
  }

  function apply() {
    const img = editor.baseImage;
    if (!img) return;

    const brightness = Number($('adjBrightness').value) / 100;
    const contrast = Number($('adjContrast').value) / 100;
    const saturation = Number($('adjSaturation').value) / 100;
    const temp = Number($('adjTemperature').value) / 100;

    const filters = [];
    if (brightness) filters.push(new fabric.Image.filters.Brightness({ brightness }));
    if (contrast) filters.push(new fabric.Image.filters.Contrast({ contrast }));
    if (saturation) filters.push(new fabric.Image.filters.Saturation({ saturation }));
    if (temp) {
      // Warm/cool shift implemented as a tinted multiply-ish overlay via HueRotation+Brightness combo.
      filters.push(
        new fabric.Image.filters.ColorMatrix({
          matrix:
            temp > 0
              ? [1 + temp * 0.3, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 - temp * 0.3, 0, 0, 0, 0, 0, 1, 0]
              : [1 + temp * 0.3, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 - temp * 0.3, 0, 0, 0, 0, 0, 1, 0],
        })
      );
    }

    img.filters = filters;
    img.applyFilters();
    applyVignette();
    editor.fabric.renderAll();
    editor._afterMutate();
  }

  function applyVignette() {
    const amount = Number($('adjVignette').value);
    const existing = editor.fabric.getObjects().find((o) => o.watermarkType === 'vignette');
    if (existing) editor.fabric.remove(existing);
    if (amount <= 0) return;

    const w = editor.fabric.getWidth();
    const h = editor.fabric.getHeight();
    const radial = new fabric.Rect({
      left: 0, top: 0, width: w, height: h,
      selectable: false, evented: false, watermarkType: 'vignette',
      fill: new fabric.Gradient({
        type: 'radial',
        coords: { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 1.3 },
        colorStops: [
          { offset: 0, color: 'rgba(0,0,0,0)' },
          { offset: 1, color: `rgba(0,0,0,${amount / 130})` },
        ],
      }),
    });
    editor.fabric.add(radial);
    editor.fabric.moveTo(radial, 1); // just above base image
  }

  function reset() {
    ['adjBrightness', 'adjContrast', 'adjSaturation', 'adjTemperature', 'adjVignette'].forEach((id) => ($(id).value = 0));
    if (editor.baseImage) {
      editor.baseImage.filters = [];
      editor.baseImage.applyFilters();
    }
    applyVignette();
    editor.fabric.renderAll();
    editor._afterMutate();
  }

  function rotateBase(deg) {
    if (!editor.baseImage) return;
    editor.baseImage.angle = (editor.baseImage.angle || 0) + deg;
    editor.fabric.renderAll();
    editor._afterMutate();
  }

  function flipBase() {
    if (!editor.baseImage) return;
    editor.baseImage.flipX = !editor.baseImage.flipX;
    editor.fabric.renderAll();
    editor._afterMutate();
  }

  return { init, reset };
})();

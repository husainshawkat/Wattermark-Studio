/* ============================================================
   watermark-signature.js — a small drawing pad (mouse & touch)
   that rasterizes a freehand signature onto the main canvas
   as a transparent PNG watermark object.
   ============================================================ */
'use strict';

HWS.watermarkSignature = (() => {
  let editor = null;
  let pad, ctx, drawing = false, last = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    pad = $('sigPad');
    ctx = pad.getContext('2d');
    clear();

    const pos = (e) => {
      const rect = pad.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - rect.left) * (pad.width / rect.width), y: (p.clientY - rect.top) * (pad.height / rect.height) };
    };

    const start = (e) => { drawing = true; last = pos(e); e.preventDefault(); };
    const move = (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.strokeStyle = $('sigColor').value;
      ctx.lineWidth = Number($('sigThickness').value);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      e.preventDefault();
    };
    const end = () => (drawing = false);

    pad.addEventListener('mousedown', start);
    pad.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    pad.addEventListener('touchstart', start, { passive: false });
    pad.addEventListener('touchmove', move, { passive: false });
    pad.addEventListener('touchend', end);

    $('btnSigClear').addEventListener('click', clear);
    $('btnSigAdd').addEventListener('click', addToCanvas);
  }

  function clear() {
    ctx.clearRect(0, 0, pad.width, pad.height);
  }

  function addToCanvas() {
    // Trim transparent border by exporting only the drawn area's bounding box.
    const data = ctx.getImageData(0, 0, pad.width, pad.height);
    let minX = pad.width, minY = pad.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < pad.height; y++) {
      for (let x = 0; x < pad.width; x++) {
        const alpha = data.data[(y * pad.width + x) * 4 + 3];
        if (alpha > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) {
      HWS.utils.toast('Draw a signature first');
      return;
    }
    const w = maxX - minX + 8;
    const h = maxY - minY + 8;
    const trimmed = document.createElement('canvas');
    trimmed.width = w;
    trimmed.height = h;
    trimmed.getContext('2d').drawImage(pad, minX - 4, minY - 4, w, h, 0, 0, w, h);

    fabric.Image.fromURL(trimmed.toDataURL('image/png'), (fImg) => {
      fImg.set({
        left: editor.fabric.getWidth() / 2 - w / 2,
        top: editor.fabric.getHeight() / 2 - h / 2,
        watermarkType: 'signature',
        opacity: 0.9,
      });
      editor.addObject(fImg);
      clear();
      HWS.utils.toast('Signature added');
    });
  }

  return { init };
})();

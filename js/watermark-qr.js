/* ============================================================
   watermark-qr.js — generates a QR code (via qrcodejs, fully
   local/offline) and drops it onto the canvas as an image
   watermark object.
   ============================================================ */
'use strict';

HWS.watermarkQr = (() => {
  let editor = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    $('btnAddQr').addEventListener('click', addQr);
  }

  function addQr() {
    const content = $('qrContent').value.trim() || 'https://example.com';
    const size = Number($('qrSize').value);
    const opacity = Number($('qrOpacity').value) / 100;
    const fg = $('qrFg').value;
    const bg = $('qrBg').value;

    // Render offscreen via qrcodejs, then lift the generated <canvas>/<img>.
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    document.body.appendChild(holder);

    new QRCode(holder, {
      text: content, width: size, height: size,
      colorDark: fg, colorLight: bg,
      correctLevel: QRCode.CorrectLevel.M,
    });

    // qrcodejs renders async-ish via img/canvas; give it a tick.
    setTimeout(() => {
      const src = holder.querySelector('canvas')
        ? holder.querySelector('canvas').toDataURL('image/png')
        : holder.querySelector('img').src;

      fabric.Image.fromURL(src, (fImg) => {
        fImg.set({
          left: editor.fabric.getWidth() - size - 24,
          top: editor.fabric.getHeight() - size - 24,
          opacity,
          watermarkType: 'qr',
        });
        editor.addObject(fImg);
        document.body.removeChild(holder);
        HWS.utils.toast('QR watermark added');
      });
    }, 60);
  }

  return { init };
})();

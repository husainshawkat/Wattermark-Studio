/* ============================================================
   watermark-logo.js — logo/PNG/SVG watermark: upload, scale,
   rotate, opacity, corner radius (via clip path), shadow/glow.
   ============================================================ */
'use strict';

HWS.watermarkLogo = (() => {
  let editor = null;
  let activeLogoObj = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;

    $('logoFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await HWS.utils.readAsDataURL(file);
      const img = await HWS.utils.loadImage(dataUrl);
      const fImg = new fabric.Image(img, {
        left: editor.fabric.getWidth() / 2 - img.width / 4,
        top: editor.fabric.getHeight() / 2 - img.height / 4,
        watermarkType: 'logo',
      });
      fImg.scaleToWidth(Math.min(img.width, editor.fabric.getWidth() * 0.35));
      activeLogoObj = fImg;
      editor.addObject(fImg);
      applyLive();
      HWS.utils.toast('Logo added');
    });

    ['logoScale', 'logoRotation', 'logoOpacity', 'logoRadius', 'logoShadowToggle', 'logoGlowToggle'].forEach((id) =>
      $(id).addEventListener('input', applyLive)
    );
  }

  function applyLive() {
    if (!activeLogoObj) return;
    const scale = Number($('logoScale').value) / 100;
    const rotation = Number($('logoRotation').value);
    const opacity = Number($('logoOpacity').value) / 100;
    const radius = Number($('logoRadius').value);

    activeLogoObj.set({
      scaleX: scale, scaleY: scale, angle: rotation, opacity,
      shadow: buildShadow(),
    });

    if (radius > 0) {
      const w = activeLogoObj.width;
      const h = activeLogoObj.height;
      activeLogoObj.clipPath = new fabric.Rect({
        width: w, height: h, rx: radius, ry: radius,
        left: -w / 2, top: -h / 2,
      });
    } else {
      activeLogoObj.clipPath = null;
    }

    editor.fabric.renderAll();
    editor._afterMutate();
  }

  function buildShadow() {
    if ($('logoGlowToggle').checked) {
      return new fabric.Shadow({ color: '#ffffff', blur: 30, offsetX: 0, offsetY: 0 });
    }
    if ($('logoShadowToggle').checked) {
      return new fabric.Shadow({ color: 'rgba(0,0,0,0.55)', blur: 10, offsetX: 3, offsetY: 3 });
    }
    return null;
  }

  function editExisting(obj) {
    activeLogoObj = obj;
    $('logoScale').value = Math.round((obj.scaleX || 1) * 100);
    $('logoRotation').value = obj.angle || 0;
    $('logoOpacity').value = Math.round((obj.opacity ?? 0.8) * 100);
  }

  function resetActive() {
    activeLogoObj = null;
  }

  return { init, editExisting, resetActive };
})();

/* ============================================================
   watermark-text.js — text watermark creation & live editing:
   fonts, size/weight, color/gradient, stroke, shadow, glow,
   letter-spacing, rotation, opacity, blend mode.
   ============================================================ */
'use strict';

HWS.watermarkText = (() => {
  let editor = null;
  let activeTextObj = null;

  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;

    $('textGradientToggle').addEventListener('change', (e) => {
      $('gradientRow').classList.toggle('hidden', !e.target.checked);
      applyLive();
    });

    [
      'textContent', 'textFont', 'textSize', 'textWeight', 'textColor',
      'textGradientFrom', 'textGradientTo', 'textLetterSpacing', 'textRotation',
      'textOpacity', 'textBlend', 'textStrokeToggle', 'textStrokeColor',
      'textStrokeWidth', 'textShadowToggle', 'textGlowToggle',
    ].forEach((id) => {
      const el = $(id);
      const evt = el.type === 'range' || el.tagName === 'SELECT' || el.type === 'color' || el.type === 'checkbox' ? 'input' : 'input';
      el.addEventListener(evt, applyLive);
    });

    $('textVariable').addEventListener('change', (e) => {
      if (!e.target.value) return;
      const ta = $('textContent');
      const pos = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, pos) + e.target.value + ta.value.slice(pos);
      e.target.value = '';
      applyLive();
    });

    $('btnAddText').addEventListener('click', () => {
      activeTextObj = null; // force new object
      createOrUpdate();
      HWS.utils.toast('Text watermark added');
    });
  }

  function readForm() {
    return {
      content: $('textContent').value || '© Your Name',
      font: $('textFont').value,
      size: Number($('textSize').value),
      weight: $('textWeight').value,
      color: $('textColor').value,
      gradient: $('textGradientToggle').checked,
      gradFrom: $('textGradientFrom').value,
      gradTo: $('textGradientTo').value,
      letterSpacing: Number($('textLetterSpacing').value),
      rotation: Number($('textRotation').value),
      opacity: Number($('textOpacity').value) / 100,
      blend: $('textBlend').value,
      stroke: $('textStrokeToggle').checked,
      strokeColor: $('textStrokeColor').value,
      strokeWidth: Number($('textStrokeWidth').value),
      shadow: $('textShadowToggle').checked,
      glow: $('textGlowToggle').checked,
    };
  }

  function resolvedContent(raw) {
    const exif = editor.sourceMeta ? editor.sourceMeta.exif : {};
    return HWS.exifReader.applyTemplate(raw, exif || {}, {
      filename: editor.sourceMeta ? HWS.utils.baseName(editor.sourceMeta.name) : 'image',
    });
  }

  function buildFillValue(cfg, obj) {
    if (!cfg.gradient) return cfg.color;
    return new fabric.Gradient({
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: obj.width || 200, y2: 0 },
      colorStops: [
        { offset: 0, color: cfg.gradFrom },
        { offset: 1, color: cfg.gradTo },
      ],
    });
  }

  function createOrUpdate() {
    const cfg = readForm();
    const text = resolvedContent(cfg.content);

    let obj = activeTextObj;
    if (!obj) {
      obj = new fabric.Textbox(text, {
        left: editor.fabric.getWidth() / 2 - 100,
        top: editor.fabric.getHeight() / 2 - 20,
        watermarkType: 'text',
      });
      editor.fabric.add(obj);
      activeTextObj = obj;
    } else {
      obj.set('text', text);
    }

    obj.set({
      fontFamily: cfg.font,
      fontSize: cfg.size,
      fontWeight: cfg.weight,
      opacity: cfg.opacity,
      angle: cfg.rotation,
      charSpacing: cfg.letterSpacing,
      globalCompositeOperation: cfg.blend,
      stroke: cfg.stroke ? cfg.strokeColor : null,
      strokeWidth: cfg.stroke ? cfg.strokeWidth : 0,
      shadow: buildShadow(cfg),
    });
    obj.set('fill', buildFillValue(cfg, obj));

    editor.fabric.setActiveObject(obj);
    editor.fabric.renderAll();
    editor._afterMutate();
  }

  function buildShadow(cfg) {
    if (cfg.glow) {
      return new fabric.Shadow({ color: cfg.color, blur: 24, offsetX: 0, offsetY: 0 });
    }
    if (cfg.shadow) {
      return new fabric.Shadow({ color: 'rgba(0,0,0,0.6)', blur: 8, offsetX: 4, offsetY: 4 });
    }
    return null;
  }

  const applyLive = HWS.utils.debounce(() => {
    if (activeTextObj) createOrUpdate();
  }, 60);

  /** Called by layers panel / canvas selection to edit an existing text object. */
  function editExisting(obj) {
    activeTextObj = obj;
    $('textContent').value = obj.text || '';
    $('textFont').value = obj.fontFamily || 'Inter';
    $('textSize').value = obj.fontSize || 48;
    $('textWeight').value = String(obj.fontWeight || 400);
    if (typeof obj.fill === 'string') $('textColor').value = obj.fill;
    $('textOpacity').value = Math.round((obj.opacity ?? 0.8) * 100);
    $('textRotation').value = obj.angle || 0;
    $('textLetterSpacing').value = obj.charSpacing || 0;
  }

  function resetActive() {
    activeTextObj = null;
  }

  return { init, createOrUpdate, editExisting, resetActive };
})();

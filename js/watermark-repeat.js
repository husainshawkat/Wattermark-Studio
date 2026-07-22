/* ============================================================
   watermark-repeat.js — takes the currently selected text or
   logo layer and tiles it across the whole canvas as a single
   grouped pattern (diagonal / horizontal / vertical / grid).
   ============================================================ */
'use strict';

HWS.watermarkRepeat = (() => {
  let editor = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    $('btnAddRepeat').addEventListener('click', apply);
  }

  function apply() {
    const source = editor.getSelected();
    if (!source || !['text', 'logo', 'signature'].includes(source.watermarkType)) {
      HWS.utils.toast('Select a text or logo layer first');
      return;
    }

    const pattern = $('repeatPattern').value;
    const spacingX = Number($('repeatSpacingX').value);
    const spacingY = Number($('repeatSpacingY').value);
    const density = Number($('repeatDensity').value);
    const rotation = Number($('repeatRotation').value);
    const opacity = Number($('repeatOpacity').value) / 100;

    const cw = editor.fabric.getWidth();
    const ch = editor.fabric.getHeight();
    const tiles = [];

    const stepX = Math.max(20, spacingX / (density / 4));
    const stepY = Math.max(20, spacingY / (density / 4));

    let rows, cols, offsetStagger;
    if (pattern === 'horizontal') { rows = Math.ceil(ch / stepY); cols = 1; }
    else if (pattern === 'vertical') { rows = 1; cols = Math.ceil(cw / stepX); }
    else { rows = Math.ceil(ch / stepY) + 2; cols = Math.ceil(cw / stepX) + 2; }

    const startY = pattern === 'horizontal' ? stepY / 2 : -stepY;
    const startX = pattern === 'vertical' ? stepX / 2 : -stepX;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        source.clone((clone) => {
          const stagger = pattern === 'diagonal' || pattern === 'grid' ? (r % 2) * (stepX / 2) : 0;
          clone.set({
            left: pattern === 'horizontal' ? cw / 2 : startX + c * stepX + stagger,
            top: pattern === 'vertical' ? ch / 2 : startY + r * stepY,
            opacity,
            angle: pattern === 'diagonal' ? rotation : clone.angle || 0,
            selectable: false,
            evented: false,
          });
          tiles.push(clone);
          if (tiles.length === rows * cols) finalize(tiles);
        });
      }
    }
  }

  function finalize(tiles) {
    const group = new fabric.Group(tiles, {
      watermarkType: 'repeat',
      left: 0,
      top: 0,
    });
    // Clip the group to the canvas bounds so tiles don't spill visibly outside export.
    group.clipPath = new fabric.Rect({
      left: -group.left, top: -group.top,
      width: editor.fabric.getWidth(), height: editor.fabric.getHeight(),
    });
    editor.addObject(group);
    HWS.utils.toast(`Repeat pattern applied (${tiles.length} tiles)`);
  }

  return { init };
})();

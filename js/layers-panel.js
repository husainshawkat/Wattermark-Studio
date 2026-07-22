/* ============================================================
   layers-panel.js — unlimited-layer list with lock/hide/
   duplicate/rename/delete, kept in sync with canvas selection.
   ============================================================ */
'use strict';

HWS.layersPanel = (() => {
  let editor = null;
  const listEl = () => document.getElementById('layerList');

  const typeLabel = {
    text: 'Text', logo: 'Logo', signature: 'Signature', qr: 'QR code',
    exif: 'EXIF stamp', repeat: 'Repeat pattern', vignette: 'Vignette',
  };

  function init(ed) {
    editor = ed;
    bindQuickbar();
  }

  function refresh() {
    const objs = editor.fabric.getObjects().filter((o) => o !== editor.baseImage && o.watermarkType !== 'vignette');
    const ul = listEl();
    ul.innerHTML = '';
    // Show topmost first
    [...objs].reverse().forEach((obj) => {
      const li = document.createElement('li');
      li.className = 'layer-row' + (editor.fabric.getActiveObject() === obj ? ' selected' : '');
      li.innerHTML = `
        <span class="layer-name">${typeLabel[obj.watermarkType] || 'Layer'}${obj._name ? ': ' + obj._name : ''}</span>
        <button data-act="hide" title="${obj.visible === false ? 'Show' : 'Hide'}">${obj.visible === false ? '👁️‍🗨️' : '👁️'}</button>
        <button data-act="lock" title="${obj.locked ? 'Unlock' : 'Lock'}">${obj.locked ? '🔒' : '🔓'}</button>
        <button data-act="dup" title="Duplicate">⧉</button>
        <button data-act="del" title="Delete">🗑️</button>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        editor.fabric.setActiveObject(obj);
        editor.fabric.renderAll();
        refresh();
      });
      li.querySelector('[data-act="hide"]').addEventListener('click', () => {
        obj.visible = obj.visible === false ? true : false;
        editor.fabric.renderAll();
        editor._afterMutate();
        refresh();
      });
      li.querySelector('[data-act="lock"]').addEventListener('click', () => {
        obj.locked = !obj.locked;
        obj.selectable = !obj.locked;
        obj.evented = !obj.locked;
        editor._afterMutate();
        refresh();
      });
      li.querySelector('[data-act="dup"]').addEventListener('click', () => {
        editor.fabric.setActiveObject(obj);
        editor.duplicateSelected();
        refresh();
      });
      li.querySelector('[data-act="del"]').addEventListener('click', () => {
        editor.fabric.remove(obj);
        editor.fabric.discardActiveObject();
        editor.fabric.renderAll();
        editor._afterMutate();
        refresh();
      });
      ul.appendChild(li);
    });
    if (objs.length === 0) {
      ul.innerHTML = '<p class="hint">No watermark layers yet. Pick a tool on the left to add one.</p>';
    }
  }

  function syncSelection() {
    refresh();
  }

  function bindQuickbar() {
    document.getElementById('qbDuplicate').addEventListener('click', () => { editor.duplicateSelected(); refresh(); });
    document.getElementById('qbDelete').addEventListener('click', () => { editor.deleteSelected(); refresh(); });
    document.getElementById('qbLock').addEventListener('click', () => {
      const o = editor.getSelected();
      if (!o) return;
      o.locked = !o.locked;
      o.selectable = !o.locked;
      o.evented = !o.locked;
      editor._afterMutate();
      refresh();
    });
    document.getElementById('qbHide').addEventListener('click', () => {
      const o = editor.getSelected();
      if (!o) return;
      o.visible = false;
      editor.fabric.discardActiveObject();
      editor.fabric.renderAll();
      editor._afterMutate();
      refresh();
    });
  }

  return { init, refresh, syncSelection };
})();

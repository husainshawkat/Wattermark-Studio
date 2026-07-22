/* ============================================================
   watermark-exif.js — builds a composite "camera stamp" text
   block from selected EXIF fields (date, camera, ISO, etc.)
   in one of a few styled presets.
   ============================================================ */
'use strict';

HWS.watermarkExif = (() => {
  let editor = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    document.getElementById('btnAddExif').addEventListener('click', addExif);
  }

  /** Called when the EXIF tool tab opens, to reflect what was actually read. */
  function refreshDetected() {
    const exif = editor.sourceMeta ? editor.sourceMeta.exif : null;
    const label = document.getElementById('exifDetected');
    if (!exif) {
      label.textContent = 'Open a photo to read its EXIF data.';
      return;
    }
    const found = ['camera', 'lens', 'iso', 'aperture', 'shutter', 'gps', 'date'].filter((k) => exif[k]);
    label.textContent = found.length
      ? `Detected: ${found.join(', ')}`
      : 'No EXIF metadata found in this image — using today\u2019s date instead.';
  }

  function addExif() {
    const exif = (editor.sourceMeta && editor.sourceMeta.exif) || {};
    const filename = editor.sourceMeta ? HWS.utils.baseName(editor.sourceMeta.name) : 'image';
    const checked = Array.from(document.querySelectorAll('#exifChecks input:checked')).map((c) => c.value);
    if (checked.length === 0) {
      HWS.utils.toast('Choose at least one field');
      return;
    }
    const parts = checked.map((token) => HWS.exifReader.applyTemplate(token, exif, { filename }));
    const text = parts.filter(Boolean).join('   •   ');
    const style = $('exifStyle').value;

    const isMono = style === 'mono';
    const obj = new fabric.Textbox(text, {
      left: 24,
      top: editor.fabric.getHeight() - 60,
      fontSize: 20,
      fontFamily: isMono ? "'JetBrains Mono', monospace" : 'Inter',
      fill: '#ffffff',
      opacity: 0.9,
      watermarkType: 'exif',
      shadow: style === 'badge' ? new fabric.Shadow({ color: 'rgba(0,0,0,0.7)', blur: 6, offsetX: 2, offsetY: 2 }) : null,
      backgroundColor: style === 'badge' ? 'rgba(0,0,0,0.45)' : undefined,
      padding: style === 'badge' ? 10 : 0,
    });

    editor.addObject(obj);
    HWS.utils.toast('EXIF stamp added');
  }

  return { init, refreshDetected };
})();

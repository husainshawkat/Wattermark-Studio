/* ============================================================
   export.js — renders the flattened canvas to PNG/JPEG/WEBP at
   a chosen resolution multiplier and downloads it (or hands the
   blob to the batch/zip pipeline).

   NOTE ON EXIF: browsers strip metadata when a canvas is
   re-encoded via toBlob/toDataURL. "Preserve EXIF" here means we
   keep the original bytes' tags available to the watermark text
   (via exif-reader.js) — true binary EXIF re-embedding into the
   exported JPEG would require a metadata-writing library such as
   piexif.js, which is not wired in yet. We're upfront about that
   in the UI rather than silently pretending metadata survives.
   ============================================================ */
'use strict';

HWS.exportPipeline = (() => {
  let editor = null;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    $('btnExport').addEventListener('click', openModal);
    $('btnExportCancel').addEventListener('click', closeModal);
    $('btnExportConfirm').addEventListener('click', runExport);
  }

  function openModal() {
    if (!editor.sourceMeta) {
      HWS.utils.toast('Load an image first');
      return;
    }
    const defaults = HWS.settings.get();
    $('exportFormat').value = defaults.format;
    $('exportQuality').value = defaults.quality;
    document.getElementById('exportModal').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('exportModal').classList.add('hidden');
  }

  /** Renders the current canvas to a Blob at the requested settings. */
  async function renderBlob({ format, quality, multiplier }) {
    // Deselect so control handles don't get baked into the export.
    editor.fabric.discardActiveObject();
    editor.fabric.renderAll();

    const dataUrl = editor.fabric.toDataURL({
      format: format === 'image/jpeg' ? 'jpeg' : format === 'image/webp' ? 'webp' : 'png',
      quality: quality / 100,
      multiplier,
    });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  function buildFilename(template, originalName, ext) {
    const base = HWS.exifReader.applyTemplate(template, {}, { filename: HWS.utils.baseName(originalName) });
    return `${base}.${ext}`;
  }

  async function runExport() {
    const format = $('exportFormat').value;
    const quality = Number($('exportQuality').value);
    const multiplier = Number($('exportResolution').value);
    const asZip = $('exportAsZip').checked;
    const settings = HWS.settings.get();
    const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';

    HWS.utils.toast('Rendering export…');
    const blob = await renderBlob({ format, quality, multiplier });
    const filename = buildFilename(settings.filenameTemplate, editor.sourceMeta.name, ext);

    if (asZip) {
      const zip = new JSZip();
      zip.file(filename, blob);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${HWS.utils.baseName(filename)}.zip`);
    } else {
      saveAs(blob, filename);
    }

    closeModal();
    HWS.utils.toast('Export complete');
  }

  return { init, renderBlob, buildFilename };
})();

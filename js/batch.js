/* ============================================================
   batch.js — queue manager for watermarking many images with
   the watermark layers currently built in the editor. Runs on
   the main thread with cooperative yielding (setTimeout 0)
   between images so the UI stays responsive and Pause/Cancel
   take effect promptly.

   NOTE: a true Web Worker + OffscreenCanvas pipeline (fully off
   the main thread) is the next step for very large batches;
   Fabric.js's object model expects a DOM canvas, so offloading
   it cleanly needs a worker-safe render path we haven't wired in
   yet. For now large batches (hundreds+) will show a responsive
   progress bar but do share the main thread while each image
   renders.
   ============================================================ */
'use strict';

HWS.batch = (() => {
  let editor = null;
  let queue = [];     // { id, file, status: 'pending'|'processing'|'done'|'error', blob, name }
  let paused = false;
  let cancelled = false;
  let running = false;
  const $ = (id) => document.getElementById(id);

  function init(ed) {
    editor = ed;
    $('btnBatchPause').addEventListener('click', togglePause);
    $('btnBatchCancel').addEventListener('click', cancel);
    $('btnBatchExportAll').addEventListener('click', exportAll);
  }

  function addFiles(files) {
    files.forEach((file) => {
      queue.push({ id: HWS.utils.uid('q'), file, status: 'pending', name: file.name });
    });
    render();
  }

  function clearQueue() {
    queue = [];
    render();
  }

  function render() {
    const list = $('batchList');
    $('batchSummary').textContent = queue.length
      ? `${queue.length} image${queue.length > 1 ? 's' : ''} queued`
      : 'No images queued. Go to Home and upload multiple photos to batch-process them.';
    list.innerHTML = '';
    queue.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'batch-row';
      const statusClass = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : '';
      li.innerHTML = `
        <img data-thumb="${item.id}" alt="" />
        <span class="batch-row-name">${item.name}</span>
        <span class="batch-row-status ${statusClass}">${item.status}</span>
      `;
      list.appendChild(li);
      HWS.utils.readAsDataURL(item.file).then((url) => {
        const img = li.querySelector(`[data-thumb="${item.id}"]`);
        if (img) img.src = url;
      });
    });
  }

  function updateProgress(done, total, startedAt) {
    const wrap = $('batchProgressWrap');
    wrap.classList.toggle('hidden', total === 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('batchProgressFill').style.width = `${pct}%`;
    $('batchProgressText').textContent = `${done} / ${total}`;
    if (done > 0) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const perImage = elapsed / done;
      const remaining = Math.max(0, Math.round(perImage * (total - done)));
      $('batchEta').textContent = `~${remaining}s remaining`;
    } else {
      $('batchEta').textContent = '';
    }
  }

  /** Applies the editor's current watermark layers (as JSON) onto a fresh image, scaled proportionally. */
  async function processOne(item, templateJson) {
    const dataUrl = await HWS.utils.readAsDataURL(item.file);
    const img = await HWS.utils.loadImage(dataUrl);

    const offCanvasEl = document.createElement('canvas');
    const off = new fabric.Canvas(offCanvasEl, { renderOnAddRemove: false });
    off.setWidth(img.width);
    off.setHeight(img.height);

    const baseImg = new fabric.Image(img, { left: 0, top: 0, selectable: false, evented: false });
    off.add(baseImg);

    const scaleX = img.width / editor.fabric.getWidth();
    const scaleY = img.height / editor.fabric.getHeight();

    await new Promise((resolve) => {
      fabric.util.enlivenObjects(templateJson.objects, (objects) => {
        objects.forEach((obj) => {
          if (obj === undefined) return;
          obj.left = (obj.left || 0) * scaleX;
          obj.top = (obj.top || 0) * scaleY;
          obj.scaleX = (obj.scaleX || 1) * scaleX;
          obj.scaleY = (obj.scaleY || 1) * scaleY;
          off.add(obj);
        });
        resolve();
      });
    });

    off.renderAll();
    const settings = HWS.settings.get();
    const ext = settings.format === 'image/jpeg' ? 'jpg' : settings.format === 'image/webp' ? 'webp' : 'png';
    const dUrl = off.toDataURL({
      format: ext === 'jpg' ? 'jpeg' : ext,
      quality: settings.quality / 100,
    });
    const blob = await (await fetch(dUrl)).blob();
    off.dispose();

    const filename = HWS.exifPipelineFilename
      ? HWS.exifPipelineFilename
      : HWS.exportPipeline.buildFilename(settings.filenameTemplate, item.name, ext);
    return { blob, filename };
  }

  async function run() {
    if (running) return;
    if (!editor.fabric.getObjects().some((o) => o !== editor.baseImage)) {
      HWS.utils.toast('Add at least one watermark in the editor first');
      return;
    }
    running = true;
    cancelled = false;
    paused = false;
    $('btnBatchPause').textContent = 'Pause';

    // Snapshot the current watermark layers (excluding base image) as a portable template.
    const fullJson = editor.fabric.toJSON(['watermarkType']);
    const templateJson = { objects: fullJson.objects.filter((o, i) => editor.fabric.item(i) !== editor.baseImage) };

    const startedAt = Date.now();
    let done = 0;
    updateProgress(0, queue.length, startedAt);

    for (const item of queue) {
      if (cancelled) break;
      while (paused && !cancelled) await new Promise((r) => setTimeout(r, 150));
      if (cancelled) break;

      item.status = 'processing';
      render();
      try {
        const { blob, filename } = await processOne(item, templateJson);
        item.blob = blob;
        item.outName = filename;
        item.status = 'done';
      } catch (e) {
        item.status = 'error';
        console.error(e);
      }
      done += 1;
      updateProgress(done, queue.length, startedAt);
      render();
      await new Promise((r) => setTimeout(r, 0)); // yield to keep UI responsive
    }

    running = false;
    if (!cancelled) HWS.utils.toast('Batch processing complete');
  }

  function togglePause() {
    paused = !paused;
    $('btnBatchPause').textContent = paused ? 'Resume' : 'Pause';
  }

  function cancel() {
    cancelled = true;
    paused = false;
    HWS.utils.toast('Batch cancelled');
  }

  async function exportAll() {
    if (queue.every((i) => i.status !== 'done')) {
      await run();
    }
    const doneItems = queue.filter((i) => i.status === 'done' && i.blob);
    if (doneItems.length === 0) {
      HWS.utils.toast('Nothing to export yet');
      return;
    }
    const zip = new JSZip();
    doneItems.forEach((i) => zip.file(i.outName, i.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'husain-watermark-studio-batch.zip');
  }

  return { init, addFiles, clearQueue, run, exportAll };
})();

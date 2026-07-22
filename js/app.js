/* ============================================================
   app.js — boots the app: splash → home → editor/batch/settings
   routing, upload handling, tool-panel switching, autosave, and
   service worker registration for offline/PWA support.
   ============================================================ */
'use strict';

HWS.app = (() => {
  const $ = (id) => document.getElementById(id);
  let editor = null;
  let autosaveTimer = null;

  const panelByTool = {
    text: 'panelText', logo: 'panelLogo', signature: 'panelSignature',
    qr: 'panelQr', exif: 'panelExif', repeat: 'panelRepeat',
    layers: 'panelLayers', adjust: 'panelAdjust',
  };

  function boot() {
    HWS.settings.applyTheme(HWS.settings.get().theme);
    runSplash();
    bindHome();
    bindViewSwitchers();
    registerServiceWorker();
  }

  // ---------------------------------------------------------
  // Splash
  // ---------------------------------------------------------
  function runSplash() {
    const fill = $('splashProgress');
    requestAnimationFrame(() => (fill.style.width = '100%'));
    setTimeout(() => {
      $('view-splash').classList.add('hidden');
      $('view-home').classList.remove('hidden');
      loadRecents();
    }, 900);
  }

  // ---------------------------------------------------------
  // Home: upload handling
  // ---------------------------------------------------------
  function bindHome() {
    const dropzone = $('dropzone');
    const fileInput = $('fileInput');
    const cameraInput = $('cameraInput');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    $('btnCamera').addEventListener('click', (e) => { e.stopPropagation(); cameraInput.click(); });

    ['dragenter', 'dragover'].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); })
    );
    dropzone.addEventListener('drop', (e) => handleFiles(Array.from(e.dataTransfer.files)));
    fileInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));
    cameraInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));

    $('btnSettings').addEventListener('click', () => showView('settings'));
  }

  function handleFiles(files) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;

    if (images.length === 1) {
      openEditorWith(images[0]);
    } else {
      HWS.batch.addFiles(images);
      showView('batch');
      HWS.utils.toast(`${images.length} images added to batch`);
    }
  }

  async function openEditorWith(file) {
    if (!editor) initEditorOnce();
    showView('editor');
    await editor.loadFromFile(file);
    HWS.watermarkExif.refreshDetected();
  }

  // ---------------------------------------------------------
  // Editor init (lazy, once)
  // ---------------------------------------------------------
  function initEditorOnce() {
    editor = new HWS.Editor();
    HWS.watermarkText.init(editor);
    HWS.watermarkLogo.init(editor);
    HWS.watermarkSignature.init(editor);
    HWS.watermarkQr.init(editor);
    HWS.watermarkExif.init(editor);
    HWS.watermarkRepeat.init(editor);
    HWS.adjustments.init(editor);
    HWS.layersPanel.init(editor);
    HWS.exportPipeline.init(editor);
    HWS.batch.init(editor);

    bindToolRail();
    bindEditorTopbar();
    window.addEventListener('resize', HWS.utils.debounce(() => editor.fitToScreen(), 150));
  }

  function bindToolRail() {
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.dataset.tool;
        showPropsPanel(tool);
        if (tool === 'exif') HWS.watermarkExif.refreshDetected();
        if (tool === 'layers') HWS.layersPanel.refresh();
        openPropsSheetOnMobile();
      });
    });

    $('fabAddWatermark').addEventListener('click', () => {
      document.getElementById('propsPanel').classList.add('open');
    });
  }

  function showPropsPanel(tool) {
    document.querySelectorAll('.props-section').forEach((s) => s.classList.add('hidden'));
    $('propsEmpty').classList.add('hidden');
    const id = panelByTool[tool];
    if (id) {
      $(id).classList.remove('hidden');
      HWS.watermarkText.resetActive && tool !== 'text' && HWS.watermarkText.resetActive();
      HWS.watermarkLogo.resetActive && tool !== 'logo' && HWS.watermarkLogo.resetActive();
    } else {
      $('propsEmpty').classList.remove('hidden');
    }
  }

  function openPropsSheetOnMobile() {
    if (window.innerWidth <= 860) $('propsPanel').classList.add('open');
  }

  function bindEditorTopbar() {
    $('btnBackHome').addEventListener('click', () => showView('home'));
    $('btnUndo').addEventListener('click', () => editor.history.undo());
    $('btnRedo').addEventListener('click', () => editor.history.redo());

    // Tap outside the sheet closes it on mobile
    document.getElementById('canvasStage').addEventListener('click', () => {
      if (window.innerWidth <= 860) $('propsPanel').classList.remove('open');
    });
  }

  // ---------------------------------------------------------
  // View routing
  // ---------------------------------------------------------
  function showView(name) {
    ['home', 'editor', 'batch', 'settings'].forEach((v) => $(`view-${v}`).classList.add('hidden'));
    $(`view-${name}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.nav === name));
    if (name === 'settings') HWS.settings.bindUI();
  }

  function bindViewSwitchers() {
    document.querySelectorAll('.nav-item').forEach((btn) =>
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'batch') showView('batch');
        else if (target === 'templates') HWS.utils.toast('Templates library — save a watermark preset from the editor first');
        else showView(target);
      })
    );
    $('btnBatchBack').addEventListener('click', () => showView('home'));
    $('btnSettingsBack').addEventListener('click', () => showView('home'));
  }

  // ---------------------------------------------------------
  // Autosave (IndexedDB) — debounced snapshot of the active project
  // ---------------------------------------------------------
  function scheduleAutosave() {
    if (!HWS.settings.get().autosave || !editor || !editor.sourceMeta) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      const thumb = editor.fabric.toDataURL({ format: 'jpeg', quality: 0.5, multiplier: 120 / editor.fabric.getWidth() });
      await HWS.storage.saveRecent({
        id: editor.sourceMeta.projectId || (editor.sourceMeta.projectId = HWS.utils.uid('proj')),
        name: editor.sourceMeta.name,
        thumb,
        json: editor.fabric.toJSON(['watermarkType']),
        width: editor.sourceMeta.width,
        height: editor.sourceMeta.height,
      });
      loadRecents();
    }, 1200);
  }

  async function loadRecents() {
    const recents = await HWS.storage.listRecents();
    const grid = $('recentGrid');
    const empty = $('recentEmpty');
    grid.querySelectorAll('.recent-card').forEach((n) => n.remove());
    if (recents.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    recents.slice(0, 12).forEach((p) => {
      const card = document.createElement('div');
      card.className = 'recent-card';
      card.innerHTML = `<img src="${p.thumb}" alt="${p.name}" /><span class="recent-name">${p.name}</span>`;
      card.addEventListener('click', () => reopenProject(p));
      grid.appendChild(card);
    });
  }

  async function reopenProject(project) {
    if (!editor) initEditorOnce();
    showView('editor');
    editor._setStageSize(project.width, project.height);
    editor.sourceMeta = { name: project.name, width: project.width, height: project.height, exif: {}, projectId: project.id };
    await new Promise((resolve) => editor.fabric.loadFromJSON(project.json, () => resolve()));
    editor.baseImage = editor.fabric.getObjects().find((o) => o.type === 'image' && !o.watermarkType) || editor.fabric.item(0);
    editor.fitToScreen();
    editor.history.reset();
    document.getElementById('editorFilename').textContent = project.name;
    $('canvasEmpty').classList.add('hidden');
  }

  // ---------------------------------------------------------
  // PWA
  // ---------------------------------------------------------
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* offline install unavailable (e.g. sandboxed preview) — app still works online */
      });
    }
  }

  return { boot, scheduleAutosave, showView };
})();

document.addEventListener('DOMContentLoaded', HWS.app.boot);

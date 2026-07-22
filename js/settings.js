/* ============================================================
   settings.js — app-wide preferences (theme, export defaults,
   performance mode, autosave). Small and synchronous, so we use
   localStorage rather than IndexedDB for this one.
   ============================================================ */
'use strict';

HWS.settings = (() => {
  const KEY = 'hws_settings_v1';
  const defaults = {
    theme: 'dark',
    format: 'image/jpeg',
    quality: 92,
    filenameTemplate: '{filename}_watermarked',
    preserveExif: true,
    stripGps: false,
    perfMode: 'balanced',
    autosave: true,
  };

  function get() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return { ...defaults };
    }
  }

  function set(patch) {
    const next = { ...get(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function applyTheme(theme) {
    const t = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.setAttribute('data-theme', t);
    const icon = document.getElementById('iconTheme');
    if (icon) {
      icon.innerHTML = t === 'light'
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  }

  function bindUI() {
    const s = get();
    const $ = (id) => document.getElementById(id);
    $('setTheme').value = s.theme;
    $('setFormat').value = s.format;
    $('setQuality').value = s.quality;
    $('setFilenameTemplate').value = s.filenameTemplate;
    $('setPreserveExif').checked = s.preserveExif;
    $('setStripGps').checked = s.stripGps;
    $('setPerfMode').value = s.perfMode;
    $('setAutosave').checked = s.autosave;

    $('setTheme').addEventListener('change', (e) => { set({ theme: e.target.value }); applyTheme(e.target.value); });
    $('setFormat').addEventListener('change', (e) => set({ format: e.target.value }));
    $('setQuality').addEventListener('input', (e) => set({ quality: Number(e.target.value) }));
    $('setFilenameTemplate').addEventListener('input', (e) => set({ filenameTemplate: e.target.value }));
    $('setPreserveExif').addEventListener('change', (e) => set({ preserveExif: e.target.checked }));
    $('setStripGps').addEventListener('change', (e) => set({ stripGps: e.target.checked }));
    $('setPerfMode').addEventListener('change', (e) => set({ perfMode: e.target.value }));
    $('setAutosave').addEventListener('change', (e) => set({ autosave: e.target.checked }));

    $('btnClearData').addEventListener('click', async () => {
      if (!confirm('This removes all saved projects, templates and settings from this device. Continue?')) return;
      await HWS.storage.clearAll();
      localStorage.removeItem(KEY);
      HWS.utils.toast('Local data cleared');
      setTimeout(() => location.reload(), 600);
    });

    document.getElementById('btnTheme').addEventListener('click', () => {
      const current = get().theme === 'light' ? 'dark' : 'light';
      set({ theme: current });
      $('setTheme').value = current;
      applyTheme(current);
    });
  }

  return { get, set, applyTheme, bindUI };
})();

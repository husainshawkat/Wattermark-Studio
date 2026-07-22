/* ============================================================
   utils.js — small shared helpers used across every module.
   ============================================================ */
'use strict';

const HWS = (window.HWS = window.HWS || {});

HWS.utils = {
  /** Debounce a function by `ms` milliseconds. */
  debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  /** Clamp a number between min and max. */
  clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  },

  /** Generate a short unique id. */
  uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  /** Format bytes as a human string. */
  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  },

  /** Strip the extension off a filename. */
  baseName(name) {
    return name.replace(/\.[^/.]+$/, '');
  },

  extOf(name) {
    const m = name.match(/\.([^/.]+)$/);
    return m ? m[1].toLowerCase() : '';
  },

  /** Render a Date as YYYY-MM-DD / localized time. */
  formatDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
  },
  formatTime(d = new Date()) {
    return d.toTimeString().slice(0, 5);
  },

  /** Read a File as a data URL (Promise). */
  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  },

  /** Load an <img> from a src (Promise). */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  },

  /** Show a small toast notification. */
  toast(message, ms = 2400) {
    const region = document.getElementById('toastRegion');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 200ms ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 220);
    }, ms);
  },

  /** Detect touch-capable device. */
  isTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },
};

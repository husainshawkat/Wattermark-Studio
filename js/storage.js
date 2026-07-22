/* ============================================================
   storage.js — IndexedDB persistence: projects, templates,
   recent files, and app settings. Everything stays on-device.
   ============================================================ */
'use strict';

HWS.storage = (() => {
  const DB_NAME = 'hws_db';
  const DB_VERSION = 1;
  const STORES = ['projects', 'templates', 'recents', 'kv'];
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      const result = fn(store);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  return {
    async put(storeName, record) {
      await tx(storeName, 'readwrite', (store) => store.put(record));
      return record;
    },
    async get(storeName, id) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    async delete(storeName, id) {
      return tx(storeName, 'readwrite', (store) => store.delete(id));
    },
    async all(storeName) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    async clearAll() {
      const db = await open();
      return Promise.all(
        STORES.map(
          (name) =>
            new Promise((resolve, reject) => {
              const req = db.transaction(name, 'readwrite').objectStore(name).clear();
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })
        )
      );
    },

    // --- convenience: simple key/value settings ---
    async setKV(key, value) {
      return this.put('kv', { id: key, value });
    },
    async getKV(key, fallback = null) {
      const rec = await this.get('kv', key);
      return rec ? rec.value : fallback;
    },

    // --- recent projects (thumbnail + fabric JSON) ---
    async saveRecent(project) {
      project.id = project.id || HWS.utils.uid('proj');
      project.updatedAt = Date.now();
      return this.put('recents', project);
    },
    async listRecents() {
      const all = await this.all('recents');
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    },
  };
})();

const DB_NAME = 'BibliotekarshaConfigDB_v1';
const STORE_NAME = 'kv';
const KEY_MODULES = 'enabled_modules';

let state: Record<string, boolean> = {};
const listeners = new Set<() => void>();

function openCfgDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveModulesToIDB(data: Record<string, boolean>): Promise<void> {
  try {
    const db = await openCfgDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, KEY_MODULES);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

(async () => {
  try {
    const db = await openCfgDB();
    const saved = await new Promise<Record<string, boolean> | undefined>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY_MODULES);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (saved && typeof saved === 'object') {
      state = saved;
      listeners.forEach((fn) => fn());
    }
  } catch {}
})();

export function isModuleEnabled(id: string, defaultEnabled = true): boolean {
  if (id === 'bsh-settings') return true;
  return state[id] !== undefined ? Boolean(state[id]) : defaultEnabled;
}

export function setModuleEnabled(id: string, enabled: boolean): void {
  if (id === 'bsh-settings') return;
  state = { ...state, [id]: enabled };
  saveModulesToIDB(state);
  listeners.forEach((fn) => fn());
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}


export function getAllModuleStates(): Record<string, boolean> {
  return { ...state };
}

export function replaceAllModuleStates(next: Record<string, boolean>, mode: 'merge' | 'overwrite' = 'overwrite'): void {
  const clean: Record<string, boolean> = mode === 'merge' ? { ...state } : {};
  for (const [k, v] of Object.entries(next || {})) {
    if (k !== 'bsh-settings') {
      clean[k] = Boolean(v);
    }
  }
  state = clean;
  saveModulesToIDB(state);
  listeners.forEach((fn) => fn());
}

import { ALL_MODULES } from '../modules/registry';
import { FilterPreset, getSavedPresets } from '../stores/filters';
import {
  DEFAULT_INCOGNITO_SETTINGS,
  StoreWebkitSettings,
  getIncognitoSettings,
  updateIncognitoSettings,
} from '../stores/incognito';
import { getAllModuleStates, isModuleEnabled, replaceAllModuleStates } from '../stores/settings';
import { ensureWatcherLoaded } from '../stores/watcher';
import { sharedStorageExportAll, sharedStorageImportAll } from './sharedStorage';

const PRESETS_KEY = 'bibliotekarsha_presets_v1';
const WATCHER_DB_NAME = 'BibliotekarshaWatcherDB_v1';
const WATCHER_KV_STORE = 'kv';

export interface BibliotekarshaBackupPayload {
  meta: {
    plugin: 'Bibliotekarsha';
    schemaVersion: 1;
    exportedAt: string;
  };
  modules: Record<string, boolean>;
  storeConfig: StoreWebkitSettings;
  filterPresets: FilterPreset[];
  sharedData: Record<string, any>;
  watcherDb: Record<string, any>;
}

export interface BackupPreviewStats {
  valid: boolean;
  error?: string;
  exportedAt?: string;
  hasModules: boolean;
  hasStoreConfig: boolean;
  presetsCount: number;
  notesCount: number;
  incognitoWishlistCount: number;
  hiddenNewsCount: number;
  salesMasterKeysCount: number;
  watcherKeysCount: number;
  watcherProfilesCount: number;
}

export interface BackupRestoreOptions {
  restoreSettings: boolean;
  restorePresets: boolean;
  restoreSharedData: boolean;
  restoreWatcher: boolean;
  mode: 'merge' | 'overwrite';
}

function openWatcherRawDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(WATCHER_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(WATCHER_KV_STORE)) {
        req.result.createObjectStore(WATCHER_KV_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dumpWatcherIndexedDB(): Promise<Record<string, any>> {
  try {
    const db = await openWatcherRawDB();
    return await new Promise<Record<string, any>>((resolve) => {
      const out: Record<string, any> = {};
      const tx = db.transaction(WATCHER_KV_STORE, 'readonly');
      const store = tx.objectStore(WATCHER_KV_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        out[String(cursor.key)] = cursor.value;
        cursor.continue();
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve(out);
    });
  } catch {
    return {};
  }
}

async function restoreWatcherIndexedDB(data: Record<string, any>, mode: 'merge' | 'overwrite'): Promise<void> {
  if (!data || typeof data !== 'object') return;
  try {
    const db = await openWatcherRawDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(WATCHER_KV_STORE, 'readwrite');
      const store = tx.objectStore(WATCHER_KV_STORE);
      if (mode === 'overwrite') {
        store.clear();
      }
      for (const [k, v] of Object.entries(data)) {
        store.put(v, k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    await ensureWatcherLoaded(true);
  } catch {}
}

export async function createFullBackup(): Promise<BibliotekarshaBackupPayload> {
  const rawMods = getAllModuleStates();
  const fullModules: Record<string, boolean> = {};
  for (const mod of ALL_MODULES) {
    if (mod.id === 'bsh-settings') continue;
    fullModules[mod.id] = isModuleEnabled(mod.id, mod.defaultEnabled);
  }
  Object.assign(fullModules, rawMods);

  const [sharedData, watcherDb] = await Promise.all([
    sharedStorageExportAll(),
    dumpWatcherIndexedDB(),
  ]);

  return {
    meta: {
      plugin: 'Bibliotekarsha',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
    },
    modules: fullModules,
    storeConfig: { ...getIncognitoSettings() },
    filterPresets: getSavedPresets(),
    sharedData,
    watcherDb,
  };
}

export function triggerBackupDownload(payload: BibliotekarshaBackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Bibliotekarsha_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function inspectBackupJson(rawText: string): {
  stats: BackupPreviewStats;
  payload: Partial<BibliotekarshaBackupPayload> | null;
} {
  const empty: BackupPreviewStats = {
    valid: false,
    hasModules: false,
    hasStoreConfig: false,
    presetsCount: 0,
    notesCount: 0,
    incognitoWishlistCount: 0,
    hiddenNewsCount: 0,
    salesMasterKeysCount: 0,
    watcherKeysCount: 0,
    watcherProfilesCount: 0,
  };

  if (!rawText || !rawText.trim()) {
    return { stats: { ...empty, error: 'Ожидание файла или текста JSON...' }, payload: null };
  }

  try {
    const obj = JSON.parse(rawText);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { stats: { ...empty, error: 'Некорректная структура JSON.' }, payload: null };
    }

    const hasModules = Boolean(obj.modules && typeof obj.modules === 'object');
    const hasStoreConfig = Boolean(obj.storeConfig && typeof obj.storeConfig === 'object');
    const presetsCount = Array.isArray(obj.filterPresets) ? obj.filterPresets.length : 0;
    const shared = obj.sharedData && typeof obj.sharedData === 'object' ? obj.sharedData : {};
    const watcher = obj.watcherDb && typeof obj.watcherDb === 'object' ? obj.watcherDb : {};

    if (
      !hasModules &&
      !hasStoreConfig &&
      presetsCount === 0 &&
      Object.keys(shared).length === 0 &&
      Object.keys(watcher).length === 0
    ) {
      return {
        stats: { ...empty, error: 'В файле не найдены разделы бэкапа Bibliotekarsha.' },
        payload: null,
      };
    }

    let notesCount = 0;
    let incognitoWishlistCount = 0;
    let hiddenNewsCount = 0;
    let salesMasterKeysCount = 0;

    for (const [k, v] of Object.entries(shared)) {
      if (k.startsWith('use_game_notes_db') && v && typeof v === 'object') {
        notesCount += Object.keys(v).length;
      } else if (k.startsWith('use_incognito_wishlist_db') && v && typeof v === 'object') {
        incognitoWishlistCount += Object.keys(v).length;
      } else if (k.startsWith('use_hiddenNewsData') && Array.isArray(v)) {
        hiddenNewsCount += v.length;
      } else if (k.startsWith('salesMaster_v1_')) {
        salesMasterKeysCount++;
      }
    }

    const profileIds = new Set<string>();
    for (const k of Object.keys(watcher)) {
      const m = k.match(/^acc:([^:]+):/);
      if (m?.[1] && m[1] !== 'default') profileIds.add(m[1]);
    }

    return {
      payload: obj,
      stats: {
        valid: true,
        exportedAt: obj.meta?.exportedAt,
        hasModules,
        hasStoreConfig,
        presetsCount,
        notesCount,
        incognitoWishlistCount,
        hiddenNewsCount,
        salesMasterKeysCount,
        watcherKeysCount: Object.keys(watcher).length,
        watcherProfilesCount: profileIds.size,
      },
    };
  } catch {
    return { stats: { ...empty, error: 'Ошибка разбора JSON. Проверьте целостность файла.' }, payload: null };
  }
}

export async function applyFullBackup(
  payload: Partial<BibliotekarshaBackupPayload>,
  options: BackupRestoreOptions
): Promise<string[]> {
  const restoredParts: string[] = [];

  if (options.restoreSettings) {
    if (payload.modules && typeof payload.modules === 'object') {
      replaceAllModuleStates(payload.modules, options.mode);
      restoredParts.push('модули библиотеки');
    }
    if (payload.storeConfig && typeof payload.storeConfig === 'object') {
      const nextCfg =
        options.mode === 'overwrite'
          ? { ...DEFAULT_INCOGNITO_SETTINGS, ...payload.storeConfig }
          : { ...getIncognitoSettings(), ...payload.storeConfig };
      await updateIncognitoSettings(nextCfg);
      restoredParts.push('настройки магазина и В.Р.И.');
    }
  }

  if (options.restorePresets && Array.isArray(payload.filterPresets)) {
    try {
      let nextPresets = payload.filterPresets;
      if (options.mode === 'merge') {
        const existing = getSavedPresets();
        const incomingNames = new Set(nextPresets.map((p) => p.name.toLowerCase()));
        nextPresets = [...nextPresets, ...existing.filter((p) => !incomingNames.has(p.name.toLowerCase()))];
      }
      localStorage.setItem(PRESETS_KEY, JSON.stringify(nextPresets));
      restoredParts.push(`шаблоны фильтров (${nextPresets.length})`);
    } catch {}
  }

  if (options.restoreSharedData && payload.sharedData && typeof payload.sharedData === 'object') {
    const res = await sharedStorageImportAll(payload.sharedData, options.mode);
    if (res.ok) {
      restoredParts.push(`личные базы (${res.imported} разд.)`);
    }
  }

  if (options.restoreWatcher && payload.watcherDb && typeof payload.watcherDb === 'object') {
    await restoreWatcherIndexedDB(payload.watcherDb, options.mode);
    restoredParts.push('база Наблюдателя');
  }

  return restoredParts;
}

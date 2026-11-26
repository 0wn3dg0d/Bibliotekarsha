export interface StoreWebkitConfig {
  enabled: boolean;
  defaultRegion: string;
  gamePage: boolean;
  autoLoadReviews: boolean;
  storeNfo: boolean;
  nfoAutoLoad: boolean;
  earlyAccess: boolean;
  priceAnalyzer: boolean;
  picsCheck: boolean;
  picsTargetRegion: string;
  giftHelper: boolean;
  gameNotes: boolean;
  incognitoWishlist: boolean;
  externalLinks: boolean;
  newsFilter: boolean;
  homeInfo: boolean;
  homeInfoEnglish: boolean;
  homeYoutubeFix: boolean;
  widgetFixer: boolean;
  ignoredCleaner: boolean;
  catalogTooltip: boolean;
  catalogTooltipEnglish: boolean;
  catalogFilters: boolean;
  catalogMassTools: boolean;
  wishlistGiftHelper: boolean;
  salesMaster: boolean;
  salesMasterAutoSearch: boolean;
  salesMasterAutoInsertTitle: boolean;
}

export const DEFAULT_WEBKIT_CONFIG: StoreWebkitConfig = {
  enabled: true,
  defaultRegion: 'US',
  gamePage: true,
  autoLoadReviews: false,
  storeNfo: true,
  nfoAutoLoad: true,
  earlyAccess: true,
  priceAnalyzer: true,
  picsCheck: true,
  picsTargetRegion: 'RU',
  giftHelper: true,
  gameNotes: true,
  incognitoWishlist: true,
  externalLinks: true,
  newsFilter: true,
  homeInfo: true,
  homeInfoEnglish: false,
  homeYoutubeFix: true,
  widgetFixer: true,
  ignoredCleaner: true,
  catalogTooltip: true,
  catalogTooltipEnglish: false,
  catalogFilters: true,
  catalogMassTools: true,
  wishlistGiftHelper: true,
  salesMaster: true,
  salesMasterAutoSearch: false,
  salesMasterAutoInsertTitle: false,
};

export const PLUGIN_NAME = 'com.0wn3df1x.bibliotekarsha';

export interface BackendRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  use_steam_auth?: boolean;
  timeout?: number;
}

export interface BackendResponse {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
  auth_injected?: boolean;
  cookies?: string;
}

export async function callBackendFetch(optionsJson: string): Promise<string> {
  const w = window as any;

  const ffiBinder = w.MILLENNIUM_PRIVATE_INTERNAL_FOREIGN_FUNCTION_INTERFACE_DO_NOT_USE;
  if (ffiBinder?.call) {
    const res = await ffiBinder.call(0, PLUGIN_NAME, 'fetch_url', [optionsJson]);
    return typeof res === 'string' ? res : JSON.stringify(res);
  }

  if (w.MILLENNIUM_BACKEND_IPC?.postMessage) {
    const res = await w.MILLENNIUM_BACKEND_IPC.postMessage(0, {
      pluginName: PLUGIN_NAME,
      methodName: 'fetch_url',
      argumentList: [optionsJson],
    });
    const val = res?.returnJson ?? res;
    return typeof val === 'string' ? val : JSON.stringify(val);
  }

  if (w.MILLENNIUM_API?.callServerMethod) {
    const res = await w.MILLENNIUM_API.callServerMethod(PLUGIN_NAME, 'fetch_url', { options_json: optionsJson });
    return typeof res === 'string' ? res : JSON.stringify(res);
  }

  throw new Error('Millennium IPC bridge unavailable');
}

export async function requestViaBackend(opts: BackendRequestOptions): Promise<BackendResponse> {
  try {
    const raw = await callBackendFetch(
      JSON.stringify({
        url: opts.url,
        method: opts.method || 'GET',
        headers: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          ...(opts.headers || {}),
        },
        body: opts.body,
        use_steam_auth: Boolean(opts.use_steam_auth),
        timeout: opts.timeout,
      })
    );
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      ok: Boolean(parsed?.ok),
      status: Number(parsed?.status) || 0,
      body: String(parsed?.body || ''),
      error: parsed?.error,
      auth_injected: Boolean(parsed?.auth_injected),
      cookies: typeof parsed?.cookies === 'string' ? parsed.cookies : '',
    };
  } catch (e: any) {
    return { ok: false, status: 0, body: '', error: e?.message || String(e) };
  }
}

export async function fetchViaBackend(
  url: string,
  headers: Record<string, string> = {}
): Promise<BackendResponse> {
  return requestViaBackend({ url, method: 'GET', headers });
}

export async function fetchAuthenticatedSteamUrl(url: string): Promise<BackendResponse> {
  return requestViaBackend({
    url,
    method: 'GET',
    use_steam_auth: true,
    headers: {
      Referer: 'https://steamcommunity.com/',
    },
  });
}

function unwrapConfigPayload(raw: any): Partial<StoreWebkitConfig> | null {
  if (!raw) return null;
  let obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (obj && typeof obj === 'object' && 'returnJson' in obj) {
    obj = typeof obj.returnJson === 'string' ? JSON.parse(obj.returnJson) : obj.returnJson;
  }
  if (obj && typeof obj === 'object' && 'value' in obj && obj.value && typeof obj.value === 'object') {
    obj = obj.value;
  }
  if (obj && typeof obj === 'object' && 'incognito' in obj && obj.incognito && typeof obj.incognito === 'object') {
    obj = obj.incognito;
  }
  return obj && typeof obj === 'object' ? obj : null;
}

export async function readStoreWebkitConfig(): Promise<StoreWebkitConfig> {
  try {
    const w = window as any;
    const ffiBinder = w.MILLENNIUM_PRIVATE_INTERNAL_FOREIGN_FUNCTION_INTERFACE_DO_NOT_USE;

    if (w.MILLENNIUM_API?.pluginConfig?.get) {
      const raw = await w.MILLENNIUM_API.pluginConfig.get(PLUGIN_NAME, 'incognito');
      const unwrapped = unwrapConfigPayload(raw);
      if (unwrapped) return { ...DEFAULT_WEBKIT_CONFIG, ...unwrapped };
    }

    if (ffiBinder?.call) {
      for (const args of [{ key: 'incognito' }, ['incognito'], {}]) {
        try {
          const raw = await ffiBinder.call(3, PLUGIN_NAME, 'get', args);
          const unwrapped = unwrapConfigPayload(raw);
          if (unwrapped && ('autoLoadReviews' in unwrapped || 'enabled' in unwrapped || 'gamePage' in unwrapped)) {
            return { ...DEFAULT_WEBKIT_CONFIG, ...unwrapped };
          }
        } catch {}
      }
    }

    if (w.MILLENNIUM_BACKEND_IPC?.postMessage) {
      const raw = await w.MILLENNIUM_BACKEND_IPC.postMessage(3, {
        pluginName: PLUGIN_NAME,
        methodName: 'get',
        argumentList: { key: 'incognito' },
      });
      const unwrapped = unwrapConfigPayload(raw);
      if (unwrapped) return { ...DEFAULT_WEBKIT_CONFIG, ...unwrapped };
    }
  } catch {}
  return { ...DEFAULT_WEBKIT_CONFIG };
}

export function injectStyleOnce(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

const STORE_DB_NAME = 'BibliotekarshaStoreWebkitDB_v1';
const STORE_KV_NAME = 'kv';

function openStoreWebkitDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STORE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_KV_NAME)) {
        req.result.createObjectStore(STORE_KV_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function isSharedPersistentKey(key: string): boolean {
  return (
    key.startsWith('use_game_notes_db') ||
    key.startsWith('use_incognito_wishlist_db') ||
    key.startsWith('use_hiddenNewsData') ||
    key.startsWith('salesMaster_v1_')
  );
}

async function callLuaStorage(methodName: string, payloadObj: any): Promise<any> {
  try {
    const w = window as any;
    const arg = JSON.stringify(payloadObj);
    let raw: any = null;
    const ffiBinder = w.MILLENNIUM_PRIVATE_INTERNAL_FOREIGN_FUNCTION_INTERFACE_DO_NOT_USE;
    if (ffiBinder?.call) {
      raw = await ffiBinder.call(0, PLUGIN_NAME, methodName, [arg]);
    } else if (w.MILLENNIUM_BACKEND_IPC?.postMessage) {
      const res = await w.MILLENNIUM_BACKEND_IPC.postMessage(0, {
        pluginName: PLUGIN_NAME,
        methodName,
        argumentList: [arg],
      });
      raw = res?.returnJson ?? res;
    } else if (w.MILLENNIUM_API?.callServerMethod) {
      raw = await w.MILLENNIUM_API.callServerMethod(PLUGIN_NAME, methodName, { payload_json: arg });
    }
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function localIdbGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const db = await openStoreWebkitDB();
    return await new Promise<T | undefined>((resolve) => {
      const tx = db.transaction(STORE_KV_NAME, 'readonly');
      const req = tx.objectStore(STORE_KV_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

function isDictPersistentKey(key: string): boolean {
  return key.startsWith('use_game_notes_db') || key.startsWith('use_incognito_wishlist_db');
}

async function localIdbSet(key: string, value: any): Promise<void> {
  try {
    const db = await openStoreWebkitDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_KV_NAME, 'readwrite');
      tx.objectStore(STORE_KV_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function localIdbDelete(key: string): Promise<void> {
  try {
    const db = await openStoreWebkitDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_KV_NAME, 'readwrite');
      tx.objectStore(STORE_KV_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export async function idbGet<T = any>(key: string): Promise<T | undefined> {
  if (isSharedPersistentKey(key)) {
    const remote = await callLuaStorage('bsh_storage_get', { key });
    if (remote?.ok) {
      if (remote.found) {
        let val = remote.value;
        if (isDictPersistentKey(key) && Array.isArray(val)) {
          val = {};
        }
        await localIdbSet(key, val);
        return val as T;
      }
      if (Number(remote.overwrite_epoch || 0) > 0) {
        await localIdbDelete(key);
        return undefined;
      }
    }
    const local = await localIdbGet<T>(key);
    if (local !== undefined) {
      const safeLocal = isDictPersistentKey(key) && Array.isArray(local) ? ({} as T) : local;
      await callLuaStorage('bsh_storage_set', { key, value: safeLocal });
      return safeLocal;
    }
    return undefined;
  }
  return localIdbGet<T>(key);
}

export async function idbSet(key: string, value: any): Promise<void> {
  if (isSharedPersistentKey(key)) {
    await callLuaStorage('bsh_storage_set', { key, value });
  }
  await localIdbSet(key, value);
}


export async function getActiveSteamId64(): Promise<string> {
  try {
    const w = window as any;
    let raw: any = null;
    const ffiBinder = w.MILLENNIUM_PRIVATE_INTERNAL_FOREIGN_FUNCTION_INTERFACE_DO_NOT_USE;
    if (ffiBinder?.call) {
      raw = await ffiBinder.call(0, PLUGIN_NAME, 'get_active_steam_id', []);
    } else if (w.MILLENNIUM_BACKEND_IPC?.postMessage) {
      const res = await w.MILLENNIUM_BACKEND_IPC.postMessage(0, {
        pluginName: PLUGIN_NAME,
        methodName: 'get_active_steam_id',
        argumentList: [],
      });
      raw = res?.returnJson ?? res;
    } else if (w.MILLENNIUM_API?.callServerMethod) {
      raw = await w.MILLENNIUM_API.callServerMethod(PLUGIN_NAME, 'get_active_steam_id', {});
    }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const id = String(parsed?.steamId64 || '').trim();
    if (/^7656\d{13}$/.test(id)) return id;
  } catch {}
  return '';
}

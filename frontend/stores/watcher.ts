import { getAccountDisplayLabel, getCurrentAccount, subscribeAccountChange, waitForAccountId } from '../services/accountContext';

export interface RuSupportState {
  supported: boolean;
  full_audio: boolean;
  subtitles: boolean;
}

export interface ReleaseInfoState {
  date: number | string;
  type: 'date' | 'custom' | 'unknown';
  displayType: string | null;
}

export interface TrackedWishlistGame {
  name: string;
  header: string | null;
  releaseInfo: ReleaseInfoState;
  is_early_access: boolean;
  ru_support: RuSupportState;
  has_demo: boolean;
  has_playtest: boolean;
  isUnavailable: boolean;
}

export interface TrackedOwnedGame {
  name: string;
  header: string | null;
  is_early_access: boolean;
  ru_support: RuSupportState;
  isUnavailable: boolean;
}

export interface RuChangeDetails {
  oldState: RuSupportState;
  newState: RuSupportState;
  added: RuSupportState;
  removed: RuSupportState;
}

export interface WatcherNotification {
  id: string;
  source: 'wishlist' | 'library';
  changeType:
    | 'date'
    | 'ea_status'
    | 'ru_lang'
    | 'demo_added'
    | 'demo_removed'
    | 'playtest_added'
    | 'playtest_removed'
    | 'delisted'
    | 'relisted';
  appid: number;
  name: string;
  header: string | null;
  oldDate?: { value: number | string; displayType: string | null };
  newDate?: { value: number | string; displayType: string | null };
  ruChangeDetails?: RuChangeDetails;
  timestamp: number;
  read: boolean;
}

export interface WatcherSettings {
  wishlist: boolean;
  library: boolean;
  recheckRussian: boolean;
  recheckPartial: boolean;
  autoUpdate: boolean;
  autoUpdateIntervalHours: number;
}

export const DEFAULT_WATCHER_SETTINGS: WatcherSettings = {
  wishlist: true,
  library: true,
  recheckRussian: true,
  recheckPartial: false,
  autoUpdate: false,
  autoUpdateIntervalHours: 24,
};

const DB_NAME = 'BibliotekarshaWatcherDB_v1';
const KV_STORE = 'kv';
const MAX_BATCH_SIZE = 150;

export interface StoredWatcherProfileSummary {
  accountId: string;
  label: string;
  wishlistCount: number;
  ownedCount: number;
  unreadCount: number;
  isCurrent: boolean;
}

interface WatcherMemoryState {
  initialized: boolean;
  accountId: string;
  accountLabel: string;
  updating: boolean;
  progress: number;
  statusText: string;
  errorText: string | null;
  settings: WatcherSettings;
  lastUpdateWishlist: number;
  lastUpdateLibrary: number;
  wishlistData: Record<number, TrackedWishlistGame>;
  ownedData: Record<number, TrackedOwnedGame>;
  ownedChecked: number[];
  notifications: WatcherNotification[];
}

const mem: WatcherMemoryState = {
  initialized: false,
  accountId: '',
  accountLabel: '',
  updating: false,
  progress: 0,
  statusText: '',
  errorText: null,
  settings: { ...DEFAULT_WATCHER_SETTINGS },
  lastUpdateWishlist: 0,
  lastUpdateLibrary: 0,
  wishlistData: {},
  ownedData: {},
  ownedChecked: [],
  notifications: [],
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeWatcher(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getWatcherState() {
  return mem;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openWatcherDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const LEGACY_MIGRATED_KEY = '__legacy_migrated_to_account_v1__';
const ACCOUNT_LABELS_KEY = '__account_labels_v1__';

async function rawKvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openWatcherDB();
    return await new Promise<T>((resolve) => {
      const tx = db.transaction(KV_STORE, 'readonly');
      const req = tx.objectStore(KV_STORE).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? (req.result as T) : fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

async function rawKvSet(key: string, val: any): Promise<void> {
  try {
    const db = await openWatcherDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(KV_STORE, 'readwrite');
      tx.objectStore(KV_STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function rawKvGetAllKeys(): Promise<string[]> {
  try {
    const db = await openWatcherDB();
    return await new Promise<string[]>((resolve) => {
      const tx = db.transaction(KV_STORE, 'readonly');
      const req = tx.objectStore(KV_STORE).getAllKeys();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result.map(String) : []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

function accKey(key: string, accountId = mem.accountId): string {
  const safeId = accountId || 'default';
  return `acc:${safeId}:${key}`;
}

function kvGet<T>(key: string, fallback: T, accountId = mem.accountId): Promise<T> {
  return rawKvGet<T>(accKey(key, accountId), fallback);
}

function kvSet(key: string, val: any, accountId = mem.accountId): Promise<void> {
  return rawKvSet(accKey(key, accountId), val);
}

async function migrateLegacyDataOnce(targetAccountId: string): Promise<void> {
  if (!targetAccountId || targetAccountId === 'default') return;
  const alreadyMigrated = await rawKvGet<string>(LEGACY_MIGRATED_KEY, '');
  if (alreadyMigrated) return;

  const existingW = await rawKvGet<Record<number, TrackedWishlistGame> | null>(
    accKey('wishlistData', targetAccountId),
    null
  );
  const existingO = await rawKvGet<Record<number, TrackedOwnedGame> | null>(
    accKey('ownedData', targetAccountId),
    null
  );
  if (existingW || existingO) {
    await rawKvSet(LEGACY_MIGRATED_KEY, targetAccountId);
    return;
  }

  const [oldSettings, oldLastW, oldLastL, oldW, oldO, oldChecked, oldNotifs] = await Promise.all([
    rawKvGet<WatcherSettings | null>('settings', null),
    rawKvGet<number>('lastUpdateWishlist', 0),
    rawKvGet<number>('lastUpdateLibrary', 0),
    rawKvGet<Record<number, TrackedWishlistGame>>('wishlistData', {}),
    rawKvGet<Record<number, TrackedOwnedGame>>('ownedData', {}),
    rawKvGet<number[]>('ownedChecked', []),
    rawKvGet<WatcherNotification[]>('notifications', []),
  ]);

  const hasLegacy =
    Boolean(oldSettings) ||
    oldLastW > 0 ||
    oldLastL > 0 ||
    Object.keys(oldW || {}).length > 0 ||
    Object.keys(oldO || {}).length > 0 ||
    (Array.isArray(oldNotifs) && oldNotifs.length > 0);

  if (hasLegacy) {
    await Promise.all([
      kvSet('settings', { ...DEFAULT_WATCHER_SETTINGS, ...(oldSettings || {}) }, targetAccountId),
      kvSet('lastUpdateWishlist', oldLastW || 0, targetAccountId),
      kvSet('lastUpdateLibrary', oldLastL || 0, targetAccountId),
      kvSet('wishlistData', oldW || {}, targetAccountId),
      kvSet('ownedData', oldO || {}, targetAccountId),
      kvSet('ownedChecked', Array.isArray(oldChecked) ? oldChecked : [], targetAccountId),
      kvSet('notifications', Array.isArray(oldNotifs) ? oldNotifs : [], targetAccountId),
    ]);
  }
  await rawKvSet(LEGACY_MIGRATED_KEY, targetAccountId);
}

async function saveAccountLabel(accountId: string, label: string): Promise<void> {
  if (!accountId || !label || label === 'Аккаунт не определён') return;
  const map = await rawKvGet<Record<string, string>>(ACCOUNT_LABELS_KEY, {});
  if (map[accountId] !== label) {
    map[accountId] = label;
    await rawKvSet(ACCOUNT_LABELS_KEY, map);
  }
}

export async function getStoredWatcherProfiles(): Promise<StoredWatcherProfileSummary[]> {
  const [keys, labels] = await Promise.all([
    rawKvGetAllKeys(),
    rawKvGet<Record<string, string>>(ACCOUNT_LABELS_KEY, {}),
  ]);
  const ids = new Set<string>();
  for (const k of keys) {
    const m = k.match(/^acc:([^:]+):/);
    if (m && m[1] && m[1] !== 'default') ids.add(m[1]);
  }
  if (mem.accountId && mem.accountId !== 'default') ids.add(mem.accountId);

  const profiles = await Promise.all(
    Array.from(ids).map(async (id) => {
      const [wData, oData, notifs] = await Promise.all([
        kvGet<Record<number, TrackedWishlistGame>>('wishlistData', {}, id),
        kvGet<Record<number, TrackedOwnedGame>>('ownedData', {}, id),
        kvGet<WatcherNotification[]>('notifications', [], id),
      ]);
      const isCurrent = id === mem.accountId;
      return {
        accountId: id,
        label: (isCurrent ? mem.accountLabel : labels[id]) || `ID ${id}`,
        wishlistCount: Object.keys(wData || {}).length,
        ownedCount: Object.keys(oData || {}).length,
        unreadCount: Array.isArray(notifs) ? notifs.filter((n) => !n.read).length : 0,
        isCurrent,
      };
    })
  );

  return profiles.sort((a, b) => (a.isCurrent === b.isCurrent ? a.accountId.localeCompare(b.accountId) : a.isCurrent ? -1 : 1));
}

let initPromise: Promise<void> | null = null;
let loadedAccountId = '';

export function ensureWatcherLoaded(forceReload = false): Promise<void> {
  const liveAcc = getCurrentAccount();
  if (
    !forceReload &&
    initPromise &&
    (!liveAcc.steamId64 || !loadedAccountId || loadedAccountId === liveAcc.steamId64)
  ) {
    return initPromise;
  }

  initPromise = (async () => {
    const resolvedId = (await waitForAccountId(8000)) || 'default';
    loadedAccountId = resolvedId;
    mem.accountId = resolvedId;
    mem.accountLabel = getAccountDisplayLabel(getCurrentAccount());

    await migrateLegacyDataOnce(resolvedId);
    await saveAccountLabel(resolvedId, mem.accountLabel);

    const [settings, lastW, lastL, wData, oData, oChecked, notifs] = await Promise.all([
      kvGet<WatcherSettings>('settings', DEFAULT_WATCHER_SETTINGS, resolvedId),
      kvGet<number>('lastUpdateWishlist', 0, resolvedId),
      kvGet<number>('lastUpdateLibrary', 0, resolvedId),
      kvGet<Record<number, TrackedWishlistGame>>('wishlistData', {}, resolvedId),
      kvGet<Record<number, TrackedOwnedGame>>('ownedData', {}, resolvedId),
      kvGet<number[]>('ownedChecked', [], resolvedId),
      kvGet<WatcherNotification[]>('notifications', [], resolvedId),
    ]);

    if (loadedAccountId !== resolvedId) return;

    mem.settings = { ...DEFAULT_WATCHER_SETTINGS, ...settings };
    mem.lastUpdateWishlist = lastW || 0;
    mem.lastUpdateLibrary = lastL || 0;
    mem.wishlistData = wData || {};
    mem.ownedData = oData || {};
    mem.ownedChecked = Array.isArray(oChecked) ? oChecked : [];
    mem.notifications = Array.isArray(notifs) ? notifs : [];
    mem.statusText = '';
    mem.errorText = null;
    mem.initialized = true;
    emit();
  })();

  return initPromise;
}

subscribeAccountChange((acc, prevId) => {
  if (acc.steamId64 && acc.steamId64 !== prevId) {
    mem.accountLabel = getAccountDisplayLabel(acc);
    if (acc.steamId64 !== loadedAccountId) {
      mem.initialized = false;
      mem.wishlistData = {};
      mem.ownedData = {};
      mem.ownedChecked = [];
      mem.notifications = [];
      mem.lastUpdateWishlist = 0;
      mem.lastUpdateLibrary = 0;
      emit();
      ensureWatcherLoaded(true);
    } else {
      saveAccountLabel(acc.steamId64, mem.accountLabel);
      emit();
    }
  } else if (acc.steamId64 && acc.steamId64 === mem.accountId) {
    const newLabel = getAccountDisplayLabel(acc);
    if (newLabel !== mem.accountLabel) {
      mem.accountLabel = newLabel;
      saveAccountLabel(acc.steamId64, newLabel);
      emit();
    }
  }
});

export async function saveWatcherSettings(patch: Partial<WatcherSettings>): Promise<void> {
  await ensureWatcherLoaded();
  mem.settings = { ...mem.settings, ...patch };
  await kvSet('settings', mem.settings);
  emit();
}

export async function toggleNotificationRead(id: string): Promise<void> {
  await ensureWatcherLoaded();
  const target = mem.notifications.find((n) => n.id === id);
  if (!target) return;
  target.read = !target.read;
  await kvSet('notifications', mem.notifications);
  emit();
}

export async function markAllNotificationsRead(): Promise<void> {
  await ensureWatcherLoaded();
  let changed = false;
  for (const n of mem.notifications) {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) {
    await kvSet('notifications', mem.notifications);
    emit();
  }
}

export async function deleteNotification(id: string): Promise<void> {
  await ensureWatcherLoaded();
  mem.notifications = mem.notifications.filter((n) => n.id !== id);
  await kvSet('notifications', mem.notifications);
  emit();
}

export async function clearAllNotifications(): Promise<void> {
  await ensureWatcherLoaded();
  mem.notifications = [];
  await kvSet('notifications', mem.notifications);
  emit();
}

export async function clearWishlistStorage(): Promise<void> {
  await ensureWatcherLoaded();
  mem.wishlistData = {};
  mem.lastUpdateWishlist = 0;
  mem.notifications = mem.notifications.filter((n) => n.source !== 'wishlist');
  await Promise.all([
    kvSet('wishlistData', {}),
    kvSet('lastUpdateWishlist', 0),
    kvSet('notifications', mem.notifications),
  ]);
  emit();
}

export async function clearLibraryStorage(): Promise<void> {
  await ensureWatcherLoaded();
  mem.ownedData = {};
  mem.ownedChecked = [];
  mem.lastUpdateLibrary = 0;
  mem.notifications = mem.notifications.filter((n) => n.source !== 'library');
  await Promise.all([
    kvSet('ownedData', {}),
    kvSet('ownedChecked', []),
    kvSet('lastUpdateLibrary', 0),
    kvSet('notifications', mem.notifications),
  ]);
  emit();
}

async function fetchUserData(): Promise<{ ok: boolean; wishlist: number[]; owned: number[]; error?: string }> {
  try {
    const res = await fetch(`https://store.steampowered.com/dynamicstore/userdata/?_t=${Date.now()}`, {
      credentials: 'include',
    });
    if (!res.ok) return { ok: false, wishlist: [], owned: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    if (!data || !Array.isArray(data.rgWishlist) || !Array.isArray(data.rgOwnedApps)) {
      return { ok: false, wishlist: [], owned: [], error: 'Некорректный формат userdata' };
    }
    return {
      ok: true,
      wishlist: data.rgWishlist.map(Number),
      owned: data.rgOwnedApps.map(Number),
    };
  } catch (e: any) {
    return { ok: false, wishlist: [], owned: [], error: e?.message || 'Сетевая ошибка' };
  }
}

async function fetchSingleStoreRequest(
  appIds: number[],
  countryCode: string
): Promise<{ ok: boolean; items: any[]; durationMs: number }> {
  const start = performance.now();
  const requestData = {
    ids: appIds.map((appid) => ({ appid })),
    context: { language: 'russian', country_code: countryCode, steam_realm: 1 },
    data_request: {
      include_assets: true,
      include_release: true,
      include_basic_info: true,
      include_supported_languages: true,
      include_included_items: true,
    },
  };
  const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
    JSON.stringify(requestData)
  )}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const durationMs = performance.now() - start;
    if (!res.ok) return { ok: false, items: [], durationMs };
    const json = await res.json();
    if (!json?.response) return { ok: false, items: [], durationMs };
    return { ok: true, items: json.response.store_items || [], durationMs };
  } catch {
    clearTimeout(timeout);
    return { ok: false, items: [], durationMs: performance.now() - start };
  }
}

async function fetchAppsAdaptive(
  allIds: number[],
  onProgress: (done: number, total: number) => void
): Promise<{ itemsById: Map<number, any>; succeededIds: Set<number> }> {
  const itemsById = new Map<number, any>();
  const succeededIds = new Set<number>();
  if (allIds.length === 0) return { itemsById, succeededIds };

  const pending = [...allIds];
  const retryCounts = new Map<number, number>();
  let batchSize = MAX_BATCH_SIZE;
  let processed = 0;

  while (pending.length > 0) {
    const batch = pending.splice(0, batchSize);
    const usRes = await fetchSingleStoreRequest(batch, 'US');

    if (!usRes.ok) {
      batchSize = Math.max(40, Math.floor(batchSize / 2));
      for (const id of batch) {
        const tries = (retryCounts.get(id) ?? 0) + 1;
        retryCounts.set(id, tries);
        if (tries <= 3) {
          pending.unshift(id);
        } else {
          processed++;
        }
      }
      onProgress(Math.min(processed, allIds.length), allIds.length);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (usRes.durationMs > 3500) {
      batchSize = Math.max(50, Math.floor(batchSize * 0.75));
    } else if (usRes.durationMs < 1200 && batchSize < MAX_BATCH_SIZE) {
      batchSize = Math.min(MAX_BATCH_SIZE, batchSize + 25);
    }

    const batchMap = new Map<number, any>();
    for (const item of usRes.items) {
      const id = Number(item?.appid || item?.id);
      if (id) batchMap.set(id, item);
    }

    const missingIds = batch.filter((id) => !batchMap.has(id));
    if (missingIds.length > 0) {
      const ruRes = await fetchSingleStoreRequest(missingIds, 'RU');
      if (ruRes.ok) {
        for (const item of ruRes.items) {
          const id = Number(item?.appid || item?.id);
          if (id) batchMap.set(id, item);
        }
      }
    }

    for (const id of batch) {
      succeededIds.add(id);
      const found = batchMap.get(id);
      if (found) itemsById.set(id, found);
      processed++;
    }

    onProgress(Math.min(processed, allIds.length), allIds.length);

    if (pending.length > 0) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return { itemsById, succeededIds };
}

function parseReleaseInfo(releaseData: any): ReleaseInfoState {
  if (!releaseData) return { date: 'Не указана', type: 'unknown', displayType: null };
  const displayType = releaseData.coming_soon_display || null;
  if (releaseData.steam_release_date) {
    return { date: releaseData.steam_release_date, type: 'date', displayType };
  }
  if (releaseData.custom_release_date_message) {
    return { date: releaseData.custom_release_date_message, type: 'custom', displayType: null };
  }
  return { date: 'Не указана', type: 'unknown', displayType: null };
}

function normalizeRu(raw: Partial<RuSupportState> | undefined): RuSupportState {
  const full_audio = Boolean(raw?.full_audio);
  const subtitles = Boolean(raw?.subtitles);
  const supported = Boolean(raw?.supported) || full_audio || subtitles;
  return { supported, full_audio, subtitles };
}

function parseGameStatus(item: any): {
  is_early_access: boolean;
  hasLangData: boolean;
  ru_support: RuSupportState;
} {
  const is_early_access = Boolean(item?.is_early_access ?? item?.release?.is_early_access);
  const langs = item?.supported_languages;
  if (!Array.isArray(langs) || langs.length === 0) {
    return {
      is_early_access,
      hasLangData: false,
      ru_support: { supported: false, full_audio: false, subtitles: false },
    };
  }
  const ruEntries = langs.filter(
    (l: any) => l && (l.elanguage === 8 || (typeof l.name === 'string' && l.name.toLowerCase() === 'russian'))
  );
  if (ruEntries.length === 0) {
    return {
      is_early_access,
      hasLangData: true,
      ru_support: { supported: false, full_audio: false, subtitles: false },
    };
  }
  const merged = ruEntries.reduce<RuSupportState>(
    (acc, l) => ({
      supported: acc.supported || Boolean(l.supported),
      full_audio: acc.full_audio || Boolean(l.full_audio),
      subtitles: acc.subtitles || Boolean(l.subtitles),
    }),
    { supported: false, full_audio: false, subtitles: false }
  );
  return {
    is_early_access,
    hasLangData: true,
    ru_support: normalizeRu(merged),
  };
}

function diffGameStatus(
  oldInfo: { is_early_access: boolean; ru_support: RuSupportState },
  newInfo: { is_early_access: boolean; hasLangData: boolean; ru_support: RuSupportState }
): Array<{ type: 'ea_status' | 'ru_lang'; details?: RuChangeDetails }> {
  const changes: Array<{ type: 'ea_status' | 'ru_lang'; details?: RuChangeDetails }> = [];
  if (oldInfo.is_early_access && !newInfo.is_early_access) {
    changes.push({ type: 'ea_status' });
  }
  if (!newInfo.hasLangData) {
    return changes;
  }
  const o = normalizeRu(oldInfo.ru_support);
  const n = normalizeRu(newInfo.ru_support);
  const added: RuSupportState = {
    supported: !o.supported && n.supported,
    full_audio: !o.full_audio && n.full_audio,
    subtitles: !o.subtitles && n.subtitles,
  };
  const removed: RuSupportState = {
    supported: o.supported && !n.supported,
    full_audio: o.full_audio && !n.full_audio,
    subtitles: o.subtitles && !n.subtitles,
  };
  if (added.supported || added.full_audio || added.subtitles || removed.supported || removed.full_audio || removed.subtitles) {
    changes.push({
      type: 'ru_lang',
      details: { oldState: o, newState: n, added, removed },
    });
  }
  return changes;
}

function makeNotifId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function runWatcherUpdate(): Promise<void> {
  await ensureWatcherLoaded();
  if (mem.updating) return;
  if (!mem.accountId || mem.accountId === 'default') {
    mem.errorText = 'Активный аккаунт Steam ещё не определён. Подождите пару секунд и повторите.';
    emit();
    return;
  }

  const runAccountId = mem.accountId;
  mem.updating = true;
  mem.errorText = null;
  mem.progress = 2;
  mem.statusText = 'Получение списков желаемого и библиотеки...';
  emit();

  try {
    if (!mem.settings.wishlist && !mem.settings.library) {
      mem.statusText = 'В настройках отключены оба источника.';
      return;
    }

    const userData = await fetchUserData();
    if (!userData.ok) {
      mem.errorText = `Не удалось получить данные аккаунта (${userData.error}). База сохранена.`;
      return;
    }

    const wishlistIds = userData.wishlist;
    const ownedIds = userData.owned;

    if (
      wishlistIds.length === 0 &&
      ownedIds.length === 0 &&
      (Object.keys(mem.wishlistData).length > 0 || Object.keys(mem.ownedData).length > 0)
    ) {
      mem.errorText = 'Steam вернул пустые списки аккаунта. База сохранена без изменений.';
      return;
    }

    const newNotifs: WatcherNotification[] = [];

    if (mem.settings.wishlist) {
      const nextWishlistData: Record<number, TrackedWishlistGame> = { ...mem.wishlistData };
      const wishSet = new Set(wishlistIds);
      for (const oldIdStr of Object.keys(nextWishlistData)) {
        const oldId = Number(oldIdStr);
        if (!wishSet.has(oldId)) delete nextWishlistData[oldId];
      }

      mem.statusText = `Проверка списка желаемого (${wishlistIds.length} игр)...`;
      mem.progress = 5;
      emit();

      const { itemsById, succeededIds } = await fetchAppsAdaptive(wishlistIds, (done, total) => {
        mem.statusText = `Список желаемого: ${done} / ${total}`;
        mem.progress = 5 + Math.round((done / Math.max(1, total)) * 40);
        emit();
      });

      for (const appid of wishlistIds) {
        const item = itemsById.get(appid);
        const prev = mem.wishlistData[appid];

        if (!item) {
          if (succeededIds.has(appid) && prev && !prev.isUnavailable) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: 'delisted',
              appid,
              name: prev.name,
              header: prev.header,
              timestamp: Date.now(),
              read: false,
            });
            nextWishlistData[appid] = { ...prev, isUnavailable: true };
          }
          continue;
        }

        const isUnavailable = item.visible === false || (item.success !== undefined && item.success !== 1);
        if (isUnavailable) {
          const name = prev?.name || item.name || `Игра #${appid}`;
          const header = prev?.header || item.assets?.header || null;
          if (prev && !prev.isUnavailable) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: 'delisted',
              appid,
              name,
              header,
              timestamp: Date.now(),
              read: false,
            });
          }
          nextWishlistData[appid] = {
            name,
            header,
            releaseInfo: prev?.releaseInfo || { date: 'Не указана', type: 'unknown', displayType: null },
            is_early_access: prev?.is_early_access || false,
            ru_support: prev?.ru_support || { supported: false, full_audio: false, subtitles: false },
            has_demo: prev?.has_demo || false,
            has_playtest: prev?.has_playtest || false,
            isUnavailable: true,
          };
          continue;
        }

        const rel = parseReleaseInfo(item.release);
        const status = parseGameStatus(item);
        const effectiveRu = status.hasLangData
          ? status.ru_support
          : prev?.ru_support || { supported: false, full_audio: false, subtitles: false };
        const has_demo = Boolean(
          item.related_items?.demo_appid ||
            item.related_items?.demos ||
            item.related_items?.standalone_demos ||
            item.related_items?.standalone_demo_appid
        );
        const has_playtest = Boolean(item.related_items?.playtests);
        const name = item.name || prev?.name || `Игра #${appid}`;
        const header = item.assets?.header || prev?.header || null;

        nextWishlistData[appid] = {
          name,
          header,
          releaseInfo: rel,
          is_early_access: status.is_early_access,
          ru_support: effectiveRu,
          has_demo,
          has_playtest,
          isUnavailable: false,
        };

        if (prev) {
          if (prev.isUnavailable) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: 'relisted',
              appid,
              name,
              header,
              timestamp: Date.now(),
              read: false,
            });
          }
          if (
            prev.releaseInfo &&
            (rel.date !== prev.releaseInfo.date ||
              rel.type !== prev.releaseInfo.type ||
              rel.displayType !== prev.releaseInfo.displayType)
          ) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: 'date',
              appid,
              name,
              header,
              oldDate: { value: prev.releaseInfo.date, displayType: prev.releaseInfo.displayType },
              newDate: { value: rel.date, displayType: rel.displayType },
              timestamp: Date.now(),
              read: false,
            });
          }
          const statusDiffs = diffGameStatus(
            { is_early_access: prev.is_early_access, ru_support: prev.ru_support },
            status
          );
          for (const ch of statusDiffs) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: ch.type,
              appid,
              name,
              header,
              ruChangeDetails: ch.details,
              timestamp: Date.now(),
              read: false,
            });
          }
          if (prev.has_demo !== has_demo) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: has_demo ? 'demo_added' : 'demo_removed',
              appid,
              name,
              header,
              timestamp: Date.now(),
              read: false,
            });
          }
          if (prev.has_playtest !== has_playtest) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'wishlist',
              changeType: has_playtest ? 'playtest_added' : 'playtest_removed',
              appid,
              name,
              header,
              timestamp: Date.now(),
              read: false,
            });
          }
        }
      }

      if (mem.accountId !== runAccountId) return;
      mem.wishlistData = nextWishlistData;
      mem.lastUpdateWishlist = Date.now();
      await Promise.all([
        kvSet('wishlistData', mem.wishlistData, runAccountId),
        kvSet('lastUpdateWishlist', mem.lastUpdateWishlist, runAccountId),
      ]);
    }

    if (mem.settings.library) {
      const checkedSet = new Set<number>(mem.ownedChecked);
      const nextOwnedData: Record<number, TrackedOwnedGame> = { ...mem.ownedData };

      let toCheck = ownedIds.filter((id) => !checkedSet.has(id));
      if (!mem.settings.recheckRussian) {
        toCheck = toCheck.filter((id) => {
          const prev = mem.ownedData[id];
          if (!prev || prev.isUnavailable || !prev.ru_support) return true;
          const full = prev.ru_support.supported && prev.ru_support.full_audio && prev.ru_support.subtitles;
          const any = prev.ru_support.supported || prev.ru_support.full_audio || prev.ru_support.subtitles;
          return mem.settings.recheckPartial ? !full : !any;
        });
      }

      mem.statusText = `Проверка библиотеки (${toCheck.length} игр)...`;
      mem.progress = 48;
      emit();

      const { itemsById, succeededIds } = await fetchAppsAdaptive(toCheck, (done, total) => {
        mem.statusText = `Библиотека: ${done} / ${total}`;
        mem.progress = 48 + Math.round((done / Math.max(1, total)) * 50);
        emit();
      });

      for (const appid of toCheck) {
        const item = itemsById.get(appid);
        const prev = mem.ownedData[appid];

        if (!item) {
          if (succeededIds.has(appid) && prev && !prev.isUnavailable) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'library',
              changeType: 'delisted',
              appid,
              name: prev.name,
              header: prev.header,
              timestamp: Date.now(),
              read: false,
            });
            nextOwnedData[appid] = { ...prev, isUnavailable: true };
          }
          continue;
        }

        if (item.type !== undefined && item.type !== 0) {
          checkedSet.add(appid);
          delete nextOwnedData[appid];
          continue;
        }

        const isUnavailable = item.visible === false || (item.success !== undefined && item.success !== 1);
        if (isUnavailable) {
          if (prev) {
            if (!prev.isUnavailable) {
              newNotifs.push({
                id: makeNotifId(),
                source: 'library',
                changeType: 'delisted',
                appid,
                name: prev.name || item.name || `Игра #${appid}`,
                header: prev.header || item.assets?.header || null,
                timestamp: Date.now(),
                read: false,
              });
            }
            nextOwnedData[appid] = { ...prev, isUnavailable: true };
          } else {
            checkedSet.add(appid);
          }
          continue;
        }

        const name = item.name || prev?.name || '';
        if (!name.trim()) {
          checkedSet.add(appid);
          delete nextOwnedData[appid];
          continue;
        }

        const header = item.assets?.header || prev?.header || null;
        const status = parseGameStatus(item);
        const effectiveRu = status.hasLangData
          ? status.ru_support
          : prev?.ru_support || { supported: false, full_audio: false, subtitles: false };

        nextOwnedData[appid] = {
          name,
          header,
          is_early_access: status.is_early_access,
          ru_support: effectiveRu,
          isUnavailable: false,
        };

        if (prev) {
          if (prev.isUnavailable) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'library',
              changeType: 'relisted',
              appid,
              name,
              header,
              timestamp: Date.now(),
              read: false,
            });
          }
          const statusDiffs = diffGameStatus(
            { is_early_access: prev.is_early_access, ru_support: prev.ru_support },
            status
          );
          for (const ch of statusDiffs) {
            newNotifs.push({
              id: makeNotifId(),
              source: 'library',
              changeType: ch.type,
              appid,
              name,
              header,
              ruChangeDetails: ch.details,
              timestamp: Date.now(),
              read: false,
            });
          }
        }
      }

      const ownedSet = new Set(ownedIds);
      for (const oldIdStr of Object.keys(nextOwnedData)) {
        const oldId = Number(oldIdStr);
        if (!ownedSet.has(oldId)) {
          delete nextOwnedData[oldId];
          checkedSet.delete(oldId);
        }
      }

      if (mem.accountId !== runAccountId) return;
      mem.ownedData = nextOwnedData;
      mem.ownedChecked = Array.from(checkedSet);
      mem.lastUpdateLibrary = Date.now();
      await Promise.all([
        kvSet('ownedData', mem.ownedData, runAccountId),
        kvSet('ownedChecked', mem.ownedChecked, runAccountId),
        kvSet('lastUpdateLibrary', mem.lastUpdateLibrary, runAccountId),
      ]);
    }

    if (mem.accountId !== runAccountId) return;
    if (newNotifs.length > 0) {
      mem.notifications = [...newNotifs, ...mem.notifications].slice(0, 1000);
      await kvSet('notifications', mem.notifications, runAccountId);
    }

    mem.statusText = `Готово! Новых уведомлений: ${newNotifs.length}`;
  } catch (e: any) {
    mem.errorText = `Ошибка обновления: ${e?.message || 'неизвестная ошибка'}`;
  } finally {
    mem.updating = false;
    mem.progress = 100;
    emit();
    setTimeout(() => {
      if (!mem.updating) {
        mem.progress = 0;
        emit();
      }
    }, 1200);
  }
}

export async function simulateChangeInDB(
  appId: number,
  mode: 'ru_lang' | 'date' | 'ea' | 'demo' = 'ru_lang'
): Promise<string> {
  await ensureWatcherLoaded();
  const wGame = mem.wishlistData[appId];
  const oGame = mem.ownedData[appId];

  if (!wGame && !oGame) {
    return `AppID ${appId} не найден в базе Наблюдателя. Сначала нажмите «Обновить» в окне Наблюдателя.`;
  }

  if (wGame) {
    if (mode === 'ru_lang') {
      wGame.ru_support = { supported: false, full_audio: false, subtitles: false };
    } else if (mode === 'date') {
      wGame.releaseInfo = { date: 'Скоро выйдет (тест)', type: 'custom', displayType: null };
    } else if (mode === 'ea') {
      wGame.is_early_access = true;
    } else if (mode === 'demo') {
      wGame.has_demo = !wGame.has_demo;
    }
    await kvSet('wishlistData', mem.wishlistData);
  }

  if (oGame) {
    if (mode === 'ru_lang') {
      oGame.ru_support = { supported: false, full_audio: false, subtitles: false };
    } else if (mode === 'ea') {
      oGame.is_early_access = true;
    }
    await kvSet('ownedData', mem.ownedData);
  }

  emit();
  return `Снимок игры "${wGame?.name || oGame?.name}" (${appId}) изменён (${mode}). Теперь нажмите «Обновить» в Наблюдателе!`;
}

if (typeof window !== 'undefined') {
  (window as any).__bibliotekarshaWatcher = {
    getState: () => mem,
    updateNow: runWatcherUpdate,
    simulateChange: simulateChangeInDB,
  };
}

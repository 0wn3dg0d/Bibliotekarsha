import { GameMeta, LocTier } from '../config/tiers';
import { getAllUserCollectionsSafe, isRatable, isSteamApp, libraryApps } from '../lib/steam';

const DB_NAME = 'BibliotekarshaDB_v5';
const STORE_NAME = 'games';
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000;

const cache = new Map();
const pendingIds = new Set();
const inFlightIds = new Set();
const retryCounts = new Map();
const listeners = new Set();
const progressListeners = new Set();

export interface FetchProgress {
  active: boolean;
  total: number;
  done: number;
  cachedCount: number;
}

let currentBatchSize = 150;
let totalSessionTarget = 0;
let flushTimer: any = null;
let isFetching = false;
let dbPromise: any = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

type PackedGame = [number, string, number, number, number[], number];

function packGame(g: GameMeta): PackedGame {
  let mask = 0;
  if (g.interface) mask |= 1;
  if (g.subtitles) mask |= 2;
  if (g.voice) mask |= 4;
  return [mask, g.releaseYear, g.reviewCount, g.reviewPercent, g.tagIds, g.updatedAt];
}

function unpackGame(p: PackedGame): GameMeta {
  const [mask, releaseYear, reviewCount, reviewPercent, tagIds, updatedAt] = p;
  const voice = Boolean(mask & 4);
  const subtitles = Boolean(mask & 2);
  const iface = Boolean(mask & 1) || voice || subtitles;
  let tier: LocTier = 'none';
  if (voice) tier = 'voice';
  else if (iface || subtitles) tier = 'subtitles';
  return {
    tier,
    interface: iface,
    subtitles,
    voice,
    releaseYear: releaseYear || 'Без даты',
    reviewCount: reviewCount || 0,
    reviewPercent: reviewPercent || 0,
    tagIds: Array.isArray(tagIds) ? tagIds : [],
    updatedAt,
  };
}

async function loadCacheFromDB(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      const now = Date.now();

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const appId = Number(cursor.key);
        const entry = unpackGame(cursor.value as PackedGame);
        cache.set(appId, entry);
        if (now - entry.updatedAt >= CACHE_TTL) {
          pendingIds.add(appId);
        }
        cursor.continue();
      };
      tx.oncomplete = () => {
        if (pendingIds.size > 0) {
          totalSessionTarget = Math.max(totalSessionTarget, pendingIds.size);
          scheduleFlush();
        }
        emitProgress();
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function saveBatchToDB(entries: any[]): Promise<void> {
  if (!entries.length) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [appId, data] of entries) {
      store.put(packGame(data), appId);
    }
  } catch {}
}

const initPromise = loadCacheFromDB();

export function cachedMeta(appId: number): GameMeta | null {
  return cache.get(appId) ?? null;
}

export function getFetchProgress(): FetchProgress {
  const remaining = pendingIds.size + inFlightIds.size;
  const total = Math.max(totalSessionTarget, remaining);
  const done = Math.max(0, total - remaining);
  return {
    active: isFetching || remaining > 0,
    total,
    done,
    cachedCount: cache.size,
  };
}

export function onFetchProgress(fn: (status: FetchProgress) => void): () => void {
  progressListeners.add(fn);
  fn(getFetchProgress());
  return () => progressListeners.delete(fn);
}

function emitProgress(): void {
  const status = getFetchProgress();
  progressListeners.forEach((fn) => fn(status));
}

export function onMetaUpdate(fn: (appId: number, data: GameMeta | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(appId: number, data: GameMeta | null): void {
  listeners.forEach((fn) => fn(appId, data));
}

export function requestMeta(appId: number): void {
  if (!isSteamApp(appId)) return;
  if (cache.has(appId) || pendingIds.has(appId) || inFlightIds.has(appId)) return;
  pendingIds.add(appId);
  totalSessionTarget++;
  scheduleFlush();
}

export function requestManyMeta(appIds: number[]): void {
  let added = 0;
  for (const appId of appIds) {
    if (!isSteamApp(appId)) continue;
    if (!cache.has(appId) && !pendingIds.has(appId) && !inFlightIds.has(appId)) {
      pendingIds.add(appId);
      added++;
    }
  }
  if (added > 0) {
    totalSessionTarget += added;
    scheduleFlush();
  }
}

export async function requestAllLibraryMeta(): Promise<number> {
  await initPromise;
  const allIds = new Set<number>();
  for (const app of libraryApps()) {
    allIds.add(app.appid);
  }
  for (const col of getAllUserCollectionsSafe()) {
    const apps = (col.visibleApps ?? col.allApps ?? []).filter(isRatable);
    for (const app of apps) {
      allIds.add(app.appid);
    }
  }
  if (allIds.size === 0) return 0;
  requestManyMeta(Array.from(allIds));
  return allIds.size;
}

function scheduleFlush(): void {
  emitProgress();
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    processQueue();
  }, 120);
}

interface StoreLanguageItem {
  name?: string;
  elanguage?: number;
  supported?: boolean;
  subtitles?: boolean;
  full_audio?: boolean;
}

interface StoreBrowseItem {
  appid: number;
  supported_languages?: StoreLanguageItem[];
  release?: { original_release_date?: number; steam_release_date?: number };
  reviews?: { summary_filtered?: { review_count?: number; percent_positive?: number } };
  tagids?: number[];
}

async function fetchStoreBatch(ids: number[], countryCode: string) {
  const start = performance.now();
  const requestData = {
    ids: ids.map((id) => ({ appid: id })),
    context: { language: 'russian', country_code: countryCode, steam_realm: 1 },
    data_request: {
      include_supported_languages: true,
      include_release: true,
      include_reviews: true,
      include_tag_count: true,
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
    if (!res.ok) return { ok: false, items: [] as StoreBrowseItem[], durationMs };
    const json = await res.json();
    const items = (json?.response?.store_items as StoreBrowseItem[]) ?? [];
    return { ok: true, items, durationMs };
  } catch {
    clearTimeout(timeout);
    return { ok: false, items: [] as StoreBrowseItem[], durationMs: performance.now() - start };
  }
}

function parseReleaseYear(ts: number | undefined): string {
  if (!ts) return 'Без даты';
  const year = new Date(ts * 1000).getUTCFullYear();
  return year > 1970 && year < 2100 ? String(year) : 'Без даты';
}

function parseGameMeta(item: StoreBrowseItem | undefined): GameMeta {
  const langs = item?.supported_languages ?? [];
  const ru = langs.find((l) => (l.name && l.name.toLowerCase() === 'russian') || l.elanguage === 8);

  const voice = Boolean(ru?.full_audio);
  const subtitles = Boolean(ru?.subtitles);
  const iface = Boolean(ru?.supported) || voice || subtitles;

  let tier: LocTier = 'none';
  if (voice) tier = 'voice';
  else if (iface || subtitles) tier = 'subtitles';

  const relTs = item?.release?.original_release_date || item?.release?.steam_release_date;

  return {
    tier,
    interface: iface,
    subtitles,
    voice,
    releaseYear: parseReleaseYear(relTs),
    reviewCount: item?.reviews?.summary_filtered?.review_count ?? 0,
    reviewPercent: item?.reviews?.summary_filtered?.percent_positive ?? 0,
    tagIds: Array.isArray(item?.tagids) ? item!.tagids! : [],
    updatedAt: Date.now(),
  };
}

async function processQueue(): Promise<void> {
  if (isFetching || pendingIds.size === 0) return;
  isFetching = true;
  emitProgress();

  try {
    while (pendingIds.size > 0) {
      const batch = Array.from(pendingIds).slice(0, currentBatchSize) as number[];
      batch.forEach((id) => {
        pendingIds.delete(id);
        inFlightIds.add(id);
      });
      emitProgress();

      const usRes = await fetchStoreBatch(batch, 'US');

      if (!usRes.ok) {
        currentBatchSize = Math.max(40, Math.floor(currentBatchSize / 2));
        for (const id of batch) {
          inFlightIds.delete(id);
          const tries = (retryCounts.get(id) ?? 0) + 1;
          retryCounts.set(id, tries);
          if (tries <= 3) {
            pendingIds.add(id);
          } else {
            const fallback = parseGameMeta(undefined);
            cache.set(id, fallback);
            notify(id, fallback);
          }
        }
        emitProgress();
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      if (usRes.durationMs > 3500) {
        currentBatchSize = Math.max(50, Math.floor(currentBatchSize * 0.75));
      } else if (usRes.durationMs < 1200 && currentBatchSize < 150) {
        currentBatchSize = Math.min(150, currentBatchSize + 25);
      }

      const itemsById = new Map();
      usRes.items.forEach((item) => itemsById.set(item.appid, item));

      const missingIds = batch.filter((id) => !itemsById.has(id));
      if (missingIds.length > 0) {
        const ruRes = await fetchStoreBatch(missingIds, 'RU');
        if (ruRes.ok) {
          ruRes.items.forEach((item) => itemsById.set(item.appid, item));
        }
      }

      const toSave: any[] = [];
      for (const appId of batch) {
        inFlightIds.delete(appId);
        retryCounts.delete(appId);
        const parsed = parseGameMeta(itemsById.get(appId));
        cache.set(appId, parsed);
        toSave.push([appId, parsed]);
        notify(appId, parsed);
      }

      await saveBatchToDB(toSave);
      emitProgress();

      if (pendingIds.size > 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  } finally {
    isFetching = false;
    totalSessionTarget = 0;
    emitProgress();
  }
}
